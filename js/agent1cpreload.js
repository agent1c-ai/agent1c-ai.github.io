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

  const logo = overlay.querySelector('.agent-preload-logo')
  const emojiRow = overlay.querySelector('.agent-preload-emoji')
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let idx = 0
  let timer = null
  let emojiTimer = null
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
    const row = ['🦔', ...picks]
    emojiRow.textContent = row.join(' ')
  }

  if (!prefersReduced) {
    stepFont()
    stepEmoji()
    timer = setInterval(stepFont, 120)
    emojiTimer = setInterval(stepEmoji, 60)
  }

  const totalMs = prefersReduced ? 900 : 2800
  setTimeout(() => {
    if (timer) clearInterval(timer)
    if (emojiTimer) clearInterval(emojiTimer)
    overlay.classList.add('fade-out')
    const cleanup = () => {
      overlay.removeEventListener('transitionend', cleanup)
      overlay.remove()
      window.__agent1cPreloadActive = false
    }
    overlay.addEventListener('transitionend', cleanup)
    setTimeout(cleanup, 700)
  }, totalMs)
})()
