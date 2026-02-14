import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://192.168.1.51:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  await page.locator('button:has-text("P0")').first().click();
  await page.waitForTimeout(2000);
  
  const domInfo = await page.evaluate(() => {
    const fixed = Array.from(document.querySelectorAll('.fixed'));
    
    return fixed.map((el, i) => {
      const computed = window.getComputedStyle(el);
      return {
        index: i,
        tagName: el.tagName,
        className: el.className.substring(0, 100),
        zIndex: computed.zIndex,
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        width: computed.width,
        height: computed.height,
        textContent: el.textContent?.substring(0, 50),
      };
    });
  });
  
  console.log('Fixed elements after click:');
  console.log(JSON.stringify(domInfo, null, 2));
  
  await browser.close();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
