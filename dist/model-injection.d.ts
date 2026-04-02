import type { ProviderModel } from './types.js';
export type ModelInjectionMode = 'auto' | 'latest' | 'default' | 'opencode';
export declare function normalizeModelInjectionMode(value: unknown): ModelInjectionMode;
export declare function resolveInjectedModelIds(options: {
    mode: ModelInjectionMode;
    latestModel: string;
    defaultModels: Record<string, ProviderModel>;
    existingModelIds: string[];
}): string[];
export declare function applyModelInjection(options: {
    openai: {
        models?: Record<string, ProviderModel>;
        whitelist?: string[];
    };
    defaultModels: Record<string, ProviderModel>;
    latestModel: string;
    mode: ModelInjectionMode;
}): string[];
//# sourceMappingURL=model-injection.d.ts.map