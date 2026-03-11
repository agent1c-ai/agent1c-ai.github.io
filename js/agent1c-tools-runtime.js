export function createAgent1cToolsRuntime(deps){
  const {
    appState,
    previewProviderState,
    pendingSoulReanchorThreadIds,
    soulReanchorEveryUserTurns,
    getWmRef,
    addEvent,
    providerChat,
    listFiles,
    readFileBlob,
    readNoteText,
    normalizeOllamaBaseUrl,
    normalizeRelayConfig,
    runShellExecTool,
    refreshConnectedWalletState,
  } = deps || {}

  function buildSystemPromptWithCadence({ includeSoul } = {}){
    const soul = String(appState?.agent?.soulMd || "").trim()
    const tools = String(appState?.agent?.toolsMd || "").trim()
    const walletAddress = String(appState?.wallet?.address || "").trim()
    const walletContext = walletAddress
      ? `Runtime note: the user is connected with Solana wallet "${walletAddress}". You may use TOOLS if you need to inspect this wallet further, including checking balances and recent transactions.`
      : ""
    const hardPolicy = [
      "Tool policy:",
      "- Follow TOOLS.md exactly.",
      "- Keep tool use minimal and evidence-based.",
      "- Never claim tool outcomes without matching TOOL_RESULT.",
      "Interaction policy:",
      "- Keep replies to one or two sentences unless impossible.",
      "- Ask at most one follow-up question, and only when truly blocked.",
      "- Never offer multiple options in one question.",
      "- Use single-action confirmations, for example: I can do <one action> now. Should I proceed?",
      "- Avoid option lists like A or B.",
    ].join("\n")
    const parts = []
    if (includeSoul && soul) parts.push(soul)
    if (tools) parts.push(tools)
    if (walletContext) parts.push(walletContext)
    parts.push(hardPolicy)
    return parts.join("\n\n")
  }

  function userTurnCount(messages){
    return (messages || []).filter(m => String(m?.role || "") === "user").length
  }

  function shouldInjectSoulForTurn({ threadId, messages, forceSoulReanchor } = {}){
    if (forceSoulReanchor) return true
    const id = String(threadId || "").trim()
    if (!id) return false
    if (pendingSoulReanchorThreadIds?.has(id)) {
      pendingSoulReanchorThreadIds.delete(id)
      return true
    }
    const turns = userTurnCount(messages || [])
    if (turns <= 1) return true
    return turns % Number(soulReanchorEveryUserTurns || 5) === 0
  }

  function parseToolCalls(text){
    const calls = []
    const re = /\{\{\s*tool:([a-z_][a-z0-9_]*)(?:(?:\|([^}]+))|(?:\s+([^}]+)))?\s*\}\}/gi
    let m
    while ((m = re.exec(text))) {
      calls.push({
        name: String(m[1] || "").toLowerCase(),
        args: parseToolArgs(m[2] || m[3] || ""),
      })
    }
    return calls
  }

  function stripToolCalls(text){
    return String(text || "").replace(/\{\{\s*tool:[^}]+\}\}/gi, "").trim()
  }

  function parseToolArgs(raw){
    const args = {}
    const source = String(raw || "").trim()
    if (!source) return args
    const pattern = /([a-z_][a-z0-9_]*)\s*=\s*("([^"]*)"|'([^']*)'|[^|]+)/gi
    let matched = false
    let m
    while ((m = pattern.exec(source))) {
      const key = String(m[1] || "").trim().toLowerCase()
      const value = String(m[3] ?? m[4] ?? m[2] ?? "")
        .trim()
        .replace(/^["']|["']$/g, "")
      if (!key || !value) continue
      args[key] = value
      matched = true
    }
    if (!matched && source.includes("=")) {
      const [k, ...rest] = source.split("=")
      const key = String(k || "").trim().toLowerCase()
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "")
      if (key && value) args[key] = value
    }
    return args
  }

  function extensionFromName(name){
    const n = String(name || "")
    const i = n.lastIndexOf(".")
    if (i < 0 || i === n.length - 1) return ""
    return n.slice(i + 1).toLowerCase()
  }

  function normalizeText(value){
    return String(value || "").toLowerCase()
  }

  function latestUserText(messages){
    const list = Array.isArray(messages) ? messages : []
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i]?.role === "user") return String(list[i]?.content || "")
    }
    return ""
  }

  function asksForFileList(text){
    const t = normalizeText(text)
    return /(list|show|what|which|see|display)\b[\s\S]{0,40}\b(files?|filenames?|docs?|documents?)/i.test(t)
  }

  function asksToReadFile(text){
    const t = normalizeText(text)
    return /(open|read|view|inspect|summarize|analy[sz]e|echo|print)\b[\s\S]{0,60}\b(file|doc|document|script|csv|txt|md|xlsx|docx|json|xml|log)/i.test(t)
  }

  function inferWindowAction(text){
    const t = normalizeText(text)
    if (!t) return ""
    if (/\b(arrange|organi[sz]e|organize)\b[\s\S]{0,24}\b(windows?|desktop)\b/i.test(t)) return "arrange"
    if (/\b(tile)\b[\s\S]{0,24}\b(windows?|desktop)\b/i.test(t)) return "tile"
    return ""
  }

  function isLikelyText(record){
    const type = String(record?.type || "").toLowerCase()
    if (type.startsWith("text/")) return true
    if (type.includes("json") || type.includes("xml") || type.includes("yaml") || type.includes("csv")) return true
    const ext = extensionFromName(record?.name || "")
    return ["md", "txt", "csv", "json", "xml", "yaml", "yml", "log", "js", "ts", "jsx", "tsx", "html", "css", "py", "sh"].includes(ext)
  }

  function toBase64FromBytes(bytes){
    let raw = ""
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      raw += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    return btoa(raw)
  }

  async function findFileFromToolArgs(args){
    const files = await listFiles()
    const id = String(args?.id || "").trim().replace(/^\{+|\}+$/g, "")
    const name = String(args?.name || "").trim()
    if (id) {
      const byId = files.find(file => String(file?.id || "") === id)
      if (byId) return byId
    }
    if (name) {
      const exact = files.find(file => String(file?.name || "") === name)
      if (exact) return exact
      const folded = name.toLowerCase()
      const caseInsensitive = files.find(file => String(file?.name || "").toLowerCase() === folded)
      if (caseInsensitive) return caseInsensitive
    }
    return null
  }

  async function inferReadTargetFromUser(messages){
    const userText = latestUserText(messages)
    if (!userText) return null
    const files = await listFiles()
    const textLower = userText.toLowerCase()
    for (const file of files) {
      const name = String(file?.name || "").trim()
      if (!name) continue
      if (textLower.includes(name.toLowerCase())) return file
    }
    const m = /\b([a-z0-9._-]+\.[a-z0-9]{2,8})\b/i.exec(userText)
    if (!m) return null
    const wanted = String(m[1] || "").toLowerCase()
    return files.find(file => String(file?.name || "").toLowerCase() === wanted) || null
  }

  function excerptTextForModel(text, fileLabel){
    const maxChars = 12000
    const headChars = 6000
    const tailChars = 4000
    const full = String(text || "")
    if (full.length <= maxChars) {
      return `TOOL_RESULT read_file (${fileLabel}):\n${full}`
    }
    const head = full.slice(0, headChars)
    const tail = full.slice(-tailChars)
    return `TOOL_RESULT read_file (${fileLabel}): file is large (${full.length} chars). Showing head/tail excerpt.\n[HEAD]\n${head}\n[...]\n[TAIL]\n${tail}`
  }

  async function readFileForModel(file){
    if (!file?.id) return "TOOL_RESULT read_file: file not found"
    const fileLabel = `${String(file.name || "unnamed")} | id=${String(file.id)} | type=${String(file.type || "unknown")} | size=${Number(file.size || 0)}`
    if (file.kind === "note") {
      const noteText = await readNoteText(file.id)
      return excerptTextForModel(noteText || "", fileLabel)
    }
    const loaded = await readFileBlob(file.id)
    if (!loaded?.blob || !loaded?.record) return "TOOL_RESULT read_file: could not load file blob"
    const { record, blob } = loaded
    if (isLikelyText(record)) {
      const text = await blob.text()
      return excerptTextForModel(text, fileLabel)
    }
    const size = Number(record.size || blob.size || 0)
    const headBytes = 2048
    const tailBytes = 2048
    const headBuf = await blob.slice(0, Math.min(size, headBytes)).arrayBuffer()
    const tailStart = Math.max(0, size - tailBytes)
    const tailBuf = await blob.slice(tailStart, size).arrayBuffer()
    const headB64 = toBase64FromBytes(new Uint8Array(headBuf))
    const tailB64 = toBase64FromBytes(new Uint8Array(tailBuf))
    const ext = extensionFromName(record.name || "")
    if (ext === "xlsx") {
      return `TOOL_RESULT read_file (${fileLabel}): binary XLSX container. Returning sampled base64 bytes for model-side interpretation.\n[HEAD_BASE64]\n${headB64}\n[...]\n[TAIL_BASE64]\n${tailB64}`
    }
    return `TOOL_RESULT read_file (${fileLabel}): non-text file. Returning sampled base64 bytes.\n[HEAD_BASE64]\n${headB64}\n[...]\n[TAIL_BASE64]\n${tailB64}`
  }

  function excerptForToolText(text, maxChars = 6000){
    const full = String(text || "")
    if (full.length <= maxChars) return full
    const head = full.slice(0, 3500)
    const tail = full.slice(-1800)
    return `${head}\n[...]\n${tail}`
  }

  function formatSolanaToolResult(name, walletState, { refreshed = false } = {}){
    const state = walletState && typeof walletState === "object" ? walletState : {}
    const address = String(state.address || "").trim()
    if (!address) return `TOOL_RESULT ${name}: no connected Solana wallet`
    const balanceSol = Number.isFinite(Number(state.balanceSol)) ? Number(state.balanceSol) : null
    const lamports = Number.isFinite(Number(state.lamports)) ? Number(state.lamports) : null
    const fetchedAt = String(state.fetchedAt || state.lastFetchedAt || "").trim()
    const rpcSource = String(state.rpcSource || "").trim()
    const lastError = String(state.lastError || "").trim()
    const txs = Array.isArray(state.recentTransactions) ? state.recentTransactions : []
    const lines = [
      `TOOL_RESULT ${name}:`,
      `address=${address}`,
      `balance_sol=${balanceSol === null ? "" : balanceSol}`,
      `lamports=${lamports === null ? "" : lamports}`,
      `fetched_at=${fetchedAt}`,
      `rpc_source=${rpcSource}`,
    ]
    if (refreshed) lines.push("refresh=true")
    if (lastError) lines.push(`error=${lastError}`)
    if (!txs.length) {
      lines.push("recent_transactions: none")
      return lines.join("\n")
    }
    lines.push("recent_transactions:")
    for (const tx of txs.slice(0, 5)) {
      lines.push(`- signature=${String(tx?.signature || "").trim()}`)
      lines.push(`  status=${String(tx?.confirmationStatus || "").trim() || (tx?.ok ? "confirmed" : "failed")}`)
      lines.push(`  block_time=${String(tx?.blockTime || "").trim()}`)
      lines.push(`  net_sol_change=${Number.isFinite(Number(tx?.netSol)) ? Number(tx.netSol) : 0}`)
    }
    return lines.join("\n")
  }

  async function wikiSearchTool(query){
    const q = String(query || "").trim()
    if (!q) return "TOOL_RESULT wiki_search: missing query"
    const url = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=5`
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    })
    if (!response.ok) return `TOOL_RESULT wiki_search: request failed (${response.status})`
    const json = await response.json().catch(() => null)
    const pages = Array.isArray(json?.pages) ? json.pages : []
    if (!pages.length) return `TOOL_RESULT wiki_search (${q}): no results`
    const rows = pages.slice(0, 5).map((page, i) => {
      const title = String(page?.title || "untitled")
      const desc = String(page?.description || page?.excerpt || "").replace(/<[^>]+>/g, "").trim()
      return `${i + 1}. ${title}${desc ? ` - ${desc}` : ""}`
    })
    return `TOOL_RESULT wiki_search (${q}):\n${rows.join("\n")}`
  }

  async function wikiSummaryTool(title){
    const t = String(title || "").trim()
    if (!t) return "TOOL_RESULT wiki_summary: missing title"
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    })
    if (!response.ok) return `TOOL_RESULT wiki_summary (${t}): request failed (${response.status})`
    const json = await response.json().catch(() => null)
    const resolvedTitle = String(json?.title || t)
    const extract = String(json?.extract || "").trim()
    const pageUrl = String(json?.content_urls?.desktop?.page || "")
    if (!extract) return `TOOL_RESULT wiki_summary (${resolvedTitle}): no summary text`
    const body = excerptForToolText(extract, 5000)
    return `TOOL_RESULT wiki_summary (${resolvedTitle}):\n${body}${pageUrl ? `\nSource: ${pageUrl}` : ""}`
  }

  function parseRepoParts(text){
    const source = String(text || "")
    const match = source.match(/\b([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\b/)
    if (!match) return null
    return { owner: match[1], repo: match[2] }
  }

  function parseFirstNumberAfter(text, keyword){
    const source = String(text || "")
    const re = new RegExp(`\\b(?:${keyword})\\b\\s*#?\\s*(\\d+)\\b`, "i")
    const match = source.match(re)
    return match ? Number(match[1]) : null
  }

  function parsePathAfterKeyword(text, keyword){
    const source = String(text || "")
    const re = new RegExp(`\\b(?:${keyword})\\b\\s*[:=]?\\s*([^\\n]+)$`, "i")
    const match = source.match(re)
    if (!match) return ""
    return String(match[1] || "").trim().replace(/^["']|["']$/g, "")
  }

  function fromBase64Utf8(value){
    const raw = atob(String(value || ""))
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  }

  async function githubGetJson(path){
    const response = await fetch(`https://api.github.com${path}`, {
      headers: { Accept: "application/vnd.github+json" },
    })
    const json = await response.json().catch(() => null)
    if (!response.ok) {
      const message = String(json?.message || "").trim()
      return { ok: false, status: response.status, json, message }
    }
    return { ok: true, status: response.status, json }
  }

  async function githubRepoReadTool(args){
    const request = String(args?.request || "").trim()
    const repoArg = String(args?.repo || "").trim()
    const pathArg = String(args?.path || "").trim()
    const branchArg = String(args?.branch || "").trim()
    const issueArg = String(args?.issue || "").trim()
    const prArg = String(args?.pr || "").trim()
    const merged = [request, repoArg, pathArg].filter(Boolean).join(" ")
    const repoParts = repoArg ? parseRepoParts(repoArg) : parseRepoParts(merged)
    if (!repoParts) {
      const q = request || repoArg || pathArg
      if (!q) return "TOOL_RESULT github_repo_read: missing request"
      const search = await githubGetJson(`/search/repositories?q=${encodeURIComponent(q)}&per_page=5`)
      if (!search.ok) return `TOOL_RESULT github_repo_read: search failed (${search.status})${search.message ? `: ${search.message}` : ""}`
      const rows = (Array.isArray(search.json?.items) ? search.json.items : []).slice(0, 5).map((item, i) => {
        const full = String(item?.full_name || "unknown/unknown")
        const desc = String(item?.description || "").trim()
        return `${i + 1}. ${full}${desc ? ` - ${desc}` : ""}`
      })
      return rows.length
        ? `TOOL_RESULT github_repo_read search (${q}):\n${rows.join("\n")}`
        : `TOOL_RESULT github_repo_read search (${q}): no repositories found`
    }
    const repoFull = `${repoParts.owner}/${repoParts.repo}`
    const issueNum = issueArg ? Number(issueArg) : parseFirstNumberAfter(request, "issue")
    const prNum = prArg ? Number(prArg) : parseFirstNumberAfter(request, "pr|pull request|pull")
    const pathText = pathArg || parsePathAfterKeyword(request, "path|file")
    if (issueNum) {
      const issue = await githubGetJson(`/repos/${repoFull}/issues/${issueNum}`)
      if (!issue.ok) return `TOOL_RESULT github_repo_read (${repoFull} issue ${issueNum}): failed (${issue.status})${issue.message ? `: ${issue.message}` : ""}`
      const title = String(issue.json?.title || "")
      const state = String(issue.json?.state || "")
      const body = excerptForToolText(String(issue.json?.body || "").trim(), 4500)
      return `TOOL_RESULT github_repo_read (${repoFull} issue ${issueNum}): ${title} [${state}]\n${body}`
    }
    if (prNum) {
      const pr = await githubGetJson(`/repos/${repoFull}/pulls/${prNum}`)
      if (!pr.ok) return `TOOL_RESULT github_repo_read (${repoFull} PR ${prNum}): failed (${pr.status})${pr.message ? `: ${pr.message}` : ""}`
      const title = String(pr.json?.title || "")
      const state = String(pr.json?.state || "")
      const body = excerptForToolText(String(pr.json?.body || "").trim(), 4500)
      return `TOOL_RESULT github_repo_read (${repoFull} PR ${prNum}): ${title} [${state}]\n${body}`
    }
    if (pathText) {
      const refQuery = branchArg ? `?ref=${encodeURIComponent(branchArg)}` : ""
      const content = await githubGetJson(`/repos/${repoFull}/contents/${encodeURIComponent(pathText).replaceAll("%2F", "/")}${refQuery}`)
      if (!content.ok) return `TOOL_RESULT github_repo_read (${repoFull} path ${pathText}): failed (${content.status})${content.message ? `: ${content.message}` : ""}`
      if (Array.isArray(content.json)) {
        const rows = content.json.slice(0, 20).map((item, i) => `${i + 1}. ${String(item?.name || "")} | type=${String(item?.type || "unknown")}`)
        return `TOOL_RESULT github_repo_read (${repoFull} path ${pathText}): directory listing\n${rows.join("\n")}`
      }
      const name = String(content.json?.name || pathText)
      const kind = String(content.json?.type || "file")
      const enc = String(content.json?.encoding || "")
      const rawContent = enc === "base64" ? fromBase64Utf8(String(content.json?.content || "").replace(/\s+/g, "")) : String(content.json?.content || "")
      const excerpt = excerptForToolText(rawContent, 7000)
      return `TOOL_RESULT github_repo_read (${repoFull} path ${name}): type=${kind}\n${excerpt}`
    }
    const repo = await githubGetJson(`/repos/${repoFull}`)
    if (!repo.ok) return `TOOL_RESULT github_repo_read (${repoFull}): failed (${repo.status})${repo.message ? `: ${repo.message}` : ""}`
    const desc = String(repo.json?.description || "").trim()
    const stars = Number(repo.json?.stargazers_count || 0)
    const forks = Number(repo.json?.forks_count || 0)
    const lang = String(repo.json?.language || "unknown")
    const updated = String(repo.json?.updated_at || "")
    return `TOOL_RESULT github_repo_read (${repoFull}):\nDescription: ${desc || "none"}\nStars: ${stars}\nForks: ${forks}\nLanguage: ${lang}\nUpdated: ${updated}`
  }

  async function maybeInjectAutoToolResults(messages){
    const text = latestUserText(messages).trim()
    if (!text) return []
    const out = []
    const wmAction = inferWindowAction(text)
    if (wmAction) out.push(await runToolCall({ name: "wm_action", args: { action: wmAction } }))
    if (asksForFileList(text)) out.push(await runToolCall({ name: "list_files", args: {} }))
    const explicitTarget = await inferReadTargetFromUser(messages)
    if (explicitTarget && asksToReadFile(text)) out.push(await readFileForModel(explicitTarget))
    return out
  }

  async function runToolCall(call){
    if (call.name === "list_files") {
      const files = await listFiles()
      const rows = files
        .filter(file => String(file?.name || "").trim())
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
        .map((file, i) => `${i + 1}. ${file.name} | id=${file.id} | kind=${file.kind || "file"} | type=${file.type || "unknown"} | size=${Number(file.size || 0)}`)
      if (!rows.length) return "TOOL_RESULT list_files: no files"
      return `TOOL_RESULT list_files:\n${rows.join("\n")}`
    }
    if (call.name === "read_file") {
      const file = await findFileFromToolArgs(call.args || {})
      if (!file) return "TOOL_RESULT read_file: file not found. Run list_files and retry with exact name or id."
      return readFileForModel(file)
    }
    if (call.name === "wiki_search") return wikiSearchTool(call.args?.query || "")
    if (call.name === "wiki_summary") return wikiSummaryTool(call.args?.title || "")
    if (call.name === "github_repo_read") return githubRepoReadTool(call.args || {})
    if (call.name === "solana_wallet_overview") {
      const walletState = appState?.wallet || {}
      if (!String(walletState.address || "").trim()) return "TOOL_RESULT solana_wallet_overview: no connected Solana wallet"
      if (!String(walletState.lastFetchedAt || "").trim()) {
        await refreshConnectedWalletState?.()
      }
      return formatSolanaToolResult("solana_wallet_overview", appState?.wallet || {})
    }
    if (call.name === "solana_wallet_refresh") {
      const walletState = appState?.wallet || {}
      if (!String(walletState.address || "").trim()) return "TOOL_RESULT solana_wallet_refresh: no connected Solana wallet"
      await refreshConnectedWalletState?.({ force: true })
      return formatSolanaToolResult("solana_wallet_refresh", appState?.wallet || {}, { refreshed: true })
    }
    if (call.name === "shell_exec") {
      return runShellExecTool({
        args: call.args || {},
        relayConfig: normalizeRelayConfig(appState?.config),
        addEvent,
        excerptForToolText,
      })
    }
    if (call.name === "wm_action") {
      const args = call.args || {}
      const rawAction = String(args.action || "").trim().toLowerCase()
      const actionMap = {
        tilewindows: "tile",
        tile_visible_windows: "tile",
        tile_visible: "tile",
        arrangewindows: "arrange",
        arrange_windows: "arrange",
        arrange_visible_windows: "arrange",
        arrangevisiblewindows: "arrange",
        focus: "focus_window",
        minimize: "minimize_window",
        restore: "restore_window",
        openapp: "open_app",
        openurl: "open_url",
        listwindows: "list_windows",
        listapps: "list_apps",
      }
      const action = actionMap[rawAction.replace(/[^a-z0-9_]/g, "")] || rawAction
      if (!action) return "TOOL_RESULT wm_action: missing action"
      const wmRef = getWmRef?.() || null
      if (!wmRef) return `TOOL_RESULT wm_action ${action}: window manager unavailable`
      const rows = wmRef.listWindows?.() || []
      const findByTitle = (value) => {
        const needle = String(value || "").trim().toLowerCase()
        if (!needle) return null
        const exact = rows.find(w => String(w.title || "").trim().toLowerCase() === needle)
        if (exact) return exact
        return rows.find(w => String(w.title || "").toLowerCase().includes(needle)) || null
      }
      if (action === "list_windows") {
        if (!rows.length) return "TOOL_RESULT wm_action list_windows: no windows"
        const list = rows.map((w, i) => `${i + 1}. ${w.title} | id=${w.id} | minimized=${w.minimized ? "yes" : "no"} | kind=${w.kind || "window"}`)
        return `TOOL_RESULT wm_action list_windows:\n${list.join("\n")}`
      }
      if (action === "list_apps") {
        const apps = wmRef.listAvailableApps?.() || []
        if (!apps.length) return "TOOL_RESULT wm_action list_apps: no apps"
        const list = apps.map((app, i) => `${i + 1}. ${app.title} | id=${app.id} | source=${app.source}`)
        return `TOOL_RESULT wm_action list_apps:\n${list.join("\n")}`
      }
      if (action === "tile") {
        wmRef.tileVisibleWindows?.()
        await addEvent("wm_action", "tile")
        return "TOOL_RESULT wm_action tile: ok"
      }
      if (action === "arrange") {
        wmRef.arrangeVisibleWindows?.()
        await addEvent("wm_action", "arrange")
        return "TOOL_RESULT wm_action arrange: ok"
      }
      if (action === "focus_window") {
        const target = findByTitle(args.title || args.window || args.name)
        if (!target) return "TOOL_RESULT wm_action focus_window: window not found"
        wmRef.restore?.(target.id)
        wmRef.focus?.(target.id)
        await addEvent("wm_action", `focus ${target.title}`)
        return `TOOL_RESULT wm_action focus_window: ok (${target.title})`
      }
      if (action === "minimize_window") {
        const target = findByTitle(args.title || args.window || args.name)
        if (!target) return "TOOL_RESULT wm_action minimize_window: window not found"
        wmRef.minimize?.(target.id)
        await addEvent("wm_action", `minimize ${target.title}`)
        return `TOOL_RESULT wm_action minimize_window: ok (${target.title})`
      }
      if (action === "restore_window") {
        const target = findByTitle(args.title || args.window || args.name)
        if (!target) return "TOOL_RESULT wm_action restore_window: window not found"
        wmRef.restore?.(target.id)
        wmRef.focus?.(target.id)
        await addEvent("wm_action", `restore ${target.title}`)
        return `TOOL_RESULT wm_action restore_window: ok (${target.title})`
      }
      if (action === "open_app") {
        const appId = String(args.app || args.id || args.name || "").trim()
        if (!appId) return "TOOL_RESULT wm_action open_app: missing app id"
        const openedId = wmRef.openAppById?.(appId)
        if (!openedId) return `TOOL_RESULT wm_action open_app: app not found (${appId})`
        wmRef.restore?.(openedId)
        wmRef.focus?.(openedId)
        await addEvent("wm_action", `open_app ${appId}`)
        return `TOOL_RESULT wm_action open_app: ok (${appId})`
      }
      if (action === "open_url") {
        const rawUrl = String(args.url || args.link || "").trim()
        if (!rawUrl) return "TOOL_RESULT wm_action open_url: missing url"
        const opened = wmRef.openUrlInBrowserDetailed
          ? await wmRef.openUrlInBrowserDetailed(rawUrl, { newWindow: false, source: "tool" })
          : wmRef.openUrlInBrowser?.(rawUrl, { newWindow: false })
        if (!opened?.ok) {
          if (opened?.blockedByAntiBot || String(opened?.error || "").toLowerCase().includes("antibot")) {
            await addEvent("browser_antibot_blocked", String(opened?.url || rawUrl))
            return `TOOL_RESULT wm_action open_url: blocked_by_antibot (${opened?.url || rawUrl}). The browser showed a warning dialog with "Open in New Tab" and "Cancel". Tell the user to press Open in New Tab if they want to continue, or Cancel if not.`
          }
          return `TOOL_RESULT wm_action open_url: failed (${opened?.error || "unknown"})`
        }
        await addEvent("wm_action", `open_url ${rawUrl}`)
        return `TOOL_RESULT wm_action open_url: ok (${opened.url})`
      }
      return `TOOL_RESULT wm_action ${action}: unsupported`
    }
    return `TOOL_RESULT ${call.name}: unsupported`
  }

  async function providerChatWithTools({ provider, apiKey, model, temperature, messages, ollamaBaseUrl, threadId, forceSoulReanchor }){
    const working = (messages || []).map(m => ({ role: m.role, content: m.content }))
    const includeSoul = shouldInjectSoulForTurn({ threadId, messages: working, forceSoulReanchor })
    const systemPrompt = buildSystemPromptWithCadence({ includeSoul })
    if (includeSoul) await addEvent("persona_reanchoring", "Persona Reanchoring...")
    const autoResults = await maybeInjectAutoToolResults(working)
    if (autoResults.length) {
      await addEvent("tool_results_generated", autoResults.map(line => String(line).split("\n")[0]).join(" | "))
      working.push({
        role: "user",
        content: `${autoResults.join("\n\n")}\n\nUse the available tool results directly in your answer.`,
      })
    }
    for (let i = 0; i < 3; i += 1) {
      const reply = await providerChat({
        provider,
        apiKey,
        model,
        temperature,
        systemPrompt,
        messages: working,
        ollamaBaseUrl: normalizeOllamaBaseUrl(ollamaBaseUrl || previewProviderState?.ollamaBaseUrl),
      })
      const calls = parseToolCalls(reply)
      if (!calls.length) return stripToolCalls(reply) || reply
      await addEvent("tool_calls_detected", calls.map(call => call.name).join(", "))
      const results = []
      for (const call of calls) {
        try {
          results.push(await runToolCall(call))
        } catch (err) {
          results.push(`TOOL_RESULT ${call.name}: failed (${err instanceof Error ? err.message : "unknown"})`)
        }
      }
      await addEvent("tool_results_generated", results.map(line => String(line).split("\n")[0]).join(" | "))
      working.push({ role: "assistant", content: reply })
      working.push({
        role: "user",
        content: `${results.join("\n\n")}\n\nUse the tool results and respond naturally. Do not present multiple options. Do not emit another tool call unless required.`,
      })
    }
    const finalReply = await providerChat({
      provider,
      apiKey,
      model,
      temperature,
      systemPrompt,
      ollamaBaseUrl: normalizeOllamaBaseUrl(ollamaBaseUrl || previewProviderState?.ollamaBaseUrl),
      messages: working.concat({
        role: "user",
        content: "Provide a final user-facing answer now without emitting tool tokens.",
      }),
    })
    return stripToolCalls(finalReply) || "I could not complete tool execution in time."
  }

  return {
    providerChatWithTools,
  }
}
