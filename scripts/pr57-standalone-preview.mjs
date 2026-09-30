import fs from 'node:fs/promises'

const css = await fs.readFile('src/styles/tide-intro.css', 'utf8')
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PR57 — Red Tide splash loop</title>
<style>
:root{
  --color-paper:#f4f0ea;
  --color-ink:#0a0a0a;
  --color-ink-2:#171717;
  --color-muted:#8c8582;
  --color-accent:#f0a500;
  --color-line:#ffffff22;
  --font-mono:ui-monospace,SFMono-Regular,Menlo,monospace;
  --font-display:Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif;
  --motion-intro-word:500ms;
  --motion-intro-word-start:500ms;
  --motion-intro-ripple:650ms;
  --motion-intro-ripple-start:180ms;
  --motion-reveal:380ms;
  --motion-fast:140ms;
  --ease-out-quint:cubic-bezier(.22,1,.36,1);
  --ease-tide:cubic-bezier(.76,0,.24,1);
  --dur-base:220ms;
  --dur-fast:140ms;
  --layer-intro:1200;
}
html,body{margin:0;min-height:100%;background:#0a0a0a;color:#f4f0ea}
body{font-family:system-ui,sans-serif}
.demo-controls{position:fixed;left:1rem;bottom:1rem;z-index:3000;font:12px var(--font-mono);color:#8c8582}
</style>
<style>${css}</style>
</head>
<body>
<div class="tide-experience tide-experience--idle">
  <div aria-hidden="true"></div>
  <div class="tide-intro tide-intro--idle" role="button" aria-label="Enter Red Tide PPC" tabindex="0">
    <div class="tide-intro__curtain" aria-hidden="true">
      <svg class="tide-intro__curtain-edge" viewBox="0 0 1600 160" preserveAspectRatio="none"><path d="M0 82C320 150 540 10 820 62S1290 150 1600 50V160H0Z" fill="currentColor"/></svg>
      <div class="tide-intro__light"></div>
    </div>
    <div class="tide-intro__top tide-intro__chrome"><span class="tide-intro__location">PUERTO PRINCESA <span>/</span> PALAWAN</span></div>
    <div class="tide-intro__center">
      <div class="tide-intro__depth tide-intro__depth--far"></div>
      <div class="tide-intro__depth tide-intro__depth--near"></div>
      <div class="tide-intro__loop-ripple"></div>
      <div class="tide-intro__surface">
        <div class="tide-intro__horizon"></div>
        <div class="tide-intro__surface-glow"></div>
        <div class="tide-intro__wave-stack">
          <div class="tide-intro__wave-layer tide-intro__wave-layer--back"><div class="tide-intro__wave-bob tide-intro__wave-bob--back"><svg viewBox="0 0 2000 360" preserveAspectRatio="none"><path d="M0 130 C125 70 250 190 375 130 S625 70 750 130 S875 190 1000 130 C1125 70 1250 190 1375 130 S1625 70 1750 130 S1875 190 2000 130 L2000 360 L0 360 Z" fill="#ff525209"/></svg></div></div>
          <div class="tide-intro__wave-layer tide-intro__wave-layer--mid"><div class="tide-intro__wave-bob tide-intro__wave-bob--mid"><svg viewBox="0 0 2000 360" preserveAspectRatio="none"><path d="M0 110 C125 42 250 178 375 110 S625 42 750 110 S875 178 1000 110 C1125 42 1250 178 1375 110 S1625 42 1750 110 S1875 178 2000 110 L2000 360 L0 360 Z" fill="#ff525213"/></svg></div></div>
          <div class="tide-intro__wave-layer tide-intro__wave-layer--front"><div class="tide-intro__wave-bob tide-intro__wave-bob--front"><svg viewBox="0 0 2000 360" preserveAspectRatio="none"><defs><linearGradient id="tide-front-crest" x1="0" x2="1"><stop offset="0" stop-color="#f0a50000"/><stop offset=".46" stop-color="#f0a500" stop-opacity=".88"/><stop offset=".72" stop-color="#ff5252" stop-opacity=".74"/><stop offset="1" stop-color="#ff525200"/></linearGradient></defs><path d="M0 92 C125 48 250 136 375 92 S625 48 750 92 S875 136 1000 92 C1125 48 1250 136 1375 92 S1625 48 1750 92 S1875 136 2000 92 L2000 360 L0 360 Z" fill="#f0a5000f"/><path d="M0 92 C125 48 250 136 375 92 S625 48 750 92 S875 136 1000 92 C1125 48 1250 136 1375 92 S1625 48 1750 92 S1875 136 2000 92" fill="none" stroke="url(#tide-front-crest)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg></div></div>
        </div>
      </div>
      <div class="tide-intro__title-clip"><div class="tide-intro__title"><span>RED TIDE</span></div></div>
      <div class="tide-intro__copy tide-intro__chrome">
        <p class="tide-intro__eyebrow">COMMUNITY EARLY WARNING</p>
        <p class="tide-intro__line">One coast. A shared watch.</p>
      </div>
      <div class="tide-intro__hint" data-hint-state="visible">TAP TO ENTER</div>
    </div>
    <div class="tide-intro__bottom tide-intro__chrome"><span>WATCH THE WATER.</span><span>PROTECT THE COAST.</span></div>
  </div>
</div>
<script>
const intro=document.querySelector('.tide-intro')
const enter=()=>{intro.classList.remove('tide-intro--idle');intro.classList.add('tide-intro--leaving');setTimeout(()=>intro.remove(),800)}
intro.addEventListener('click',enter)
intro.addEventListener('pointerup',enter)
intro.addEventListener('keydown',e=>{if(['Enter','Escape',' ','Spacebar'].includes(e.key)){e.preventDefault();enter()}})
intro.focus()
</script>
</body>
</html>`
await fs.writeFile('pr57-standalone-preview.html', html)
console.log('wrote pr57-standalone-preview.html')
