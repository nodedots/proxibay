import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--hide-scrollbars'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
await page.goto('file:///' + process.cwd().replace(/\\/g, '/') + '/shots/logo-concepts/og.html', { waitUntil: 'networkidle0' })
await page.screenshot({ path: 'public/og-image.png' })
console.log('Regenerated public/og-image.png successfully!')

// Also render a 64x64 favicon.png
const faviconPage = await browser.newPage()
await faviconPage.setViewport({ width: 64, height: 64, deviceScaleFactor: 1 })
await faviconPage.goto('file:///' + process.cwd().replace(/\\/g, '/') + '/public/logo.svg', { waitUntil: 'networkidle0' })
await faviconPage.screenshot({ path: 'public/favicon.png', omitBackground: true })
console.log('Regenerated public/favicon.png successfully!')

await browser.close()
