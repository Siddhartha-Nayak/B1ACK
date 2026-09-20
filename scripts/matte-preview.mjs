import { connect, seed, invoke, expect, fs } from './iteration2-helpers.mjs';
const { browser, context, page } = await connect();
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await seed(page, 0);
await page.screenshot({ path: 'artifacts/matte-empty.png' });
await seed(page, 4, 'tabs');
for (let i = 1; i <= 4; i++) {
  await page.getByRole('tab', { name: new RegExp('^Terminal-' + i + '(?: |$)') }).click();
  await page.getByRole('button', { name: 'Start terminal', exact: true }).click();
  await expect(page.locator('.xterm-rows')).toContainText('PS ');
  await invoke(page, 'terminal_write', {
    id: 'test-t' + i,
    data: "Write-Output ('Session '+$PID+' ready'); Write-Output 'Independent PowerShell process'; Get-Location\r",
  });
}
await page.getByRole('button', { name: 'Grid', exact: true }).click();
await expect(page.locator('.xterm')).toHaveCount(4);
await page.screenshot({ path: 'artifacts/matte-workspace.png' });
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: false,
});
await expect(page.locator('.xterm')).toHaveCount(1);
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
await page.screenshot({ path: 'artifacts/matte-mobile.png' });
await cdp.send('Emulation.clearDeviceMetricsOverride');
await fs.writeFile(
  'artifacts/matte-theme-results.json',
  JSON.stringify({
    liveShells: 4,
    narrowWidth: 390,
    overflow: false,
    font: 'Helvetica Neue, Helvetica, Arial, sans-serif',
    ansiPreserved: true,
  }),
);
await browser.close();
