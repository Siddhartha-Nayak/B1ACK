import { invoke, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { SystemStatus } from '../types/workspace';

export interface AgentInstallReport {
  output: string;
}

export interface ProjectFileEntry {
  path: string;
  name: string;
  kind: 'directory' | 'file';
  size: number;
}

export interface ProjectGitChange {
  path: string;
  status: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export interface ProjectGitStatus {
  root: string | null;
  branch: string | null;
  changes: ProjectGitChange[];
}

export interface WorkspacePlatform {
  available: boolean;
  pickFolder(): Promise<string | null>;
  validateFolder(path: string): Promise<string>;
  systemStatus(): Promise<SystemStatus>;
  detectCommands(commands: string[]): Promise<Record<string, string | null>>;
  installAllAgents(): Promise<AgentInstallReport>;
  openFolder(path: string): Promise<void>;
  createWorktree(path: string, branch: string, directory: string): Promise<string>;
  listProjectFiles(path: string): Promise<ProjectFileEntry[]>;
  readProjectFile(path: string, relative: string): Promise<string>;
  projectGitStatus(path: string): Promise<ProjectGitStatus>;
  projectGitDiff(path: string, relative: string): Promise<string>;
}
export const desktopPlatform: WorkspacePlatform = {
  available: isTauri(),
  pickFolder: () => open({ directory: true, multiple: false, title: 'Add project folder' }),
  validateFolder: (path) => invoke('project_validate', { path }),
  systemStatus: () => invoke('system_status'),
  detectCommands: (commands) => invoke('command_detect', { commands }),
  installAllAgents: () => invoke('agents_install_all'),
  openFolder: (path) => invoke('project_open', { path }),
  createWorktree: (path, branch, directory) =>
    invoke('worktree_create', { path, branch, directory }),
  listProjectFiles: (path) => invoke('project_files_list', { path }),
  readProjectFile: (path, relative) => invoke('project_file_read', { path, relative }),
  projectGitStatus: (path) => invoke('project_git_status', { path }),
  projectGitDiff: (path, relative) => invoke('project_git_diff', { path, relative }),
};
