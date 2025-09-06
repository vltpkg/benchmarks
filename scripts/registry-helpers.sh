#!/bin/bash
# Registry helper functions

# Registry ports
VSR_PORT=1337
VERDACCIO_PORT=4873

# Start registry function
start_registry() {
  local registry_type=$1
  local output_folder=$2
  
  # Kill any existing registry processes
  stop_registry "$registry_type"
  sleep 2
  
  if [ "$registry_type" = "vsr" ]; then
    echo "Starting VSR registry on port $VSR_PORT..."
    cd "$(dirname "$0")/../registry-configs/vsr"
    npx @vltpkg/vsr --port $VSR_PORT --config ./vlt.json > "$output_folder/vsr.log" 2>&1 &
    echo $! > /tmp/vsr.pid
    cd - > /dev/null
    
    # Wait for VSR to start
    local retries=0
    while ! curl -s "http://localhost:$VSR_PORT/-/ping" > /dev/null 2>&1; do
      sleep 1
      retries=$((retries + 1))
      if [ $retries -gt 10 ]; then
        echo "Error: VSR failed to start"
        return 1
      fi
    done
    
    echo "http://localhost:$VSR_PORT"
  else
    echo "Starting Verdaccio registry on port $VERDACCIO_PORT..."
    cd "$(dirname "$0")/../registry-configs/verdaccio"
    verdaccio --config ./config.yaml > "$output_folder/verdaccio.log" 2>&1 &
    echo $! > /tmp/verdaccio.pid
    cd - > /dev/null
    
    # Wait for Verdaccio to start
    local retries=0
    while ! curl -s "http://localhost:$VERDACCIO_PORT/-/ping" > /dev/null 2>&1; do
      sleep 1
      retries=$((retries + 1))
      if [ $retries -gt 10 ]; then
        echo "Error: Verdaccio failed to start"
        return 1
      fi
    done
    
    echo "http://localhost:$VERDACCIO_PORT"
  fi
}

# Stop registry function
stop_registry() {
  local registry_type=$1
  
  if [ "$registry_type" = "vsr" ]; then
    if [ -f /tmp/vsr.pid ]; then
      kill $(cat /tmp/vsr.pid) 2>/dev/null || true
      rm -f /tmp/vsr.pid
    fi
    pkill -f "vsr --port $VSR_PORT" || true
  else
    if [ -f /tmp/verdaccio.pid ]; then
      kill $(cat /tmp/verdaccio.pid) 2>/dev/null || true
      rm -f /tmp/verdaccio.pid
    fi
    pkill -f "verdaccio --config" || true
  fi
}

# Clean registry cache function
clean_registry_cache() {
  local registry_type=$1
  
  if [ "$registry_type" = "vsr" ]; then
    rm -rf "$(dirname "$0")/../registry-configs/vsr/cache" || true
  else
    rm -rf "$(dirname "$0")/../registry-configs/verdaccio/storage" || true
  fi
}

# Stop all registries
stop_all_registries() {
  stop_registry "vsr"
  stop_registry "verdaccio"
}

# Main execution logic
if [ $# -eq 0 ]; then
  echo "Usage: $0 <command> [args]"
  echo "Commands:"
  echo "  start <vsr|verdaccio> <output_folder> - Start a registry"
  echo "  stop <vsr|verdaccio> - Stop a registry"
  echo "  stop_all - Stop all registries"
  echo "  clean <vsr|verdaccio> - Clean registry cache"
  exit 1
fi

case "$1" in
  start)
    if [ $# -lt 3 ]; then
      echo "Usage: $0 start <vsr|verdaccio> <output_folder>"
      exit 1
    fi
    start_registry "$2" "$3"
    ;;
  stop)
    if [ $# -lt 2 ]; then
      echo "Usage: $0 stop <vsr|verdaccio>"
      exit 1
    fi
    stop_registry "$2"
    ;;
  stop_all)
    stop_all_registries
    ;;
  clean)
    if [ $# -lt 2 ]; then
      echo "Usage: $0 clean <vsr|verdaccio>"
      exit 1
    fi
    clean_registry_cache "$2"
    ;;
  *)
    echo "Unknown command: $1"
    exit 1
    ;;
esac
