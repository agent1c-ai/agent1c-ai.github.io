#!/bin/sh
# Public bootstrap for https://agent1c.ai/tty.sh
#
# Thin redirect only — install logic lives in agent1c-ai/hedgeytty.
# Do not duplicate installer steps here; edit that repo's install.sh.
set -eu

INSTALL_URL="${HEDGEYTTY_INSTALL_URL:-https://raw.githubusercontent.com/agent1c-ai/hedgeytty/main/install.sh}"

for command_name in curl sh; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'hedgeytty: %s is required.\n' "$command_name" >&2
    exit 1
  fi
done

printf 'hedgeytty: fetching installer from %s\n' "$INSTALL_URL" >&2

# Prefer a real tty for any prompts the installer may open later.
if [ -r /dev/tty ] && [ -t 1 ]; then
  curl -fsSL "$INSTALL_URL" | sh -s -- "$@" </dev/tty
else
  curl -fsSL "$INSTALL_URL" | sh -s -- "$@"
fi
