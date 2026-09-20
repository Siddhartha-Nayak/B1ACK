import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9225');
const debug = await browser.newBrowserCDPSession();
const { arguments: launchArgs } = await debug.send('Browser.getBrowserCommandLine');
const dataDir = path.resolve('artifacts/iteration2-release-appdata').toLowerCase();
if (
  !launchArgs.some((arg) =>
    arg
      .toLowerCase()
      .replaceAll(String.fromCharCode(34), '')
      .includes('--user-data-dir=' + dataDir),
  )
)
  throw new Error('Refusing to modify a non-isolated release profile');
const page = browser.contexts()[0].pages()[0];
await page.waitForSelector('.app-shell');
if (!page.url().includes('tauri.localhost')) throw new Error('Expected release origin');
const version = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('plugin:app|version'));
expect(version).toBe('0.2.0');
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
if (process.argv.includes('--restored')) {
  const expected = JSON.parse(
    await fs.readFile('artifacts/iteration2-release-expected.json', 'utf8'),
  );
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('parallelade.library.v2'))),
  ).toEqual(expected);
  await expect(page.locator('.terminal-stopped').first()).toBeVisible();
  expect(
    await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('terminal_inspect')),
  ).toHaveLength(0);
  console.log('PASS: production app restart preserved custom preset, workspace and layout');
  await fs.writeFile(
    'artifacts/iteration2-release-reopen-results.json',
    JSON.stringify({ version, configurationUnchanged: true, stopped: true }),
  );
} else {
  await expect(page.getByRole('heading', { name: 'A little space for big work.' })).toBeVisible();
  await page.getByRole('button', { name: 'Add project', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Project folder')
    .fill(path.resolve('artifacts/iteration2-projects/Task1'));
  await page.getByRole('dialog').getByRole('button', { name: 'Add project', exact: true }).click();
  await page.getByRole('button', { name: 'New terminal', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Terminal type').selectOption('custom');
  await dialog.getByLabel('Name', { exact: true }).fill('Release shell');
  await dialog.getByLabel('Executable', { exact: true }).fill('powershell.exe');
  await dialog.getByLabel('Arguments (JSON array)').fill('["-NoLogo","-NoProfile"]');
  await dialog.getByLabel('Save as a reusable preset').check();
  await dialog.getByLabel('Preset name', { exact: true }).fill('Release PowerShell');
  await dialog.getByRole('button', { name: 'Start terminal', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.xterm-rows')).toContainText('PS ');
  await page.locator('.xterm-helper-textarea').focus();
  await page.keyboard.type("Write-Output ('RELEASE'+'VERIFIED')");
  await page.keyboard.press('Enter');
  await expect(page.locator('.xterm-rows')).toContainText('RELEASEVERIFIED');
  await page.getByRole('button', { name: 'Grid', exact: true }).click();
  await page.getByLabel('Grid mode').selectOption('manual');
  await page.getByLabel('Grid columns').fill('3');
  await expect(page.locator('.system-metrics')).toContainText('RAM');
  await page.screenshot({ path: 'artifacts/iteration2-release.png' });
  await fs.writeFile(
    'artifacts/iteration2-release-expected.json',
    JSON.stringify(
      await page.evaluate(() => JSON.parse(localStorage.getItem('parallelade.library.v2'))),
    ),
  );
  const result = {
    version,
    origin: page.url(),
    interactivePowerShell: true,
    savedCustomPreset: true,
    systemMetrics: true,
    pageErrors: errors,
  };
  await fs.writeFile('artifacts/iteration2-release-results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
if (errors.length) throw new Error(errors.join('\n'));
await browser.close();
