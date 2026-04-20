# Exit on error
set -Eeuxo pipefail

# Function to safely remove files/directories
safe_remove() {
  if [ -e "$1" ]; then
    rm -rf "$1" || true
  fi
}

# Function to safely clean npm cache
clean_npm_cache() {
  if command -v npm &> /dev/null; then
    npm cache clean --force --silent || true
  fi
}

# Function to safely clean yarn cache
clean_yarn_cache() {
  if command -v corepack &> /dev/null; then
    corepack yarn@1 cache clean --all --silent || true
  fi
}

clean_berry_cache() {
  if command -v corepack &> /dev/null; then
    corepack yarn@latest cache clean --all >/dev/null || true
  fi
}

clean_zpm_cache() {
  if command -v yarn &> /dev/null; then
    yarn cache clean >/dev/null || true
  fi
}

# Function to safely clean pnpm cache
clean_pnpm_cache() {
  if command -v corepack &> /dev/null; then
    corepack pnpm cache delete '*' --silent || true
    # Remove the version-specific store directory reported by this pnpm
    safe_remove "$(corepack pnpm store path 2>/dev/null | xargs)"
  fi
  # Also wipe the entire metadata cache and store parent to catch any
  # leftover version directories (v3, v9, v10, v11 …) that a single
  # `pnpm store path` wouldn't return.
  safe_remove "$HOME/.cache/pnpm"
  safe_remove "$HOME/.local/share/pnpm/store"
}

# Function to safely clean pnpm 11 cache
clean_pnpm11_cache() {
  if command -v corepack &> /dev/null; then
    corepack pnpm@next-11 cache delete '*' --silent || true
    safe_remove "$(corepack pnpm@next-11 store path 2>/dev/null | xargs)"
  fi
  # The parent directories are already cleaned by clean_pnpm_cache above,
  # but if clean_pnpm11_cache is called in isolation we still need them.
  safe_remove "$HOME/.cache/pnpm"
  safe_remove "$HOME/.local/share/pnpm/store"
}

# Function to safely clean vlt cache
clean_vlt_cache() {
  if command -v vlt &> /dev/null; then
    safe_remove "$(vlt config get cache | xargs)"
  fi
}

# Function to safely clean bun cache
clean_bun_cache() {
  if command -v bun &> /dev/null; then
    bun pm cache rm -g || true
    bun pm cache rm || true
    # Remove the entire install directory (includes cache/ and metadata files)
    safe_remove "$HOME/.bun/install"
    # Also remove BUN_INSTALL_CACHE_DIR if set to a custom location
    if [ -n "${BUN_INSTALL_CACHE_DIR:-}" ]; then
      safe_remove "$BUN_INSTALL_CACHE_DIR"
    fi
  fi
}

# Function to safely clean nx cache
clean_nx_cache() {
  if command -v nx &> /dev/null; then
    nx daemon --stop >/dev/null || true
    nx clear-cache >/dev/null || true
    nx reset >/dev/null || true
  fi
}

# Function to safely clean deno cache
clean_deno_cache() {
  if command -v deno &> /dev/null; then
    deno clean --quiet || true
  fi
}

# Function to safely clean vp cache
clean_vp_cache() {
  if command -v vp &> /dev/null; then
    vp cache clean >/dev/null 2>&1 || true
  fi
}

# Function to safely clean aube metadata cache (packument JSONs only).
# This removes the registry metadata that `aube cache delete` covers,
# but leaves the global store and the rest of ~/.cache/aube intact.
clean_aube_metadata_cache() {
  if command -v aube &> /dev/null; then
    aube cache delete '*' >/dev/null 2>&1 || true
  fi
}

# Function to safely clean ALL aube caches — metadata cache, package index,
# virtual-store (all under ~/.cache/aube/) AND the global content-addressable
# store (~/.aube-store/).  Used in "clean" (fully cold) variations.
clean_aube_cache() {
  clean_aube_metadata_cache
  safe_remove "$HOME/.cache/aube"
  safe_remove "$HOME/.aube-store"
}

# Function to clean lockfiles for all package managers
clean_lockfiles() {
  echo "Cleaning lockfiles..."
  safe_remove "package-lock.json"
  safe_remove "yarn.lock"
  safe_remove "pnpm-lock.yaml"
  safe_remove "vlt-lock.json"
  safe_remove "bun.lockb"
  safe_remove "bun.lock"
  safe_remove "deno.lock"
  safe_remove "aube-lock.yaml"
}

# Function to clean package manager field from package.json
clean_package_manager_field() {
  echo "Removing packageManager field from package.json..."
  if command -v vlt &> /dev/null; then
    vlt pkg rm packageManager
  fi
}

# Function to clean node_modules directory
clean_node_modules() {
  echo "Cleaning node_modules directory..."
  safe_remove "node_modules"
}

