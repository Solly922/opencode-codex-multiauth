import type { AccountCredentials } from './types.js';
export interface AccountHealth {
    alias: string;
    isHealthy: boolean;
    isInProbation: boolean;
    recentFailures: number;
    priority: number;
}
export declare function evaluateAccountHealth(acc: AccountCredentials, now: number): AccountHealth;
export declare function sortAliasesByHealth(accounts: Record<string, AccountCredentials>, aliases: string[], now: number): string[];
export declare function resolveRoundRobinIndex(accounts: Record<string, AccountCredentials>, selectedAlias: string, now: number, fallbackIndex: number): number;
//# sourceMappingURL=account-order.d.ts.map