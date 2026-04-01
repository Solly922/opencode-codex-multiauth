import { generatePKCE } from '@openauthjs/openauth/pkce';
import { randomBytes } from 'node:crypto';
import * as http from 'http';
import * as net from 'node:net';
import * as url from 'url';
import { ProxyAgent } from 'undici';
import { addAccount, updateAccount, loadStore } from './store.js';
import { clearAuthInvalid } from './rotation.js';
import { decodeJwtPayload, getAccountIdFromClaims, getEmailFromClaims, getExpiryFromClaims } from './codex-auth.js';
const OPENAI_ISSUER = 'https://auth.openai.com';
const AUTHORIZE_URL = `${OPENAI_ISSUER}/oauth/authorize`;
const TOKEN_URL = `${OPENAI_ISSUER}/oauth/token`;
const USERINFO_URL = `${OPENAI_ISSUER}/userinfo`;
const DEVICE_CODE_URL = `${OPENAI_ISSUER}/api/accounts/deviceauth/usercode`;
const DEVICE_TOKEN_URL = `${OPENAI_ISSUER}/api/accounts/deviceauth/token`;
const DEVICE_REDIRECT_URI = `${OPENAI_ISSUER}/deviceauth/callback`;
const DEVICE_VERIFY_URL = `${OPENAI_ISSUER}/codex/device`;
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const DEFAULT_REDIRECT_PORTS = [1455, 1456, 1457, 1458, 1459];
const DEFAULT_REDIRECT_PORT = 1455;
const SCOPES = ['openid', 'profile', 'email', 'offline_access'];
const OAUTH_POLLING_SAFETY_MARGIN_MS = 3000;
const OAUTH_CALLBACK_HOST = 'localhost';
let proxyCache = null;
function getRedirectUri(port) {
    return `http://${OAUTH_CALLBACK_HOST}:${port}/auth/callback`;
}
function getDeviceUserAgent() {
    const explicit = process.env.OPENCODE_MULTI_AUTH_USER_AGENT?.trim();
    if (explicit)
        return explicit;
    const hostVersion = process.env.OPENCODE_VERSION?.trim() || 'unknown';
    return `opencode/${hostVersion}`;
}
function getNoProxyList() {
    return (process.env.NO_PROXY || process.env.no_proxy || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
}
function isNoProxyHost(hostname) {
    const host = hostname.toLowerCase();
    const rules = getNoProxyList();
    if (rules.includes('*'))
        return true;
    return rules.some((rule) => {
        const normalized = rule.replace(/^\./, '');
        if (!normalized)
            return false;
        return host === normalized || host.endsWith(`.${normalized}`);
    });
}
function resolveProxyForUrl(rawUrl) {
    const explicit = process.env.OPENCODE_MULTI_AUTH_PROXY_URL?.trim();
    if (explicit)
        return explicit;
    const parsed = new URL(rawUrl);
    if (isNoProxyHost(parsed.hostname))
        return null;
    if (parsed.protocol === 'https:') {
        return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy || null;
    }
    return process.env.HTTP_PROXY || process.env.http_proxy || process.env.ALL_PROXY || process.env.all_proxy || null;
}
function getDispatcherForUrl(rawUrl) {
    const proxyUrl = resolveProxyForUrl(rawUrl);
    if (!proxyUrl)
        return undefined;
    if (proxyCache?.key === proxyUrl)
        return proxyCache.dispatcher;
    const dispatcher = new ProxyAgent(proxyUrl);
    proxyCache = { key: proxyUrl, dispatcher };
    return dispatcher;
}
export async function fetchWithProxy(rawUrl, init) {
    const dispatcher = getDispatcherForUrl(rawUrl);
    if (!dispatcher)
        return fetch(rawUrl, init);
    return fetch(rawUrl, { ...(init || {}), dispatcher });
}
async function reserveRedirectPort(preferredPort) {
    const tryPort = (port) => new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(port, OAUTH_CALLBACK_HOST, () => {
            const address = server.address();
            const selected = typeof address === 'object' && address ? address.port : port;
            server.close(() => resolve(selected));
        });
    });
    const candidates = [preferredPort, ...DEFAULT_REDIRECT_PORTS.filter((port) => port !== preferredPort)];
    for (const port of candidates) {
        try {
            return await tryPort(port);
        }
        catch {
            // try next candidate
        }
    }
    throw new Error(`All callback ports are unavailable: ${candidates.join(', ')}. Free one of these ports and try again.`);
}
export async function createAuthorizationFlow(port) {
    const pkce = await generatePKCE();
    const state = randomBytes(16).toString('hex');
    const redirectPort = port || await reserveRedirectPort(DEFAULT_REDIRECT_PORT);
    const redirectUri = getRedirectUri(redirectPort);
    const authUrl = new URL(AUTHORIZE_URL);
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPES.join(' '));
    authUrl.searchParams.set('code_challenge', pkce.challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('audience', 'https://api.openai.com/v1');
    authUrl.searchParams.set('id_token_add_organizations', 'true');
    authUrl.searchParams.set('codex_cli_simplified_flow', 'true');
    authUrl.searchParams.set('originator', 'codex_cli_rs');
    return { pkce, state, url: authUrl.toString(), redirectUri, port: redirectPort };
}
export async function createDeviceAuthorizationFlow() {
    const userAgent = getDeviceUserAgent();
    const response = await fetchWithProxy(DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': userAgent
        },
        body: JSON.stringify({ client_id: CLIENT_ID })
    });
    if (!response.ok) {
        const body = (await response.text().catch(() => '')).trim();
        throw new Error(`Failed to initiate device authorization: ${response.status}${body ? ` ${body}` : ''}`);
    }
    const data = (await response.json());
    const intervalSeconds = Math.max(Number.parseInt(data.interval || '5', 10) || 5, 1);
    return {
        deviceAuthId: data.device_auth_id,
        userCode: data.user_code,
        intervalMs: intervalSeconds * 1000,
        url: DEVICE_VERIFY_URL,
        instructions: `Enter code: ${data.user_code}`
    };
}
export async function loginAccount(alias, flow) {
    const activeFlow = flow || await createAuthorizationFlow();
    let server = null;
    return new Promise(async (resolve, reject) => {
        const cleanup = () => {
            if (server) {
                server.close();
                server = null;
            }
        };
        server = http.createServer(async (req, res) => {
            if (!req.url?.startsWith('/auth/callback')) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            if (!activeFlow) {
                res.writeHead(500);
                res.end('No active flow');
                cleanup();
                reject(new Error('No active flow'));
                return;
            }
            const parsedUrl = url.parse(req.url, true);
            const code = parsedUrl.query.code;
            const returnedState = parsedUrl.query.state;
            if (!code) {
                res.writeHead(400);
                res.end('No authorization code received');
                cleanup();
                reject(new Error('No authorization code'));
                return;
            }
            if (returnedState && returnedState !== activeFlow.state) {
                res.writeHead(400);
                res.end('Invalid state');
                cleanup();
                reject(new Error('Invalid state'));
                return;
            }
            try {
                const tokenRes = await fetchWithProxy(TOKEN_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        client_id: CLIENT_ID,
                        code,
                        code_verifier: activeFlow.pkce.verifier,
                        redirect_uri: activeFlow.redirectUri
                    })
                });
                if (!tokenRes.ok) {
                    throw new Error(`Token exchange failed: ${tokenRes.status}`);
                }
                const tokens = (await tokenRes.json());
                if (!tokens.refresh_token) {
                    throw new Error('Token exchange did not return a refresh_token');
                }
                const now = Date.now();
                const accessClaims = decodeJwtPayload(tokens.access_token);
                const idClaims = tokens.id_token ? decodeJwtPayload(tokens.id_token) : null;
                const expiresAt = getExpiryFromClaims(accessClaims) || getExpiryFromClaims(idClaims) || now + tokens.expires_in * 1000;
                let email = getEmailFromClaims(idClaims) || getEmailFromClaims(accessClaims);
                try {
                    const userRes = await fetchWithProxy(USERINFO_URL, {
                        headers: { Authorization: `Bearer ${tokens.access_token}` }
                    });
                    if (userRes.ok) {
                        const user = (await userRes.json());
                        email = user.email || email;
                    }
                }
                catch {
                    /* user info fetch is non-critical */
                }
                const accountId = getAccountIdFromClaims(idClaims) ||
                    getAccountIdFromClaims(accessClaims);
                const store = addAccount(alias, {
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token,
                    idToken: tokens.id_token,
                    accountId,
                    expiresAt,
                    email,
                    lastRefresh: new Date(now).toISOString(),
                    lastSeenAt: now,
                    source: 'opencode',
                    authInvalid: false,
                    authInvalidatedAt: undefined
                });
                const account = store.accounts[alias];
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
          <html>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1>Account "${alias}" authenticated!</h1>
              <p>${email || 'Unknown email'}</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
                cleanup();
                resolve(account);
            }
            catch (err) {
                res.writeHead(500);
                res.end('Authentication failed');
                cleanup();
                reject(err);
            }
        });
        try {
            server.listen(activeFlow.port, OAUTH_CALLBACK_HOST, () => {
                console.log(`\n[multi-auth] Login for account "${alias}"`);
                console.log(`[multi-auth] Open this URL in your browser:\n`);
                console.log(`  ${activeFlow.url}\n`);
                console.log(`[multi-auth] Waiting for callback on port ${activeFlow.port}...`);
            });
            server.on('error', (err) => reject(err));
        }
        catch (err) {
            cleanup();
            reject(err);
            return;
        }
        setTimeout(() => {
            cleanup();
            reject(new Error('Login timeout - no callback received'));
        }, 5 * 60 * 1000);
    });
}
export async function loginAccountHeadless(alias, flow) {
    const userAgent = getDeviceUserAgent();
    while (true) {
        const response = await fetchWithProxy(DEVICE_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': userAgent
            },
            body: JSON.stringify({ device_auth_id: flow.deviceAuthId, user_code: flow.userCode })
        });
        if (response.ok) {
            const data = (await response.json());
            const tokenRes = await fetchWithProxy(TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: CLIENT_ID,
                    code: data.authorization_code,
                    code_verifier: data.code_verifier,
                    redirect_uri: DEVICE_REDIRECT_URI
                })
            });
            if (!tokenRes.ok) {
                throw new Error(`Token exchange failed: ${tokenRes.status}`);
            }
            const tokens = (await tokenRes.json());
            if (!tokens.refresh_token) {
                throw new Error('Token exchange did not return a refresh_token');
            }
            const now = Date.now();
            const accessClaims = decodeJwtPayload(tokens.access_token);
            const idClaims = tokens.id_token ? decodeJwtPayload(tokens.id_token) : null;
            const expiresAt = getExpiryFromClaims(accessClaims) || getExpiryFromClaims(idClaims) || now + tokens.expires_in * 1000;
            let email = getEmailFromClaims(idClaims) || getEmailFromClaims(accessClaims);
            try {
                const userRes = await fetchWithProxy(USERINFO_URL, {
                    headers: { Authorization: `Bearer ${tokens.access_token}` }
                });
                if (userRes.ok) {
                    const user = (await userRes.json());
                    email = user.email || email;
                }
            }
            catch {
                // user info fetch is non-critical
            }
            const accountId = getAccountIdFromClaims(idClaims) ||
                getAccountIdFromClaims(accessClaims);
            const store = addAccount(alias, {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                idToken: tokens.id_token,
                accountId,
                expiresAt,
                email,
                lastRefresh: new Date(now).toISOString(),
                lastSeenAt: now,
                source: 'opencode',
                authInvalid: false,
                authInvalidatedAt: undefined
            });
            return store.accounts[alias];
        }
        if (response.status !== 403 && response.status !== 404) {
            const body = (await response.text().catch(() => '')).trim();
            throw new Error(`Device authorization failed: ${response.status}${body ? ` ${body}` : ''}`);
        }
        await new Promise((resolve) => setTimeout(resolve, flow.intervalMs + OAUTH_POLLING_SAFETY_MARGIN_MS));
    }
}
export async function refreshToken(alias) {
    const store = loadStore();
    const account = store.accounts[alias];
    if (!account?.refreshToken) {
        console.error(`[multi-auth] No refresh token for ${alias}`);
        return null;
    }
    try {
        const tokenRes = await fetchWithProxy(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: CLIENT_ID,
                refresh_token: account.refreshToken
            })
        });
        if (!tokenRes.ok) {
            console.error(`[multi-auth] Refresh failed for ${alias}: ${tokenRes.status}`);
            if (tokenRes.status === 401 || tokenRes.status === 403) {
                try {
                    updateAccount(alias, {
                        authInvalid: true,
                        authInvalidatedAt: Date.now()
                    });
                }
                catch {
                    // ignore
                }
            }
            return null;
        }
        const tokens = (await tokenRes.json());
        const accessClaims = decodeJwtPayload(tokens.access_token);
        const idClaims = tokens.id_token ? decodeJwtPayload(tokens.id_token) : null;
        const expiresAt = getExpiryFromClaims(accessClaims) || getExpiryFromClaims(idClaims) || Date.now() + tokens.expires_in * 1000;
        const updates = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || account.refreshToken,
            expiresAt,
            lastRefresh: new Date().toISOString(),
            idToken: tokens.id_token || account.idToken,
            accountId: getAccountIdFromClaims(idClaims) ||
                getAccountIdFromClaims(accessClaims) ||
                account.accountId
        };
        const updatedStore = updateAccount(alias, updates);
        clearAuthInvalid(alias);
        return updatedStore.accounts[alias];
    }
    catch (err) {
        console.error(`[multi-auth] Refresh error for ${alias}:`, err);
        return null;
    }
}
export async function ensureValidToken(alias) {
    const store = loadStore();
    const account = store.accounts[alias];
    if (!account)
        return null;
    const bufferMs = 5 * 60 * 1000;
    if (account.expiresAt < Date.now() + bufferMs) {
        console.log(`[multi-auth] Refreshing token for ${alias}`);
        const refreshed = await refreshToken(alias);
        return refreshed?.accessToken || null;
    }
    return account.accessToken;
}
//# sourceMappingURL=auth.js.map