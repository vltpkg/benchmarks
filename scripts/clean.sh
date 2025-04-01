#!/bin/bash

# Exit on error
set -e

# Function to safely remove files/directories
safe_remove() {
    if [ -e "$1" ]; then
        rm -rf "$1"
    fi
}

# Function to safely clean npm cache
clean_npm_cache() {
    if command -v npm &> /dev/null; then
        npm cache clean --force --silent
    fi
}

# Function to safely clean yarn cache
clean_yarn_cache() {
    if command -v corepack &> /dev/null; then
        corepack yarn@1 cache clean --all --silent
        corepack yarn@latest cache clean --all >/dev/null
    fi
}

# Function to safely clean pnpm cache
clean_pnpm_cache() {
    if command -v corepack &> /dev/null; then
        corepack pnpm cache delete * --silent
        if [ -n "$(corepack pnpm store path 2>/dev/null)" ]; then
            rm -rf "$(corepack pnpm store path)"
        fi
    fi
}

# Function to safely clean vlt cache
clean_vlt_cache() {
    if command -v vlt &> /dev/null; then
        if [ -n "$(vlt config get cache 2>/dev/null)" ]; then
            rm -rf "$(vlt config get cache)"
        fi
    fi
}

# Function to safely clean bun cache
clean_bun_cache() {
    if command -v bun &> /dev/null; then
        if [ -n "$(bun pm cache 2>/dev/null)" ]; then
            rm -rf "$(bun pm cache)"
        fi
    fi
}

# Function to safely clean nx cache
clean_nx_cache() {
    if command -v nx &> /dev/null; then
        nx daemon --stop >/dev/null
        nx clear-cache >/dev/null
        nx reset >/dev/null
    fi
}

# Function to safely clean deno cache
clean_deno_cache() {
    if command -v deno &> /dev/null; then
        deno clean --quiet
    fi
}

# Remove packageManager field from package.json
echo "Removing packageManager field from package.json..."
if command -v npm &> /dev/null; then
    npm pkg delete packageManager
fi

# Clean package manager files
echo "Cleaning package manager files..."
safe_remove "./node_modules/"
safe_remove ".npm*"
safe_remove ".yarn*"
safe_remove ".pnp*"
safe_remove ".vlt*"
safe_remove "package-lock.json"
safe_remove "yarn.lock"
safe_remove "pnpm-lock.yaml"
safe_remove "vlt-lock.json"
safe_remove "bun.lockb"
safe_remove "deno.lock"

# Clean caches
echo "Cleaning package manager caches..."
clean_npm_cache
clean_yarn_cache
clean_pnpm_cache
clean_vlt_cache
clean_bun_cache
clean_nx_cache
clean_deno_cache

# Clean build tool files
echo "Cleaning build tool files..."
safe_remove "nx.json"
safe_remove ".nx"
safe_remove ".turbo"
safe_remove ".cache"

# Clean git changes
echo "Cleaning git changes..."
if command -v git &> /dev/null; then
    git add . >/dev/null
    git stash >/dev/null
fi

echo "Cleanup completed successfully!"