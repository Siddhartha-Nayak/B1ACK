import { chromium, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9225');
const cdp = await browser.newBrowserCDPSession();
const { arguments: args } = await cdp.send('Browser.getBrowserCommandLine');
const profile = path
  .resolve(process.env.PARALLELADE_RELEASE_PROFILE ?? 'artifacts/github-release-appdata')
  .toLowerCase();
if (
  !args.some((arg) =>
    arg
      .toLowerCase()
      .replaceAll('"', '')
      .includes('--user-data-dir=' + profile),
  )
)
  throw new Error('Expected isolated release profile');
const page = browser.contexts()[0].pages()[0];
await expect(page.locator('.app-shell')).toHaveCSS('background-color', 'rgb(13, 17, 23)');
expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontFamily)).toContain(
  'Helvetica Neue',
);
const projectPath = path.resolve('artifacts/github-release-project');
await fs.mkdir(projectPath, { recursive: true });
await page.evaluate(
  ({ projectPath }) => {
    const workspace = {
      id: 'github-release-workspace',
      name: 'Release preview',
      projects: [{ id: 'github-release-project', name: 'ParallelADE', path: projectPath }],
      terminals: [
        {
          id: 'github-release-terminal',
          name: 'PowerShell',
          projectId: 'github-release-project',
          presetId: 'powershell',
          cwd: projectPath,
          command: 'powershell.exe',
          args: ['-NoLogo', '-NoProfile'],
          createdAt: Date.now(),
        },
      ],
      layout: 'tabs',
      gridColumns: null,
      paneSizes: {},
      visibleTerminalIds: ['github-release-terminal'],
      sidebarWidth: 228,
      sidebarCollapsed: false,
      activeProjectId: 'github-release-project',
      activeTerminalId: 'github-release-terminal',
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
  },
  { projectPath },
);
await page.reload();
await page.waitForSelector('.app-shell');
await page.getByRole('button', { name: 'Start terminal', exact: true }).click();
await expect(page.locator('.xterm-rows')).toContainText('PS ');
const result = {
  packagedGithubChrome: true,
  helveticaFontStack: true,
  interactivePowerShell: true,
  origin: page.url(),
};
await fs.writeFile('artifacts/github-release-results.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
