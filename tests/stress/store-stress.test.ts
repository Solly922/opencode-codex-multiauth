import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  addAccount,
  getStorePath,
  listAccounts,
  loadStore,
  updateAccount
} from '../../src/store.js'

const STRESS_DIR = path.join(os.tmpdir(), 'oma-stress-tests-sandbox')
const originalEnv = process.env

describe('stress: store consistency', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OPENCODE_MULTI_AUTH_STORE_DIR: STRESS_DIR,
      OPENCODE_MULTI_AUTH_STORE_FILE: path.join(STRESS_DIR, 'accounts.json')
    }

    if (fs.existsSync(STRESS_DIR)) {
      fs.rmSync(STRESS_DIR, { recursive: true, force: true })
    }
    fs.mkdirSync(STRESS_DIR, { recursive: true })

    for (let i = 0; i < 5; i += 1) {
      addAccount(`stress-${i}`, {
        accessToken: `token-${i}`,
        refreshToken: `refresh-${i}`,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      })
    }
  })

  afterEach(() => {
    process.env = originalEnv
    if (fs.existsSync(STRESS_DIR)) {
      fs.rmSync(STRESS_DIR, { recursive: true, force: true })
    }
  })

  it('handles burst updates without store corruption', async () => {
    const operations = Array.from({ length: 200 }, (_, idx) => {
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          const alias = `stress-${idx % 5}`
          updateAccount(alias, {
            usageCount: idx,
            lastUsed: Date.now(),
            notes: `burst-${idx}`
          })
          resolve()
        })
      })
    })

    await Promise.all(operations)

    const storePath = getStorePath()
    const raw = fs.readFileSync(storePath, 'utf-8')
    expect(() => JSON.parse(raw)).not.toThrow()

    const store = loadStore()
    expect(Object.keys(store.accounts)).toHaveLength(5)
    expect(listAccounts()).toHaveLength(5)
  })
})
