// for Codex: when implementing cloud auth, always re-read ../agent1carchitecture/PHASE1_SUPABASE_AUTH_PLAN.md first.
// for Codex: especially if context was compacted, keep auth logic modular in this file and keep agent1c.js orchestration-only.

const CLOUD_HOSTS = new Set([
  "agent1c.ai",
  "www.agent1c.ai",
  "app.agent1c.ai",
])

const AUTH_PANEL_ID = "auth"
const POLL_INTERVAL_MS = 1500

let supabaseClient = null
let authSubscription = null
let pollTimer = 0

let authWin = null
let wmRef = null
let getViewport = null
let setStatus = null
let onAuthenticated = null
let authContinuing = false
let androidAuthHandoffInFlight = false
const ANDROID_AUTH_HANDOFF_ONESHOT_KEY = "agent1c_android_auth_handoff_done"

function hostName(){
  return String(window.location?.hostname || "").toLowerCase()
}

function isAuthCallbackUrl(){
  const params = new URLSearchParams(window.location.search || "")
  return params.has("code")
    || params.has("state")
    || params.has("error")
    || params.has("error_description")
    || params.has("access_token")
    || params.has("refresh_token")
}

function getAuthParams(){
  try {
    return new URLSearchParams(window.location.search || "")
  } catch {
    return new URLSearchParams()
  }
}

function isAndroidAuthMode(){
  const params = getAuthParams()
  return params.get("android_auth") === "1"
}

function getAndroidAuthProviderHint(){
  const raw = String(getAuthParams().get("android_provider") || "").trim().toLowerCase()
  return (raw === "google" || raw === "x") ? raw : ""
}

function getWeb3AuthMode(){
  const params = getAuthParams()
  const raw = String(
    params.get("wallet")
    || params.get("web3")
    || (params.has("eth") ? "eth" : "")
    || (params.has("ethereum") ? "eth" : "")
    || (params.has("sol") ? "sol" : "")
    || (params.has("solana") ? "sol" : "")
    || "",
  ).trim().toLowerCase()
  if (!raw) return { showEth: false, showSol: false }
  if (["both", "all", "web3"].includes(raw)) return { showEth: true, showSol: true }
  if (["eth", "ethereum", "eip4361"].includes(raw)) return { showEth: true, showSol: false }
  if (["sol", "solana", "svm"].includes(raw)) return { showEth: false, showSol: true }
  return { showEth: false, showSol: false }
}

function getAuthRedirectTo(){
  try {
    const url = new URL(window.location.href)
    url.hash = ""
    if (isAndroidAuthMode()) {
      url.searchParams.set("android_auth", "1")
      const hint = getAndroidAuthProviderHint()
      if (hint) url.searchParams.set("android_provider", hint)
    } else {
      url.search = ""
    }
    return `${url.origin}${url.pathname}${url.search}`
  } catch {
    return `${window.location.origin}${window.location.pathname}`
  }
}

function cleanupAuthCallbackUrl(){
  if (!window.history?.replaceState) return
  try {
    const url = new URL(window.location.href)
    const keys = ["code", "state", "error", "error_code", "error_description", "access_token", "refresh_token", "token_type", "expires_in"]
    let changed = false
    for (const key of keys) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key)
        changed = true
      }
    }
    if (changed) {
      const next = `${url.pathname}${url.search}${url.hash}`
      window.history.replaceState({}, "", next)
    }
  } catch {}
}

export function isCloudAuthHost(){
  return CLOUD_HOSTS.has(hostName())
}

export async function hasCloudAuthSession(){
  if (!isCloudAuthHost()) return false
  const clientInfo = getClient()
  if (!clientInfo.ok) return false
  try {
    const { data, error } = await clientInfo.client.auth.getSession()
    if (error) return false
    return Boolean(data?.session)
  } catch {
    return false
  }
}

