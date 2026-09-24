#!/bin/sh
# Public bootstrap for https://agent1c.ai/tmux1c.sh
set -eu

# Pin the published runtime; update the commit and hashes together for a release.
base_url=https://raw.githubusercontent.com/Decentricity/tmux1c/6e49a9a5d4b8b3931c433eb225baf795efb5c07d

for command_name in curl bash mktemp; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'tmux1c: %s is required to install 1c.\n' "$command_name" >&2
    exit 1
  fi
done
if command -v sha256sum >/dev/null 2>&1; then
  hash_command=sha256sum
elif command -v shasum >/dev/null 2>&1; then
  hash_command=shasum
else
  printf '%s\n' 'tmux1c: sha256sum or shasum is required to verify downloads.' >&2
  exit 1
fi

download_dir=$(mktemp -d) || exit 1
trap 'rm -rf "$download_dir"' EXIT HUP INT TERM

while read -r expected_hash relative_path; do
  [ -n "$expected_hash" ] || continue
  case $relative_path in
    */*) mkdir -p "$download_dir/${relative_path%/*}" ;;
  esac
  printf 'Downloading %s...\n' "$relative_path"
  curl -fsSL --retry 2 "$base_url/$relative_path" -o "$download_dir/$relative_path"
  if [ "$hash_command" = sha256sum ]; then
    actual_hash=$(sha256sum "$download_dir/$relative_path")
  else
    actual_hash=$(shasum -a 256 "$download_dir/$relative_path")
  fi
  actual_hash=${actual_hash%% *}
  if [ "$actual_hash" != "$expected_hash" ]; then
    printf 'tmux1c: checksum mismatch for %s; installation stopped.\n' "$relative_path" >&2
    exit 1
  fi
done <<'CHECKSUMS'
56d6a79ff63a61594b811379d0874c093d49c5153a5947113a444e96f78daea4 install.sh
92beea4c089772bb7222ff349e61022e8c7adbce72983f1d8bd59487d8230d9c first-run.sh
60f558f8014f4d9e9e229b39ccbff2ff6b418ff8bb8195cd7552e4a989292bb1 bin/1c
dc2c9c18dfde8c733818e1cf065839c86f626991b69e43e593110376251299e3 lib/platform.sh
CHECKSUMS

# The pipe supplies the bootstrap's stdin. Give the setup prompts a real tty.
if [ -r /dev/tty ] && [ -t 1 ]; then
  bash "$download_dir/install.sh" </dev/tty
else
  bash "$download_dir/install.sh"
fi
