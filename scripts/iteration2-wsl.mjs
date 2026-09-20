import { connect, invoke, current, expect, fs } from './iteration2-helpers.mjs';
const { browser, page } = await connect();
await page.getByRole('button', { name: 'New terminal', exact: true }).click();
await page.getByRole('dialog').getByLabel('Terminal type').selectOption('wsl');
await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('WSL validation');
await page.getByRole('dialog').getByRole('button', { name: 'Start terminal', exact: true }).click();
await expect(page.getByRole('dialog')).toBeHidden();
try {
  await expect
    .poll(
      async () =>
        /Create a default Unix|[$#]\s/.test(await page.locator('.xterm-rows').innerText()),
      { timeout: 45000 },
    )
    .toBe(true);
  const text = await page.locator('.xterm-rows').innerText();
  if (text.includes('Create a default Unix')) {
    const result = {
      ptyLaunch: true,
      interactiveShell: false,
      reason: 'Default distribution requires first-run account setup. Setup was not completed.',
    };
    await fs.writeFile('artifacts/iteration2-wsl-results.json', JSON.stringify(result));
    console.log('NOT VERIFIED: WSL requires user account setup.');
  } else {
    const t = (await current(page)).workspaces
      .flatMap((w) => w.terminals)
      .find((t) => t.name === 'WSL validation');
    await invoke(page, 'terminal_write', { id: t.id, data: "printf 'WSL_%s\\n' VERIFIED; pwd\r" });
    await expect(page.locator('.xterm-rows')).toContainText('WSL_VERIFIED');
    await expect(page.locator('.xterm-rows')).toContainText('/artifacts/iteration2-projects/Task1');
    await fs.writeFile(
      'artifacts/iteration2-wsl-results.json',
      JSON.stringify({ interactiveWsl: true, projectDirectory: true }),
    );
    console.log('PASS: WSL shell input and project directory');
  }
} finally {
  await page.getByRole('button', { name: 'Close WSL validation', exact: true }).click();
  await browser.close();
}
