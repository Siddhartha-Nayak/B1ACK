import {
  connect,
  invoke,
  seed,
  current,
  pointerDrag,
  expect,
  fs,
  path,
  key,
} from './iteration2-helpers.mjs';
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
await cdp.send('Performance.enable');
let w = await seed(page, 20, 'tabs');
w.projects = [];
for (let i = 1; i <= 10; i++) {
  const folder = path.resolve(`artifacts/iteration2-projects/Task${i}`);
  await fs.mkdir(folder, { recursive: true });
  w.projects.push({ id: `test-p${i}`, name: `Task${i}`, path: folder });
}
w.terminals = w.terminals.map((t, i) => {
  const p = w.projects[i % 10];
  return {
    ...t,
    name: `${i % 3 === 0 ? 'Codex' : i % 3 === 1 ? 'PowerShell' : 'Cmd'}-${i + 1}`,
    projectId: p.id,
    cwd: p.path,
    command: i % 3 === 0 ? 'codex' : i % 3 === 1 ? 'powershell.exe' : 'cmd.exe',
    args: i % 3 === 0 ? [] : i % 3 === 1 ? ['-NoLogo', '-NoProfile'] : ['/Q'],
  };
});
const personal = {
  ...w,
  id: 'test-personal',
  name: 'Personal',
  projects: [],
  terminals: [],
  visibleTerminalIds: [],
  activeProjectId: null,
  activeTerminalId: null,
  layout: 'split',
};
await page.evaluate(
  ({ key, w, personal }) =>
    localStorage.setItem(
      key,
      JSON.stringify({
        schemaVersion: 2,
        activeWorkspaceId: w.id,
        workspaces: [w, personal],
        customPresets: [],
      }),
    ),
  { key, w, personal },
);
await page.reload();
const phases = [];
async function metric(count) {
  const frame = await page.evaluate(async () => {
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
    return { mean: gaps.reduce((a, b) => a + b, 0) / gaps.length, max: Math.max(...gaps) };
  });
  const metrics = await cdp.send('Performance.getMetrics');
  return {
    sessions: count,
    frameMs: frame,
    jsHeapBytes: metrics.metrics.find((x) => x.name === 'JSHeapUsedSize').value,
    system: await invoke(page, 'system_status'),
    renderedTerminals: await page.locator('.xterm').count(),
  };
}
for (let i = 0; i < 20; i++) {
  const t = w.terminals[i];
  await page.getByRole('tab', { name: new RegExp('^' + t.name + '(?: |$)') }).click();
  await page.getByRole('button', { name: 'Start terminal', exact: true }).click();
  await expect(page.locator('.terminal-card.focused .xterm-rows')).toContainText(
    i % 3 === 0 ? 'Ask Codex' : i % 3 === 1 ? 'PS ' : t.cwd,
    { timeout: 30000 },
  );
  if ([10, 16, 20].includes(i + 1)) {
    expect(await invoke(page, 'terminal_inspect')).toHaveLength(i + 1);
    phases.push(await metric(i + 1));
  }
}
const processes = await invoke(page, 'terminal_inspect');
const inputMs = [],
  switchMs = [];
for (const t of w.terminals) {
  const start = performance.now();
  await page.getByRole('tab', { name: new RegExp('^' + t.name + '(?: |$)') }).click();
  await expect(page.locator('.terminal-card.focused .xterm-rows')).toContainText(
    t.command === 'codex' ? 'Ask Codex' : t.cwd,
  );
  switchMs.push(performance.now() - start);
  if (t.command !== 'codex') {
    const command =
      t.command === 'cmd.exe'
        ? `echo ROUNDTRIP_${t.id}_%CD%\r`
        : `Write-Output ('ROUND'+'TRIP_${t.id}_'+(Get-Location).Path)\r`;
    const begin = performance.now();
    await invoke(page, 'terminal_write', { id: t.id, data: command });
    await expect(page.locator('.terminal-card.focused .xterm-rows')).toContainText(
      `ROUNDTRIP_${t.id}_${t.cwd}`,
    );
    inputMs.push(performance.now() - begin);
    const text = await page.locator('.terminal-card.focused .xterm-rows').innerText();
    for (const other of w.terminals.filter((x) => x.id !== t.id))
      expect(text).not.toContain(`ROUNDTRIP_${other.id}_`);
  }
}
await page.getByRole('tab', { name: /^PowerShell-2(?: |$)/ }).click();
await page.locator('.xterm-helper-textarea').focus();
await page.keyboard.type("Write-Output ('KEY'+'BOARD_OK')");
await page.keyboard.press('Enter');
await expect(page.locator('.xterm-rows')).toContainText('KEYBOARD_OK');
for (const t of w.terminals.filter((t) => t.command === 'powershell.exe'))
  await invoke(page, 'terminal_write', {
    id: t.id,
    data: "1..500 | ForEach-Object { Write-Output ('STREAM_'+$_); Start-Sleep -Milliseconds 40 }\r",
  });
