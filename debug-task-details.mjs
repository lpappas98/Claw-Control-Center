import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Opening page...');
  await page.goto('http://192.168.1.51:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Inject script to check task data
  const taskData = await page.evaluate(() => {
    // Find React fiber to access component state
    const buttons = Array.from(document.querySelectorAll('button'));
    const p0Buttons = buttons.filter(b => b.textContent?.includes('P0'));
    
    return {
      totalButtons: buttons.length,
      p0Buttons: p0Buttons.length,
      firstP0Text: p0Buttons[0]?.textContent?.substring(0, 100),
      firstP0OnClick: p0Buttons[0]?.onclick?.toString().substring(0, 200),
    };
  });
  
  console.log('Task data from page:');
  console.log(JSON.stringify(taskData, null, 2));
  
  await browser.close();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
