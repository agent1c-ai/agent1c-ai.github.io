#!/usr/bin/env sh
set -eu

BASE_URL="${AGENT1C_RELAY_BASE_URL:-https://agent1c.ai/shell-relay}"
DEST="${AGENT1C_RELAY_HOME:-$HOME/.agent1c-relay}"

mkdir -p "$DEST"

fetch_file(){
  file="$1"
  url="$BASE_URL/$file"
  out="$DEST/$file"
  echo "[agent1c-relay] downloading $url"
  curl -fsSL "$url" -o "$out"
  chmod +x "$out"
}

fetch_file "agent1c-relay.sh"
fetch_file "handler.sh"

cat <<EOF
[agent1c-relay] installed to: $DEST
[agent1c-relay] next step:
  $DEST/agent1c-relay.sh
EOF
