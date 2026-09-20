import { chromium, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9225');
const cdp = await browser.newBrowserCDPSession();
const { arguments: args } = await cdp.send('Browser.getBrowserCommandLine');
const profile = path.resolve('artifacts/iteration2-release-appdata').toLowerCase();
if (
  !args.some((arg) =>
    arg
      .toLowerCase()
      .replaceAll('"', '')
      .includes('--user-data-dir=' + profile),
  )
)
  throw new Error('Expected isolated release profile');
const page = browser.contexts()[0].pages()[0];
await expect(page.locator('.app-shell')).toHaveCSS('background-color', 'rgb(7, 7, 8)');
expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontFamily)).toContain(
  'Helvetica Neue',
);
await page.getByRole('button', { name: 'Start terminal', exact: true }).click();
await expect(page.locator('.xterm-rows')).toContainText('PS ');
const result = {
  packagedSilverTheme: true,
  helveticaFontStack: true,
  interactivePowerShell: true,
  origin: page.url(),
};
await fs.writeFile('artifacts/silver-release-results.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
