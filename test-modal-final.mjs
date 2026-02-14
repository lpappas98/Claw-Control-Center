import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  console.log('Opening Docker UI...');
  await page.goto('http://192.168.1.51:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  
  console.log('Clicking P0 task...');
  await page.locator('button:has-text("P0")').first().click();
  await page.waitForTimeout(2000);
  
  // Check modal
  const result = await page.evaluate(() => {
    const modalContainer = document.querySelector('.fixed.inset-0.flex');
    if (modalContainer) {
      const rect = modalContainer.getBoundingClientRect();
      const computed = window.getComputedStyle(modalContainer);
      const modalContent = modalContainer.querySelector('.relative');
      const contentRect = modalContent?.getBoundingClientRect();
      
      return {
        found: true,
        containerTop: rect.top,
        containerHeight: rect.height,
        contentTop: contentRect?.top,
        contentHeight: contentRect?.height,
        zIndex: computed.zIndex,
        position: computed.position,
        display: computed.display,
      };
    }
    return { found: false };
  });
  
  console.log('\nModal status:');
  console.log(JSON.stringify(result, null, 2));
  
  if (result.found && result.containerTop < 100 && result.contentTop && result.contentTop < 600) {
    console.log('\n✅ MODAL WORKING! Positioned correctly in viewport.');
    await page.screenshot({ path: '/tmp/modal-working.png' });
    console.log('Screenshot: /tmp/modal-working.png');
  } else if (result.found) {
    console.log('\n❌ MODAL RENDERED but positioned incorrectly');
    console.log(`   Container top: ${result.containerTop}px (should be near 0)`);
    console.log(`   Content top: ${result.contentTop}px (should be visible in viewport)`);
    await page.screenshot({ path: '/tmp/modal-broken-position.png' });
  } else {
    console.log('\n❌ MODAL NOT FOUND');
    await page.screenshot({ path: '/tmp/modal-not-found.png' });
  }
  
  await browser.close();
  
  process.exit(result.found && result.containerTop < 100 ? 0 : 1);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
