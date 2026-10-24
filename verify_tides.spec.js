const { test, expect } = require('@playwright/test');

test('verify tides simulation', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1000);

  // Unhide modal and click generate
  await page.evaluate(() => {
    const modal = document.getElementById('modal-terrain');
    if (modal) modal.style.display = 'flex';
  });
  await page.waitForTimeout(300);

  await page.click('#btn-generate-terrain');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/home/jules/verification/screenshots/verification_tides.png' });
});
