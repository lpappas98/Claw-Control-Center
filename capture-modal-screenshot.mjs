import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 }
  });
  
  console.log('Opening UI...');
  await page.goto('http://192.168.1.51:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  
  // Take screenshot before click
  await page.screenshot({ path: '/tmp/tars-before-click.png', fullPage: false });
  console.log('Screenshot 1: Before click');
  
  console.log('Clicking P0 task...');
  await page.locator('button:has-text("P0")').first().click();
  await page.waitForTimeout(3000);
  
  // Take screenshot after click
  await page.screenshot({ path: '/tmp/tars-after-click.png', fullPage: false });
  console.log('Screenshot 2: After click');
  
  // Check what's visible
  const info = await page.evaluate(() => {
    const modalContainer = document.querySelector('.fixed.inset-0.flex');
    if (modalContainer) {
      const rect = modalContainer.getBoundingClientRect();
      const computed = window.getComputedStyle(modalContainer);
      return {
        found: true,
        visible: computed.visibility !== 'hidden' && computed.display !== 'none',
        opacity: computed.opacity,
        zIndex: computed.zIndex,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    }
    return { found: false };
  });
  
  console.log('\nModal info:', JSON.stringify(info, null, 2));
  
  await browser.close();
  
  console.log('\n✅ Screenshots ready to send:');
  console.log('   /tmp/tars-before-click.png');
  console.log('   /tmp/tars-after-click.png');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
