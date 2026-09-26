#!/bin/sh
# Public bootstrap for https://agent1c.ai/tty.sh
#
# Thin redirect only — install logic lives in agent1c-ai/hedgeytty.
# Do not duplicate installer steps here; edit that repo's install.sh.
#
# IMPORTANT: install.sh is bash. Never pipe it to dash/sh.
# Also never do `curl | bash -s </dev/tty` — that detaches bash from the
# pipe so curl hits error 23 (write failed / EPIPE).
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

# Stdin from the real tty so sudo/gpm prompts work; script is the file, not the pipe.
if [ -r /dev/tty ]; then
  bash "$tmp" "$@" </dev/tty
else
  bash "$tmp" "$@"
fi
