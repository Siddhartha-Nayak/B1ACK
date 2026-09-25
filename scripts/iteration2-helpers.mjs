import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
expect.configure({ timeout: 20000 });
export async function connect() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9224');
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  await page.waitForSelector('.session-shell, .app-shell');
  await page.evaluate(() => localStorage.setItem('parallelade.view', 'classic'));
  await page.reload();
  await page.waitForSelector('.app-shell');
  const title = await page.evaluate(async () => {
    const { getCurrentWindow } = await import('/node_modules/@tauri-apps/api/window.js');
    return getCurrentWindow().title();
  });
  if (title !== 'ParallelADE Validation')
    throw new Error('Refusing to modify a non-validation app.');
  return { browser, context, page };
}
export async function invoke(page, command, args = {}) {
  return page.evaluate(
    async ({ command, args }) => {
      const { invoke } = await import('/node_modules/@tauri-apps/api/core.js');
      return invoke(command, args);
    },
    { command, args },
  );
}
export const key = 'parallelade.library.v2';
export async function current(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
}
export async function seed(page, count = 1, mode = 'grid') {
  for (const session of await invoke(page, 'terminal_inspect'))
    await invoke(page, 'terminal_close', { id: session.id });
  const folder = path.resolve('artifacts/iteration2-projects/Task1');
  await fs.mkdir(folder, { recursive: true });
  const workspace = {
    id: 'test-dynamo',
    name: 'Dynamo',
    projects: [{ id: 'test-p1', name: 'Task1', path: folder, collapsed: false }],
    terminals: Array.from({ length: count }, (_, i) => ({
      id: `test-t${i + 1}`,
      name: `Terminal-${i + 1}`,
      projectId: 'test-p1',
      command: 'powershell.exe',
      args: ['-NoLogo', '-NoProfile'],
      cwd: folder,
      presetId: 'powershell',
      createdAt: Date.now(),
    })),
    layout: mode,
    gridColumns: null,
    paneSizes: {},
    visibleTerminalIds: Array.from({ length: count }, (_, i) => `test-t${i + 1}`),
    sidebarWidth: 228,
    sidebarCollapsed: false,
    activeProjectId: 'test-p1',
    activeTerminalId: count ? 'test-t1' : null,
  };
  await page.evaluate(
    ({ key, value }) => {
      localStorage.removeItem(key + '.backup');
      localStorage.removeItem('parallelade.workspace.v1');
      localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key,
      value: {
        schemaVersion: 2,
        activeWorkspaceId: workspace.id,
        workspaces: [workspace],
        customPresets: [],
      },
    },
  );
  await page.reload();
  await page.waitForSelector('.app-shell');
  return workspace;
}
export async function pointerDrag(page, handle, dx, dy) {
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  if (!box) throw new Error('No handle');
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  await page.mouse.up();
}
export { expect, fs, path };
