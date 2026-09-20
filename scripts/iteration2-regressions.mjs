import { connect, invoke, seed, current, expect, fs } from './iteration2-helpers.mjs';
const { browser, page } = await connect();
await seed(page, 2, 'tabs');
const results = [];
await page.getByRole('button', { name: 'Start terminal', exact: true }).click();
await expect(page.locator('.xterm-rows')).toContainText('PS ');
const original = (await invoke(page, 'terminal_inspect'))[0].pid;
await invoke(page, 'terminal_write', {
  id: 'test-t1',
  data: "Write-Output ('BE'+'FORE_RESTART')\r",
});
await expect(page.locator('.xterm-rows')).toContainText('BEFORE_RESTART');
await page.getByRole('button', { name: 'Restart Terminal-1', exact: true }).click();
await expect
  .poll(async () => (await invoke(page, 'terminal_inspect')).find((s) => s.id === 'test-t1')?.pid)
  .not.toBe(original);
await expect(page.locator('.xterm-rows')).toContainText('PS ');
await expect(page.locator('.xterm-rows')).not.toContainText('BEFORE_RESTART');
results.push('Restart creates a new PID and resets only that terminal');
await page.getByRole('button', { name: 'Terminal-1', exact: true }).last().click();
await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Renamed shell');
await page.getByRole('button', { name: 'Save name', exact: true }).click();
expect((await current(page)).workspaces[0].terminals[0].name).toBe('Renamed shell');
await invoke(page, 'terminal_write', {
  id: 'test-t1',
  data: "Write-Output ([char]27+'[31mANSI_RED'+[char]27+'[0m')\r",
});
await expect(page.locator('.xterm-rows')).toContainText('ANSI_RED');
await expect
  .poll(() =>
    page
      .locator('.xterm-rows')
      .evaluate((el) =>
        Array.from(el.querySelectorAll('span')).some(
          (s) =>
            s.textContent.includes('ANSI_RED') &&
            getComputedStyle(s).color === 'rgb(241, 139, 139)',
        ),
      ),
  )
  .toBe(true);
results.push('ANSI color output remains colored in monochrome chrome');
await invoke(page, 'terminal_write', { id: 'test-t1', data: 'exit 7\r' });
await expect(page.locator('.terminal-error')).toContainText('7');
await page.getByRole('button', { name: 'Grid', exact: true }).click();
await expect(page.locator('[data-pane-id="test-t1"] .terminal-state')).toContainText('Exited');
await expect(page.locator('[data-pane-id="test-t1"] .terminal-error')).toContainText('7');
results.push('Exit code remains visible after layout resize');
await page.getByRole('button', { name: 'Tabs', exact: true }).click();
await page.getByRole('button', { name: 'Close Renamed shell', exact: true }).click();
await expect(page.getByRole('tab', { name: /Renamed shell/ })).toHaveCount(0);
results.push('Rename and close terminal');
await page.getByRole('button', { name: 'Add project', exact: true }).click();
await page.getByRole('dialog').getByLabel('Project folder').fill('Z:\\ParallelADE-no-such-project');
await page.getByRole('dialog').getByRole('button', { name: 'Add project', exact: true }).click();
await expect(page.getByRole('dialog').getByRole('alert')).toContainText('folder');
await page.getByRole('button', { name: 'Cancel', exact: true }).click();
results.push('Invalid project path produces a dialog error');
await fs.writeFile(
  'artifacts/iteration2-regression-results.json',
  JSON.stringify({ results }, null, 2),
);
console.log(JSON.stringify({ results }, null, 2));
await browser.close();
