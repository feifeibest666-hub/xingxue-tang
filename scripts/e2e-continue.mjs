// 结果页「继续：第 N 天」必须打开下一课。手机宽度。
// 用法：BASE=http://127.0.0.1:4174/xingxue-tang/ node scripts/e2e-continue.mjs
import { chromium } from 'playwright-core'

const BASE = process.env.BASE || 'http://127.0.0.1:4174/xingxue-tang/'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/local/bin/google-chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'zh-CN' })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

async function finishLesson(day) {
  await page.goto(`${BASE}#/lesson/${day}`)
  await page.getByRole('button', { name: /开始上课|再学一遍/ }).click()
  for (let guard = 0; guard < 200; guard++) {
    await page.waitForTimeout(80)
    const nextBtn = page.locator('.nav-btns .btn.primary')
    const label = (await nextBtn.textContent()) || ''
    if (/去做小题/.test(label)) { await nextBtn.click(); break }
    if (/下一屏|下一步/.test(label)) { await nextBtn.click(); continue }
    break
  }
  for (let guard = 0; guard < 40; guard++) {
    await page.waitForTimeout(200)
    if (await page.locator('.result').count()) break
    const t = (await page.locator('.quiz-n span').last().textContent()) || ''
    if (t === '选择') await page.locator('.opt').first().click()
    else if (t === '分步') {
      for (let k = 0; k < 8; k++) { const o = page.locator('.opts').last().locator('.opt:not([disabled])').first(); if (!(await o.count())) break; await o.click(); await page.waitForTimeout(350) }
    } else if (t === '分类') {
      for (let k = 0; k < 20; k++) { const b = page.locator('.bins .tag').first(); if (!(await b.count())) break; await b.click() }
    } else if (t === '排顺序') {
      const c = await page.locator('.order-item').count()
      for (let k = 0; k < c; k++) await page.locator('.order-item').filter({ has: page.locator('.on:empty') }).first().click()
    } else if (t === '算一算') { await page.locator('.calc-row input').fill('1'); await page.getByRole('button', { name: '核对' }).click() }
    else if (t === '讲给我听') { const it = page.locator('.explain-pts .task:not(.on)'); while (await it.count()) await it.first().click() }
    const nb = page.locator('.nav-btns .btn.primary')
    if (await nb.isDisabled()) throw new Error(`day ${day} quiz stuck`)
    await nb.click()
  }
  await page.getByRole('button', { name: /点亮今天的星/ }).click()
  await page.getByRole('link', { name: new RegExp(`继续：第 ${day + 1} 天`) }).waitFor()
}

await page.goto(BASE)
await page.waitForTimeout(800)
const welcome = page.getByRole('button', { name: /从这里开始/ })
if (await welcome.count()) await welcome.click()
await finishLesson(2)
const cont = page.getByRole('link', { name: '继续：第 3 天' })
const back = page.getByRole('link', { name: '回到今日' })
for (const loc of [cont, back]) {
  const box = await loc.boundingBox()
  const top = await page.evaluate((b) => document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.tagName, box)
  if (top !== 'A') errors.push(`covered by ${top}`)
}
await cont.click()
await page.waitForFunction(() => location.hash === '#/lesson/3')
await page.getByRole('button', { name: /开始上课|再学一遍/ }).waitFor()
const shown = (await page.locator('.cd-num').textContent())?.trim()
if (shown !== '3') errors.push(`continue showed day ${shown}`)
await page.goto(`${BASE}#/lesson/2`)
await page.getByRole('button', { name: '直接做题' }).click()
for (let guard = 0; guard < 40; guard++) {
  await page.waitForTimeout(150)
  if (await page.locator('.result').count()) break
  const t = (await page.locator('.quiz-n span').last().textContent()) || ''
  if (t === '选择') await page.locator('.opt').first().click()
  else if (t === '讲给我听') { const it = page.locator('.explain-pts .task:not(.on)'); while (await it.count()) await it.first().click() }
  else if (t === '分步') { const o = page.locator('.opts').last().locator('.opt:not([disabled])').first(); if (await o.count()) await o.click() }
  const nb = page.locator('.nav-btns .btn.primary')
  if (await nb.isDisabled()) break
  await nb.click()
}
const light = page.getByRole('button', { name: /点亮今天的星/ })
if (await light.count()) await light.click()
await page.getByRole('link', { name: '回到今日' }).click()
await page.waitForFunction(() => location.hash.startsWith('#/today'))
await page.locator('.today-head h1').waitFor()
await page.goto(`${BASE}#/stage/1`)
await page.locator('a.ll[href="#/lesson/3"]').click()
await page.waitForFunction(() => location.hash === '#/lesson/3')
await page.locator('.cd-num').waitFor()
console.log(errors.length ? 'FAIL ' + errors.join('; ') : 'continue path ok')
await browser.close()
if (errors.length) process.exit(1)
