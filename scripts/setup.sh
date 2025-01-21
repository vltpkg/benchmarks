#!/bin/bash

# Environment Configuration
COREPACK_ENABLE_STRICT=0
COREPACK_ENABLE_AUTO_PIN=0
YARN_ENABLE_IMMUTABLE_INSTALLS=false

# Install Package Managers & Benchmark Tools
cargo install hyperfine --quiet
npm install -g npm@latest vlt@latest bun@latest deno@latest nx@latest turbo@latest --silent
corepack enable yarn pnpm

# Create Results Directory
mkdir -p ./results/

# Log Package Manager Versions
NPM_VERSION="$(npm -v)"
VLT_VERSION="$(vlt -v)"
YARN_VERSION="$(corepack yarn@1 -v)"
BERRY_VERSION="$(corepack yarn@latest -v)"
PNPM_VERSION="$(corepack pnpm@latest -v)"
BUN_VERSION="$(bun -v)"
DENO_VERSION="$(npm view deno@latest version)"
NX_VERSION="$(npm view nx@latest version)"
TURBO_VERSION="$(npm view turbo@latest version)"
NODE_VERSION=$(node -e "console.log(process.version.substr(1))")

echo "npm: $NPM_VERSION"
echo "vlt: $VLT_VERSION"
echo "yarn: $YARN_VERSION"
echo "berry: $BERRY_VERSION"
echo "pnpm: $PNPM_VERSION"
echo "bun: $BUN_VERSION"
echo "deno: $DENO_VERSION"
echo "nx: $NX_VERSION"
echo "turbo: $TURBO_VERSION"
echo "node: $NODE_VERSION"

echo "{ npm: \"$NPM_VERSION\", vlt: \"$VLT_VERSION\", yarn: \"$YARN_VERSION\", berry: \"$BERRY_VERSION\", pnpm: \"$PNPM_VERSION\", bun: \"$BUN_VERSION\", deno: \"$DENO_VERSION\", nx: \"$NX_VERSION\", turbo: \"$TURBO_VERSION\", node: \"$NODE_VERSION\" }" > ./results/versions.json
