#!/usr/bin/env bash

set -Eeuo pipefail

BENCH_TOXIPROXY_API_HOST="${BENCH_TOXIPROXY_API_HOST:-127.0.0.1}"
BENCH_TOXIPROXY_API_PORT="${BENCH_TOXIPROXY_API_PORT:-8474}"
BENCH_TOXIPROXY_LISTEN_HOST="${BENCH_TOXIPROXY_LISTEN_HOST:-127.0.0.1}"
BENCH_TOXIPROXY_LISTEN_PORT="${BENCH_TOXIPROXY_LISTEN_PORT:-7443}"
BENCH_TOXIPROXY_RATE_KBPS="${BENCH_TOXIPROXY_RATE_KBPS:-8192}"
BENCH_TOXIPROXY_LATENCY_MS="${BENCH_TOXIPROXY_LATENCY_MS:-50}"
BENCH_TOXIPROXY_PID_FILE="${BENCH_TOXIPROXY_PID_FILE:-/tmp/vlt-benchmarks-toxiproxy.pid}"
BENCH_TOXIPROXY_LOG_FILE="${BENCH_TOXIPROXY_LOG_FILE:-/tmp/vlt-benchmarks-toxiproxy.log}"
BENCH_TOXIPROXY_HOSTS_START="# >>> vlt-benchmarks toxiproxy >>>"
BENCH_TOXIPROXY_HOSTS_END="# <<< vlt-benchmarks toxiproxy <<<"
BENCH_TOXIPROXY_HOSTS_ENTRIES="${BENCH_TOXIPROXY_HOSTS_ENTRIES:-}"

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

write_hosts_mapping() {
  local entries="$1"

  sudo node -e '
    const fs = require("node:fs")

    const filePath = "/etc/hosts"
    const start = process.argv[1]
    const end = process.argv[2]
    const entries = process.argv[3]
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    let content = fs.readFileSync(filePath, "utf8")
    const pattern = new RegExp(`${escapeRegex(start)}\\n?[\\s\\S]*?${escapeRegex(end)}\\n?`, "g")
    content = content.replace(pattern, "")
    content = content.replace(/\n*$/, "\n")
    if (entries.length > 0) {
      const block = `${start}\n${entries}\n${end}`
      content = `${content}${block}\n`
    }
    fs.writeFileSync(filePath, content)
  ' "$BENCH_TOXIPROXY_HOSTS_START" "$BENCH_TOXIPROXY_HOSTS_END" "$entries"
}

append_hosts_mapping() {
  local host="$1"
  local entry="${BENCH_TOXIPROXY_LISTEN_HOST} ${host}"

  if ! printf '%s\n' "$BENCH_TOXIPROXY_HOSTS_ENTRIES" | grep -Fxq "$entry"; then
    if [ -n "$BENCH_TOXIPROXY_HOSTS_ENTRIES" ]; then
      BENCH_TOXIPROXY_HOSTS_ENTRIES="${BENCH_TOXIPROXY_HOSTS_ENTRIES}
${entry}"
    else
      BENCH_TOXIPROXY_HOSTS_ENTRIES="$entry"
    fi
  fi

  write_hosts_mapping "$BENCH_TOXIPROXY_HOSTS_ENTRIES"
}

create_toxiproxy_proxy() {
  local proxy_name="$1"
  local upstream_host="$2"
  local upstream_ip="$3"
  local upstream_port="$4"
  local listen_port="$5"
  local rate_kbps="$6"
  local latency_ms="$7"

  curl -fsS -X POST "$(toxiproxy_api_url)/proxies" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"${proxy_name}\",\"listen\":\"${BENCH_TOXIPROXY_LISTEN_HOST}:${listen_port}\",\"upstream\":\"${upstream_ip}:${upstream_port}\"}" \
    >/dev/null

  curl -fsS -X POST "$(toxiproxy_api_url)/proxies/${proxy_name}/toxics" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"bandwidth_upstream\",\"type\":\"bandwidth\",\"stream\":\"upstream\",\"attributes\":{\"rate\":${rate_kbps}}}" \
    >/dev/null

  curl -fsS -X POST "$(toxiproxy_api_url)/proxies/${proxy_name}/toxics" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"bandwidth_downstream\",\"type\":\"bandwidth\",\"stream\":\"downstream\",\"attributes\":{\"rate\":${rate_kbps}}}" \
    >/dev/null

  curl -fsS -X POST "$(toxiproxy_api_url)/proxies/${proxy_name}/toxics" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"latency_downstream\",\"type\":\"latency\",\"stream\":\"downstream\",\"attributes\":{\"latency\":${latency_ms},\"jitter\":0}}" \
    >/dev/null

  echo "Toxiproxy configured for ${upstream_host} at ${BENCH_TOXIPROXY_LISTEN_HOST}:${listen_port} (${rate_kbps} KB/s, ${latency_ms}ms latency)" >&2
}

url_field() {
  local url="$1"
  local field="$2"

  node -e '
    const parsed = new URL(process.argv[1])
    const field = process.argv[2]
    const value = field === "port"
      ? (parsed.port || (parsed.protocol === "https:" ? "443" : "80"))
      : parsed[field]
    process.stdout.write(value)
  ' "$url" "$field"
}

setup_registry_bandwidth_proxy() {
  local proxy_name="$1"
  local registry_url="$2"
  local listen_port="$3"
  local upstream_host
  local upstream_path
  local upstream_protocol
  local upstream_port
  local upstream_ip

  upstream_host="$(url_field "$registry_url" hostname)"
  upstream_path="$(url_field "$registry_url" pathname)"
  upstream_protocol="$(url_field "$registry_url" protocol)"
  upstream_port="$(url_field "$registry_url" port)"
  upstream_ip="$(resolve_ipv4 "$upstream_host")"

  create_toxiproxy_proxy "$proxy_name" "$upstream_host" "$upstream_ip" "$upstream_port" "$listen_port" "$BENCH_TOXIPROXY_RATE_KBPS" "$BENCH_TOXIPROXY_LATENCY_MS"
  append_hosts_mapping "$upstream_host"

  echo "${upstream_protocol}//${upstream_host}:${listen_port}${upstream_path}"
}

cleanup_network_isolation() {
  write_hosts_mapping "" || true

  if curl -fsS "$(toxiproxy_api_url)/version" >/dev/null 2>&1; then
    curl -fsS -X POST "$(toxiproxy_api_url)/reset" >/dev/null || true
  fi

  if [ -n "${BENCH_TOXIPROXY_STARTED:-}" ] && [ -f "$BENCH_TOXIPROXY_PID_FILE" ]; then
    kill "$(cat "$BENCH_TOXIPROXY_PID_FILE")" >/dev/null 2>&1 || true
    rm -f "$BENCH_TOXIPROXY_PID_FILE"
  fi
}
