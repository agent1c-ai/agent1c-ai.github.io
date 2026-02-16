export function animateWindowCloseMatrix(win, opts = {}){
  if (!win || !(win instanceof HTMLElement)) return Promise.resolve();
  if (!document.body.contains(win)) return Promise.resolve();
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return Promise.resolve();

  const rect = win.getBoundingClientRect();
  if (!rect.width || !rect.height) return Promise.resolve();

  const color = String(opts.color || "#ff4fb8");
  const glow = String(opts.glow || "rgba(255, 79, 184, 0.65)");
  const duration = Math.max(420, Math.min(1200, Number(opts.durationMs) || 760));

  const layer = document.createElement("div");
  layer.style.position = "fixed";
  layer.style.left = `${rect.left}px`;
  layer.style.top = `${rect.top}px`;
  layer.style.width = `${rect.width}px`;
  layer.style.height = `${rect.height}px`;
  layer.style.zIndex = "10000";
  layer.style.pointerEvents = "none";
  layer.style.overflow = "hidden";
  layer.style.border = getComputedStyle(win).border || "1px solid rgba(0,0,0,0.35)";
  layer.style.boxShadow = getComputedStyle(win).boxShadow || "0 2px 8px rgba(0,0,0,0.25)";
  layer.style.background = "rgba(6, 0, 10, 0.94)";
  layer.style.transformOrigin = "top center";
  layer.style.backdropFilter = "blur(0.5px)";

  const chars = "01アイウエオカキクケコサシスセソナニヌネノマミムメモラリルレロ";
  const colWidth = 12;
  const cols = Math.max(8, Math.min(96, Math.floor(rect.width / colWidth)));
  const rain = document.createElement("div");
  rain.style.position = "absolute";
  rain.style.inset = "0";
  rain.style.fontFamily = "monospace";
  rain.style.fontSize = "13px";
  rain.style.fontWeight = "700";
  rain.style.lineHeight = "13px";
  rain.style.color = color;
  rain.style.textShadow = `0 0 2px ${glow}, 0 0 8px ${glow}`;

  for (let i = 0; i < cols; i += 1) {
    const stream = document.createElement("div");
    const len = 10 + Math.floor(Math.random() * 14);
    let text = "";
    for (let j = 0; j < len; j += 1) text += chars[Math.floor(Math.random() * chars.length)];
    stream.textContent = text;
    stream.style.position = "absolute";
    stream.style.left = `${i * colWidth}px`;
    stream.style.top = `${-Math.random() * rect.height}px`;
    stream.style.opacity = `${0.82 + Math.random() * 0.18}`;
    rain.appendChild(stream);

    stream.animate(
      [
        { transform: "translateY(0px)", opacity: stream.style.opacity },
        { transform: `translateY(${rect.height + 48}px)`, opacity: "0.05" },
      ],
      {
        duration: duration * (0.95 + Math.random() * 0.55),
        easing: "linear",
        fill: "forwards",
      },
    );
  }

  const sweep = document.createElement("div");
  sweep.style.position = "absolute";
  sweep.style.left = "0";
  sweep.style.right = "0";
  sweep.style.top = "0";
  sweep.style.height = "100%";
  sweep.style.background = `linear-gradient(to bottom, rgba(255,255,255,0) 0%, ${glow} 55%, rgba(0,0,0,0) 100%)`;
  sweep.style.mixBlendMode = "screen";
  sweep.style.opacity = "0.0";

  layer.appendChild(rain);
  layer.appendChild(sweep);
  document.body.appendChild(layer);

  const layerAnim = layer.animate(
    [
      { opacity: 1, filter: "brightness(1) blur(0px)", clipPath: "inset(0 0 0 0)" },
      { opacity: 1, filter: "brightness(1.25) blur(0px)", clipPath: "inset(0 0 0 0)" },
      { opacity: 0.88, filter: "brightness(1.1) blur(0.2px)", clipPath: "inset(0 0 0 0)" },
      { opacity: 0.0, filter: "brightness(0.65) blur(1.2px)", clipPath: "inset(88% 0 0 0)" },
    ],
    { duration, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" },
  );

  sweep.animate(
    [
      { transform: "translateY(-100%)", opacity: 0.0 },
      { transform: "translateY(25%)", opacity: 0.72 },
      { transform: "translateY(115%)", opacity: 0.0 },
    ],
    { duration: duration * 0.92, delay: duration * 0.12, easing: "ease-out", fill: "forwards" },
  );

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      layer.remove();
      resolve();
    };
    const t = setTimeout(finish, duration + 240);
    layerAnim.addEventListener("finish", () => {
      clearTimeout(t);
      finish();
    }, { once: true });
  });
}
