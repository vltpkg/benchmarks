#!/usr/bin/env node

/**
 * Adds `workspace:` protocol prefix to inter-workspace dependency specs.
 *
 * Some package managers (like vlt) require the `workspace:` protocol to
 * resolve workspace packages, while others (like npm, yarn classic) do it
 * automatically by matching package names. This script bridges that gap by
 * rewriting dependency specs for workspace packages.
 *
 * Uses `workspace:*` to match any local version, since workspace packages
 * in monorepos often have cross-references where the semver range in the
 * dep spec may not strictly match the current local version.
 *
 * Usage: node scripts/add-workspace-protocol.js [fixture-path]
 *
 * If no fixture-path is given, uses the current directory.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execSync } from 'node:child_process'

const fixtureRoot = resolve(process.argv[2] || '.')

// Read root package.json to get workspace globs
const rootPkgPath = join(fixtureRoot, 'package.json')
if (!existsSync(rootPkgPath)) {
  console.error(`No package.json found at ${rootPkgPath}`)
  process.exit(1)
}

const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'))
const workspaceGlobs = rootPkg.workspaces || []

if (workspaceGlobs.length === 0) {
  console.log('No workspaces defined, nothing to do.')
  process.exit(0)
}

// Find all workspace package.json files
const findCmd = `find ${fixtureRoot}/packages -name package.json -not -path '*/node_modules/*'`
const packageJsonPaths = execSync(findCmd, { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean)

// Also include the root package.json
packageJsonPaths.push(rootPkgPath)

// Build a set of workspace package names
const workspacePackageNames = new Set()
for (const pkgPath of packageJsonPaths) {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    if (pkg.name) {
      workspacePackageNames.add(pkg.name)
    }
  } catch {
    // skip malformed files
  }
}

console.log(`Found ${workspacePackageNames.size} workspace packages`)

// Now rewrite all package.json files
const depFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
let modifiedCount = 0

for (const pkgPath of packageJsonPaths) {
  try {
    const raw = readFileSync(pkgPath, 'utf8')
    const pkg = JSON.parse(raw)
    let modified = false

    for (const field of depFields) {
      const deps = pkg[field]
      if (!deps) continue

      for (const [name, spec] of Object.entries(deps)) {
        if (
          workspacePackageNames.has(name) &&
          typeof spec === 'string' &&
          !spec.startsWith('workspace:')
        ) {
          // Use workspace:* to always resolve to the local version
          // regardless of what semver range was originally specified
          deps[name] = 'workspace:*'
          modified = true
        }
      }
    }

    if (modified) {
      // Preserve the original formatting
      const indent = raw.match(/^(\s+)"/m)?.[1] || '  '
      const newline = raw.endsWith('\n') ? '\n' : ''
      writeFileSync(pkgPath, JSON.stringify(pkg, null, indent) + newline)
      modifiedCount++
    }
  } catch {
    // skip malformed files
  }
}

console.log(`Modified ${modifiedCount} package.json files to add workspace: protocol`)
