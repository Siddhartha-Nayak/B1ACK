import { connect, invoke, seed, current, expect, fs, path } from './iteration2-helpers.mjs';
import { spawnSync } from 'node:child_process';

const { browser, page } = await connect();
const results = [];
const errors = [];
let step = 'initial';
page.on('pageerror', (error) => errors.push(`${step}: ${error.stack || String(error)}`));

await seed(page, 2, 'grid');
step = 'launch preset';
await page.getByRole('button', { name: 'Launch presets' }).click();
const launchDialog = page.getByRole('dialog', { name: 'Launch presets' });
await launchDialog.getByRole('textbox', { name: 'Preset name' }).fill('Review pair');
await launchDialog.getByRole('button', { name: 'Save current layout' }).click();
await expect(launchDialog.getByText('Review pair')).toBeVisible();
await launchDialog.getByRole('button', { name: 'Launch', exact: true }).click();
await expect(page.getByRole('tab')).toHaveCount(4);
expect((await current(page)).workspaces[0].launchPresets).toHaveLength(1);
results.push('Launch preset saves visible terminal definitions and starts a fresh group');

step = 'session folder';
await page.getByLabel('Manage Task1', { exact: true }).click();
await page.getByRole('button', { name: 'New session folder' }).click();
await page.getByRole('textbox', { name: 'Session folder name' }).fill('Feature');
await page.getByRole('button', { name: 'Add', exact: true }).click();
await page
  .getByRole('combobox', { name: 'Move Terminal-1 to session folder' })
  .first()
  .selectOption({ label: 'Feature' });
await expect(page.locator('.session-folder')).toContainText('Terminal-1');
results.push('Session folder groups an existing terminal without restarting it');

step = 'agent readiness';
await page.getByRole('button', { name: 'Set up agents' }).click();
const readiness = page.getByRole('dialog', { name: 'Agent readiness' });
await expect(readiness.locator('.agent-readiness-summary')).toContainText('tools ready');
await expect(readiness).toContainText('Nothing is installed automatically');
await readiness.getByRole('button', { name: 'Not now' }).click();
results.push('Provider readiness checks installed CLIs without automatic installation');

step = 'attention exit';
const running = (await invoke(page, 'terminal_inspect')).find(
  (terminal) => !['test-t1', 'test-t2'].includes(terminal.id),
);
expect(running).toBeTruthy();
await invoke(page, 'terminal_write', { id: running.id, data: 'exit 7\r' });
await expect(page.locator('.attention-jump')).toBeVisible();
await page.locator('.attention-jump').click();
expect((await current(page)).workspaces[0].activeTerminalId).toBe(running.id);
results.push('Nonzero process exit raises an attention jump to the affected terminal');

step = 'worktree';
const artifactRoot = path.resolve('artifacts/iteration3-worktrees');
await fs.mkdir(artifactRoot, { recursive: true });
const repo = await fs.mkdtemp(path.join(artifactRoot, 'source-'));
const git = (...args) => {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
};
git('init');
await fs.writeFile(path.join(repo, 'sample.txt'), 'worktree validation\n');
git('add', 'sample.txt');
git(
  '-c',
  'user.name=ParallelADE Test',
  '-c',
  'user.email=test@example.invalid',
  'commit',
  '-m',
  'Initial',
);
await page.getByRole('button', { name: 'Add project', exact: true }).click();
await page.getByRole('dialog', { name: 'Add project' }).getByLabel('Project folder').fill(repo);
await page
  .getByRole('dialog', { name: 'Add project' })
  .getByRole('button', { name: 'Add project' })
  .click();
await page
  .getByRole('dialog', { name: 'Agent readiness' })
  .getByRole('button', { name: 'Not now' })
  .click();
await page.getByRole('button', { name: 'New worktree' }).click();
const worktree = page.getByRole('dialog', { name: 'New Git worktree' });
const slug = `verify-${Date.now()}`;
await worktree.getByRole('textbox', { name: 'New branch' }).fill(`codex/${slug}`);
await worktree.getByRole('textbox', { name: 'Directory name' }).fill(slug);
await worktree.getByRole('button', { name: 'Create worktree' }).click();
await expect(page.getByRole('heading', { name: slug })).toBeVisible();
const added = (await current(page)).workspaces[0].projects.find((project) => project.name === slug);
expect(added?.worktreeOf).toBeTruthy();
expect(path.resolve(added?.path)).toBe(path.resolve(artifactRoot, slug));
await expect(page.locator('.session-folder').last()).toContainText(`codex/${slug}`);
results.push('Manual Git worktree creates a separate checkout, project, and shell group');

expect(errors).toEqual([]);
console.log(JSON.stringify({ results, pageErrors: errors }, null, 2));
await browser.close();
