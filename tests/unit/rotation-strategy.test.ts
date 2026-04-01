import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { getNextAccount } from '../../src/rotation.js'
import { loadStore, saveStore } from '../../src/store.js'
import { updateSettings } from '../../src/settings.js'
import { setOpenCodeAuthSyncEnabled, syncAuthFromOpenCode } from '../../src/auth-sync.js'
import { DEFAULT_CONFIG, type AccountCredentials } from '../../src/types.js'

const TEST_DIR = path.join(os.tmpdir(), `oma-rotation-test-${Date.now()}`)
const TEST_STORE_FILE = path.join(TEST_DIR, 'accounts.json')
const originalEnv = process.env

function createAccount(alias: string, usageCount: number): AccountCredentials {
  return {
    alias,
    accessToken: `token-${alias}`,
    refreshToken: `refresh-${alias}`,
    expiresAt: Date.now() + 60 * 60 * 1000,
    usageCount,
    enabled: true
  }
}

describe('Rotation Strategy Runtime Behavior', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OPENCODE_MULTI_AUTH_STORE_DIR: TEST_DIR,
      OPENCODE_MULTI_AUTH_STORE_FILE: TEST_STORE_FILE
    }
    delete process.env.OPENCODE_MULTI_AUTH_ROTATION_STRATEGY
    delete process.env.OPENCODE_MULTI_AUTH_CRITICAL_THRESHOLD
    delete process.env.OPENCODE_MULTI_AUTH_LOW_THRESHOLD
    setOpenCodeAuthSyncEnabled(false)

    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true })
    }
    fs.mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    process.env = originalEnv
    setOpenCodeAuthSyncEnabled(false)
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  it('uses persisted least-used strategy even if config still says round-robin', async () => {
    const store = loadStore()
    store.accounts.alpha = createAccount('alpha', 10)
    store.accounts.beta = createAccount('beta', 1)
    saveStore(store)

    const update = updateSettings({ rotationStrategy: 'least-used' }, 'test')
    expect(update.success).toBe(true)

    const rotation = await getNextAccount({
      ...DEFAULT_CONFIG,
      rotationStrategy: 'round-robin'
    })

    expect(rotation?.account.alias).toBe('beta')
  })

  it('applies weighted strategy change immediately', async () => {
    const store = loadStore()
    store.accounts.alpha = createAccount('alpha', 0)
    store.accounts.beta = createAccount('beta', 0)
    saveStore(store)

    const update = updateSettings(
      {
        rotationStrategy: 'weighted-round-robin',
        accountWeights: { beta: 1 }
      },
      'test'
    )
    expect(update.success).toBe(true)

    const rotation = await getNextAccount({
      ...DEFAULT_CONFIG,
      rotationStrategy: 'round-robin'
    })

    expect(rotation?.account.alias).toBe('beta')
  })

  it('persists usage count for the selected alias', async () => {
    const store = loadStore()
    store.accounts.alpha = createAccount('alpha', 0)
    saveStore(store)

    const rotation = await getNextAccount({
      ...DEFAULT_CONFIG,
      rotationStrategy: 'round-robin'
    })

    expect(rotation?.account.alias).toBe('alpha')
    expect(rotation?.account.usageCount).toBe(1)

    const persisted = loadStore()
    expect(persisted.accounts.alpha.usageCount).toBe(1)
    expect(persisted.activeAlias).toBe('alpha')
  })

  it('marks the synced alias active when OpenCode auth sync is enabled', async () => {
    const store = loadStore()
    store.accounts.alpha = createAccount('alpha', 2)
    store.accounts.alpha.accessToken = 'old-alpha-access'
    store.accounts.alpha.refreshToken = 'refresh-alpha'
    store.accounts.beta = createAccount('beta', 0)
    store.accounts.beta.accessToken = 'beta-access'
    store.accounts.beta.refreshToken = 'refresh-beta'
    store.activeAlias = 'beta'
    saveStore(store)

    setOpenCodeAuthSyncEnabled(true)
    await syncAuthFromOpenCode(async () => ({
      type: 'oauth',
      access: 'old-alpha-access',
      refresh: 'refresh-alpha',
      expires: Date.now() + 3600000
    }))

    const synced = loadStore()
    expect(synced.activeAlias).toBe('alpha')
  })
})
