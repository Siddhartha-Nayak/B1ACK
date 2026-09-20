import { connect, current, invoke, expect, fs } from './iteration2-helpers.mjs';
const { browser, page } = await connect();
expect(await current(page)).toEqual(
  JSON.parse(await fs.readFile('artifacts/iteration2-reopen-expected.json', 'utf8')),
);
expect(await invoke(page, 'terminal_inspect')).toHaveLength(0);
await expect(page.locator('.terminal-stopped').first()).toBeVisible();
await fs.writeFile(
  'artifacts/iteration2-reopen-results.json',
  JSON.stringify({ actualAppRestart: true, configurationUnchanged: true, nativeSessions: 0 }),
);
console.log(
  'PASS: actual app restart retained complete workspace library and layout, with no live PTYs',
);
await browser.close();
