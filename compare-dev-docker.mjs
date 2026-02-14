import { chromium } from 'playwright';

async function testUrl(url, label) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${label} (${url})`);
  console.log('='.repeat(60));
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const p0Count = await page.locator('button:has-text("P0")').count();
    console.log(`P0 tasks found: ${p0Count}`);
    
    if (p0Count > 0) {
      await page.locator('button:has-text("P0")').first().click();
      await page.waitForTimeout(2000);
      
      const modalCount = await page.locator('[role="dialog"]').count();
      const overlayCount = await page.locator('[class*="overlay"], [class*="Overlay"]').count();
      const dialogContent = await page.locator('[class*="DialogContent"]').count();
      
      console.log(`Modal [role=dialog]: ${modalCount}`);
      console.log(`Overlay/backdrop: ${overlayCount}`);
      console.log(`DialogContent: ${dialogContent}`);
      
      if (modalCount > 0) {
        console.log('✅ MODAL WORKS!');
        await page.screenshot({ path: `/tmp/${label.replace(/\s+/g, '-')}-modal-open.png` });
      } else {
        console.log('❌ MODAL BROKEN');
        await page.screenshot({ path: `/tmp/${label.replace(/\s+/g, '-')}-modal-broken.png` });
      }
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
  
  await browser.close();
}

async function main() {
  await testUrl('http://localhost:5174', 'Dev Server');
  await testUrl('http://192.168.1.51:5173', 'Docker UI');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
