import { connect, invoke, seed, expect, fs } from './iteration2-helpers.mjs';
import path from 'node:path';
const { browser, page } = await connect();
await seed(page, 1, 'tabs');
await page.getByRole('button', { name: 'Start terminal', exact: true }).click();
await expect(page.locator('.xterm-rows')).toContainText('PS ');
const pid = (await invoke(page, 'terminal_inspect'))[0].pid;
const name = `library-test-${Date.now()}.md`;
await page.getByRole('button', { name: 'Library', exact: true }).click();
await page.getByRole('button', { name: 'New prompt' }).click();
await page.getByLabel('Filename', { exact: true }).fill(name);
await page.getByLabel('Prompt or note').fill('Reusable prompt\nKeep this exact.');
await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
await page.getByRole('button', { name: new RegExp(name) }).click();
await expect(page.getByLabel('Saved text')).toHaveValue('Reusable prompt\nKeep this exact.');
await page.getByRole('button', { name: 'Copy text', exact: true }).click();
await expect(page.locator('.file-library [role=status]')).toHaveText('Text copied.');
await invoke(page, 'terminal_write', { id: 'test-t1', data: "Write-Output ('LIBRARY_'+'LIVE')\r" });
await expect(page.locator('.xterm-rows')).toContainText('LIBRARY_LIVE');
expect((await invoke(page, 'terminal_inspect'))[0].pid).toBe(pid);
const entry = (await invoke(page, 'library_list')).find((e) => e.name === name);
const destination = path.resolve('artifacts/library-export.md');
await invoke(page, 'library_export', { id: entry.id, destination });
expect(await fs.readFile(destination, 'utf8')).toBe('Reusable prompt\nKeep this exact.');
const binaryId = crypto.randomUUID();
const binary = path.resolve('artifacts/library-binary.bin');
await fs.writeFile(binary, Buffer.from([0, 255, 127, 1]));
await invoke(page, 'library_add', {
  id: binaryId,
  name: 'binary-test.bin',
  source: binary,
  bytes: null,
});
await fs.writeFile(binary, 'changed original');
expect(await invoke(page, 'library_read', { id: binaryId })).toEqual([0, 255, 127, 1]);
await page.locator('.file-library').evaluate((el) => {
  const bytes = Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    ),
    (c) => c.charCodeAt(0),
  );
  const dt = new DataTransfer();
  dt.items.add(new File([bytes], 'clipboard-test.png', { type: 'image/png' }));
  el.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
  );
});
await page.getByRole('button', { name: /clipboard-test.png/ }).click();
await expect(page.locator('.library-preview img')).toBeVisible();
await expect
  .poll(() => page.locator('.library-preview img').evaluate((img) => img.naturalWidth))
  .toBeGreaterThan(0);
await page.setViewportSize({ width: 390, height: 844 });
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
await page.screenshot({ path: 'artifacts/library-mobile.png' });
await page.setViewportSize({ width: 1440, height: 900 });
await page.screenshot({ path: 'artifacts/library-desktop.png' });
await page.reload();
await page.getByRole('button', { name: 'Library', exact: true }).click();
await page.getByRole('button', { name: new RegExp(name) }).click();
await expect(page.getByLabel('Saved text')).toHaveValue('Reusable prompt\nKeep this exact.');
await expect(invoke(page, 'library_read', { id: '../../escape' })).rejects.toBeTruthy();
for (const e of await invoke(page, 'library_list'))
  if ([entry.id, binaryId].includes(e.id) || e.name === 'clipboard-test.png')
    await invoke(page, 'library_delete', { id: e.id });
await invoke(page, 'terminal_close', { id: 'test-t1' });
await fs.writeFile(
  'artifacts/library-results.json',
  JSON.stringify(
    {
      promptSaveReadCopy: true,
      independentBinaryCopy: true,
      exportBytes: true,
      clipboardImagePreview: true,
      reloadPersistence: true,
      terminalPidPreserved: true,
      mobileOverflow: false,
      pathTraversalRejected: true,
    },
    null,
    2,
  ),
);
console.log('Library desktop checks passed');
await browser.close();
