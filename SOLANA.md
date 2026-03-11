# Solana Integration Plan

This note captures the intended read-only Solana integration plan for Agent1c.ai so future passes can recover the design quickly if context is lost.

## Goal

Integrate Solana into Hitomi in a read-only way so she can:

- see the balance of the connected wallet
- see recent transactions
- summarize recent wallet activity in plain English

The authenticated Supabase Solana login already provides the connected wallet's public address. That address should be treated as the canonical wallet identity for the current workspace session.

This pass is read-only only.

Do not imply or add:

- signing
- sending
- approving
- swapping
- custody
- private-key access

## Architecture Split

Use the existing separation between `SOUL.md`, `TOOLS.md`, and `heartbeat.md`.

### `SOUL.md`

`SOUL.md` should define how Hitomi thinks and talks about wallet data, not how she fetches it.

The Solana additions to `SOUL.md` should teach Hitomi:

- a connected Solana wallet is part of the user's current workspace context
- she may help inspect balances and recent transactions
- wallet access in this environment is read-only unless a tool proves otherwise
- she must never pretend she refreshed wallet data unless a tool result confirms it
- she must never imply she controls funds or private keys

Planned text:

```md
## Wallet Awareness

If the user is authenticated with a connected Solana wallet, treat that wallet as part of the user's current workspace context.

You may help the user:
- check the wallet's SOL balance
- inspect recent wallet transactions
- summarize recent wallet activity in plain English

Rules:
- Wallet access in this environment is read-only unless a tool explicitly proves otherwise.
- Never imply you can sign, send, approve, swap, or move funds.
- Never imply custody of the wallet or control over private keys.
- Never claim a balance or transaction refresh happened unless a matching tool result confirms it.
- If wallet data is unavailable or stale, say so plainly and refresh using the appropriate tool before answering.
- Use the connected wallet address from workspace/runtime context as the canonical wallet unless the user explicitly asks about a different public address and a tool supports that.
```

### `TOOLS.md`

`TOOLS.md` should define the explicit wallet capabilities. This is where the real feature contract belongs.

Planned additions:

```md
8. solana_wallet_overview
- Returns a read-only summary of the connected Solana wallet.
- Default behavior uses the authenticated wallet address from current session context.
- Optional arg: address (public address only, if explicitly supported by runtime).
- Returns:
  - address
  - balance_sol
  - lamports
  - fetched_at
  - rpc_source
  - recent_transactions (brief list)

9. solana_wallet_refresh
- Refreshes the connected Solana wallet state from Solana RPC.
- Default behavior uses the authenticated wallet address from current session context.
- Optional arg: address (public address only, if explicitly supported by runtime).
- Returns:
  - address
  - balance_sol
  - lamports
  - fetched_at
  - rpc_source
  - recent_transactions
  - refresh=true

Wallet rules:
- Use these tools for wallet balance or recent transaction questions instead of guessing.
- Treat these tools as read-only.
- Never claim transaction intent, simulation, or signing capability from these tools.
- If the user asks about "my wallet", prefer the connected authenticated wallet from runtime context.
- If no wallet is connected, say so clearly.
```

Possible later addition, not required for v1:

```md
10. solana_transaction_details
- Args: signature
- Returns a richer breakdown for one specific transaction signature.
```

### `heartbeat.md`

`heartbeat.md` should stay minimal and should not turn into chain polling.

Planned additions:

```md
5. If a Solana wallet-auth session has just been established and wallet context has not yet been loaded, perform one wallet refresh and store the result.
6. Do not repeatedly poll wallet state in the background.
7. If the user is actively asking about wallet status and the last wallet snapshot is stale, refresh once before answering.
8. Otherwise avoid wallet-related chatter.
```

## JS Runtime Plan

The runtime should do the real Solana work. `SOUL.md` and `heartbeat.md` should not absorb RPC logic.

### Canonical identity source

Use the authenticated identity parser in `js/agent1cauth.js` as the canonical source for:

- provider
- wallet address

Always prefer the structured authenticated wallet address over any label matching or UI scraping.

### Runtime state

Add an explicit wallet state bucket in `js/agent1c.js` or closely related runtime state:

