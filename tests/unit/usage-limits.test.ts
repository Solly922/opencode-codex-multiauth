import { classifyUsageApiFailure } from '../../src/usage-limits.js'

describe('usage API failure classification', () => {
  it('treats 401 auth failures as terminal and skips probe fallback', () => {
    const result = classifyUsageApiFailure(
      401,
      JSON.stringify({
        error: {
          message: 'Provided authentication token is expired. Please try signing in again.',
          code: 'token_expired'
        },
        status: 401
      })
    )

    expect(result).toEqual({
      shouldProbeFallback: false,
      authInvalid: true
    })
  })

  it('treats deactivated workspace failures as terminal and skips probe fallback', () => {
    const result = classifyUsageApiFailure(
      402,
      JSON.stringify({
        detail: {
          code: 'deactivated_workspace',
          message: 'Workspace is deactivated'
        }
      })
    )

    expect(result).toEqual({
      shouldProbeFallback: false,
      workspaceDeactivated: true,
      workspaceDeactivatedReason: 'Workspace is deactivated'
    })
  })

  it('treats top-level deactivated workspace codes as terminal', () => {
    const result = classifyUsageApiFailure(402, JSON.stringify({ code: 'workspace_deactivated' }))

    expect(result).toEqual({
      shouldProbeFallback: false,
      workspaceDeactivated: true,
      workspaceDeactivatedReason: 'workspace_deactivated'
    })
  })

  it('keeps generic 403 failures probe-eligible', () => {
    const result = classifyUsageApiFailure(403, JSON.stringify({ message: 'quota check failed upstream' }))

    expect(result).toEqual({
      shouldProbeFallback: true
    })
  })
})
