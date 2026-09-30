import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'

const PORT = 4173
const OUT = 'qa/pr56'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const fail = message => { throw new Error(message) }
const assert = (v, message) => { if (!v) fail(message) }
const toMs = value => value.endsWith('ms') ? Number.parseFloat(value) : Number.parseFloat(value) * 1000

const server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] })
server.stdout.on('data', d => process.stdout.write('[server] ' + d))
server.stderr.on('data', d => process.stderr.write('[server:err] ' + d))

async function waitServer() {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/`)
      if (r.ok) return
    } catch {}
    await sleep(100)
  }
  fail('Vite demo server did not become ready')
}

async function boot(page) {
  await waitServer()
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
}

async function introMeta(page, width, height) {
  return page.evaluate(() => {
    const center = document.querySelector('.tide-intro__center')
    const title = document.querySelector('.tide-intro__title span')
    const eyebrow = document.querySelector('.tide-intro__eyebrow')
    const marker = eyebrow ? getComputedStyle(eyebrow, '::before') : null
    const val = s => s ? ({ name:s.animationName, duration:s.animationDuration, delay:s.animationDelay }) : null
    return {
      introHeight: document.querySelector('.tide-intro')?.getBoundingClientRect().height ?? 0,
      curtainHeight: document.querySelector('.tide-intro__curtain')?.getBoundingClientRect().height ?? 0,
      orbit: val(center ? getComputedStyle(center, '::before') : null),
      core: val(center ? getComputedStyle(center, '::after') : null),
      word: val(title ? getComputedStyle(title) : null),
      copy: val(eyebrow ? getComputedStyle(eyebrow) : null),
      marker: marker ? { name:marker.animationName, duration:marker.animationDuration, delay:marker.animationDelay } : null,
      viewport: { width, height },
    }
  })
}

async function runChoreography(name, width, height) {
  const c = await browser.newContext({ viewport:{width,height} })
  const p = await c.newPage()
  const errors = []
  const gpu = []
  p.on('console', msg => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return
    if (msg.text().startsWith('[.WebGL-')) gpu.push(msg.text())
    else errors.push(msg.text())
  })
  p.on('pageerror', e => errors.push('pageerror: ' + e.message))
  await boot(p)
  await p.waitForSelector('.tide-intro', { state:'visible', timeout:5000 })

  const meta = await introMeta(p, width, height)
  assert(Math.abs(meta.introHeight-height) < 2 && Math.abs(meta.curtainHeight-height) < 2, `${name}: viewport sizing mismatch`)
  assert(meta.orbit.name.includes('tide-orbit-in') && toMs(meta.orbit.duration) === 520 && toMs(meta.orbit.delay) === 140, `${name}: orbit timing mismatch`)
  assert(meta.core.name.includes('tide-core-in') && toMs(meta.core.duration) === 200 && toMs(meta.core.delay) === 400, `${name}: core timing mismatch`)
  assert(meta.word.name.includes('tide-word-in') && toMs(meta.word.duration.split(',')[0].trim()) === 500 && toMs(meta.word.delay.split(',')[0].trim()) === 500, `${name}: word timing mismatch`)
  assert(meta.copy.name.includes('tide-copy-in') && toMs(meta.copy.duration) === 380 && toMs(meta.copy.delay) === 950, `${name}: copy timing mismatch`)
  assert(meta.marker.name.includes('tide-marker-in') && toMs(meta.marker.duration) === 360 && toMs(meta.marker.delay) === 900, `${name}: marker timing mismatch`)

  await p.waitForSelector('h1[aria-label="Red Tide"]', { state:'attached', timeout:2000 })
  const headingBase = await p.locator('h1[aria-label="Red Tide"]').boundingBox()
  const started = await p.evaluate(() => performance.now())
  await p.waitForTimeout(2100)
  const leaving = await p.locator('.tide-intro--leaving').count()
  if (!leaving) await p.getByRole('button', { name:/Replay intro/ }).click()
  await p.waitForSelector('.tide-intro--leaving', { state:'attached', timeout:3000 })

  const base = await p.evaluate(() => {
    const curtain = document.querySelector('.tide-intro__curtain')
    const surface = document.querySelector('.tide-intro__surface')
    return { curtainTop:curtain.getBoundingClientRect().top, surfaceTop:surface.getBoundingClientRect().top }
  })

  const frames = []
  await fs.mkdir(`${OUT}/${name}`, { recursive:true })
  for (let i=0;i<=7;i++) {
    const t=i*100
    await p.screenshot({ path:`${OUT}/${name}/exit-${String(i).padStart(2,'0')}-${t}ms.png`, fullPage:true })
    frames.push(await p.evaluate(t => {
      const curtain=document.querySelector('.tide-intro__curtain')
      const surface=document.querySelector('.tide-intro__surface')
      return { t, curtainTop:curtain?.getBoundingClientRect().top ?? 0, surfaceTop:surface?.getBoundingClientRect().top ?? 0, intro:!!document.querySelector('.tide-intro'), bg:getComputedStyle(document.body).backgroundColor }
    }, t))
    if (i<7) await p.waitForTimeout(100)
  }
  const drift = Math.max(...frames.filter(f=>f.intro).map(f=>Math.abs((f.curtainTop-base.curtainTop)-(f.surfaceTop-base.surfaceTop))))
  assert(drift < 2, `${name}: surface/curtain drift ${drift}px`)
  await p.waitForTimeout(150)
  assert(await p.locator('.tide-intro').count()===0, `${name}: intro still mounted`)
  const headingEnd = await p.locator('h1[aria-label="Red Tide"]').boundingBox()
  assert(headingEnd && headingBase && Math.abs(headingEnd.x-headingBase.x)<1 && Math.abs(headingEnd.y-headingBase.y)<1 && Math.abs(headingEnd.width-headingBase.width)<1 && Math.abs(headingEnd.height-headingBase.height)<1, `${name}: landing headline geometry changed`)
  assert(await p.locator('h1[aria-label="Red Tide"]').count()===1, `${name}: landing headline double-rendered`)
  const canvasCount = await p.locator('canvas').count()
  assert(canvasCount>=2, `${name}: expected Waves + HeroBackdrop canvases, got ${canvasCount}`)
  assert(errors.length===0, `${name}: console errors/warnings: ${errors.join(' | ')}`)
  await c.close()
  console.log(JSON.stringify({name, started, drift, gpuWarnings:gpu.length}))
}

async function behaviorSuite() {
  const c = await browser.newContext({ viewport:{width:390,height:844} })
  const p = await c.newPage()
  const errors=[]
  p.on('console',m=>{ if((m.type()==='error'||m.type()==='warning')&&!m.text().startsWith('[.WebGL-')) errors.push(m.text()) })
  p.on('pageerror',e=>errors.push('pageerror: '+e.message))
  await boot(p)
  await p.waitForTimeout(3000)
  assert(await p.evaluate(() => sessionStorage.getItem('red-tide-ppc:splash:v1'))==='seen','sessionStorage splash key was not set')
  await p.reload({waitUntil:'domcontentloaded'})
  assert(await p.locator('.tide-intro').count()===0,'intro replayed on same-session refresh')

  for (const t of [300,1200,2500]) {
    const x=await browser.newContext({viewport:{width:390,height:844}}), q=await x.newPage()
    await boot(q); await q.waitForTimeout(t); if(await q.locator('.tide-intro').count()) await q.getByRole('button',{name:/Skip intro/}).click()
    assert(await q.locator('.tide-intro').count()===0,`skip failed at ${t}ms`); await x.close()
  }
  for (const t of [300,1200,2500]) {
    const x=await browser.newContext({viewport:{width:390,height:844}}), q=await x.newPage()
    await boot(q); await q.waitForTimeout(t); if(await q.locator('.tide-intro').count()) await q.keyboard.press('Escape')
    assert(await q.locator('.tide-intro').count()===0,`Escape failed at ${t}ms`); await x.close()
  }

  const replay=await browser.newContext({viewport:{width:390,height:844}}), rp=await replay.newPage()
  await boot(rp); await rp.waitForTimeout(300); await rp.getByRole('button',{name:/Skip intro/}).click(); await rp.getByRole('button',{name:/Replay intro/}).click()
  assert(await rp.locator('.tide-intro').count()===1,'replay did not mount one intro'); await rp.getByRole('button',{name:/Skip intro/}).click(); assert(await rp.locator('.tide-intro').count()===0,'replay left intro mounted'); await replay.close()

  const rm=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}), rmp=await rm.newPage()
  await boot(rmp); assert(await rmp.locator('.tide-intro').count()===0,'reduced-motion intro mounted'); assert(await rmp.getByRole('link',{name:/Open the map/i}).count()===1,'reduced-motion landing missing'); await rm.close()

  const rapid=await browser.newContext({viewport:{width:390,height:844}}), rq=await rapid.newPage()
  await boot(rq)
  for(let i=0;i<4;i++){ if(await rq.getByRole('button',{name:/Skip intro/}).count()) await rq.getByRole('button',{name:/Skip intro/}).click(); if(await rq.getByRole('button',{name:/Replay intro/}).count()) await rq.getByRole('button',{name:/Replay intro/}).click(); await rq.keyboard.press('Escape') }
  await rq.waitForTimeout(500); assert(await rq.locator('.tide-intro').count()===0,'rapid input left overlay mounted'); await rapid.close()
  assert(errors.length===0,`behavior console errors/warnings: ${errors.join(' | ')}`)
  await c.close()
}

const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try {
  await runChoreography('390x844',390,844)
  await runChoreography('1440x900',1440,900)
  const c=await browser.newContext({viewport:{width:360,height:740}}), p=await c.newPage()
  await boot(p)
  const h=await p.locator('.tide-intro').boundingBox(), ch=await p.locator('.tide-intro__curtain').boundingBox()
  assert(Math.abs(h.height-740)<2 && Math.abs(ch.height-740)<2,'360x740 reference-box mismatch')
  await c.close()
  await behaviorSuite()
  console.log('PR56 browser verification: PASS')
} finally { await browser.close(); server.kill('SIGTERM') }
