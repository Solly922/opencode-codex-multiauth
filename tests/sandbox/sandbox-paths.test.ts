import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { addAccount, getStoreDiagnostics, getStorePath, loadStore } from '../../src/store.js'

const SANDBOX_ROOT = path.join(os.tmpdir(), 'oma-sandbox-tests')
const SANDBOX_STORE = path.join(SANDBOX_ROOT, 'sandbox-accounts.json')
const originalEnv = process.env

describe('sandbox path isolation', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OPENCODE_MULTI_AUTH_STORE_DIR: SANDBOX_ROOT,
      OPENCODE_MULTI_AUTH_STORE_FILE: SANDBOX_STORE
    }

    if (fs.existsSync(SANDBOX_ROOT)) {
      fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true })
    }
    fs.mkdirSync(SANDBOX_ROOT, { recursive: true })
  })

  afterEach(() => {
    process.env = originalEnv
    if (fs.existsSync(SANDBOX_ROOT)) {
      fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true })
    }
  })

  it('writes store data only to sandbox path', () => {
    addAccount('sandbox-account', {
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60_000
    })

    const storePath = getStorePath()
    const diagnostics = getStoreDiagnostics()
    const loaded = loadStore()

    expect(storePath).toBe(path.resolve(SANDBOX_STORE))
    expect(diagnostics.storeFile).toBe(path.resolve(SANDBOX_STORE))
    expect(loaded.accounts['sandbox-account']).toBeDefined()
    expect(fs.existsSync(path.resolve(SANDBOX_STORE))).toBe(true)
  })
})
