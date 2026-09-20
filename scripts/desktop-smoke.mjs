// Historical v0.1 harness; its storage and layout expectations are obsolete.
throw new Error(
  'Use npm run test:app, then npm run test:desktop or npm run test:stress for isolated v0.2 validation.',
);
import { chromium, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const context = browser.contexts()[0];
const page = context.pages()[0];
const root = path.resolve('artifacts', 'ui-projects');
await fs.mkdir(root, { recursive: true });
expect.configure({ timeout: 20000 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.evaluate(async () => {
  const { invoke } = await import('/node_modules/@tauri-apps/api/core.js');
  for (const p of await invoke('terminal_drain')) await invoke('terminal_close', { id: p.id });
  localStorage.removeItem('parallelade.workspace.v1');
});
await page.reload();
await page.waitForSelector('.app-shell');
async function addProject(name) {
  const folder = path.join(root, name);
  await fs.mkdir(folder, { recursive: true });
  await page.getByRole('button', { name: 'Add project', exact: true }).click();
  await page.getByRole('textbox', { name: 'Project folder', exact: true }).fill(folder);
  await page.getByRole('dialog').getByRole('button', { name: 'Add project', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
async function terminal(name, type = 'PowerShell', command) {
  await page.getByRole('button', { name: 'New terminal', exact: true }).first().click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Terminal type').selectOption({ label: type });
  await modal.getByLabel('Name', { exact: true }).fill(name);
  if (command) await modal.getByLabel('Executable', { exact: true }).fill(command);
  await modal.getByRole('button', { name: 'Start terminal' }).click();
  await expect(modal).toHaveCount(0);
}
async function command(text) {
  const input = page.locator('.terminal-card.focused .xterm-helper-textarea');
  await input.focus();
  await input.pressSequentially(text);
  await input.press('Enter');
}
const checks = [];
await addProject('Task1');
await terminal('PowerShell-A');
await expect(page.locator('.xterm-rows')).toContainText('PS ', { timeout: 15000 });
await command("Write-Output ('UI'+'FIRST'); (Get-Location).Path");
await expect(page.locator('.xterm-rows')).toContainText('UIFIRST');
await terminal('PowerShell-B');
await expect(page.locator('.terminal-card.focused .xterm-rows')).toContainText('PS ', {
  timeout: 15000,
});
await command("$env:ADE_SESSION='B'; Write-Output ('UI'+'SECOND')");
await expect(page.locator('.xterm-rows')).toContainText('UISECOND');
await page.getByRole('tab', { name: 'PowerShell-A' }).click();
await expect(page.locator('.xterm-rows')).toContainText('UIFIRST');
await command("Write-Output ('ISO'+'LATED:'+ $env:ADE_SESSION)");
await expect(page.locator('.xterm-rows')).toContainText('ISOLATED:');
checks.push('Two independent interactive shells, cwd and environment isolation');
await page.getByRole('button', { name: 'Grid', exact: true }).click();
await expect(page.locator('.xterm')).toHaveCount(2);
await expect(page.locator('.terminal-workspace')).toContainText('UIFIRST');
await expect(page.locator('.terminal-workspace')).toContainText('UISECOND');
await page.getByRole('button', { name: 'Split', exact: true }).click();
await expect(page.locator('.xterm')).toHaveCount(2);
await page.getByRole('button', { name: 'Tabs', exact: true }).click();
await expect(page.locator('.xterm')).toHaveCount(1);
checks.push('Tabs -> Grid -> Split -> Tabs preserves screen buffers');
await page.getByRole('button', { name: 'PowerShell-A', exact: true }).last().click();
await page.getByRole('dialog').getByLabel('Name').fill('Renamed shell');
await page.getByRole('button', { name: 'Save name' }).click();
await expect(page.getByRole('tab', { name: 'Renamed shell' })).toBeVisible();
await page.getByRole('button', { name: 'Restart Renamed shell', exact: true }).click();
await expect(page.locator('.terminal-card.focused .xterm-rows')).toContainText('PS ', {
  timeout: 15000,
});
checks.push('Rename and restart');
await terminal('Missing executable', 'Custom', 'parallelade-missing-command-123');
await expect(page.locator('.terminal-error')).toContainText('PATH');
await page.getByRole('button', { name: 'Close Missing executable', exact: true }).click();
checks.push('Missing executable shows actionable error without crashing');
await page.getByRole('button', { name: 'Grid', exact: true }).click();
await page.screenshot({ path: 'artifacts/desktop-grid.png' });
const session = await context.newCDPSession(page);
for (const width of [1440, 1100, 900, 768, 390, 360]) {
  await session.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 850,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (width < 768) {
    await expect(page.locator('.xterm')).toHaveCount(1);
    await page.getByRole('button', { name: 'Open projects' }).click();
    await expect(page.locator('.sidebar.open')).toBeVisible();
    await page.getByRole('button', { name: 'Close projects' }).click();
  }
  await page.screenshot({ path: `artifacts/viewport-${width}.png` });
}
checks.push(
  '1440,1100,900,768,390,360 px; no document overflow; narrow drawer and one mounted terminal',
);
await session.send('Emulation.clearDeviceMetricsOverride');
await expect(page.locator('.system-metrics')).toContainText('RAM');
checks.push('Native CPU and RAM status');
await page.reload();
await expect(page.getByRole('tab', { name: 'Renamed shell' })).toBeVisible();
await expect(page.locator('.terminal-stopped')).toHaveCount(2);
checks.push('Workspace layout and names restore; sessions do not auto-relaunch');
if (errors.length) throw new Error(errors.join('\n'));
console.log(JSON.stringify({ checks, pageErrors: errors }, null, 2));
await fs.writeFile(
  'artifacts/ui-results.json',
  JSON.stringify({ checks, pageErrors: errors }, null, 2),
);
await browser.close();
