// Themed screenshot helper — same as capture.mjs but seeds the theme choice
// (localStorage "proxibay-theme") before any page script runs.
// Usage: node shots/capture-theme.mjs <url> <out.png> <light|dark|system> [width] [height] [fullpage] [mobile]
import puppeteer from 'puppeteer-core'

const [url, out, theme = 'light', w = '1440', h = '900', full = '0', mobile = '0', click = ''] = process.argv.slice(2)

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--hide-scrollbars'],
})
const page = await browser.newPage()
const isMobile = mobile === '1'
await page.emulate({
  viewport: { width: Number(w), height: Number(h), deviceScaleFactor: 1, isMobile, hasTouch: isMobile },
  userAgent: isMobile
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    : undefined,
})
await page.evaluateOnNewDocument((t) => {
  try { localStorage.setItem('proxibay-theme', t) } catch { /* ignore */ }
}, theme)
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise((r) => setTimeout(r, 1500))
if (click) {
  await page.click(click)
  await new Promise((r) => setTimeout(r, 400))
}
const metrics = await page.evaluate(() => ({
  innerWidth: window.innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  theme: document.documentElement.dataset.theme,
}))
console.log('viewport:', JSON.stringify(metrics))
await page.screenshot({ path: out, fullPage: full === '1' })
await browser.close()
console.log('saved', out)
