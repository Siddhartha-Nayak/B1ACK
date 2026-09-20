import { connect, invoke, seed, current, pointerDrag, expect, fs } from './iteration2-helpers.mjs';
const { browser, context, page } = await connect();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
const results = [];
for (const [count, expected] of [
  [1, 1],
  [4, 2],
  [9, 3],
  [16, 4],
]) {
  await seed(page, count);
  await expect(page.locator('.pane-slot')).toHaveCount(count);
  await expect(page.locator('.terminal-layout-scroll')).toHaveAttribute(
    'data-columns',
    String(expected),
  );
  const min = await page
    .locator('.pane-slot')
    .evaluateAll((nodes) => nodes.every((n) => n.clientWidth >= 279 && n.clientHeight >= 209));
  expect(min).toBe(true);
  results.push(`${count} panes: ${expected} adaptive columns, minimum dimensions respected`);
  await page.screenshot({ path: `artifacts/iteration2-grid-${count}.png` });
}
await seed(page, 9, 'tabs');
await page.waitForTimeout(150);
const positions = await page.evaluate(async () => {
  const values = [];
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const rect = document.querySelector('.terminal-stopped button').getBoundingClientRect();
    values.push([rect.x, rect.y]);
  }
  return values;
});
expect(new Set(positions.map((p) => p.join(','))).size).toBe(1);
results.push('Pane geometry remains stable over 20 frames at fractional Windows display scaling');
await page.getByRole('button', { name: 'Start terminal', exact: true }).click();
await expect(page.locator('.xterm-rows')).toContainText('PS ');
await page.getByRole('tab', { name: /^Terminal-9(?: |$)/ }).click();
await page.getByRole('button', { name: 'Start terminal', exact: true }).click();
await expect(page.locator('.xterm-rows')).toContainText('PS ');
await page.getByRole('tab', { name: /^Terminal-1(?: |$)/ }).click();
const before = await invoke(page, 'terminal_inspect');
const first = async () => (await invoke(page, 'terminal_inspect')).find((s) => s.id === 'test-t1');
await page.getByRole('button', { name: 'Grid', exact: true }).click();
const handle = page.getByRole('button', { name: 'Move Terminal-9', exact: true });
await handle.scrollIntoViewIfNeeded();
const source = await handle.boundingBox();
const target = await page.locator('[data-pane-id="test-t2"]').boundingBox();
await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
await page.mouse.down();
await page.mouse.move(target.x + 30, target.y + 20, { steps: 15 });
await expect(page.locator('[data-pane-id="test-t2"]')).toHaveClass(/drop-before/);
await page.mouse.up();
expect((await current(page)).workspaces[0].terminals.map((t) => t.id).slice(0, 3)).toEqual([
  'test-t1',
  'test-t9',
  'test-t2',
]);
for (const session of before)
  expect((await invoke(page, 'terminal_inspect')).find((s) => s.id === session.id).pid).toBe(
    session.pid,
  );
results.push('Drag Terminal 9 before Terminal 2; native PID preserved');
await page.getByLabel('Grid mode').selectOption('manual');
await page.getByLabel('Grid columns').fill('2');
await expect(page.locator('.terminal-layout-scroll')).toHaveAttribute('data-columns', '2');
const originalCols = (await first()).cols;
await pointerDrag(
  page,
  page.getByRole('separator', { name: 'Resize Terminal-1 horizontally', exact: true }),
  220,
  0,
);
await expect.poll(async () => (await first()).cols).toBeGreaterThan(originalCols);
await expect
  .poll(async () => Object.keys((await current(page)).workspaces[0].paneSizes).length)
  .toBeGreaterThan(0);
const sizes = await page
  .locator('.pane-slot')
  .evaluateAll((nodes) => nodes.slice(0, 2).map((n) => n.clientWidth));
expect(sizes[0] / sizes[1]).toBeGreaterThan(1.9);
const originalRows = (await first()).rows;
await pointerDrag(
  page,
  page.getByRole('separator', { name: 'Resize Terminal-1 vertically', exact: true }),
  0,
  100,
);
await expect.poll(async () => (await first()).rows).toBeGreaterThan(originalRows);
for (const session of before)
  expect((await invoke(page, 'terminal_inspect')).find((s) => s.id === session.id).pid).toBe(
    session.pid,
  );
results.push(
  'Horizontal ratio >1.9 and vertical resize propagate to native columns/rows without replacing process',
);
await page.getByRole('button', { name: 'Maximize Terminal-1', exact: true }).click();
await expect(page.locator('.pane-slot')).toHaveCount(1);
await page.getByRole('button', { name: 'Restore layout', exact: true }).click();
await expect(page.locator('.pane-slot')).toHaveCount(9);
results.push('Maximize / restore preserves layout');
await page.getByText('Visible terminals (9)', { exact: true }).click();
await page
  .locator('.visibility-picker label')
  .filter({ hasText: 'Terminal-3' })
  .getByRole('checkbox')
  .uncheck();
await expect(page.locator('.pane-slot')).toHaveCount(8);
await page.getByText('Visible terminals (8)', { exact: true }).click();
results.push('Independent grid visibility');
const saved = await current(page);
await page.reload();
expect((await current(page)).workspaces[0].paneSizes).toEqual(saved.workspaces[0].paneSizes);
await expect(page.locator('.terminal-state.running')).toHaveCount(0);
results.push('Order, pane sizes, columns and visibility survive reload; restored sessions stopped');
for (const width of [1440, 1024, 800, 390, 360]) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (width < 768) await expect(page.locator('.pane-slot')).toHaveCount(1);
  await page.screenshot({ path: `artifacts/iteration2-responsive-${width}.png` });
}
results.push('Responsive 360–1440 px without document overflow');
await cdp.send('Emulation.clearDeviceMetricsOverride');
if (errors.length) throw new Error(errors.join('\n'));
await fs.writeFile(
  'artifacts/iteration2-layout-results.json',
  JSON.stringify({ results, pageErrors: errors }, null, 2),
);
console.log(JSON.stringify({ results, pageErrors: errors }, null, 2));
await browser.close();
