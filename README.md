# @solly922/opencode-codex-multiauth

`@solly922/opencode-codex-multiauth` is an OpenCode plugin that lets you use multiple ChatGPT OAuth accounts with the ChatGPT Codex backend and rotate between them automatically.

## Credits

This project builds on work from:

- `guard22-multiauth`: https://github.com/guard22/opencode-multi-auth-codex
- `crim50n-multiauth`: https://github.com/crim50n/opencode-multi-auth-codex

## Why use it

- Rotate across multiple ChatGPT OAuth accounts
- Keep using the ChatGPT Codex backend with Codex-style headers and request mapping
- Add accounts through browser OAuth or headless device auth
- Manage accounts from a localhost dashboard
- Pin traffic to a single account with force mode
- Track rate limits, cooldowns, invalid auth, and unsupported models
- Use weighted or health-based rotation strategies
- Sync with Codex `auth.json`

## Features

- Multi-account account store with migration support
- Browser OAuth and headless device auth
- ChatGPT Codex backend forwarding
- Local dashboard for account management and runtime settings
- Rotation strategies:
  - `round-robin`
  - `least-used`
  - `random`
  - `weighted-round-robin`
- Force mode
- Rate-limit probing and cooldown handling
- Proxy-aware auth and backend networking
- Cross-process store locking

## Requirements

- Node.js 20+
- npm
- OpenCode
- One or more ChatGPT accounts with Codex access

## Quick Start

1. Clone the repo.
2. Build it.
3. Point OpenCode at the built plugin entry.
4. Add one or more ChatGPT accounts.
5. Start using OpenCode with the `openai` provider.

## Install

### 1. Clone and build

```bash
git clone <repo-url> codex-multiauth
cd codex-multiauth
npm ci
npm run build
```

### 2. Add the plugin to OpenCode

Edit `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "file:///absolute/path/to/codex-multiauth/dist/index.js"
  ]
}
```

Example:

```json
{
  "plugin": [
    "file:///Users/you/src/codex-multiauth/dist/index.js"
  ]
}
```

Restart OpenCode after updating the config.

## Add accounts

You can add accounts from either the OpenCode UI or the CLI.

### OpenCode UI

1. Open auth/provider settings for `openai`
2. Select `ChatGPT OAuth (Multi-Account)`
3. Enter an alias such as `personal`, `work`, or `backup`
4. Complete the browser login flow

Headless option:

- `ChatGPT OAuth (Headless, Multi-Account)` uses a device-style auth flow instead of opening a callback browser flow.

### CLI

Primary CLI name:

```bash
codex-multiauth add personal
codex-multiauth add work --headless
codex-multiauth list
codex-multiauth status
codex-multiauth remove backup
codex-multiauth path
```

Compatibility alias:

```bash
opencode-multi-auth status
```

## Start the dashboard

```bash
codex-multiauth web --host 127.0.0.1 --port 3434
```

Open `http://127.0.0.1:3434` in your browser.

The dashboard is loopback-only and includes:

- account list and health state
- active account display
- enable/disable toggles
- force mode controls
- re-auth actions
- runtime settings updates
- rate-limit refresh/probing
- sync status

## Use it in OpenCode

Once the plugin is loaded and you have accounts configured:

1. Use the `openai` provider in OpenCode
2. Choose a Codex-compatible model
3. Send requests normally

The plugin will:

- select an eligible account
- attach Codex-style headers such as `chatgpt-account-id`, `OpenAI-Beta`, and `originator`
- forward the request to `https://chatgpt.com/backend-api`
- rotate away from invalid, rate-limited, or temporarily unsupported accounts

## Default paths

- Account store: `~/.config/opencode/codex-multiauth-accounts.json`
- Codex auth file: `~/.codex/auth.json`
- Logs: `~/.config/opencode/codex-multiauth/logs/codex-multiauth.log`

## Useful environment variables

- `OPENCODE_MULTI_AUTH_STORE_FILE`: override the account store path
- `OPENCODE_MULTI_AUTH_CODEX_AUTH_FILE`: override the Codex auth file path
- `CODEX_MULTIAUTH_LOG_PATH`: override the log file path
- `OPENCODE_MULTI_AUTH_PROXY_URL`: force a proxy for auth/backend traffic
- `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY`: standard proxy environment variables
- `OPENCODE_MULTI_AUTH_SYNC_OPENCODE_AUTH=1`: import OpenCode's current `openai` OAuth session into the plugin account pool
- `OPENCODE_MULTI_AUTH_INJECT_MODELS=0`: disable runtime model injection
- `OPENCODE_MULTI_AUTH_STRIP_ITEM_REFERENCES=0`: stop stripping `item_reference` inputs before forwarding
- `OPENCODE_MULTI_AUTH_PREFER_CODEX_LATEST=1`: map older Codex selections to the configured latest model

## Behavior notes

- Force mode pins traffic to one alias until cleared or expired.
- Dashboard settings affect runtime rotation behavior.
- Forwarded requests keep `store: false`.
- Browser auth and backend traffic are proxy-aware.
- OpenCode auth-session syncing is disabled by default; enable it only if you want the plugin to import your current OpenCode `openai` login automatically.
- The merged implementation preserves the ChatGPT Codex backend forwarding behavior that made the earlier `crim50n` fork reliable in practice.

## Troubleshooting

### The plugin does not load

- Make sure `npm run build` succeeded
- Verify the `plugin` entry points to `dist/index.js`
- Restart OpenCode after editing `opencode.json`

### No accounts are available

```bash
codex-multiauth status
codex-multiauth list
```

Then check whether the accounts are disabled, rate-limited, auth-invalid, or currently pinned by force mode.

### Browser OAuth does not complete

- Make sure your machine can accept loopback callbacks on `127.0.0.1`
- Retry with `--headless`
- Check whether your proxy settings are interfering with auth traffic

### Dashboard writes fail

- Use the dashboard from the same local origin it was started on
- Mutating endpoints are same-origin protected and loopback-only by design

### Migrating from older builds

- The canonical log path is now `~/.config/opencode/codex-multiauth/logs/codex-multiauth.log`
- The canonical systemd user service name is now `codex-multiauth.service`
- The old `CODEX_SOFT_LOG_PATH` env var is still accepted as a fallback

## Development

```bash
npm run build
npm run lint
npm run test:unit
npm run test:integration
npm run test:web:headless
npm run test:sandbox
```

## Additional docs

- `OPENCODE_SETUP_1TO1.md`
- `codextesting.md`
- `docs/`
