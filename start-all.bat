
#!/usr/bin/env bash
# Auction-499 unified dev launcher (Bash)
# Works in Git Bash (Windows), WSL, macOS, Linux

set -euo pipefail

############################################
# Config (edit if needed)
############################################
LK_IMAGE="livekit/livekit-server:v1.9"
LK_NAME="auction_livekit"
LK_KEY="mydevkey123"
LK_SECRET="supersecret987"

# default ports (we'll bump if busy)
LK_PORT_DEFAULT=7880
LK_UDP_DEFAULT=7882
API_PORT_DEFAULT=3000
FE_PORT_DEFAULT=5173

############################################
# Utilities
############################################

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say()  { echo -e "\033[1;36m$*\033[0m"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
err()  { echo -e "\033[1;31m[ERROR]\033[0m $*"; }

have() { command -v "$1" >/dev/null 2>&1; }

# Return 0 if port is busy, 1 if free
is_port_busy() {
  local port="$1"
  # Try Bash's /dev/tcp
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") >/dev/null 2>&1; then
    # Connection succeeded -> busy
    exec 3>&- 2>/dev/null || true
    exec 3<&- 2>/dev/null || true
    return 0
  fi
  # Try nc if present
  if have nc; then
    if nc -z 127.0.0.1 "$port" >/dev/null 2>&1; then
      return 0
    fi
  fi
  # Try lsof if present
  if have lsof; then
    if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

pick_port() {
  # pick_port <preferred> <fallback>
  local preferred="$1" fallback="$2"
  if is_port_busy "$preferred"; then
    echo "$fallback"
  else
    echo "$preferred"
  fi
}

detect_local_ip() {
  # Priorities: ip route -> hostname -I -> ipconfig (Windows) -> 127.0.0.1
  if have ip; then
    local ip_out
    if ip_out="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '/src/ {for(i=1;i<=NF;i++){if($i=="src"){print $(i+1); exit}}}')"; then
      if [[ -n "${ip_out:-}" ]]; then
        echo "$ip_out"; return
      fi
    fi
  fi
  if have hostname; then
    local h
    h="$(hostname -I 2>/dev/null | awk '{print $1}')" || true
    if [[ -n "${h:-}" ]]; then
      echo "$h"; return
    fi
  fi
  # Try ipconfig (Git Bash on Windows)
  if have ipconfig; then
    local ip4
    ip4="$(ipconfig 2>/dev/null | tr -d '\r' | grep -Eo 'IPv4 Address[^\:]*:\s*[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -n1 | sed -E 's/.*:\s*//')" || true
    if [[ -n "${ip4:-}" ]]; then
      echo "$ip4"; return
    fi
  fi
  echo "127.0.0.1"
}

cleanup() {
  echo
  say "Stopping LiveKit container..."
  docker rm -f "${LK_NAME}" >/dev/null 2>&1 || true
  [[ -n "${LOGS_PID:-}" ]] && kill "${LOGS_PID}" >/dev/null 2>&1 || true
  say "Done. Bye!"
}
trap cleanup EXIT INT TERM

############################################
# Checks
############################################
say "Auction-499 — Dev Launcher"

if ! have docker; then
  err "Docker is not installed or not on PATH. Install Docker Desktop first."
  exit 1
fi
if ! have node; then
  err "Node.js not found on PATH. Install from https://nodejs.org/ (LTS)."
  exit 1
fi
if ! have npm; then
  err "npm not found on PATH. Reinstall Node.js (includes npm)."
  exit 1
fi

# Verify docker engine responds
if ! docker info >/dev/null 2>&1; then
  err "Docker engine is not running. Open Docker Desktop and re-run."
  exit 1
fi

############################################
# Ports & IP
############################################
LK_PORT="$(pick_port "$LK_PORT_DEFAULT" 7885)"
LK_UDP="$(pick_port "$LK_UDP_DEFAULT" 7890)"
API_PORT="$API_PORT_DEFAULT"
FE_PORT="$FE_PORT_DEFAULT"

LOCAL_IP="$(detect_local_ip)"
say "Using LAN IP: $LOCAL_IP"
say "LiveKit TCP: $LK_PORT, UDP: $LK_UDP"

############################################
# LiveKit container
############################################
say "Ensuring previous LiveKit container is stopped..."
docker rm -f "${LK_NAME}" >/dev/null 2>&1 || true

say "Starting LiveKit on ws://localhost:${LK_PORT} (UDP ${LK_UDP}), node-ip=${LOCAL_IP}"
docker run -d --name "${LK_NAME}" \
  -p ${LK_PORT}:${LK_PORT}/tcp -p ${LK_UDP}:${LK_UDP}/udp \
  --restart unless-stopped \
  "${LK_IMAGE}" \
  --dev \
  --bind "0.0.0.0:${LK_PORT}" \
  --node-ip "${LOCAL_IP}" \
  --udp-port "${LK_UDP}" \
  --keys "${LK_KEY}:${LK_SECRET}"

# Stream logs in background
docker logs -f "${LK_NAME}" &
LOGS_PID=$!

############################################
# Backend (server/)
############################################
if [[ -d "${ROOT}/server" ]]; then
  if [[ ! -f "${ROOT}/server/.env" ]]; then
    warn "server/.env not found. Creating a minimal one..."
    cat > "${ROOT}/server/.env" <<EOF
PORT=${API_PORT}
LIVEKIT_URL=ws://localhost:${LK_PORT}
LIVEKIT_API_KEY=${LK_KEY}
LIVEKIT_API_SECRET=${LK_SECRET}
EOF
  else
    say "server/.env present. Ensure it points to ws://localhost:${LK_PORT}"
  fi

  say "Starting Backend (server) on port ${API_PORT}..."
  (
    cd "${ROOT}/server"
    [[ -d node_modules ]] || npm install --silent --no-fund
    npm start
  ) &
else
  warn "'server/' folder not found. Skipping backend."
fi

############################################
# Frontend (frontend/)
############################################
if [[ -d "${ROOT}/frontend" ]]; then
  say "Starting Frontend (Vite dev) on port ${FE_PORT}..."
  (
    cd "${ROOT}/frontend"
    [[ -d node_modules ]] || npm install --silent --no-fund
    npm run dev
  ) &
else
  warn "'frontend/' folder not found. Skipping frontend."
fi

############################################
# Done / Hold
############################################
echo
say "✅ All systems started!"
echo "   LiveKit validate: http://localhost:${LK_PORT}/rtc/validate"
echo "   Website (vite):   http://localhost:${FE_PORT}"
echo
say "Press Ctrl+C here to stop LiveKit and exit."
# Wait forever; trap will handle cleanup
while :; do sleep 3600; done
