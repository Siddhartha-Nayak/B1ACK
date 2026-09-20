// Historical v0.1 harness; its storage and layout expectations are obsolete.
throw new Error(
  'Use npm run test:app, then npm run test:desktop or npm run test:stress for isolated v0.2 validation.',
);
import { chromium, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
expect.configure({ timeout: 20000 });
const b = await chromium.connectOverCDP('http://127.0.0.1:9223');
const p = b.contexts()[0].pages()[0];
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
await expect(p.locator('.app-shell')).toBeVisible();
if (!p.url().includes('tauri.localhost'))
  throw new Error('Expected bundled release origin, got ' + p.url());
if (process.argv.includes('--restored')) {
  await expect(p.getByRole('heading', { name: 'ui-projects', exact: true })).toBeVisible();
  await expect(p.getByRole('tab', { name: 'Release PowerShell' })).toBeVisible();
  await expect(p.locator('.terminal-stopped')).toBeVisible();
  console.log(
    'PASS: release app reopened with saved project, terminal name, and stopped configuration',
  );
} else {
  await p.getByRole('button', { name: 'Add project', exact: true }).click();
  await p
    .getByRole('textbox', { name: 'Project folder' })
    .fill(path.resolve('artifacts/ui-projects'));
  await p.getByRole('dialog').getByRole('button', { name: 'Add project', exact: true }).click();
  await p.getByRole('button', { name: 'New terminal', exact: true }).first().click();
  await p.getByRole('dialog').getByLabel('Terminal type').selectOption({ label: 'PowerShell' });
  await p.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Release PowerShell');
  await p.getByRole('dialog').getByRole('button', { name: 'Start terminal' }).click();
  await expect(p.locator('.xterm-rows')).toContainText('PS ');
  const input = p.locator('.xterm-helper-textarea');
  await input.focus();
  await input.pressSequentially("Write-Output ('RELEASE'+'VERIFIED')");
  await input.press('Enter');
  await expect(p.locator('.xterm-rows')).toContainText('RELEASEVERIFIED');
  await expect(p.locator('.system-metrics')).toContainText('RAM');
  await p.screenshot({ path: 'artifacts/release-smoke.png' });
  const result = {
    origin: p.url(),
    interactivePowerShell: true,
    nativeSystemMetrics: true,
    pageErrors: errors,
  };
  await fs.writeFile('artifacts/release-results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
if (errors.length) throw new Error(errors.join('\n'));
await b.close();
