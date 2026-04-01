import type { Auth } from '@opencode-ai/sdk';
export declare function setOpenCodeAuthSyncEnabled(enabled: boolean | undefined): void;
export declare function syncAuthFromOpenCode(getAuth: () => Promise<Auth>): Promise<void>;
//# sourceMappingURL=auth-sync.d.ts.map