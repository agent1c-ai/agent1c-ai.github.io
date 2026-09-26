#!/bin/sh
# Public bootstrap for https://agent1c.ai/tty.sh
#
# Thin redirect only — install logic lives in agent1c-ai/hedgeytty.
set -eu

INSTALL_URL="${HEDGEYTTY_INSTALL_URL:-https://raw.githubusercontent.com/agent1c-ai/hedgeytty/main/install.sh}"

for command_name in curl bash mktemp; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'hedgeytty: %s is required.\n' "$command_name" >&2
    exit 1
  fi
done

printf 'hedgeytty: fetching installer from %s\n' "$INSTALL_URL" >&2

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT INT TERM

curl -fsSL "$INSTALL_URL" -o "$tmp"

# Prefer the controlling tty for prompts when it is actually usable.
if [ -c /dev/tty ] && { printf '' >/dev/tty; } 2>/dev/null; then
  bash "$tmp" "$@" </dev/tty
else
  bash "$tmp" "$@"
fi
