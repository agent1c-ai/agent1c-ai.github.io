# Ollama Setup Scratchpad

## Goal
Define exact copy for an in-app `Ollama Setup` helper window in Agent1c OS.

## Sources Checked
- Ollama Linux docs: `docs/linux.mdx`
- Ollama macOS docs: `docs/macos.mdx`
- Ollama FAQ: `docs/faq.mdx`
- Ollama API docs: `docs/api.md`
- Existing Android-focused flow in `chat.unconnected.ai`

## Confirmed Technical Facts
- Default local endpoint: `http://127.0.0.1:11434`
- Health/model-list endpoint: `GET /api/tags`
- Chat endpoint: `POST /api/chat`
- Browser access from custom domain requires allowing origin(s) via `OLLAMA_ORIGINS`
- macOS app env vars should be set via `launchctl setenv ...` and Ollama app restarted
- Linux service env vars should be set via `systemctl edit ollama.service` with `Environment="..."`, then daemon reload + restart

## Existing chat.unconnected.ai Pattern (for reuse)
- Uses local browser fetch directly to `http://127.0.0.1:11434`
- Uses `/api/tags` for online check
- Uses `/api/chat` for responses
- Provides copyable shell snippets + copy button UX

## Proposed In-App Setup Window Structure
1. Install Ollama
2. Start Ollama
3. Enable browser access for agent1c.me (CORS)
4. Verify local endpoint and model

## Draft User-Facing Copy (for the future setup window)

### Section 1: Install Ollama
Text:
"Install Ollama first. This runs models locally on your machine."

Buttons/links:
- `Open Ollama Download Page`
- URL: `https://ollama.com/download`

Code block (Linux quick install):
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Code block (macOS):
```text
Download Ollama from https://ollama.com/download and drag Ollama.app to Applications.
Open Ollama once so the local server is available.
```

### Section 2: Start Ollama
Text:
"Start the Ollama server. Agent1c connects to it at http://127.0.0.1:11434."

Code block (simple foreground run):
```bash
ollama serve
```

Code block (pull at least one model):
```bash
ollama pull llama3.2:3b
```

Code block (check local models):
```bash
curl http://127.0.0.1:11434/api/tags
```

### Section 3: Allow agent1c.me origin (required for browser calls)
Text:
"Allow your browser origin so Agent1c can call local Ollama directly."

Linux (systemd service) instructions:
1) Edit service override:
```bash
sudo systemctl edit ollama.service
```
2) Add:
```ini
[Service]
Environment="OLLAMA_ORIGINS=https://agent1c.me,https://www.agent1c.me,http://localhost:8000,http://127.0.0.1:8000"
Environment="OLLAMA_HOST=127.0.0.1:11434"
```
3) Reload + restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

macOS (Ollama app) instructions:
```bash
launchctl setenv OLLAMA_ORIGINS "https://agent1c.me,https://www.agent1c.me,http://localhost:8000,http://127.0.0.1:8000"
launchctl setenv OLLAMA_HOST "127.0.0.1:11434"
```
Then:
- Quit and reopen Ollama app.

### Section 4: Verify from Agent1c
Text:
"Test connectivity from this browser session."

Fields:
- Endpoint input (default `http://127.0.0.1:11434`)
- Model input (text)

Button:
- `Test Ollama`

Success condition:
- `/api/tags` returns HTTP 200 and at least one model exists

Failure message mapping:
- Network error: "Cannot reach local Ollama. Is `ollama serve` running?"
- CORS error: "Origin not allowed. Add this site to OLLAMA_ORIGINS and restart Ollama."
- Empty model list: "Ollama is running, but no models are installed. Pull a model first."

## UX Notes
- Keep setup content copy-first and beginner-friendly.
- Every code block should have a `Copy` button.
- Add a small “What this command does” line under each block.
- Include “Show Linux / Show macOS” toggle tabs in the setup window.
- Keep this setup window as guidance only; final connection status is shown in the `AI APIs` provider card.

## Non-Goals for this pass
- No local proxy setup yet
- No Windows flow yet (can be added later)
- No automatic shell execution from browser