function safe(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function authWindowHtml(){
  const web3 = getWeb3AuthMode()
  const walletButtons = (web3.showEth || web3.showSol)
    ? `
        <div class="agent-auth-wallets">
          ${web3.showEth ? `
            <button id="authEthereumBtn" class="btn agent-auth-btn agent-auth-btn-eth" type="button">
              <span class="agent-auth-logo" aria-hidden="true">
                <svg viewBox="0 0 256 417" width="14" height="14" role="img" focusable="false">
                  <path fill="currentColor" d="M127.9 0L125 9.8V279.1L127.9 282l127.9-75.6z"/>
                  <path fill="currentColor" opacity="0.72" d="M127.9 0L0 206.4L127.9 282V150.3z"/>
                  <path fill="currentColor" opacity="0.9" d="M127.9 306.4L126.3 308.4V416.2L127.9 421l128-180.2z"/>
                  <path fill="currentColor" opacity="0.5" d="M127.9 421V306.4L0 240.8z"/>
                  <path fill="currentColor" opacity="0.8" d="M127.9 282L255.8 206.4L127.9 150.3z"/>
                  <path fill="currentColor" opacity="0.6" d="M0 206.4L127.9 282V150.3z"/>
                </svg>
              </span>
              <span>Continue with Ethereum</span>
            </button>
          ` : ""}
          ${web3.showSol ? `
            <button id="authSolanaBtn" class="btn agent-auth-btn agent-auth-btn-sol" type="button">
              <span class="agent-auth-logo" aria-hidden="true">
                <svg viewBox="0 0 397 311" width="14" height="14" role="img" focusable="false">
                  <defs>
                    <linearGradient id="solg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#8f5bff"/>
                      <stop offset="100%" stop-color="#2ee6ff"/>
                    </linearGradient>
                  </defs>
                  <path fill="url(#solg)" d="M64 0h307c14 0 21 17 11 27L333 76c-4 4-9 6-15 6H11C-3 82-10 65 0 55L49 6c4-4 9-6 15-6z"/>
                  <path fill="url(#solg)" d="M64 114h307c14 0 21 17 11 27l-49 49c-4 4-9 6-15 6H11c-14 0-21-17-11-27l49-49c4-4 9-6 15-6z"/>
                  <path fill="url(#solg)" d="M333 228H26c-14 0-21 17-11 27l49 49c4 4 9 6 15 6h307c14 0 21-17 11-27l-49-49c-4-4-9-6-15-6z"/>
                </svg>
              </span>
              <span>Continue with Solana</span>
            </button>
          ` : ""}
        </div>
      `
    : ""
  return `
    <div class="agent-stack agent-auth">
      <div class="agent-auth-head">
        <div class="agent-auth-badge">Agent1c Cloud Access</div>
        <div class="agent-auth-title">Welcome to Agent1c.ai</div>
        <div class="agent-auth-sub">Sign in to continue your hosted Agent1c OS setup.</div>
      </div>
      <div class="agent-auth-actions">
        <button id="authGoogleBtn" class="btn agent-auth-btn agent-auth-btn-google" type="button">
          <span class="agent-auth-logo" aria-hidden="true">
            <svg viewBox="0 0 18 18" width="16" height="16" role="img" focusable="false">
              <path fill="#EA4335" d="M9 7.2v3.6h5c-.2 1.2-1.5 3.6-5 3.6-3 0-5.5-2.5-5.5-5.5S6 3.4 9 3.4c1.7 0 2.8.7 3.4 1.3l2.3-2.2C13.3 1.2 11.3.3 9 .3 4.2.3.3 4.2.3 9S4.2 17.7 9 17.7c5.2 0 8.6-3.6 8.6-8.8 0-.6-.1-1.1-.1-1.7H9z"/>
            </svg>
          </span>
          <span>Continue with Google</span>
        </button>
        <button id="authXBtn" class="btn agent-auth-btn agent-auth-btn-x" type="button">
          <span class="agent-auth-logo" aria-hidden="true">
            <svg viewBox="0 0 1200 1227" width="14" height="14" role="img" focusable="false">
              <path fill="currentColor" d="M714 519 1160 0h-106L667 450 359 0H0l468 682L0 1227h106l409-476 326 476h359L714 519zM569 688l-47-67L149 89h163l301 430 47 67 391 560H888L569 688z"/>
            </svg>
          </span>
          <span>Continue with X</span>
        </button>
        ${walletButtons}
      </div>
      <div class="agent-row agent-auth-footer-row">
        <span id="authStatus" class="agent-auth-status">Signed out.</span>
      </div>
      <div class="agent-auth-note">
        Sign-in opens secure provider flow. Return here after login.
      </div>
    </div>
  `
}

function getSupabaseConfig(){
  const cfg = (window.__AGENT1C_SUPABASE_CONFIG && typeof window.__AGENT1C_SUPABASE_CONFIG === "object")
    ? window.__AGENT1C_SUPABASE_CONFIG
    : {}
  const url = String(cfg.url || "").trim()
  const anonKey = String(cfg.anonKey || "").trim()
  return { url, anonKey, ok: Boolean(url && anonKey) }
}

function getClient(){
  if (supabaseClient) return { ok: true, client: supabaseClient }
  const { ok, url, anonKey } = getSupabaseConfig()
  if (!ok) {
    return {
      ok: false,
      error: "Supabase auth not configured. Add window.__AGENT1C_SUPABASE_CONFIG in index.html.",
    }
  }
  const globalSupabase = window.supabase
  if (!globalSupabase?.createClient) {
    return {
      ok: false,
      error: "Supabase SDK not loaded.",
    }
  }
  supabaseClient = globalSupabase.createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  })
  return { ok: true, client: supabaseClient }
}

