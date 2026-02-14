import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  const logs = [];
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`❌ Page error: ${error.message}`);
  });
  
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      console.log(`❌ Console error: ${msg.text()}`);
    }
  });
  
  console.log('Opening http://192.168.1.51:5173...');
  await page.goto('http://192.168.1.51:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  console.log('\nChecking initial state...');
  const p0Buttons = await page.locator('button:has-text("P0")').all();
  console.log(`Found ${p0Buttons.length} P0 buttons`);
  
  if (p0Buttons.length > 0) {
    const firstButton = p0Buttons[0];
    const buttonText = await firstButton.textContent();
    console.log(`First P0 button text: "${buttonText}"`);
    
    console.log('\nClicking first P0 button...');
    await firstButton.click();
    
    // Wait and check what happened
    await page.waitForTimeout(2000);
    
    // Check for modal with various selectors
    const checks = {
      'role=dialog': await page.locator('[role="dialog"]').count(),
      '.modal': await page.locator('.modal').count(),
      '[class*="Modal"]': await page.locator('[class*="Modal"]').count(),
      '[class*="dialog"]': await page.locator('[class*="dialog"]').count(),
      'DialogContent': await page.locator('[class*="DialogContent"]').count()
    };
    
    console.log('\nModal element checks:');
    for (const [selector, count] of Object.entries(checks)) {
      console.log(`  ${selector}: ${count}`);
    }
    
    // Check if overlay exists (sign modal might be opening)
    const overlay = await page.locator('[class*="overlay"], [class*="Overlay"], [class*="backdrop"]').count();
    console.log(`  Overlay/backdrop: ${overlay}`);
  }
  
  console.log(`\nErrors: ${errors.length}`);
  console.log(`Console logs: ${logs.length}`);
  
  await page.screenshot({ path: '/tmp/modal-debug.png' });
  console.log('\nScreenshot saved: /tmp/modal-debug.png');
  
  await browser.close();
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
