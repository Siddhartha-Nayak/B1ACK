import { connect, expect, invoke, fs } from './iteration2-helpers.mjs';
const { browser, page } = await connect();
await page.getByRole('button', { name: 'Library', exact: true }).click();
await expect(page.locator('.file-library')).toBeFocused();
await page.getByRole('button', { name: 'New prompt' }).click();
const name = 'extension-check-' + Date.now();
await page.getByLabel('Filename', { exact: true }).fill(name);
await page.getByLabel('Prompt or note').fill('A saved prompt without a typed extension.');
await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
await page.getByRole('button', { name: new RegExp(name + '\\.md') }).click();
await expect(page.getByLabel('Saved text')).toHaveValue(
  'A saved prompt without a typed extension.',
);
await page.getByLabel('Saved text').press('Escape');
await expect(page.locator('.file-library')).toHaveCount(0);
const entry = (await invoke(page, 'library_list')).find((e) => e.name === name + '.md');
await invoke(page, 'library_delete', { id: entry.id });
await fs.writeFile(
  'artifacts/library-keyboard-results.json',
  JSON.stringify(
    { panelFocus: true, defaultMarkdownExtension: true, escapeClosesPanel: true },
    null,
    2,
  ),
);
console.log('Library keyboard and extension checks passed');
await browser.close();
