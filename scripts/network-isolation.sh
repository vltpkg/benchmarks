#!/usr/bin/env bash

set -Eeuo pipefail

BENCH_TOXIPROXY_API_HOST="${BENCH_TOXIPROXY_API_HOST:-127.0.0.1}"
BENCH_TOXIPROXY_API_PORT="${BENCH_TOXIPROXY_API_PORT:-8474}"
BENCH_TOXIPROXY_LISTEN_HOST="${BENCH_TOXIPROXY_LISTEN_HOST:-127.0.0.1}"
BENCH_TOXIPROXY_LISTEN_PORT="${BENCH_TOXIPROXY_LISTEN_PORT:-7443}"
BENCH_TOXIPROXY_RATE_KBPS="${BENCH_TOXIPROXY_RATE_KBPS:-8192}"
BENCH_TOXIPROXY_PROXY_NAME="${BENCH_TOXIPROXY_PROXY_NAME:-bench-vsr}"
BENCH_TOXIPROXY_PID_FILE="${BENCH_TOXIPROXY_PID_FILE:-/tmp/vlt-benchmarks-toxiproxy.pid}"
BENCH_TOXIPROXY_LOG_FILE="${BENCH_TOXIPROXY_LOG_FILE:-/tmp/vlt-benchmarks-toxiproxy.log}"
BENCH_TOXIPROXY_HOSTS_START="# >>> vlt-benchmarks toxiproxy >>>"
BENCH_TOXIPROXY_HOSTS_END="# <<< vlt-benchmarks toxiproxy <<<"

toxiproxy_api_url() {
  echo "http://${BENCH_TOXIPROXY_API_HOST}:${BENCH_TOXIPROXY_API_PORT}"
}

ensure_toxiproxy_installed() {
  if ! command -v toxiproxy-server >/dev/null 2>&1; then
    echo "Error: toxiproxy-server is required for BENCH_NETWORK_PROFILE=$BENCH_NETWORK_PROFILE"
    exit 1
  fi
}

resolve_ipv4() {
  local host="$1"

  node -e '
    const dns = require("node:dns").promises
    dns.lookup(process.argv[1], { family: 4 }).then((result) => {
      process.stdout.write(result.address)
    }).catch((error) => {
      console.error(error.message)
      process.exit(1)
    })
  ' "$host"
}

wait_for_toxiproxy() {
  local api
  api="$(toxiproxy_api_url)"

  for _ in {1..40}; do
    if curl -fsS "$api/version" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done

  echo "Error: toxiproxy did not start on $api"
  exit 1
}

start_toxiproxy_server() {
  local api
  api="$(toxiproxy_api_url)"

  if curl -fsS "$api/version" >/dev/null 2>&1; then
    return 0
  fi

  nohup toxiproxy-server -host "$BENCH_TOXIPROXY_API_HOST" -port "$BENCH_TOXIPROXY_API_PORT" \
    >"$BENCH_TOXIPROXY_LOG_FILE" 2>&1 &
  echo "$!" > "$BENCH_TOXIPROXY_PID_FILE"
  BENCH_TOXIPROXY_STARTED=1
  wait_for_toxiproxy
}

reset_toxiproxy() {
  curl -fsS -X POST "$(toxiproxy_api_url)/reset" >/dev/null
}

update_hosts_mapping() {
  local host="$1"
  local ip="$2"
  local target="${ip} ${host}"

  sudo node -e '
    const fs = require("node:fs")

    const filePath = "/etc/hosts"
    const start = process.argv[1]
    const end = process.argv[2]
    const entry = process.argv[3]
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    let content = fs.readFileSync(filePath, "utf8")
    const block = `${start}\n${entry}\n${end}`
    const pattern = new RegExp(`${escapeRegex(start)}\\n?[\\s\\S]*?${escapeRegex(end)}\\n?`, "g")
    content = content.replace(pattern, "")
    content = content.replace(/\n*$/, "\n")
    fs.writeFileSync(filePath, `${content}${block}\n`)
  ' "$BENCH_TOXIPROXY_HOSTS_START" "$BENCH_TOXIPROXY_HOSTS_END" "$target"
}

clear_hosts_mapping() {
  sudo node -e '
    const fs = require("node:fs")

    const filePath = "/etc/hosts"
    const start = process.argv[1]
    const end = process.argv[2]
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    let content = fs.readFileSync(filePath, "utf8")
    const pattern = new RegExp(`${escapeRegex(start)}\\n?[\\s\\S]*?${escapeRegex(end)}\\n?`, "g")
    content = content.replace(pattern, "")
    fs.writeFileSync(filePath, content.replace(/\n*$/, "\n"))
  ' "$BENCH_TOXIPROXY_HOSTS_START" "$BENCH_TOXIPROXY_HOSTS_END"
}

create_toxiproxy_proxy() {
  local upstream_host="$1"
  local upstream_ip="$2"
  local upstream_port="$3"
  local rate_kbps="$4"

  curl -fsS -X POST "$(toxiproxy_api_url)/proxies" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"${BENCH_TOXIPROXY_PROXY_NAME}\",\"listen\":\"${BENCH_TOXIPROXY_LISTEN_HOST}:${BENCH_TOXIPROXY_LISTEN_PORT}\",\"upstream\":\"${upstream_ip}:${upstream_port}\"}" \
    >/dev/null

  curl -fsS -X POST "$(toxiproxy_api_url)/proxies/${BENCH_TOXIPROXY_PROXY_NAME}/toxics" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"bandwidth_upstream\",\"type\":\"bandwidth\",\"stream\":\"upstream\",\"attributes\":{\"rate\":${rate_kbps}}}" \
    >/dev/null

  curl -fsS -X POST "$(toxiproxy_api_url)/proxies/${BENCH_TOXIPROXY_PROXY_NAME}/toxics" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"bandwidth_downstream\",\"type\":\"bandwidth\",\"stream\":\"downstream\",\"attributes\":{\"rate\":${rate_kbps}}}" \
    >/dev/null

  echo "Toxiproxy configured for ${upstream_host} at ${BENCH_TOXIPROXY_LISTEN_HOST}:${BENCH_TOXIPROXY_LISTEN_PORT} (${rate_kbps} KB/s)"
}

setup_vsr_bandwidth_proxy() {
  local upstream_host="registry.vlt.io"
  local upstream_path="/npm/"
  local upstream_port="443"
  local upstream_ip

  ensure_toxiproxy_installed
  upstream_ip="$(resolve_ipv4 "$upstream_host")"
  start_toxiproxy_server
  reset_toxiproxy
  create_toxiproxy_proxy "$upstream_host" "$upstream_ip" "$upstream_port" "$BENCH_TOXIPROXY_RATE_KBPS"
  update_hosts_mapping "$upstream_host" "$BENCH_TOXIPROXY_LISTEN_HOST"

  BENCH_VSR_PROXY_URL="https://${upstream_host}:${BENCH_TOXIPROXY_LISTEN_PORT}${upstream_path}"
  export BENCH_VSR_PROXY_URL
}

cleanup_network_isolation() {
  clear_hosts_mapping || true

  if curl -fsS "$(toxiproxy_api_url)/version" >/dev/null 2>&1; then
    curl -fsS -X POST "$(toxiproxy_api_url)/reset" >/dev/null || true
  fi

  if [ -n "${BENCH_TOXIPROXY_STARTED:-}" ] && [ -f "$BENCH_TOXIPROXY_PID_FILE" ]; then
    kill "$(cat "$BENCH_TOXIPROXY_PID_FILE")" >/dev/null 2>&1 || true
    rm -f "$BENCH_TOXIPROXY_PID_FILE"
  fi
}
