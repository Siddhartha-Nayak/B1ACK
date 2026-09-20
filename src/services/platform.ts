import { invoke, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { SystemStatus } from '../types/workspace';
export interface WorkspacePlatform {
  available: boolean;
  pickFolder(): Promise<string | null>;
  validateFolder(path: string): Promise<string>;
  systemStatus(): Promise<SystemStatus>;
  detectCommands(commands: string[]): Promise<Record<string, string | null>>;
  openFolder(path: string): Promise<void>;
}
export const desktopPlatform: WorkspacePlatform = {
  available: isTauri(),
  pickFolder: () => open({ directory: true, multiple: false, title: 'Add project folder' }),
  validateFolder: (path) => invoke('project_validate', { path }),
  systemStatus: () => invoke('system_status'),
  detectCommands: (commands) => invoke('command_detect', { commands }),
  openFolder: (path) => invoke('project_open', { path }),
};
