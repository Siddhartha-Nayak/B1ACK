import { connect, current, fs } from './iteration2-helpers.mjs';
const { browser, page } = await connect();
const saved = await current(page);
if (!saved.customPresets.length) throw new Error('Expected saved custom preset');
await fs.writeFile('artifacts/iteration2-reopen-expected.json', JSON.stringify(saved));
await browser.close();
