import type { AccountCredentials } from './types.js';
interface AuthorizationFlow {
    pkce: {
        verifier: string;
        challenge: string;
    };
    state: string;
    url: string;
    redirectUri: string;
    port: number;
}
export interface DeviceAuthorizationFlow {
    deviceAuthId: string;
    userCode: string;
    intervalMs: number;
    url: string;
    instructions: string;
}
export declare function fetchWithProxy(rawUrl: string, init?: RequestInit): Promise<Response>;
export declare function createAuthorizationFlow(port?: number): Promise<AuthorizationFlow>;
export declare function createDeviceAuthorizationFlow(): Promise<DeviceAuthorizationFlow>;
export declare function loginAccount(alias: string, flow?: AuthorizationFlow): Promise<AccountCredentials>;
export declare function loginAccountHeadless(alias: string, flow: DeviceAuthorizationFlow): Promise<AccountCredentials>;
export declare function refreshToken(alias: string): Promise<AccountCredentials | null>;
export declare function ensureValidToken(alias: string): Promise<string | null>;
export {};
//# sourceMappingURL=auth.d.ts.map