function getAuthWindowOpts(){
  const web3 = getWeb3AuthMode()
  const hasWeb3 = web3.showEth || web3.showSol
  const { w = window.innerWidth || 1024, h = window.innerHeight || 768 } = getViewport ? getViewport() : {}
  const compact = w <= 620
  if (compact) {
    return {
      panelId: AUTH_PANEL_ID,
      left: 8,
      top: 12,
      width: Math.max(300, w - 16),
      height: Math.max(244, Math.min(hasWeb3 ? 364 : 268, h - 20)),
      closeAsMinimize: false,
    }
  }
  const width = 430
  const height = hasWeb3 ? 320 : 214
  return {
    panelId: AUTH_PANEL_ID,
    left: Math.max(16, Math.round((w - width) / 2)),
    top: Math.max(24, Math.round((h - height) / 2)),
    width,
    height,
    closeAsMinimize: false,
  }
}

function updateAuthStatus(text, isError = false){
  const el = document.getElementById("authStatus")
  if (!el) return
  el.textContent = String(text || "")
  el.classList.toggle("error", Boolean(isError))
}

function focusAuthWindow(){
  if (!wmRef || !authWin?.id) return
  wmRef.restore?.(authWin.id)
  wmRef.focus?.(authWin.id)
}

function closeAuthWindow(){
  if (!authWin?.win) return
  const btn = authWin.win.querySelector("[data-close]")
  if (btn) btn.click()
  authWin = null
}

function ensureAuthWindow(){
  if (!wmRef) return
  if (authWin?.win?.isConnected) {
    focusAuthWindow()
    return
  }
  authWin = wmRef.createAgentPanelWindow("Sign In", getAuthWindowOpts())
  if (!authWin?.panelRoot) return
  authWin.panelRoot.innerHTML = authWindowHtml()
  wireAuthDom()
  focusAuthWindow()
}

async function openOAuth(provider){
  const clientInfo = getClient()
  if (!clientInfo.ok) {
    updateAuthStatus(clientInfo.error, true)
    setStatus?.(clientInfo.error)
    return
  }
  const redirectTo = getAuthRedirectTo()
  const { data, error } = await clientInfo.client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  })
  if (error || !data?.url) {
    const msg = error?.message || "Could not start OAuth sign-in."
    updateAuthStatus(msg, true)
    setStatus?.(msg)
    return
  }
  updateAuthStatus("Redirecting to sign-in...")
  setStatus?.("Redirecting to sign-in...")
  window.location.assign(data.url)
}

