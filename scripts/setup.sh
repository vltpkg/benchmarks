#!/bin/bash

# Exit on error
set -e

# Environment Configuration
export COREPACK_ENABLE_STRICT=0
export COREPACK_ENABLE_AUTO_PIN=0
export YARN_ENABLE_IMMUTABLE_INSTALLS=false

# Persist corepack env vars for subsequent CI steps (e.g., benchmark runs).
# Without these, corepack 0.34+ auto-pins packageManager and refuses to run
# a different PM than what packageManager specifies — breaking benchmarks
# that cycle through multiple package managers on the same fixture.
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "COREPACK_ENABLE_STRICT=0" >> "$GITHUB_ENV"
  echo "COREPACK_ENABLE_AUTO_PIN=0" >> "$GITHUB_ENV"
fi

# Check Node version
REQUIRED_NODE_VERSION="24"
CURRENT_NODE_VERSION=$(node -v | cut -d'v' -f2)
if [[ "$CURRENT_NODE_VERSION" != "$REQUIRED_NODE_VERSION"* ]]; then
    echo "Error: Node.js version $REQUIRED_NODE_VERSION is required, but version $CURRENT_NODE_VERSION is installed"
    exit 1
fi

# Install system dependencies
echo "Installing system dependencies..."
sudo apt-get update && sudo apt-get install -y jq strace unzip

# Install Hyperfine v1.19.0+ (required for --conclude flag)
# Ubuntu 24.04 apt ships v1.18.0 which lacks --conclude, so we install from GitHub releases
HYPERFINE_VERSION_TAG="v1.19.0"
ARCH=$(dpkg --print-architecture)  # amd64 or arm64
wget -q "https://github.com/sharkdp/hyperfine/releases/download/${HYPERFINE_VERSION_TAG}/hyperfine_${HYPERFINE_VERSION_TAG#v}_${ARCH}.deb" -O /tmp/hyperfine.deb
sudo dpkg -i /tmp/hyperfine.deb
rm -f /tmp/hyperfine.deb

echo "Required system dependencies installed successfully!"
JQ_VERSION=$(jq --version)
HYPERFINE_VERSION=$(hyperfine --version)
echo "jq: $JQ_VERSION"
echo "hyperfine: $HYPERFINE_VERSION"

# Install Node.js package managers and tools
echo "Installing package managers and tools..."
npm install -g npm@latest corepack@latest vlt@latest bun@latest deno@latest nx@latest turbo@latest

# Install Vite+ (vp) via npm (available as the `vite-plus` package)
npm install -g vite-plus@latest

# Install aube via npm (available as the `@endevco/aube` package)
npm install -g @endevco/aube@latest

# Configure Package Managers
echo "Configuring package managers..."
corepack enable yarn pnpm

# Install Yarn v6 Canary (zpm)
curl -sS https://repo.yarnpkg.com/install | bash

# Make npm silent
npm config set loglevel silent

# Create Results Directory
mkdir -p ./results/

# Log Package Manager Versions
echo "Logging package manager versions..."
NPM_VERSION="$(npm -v)"
VLT_VERSION="$(vlt -v)"
YARN_VERSION="$(corepack yarn@1 -v)"
BERRY_VERSION="$(corepack yarn@latest -v)"
ZPM_VERSION="$(curl https://repo.yarnpkg.com/channels/default/canary)"
PNPM_VERSION="$(corepack pnpm@latest -v)"
PNPM11_VERSION="$(corepack pnpm@next-11 -v)"
BUN_VERSION="$(bun -v)"
DENO_VERSION="$(npm view deno@latest version)"
NX_VERSION="$(npm view nx@latest version)"
TURBO_VERSION="$(npm view turbo@latest version)"
VP_VERSION="$(npm view vite-plus@latest version 2>/dev/null || echo "unknown")"
AUBE_VERSION="$(aube --version 2>/dev/null | head -1 | grep -Eo '[0-9]+[.][0-9]+[.][0-9]+([-+][0-9A-Za-z.-]+)?' | head -1 || true)"
NODE_VERSION=$(node -v)

# Output versions
echo "npm: $NPM_VERSION"
echo "vlt: $VLT_VERSION"
echo "yarn: $YARN_VERSION"
echo "yarn (berry): $BERRY_VERSION"
echo "yarn (zpm): $ZPM_VERSION"
echo "pnpm: $PNPM_VERSION"
echo "pnpm11: $PNPM11_VERSION"
echo "bun: $BUN_VERSION"
echo "deno: $DENO_VERSION"
echo "nx: $NX_VERSION"
echo "turbo: $TURBO_VERSION"
echo "vp: $VP_VERSION"
echo "aube: $AUBE_VERSION"
echo "node: $NODE_VERSION"

# Save versions to JSON file
echo "{
  \"npm\": \"$NPM_VERSION\",
  \"vlt\": \"$VLT_VERSION\",
  \"yarn\": \"$YARN_VERSION\",
  \"berry\": \"$BERRY_VERSION\",
  \"zpm\": \"$ZPM_VERSION\",
  \"pnpm\": \"$PNPM_VERSION\",
  \"pnpm11\": \"$PNPM11_VERSION\",
  \"bun\": \"$BUN_VERSION\",
  \"deno\": \"$DENO_VERSION\",
  \"nx\": \"$NX_VERSION\",
  \"turbo\": \"$TURBO_VERSION\",
  \"vp\": \"$VP_VERSION\",
  \"aube\": \"$AUBE_VERSION\",
  \"node\": \"$NODE_VERSION\"
}" > ./results/versions.json

echo "Setup completed successfully!"
