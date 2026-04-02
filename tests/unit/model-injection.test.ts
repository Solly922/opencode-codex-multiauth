import { applyModelInjection, normalizeModelInjectionMode, resolveInjectedModelIds } from '../../src/model-injection.js'
import { getDefaultModels } from '../../src/models.js'

describe('model injection', () => {
  it('preserves existing OpenCode models in auto mode', () => {
    const defaultModels = getDefaultModels()
    const openai = {
      models: {
        'gpt-4.1': {
          name: 'GPT-4.1',
          limit: { context: 128000, output: 32000 },
          modalities: { input: ['text'], output: ['text'] },
          options: { reasoningEffort: 'medium', reasoningSummary: 'auto', textVerbosity: 'medium', include: [], store: false }
        }
      },
      whitelist: ['gpt-4.1']
    }

    const injected = applyModelInjection({
      openai,
      defaultModels,
      latestModel: 'gpt-5.4',
      mode: 'auto'
    })

    expect(injected).toEqual([])
    expect(Object.keys(openai.models)).toEqual(['gpt-4.1'])
    expect(openai.whitelist).toEqual(['gpt-4.1'])
  })

  it('injects the full default model set when OpenCode has no models in auto mode', () => {
    const defaultModels = getDefaultModels()
    const openai = { models: {} as Record<string, any> }

    const injected = applyModelInjection({
      openai,
      defaultModels,
      latestModel: 'gpt-5.4',
      mode: 'auto'
    })

    expect(injected.length).toBeGreaterThan(2)
    expect(openai.models['gpt-5.4-none']).toBeDefined()
    expect(openai.models['gpt-5.3-codex-high']).toBeDefined()
  })

  it('injects only the latest model family in latest mode', () => {
    const defaultModels = getDefaultModels()
    const ids = resolveInjectedModelIds({
      mode: 'latest',
      latestModel: 'gpt-5.4',
      defaultModels,
      existingModelIds: []
    })

    expect(ids).toContain('gpt-5.4-none')
    expect(ids).toContain('gpt-5.4-fast')
    expect(ids).not.toContain('gpt-5.3-none')
  })

  it('normalizes unknown model injection modes to auto', () => {
    expect(normalizeModelInjectionMode('weird')).toBe('auto')
    expect(normalizeModelInjectionMode('opencode')).toBe('opencode')
  })
})