- `wallet.address`
- `wallet.chain`
- `wallet.provider`
- `wallet.balanceSol`
- `wallet.lamports`
- `wallet.recentTransactions`
- `wallet.lastFetchedAt`
- `wallet.rpcSource`
- `wallet.refreshInFlight`
- `wallet.lastError`

This gives both Hitomi and the UI one stable source of truth.

### New Solana read module

Add a dedicated Solana read module, likely:

- `js/solana-wallet.js`

Responsibilities:

- normalize wallet address input
- call Solana RPC for balance
- call Solana RPC for recent signatures
- fetch parsed recent transactions when needed
- normalize the result into one stable runtime shape

Keep Solana RPC logic out of `agent1c.js` as much as possible. `agent1c.js` should orchestrate, not absorb chain details.

### New JS runtime tools

Add these to `js/agent1c-tools-runtime.js`.

#### `solana_wallet_overview`

Purpose:

- return the current cached wallet snapshot if available
- fetch once if no snapshot exists yet
- power common asks like "what is my balance?" and "show recent transactions"

Expected behavior:

- resolve canonical wallet address from authenticated runtime identity
- if missing, return a clear tool result saying no connected Solana wallet is available
- otherwise return a structured wallet summary

Suggested result shape:

```text
TOOL_RESULT solana_wallet_overview:
address=...
balance_sol=...
lamports=...
fetched_at=...
rpc_source=...
recent_transactions:
- signature=...
  status=...
  block_time=...
  net_sol_change=...
- ...
```

#### `solana_wallet_refresh`

Purpose:

- force a live RPC read
- update the runtime cache
- support explicit "refresh" or stale-context situations

Expected behavior:

- same canonical wallet resolution rules
- perform live Solana RPC reads
- overwrite cached wallet state
- return the same payload as overview, but marked refreshed

Suggested result shape:

```text
TOOL_RESULT solana_wallet_refresh:
address=...
balance_sol=...
lamports=...
fetched_at=...
rpc_source=...
refresh=true
recent_transactions:
- signature=...
  status=...
  block_time=...
  net_sol_change=...
- ...
```

Optional later tool:

#### `solana_transaction_details`

Purpose:

- explain one specific signature in more detail

Not required for first ship.

## RPC Scope for v1

Keep the first shipping pass intentionally narrow:

- native SOL balance
- recent transaction signatures
- recent parsed transaction summaries

Do not include in v1:

- SPL token portfolio
- NFTs
- DeFi positions
- transaction simulation
- transfers
- swaps
- any signing behavior

This should stay truly read-only and low risk.

## UI Plan

V1 does not require a large new wallet UI before agent integration works.

Acceptable initial UX:

- after wallet-auth login, fetch one wallet snapshot
- optionally show wallet address and balance in an account/credits area
- let Hitomi answer from the same state or trigger a refresh tool

Later, a dedicated wallet panel or wallet summary window can be added.

## Expected Agent Capabilities After This

Hitomi should be able to answer:

- "What's my wallet balance?"
- "Show my recent Solana transactions."
- "Did anything hit my wallet recently?"
- "Summarize the last 5 transactions."
- "Which wallet am I connected with?"

She should answer in a safe way, for example:

- "Your connected Solana wallet currently has X SOL."
- "I found these recent transactions on your connected wallet."
- "I can inspect recent wallet activity, but I cannot move funds or sign transactions from here."

## Guardrails

Keep these rules throughout implementation:

- Always use the canonical wallet address from authenticated identity first.
- Never use label matching as the primary production logic.
- Keep behavior guidance in `SOUL.md`, tool contracts in `TOOLS.md`, and refresh cadence in `heartbeat.md`.
- Do not let `heartbeat.md` become aggressive polling.
- Do not let Hitomi imply transaction execution ability when only read ability exists.

## Implementation Order

1. Canonicalize the connected Solana wallet address into runtime state after auth.
2. Add a dedicated read-only Solana RPC module.
3. Add cached wallet state to app state.
4. Add `solana_wallet_overview` and `solana_wallet_refresh` to the JS tool runtime.
5. Extend the default `TOOLS.md` template with the Solana tool contracts.
6. Extend the default `SOUL.md` template with read-only wallet-awareness guidance.
7. Extend the default `heartbeat.md` template with one-time post-login refresh guidance.
8. Optionally add a visible wallet summary in the UI after agent behavior works.
