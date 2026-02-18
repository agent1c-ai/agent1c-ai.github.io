# PHASE2_PLAN.md

Scope:
- Phase 2a: upgrade native HedgeyOS Browser with relay-backed fallback for CORS-blocked sites.
- Phase 2b: integrate Hitomi (Chat 1) with native HedgeyOS visible actions (browser + WM actions).
- Keep relay architecture deterministic and modular.
- Do not implement speculative side features outside this scope.

Out of scope for this file:
- Phase 2c relay setup UX hardening (persistent service + uninstall flow).

Source context:
- This plan is derived from product discussion after Phase 1 shell relay.
- `agents.md` remains the full long-form project memory.
- This file is the focused execution contract for Phase 2 only.

## 1) Phase split

### Phase 2a (Browser first)

Goal:
- Make the existing native HedgeyOS Browser capable of opening any site:
  - direct iframe/embed path when allowed
  - relay fallback path when direct path fails due to CORS/private-network restrictions

Requirements:
- Keep current Browser UX intact (URL field + Go + iframe render path).
- Add relay fetch fallback only as needed.
- Keep fallback transparent to normal users.
- Log fallback usage/events for debuggability.

### Phase 2b (Agent actions)

Goal:
- Let Hitomi use the native Browser and native WM actions so users can see actions onscreen.
- Hitomi must open the Browser window, set URL, and navigate through native HedgeyOS behavior.

Requirements:
- Browser actions are visible and deterministic.
- WM actions are explicit and deterministic.
- Tool results are injected and grounded before user-facing claims.

## 2) Phase 2b goals

1. Let Hitomi trigger native HedgeyOS desktop actions:
- Tile windows
- Arrange windows
- Focus a specific visible window
- Minimize/restore a window
- Open an app from the Apps list
- List open windows/apps for grounding

2. Keep deterministic, explicit tool-driven execution:
- No natural-language "guess execution" paths.
- Hitomi must emit explicit tool tokens and then ground reply on tool results.

3. Preserve HedgeyOS-native behavior:
- No custom replacement window manager logic.
- Use existing WM APIs and app-launch pathways.

## 3) Proposed tool contract additions (Phase 2b)

Add a WM action tool family in TOOLS:
- `wm_action`

Suggested calls:
- `{{tool:wm_action|action=list_windows}}`
- `{{tool:wm_action|action=tile}}`
- `{{tool:wm_action|action=arrange}}`
- `{{tool:wm_action|action=focus_window|title=Chat}}`
- `{{tool:wm_action|action=minimize_window|title=Files}}`
- `{{tool:wm_action|action=restore_window|title=Files}}`
- `{{tool:wm_action|action=open_app|app=notes}}`

Parser/dispatch rules:
- Parse only explicit `wm_action` calls.
- Validate `action` against strict allowlist.
- Return deterministic `TOOL_RESULT wm_action ...` responses.
- If target window/app is ambiguous, return clear failure and let model ask user.

Document authority rule for Phase 2b rollout:
- Deployed defaults for `SOUL.md`, `TOOLS.md`, and `heartbeat.md` are authoritative.
- On app refresh/reload, local edited versions of those three docs are overwritten by current deployed defaults.
- This is intentional for coordinated behavior updates during active 2b development.

## 4) WM capability mapping (existing HedgeyOS hooks)

Already available in `wm`:
- `tileVisibleWindows()`
- `arrangeVisibleWindows()`
- window focus/minimize/restore via existing state + menu behavior
- `createFilesWindow()`
- `createBrowserWindow()`
- `createNotesWindow()`
- `createTerminalWindow()`
- `createThemesWindow()`
- `createAppWindow(title, url)`

Integration approach:
- Add a thin adapter in Agent1c that calls WM methods.
- Do not re-implement WM layout logic in agent layer.

## 5) Browser integration contract (Phase 2a + 2b)

1. Native Browser is the primary browsing surface.
2. For user and Hitomi browsing requests:
- attempt native direct navigation first
- fallback to relay-backed fetch/proxy only when direct path is blocked
3. Hitomi browsing actions must remain visible:
- open/focus Browser window
- set URL
- trigger native navigation
4. No hidden "background-only fetch" when the request intent is visible browsing.

## 6) Safety boundaries

1. Only Chat 1 controls desktop actions.
2. Every action must write an event log entry.
3. Never claim WM action success without actual call result.
4. Keep shell relay execution isolated from WM actions:
- `wm_action` for desktop/window operations
- `shell_exec` for host OS command operations

## 7) Shell relay roadmap in this phase split

Relay already used for:
- Host OS command execution (`shell_exec`)

Phase 2a planned additional use:
- CORS-safe HTTP bridge/proxy (`/v1/http/fetch`) for:
  - HedgeyOS Browser access to blocked sites
  - Future web tools requiring server-like fetch behavior

Phase 2b planned additional use:
- deterministic browser control actions for Hitomi via native Browser window (not custom renderer).

## 8) Acceptance criteria

1. Phase 2a:
- Native Browser can access sites that direct path blocks by using relay fallback.
- No regression to direct browsing path.

2. Phase 2b:
- Hitomi can visibly open/focus Browser and navigate to requested URL.
- Hitomi can tile/arrange/focus/open/minimize/restore via explicit tool calls.
- Event timeline records requested action and outcome.

3. Global:
- No regressions to existing provider/chat/heartbeat/Telegram flows.
- No HedgeyOS core WM regressions.

## 9) Deferred to Phase 2c (explicit)

Relay setup UX follow-up:
- Add optional persistence step in setup instructions for Linux/Android:
  - install/start as user `systemd` service
  - optional `enable` for startup persistence
- Add clearly marked uninstall path:
  - put uninstall commands in separate tab/section to avoid accidental execution
  - style warning prominently (red/high-contrast caution label)
- macOS note:
  - document that persistence is different (launchd), not systemd
- keep Linux/Android systemd instructions isolated from macOS instructions

### 9.1 Phase 2c progress

- Shell Relay Setup now includes optional persistence/service guidance:
  - Linux: user-level `systemd --user` service install/enable commands.
  - macOS: launchd persistence note.
  - Android: Termux persistence note (Termux services/boot), with explicit private-network caveat.
- Setup also includes optional uninstall commands per platform.
- Shell Relay tab label `Test` is now `Terminal`, with a Unix-like terminal panel:
  - command prompt row
  - scrolling terminal output
  - Enter-to-run support
  - append-style command/result transcript