async function detectEthereumWallet(){
  const seen = []
  const add = (provider) => {
    if (!provider || typeof provider.request !== "function") return
    if (seen.includes(provider)) return
    seen.push(provider)
  }
  const direct = window.ethereum
  if (direct) {
    if (Array.isArray(direct.providers) && direct.providers.length) {
      for (const p of direct.providers) add(p)
    } else {
      add(direct)
    }
  }
  if (seen.length) return seen[0]
  if (!window.addEventListener || !window.dispatchEvent) return null
  return await new Promise((resolve) => {
    let done = false
    const finish = (provider) => {
      if (done) return
      done = true
      window.removeEventListener("eip6963:announceProvider", onAnnounce)
      resolve(provider || null)
    }
    const onAnnounce = (event) => {
      const provider = event?.detail?.provider
      add(provider)
    }
    window.addEventListener("eip6963:announceProvider", onAnnounce)
    try {
      window.dispatchEvent(new Event("eip6963:requestProvider"))
    } catch {}
    window.setTimeout(() => finish(seen[0] || null), 250)
  })
}

function detectSolanaWallet(){
  const candidates = [
    window.phantom?.solana,
    window.solana,
    window.backpack?.solana,
    window.braveSolana,
  ]
  for (const wallet of candidates) {
    if (!wallet) continue
    if (typeof wallet.connect === "function") return wallet
  }
  return null
}

function web3Statement(chain){
  const host = window.location.hostname || "agent1c.ai"
  const chainName = chain === "solana" ? "Solana" : "Ethereum"
  return `Sign in to Agent1c.ai on ${host} using ${chainName}.`
}

async function openWeb3(chain){
  const clientInfo = getClient()
  if (!clientInfo.ok) {
    updateAuthStatus(clientInfo.error, true)
    setStatus?.(clientInfo.error)
    return
  }
  const normalized = chain === "solana" ? "solana" : "ethereum"
  const wallet = normalized === "solana"
    ? detectSolanaWallet()
    : await detectEthereumWallet()
  if (!wallet) {
    const msg = normalized === "solana"
      ? "No Solana wallet detected. Install/enable Phantom, Solflare, or another Solana wallet."
      : "No Ethereum wallet detected. Install/enable MetaMask, Rabby, or another EVM wallet."
    updateAuthStatus(msg, true)
    setStatus?.(msg)
    return
  }
  updateAuthStatus(`Waiting for ${normalized} wallet signature...`)
  setStatus?.(`Waiting for ${normalized} wallet signature...`)
  const { error } = await clientInfo.client.auth.signInWithWeb3({
    chain: normalized,
    statement: web3Statement(normalized),
    wallet,
  })
  if (error) {
    const msg = error?.message || `Could not sign in with ${normalized}.`
    updateAuthStatus(msg, true)
    setStatus?.(msg)
    return
  }
  const continued = await checkSessionAndContinue()
  if (!continued) {
    updateAuthStatus("Signature accepted. Finalizing sign-in...")
    setStatus?.("Signature accepted. Finalizing sign-in...")
  }
}

async function sendMagicLink(){
  const clientInfo = getClient()
  if (!clientInfo.ok) {
    updateAuthStatus(clientInfo.error, true)
    setStatus?.(clientInfo.error)
    return
  }
  const input = document.getElementById("authMagicEmail")
  const email = String(input?.value || "").trim()
  if (!email || !email.includes("@")) {
    updateAuthStatus("Enter a valid email first.", true)
    return
  }
  const redirectTo = getAuthRedirectTo()
  const { error } = await clientInfo.client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  })
  if (error) {
    const msg = error.message || "Could not send magic link."
    updateAuthStatus(msg, true)
    setStatus?.(msg)
    return
  }
  updateAuthStatus(`Magic link sent to ${safe(email)}.`)
  setStatus?.("Magic link sent. Open your email and come back.")
}

async function createAndroidAuthHandoff(){
  if (!isAndroidAuthMode()) return null
  const clientInfo = getClient()
  if (!clientInfo.ok) throw new Error(clientInfo.error || "Supabase auth unavailable")
  const { data, error } = await clientInfo.client.auth.getSession()
  if (error || !data?.session) throw new Error(error?.message || "No cloud session available")
  const cfg = getSupabaseConfig()
  const session = data.session
  const headers = {
    "Content-Type": "application/json",
    apikey: cfg.anonKey,
    Authorization: `Bearer ${session.access_token}`,
  }
  const body = {
    action: "create",
    session: {
      access_token: String(session.access_token || ""),
      refresh_token: String(session.refresh_token || ""),
      expires_in: Number(session.expires_in || 3600),
      token_type: String(session.token_type || "bearer"),
    },
  }
  const res = await fetch(`${cfg.url}/functions/v1/android-auth-handoff`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(String(json?.error || `Android handoff create failed (${res.status})`))
  }
  const code = String(json?.handoff_code || "").trim()
  if (!code) throw new Error("Android handoff code missing")
  return { code, expiresAt: String(json?.expires_at || "") }
}

