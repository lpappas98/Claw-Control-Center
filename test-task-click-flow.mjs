import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => console.log(`[PAGE] ${msg.text()}`));
  
  await page.goto('http://192.168.1.51:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Add logging to the page
  await page.evaluate(() => {
    console.log('=== Checking P0 task buttons ===');
    
    const buttons = document.querySelectorAll('button');
    console.log(`Total buttons on page: ${buttons.length}`);
    
    let p0Count = 0;
    buttons.forEach((btn, idx) => {
      if (btn.textContent && btn.textContent.includes('P0')) {
        p0Count++;
        if (p0Count === 1) {
          console.log(`First P0 button (index ${idx}):`);
          console.log(`  Text: "${btn.textContent.substring(0, 80)}"`);
          console.log(`  Disabled: ${btn.disabled}`);
          console.log(`  Type: ${btn.type}`);
          console.log(`  Has onClick: ${btn.onclick !== null}`);
        }
      }
    });
    
    console.log(`Total P0 buttons found: ${p0Count}`);
  });
  
  await page.waitForTimeout(1000);
  
  console.log('\n=== Clicking first P0 button ===');
  await page.locator('button:has-text("P0")').first().click();
  await page.waitForTimeout(2000);
  
  // Check what happened
  const result = await page.evaluate(() => {
    const modals = document.querySelectorAll('[role="dialog"]');
    const overlays = document.querySelectorAll('[class*="overlay"], [class*="Overlay"]');
    
    return {
      modals: modals.length,
      overlays: overlays.length,
      bodyHasCancel: document.body.textContent?.includes('Cancel'),
    };
  });
  
  console.log('\nAfter click:');
  console.log(JSON.stringify(result, null, 2));
  
  await browser.close();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
