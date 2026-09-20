import { connect, invoke, current, key, expect, fs, path } from './iteration2-helpers.mjs';
const { browser, page } = await connect();
for (const e of await invoke(page, 'library_list'))
  if (e.name === 'large-library-test.dat') await invoke(page, 'library_delete', { id: e.id });
const id = crypto.randomUUID();
const source = path.resolve('artifacts/library-large.dat');
await fs.writeFile(source, Buffer.alloc(10 * 1024 * 1024 + 1, 42));
await invoke(page, 'library_add', { id, name: 'large-library-test.dat', source, bytes: null });
await expect(invoke(page, 'library_read', { id })).rejects.toThrow('10 MB');
await invoke(page, 'library_export', {
  id,
  destination: path.resolve('artifacts/library-large-export.dat'),
});
expect((await fs.stat('artifacts/library-large-export.dat')).size).toBe(10 * 1024 * 1024 + 1);
const invalidId = crypto.randomUUID();
await expect(
  invoke(page, 'library_add', {
    id: invalidId,
    name: 'missing.txt',
    source: path.resolve('artifacts/no-such-library-file'),
    bytes: null,
  }),
).rejects.toBeTruthy();
expect((await invoke(page, 'library_list')).some((e) => e.id === invalidId)).toBe(false);
const state = await current(page);
state.workspaces.push({
  ...state.workspaces[0],
  id: 'library-other-workspace',
  name: 'Library other workspace',
  terminals: [],
  projects: [],
  activeProjectId: null,
  activeTerminalId: null,
  visibleTerminalIds: [],
});
await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
  key,
  state,
});
await page.reload();
await page.getByRole('button', { name: 'Library', exact: true }).click();
await page.getByLabel('Current workspace').selectOption('library-other-workspace');
await expect(page.getByRole('button', { name: /large-library-test.dat/ })).toBeVisible();
await page.getByLabel('Current workspace').selectOption(state.workspaces[0].id);
await expect(page.getByRole('button', { name: /large-library-test.dat/ })).toBeVisible();
await invoke(page, 'library_delete', { id });
await fs.writeFile(
  'artifacts/library-edge-results.json',
  JSON.stringify(
    {
      largeImportAndExport: true,
      previewLimit: true,
      failedImportCleanup: true,
      globalAcrossWorkspaces: true,
    },
    null,
    2,
  ),
);
console.log('Library limits, failure cleanup and global workspace checks passed');
await browser.close();
