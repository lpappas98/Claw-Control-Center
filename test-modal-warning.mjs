#!/usr/bin/env node

import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const warnings = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('DialogDescription') || text.includes('aria-describedby')) {
      warnings.push(text);
      console.log(`⚠️  Warning found: ${text}`);
    }
  });
  
  console.log('Opening Docker UI at http://192.168.1.51:5173...');
  await page.goto('http://192.168.1.51:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  console.log('Clicking P0 task to open modal...');
  const p0Button = page.locator('button:has-text("P0")');
  const count = await p0Button.count();
  
  if (count > 0) {
    await p0Button.first().click();
    await page.waitForTimeout(2000);
    
    const modal = await page.locator('[role="dialog"]').count();
    console.log(`Modal opened: ${modal > 0 ? 'YES ✅' : 'NO ❌'}`);
  } else {
    console.log('No P0 tasks found on page');
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`DialogDescription warnings found: ${warnings.length}`);
  
  if (warnings.length > 0) {
    console.log('\n❌ WARNINGS:');
    warnings.forEach(w => console.log(`  ${w}`));
  } else {
    console.log('\n✅ NO DialogDescription/aria-describedby warnings!');
  }
  
  await browser.close();
  
  process.exit(warnings.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
