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

# Function to safely clean pnpm cache
clean_pnpm_cache() {
  if command -v corepack &> /dev/null; then
    corepack pnpm cache delete * --silent || true
    safe_remove "$(corepack pnpm store path | xargs)"
  fi
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
    bun pm cache rm || true
    # also clear global cache dir
    safe_remove "~/.bun/install/cache"
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

# Function to clean various package manager files
clean_package_manager_files() {
  echo "Cleaning package manager files..."
  safe_remove ".npm*"
  safe_remove ".yarn*"
  safe_remove ".pnp*"
}

# Function to clean caches for all package managers
clean_all_cache() {
  echo "Cleaning package manager caches..."
  clean_npm_cache
  clean_yarn_cache
  clean_berry_cache
  clean_pnpm_cache
  clean_vlt_cache
  clean_bun_cache
  clean_nx_cache
  clean_deno_cache
}

clean_build_files() {
  echo "Cleaning build tool files..."
  safe_remove "nx.json"
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

clean_all() {
  clean_node_modules
  clean_lockfiles
  clean_package_manager_field
  clean_package_manager_files
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
  echo "  clean_pnpm_cache"
  echo "  clean_vlt_cache"
  echo "  clean_bun_cache"
  echo "  clean_nx_cache"
  echo "  clean_deno_cache"
  echo "  clean_lockfiles"
  echo "  clean_package_manager_field"
  echo "  clean_package_manager_files"
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
      clean_vlt_cache)
        clean_vlt_cache
        ;;
      clean_bun_cache)
        clean_bun_cache
        ;;
      clean_nx_cache)
        clean_nx_cache
        ;;
      clean_deno_cache)
        clean_deno_cache
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
      clean_node_modules)
        clean_node_modules
        ;;
      clean_all_cache)
        clean_all_cache
        ;;
      clean_build_files)
        clean_build_files
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

