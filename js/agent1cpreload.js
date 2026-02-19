import { animateFullscreenMatrix } from "./window-close-fx.js";

(() => {
  if (window.__agent1cPreloadActive) return
  window.__agent1cPreloadActive = true

  const emojis = [
    '🦔','🌸','🪴','✨','🧠','🧩','🛰️','🪐','🪄','📎','💾','🧭','🫧','🍀','🫶','💡','🛠️','📚','🧪','🖥️'
  ]

  const fonts = [
    '"Times New Roman"',
    'Georgia',
    '"Palatino Linotype"',
    '"Garamond"',
    '"Book Antiqua"',
    '"Arial Black"',
    'Impact',
    '"Trebuchet MS"',
    'Verdana',
    'Tahoma',
    '"Gill Sans"',
    '"Franklin Gothic Medium"',
    '"Lucida Sans"',
    '"Courier New"',
    '"Lucida Console"',
    '"Monaco"',
    '"Consolas"',
    '"EnvyCodeRNerd","ChicagoKare","Chicago","Charcoal","Geneva","Tahoma",monospace'
  ]

  const root = document.body || document.documentElement
  const overlay = document.createElement('div')
  overlay.className = 'agent-preload'
  overlay.innerHTML = `
    <div class="agent-preload-logo">
      <span>Agent</span><span class="one">1</span><span>c</span>
    </div>
    <div class="agent-preload-emoji"></div>
  `
  root.appendChild(overlay)

  const logo = overlay.querySelector(".agent-preload-logo")
  const emojiRow = overlay.querySelector(".agent-preload-emoji")
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const totalMs = prefersReduced ? 900 : 2800
  let matrixFx = null;
  let matrixLayer = null;
  const startMatrix = () => {
    if (matrixFx) return
    try {
      matrixFx = animateFullscreenMatrix({ parent: overlay, durationMs: totalMs, zIndex: 0, onLayer: (layer) => { matrixLayer = layer } });
      if (matrixLayer) {
        matrixLayer.style.opacity = '0'
        matrixLayer.animate([
          { opacity: 0 },
          { opacity: 0.95 },
        ], { duration: 420, easing: 'ease-out', fill: 'forwards' })
      }
    } catch {}
  }

  let idx = 0
  let timer = null
  let emojiTimer = null
  let hogIndex = 0
  let hogDir = 1
  function stepFont(){
    if (!logo) return
    logo.style.fontFamily = fonts[idx % fonts.length] + ', serif'
    idx += 1
  }

  function stepEmoji(){
    if (!emojiRow) return
    const pool = emojis.filter(e => e !== '🦔')
    const picks = []
    while (picks.length < 4 && pool.length){
      const i = Math.floor(Math.random() * pool.length)
      picks.push(pool.splice(i, 1)[0])
    }
    const row = new Array(5)
    const pos = hogIndex
    row[pos] = '🦔'
    let pi = 0
    for (let i = 0; i < row.length; i += 1){
      if (!row[i]) {
        row[i] = picks[pi] || ''
        pi += 1
      }
    }
    emojiRow.textContent = ''
    row.forEach((emoji) => {
      const span = document.createElement('span')
      span.textContent = emoji || ''
      emojiRow.appendChild(span)
    })
    if (hogIndex === 4) hogDir = -1
    if (hogIndex === 0) hogDir = 1
    hogIndex += hogDir
  }

  stepEmoji()
  const emojiInterval = prefersReduced ? 240 : 120
  emojiTimer = setInterval(stepEmoji, emojiInterval)
  if (!prefersReduced) {
    stepFont()
    timer = setInterval(stepFont, 120)
  } else {
    stepFont()
  }
  const matrixStartAt = Math.max(120, Math.floor(totalMs * 0.5))
  setTimeout(startMatrix, matrixStartAt)

  setTimeout(() => {
    if (timer) clearInterval(timer)
    if (emojiTimer) clearInterval(emojiTimer)
    overlay.classList.add('fade-out')
    const cleanup = () => {
      overlay.removeEventListener('transitionend', cleanup)
      matrixFx?.stop?.();
      overlay.remove()
      window.__agent1cPreloadActive = false
      try { window.dispatchEvent(new Event("agent1c:preload-finished")); } catch {}
    }
    overlay.addEventListener('transitionend', cleanup)
    setTimeout(cleanup, 700)
  }, totalMs)
})()
