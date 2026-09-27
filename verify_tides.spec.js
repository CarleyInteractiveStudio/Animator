const { test, expect } = require('@playwright/test');

test('verify tides simulation', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1000);

  // Trigger modal display via evaluate to bypass dropdown hover
  await page.evaluate(() => {
    document.getElementById('modal-terrain').style.display = 'flex';
  });
  await page.waitForTimeout(500);

  // Click generate terrain
  await page.click('#btn-generate-terrain');
  await page.waitForTimeout(2500);

  // Click play simulation button to start real-time tides
  await page.click('#btn-play-sim');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/home/jules/verification/screenshots/verification_tides.png' });
});