async function runAndroidAuthHandoffAndDeepLink(){
  if (!isAndroidAuthMode()) return false
  try {
    if (window.sessionStorage?.getItem(ANDROID_AUTH_HANDOFF_ONESHOT_KEY) === "1") {
      return true
    }
  } catch {}
  if (androidAuthHandoffInFlight) return true
  androidAuthHandoffInFlight = true
  try {
    updateAuthStatus("Signed in. Returning to Hitomi app...")
    setStatus?.("Returning sign-in to Android app...")
    const handoff = await createAndroidAuthHandoff()
    try { window.sessionStorage?.setItem(ANDROID_AUTH_HANDOFF_ONESHOT_KEY, "1") } catch {}
    const deep = new URL(APP_REDIRECT_URI)
    deep.searchParams.set("handoff_code", handoff?.code || "")
    if (handoff?.expiresAt) deep.searchParams.set("expires_at", handoff.expiresAt)
    // Navigate instead of assign/open so browser can hand off into Android app.
    window.location.href = deep.toString()
    return true
  } finally {
    window.setTimeout(() => { androidAuthHandoffInFlight = false }, 1500)
  }
}

const APP_REDIRECT_URI = "agent1cai://auth/callback"

async function checkSessionAndContinue(){
  const clientInfo = getClient()
  if (!clientInfo.ok) {
    updateAuthStatus(clientInfo.error, true)
    return false
  }
  const { data, error } = await clientInfo.client.auth.getSession()
  if (error) {
    updateAuthStatus(error.message || "Session check failed.", true)
    return false
  }
  if (!data?.session) return false
  if (authContinuing) return true
  authContinuing = true
  updateAuthStatus("Signed in. Continuing setup...")
  setStatus?.("Signed in. Continuing setup.")
  if (isAndroidAuthMode()) {
    cleanupAuthCallbackUrl()
    stopSessionWatch()
    await runAndroidAuthHandoffAndDeepLink()
    return true
  }
  cleanupAuthCallbackUrl()
  stopSessionWatch()
  closeAuthWindow()
  Promise.resolve().then(() => onAuthenticated?.())
  return true
}

function startSessionWatch(){
  stopSessionWatch()
  const clientInfo = getClient()
  if (!clientInfo.ok) return
  const subscription = clientInfo.client.auth.onAuthStateChange((_evt, session) => {
    if (session) {
      checkSessionAndContinue().catch(() => {})
    }
  })
  authSubscription = subscription?.data?.subscription || null
  pollTimer = window.setInterval(() => {
    checkSessionAndContinue().catch(() => {})
  }, POLL_INTERVAL_MS)
}

function stopSessionWatch(){
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = 0
  }
  if (authSubscription?.unsubscribe) {
    authSubscription.unsubscribe()
  }
  authSubscription = null
}

function wireAuthDom(){
  const googleBtn = document.getElementById("authGoogleBtn")
  const xBtn = document.getElementById("authXBtn")
  const ethBtn = document.getElementById("authEthereumBtn")
  const solBtn = document.getElementById("authSolanaBtn")
  let lastPressAt = 0
  const bindPress = (node, fn) => {
    if (!node) return
    const run = (event) => {
      const now = Date.now()
      if (now - lastPressAt < 350) return
      lastPressAt = now
      if (event) {
        event.preventDefault()
        event.stopPropagation()
      }
      Promise.resolve().then(fn).catch(() => {})
    }
    node.addEventListener("click", run)
    node.addEventListener("touchend", run, { passive: false })
    node.addEventListener("pointerup", run)
  }
  bindPress(googleBtn, () => openOAuth("google"))
  bindPress(xBtn, () => openOAuth("x"))
  bindPress(ethBtn, () => openWeb3("ethereum"))
  bindPress(solBtn, () => openWeb3("solana"))
}

