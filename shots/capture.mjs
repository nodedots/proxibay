// Screenshot helper: real device emulation via CDP (headless --window-size
// clamps the layout viewport to 512px minimum, which fakes mobile overflow).
// Usage: node shots/capture.mjs <url> <out.png> <width> <height> [fullpage]
import puppeteer from 'puppeteer-core'

const [url, out, w = '390', h = '844', full = '0', mobile = '1'] = process.argv.slice(2)

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--hide-scrollbars'],
})
const page = await browser.newPage()
const isMobile = mobile === '1'
await page.emulate({
  viewport: {
    width: Number(w),
    height: Number(h),
    deviceScaleFactor: 1,
    isMobile,
    hasTouch: isMobile,
  },
  userAgent: isMobile
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    : undefined,
})
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise((r) => setTimeout(r, 1500))
const metrics = await page.evaluate(() => ({
  innerWidth: window.innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
}))
console.log('viewport:', JSON.stringify(metrics))
await page.screenshot({ path: out, fullPage: full === '1' })
await browser.close()
console.log('saved', out)
