import { addAccount, loadStore, setActiveAlias, updateAccount } from './store.js';
import { decodeJwtPayload, getAccountIdFromClaims, getEmailFromClaims } from './codex-auth.js';
const OPENAI_ISSUER = 'https://auth.openai.com';
const AUTH_SYNC_COOLDOWN_MS = 10_000;
let lastSyncedAccess = null;
let lastSyncAt = 0;
let authSyncEnabled = process.env.OPENCODE_MULTI_AUTH_SYNC_OPENCODE_AUTH === '1' || process.env.OPENCODE_MULTI_AUTH_SYNC_OPENCODE_AUTH === 'true';
export function setOpenCodeAuthSyncEnabled(enabled) {
    if (typeof enabled === 'boolean') {
        authSyncEnabled = enabled;
        return;
    }
    authSyncEnabled = process.env.OPENCODE_MULTI_AUTH_SYNC_OPENCODE_AUTH === '1' || process.env.OPENCODE_MULTI_AUTH_SYNC_OPENCODE_AUTH === 'true';
}
async function fetchEmail(accessToken) {
    try {
        const res = await fetch(`${OPENAI_ISSUER}/userinfo`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!res.ok)
            return undefined;
        const user = (await res.json());
        return user.email;
    }
    catch {
        return undefined;
    }
}
function findAccountAliasByToken(access, refresh) {
    const store = loadStore();
    for (const account of Object.values(store.accounts)) {
        if (account.accessToken === access)
            return account.alias;
        if (refresh && account.refreshToken === refresh)
            return account.alias;
    }
    return null;
}
function findAccountAliasByEmail(email, store) {
    for (const account of Object.values(store.accounts)) {
        if (account.email && account.email === email)
            return account.alias;
    }
    return null;
}
function buildAlias(email, existingAliases) {
    const base = email ? email.split('@')[0] : 'account';
    let candidate = base || 'account';
    let suffix = 1;
    while (existingAliases.has(candidate)) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }
    return candidate;
}
export async function syncAuthFromOpenCode(getAuth) {
    if (!authSyncEnabled)
        return;
    const now = Date.now();
    if (now - lastSyncAt < AUTH_SYNC_COOLDOWN_MS)
        return;
    lastSyncAt = now;
    let auth = null;
    try {
        auth = await getAuth();
    }
    catch {
        return;
    }
    if (!auth || auth.type !== 'oauth')
        return;
    if (!auth.access)
        return;
    if (auth.access === lastSyncedAccess)
        return;
    lastSyncedAccess = auth.access;
    const existingAlias = findAccountAliasByToken(auth.access, auth.refresh);
    const accessClaims = decodeJwtPayload(auth.access);
    const derivedEmail = getEmailFromClaims(accessClaims);
    const derivedAccountId = getAccountIdFromClaims(accessClaims);
    if (existingAlias) {
        const updates = {
            accessToken: auth.access,
            expiresAt: auth.expires,
            email: derivedEmail,
            accountId: derivedAccountId
        };
        if (auth.refresh)
            updates.refreshToken = auth.refresh;
        updateAccount(existingAlias, updates);
        setActiveAlias(existingAlias);
        return;
    }
    const store = loadStore();
    const email = (await fetchEmail(auth.access)) || derivedEmail;
    if (email) {
        const existingByEmail = findAccountAliasByEmail(email, store);
        if (existingByEmail) {
            const updates = {
                accessToken: auth.access,
                expiresAt: auth.expires,
                email
            };
            if (auth.refresh)
                updates.refreshToken = auth.refresh;
            updateAccount(existingByEmail, updates);
            setActiveAlias(existingByEmail);
            return;
        }
    }
    if (!auth.refresh)
        return;
    const alias = buildAlias(email, new Set(Object.keys(store.accounts)));
    addAccount(alias, {
        accessToken: auth.access,
        refreshToken: auth.refresh,
        expiresAt: auth.expires,
        email,
        accountId: derivedAccountId,
        source: 'opencode'
    });
    setActiveAlias(alias);
}
//# sourceMappingURL=auth-sync.js.map