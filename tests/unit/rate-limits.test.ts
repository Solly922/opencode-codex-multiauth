import {
  getBlockingRateLimitResetAt,
  isRateLimitErrorText,
  parseRateLimitResetFromError,
  parseRetryAfterHeader
} from '../../src/rate-limits.js'

describe('rate limit reset helpers', () => {
  it('parses Retry-After seconds header', () => {
    const now = Date.now()
    const resetAt = parseRetryAfterHeader('120', now)
    expect(resetAt).toBe(now + 120_000)
  })

  it('parses human date from usage-limit error text', () => {
    const resetAt = parseRateLimitResetFromError(
      "You've hit your usage limit. Try again at Feb 23rd, 2026 9:06 PM."
    )
    expect(typeof resetAt).toBe('number')
    expect(Number.isFinite(resetAt)).toBe(true)
  })

  it('selects latest reset when multiple windows are exhausted', () => {
    const now = Date.now()
    const resetAt = getBlockingRateLimitResetAt(
      {
        fiveHour: { remaining: 0, resetAt: now + 15 * 60_000 },
        weekly: { remaining: 0, resetAt: now + 6 * 60 * 60_000 }
      },
      now
    )
    expect(resetAt).toBe(now + 6 * 60 * 60_000)
  })

  it('detects usage-limit style messages', () => {
    expect(isRateLimitErrorText("You've hit your usage limit")).toBe(true)
    expect(isRateLimitErrorText('something unrelated')).toBe(false)
  })
})
