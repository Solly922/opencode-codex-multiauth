#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const packageJsonPath = path.join(repoRoot, 'package.json')

function isExplicitVersion(value) {
  return /^\d+\.\d+\.\d+$/.test(value)
}

function usageAndExit() {
  console.error('Usage: npm run release -- <patch|minor|major|x.y.z>')
  process.exit(1)
}

const target = process.argv[2]
if (!target) {
  usageAndExit()
}

if (!['patch', 'minor', 'major'].includes(target) && !isExplicitVersion(target)) {
  usageAndExit()
}

execFileSync('npm', ['version', target, '--no-git-tag-version'], {
  cwd: repoRoot,
  stdio: 'inherit'
})

execFileSync('npm', ['run', 'build'], {
  cwd: repoRoot,
  stdio: 'inherit'
})

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

console.log('')
console.log(`Release files prepared for v${pkg.version}.`)
console.log('Next steps:')
console.log(`  git add package.json package-lock.json dist README.md ops/release.mjs`)
console.log(`  git commit -m "chore: release v${pkg.version}"`)
console.log(`  git tag v${pkg.version}`)
console.log('  git push <remote> <branch> --follow-tags')
