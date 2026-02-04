#!/bin/bash

# Babylon.js Fixture Setup Script
# This script clones the Babylon.js repository and creates the necessary files for benchmarking

set -euo pipefail

REPO_URL="https://github.com/BabylonJS/Babylon.js.git"

echo "Setting up Babylon.js fixture..."

# Check if we already have the babylon repo files
if [ ! -f "lerna.json" ] || [ ! -d "packages" ]; then
    # Clean up any existing files
    rm -rf package.json packages node_modules pnpm-lock.yaml yarn.lock package-lock.json .yarnrc.yml pnpm-workspace.yaml

    # Clone the repository (shallow clone for speed) and move contents to current directory
    echo "Cloning Babylon.js repository..."
    git clone --depth 1 "$REPO_URL" temp-clone

    # Move all contents from temp clone to current directory
    mv temp-clone/* . 2>/dev/null || true
    mv temp-clone/.* . 2>/dev/null || true
    rm -rf temp-clone
else
    echo "Babylon.js repository already cloned, skipping..."
fi

# Remove existing lockfiles to avoid conflicts
rm -f package-lock.json pnpm-lock.yaml yarn.lock

# Create pnpm-workspace.yaml for pnpm compatibility (the repo uses npm workspaces)
echo "Creating pnpm-workspace.yaml for pnpm compatibility..."
cat > pnpm-workspace.yaml << EOF
packages:
  - "packages/**/*"
EOF

# Create .yarnrc.yml for yarn berry compatibility
echo "Creating .yarnrc.yml for yarn compatibility..."
cat > .yarnrc.yml << EOF
nodeLinker: node-modules
enableGlobalCache: false
EOF

# Remove the engine restrictions that might cause issues
echo "Adapting package.json for benchmarking..."
if command -v jq >/dev/null 2>&1; then
    # Use jq if available for clean JSON manipulation
    jq 'del(.engines)' package.json > package.json.tmp && mv package.json.tmp package.json
else
    # Fallback to sed if jq is not available
    sed -i.bak '/"engines":/,/},/d' package.json && rm -f package.json.bak
fi

echo "Babylon.js fixture setup complete!"
echo "Packages found: $(find packages -name "package.json" 2>/dev/null | wc -l)"