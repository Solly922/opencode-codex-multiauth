export function normalizeModelInjectionMode(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'latest' || normalized === 'default' || normalized === 'opencode') {
        return normalized;
    }
    return 'auto';
}
export function resolveInjectedModelIds(options) {
    const { mode, latestModel, defaultModels, existingModelIds } = options;
    if (mode === 'opencode')
        return [];
    if (mode === 'auto' && existingModelIds.length > 0)
        return [];
    if (mode === 'latest') {
        return Object.keys(defaultModels).filter((id) => id === latestModel || id.startsWith(`${latestModel}-`));
    }
    return Object.keys(defaultModels);
}
export function applyModelInjection(options) {
    const { openai, defaultModels, latestModel, mode } = options;
    openai.models ||= {};
    const injectedModelIds = resolveInjectedModelIds({
        mode,
        latestModel,
        defaultModels,
        existingModelIds: Object.keys(openai.models)
    });
    for (const modelID of injectedModelIds) {
        const model = defaultModels[modelID];
        if (!model || openai.models[modelID])
            continue;
        openai.models[modelID] = model;
    }
    if (Array.isArray(openai.whitelist)) {
        for (const modelID of injectedModelIds) {
            if (!openai.whitelist.includes(modelID)) {
                openai.whitelist.unshift(modelID);
            }
        }
    }
    return injectedModelIds;
}
//# sourceMappingURL=model-injection.js.map