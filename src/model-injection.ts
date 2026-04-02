import type { ProviderModel } from './types.js'

export type ModelInjectionMode = 'auto' | 'latest' | 'default' | 'opencode'

export function normalizeModelInjectionMode(value: unknown): ModelInjectionMode {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized === 'latest' || normalized === 'default' || normalized === 'opencode') {
    return normalized
  }
  return 'auto'
}

export function resolveInjectedModelIds(options: {
  mode: ModelInjectionMode
  latestModel: string
  defaultModels: Record<string, ProviderModel>
  existingModelIds: string[]
}): string[] {
  const { mode, latestModel, defaultModels, existingModelIds } = options

  if (mode === 'opencode') return []
  if (mode === 'auto' && existingModelIds.length > 0) return []

  if (mode === 'latest') {
    return Object.keys(defaultModels).filter((id) => id === latestModel || id.startsWith(`${latestModel}-`))
  }

  return Object.keys(defaultModels)
}

export function applyModelInjection(options: {
  openai: { models?: Record<string, ProviderModel>; whitelist?: string[] }
  defaultModels: Record<string, ProviderModel>
  latestModel: string
  mode: ModelInjectionMode
}): string[] {
  const { openai, defaultModels, latestModel, mode } = options
  openai.models ||= {}

  const injectedModelIds = resolveInjectedModelIds({
    mode,
    latestModel,
    defaultModels,
    existingModelIds: Object.keys(openai.models)
  })

  for (const modelID of injectedModelIds) {
    const model = defaultModels[modelID]
    if (!model || openai.models[modelID]) continue
    openai.models[modelID] = model
  }

  if (Array.isArray(openai.whitelist)) {
    for (const modelID of injectedModelIds) {
      if (!openai.whitelist.includes(modelID)) {
        openai.whitelist.unshift(modelID)
      }
    }
  }

  return injectedModelIds
}
