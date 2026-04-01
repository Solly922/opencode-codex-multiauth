import * as fs from 'node:fs'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import type * as http from 'node:http'
import { once } from 'node:events'

const SANDBOX_ROOT = path.join(os.tmpdir(), 'oma-failure-tests-sandbox')
const STORE_FILE = path.join(SANDBOX_ROOT, 'accounts.json')
const AUTH_FILE = path.join(SANDBOX_ROOT, 'auth.json')
const originalEnv = process.env

let startWebConsole: typeof import('../../src/web.js').startWebConsole
let getCodexAuthPath: typeof import('../../src/codex-auth.js').getCodexAuthPath
let loadStore: typeof import('../../src/store.js').loadStore
let saveStore: typeof import('../../src/store.js').saveStore

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve free port'))
        return
      }
      const port = address.port
      server.close((err) => {
        if (err) {
          reject(err)
          return
        }
        resolve(port)
      })
    })
    server.on('error', reject)
  })
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

beforeAll(async () => {
  if (fs.existsSync(SANDBOX_ROOT)) {
    fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true })
  }
  fs.mkdirSync(SANDBOX_ROOT, { recursive: true })
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ OPENAI_API_KEY: null, tokens: {} }, null, 2))

  process.env = {
    ...originalEnv,
    OPENCODE_MULTI_AUTH_STORE_DIR: SANDBOX_ROOT,
    OPENCODE_MULTI_AUTH_STORE_FILE: STORE_FILE,
    OPENCODE_MULTI_AUTH_CODEX_AUTH_FILE: AUTH_FILE
  }

  ;({ startWebConsole } = await import('../../src/web.js'))
  ;({ getCodexAuthPath } = await import('../../src/codex-auth.js'))
  ;({ loadStore, saveStore } = await import('../../src/store.js'))
})

beforeEach(() => {
  const store = loadStore()
  store.accounts = {
    enabled: {
      alias: 'enabled',
      accessToken: 'token-enabled',
      refreshToken: 'refresh-enabled',
      expiresAt: Date.now() + 3600_000,
      usageCount: 0,
      enabled: true
    },
    disabled: {
      alias: 'disabled',
      accessToken: 'token-disabled',
      refreshToken: 'refresh-disabled',
      expiresAt: Date.now() + 3600_000,
      usageCount: 0,
      enabled: false,
      disabledAt: Date.now()
    }
  }
  store.activeAlias = 'enabled'
  saveStore(store)
})

afterAll(() => {
  try {
    if (getCodexAuthPath) {
      fs.unwatchFile(getCodexAuthPath())
    }
  } catch {
    // ignore
  }
  process.env = originalEnv
  if (fs.existsSync(SANDBOX_ROOT)) {
    fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true })
  }
})

describe('failure injection API responses', () => {
  it('returns deterministic 404 for unknown alias toggle', async () => {
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')
      const response = await fetch(`http://127.0.0.1:${port}/api/accounts/missing/enabled`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false })
      })

      expect(response.status).toBe(404)
      const payload = (await response.json()) as { code?: string }
      expect(payload.code).toBe('ACCOUNT_NOT_FOUND')
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('rejects re-auth for disabled accounts', async () => {
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')
      const response = await fetch(`http://127.0.0.1:${port}/api/accounts/disabled/reauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'test' })
      })

      expect(response.status).toBe(409)
      const payload = (await response.json()) as { code?: string }
      expect(payload.code).toBe('ACCOUNT_DISABLED')
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('returns feature-disabled response for antigravity APIs', async () => {
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')
      const response = await fetch(`http://127.0.0.1:${port}/api/antigravity/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      })

      expect(response.status).toBe(403)
      const payload = (await response.json()) as { code?: string }
      expect(payload.code).toBe('FEATURE_DISABLED')
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })
})
