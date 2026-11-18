#!/bin/bash

# Exit on error
set -e

# Environment Configuration
export YARN_ENABLE_IMMUTABLE_INSTALLS=false

# Install locations for yarn classic and yarn berry (BENCH_YARN_PREFIX, ...)
source "$(dirname "${BASH_SOURCE[0]}")/pm-bins.sh"

# Check Node version
REQUIRED_NODE_VERSION="26"
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
npm install -g --allow-scripts=bun,deno,nx npm@latest vlt@latest bun@latest deno@latest nx@latest turbo@latest

# Install pnpm with npm, one of the methods in https://pnpm.io/installation.
# npm 12 blocks install scripts by default, but pnpm's postinstall is what puts
# its native binary in place of the JavaScript launcher, so allow it.
npm install -g --allow-scripts=pnpm pnpm@latest
PNPM_BIN="$(command -v pnpm)"
if [ "$PNPM_BIN" != "$(npm prefix -g)/bin/pnpm" ] || [ "$(head -c 4 "$(readlink -f "$PNPM_BIN")")" != $'\x7fELF' ]; then
  echo "Error: expected pnpm on PATH to be the native binary installed by npm, got $PNPM_BIN ($(file -L "$PNPM_BIN" 2>/dev/null || true))"
  exit 1
fi

# Install Yarn 1 the way https://classic.yarnpkg.com/en/docs/install
# recommends (npm install --global yarn@1), into its own prefix: zpm's Yarn
# Switch and berry's Corepack shim are also called `yarn` (see pm-bins.sh).
# npm 12 skips yarn's preinstall script, which only removes a Corepack `yarn`
# symlink from the prefix being installed into; there is none in this one.
npm install -g --prefix "$BENCH_YARN_PREFIX" yarn@1

# Install Corepack for Yarn 4, as https://yarnpkg.com/getting-started/install
# recommends (npm install -g corepack), into its own prefix (see pm-bins.sh).
npm install -g --prefix "$BENCH_COREPACK_PREFIX" corepack@latest

# Install Vite+ (vp) via npm (available as the `vite-plus` package)
npm install -g vite-plus@latest

# Install aube via npm (available as the `@endevco/aube` package).
# npm 12 blocks dependency lifecycle scripts by default, but aube's preinstall
# selects and installs its platform-specific native binary. Allow only aube's
# installer so the binary is available to the benchmark matrix.
# Non-fatal: aube may not have a working binary for all platforms (e.g. arm64).
# If it fails to install, the benchmark suite continues without aube.
if ! npm install -g --allow-scripts=@endevco/aube @endevco/aube@latest; then
  echo "Warning: aube installation failed (may not support this platform) — skipping aube benchmarks"
fi

# Install upm via npm. upm is a pure TypeScript package manager (~230 KB),
# so it installs quickly and works on all platforms.
npm install -g upm@latest

# Verify aube binary is actually available (install may succeed but produce no binary)
if ! command -v aube &>/dev/null; then
  echo "Warning: aube binary not available after installation — excluding from benchmarks"
  if [ -n "${GITHUB_ENV:-}" ]; then
    BENCH_INCLUDE="${BENCH_INCLUDE:-npm,yarn,berry,zpm,pnpm,vlt,bun,deno,aube,upm,nx,turbo,vp,node}"
    BENCH_INCLUDE="${BENCH_INCLUDE//,aube/}"
    BENCH_INCLUDE="${BENCH_INCLUDE//aube,/}"
    echo "BENCH_INCLUDE=$BENCH_INCLUDE" >> "$GITHUB_ENV"
  fi
fi

# Resolve the berry version once, so every berry benchmark pins the same one
# in package.json#packageManager (and Corepack downloads it now, not in a
# timed run).
BERRY_VERSION="$("$BENCH_COREPACK_BIN" yarn@latest -v)"
mkdir -p "$BENCH_PM_HOME"
echo "$BERRY_VERSION" > "$BENCH_BERRY_VERSION_FILE"

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
YARN_VERSION="$("$BENCH_YARN_BIN" -v)"
ZPM_VERSION="${BENCH_ZPM_VERSION:-$(curl -fsSL https://repo.yarnpkg.com/channels/default/canary)}"
PNPM_VERSION="$(pnpm -v)"
BUN_VERSION="$(bun -v)"
DENO_VERSION="$(npm view deno@latest version)"
# nx and turbo run from the `run` fixture's own install (a global nx or turbo
# hands off to the project's copy), so report the version the fixture's range
# resolves to, not the global one. The fixture ranges track the current majors.
RUN_FIXTURE_MANIFEST="$(dirname "${BASH_SOURCE[0]}")/../fixtures/run/package.json"
resolve_fixture_dev_dependency() {
  local range
  range="$(jq -r ".devDependencies[\"$1\"]" "$RUN_FIXTURE_MANIFEST")"
  # one version prints as a string, several as an ascending array
  npm view "$1@$range" version --json | jq -r 'if type == "array" then last else . end'
}
NX_VERSION="$(resolve_fixture_dev_dependency nx)"
TURBO_VERSION="$(resolve_fixture_dev_dependency turbo)"
VP_VERSION="$(npm view vite-plus@latest version 2>/dev/null || echo "unknown")"
AUBE_VERSION="$(aube --version 2>/dev/null | head -1 | grep -Eo '[0-9]+[.][0-9]+[.][0-9]+([-+][0-9A-Za-z.-]+)?' | head -1 || true)"
UPM_VERSION="$(upm --version 2>/dev/null | grep -Eo '[0-9]+[.][0-9]+[.][0-9]+([-+][0-9A-Za-z.-]+)?' | head -1 || true)"
NODE_VERSION=$(node -v)

# Output versions
echo "npm: $NPM_VERSION"
echo "vlt: $VLT_VERSION"
echo "yarn: $YARN_VERSION"
echo "yarn (berry): $BERRY_VERSION"
echo "yarn (zpm): $ZPM_VERSION"
echo "pnpm: $PNPM_VERSION"
echo "bun: $BUN_VERSION"
echo "deno: $DENO_VERSION"
echo "nx: $NX_VERSION"
echo "turbo: $TURBO_VERSION"
echo "vp: $VP_VERSION"
echo "aube: $AUBE_VERSION"
echo "upm: $UPM_VERSION"
echo "node: $NODE_VERSION"
echo "pnpm binary: $PNPM_BIN"
echo "yarn binary: $BENCH_YARN_BIN"
echo "berry binary: $BENCH_BERRY_BIN (packageManager: yarn@$BERRY_VERSION)"
echo "zpm binary: $BENCH_ZPM_BIN"

# Save versions to JSON file
echo "{
  \"npm\": \"$NPM_VERSION\",
  \"vlt\": \"$VLT_VERSION\",
  \"yarn\": \"$YARN_VERSION\",
  \"berry\": \"$BERRY_VERSION\",
  \"zpm\": \"$ZPM_VERSION\",
  \"pnpm\": \"$PNPM_VERSION\",
  \"bun\": \"$BUN_VERSION\",
  \"deno\": \"$DENO_VERSION\",
  \"nx\": \"$NX_VERSION\",
  \"turbo\": \"$TURBO_VERSION\",
  \"vp\": \"$VP_VERSION\",
  \"aube\": \"$AUBE_VERSION\",
  \"upm\": \"$UPM_VERSION\",
  \"node\": \"$NODE_VERSION\"
}" > ./results/versions.json

echo "Setup completed successfully!"
