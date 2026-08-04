#!/usr/bin/env bash

set -Eeuo pipefail

: "${VLT_TOKEN:?VLT_TOKEN must be set}"

# Store CI credentials for the same registry configured in each vlt.json.
# Using the keychain avoids VLT_REGISTRY overriding that project config.
node --input-type=module <<'EOF'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const token = process.env.VLT_TOKEN
if (!token) throw new Error('VLT_TOKEN must be set')

const dataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local/share')
const authFile = join(dataHome, 'vlt/auth/keychain.json')
let auth = {}

try {
  auth = JSON.parse(await readFile(authFile, 'utf8'))
} catch {}

const bearer = `Bearer ${token}`
auth['https://registry.vlt.io/vlt/npm'] = bearer

await mkdir(dirname(authFile), { recursive: true, mode: 0o700 })
const temporary = `${authFile}.${process.pid}`
await writeFile(temporary, `${JSON.stringify(auth)}\n`, { mode: 0o600 })
await rename(temporary, authFile)
EOF