await page.getByRole('button', { name: 'Grid', exact: true }).click();
await page.getByLabel('Grid mode').selectOption('manual');
await page.getByLabel('Grid columns').fill('2');
await page.locator('.terminal-layout-scroll').evaluate((el) => (el.scrollTop = 0));
await expect(page.locator('[data-pane-id="test-t2"] .xterm-rows')).toContainText('STREAM_');
const beforeSize = (await invoke(page, 'terminal_inspect')).find((s) => s.id === 'test-t1');
const resizeStart = performance.now();
await pointerDrag(
  page,
  page.getByRole('separator', { name: 'Resize Codex-1 horizontally', exact: true }),
  150,
  0,
);
await expect
  .poll(async () => (await invoke(page, 'terminal_inspect')).find((s) => s.id === 'test-t1').cols)
  .not.toBe(beforeSize.cols);
const resizeMs = performance.now() - resizeStart;
const handle = page.getByRole('button', { name: 'Move Codex-1', exact: true });
const source = await handle.boundingBox();
const target = await page.locator('[data-pane-id="test-t3"]').boundingBox();
await page.mouse.move(source.x + 5, source.y + 5);
await page.mouse.down();
await page.mouse.move(target.x + 40, target.y + 20, { steps: 12 });
await page.mouse.up();
await expect.poll(async () => (await current(page)).workspaces[0].terminals[0].id).toBe('test-t2');
const underOutput = await metric(20);
await page.screenshot({ path: 'artifacts/iteration2-twenty-live.png' });
for (const t of w.terminals.filter((t) => t.command === 'powershell.exe'))
  await invoke(page, 'terminal_write', { id: t.id, data: '\x03' });
const sorted = (x) => x.map((s) => [s.id, s.pid]).sort((a, b) => a[0].localeCompare(b[0]));
expect(sorted(await invoke(page, 'terminal_inspect'))).toEqual(sorted(processes));
await page.getByRole('button', { name: 'Tabs', exact: true }).click();
await expect(page.locator('.xterm')).toHaveCount(1);
await cdp.send('HeapProfiler.collectGarbage');
const heapBefore = (await cdp.send('Performance.getMetrics')).metrics.find(
  (x) => x.name === 'JSHeapUsedSize',
).value;
for (let i = 0; i < 20; i++) {
  await page.getByLabel('Current workspace').selectOption('test-personal');
  await expect(page.locator('.xterm')).toHaveCount(0);
  await page.getByLabel('Current workspace').selectOption('test-dynamo');
  await expect(page.locator('.xterm')).toHaveCount(1);
}
await cdp.send('HeapProfiler.collectGarbage');
const heapAfter = (await cdp.send('Performance.getMetrics')).metrics.find(
  (x) => x.name === 'JSHeapUsedSize',
).value;
expect(sorted(await invoke(page, 'terminal_inspect'))).toEqual(sorted(processes));
await cdp.send('Emulation.clearDeviceMetricsOverride');
if (errors.length) throw new Error(errors.join('\n'));
const results = {
  phases,
  mix: { codex: 7, powershell: 7, cmd: 6 },
  projects: 10,
  inputRoundTripMs: inputMs,
  switchMs,
  resizeGestureAndNativeUpdateMs: resizeMs,
  underOutput,
  workspaceSwitches: 40,
  collectedHeapBefore: heapBefore,
  collectedHeapAfter: heapAfter,
  heapGrowth: heapAfter - heapBefore,
  pidPreservation: true,
  pageErrors: errors,
  note: 'Real Windows ConPTY and WebView. Codex interactive prompts, no agent tasks submitted. Claude/Gemini unavailable. Timings include Playwright/IPC overhead; host CPU/RAM are system-wide.',
};
await fs.writeFile('artifacts/iteration2-stress-results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
