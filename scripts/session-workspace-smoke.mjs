import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.goto('http://127.0.0.1:1420/');
  await expect(page.locator('.session-shell')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sessions' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();
  await expect(page.getByText('Your coding workspace')).toBeVisible();
  await page.screenshot({ path: 'artifacts/session-workspace-empty.png' });
  await page.getByRole('button', { name: 'Grid', exact: true }).click();
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.getByRole('button', { name: 'Session workspace' }).click();
  await expect(page.locator('.session-shell')).toBeVisible();
  await page.setViewportSize({ width: 580, height: 800 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('.session-sidebar')).toBeVisible();
  await page.getByRole('button', { name: 'Close navigation' }).click();
  await expect(page.locator('.session-sidebar')).toBeHidden();
  await page.locator('.session-window-actions button').first().click();
  await expect(page.locator('.session-changes')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    const projectId = 'smoke-project';
    const workspace = {
      id: 'smoke-workspace',
      name: 'Smoke',
      projects: [{ id: projectId, name: 'Demo', path: 'C:\\Demo' }],
      sessionFolders: [],
      launchPresets: [],
      terminals: [1, 2].map((number) => ({
        id: `smoke-${number}`,
        projectId,
        name: `Codex-${number}`,
        cwd: 'C:\\Demo',
        command: 'codex',
        args: [],
        createdAt: Date.now(),
      })),
      layout: 'tabs',
      gridColumns: null,
      paneSizes: {},
      visibleTerminalIds: ['smoke-1', 'smoke-2'],
      sidebarWidth: 228,
      sidebarCollapsed: false,
      activeProjectId: projectId,
      activeTerminalId: 'smoke-1',
    };
    localStorage.setItem(
      'parallelade.library.v2',
      JSON.stringify({
        schemaVersion: 2,
        activeWorkspaceId: workspace.id,
        workspaces: [workspace],
        customPresets: [],
      }),
    );
  });
  await page.reload();
  await expect(page.locator('.agent-conversation')).toBeVisible();
  await page.getByRole('button', { name: 'Split', exact: true }).click();
  await expect(page.locator('.agent-conversation')).toHaveCount(2);
  await page.screenshot({ path: 'artifacts/session-workspace-sessions.png' });
  console.log(
    'Session workspace shell, grid fallback, mobile navigation, and split sessions verified.',
  );
} finally {
  await browser.close();
}
