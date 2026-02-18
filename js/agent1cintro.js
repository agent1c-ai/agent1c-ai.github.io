// Intro landing flow for agent1c.ai
const AI_INTRO_DONE_KEY = "agent1c_ai_intro_done_v1"

const AI_INTRO_MESSAGES = [
  "Hi friend. I am Hitomi, your tiny hedgehog guide.",
  "Welcome to Agent1c.ai. This is your cloud-hosted Agent1c OS path.",
  "Pick one option in the Intro window. I will start setup right after you choose Continue.",
]

let introWin = null
let aiIntroPending = false
let aiIntroContinuing = false

function isAgenticAiHost(){
  const host = String(window.location?.hostname || "").toLowerCase()
  return host === "agent1c.ai"
    || host === "www.agent1c.ai"
    || host === "app.agent1c.ai"
    || host === "agentic.ai"
    || host === "www.agentic.ai"
    || host === "app.agentic.ai"
}

function shouldShowAiIntroGate(){
  const host = String(window.location?.hostname || "").toLowerCase()
  if (!isAgenticAiHost()) return false
  if (host === "app.agent1c.ai" || host === "app.agentic.ai") return false
  try {
    return localStorage.getItem(AI_INTRO_DONE_KEY) !== "1"
  } catch {
    return true
  }
}

export function isAiIntroGuideActive(){
  return aiIntroPending
}

