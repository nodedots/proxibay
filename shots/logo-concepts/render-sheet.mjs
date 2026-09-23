import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 })
await page.goto('file:///' + process.cwd().replace(/\\/g, '/') + '/shots/logo-concepts/stackduck-preview.html', { waitUntil: 'networkidle0' })
await page.screenshot({ path: 'shots/logo-concepts/stackduck-concepts.png', fullPage: true })
await browser.close()
console.log('Rendered concepts sheet successfully!')
