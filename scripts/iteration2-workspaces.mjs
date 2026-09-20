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
const { browser, page } = await connect();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const results = [];
await seed(page, 1, 'tabs');
await page.getByRole('button', { name: 'Start terminal', exact: true }).click();
await expect(page.locator('.xterm-rows')).toContainText('PS ');
const pid = (await invoke(page, 'terminal_inspect'))[0].pid;
await page.getByRole('button', { name: 'New terminal', exact: true }).click();
const dialog = page.getByRole('dialog');
for (const label of ['Claude Code', 'Gemini CLI']) {
  await dialog.getByLabel('Terminal type').selectOption({ label });
  await expect(dialog.locator('.cli-detection')).toContainText('was not found in PATH');
  await dialog.getByRole('button', { name: 'Retry detection' }).click();
  await expect(dialog.locator('.cli-detection')).toContainText('was not found in PATH');
}
results.push('Claude and Gemini missing PATH feedback and Retry verified (neither is installed)');
await dialog.getByLabel('Terminal type').selectOption('custom');
await dialog.getByLabel('Executable', { exact: true }).fill('cmd.exe');
await dialog.getByLabel('Arguments (JSON array)', { exact: true }).fill('["/Q"]');
await dialog.getByLabel('Name', { exact: true }).fill('Custom shell');
await dialog.getByLabel('Save as a reusable preset').check();
await dialog.getByLabel('Preset name', { exact: true }).fill('Quiet cmd');
await dialog.getByRole('button', { name: 'Start terminal', exact: true }).click();
await expect(dialog).toBeHidden();
await expect(page.locator('.terminal-card.focused .xterm-rows')).toContainText('Task1');
let saved = await current(page);
expect(saved.customPresets[0].name).toBe('Quiet cmd');
expect(saved.workspaces[0].terminals[1].presetId).toBe(saved.customPresets[0].id);
results.push('Saved custom command launched and linked to reusable preset');
await page.getByRole('button', { name: 'Grid', exact: true }).click();
await page.getByLabel('Grid mode').selectOption('manual');
await page.getByLabel('Grid columns').fill('3');
await pointerDrag(
  page,
  page.getByRole('separator', { name: 'Resize sidebar', exact: true }),
  70,
  0,
);
await expect
  .poll(async () => (await current(page)).workspaces[0].sidebarWidth)
  .toBeGreaterThan(280);
await page.getByRole('button', { name: 'Collapse Task1', exact: true }).click();
await page.getByRole('button', { name: 'Manage workspaces', exact: true }).click();
await dialog.getByLabel('New workspace name').fill('Personal');
await dialog.getByRole('button', { name: 'Create workspace', exact: true }).click();
await expect(page.getByLabel('Current workspace')).not.toHaveValue('test-dynamo');
const personal = (await current(page)).activeWorkspaceId;
expect((await invoke(page, 'terminal_inspect')).find((s) => s.id === 'test-t1').pid).toBe(pid);
await page.getByRole('button', { name: 'Manage workspaces', exact: true }).click();
await dialog.getByLabel('Current workspace name').fill('Personal tools');
await dialog.getByRole('button', { name: 'Rename workspace', exact: true }).click();
await page.getByLabel('Current workspace').selectOption('test-dynamo');
await expect(page.getByRole('button', { name: 'Grid', exact: true })).toHaveAttribute(
  'aria-pressed',
  'true',
);
await expect(page.getByLabel('Grid columns')).toHaveValue('3');
await expect(page.getByRole('button', { name: 'Expand Task1', exact: true })).toBeVisible();
expect((await invoke(page, 'terminal_inspect')).find((s) => s.id === 'test-t1').pid).toBe(pid);
results.push(
  'Workspace create/rename/switch preserves live processes, independent layout, sidebar width and project collapse',
);
await page.getByLabel('Manage Task1', { exact: true }).click();
await page.getByLabel('Move Task1 to workspace', { exact: true }).selectOption(personal);
expect((await current(page)).workspaces.find((w) => w.id === personal).terminals).toHaveLength(2);
expect((await invoke(page, 'terminal_inspect')).find((s) => s.id === 'test-t1').pid).toBe(pid);
await page.locator('.search-button').click();
await page.getByLabel('Search workspace').fill('personal task1 terminal-1');
await page.getByLabel('Search workspace').press('Enter');
await expect(page.getByLabel('Current workspace')).toHaveValue(personal);
await expect(page.locator('.xterm-rows')).toContainText('PS ');
results.push('Move project with sessions and cross-workspace token search preserve PID');
await page.getByRole('button', { name: 'Split', exact: true }).click();
await expect(page.locator('.pane-slot')).toHaveCount(2);
const folder = path.resolve('artifacts/iteration2-projects/Task2');
await fs.mkdir(folder, { recursive: true });
await page.getByRole('button', { name: 'Add project', exact: true }).click();
await dialog.getByLabel('Project folder').fill(folder);
await dialog.getByRole('button', { name: 'Add project', exact: true }).click();
await page.getByLabel('Manage Task2', { exact: true }).click();
await page.getByRole('button', { name: 'Move up', exact: true }).last().click();
expect((await current(page)).workspaces.find((w) => w.id === personal).projects[0].name).toBe(
  'Task2',
);
await page.getByRole('button', { name: 'Rename', exact: true }).first().click();
await dialog.getByLabel('Name', { exact: true }).fill('Renamed project');
await dialog.getByRole('button', { name: 'Save name', exact: true }).click();
await fs.rmdir(folder);
await page.evaluate(() => window.dispatchEvent(new Event('focus')));
await expect(page.locator('.missing-folder')).toBeVisible();
results.push('Project add/reorder/rename and external missing-folder detection');
await page.getByLabel('Current workspace').selectOption('test-dynamo');
await page.getByRole('button', { name: 'Manage workspaces', exact: true }).click();
await dialog.getByRole('button', { name: 'Delete current workspace…' }).click();
await dialog.getByRole('button', { name: 'Confirm delete workspace' }).click();
expect((await current(page)).workspaces).toHaveLength(1);
expect((await invoke(page, 'terminal_inspect')).find((s) => s.id === 'test-t1').pid).toBe(pid);
results.push('Delete empty workspace leaves other workspace sessions alive');
saved = await current(page);
await page.reload();
expect(await current(page)).toEqual(saved);
await expect(page.locator('.terminal-state.running')).toHaveCount(0);
results.push(
  'Named workspaces and custom presets persist; processes are not promised across reload',
);
if (errors.length) throw new Error(errors.join('\n'));
await fs.writeFile(
  'artifacts/iteration2-workspace-results.json',
  JSON.stringify({ results, pageErrors: errors }, null, 2),
);
console.log(JSON.stringify({ results, pageErrors: errors }, null, 2));
await browser.close();
