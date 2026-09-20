export type TerminalStatus = 'Stopped' | 'Starting' | 'Running' | 'Exited' | 'Error';
export type Layout = 'tabs' | 'grid' | 'split';
export interface Project {
  id: string;
  name: string;
  path: string;
  collapsed?: boolean;
}
export interface TerminalSession {
  id: string;
  projectId: string;
  name: string;
  presetId?: string;
  cwd: string;
  command: string;
  args: string[];
  createdAt: number;
}
export interface PaneSize {
  weight: number;
  height?: number;
}
export interface Workspace {
  id: string;
  name: string;
  projects: Project[];
  terminals: TerminalSession[];
  layout: Layout;
  gridColumns: number | null;
  paneSizes: Record<string, PaneSize>;
  visibleTerminalIds: string[];
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  activeProjectId: string | null;
  activeTerminalId: string | null;
}
export interface CliPreset {
  id: string;
  name: string;
  command: string;
  args: string[];
  category: 'Coding Agents' | 'Shells' | 'Custom';
  icon: string;
  builtIn: boolean;
}
export interface WorkspaceLibrary {
  schemaVersion: 2;
  activeWorkspaceId: string;
  workspaces: Workspace[];
  customPresets: CliPreset[];
}
export interface TerminalState {
  status: TerminalStatus;
  error?: string;
}
export interface SystemStatus {
  cpu: number;
  usedMemory: number;
  totalMemory: number;
}
export const emptyWorkspace = (name = 'Default', id: string = crypto.randomUUID()): Workspace => ({
  id,
  name,
  projects: [],
  terminals: [],
  layout: 'tabs',
  gridColumns: null,
  paneSizes: {},
  visibleTerminalIds: [],
  sidebarWidth: 228,
  sidebarCollapsed: false,
  activeProjectId: null,
  activeTerminalId: null,
});
export const emptyLibrary = (): WorkspaceLibrary => {
  const workspace = emptyWorkspace();
  return {
    schemaVersion: 2,
    activeWorkspaceId: workspace.id,
    workspaces: [workspace],
    customPresets: [],
  };
};
