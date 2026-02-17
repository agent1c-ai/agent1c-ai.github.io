# PHASE2_PLAN.md

Scope:
- Integrate Hitomi (Chat 1) with native HedgeyOS window-manager actions.
- Keep relay architecture ready for expanded non-CORS tooling.
- Do not implement speculative side features outside this scope.

Source context:
- This plan is derived from product discussion after Phase 1 shell relay.
- `agents.md` remains the full long-form project memory.
- This file is the focused execution contract for Phase 2 only.

## 1) Phase 2 goals

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

## 2) Proposed tool contract additions

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

## 3) WM capability mapping (existing HedgeyOS hooks)

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

## 4) Safety boundaries

1. Only Chat 1 controls desktop actions.
2. Every action must write an event log entry.
3. Never claim WM action success without actual call result.
4. Keep shell relay execution isolated from WM actions:
- `wm_action` for desktop/window operations
- `shell_exec` for host OS command operations

## 5) Shell relay "what else" roadmap (beyond shell exec)

Relay already used for:
- Host OS command execution (`shell_exec`)

Planned additional use:
- CORS-safe HTTP bridge/proxy (`/v1/http/fetch`) for:
  - HedgeyOS Browser access to blocked sites
  - Future web tools requiring server-like fetch behavior

## 6) Acceptance criteria

1. Hitomi can tile/arrange/focus/open/minimize/restore via explicit tool calls.
2. WM actions are reliable and reflected in visible UI state.
3. Event timeline records requested action and outcome.
4. No regressions to existing provider/chat/heartbeat/Telegram flows.
5. No HedgeyOS core WM regressions.

