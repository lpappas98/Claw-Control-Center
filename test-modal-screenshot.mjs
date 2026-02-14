import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Opening Docker UI at http://192.168.1.51:5173...');
  await page.goto('http://192.168.1.51:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  
  // Take screenshot of initial page
  await page.screenshot({ path: '/tmp/modal-test-1-initial.png', fullPage: false });
  console.log('✅ Screenshot 1: Initial page saved');
  
  const p0Count = await page.locator('button:has-text("P0")').count();
  console.log(`P0 tasks found: ${p0Count}`);
  
  if (p0Count > 0) {
    console.log('Clicking first P0 task...');
    await page.locator('button:has-text("P0")').first().click();
    await page.waitForTimeout(2000);
    
    // Take screenshot after click
    await page.screenshot({ path: '/tmp/modal-test-2-after-click.png', fullPage: false });
    console.log('✅ Screenshot 2: After click saved');
    
    // Check for modal
    const modalCount = await page.locator('[role="dialog"]').count();
    console.log(`Modals found: ${modalCount}`);
    
    if (modalCount > 0) {
      console.log('✅ Modal IS visible!');
      await page.screenshot({ path: '/tmp/modal-test-3-modal-visible.png', fullPage: false });
      console.log('✅ Screenshot 3: Modal visible saved');
    } else {
      console.log('❌ Modal NOT visible');
      
      // Check page HTML
      const html = await page.content();
      console.log(`Page HTML length: ${html.length} chars`);
      
      // Check what elements exist
      const allDialogs = await page.locator('[role="dialog"], .modal, [class*="modal"], [class*="Modal"]').count();
      console.log(`All dialog-like elements: ${allDialogs}`);
      
      // Check if click actually worked
      const bodyText = await page.locator('body').textContent();
      console.log(`Body contains "Cancel": ${bodyText.includes('Cancel')}`);
      console.log(`Body contains "Save": ${bodyText.includes('Save')}`);
    }
  } else {
    console.log('❌ No P0 tasks found');
  }
  
  await browser.close();
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
