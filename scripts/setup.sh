# Environment Configuration
COREPACK_ENABLE_STRICT=0
COREPACK_ENABLE_AUTO_PIN=0
YARN_ENABLE_IMMUTABLE_INSTALLS=false
NX_CLOUD_ACCESS_TOKEN="${{ secrets.NX_TOKEN }}"
TURBO_TOKEN="${{ secrets.TURBO_TOKEN }}"
TURBO_TEAMID="${{ secrets.TURBO_TEAMID }}"

# Install Package Managers & Benchmark Tools
cargo install hyperfine --quiet
npm install -g npm@latest vlt@latest bun@latest deno@latest --silent
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

echo "npm: $NPM_VERSION"
echo "vlt: $VLT_VERSION"
echo "yarn: $YARN_VERSION"
echo "berry: $BERRY_VERSION"
echo "pnpm: $PNPM_VERSION"
echo "bun: $BUN_VERSION"
echo "deno: $DENO_VERSION"

echo "{ npm: \"$NPM_VERSION\", vlt: \"$VLT_VERSION\", yarn: \"$YARN_VERSION\", berry: \"$BERRY_VERSION\", pnpm: \"$PNPM_VERSION\", bun: \"$BUN_VERSION\", deno: \"$DENO_VERSION\" }" > ./results/versions.json

# Log Benchmark Configurations
echo "COREPACK_ENABLE_STRICT: ${{ env.COREPACK_ENABLE_STRICT }}"
echo "COREPACK_ENABLE_AUTO_PIN: ${{ env.COREPACK_ENABLE_AUTO_PIN }}"
echo "YARN_ENABLE_IMMUTABLE_INSTALLS: ${{ env.YARN_ENABLE_IMMUTABLE_INSTALLS }}"