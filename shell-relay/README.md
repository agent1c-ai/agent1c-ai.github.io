# Agent1c Shell Relay (Phase 1)

This directory contains the shell-only localhost relay used by Agent1c.

Files:
- `install.sh`: installs relay scripts to `~/.agent1c-relay`
- `agent1c-relay.sh`: starts relay server on loopback
- `handler.sh`: HTTP request handler (`/v1/health`, `/v1/shell/exec`)

Dependencies:
- `socat`
- `jq`

Quick start:

```sh
curl -fsSL https://agent1c.me/shell-relay/install.sh | sh
~/.agent1c-relay/agent1c-relay.sh
```
