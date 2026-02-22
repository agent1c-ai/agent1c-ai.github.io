# Privacy + Sync Contract (Agent1c.me / Agent1c.ai)

Status: Future-direction contract for phased implementation.

## 1) Product Intent

- `agent1c.me` is sovereignty-first.
- `agent1c.ai` is convenience-first.
- Both should expose privacy as explicit, auditable transport modes.

## 2) User Experience Contract

### Agent1c.me

1. User can open and use immediately.
2. User can connect wallet at any time.
3. Once wallet is connected, identity becomes portable across devices.
4. If same identity is active in two tabs/devices, show a "Link Devices?" prompt.
5. On explicit approval, encrypted sync starts.
6. Sync scope includes chat state, settings, and local files.

### Agent1c.ai

1. Default transport is managed cloud relay.
2. User can switch to local relay or local Tor relay options.
3. Privacy controls remain optional and visible in settings.

## 3) Network Transport Modes

Implement one transport abstraction shared by both codebases:

- `cloudflare_worker` (managed cloud relay path)
- `local_relay` (localhost relay)
- `local_tor_relay` (localhost relay routed through Tor SOCKS)

Default behavior:

- `.me`: prefer `local_tor_relay` (with visible fallback states)
- `.ai`: default `cloudflare_worker`

Required state labels:

- `Active`
- `Requested (setup required)`
- `Degraded/Fallback`
- `Offline`

## 4) Privacy Guarantees and Warnings

- Do not claim "Tor active" unless transport verification passes.
- Show explicit warnings when falling back from Tor to direct/local.
- Keep diagnostics visible (origin checks, relay health, transport mode).

## 5) Wallet Identity + Key Derivation

- Wallet acts as user identity anchor and sync authorization primitive.
- Derive sync keys client-side (signature + KDF).
- Never store plaintext sync payloads in GunDB.
- Store only encrypted envelopes and metadata needed for replication.

## 6) GunDB Sync Model

- Goal: encrypted cross-device continuity.
- Primary mode: peer/live sync when both tabs are online.
- Optional persistence mode: encrypted at rest in GunDB.
- Merge model:
  - settings/docs: latest-write with version stamps
  - chat: append-only message timeline
  - files: chunked encrypted blobs + conflict/version metadata

## 7) Device Linking Handshake

When same wallet identity appears in two active tabs:

1. Show "Link Devices?" prompt in both tabs.
2. Require explicit consent from both sides.
3. Exchange ephemeral session keys.
4. Start encrypted replication channel.

If one side denies/cancels, no sync channel is created.

## 8) Phased Implementation Plan

### Phase P1: Transport Foundation

- Add unified transport selector and status model.
- Implement `.me` Tor-preference with clear fallback statuses.
- Keep `.ai` default on cloud relay.

### Phase P2: Wallet Identity

- Add wallet connect/disconnect lifecycle.
- Bind local identity envelope to wallet-derived key material.

### Phase P3: Device Link + Live Sync

- Add two-tab/device detection and consent handshake.
- Implement encrypted live replication for chat/settings/files metadata.

### Phase P4: GunDB Encrypted Persistence

- Add encrypted storage envelopes.
- Add replay/recovery on reconnect.
- Add conflict diagnostics in Events.

### Phase P5: Hardening

- Transport diagnostics panel.
- Privacy warning UX refinement.
- Fault injection tests for fallback correctness.

## 9) Non-Goals (for early phases)

- No unverifiable "full anonymity" claims.
- No hidden background relay mode changes.
- No plaintext sync payloads.

## 10) Success Criteria

- Users can start instantly on `.me` and `.ai`.
- Users can connect wallet and link active tabs with explicit consent.
- Sync works across devices with encrypted payloads.
- Transport mode is always user-visible and truthful.
- `.me` and `.ai` defaults differ, but share one clean transport architecture.