export function getAiIntroHtml(){
  return AI_INTRO_MESSAGES
    .map(line => `<div class="clippy-line"><strong>Hitomi:</strong> ${escapeHtml(line)}</div>`)
    .join("")
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function getIntroWindowOpts(getDesktopViewport){
  const { w, h } = getDesktopViewport()
  const compact = w <= 760
  if (compact) {
    return {
      panelId: "intro",
      left: 0,
      top: 0,
      width: Math.max(300, w - 8),
      height: Math.max(320, Math.min(520, h - 24)),
      closeAsMinimize: false,
    }
  }
  const width = 740
  const height = 420
  return {
    panelId: "intro",
    left: Math.max(20, Math.round((w - width) / 2)),
    top: Math.max(28, Math.round((h - height) / 2) - 24),
    width,
    height,
    closeAsMinimize: false,
  }
}

function introWindowHtml(){
  return `
    <div class="agent-stack agent-intro">
      <div class="agent-intro-hero">
        <img src="assets/hedgey1.png" alt="Hitomi hedgehog" class="agent-intro-mascot" />
        <div class="agent-intro-hero-copy">
          <div class="agent-intro-kicker">Agentic Desktop OS</div>
          <div class="agent-intro-title">Agent<span class="agent-intro-one">1</span>c</div>
          <div class="agent-intro-sub">An agentic OS in your browser tab where Hitomi your hedgehog AI runs, controlling her own windows, tools, and apps.</div>
        </div>
      </div>
      <div class="agent-intro-signals">
        <span class="agent-intro-signal">Web-based OS</span>
        <span class="agent-intro-signal">Fully agentic</span>
        <span class="agent-intro-signal">Local-first BYOK option</span>
      </div>
      <div class="agent-intro-grid">
        <div class="agent-intro-card cloud">
          <div class="agent-intro-card-title">Agent1c.ai (Cloud)</div>
          <div class="agent-intro-card-sub">Early access cloud path.</div>
          <ul class="agent-intro-list">
            <li>A workspace you can access from anywhere with an Agent1c account</li>
            <li>Immediately start using</li>
            <li>Agent runs in cloud between logins</li>
            <li>Sign up now for early access</li>
          </ul>
        </div>
        <div class="agent-intro-card local">
          <div class="agent-intro-card-title">Agent1c.me (Local)</div>
          <div class="agent-intro-card-sub">For power users and privacy enthusiasts.</div>
          <ul class="agent-intro-list">
            <li>For those comfortable with APIs and the command line</li>
            <li>No need to sign up, primarily serverless</li>
            <li>Only persists in your browser cache</li>
            <li>Bring your own keys and optional local relay</li>
          </ul>
        </div>
      </div>
      <div class="agent-intro-note">Choose how you want to begin. You can switch paths later.</div>
      <div class="agent-row agent-wrap-row agent-intro-cta-row">
        <button id="introGoLocalBtn" class="btn agent-intro-btn agent-intro-btn-secondary" type="button">Run Agent1c.me</button>
        <button id="introContinueCloudBtn" class="btn agent-intro-btn agent-intro-btn-primary" type="button">Sign up to Agent1c.ai</button>
      </div>
      <div class="agent-intro-footer">
        <span>Built for builders, teams, and curious humans.</span>
      </div>
    </div>
  `
}

function activateAiIntroGuide({ setClippyMode, showClippyBubble, renderClippyBubble, setStatus }){
  setClippyMode(true)
  showClippyBubble({ variant: "compact", snapNoOverlap: true, preferAbove: true })
  renderClippyBubble()
  setStatus("Choose local or cloud in the Intro window.")
}

async function continueAfterAiIntro({ closeWindow, continueStandardOnboardingFlow }){
  if (aiIntroContinuing) return
  aiIntroContinuing = true
  aiIntroPending = false
  try {
    localStorage.setItem(AI_INTRO_DONE_KEY, "1")
  } catch {}
  if (introWin?.id) closeWindow(introWin)
  introWin = null
  await continueStandardOnboardingFlow()
}

function wireIntroDom(){
  const goLocal = document.getElementById("introGoLocalBtn")
  const cont = document.getElementById("introContinueCloudBtn")
  if (goLocal) {
    goLocal.addEventListener("click", () => {
      window.location.href = "https://agent1c.me"
    })
  }
  if (cont) {
    cont.addEventListener("click", () => {
      continueAfterAiIntro(window.__agent1cIntroBridge).catch(err => {
        window.__agent1cIntroBridge?.setStatus?.(err instanceof Error ? err.message : "Could not continue.")
      })
    })
  }
}

function sizeIntroWindowToContent(getDesktopViewport){
  if (!introWin?.win || !introWin?.panelRoot) return
  const winEl = introWin.win
  const panel = introWin.panelRoot
  const titlebar = winEl.querySelector(".titlebar")
  const { h } = getDesktopViewport()
  const base = titlebar?.offsetHeight || 22
  const contentEl = panel.querySelector(".agent-intro") || panel
  const contentBox = contentEl.getBoundingClientRect()
  const content = Math.max(contentEl.scrollHeight || 0, contentEl.offsetHeight || 0, contentBox.height || 0)
  const target = Math.max(320, Math.min(h - 12, base + content + 22))
  winEl.style.height = `${target}px`
  const top = parseFloat(winEl.style.top) || 0
  winEl.style.top = `${Math.max(0, Math.min(top, Math.max(0, h - target)))}px`
}

function createIntroWindow({ wmRef, getDesktopViewport, cacheElements }){
  introWin = wmRef.createAgentPanelWindow("Intro", getIntroWindowOpts(getDesktopViewport))
  if (!introWin?.panelRoot) return
  introWin.panelRoot.innerHTML = introWindowHtml()
  cacheElements()
  wireIntroDom()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => sizeIntroWindowToContent(getDesktopViewport))
  })
}

export function initAiIntro({
  wmRef,
  getDesktopViewport,
  setStatus,
  setClippyMode,
  showClippyBubble,
  renderClippyBubble,
  closeWindow,
  continueStandardOnboardingFlow,
  cacheElements,
}){
  aiIntroPending = shouldShowAiIntroGate()
  if (!aiIntroPending) return false
  window.__agent1cIntroBridge = {
    closeWindow,
    continueStandardOnboardingFlow,
    setStatus,
  }
  createIntroWindow({ wmRef, getDesktopViewport, cacheElements })
  activateAiIntroGuide({ setClippyMode, showClippyBubble, renderClippyBubble, setStatus })
  return true
}
