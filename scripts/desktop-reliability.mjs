// Historical v0.1 harness; its storage and layout expectations are obsolete.
throw new Error(
  'Use npm run test:app, then npm run test:desktop or npm run test:stress for isolated v0.2 validation.',
);
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
expect.configure({ timeout: 20000 });
const b = await chromium.connectOverCDP('http://127.0.0.1:9223');
const context = b.contexts()[0];
const p = context.pages()[0];
const client = await context.newCDPSession(p);
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
await p.getByRole('button', { name: 'Shell-1', exact: true }).first().click();
await p.locator('.terminal-card.focused .xterm-helper-textarea').focus();
await p.keyboard.press('Control+Shift+KeyK');
await expect(p.getByRole('dialog')).toBeVisible();
await p.getByRole('textbox', { name: 'Search workspace' }).fill('Shell-2');
await p.getByRole('dialog').getByRole('button').filter({ hasText: 'Shell-2' }).click();
await expect(p.getByRole('tab', { name: 'Shell-2' })).toHaveAttribute('aria-selected', 'true');
await p.locator('.terminal-card.focused .xterm-helper-textarea').focus();
await p.keyboard.press('Control+Tab');
await expect(p.getByRole('tab', { name: 'Shell-3' })).toHaveAttribute('aria-selected', 'true');
await p.keyboard.press('Control+Shift+Tab');
await expect(p.getByRole('tab', { name: 'Shell-2' })).toHaveAttribute('aria-selected', 'true');
await p.locator('.terminal-card.focused .xterm-helper-textarea').focus();
await p.keyboard.press('Control+Shift+KeyO');
await expect(p.getByRole('dialog')).toBeVisible();
await p
  .getByRole('textbox', { name: 'Project folder' })
  .fill('Z:\\parallelade-folder-does-not-exist');
await p.getByRole('dialog').getByRole('button', { name: 'Add project', exact: true }).click();
await expect(p.getByRole('dialog').getByRole('alert')).toContainText('folder');
await p.getByRole('button', { name: 'Close dialog' }).click();
const input = p.locator('.terminal-card.focused .xterm-helper-textarea');
await input.focus();
await input.pressSequentially('exit 7');
await input.press('Enter');
await expect(p.locator('.terminal-state')).toContainText('Exited');
await expect(p.locator('.terminal-error')).toContainText('code 7');
await p.getByRole('button', { name: 'Restart Shell-2', exact: true }).click();
await expect(p.locator('.xterm-rows')).toContainText('PS ');
await client.send('Performance.enable');
const samples = [];
for (let round = 0; round < 4; round++) {
  for (let i = 1; i <= 10; i++) {
    await p
      .getByRole('button', { name: `Codex-${i}`, exact: true })
      .first()
      .click();
    await expect(p.locator('.xterm-rows')).toContainText('Ask Codex');
  }
  await client.send('HeapProfiler.collectGarbage');
  const { metrics } = await client.send('Performance.getMetrics');
  samples.push(metrics.find((x) => x.name === 'JSHeapUsedSize').value);
}
const result = {
  checks: [
    'Keyboard search and next/previous switching',
    'Invalid folder visible inside modal',
    'Nonzero natural exit and restart',
    '40 Codex view remounts preserve interactive prompts',
  ],
  postGcHeapBytes: samples,
  heapGrowthBytes: samples.at(-1) - samples[0],
  pageErrors: errors,
};
if (errors.length) throw new Error(errors.join('\n'));
await fs.writeFile('artifacts/reliability-results.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await b.close();
