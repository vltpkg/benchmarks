#!/bin/bash

# Exit on error
set -e

# Environment Configuration
COREPACK_ENABLE_STRICT=0
COREPACK_ENABLE_AUTO_PIN=0
YARN_ENABLE_IMMUTABLE_INSTALLS=false

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
bash "$(dirname "$0")/log-versions.sh"

echo "Setup completed successfully!"
