import type { AccountCredentials, AccountRateLimits } from './types.js';
export interface UsageRateLimitFetchResult {
    rateLimits?: AccountRateLimits;
    planType?: string;
    rateLimitedUntil?: number;
    error?: string;
    source: 'usage-api';
}
export declare function fetchUsageRateLimitsForAccount(account: AccountCredentials): Promise<UsageRateLimitFetchResult>;
//# sourceMappingURL=usage-limits.d.ts.map