import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://192.168.1.51:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  console.log('=== BEFORE CLICK ===');
  let result = await page.evaluate(() => {
    const fixed = document.querySelectorAll('.fixed');
    const inset0 = document.querySelectorAll('[class*="inset-0"]');
    const backdrop = document.querySelectorAll('[class*="backdrop"]');
    const modal = document.querySelectorAll('[class*="modal"]');
    
    return {
      'fixed elements': fixed.length,
      'inset-0 elements': inset0.length,
      'backdrop elements': backdrop.length,
      'modal elements': modal.length,
    };
  });
  console.log(JSON.stringify(result, null, 2));
  
  console.log('\n=== CLICKING P0 TASK ===');
  await page.locator('button:has-text("P0")').first().click();
  await page.waitForTimeout(2000);
  
  console.log('\n=== AFTER CLICK ===');
  result = await page.evaluate(() => {
    const fixed = document.querySelectorAll('.fixed');
    const inset0 = document.querySelectorAll('[class*="inset-0"]');
    const backdrop = document.querySelectorAll('[class*="backdrop"]');
    const modal = document.querySelectorAll('[class*="modal"]');
    const zIndex = Array.from(document.querySelectorAll('*')).filter(el => {
      const z = window.getComputedStyle(el).zIndex;
      return z && z !== 'auto' && parseInt(z) > 40;
    });
    
    return {
      'fixed elements': fixed.length,
      'inset-0 elements': inset0.length,
      'backdrop elements': backdrop.length,
      'modal elements': modal.length,
      'high z-index elements': zIndex.length,
    };
  });
  console.log(JSON.stringify(result, null, 2));
  
  await page.screenshot({ path: '/tmp/modal-rendering-test.png' });
  console.log('\nScreenshot: /tmp/modal-rendering-test.png');
  
  await browser.close();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
