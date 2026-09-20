// Historical v0.1 harness; its storage and layout expectations are obsolete.
throw new Error(
  'Use npm run test:app, then npm run test:desktop or npm run test:stress for isolated v0.2 validation.',
);
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
expect.configure({ timeout: 25000 });
const b = await chromium.connectOverCDP('http://127.0.0.1:9223');
const context = b.contexts()[0];
const p = context.pages()[0];
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
await p.evaluate(async () => {
  const { invoke } = await import('/node_modules/@tauri-apps/api/core.js');
  for (const s of await invoke('terminal_drain')) await invoke('terminal_close', { id: s.id });
  localStorage.removeItem('parallelade.workspace.v1');
});
await p.reload();
const timings = [];
for (let i = 1; i <= 10; i++) {
  const folder = path.resolve('artifacts', `concurrency-project-${i}`);
  await fs.mkdir(folder, { recursive: true });
  await p.getByRole('button', { name: 'Add project', exact: true }).click();
  await p.getByRole('textbox', { name: 'Project folder', exact: true }).fill(folder);
  await p.getByRole('dialog').getByRole('button', { name: 'Add project', exact: true }).click();
  await p.getByRole('button', { name: 'New terminal', exact: true }).click();
  await p.getByRole('dialog').getByLabel('Name', { exact: true }).fill(`Codex-${i}`);
  await p.getByRole('dialog').getByRole('button', { name: 'Start terminal' }).click();
  await expect(p.locator('.terminal-state')).toContainText('Running');
  await expect(p.locator('.xterm-rows')).toContainText('Ask Codex', { timeout: 30000 });
}
await expect(p.locator('.statusbar')).toContainText('10 running');
for (let i = 1; i <= 10; i++) {
  const before = Date.now();
  await p
    .getByRole('button', { name: `Codex-${i}`, exact: true })
    .first()
    .click();
  await expect(p.locator('.terminal-card .xterm-rows')).toContainText('Ask Codex');
  timings.push(Date.now() - before);
  await expect(p.locator('.terminal-path')).toContainText(`concurrency-project-${i}`);
}
await p.screenshot({ path: 'artifacts/ten-codex-sessions.png' });
// Add ten real shells to the selected project; Codex sessions stay alive.
for (let i = 1; i <= 10; i++) {
  await p.getByRole('button', { name: 'New terminal', exact: true }).click();
  await p.getByRole('dialog').getByLabel('Terminal type').selectOption({ label: 'PowerShell' });
  await p.getByRole('dialog').getByLabel('Name', { exact: true }).fill(`Shell-${i}`);
  await p.getByRole('dialog').getByRole('button', { name: 'Start terminal' }).click();
  await expect(p.locator('.terminal-card.focused .xterm-rows')).toContainText('PS ');
}
await expect(p.locator('.statusbar')).toContainText('20 running');
await p.getByRole('button', { name: 'Grid', exact: true }).click();
expect(await p.locator('.xterm').count()).toBeLessThanOrEqual(4);
const gridBefore = Date.now();
await p.getByRole('button', { name: 'Previous', exact: false }).click();
expect(await p.locator('.xterm').count()).toBeLessThanOrEqual(4);
await p.getByRole('button', { name: 'Tabs', exact: true }).click();
await expect(p.locator('.xterm')).toHaveCount(1);
const frameTimes = await p.evaluate(async () => {
  const gaps = [];
  let last = performance.now();
  for (let i = 0; i < 60; i++)
    await new Promise((resolve) =>
      requestAnimationFrame((now) => {
        gaps.push(now - last);
        last = now;
        resolve();
      }),
    );
  return gaps;
});
await p.screenshot({ path: 'artifacts/twenty-sessions.png' });
const client = await context.newCDPSession(p);
await client.send('Performance.enable');
const metrics = await client.send('Performance.getMetrics');
const results = {
  codexSessions: 10,
  shellSessions: 10,
  projects: 10,
  total: 20,
  switchMs: timings,
  gridActionMs: Date.now() - gridBefore,
  frameMs: {
    max: Math.max(...frameTimes),
    mean: frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length,
  },
  jsHeapBytes: metrics.metrics.find((x) => x.name === 'JSHeapUsedSize')?.value,
  pageErrors: errors,
  note: 'Interactive startup, switching and shell concurrency. No Codex agent task submitted; not an active inference-load benchmark.',
};
await fs.writeFile('artifacts/stress-results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (errors.length) throw new Error(errors.join('\n'));
await b.close();
