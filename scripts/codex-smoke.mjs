// Historical v0.1 harness; its storage and layout expectations are obsolete.
throw new Error(
  'Use npm run test:app, then npm run test:desktop or npm run test:stress for isolated v0.2 validation.',
);
import { chromium } from '@playwright/test';
const b = await chromium.connectOverCDP('http://127.0.0.1:9223');
const p = b.contexts()[0].pages()[0];
await p.getByRole('button', { name: 'New terminal', exact: true }).first().click();
await p.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Codex verification');
await p.getByRole('dialog').getByRole('button', { name: 'Start terminal' }).click();
await p.waitForTimeout(4000);
console.log((await p.locator('.terminal-workspace').innerText()).slice(-3500));
await p.screenshot({ path: 'artifacts/codex-startup.png' });
await b.close();