export async function ensureCloudAuthSession({
  wm,
  getDesktopViewport,
  setStatus: setStatusCb,
  onAuthenticated: onAuthenticatedCb,
}){
  if (!isCloudAuthHost()) return true
  wmRef = wm || wmRef
  getViewport = getDesktopViewport || getViewport
  setStatus = setStatusCb || setStatus
  onAuthenticated = onAuthenticatedCb || onAuthenticated

  const clientInfo = getClient()
  ensureAuthWindow()
  if (isAuthCallbackUrl()) {
    updateAuthStatus("Processing sign-in callback...")
    setStatus?.("Processing sign-in callback...")
  }
  if (!clientInfo.ok) {
    updateAuthStatus(clientInfo.error, true)
    setStatus?.(clientInfo.error)
    return false
  }
  const { data, error } = await clientInfo.client.auth.getSession()
  if (error) {
    updateAuthStatus(error.message || "Session check failed.", true)
    setStatus?.(error.message || "Session check failed.")
    startSessionWatch()
    return false
  }
  if (data?.session) {
    if (isAndroidAuthMode()) {
      await runAndroidAuthHandoffAndDeepLink()
      return false
    }
    stopSessionWatch()
    closeAuthWindow()
    return true
  }
  if (isAndroidAuthMode()) {
    try { window.sessionStorage?.removeItem(ANDROID_AUTH_HANDOFF_ONESHOT_KEY) } catch {}
  }
  updateAuthStatus("Signed out.")
  setStatus?.("Sign in to continue on Agent1c.ai.")
  startSessionWatch()
  return false
}

export async function getCloudAuthAccessToken(){
  if (!isCloudAuthHost()) return ""
  const clientInfo = getClient()
  const cfg = getSupabaseConfig()
  const projectRef = String(cfg.url || "")
    .replace(/^https?:\/\//i, "")
    .split(".")[0]
    .trim()
  if (clientInfo.ok) {
    try {
      const { data } = await clientInfo.client.auth.getSession()
      const token = String(data?.session?.access_token || "").trim()
      if (token) return token
    } catch {}
  }
  try {
    const preferred = projectRef ? `sb-${projectRef}-auth-token` : ""
    if (!preferred) return ""
    const raw = window.localStorage.getItem(preferred)
    if (!raw) return ""
    let parsed = null
    try { parsed = JSON.parse(raw) } catch { parsed = null }
    const token = String(
      parsed?.currentSession?.access_token
      || parsed?.access_token
      || parsed?.session?.access_token
      || ""
    ).trim()
    if (token) return token
  } catch {}
  return ""
}

export async function getCloudAuthIdentity(){
  if (!isCloudAuthHost()) return { provider: "", handle: "", email: "" }
  const clientInfo = getClient()
  if (!clientInfo.ok) return { provider: "", handle: "", email: "" }
  try {
    const { data, error } = await clientInfo.client.auth.getSession()
    if (error || !data?.session?.user) return { provider: "", handle: "", email: "" }
    const user = data.session.user
    const identities = Array.isArray(user.identities) ? user.identities : []
    const providerRaw = String(
      user?.app_metadata?.provider
      || user?.user_metadata?.provider
      || identities[0]?.provider
      || ""
    ).toLowerCase()
    const provider = providerRaw === "twitter" ? "x" : providerRaw
    const identity =
      identities.find((it) => String(it?.provider || "").toLowerCase() === providerRaw)
      || identities.find((it) => String(it?.provider || "").toLowerCase() === provider)
      || identities[0]
      || null
    const idData = (identity && typeof identity.identity_data === "object" && identity.identity_data)
      ? identity.identity_data
      : {}
    const handle = String(
      idData?.user_name
      || idData?.preferred_username
      || idData?.username
      || user?.user_metadata?.user_name
      || user?.user_metadata?.preferred_username
      || user?.user_metadata?.username
      || ""
    ).trim()
    const email = String(
      user?.email
      || idData?.email
      || user?.user_metadata?.email
      || ""
    ).trim()
    return { provider, handle, email, userId: String(user?.id || "").trim() }
  } catch {
    return { provider: "", handle: "", email: "", userId: "" }
  }
}