# Function to clean transient package manager artifacts.
# Keep fixture config files (e.g. .yarnrc.yml / .npmrc) intact.
clean_package_manager_files() {
  echo "Cleaning package manager files..."
  safe_remove ".yarn"
  safe_remove ".pnp.data.json"
  safe_remove ".pnp.loader.mjs"
  safe_remove "pnpm-debug.log"
  safe_remove "yarn-error.log"
  safe_remove ".aube"
}

# Function to remove benchmark-added registry lines from .npmrc
clean_npmrc() {
  echo "Cleaning .npmrc registry lines..."
  if [ -f ".npmrc" ]; then
    awk '!/^[[:space:]]*(registry=|\/\/)/ { print }' ".npmrc" > ".npmrc.tmp"
    if [ -s ".npmrc.tmp" ]; then
      mv ".npmrc.tmp" ".npmrc"
    else
      rm -f ".npmrc" ".npmrc.tmp"
    fi
  fi
}

# Function to clean caches for all package managers
clean_all_cache() {
  echo "Cleaning package manager caches..."
  clean_npm_cache
  clean_yarn_cache
  clean_berry_cache
  clean_zpm_cache
  clean_pnpm_cache
  clean_pnpm11_cache
  clean_vlt_cache
  clean_bun_cache
  clean_nx_cache
  clean_deno_cache
  clean_vp_cache
  clean_aube_cache
}

clean_build_files() {
  echo "Cleaning build tool files..."
  safe_remove ".nx"
  safe_remove ".turbo"
  safe_remove ".cache"
}

clean_git() {
  echo "Cleaning git changes..."
  if command -v git &> /dev/null; then
    git add . || true
    git stash || true
  fi
}

clean_workspace_protocol() {
  echo "Restoring package.json files (undo workspace: protocol changes)..."
  if command -v git &> /dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
    git checkout -- packages/ package.json 2>/dev/null || true
  fi
}

clean_all() {
  clean_node_modules
  clean_lockfiles
  clean_package_manager_field
  clean_package_manager_files
  clean_workspace_protocol
  clean_all_cache
  clean_build_files
  echo "Cleanup completed successfully!"
}

# Function to display available functions
show_help() {
  echo "Available functions:"
  echo "  clean_npm_cache"
  echo "  clean_yarn_cache"
  echo "  clean_berry_cache"
  echo "  clean_zpm_cache"
  echo "  clean_pnpm_cache"
  echo "  clean_pnpm11_cache"
  echo "  clean_vlt_cache"
  echo "  clean_bun_cache"
  echo "  clean_nx_cache"
  echo "  clean_deno_cache"
  echo "  clean_aube_cache"
  echo "  clean_aube_metadata_cache"
  echo "  clean_lockfiles"
  echo "  clean_package_manager_field"
  echo "  clean_package_manager_files"
  echo "  clean_npmrc"
  echo "  clean_node_modules"
  echo "  clean_all_cache"
  echo "  clean_build_files"
  echo "  clean_git"
  echo "  clean_all"
  echo ""
  echo "Usage: $0 [function_name1] [function_name2] ..."
  echo "Example: $0 clean_npm_cache clean_lockfiles"
}

# Main execution logic
if [ $# -eq 0 ]; then
  show_help
else
  for arg in "$@"; do
    case "$arg" in
      clean_npm_cache)
        clean_npm_cache
        ;;
      clean_yarn_cache)
        clean_yarn_cache
        ;;
      clean_berry_cache)
        clean_berry_cache
        ;;
      clean_pnpm_cache)
        clean_pnpm_cache
        ;;
      clean_pnpm11_cache)
        clean_pnpm11_cache
        ;;
      clean_vlt_cache)
        clean_vlt_cache
        ;;
      clean_bun_cache)
        clean_bun_cache
        ;;
      clean_zpm_cache)
        clean_zpm_cache
        ;;
      clean_nx_cache)
        clean_nx_cache
        ;;
      clean_deno_cache)
        clean_deno_cache
        ;;
      clean_aube_cache)
        clean_aube_cache
        ;;
      clean_aube_metadata_cache)
        clean_aube_metadata_cache
        ;;
      clean_lockfiles)
        clean_lockfiles
        ;;
      clean_package_manager_field)
        clean_package_manager_field
        ;;
      clean_package_manager_files)
        clean_package_manager_files
        ;;
      clean_npmrc)
        clean_npmrc
        ;;
      clean_node_modules)
        clean_node_modules
        ;;
      clean_all_cache)
        clean_all_cache
        ;;
      clean_build_files)
        clean_build_files
        ;;
      clean_workspace_protocol)
        clean_workspace_protocol
        ;;
      clean_git)
        clean_git
        ;;
      clean_all)
        clean_all
        ;;
      help|--help|-h)
        show_help
        exit 0
        ;;
      *)
        echo "Unknown function: $arg"
        echo "Use 'help' to see available functions."
        exit 1
        ;;
    esac
  done
fi
