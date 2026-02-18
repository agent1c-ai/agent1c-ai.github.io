(() => {
  if (window.__agent1cPreloadActive) return
  window.__agent1cPreloadActive = true

  const fonts = [
    '"Times New Roman"',
    'Georgia',
    '"Palatino Linotype"',
    '"Arial Black"',
    'Impact',
    '"Trebuchet MS"',
    'Verdana',
    'Tahoma',
    '"Courier New"',
    '"Lucida Console"',
  ]

  const root = document.body || document.documentElement
  const overlay = document.createElement('div')
  overlay.className = 'agent-preload'
  overlay.innerHTML = `
    <div class="agent-preload-logo">
      <span>Agent</span><span class="one">1</span><span>c</span>
    </div>
  `
  root.appendChild(overlay)

  const logo = overlay.querySelector('.agent-preload-logo')
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let idx = 0
  let timer = null
  function stepFont(){
    if (!logo) return
    logo.style.fontFamily = fonts[idx % fonts.length] + ', serif'
    idx += 1
  }

  if (!prefersReduced) {
    stepFont()
    timer = setInterval(stepFont, 120)
  }

  const totalMs = prefersReduced ? 650 : 1400
  setTimeout(() => {
    if (timer) clearInterval(timer)
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
