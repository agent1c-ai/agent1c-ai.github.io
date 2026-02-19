// for Codex: when implementing cloud auth, always re-read ../agent1carchitecture/PHASE1_SUPABASE_AUTH_PLAN.md first.
// for Codex: especially if context was compacted, keep auth logic modular in this file and keep agent1c.js orchestration-only.

const CLOUD_HOSTS = new Set([
  "agent1c.ai",
  "www.agent1c.ai",
  "app.agent1c.ai",
  "agentic.ai",
  "www.agentic.ai",
  "app.agentic.ai",
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

function hostName(){
  return String(window.location?.hostname || "").toLowerCase()
}

export function isCloudAuthHost(){
  return CLOUD_HOSTS.has(hostName())
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
  return `
    <div class="agent-stack agent-auth">
      <div class="agent-auth-head">
        <div class="agent-auth-title">Welcome to Agent1c.ai</div>
        <div class="agent-auth-sub">Sign in to continue your hosted Agentic OS setup.</div>
      </div>
      <div class="agent-auth-actions">
        <button id="authGoogleBtn" class="btn" type="button">Continue with Google</button>
        <button id="authXBtn" class="btn" type="button">Continue with X</button>
      </div>
      <div class="agent-auth-divider">or use a magic link</div>
      <form id="authMagicForm" class="agent-auth-magic" autocomplete="on">
        <input id="authMagicEmail" class="field" type="email" inputmode="email" placeholder="you@example.com" required />
        <button id="authMagicBtn" class="btn" type="submit">Send Link</button>
      </form>
      <div class="agent-row">
        <button id="authRefreshBtn" class="btn" type="button">I already signed in</button>
        <span id="authStatus" class="agent-auth-status">Signed out.</span>
      </div>
      <div class="agent-auth-note">
        Google and X open in a new tab. Return here after login.
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
  const { w = window.innerWidth || 1024, h = window.innerHeight || 768 } = getViewport ? getViewport() : {}
  const compact = w <= 620
  if (compact) {
    return {
      panelId: AUTH_PANEL_ID,
      left: 8,
      top: 12,
      width: Math.max(300, w - 16),
      height: Math.max(300, Math.min(420, h - 28)),
      closeAsMinimize: false,
    }
  }
  const width = 430
  const height = 300
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
  const redirectTo = `${window.location.origin}${window.location.pathname}`
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
  window.open(data.url, "_blank", "noopener,noreferrer")
  updateAuthStatus("Waiting for sign-in in the opened tab...")
  setStatus?.("Auth tab opened. Complete sign-in, then return.")
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
  const redirectTo = `${window.location.origin}${window.location.pathname}`
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
  const magicForm = document.getElementById("authMagicForm")
  const refreshBtn = document.getElementById("authRefreshBtn")
  googleBtn?.addEventListener("click", () => {
    openOAuth("google").catch(() => {})
  })
  xBtn?.addEventListener("click", () => {
    openOAuth("x").catch(() => {})
  })
  magicForm?.addEventListener("submit", (event) => {
    event.preventDefault()
    sendMagicLink().catch(() => {})
  })
  refreshBtn?.addEventListener("click", () => {
    checkSessionAndContinue().catch(() => {})
  })
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
    stopSessionWatch()
    closeAuthWindow()
    return true
  }
  updateAuthStatus("Signed out.")
  setStatus?.("Sign in to continue on Agent1c.ai.")
  startSessionWatch()
  return false
}
