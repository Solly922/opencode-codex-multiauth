import type { AccountCredentials } from './types.js'

const HEALTH_HYSTERESIS_MS = 10_000
const RECENT_FAILURE_WINDOW_MS = 60_000

export interface AccountHealth {
  alias: string
  isHealthy: boolean
  isInProbation: boolean
  recentFailures: number
  priority: number
}

export function evaluateAccountHealth(acc: AccountCredentials, now: number): AccountHealth {
  const wasRateLimited = !!(acc.rateLimitedUntil && acc.rateLimitedUntil > now - HEALTH_HYSTERESIS_MS)
  const wasModelUnsupported = !!(acc.modelUnsupportedUntil && acc.modelUnsupportedUntil > now - HEALTH_HYSTERESIS_MS)
  const wasWorkspaceDeactivated = !!(acc.workspaceDeactivatedUntil && acc.workspaceDeactivatedUntil > now - HEALTH_HYSTERESIS_MS)
  const isDisabled = acc.enabled === false

  const currentlyBlocked =
    !!(acc.rateLimitedUntil && acc.rateLimitedUntil > now) ||
    !!(acc.modelUnsupportedUntil && acc.modelUnsupportedUntil > now) ||
    !!(acc.workspaceDeactivatedUntil && acc.workspaceDeactivatedUntil > now) ||
    !!acc.authInvalid ||
    isDisabled

  const isInProbation = !currentlyBlocked && (wasRateLimited || wasModelUnsupported || wasWorkspaceDeactivated)

  let recentFailures = 0
  if (acc.lastLimitErrorAt && acc.lastLimitErrorAt > now - RECENT_FAILURE_WINDOW_MS) {
    recentFailures++
  }
  if (acc.authInvalidatedAt && acc.authInvalidatedAt > now - RECENT_FAILURE_WINDOW_MS) {
    recentFailures++
  }

  let priority = 100
  if (isInProbation) priority -= 30
  if (recentFailures > 0) priority -= recentFailures * 10
  if (acc.usageCount === 0) priority -= 5
  if (currentlyBlocked) priority = 0
  if (isDisabled) priority = -1

  return {
    alias: acc.alias,
    isHealthy: !currentlyBlocked && !acc.authInvalid && !isDisabled,
    isInProbation,
    recentFailures,
    priority
  }
}

export function sortAliasesByHealth(
  accounts: Record<string, AccountCredentials>,
  aliases: string[],
  now: number
): string[] {
  return [...aliases].sort((a, b) => {
    const healthA = evaluateAccountHealth(accounts[a], now)
    const healthB = evaluateAccountHealth(accounts[b], now)
    return healthB.priority - healthA.priority
  })
}

export function resolveRoundRobinIndex(
  accounts: Record<string, AccountCredentials>,
  selectedAlias: string,
  now: number,
  fallbackIndex: number
): number {
  const availableAliases = Object.keys(accounts).filter((alias) => evaluateAccountHealth(accounts[alias], now).isHealthy)
  if (availableAliases.length === 0) return fallbackIndex
  const sorted = sortAliasesByHealth(accounts, availableAliases, now)
  const idx = sorted.indexOf(selectedAlias)
  if (idx < 0) return fallbackIndex % sorted.length
  return idx
}
