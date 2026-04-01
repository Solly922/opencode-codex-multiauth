import { Errors } from '../../src/errors.js'

describe('Deterministic Errors', () => {
  it('should create NO_ELIGIBLE_ACCOUNTS error', () => {
    const err = Errors.noEligibleAccounts('All accounts are rate limited')
    expect(err.code).toBe('NO_ELIGIBLE_ACCOUNTS')
    expect(err.message).toContain('All accounts are rate limited')
  })

  it('should create MAX_RETRIES_EXCEEDED error with details', () => {
    const err = Errors.maxRetriesExceeded(3, ['acc1', 'acc2', 'acc3'])
    expect(err.code).toBe('MAX_RETRIES_EXCEEDED')
    expect(err.message).toContain('3')
    expect(err.details?.attempts).toBe(3)
    expect(err.details?.aliasesTried).toEqual(['acc1', 'acc2', 'acc3'])
  })

  it('should create LOCALHOST_ONLY error', () => {
    const err = Errors.localhostOnly('0.0.0.0')
    expect(err.code).toBe('LOCALHOST_ONLY')
    expect(err.message).toContain('localhost')
    expect(err.details?.attemptedHost).toBe('0.0.0.0')
  })

  it('should create ACCOUNT_NOT_FOUND error', () => {
    const err = Errors.accountNotFound('missing-account')
    expect(err.code).toBe('ACCOUNT_NOT_FOUND')
    expect(err.message).toContain('missing-account')
    expect(err.details?.alias).toBe('missing-account')
  })

  it('should create ACCOUNT_DISABLED error', () => {
    const err = Errors.accountDisabled('disabled-account')
    expect(err.code).toBe('ACCOUNT_DISABLED')
    expect(err.message).toContain('disabled-account')
  })

  it('should create STORE_LOCKED error', () => {
    const err = Errors.storeLocked('Store is encrypted')
    expect(err.code).toBe('STORE_LOCKED')
    expect(err.message).toContain('encrypted')
  })
})
