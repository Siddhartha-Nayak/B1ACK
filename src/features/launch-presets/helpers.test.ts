import { describe, expect, it } from 'vitest';
import { captureLaunchPreset, instantiateLaunchPreset } from './helpers';

const workspace = {
  layout: 'grid' as const,
  gridColumns: 3,
  visibleTerminalIds: ['one', 'other-project'],
  terminals: [
    {
      id: 'one',
      projectId: 'project-a',
      name: 'Codex',
      presetId: 'codex',
      cwd: 'C:/repo',
      command: 'codex',
      args: ['--full-auto'],
      createdAt: 10,
    },
    {
      id: 'other-project',
      projectId: 'project-b',
      name: 'Tests',
      cwd: 'C:/other',
      command: 'npm',
      args: ['test'],
      createdAt: 11,
    },
  ],
};

describe('launch preset helpers', () => {
  it('captures only the selected project and clones mutable args', () => {
    const preset = captureLaunchPreset(workspace, 'project-a', '  Review  ', 'preset-1');
    expect(preset).toEqual({
      id: 'preset-1',
      projectId: 'project-a',
      name: 'Review',
      layout: 'grid',
      gridColumns: 3,
      terminals: [{ name: 'Codex', presetId: 'codex', command: 'codex', args: ['--full-auto'] }],
    });
    workspace.terminals[0].args.push('--changed');
    expect(preset.terminals[0].args).toEqual(['--full-auto']);
  });

  it('creates unique fresh sessions and carries layout metadata', () => {
    workspace.terminals[0].args = ['--full-auto'];
    const preset = captureLaunchPreset(workspace, 'project-a', 'Review', 'preset-1');
    const ids = ['one', 'new-id', 'third-id'];
    const launched = instantiateLaunchPreset(preset, 'project-a', 'D:/checkout', {
      existingTerminalIds: ['one'],
      idFactory: () => ids.shift() ?? 'fallback',
      createdAt: 42,
    });
    expect(launched.layout).toBe('grid');
    expect(launched.gridColumns).toBe(3);
    expect(launched.visibleTerminalIds).toEqual(['new-id']);
    expect(launched.activeTerminalId).toBe('new-id');
    expect(launched.terminals[0]).toMatchObject({
      id: 'new-id',
      projectId: 'project-a',
      cwd: 'D:/checkout',
      command: 'codex',
      args: ['--full-auto'],
      createdAt: 42,
    });
  });
  it('does not capture a project terminal hidden from the grid', () => {
    const preset = captureLaunchPreset(
      { ...workspace, visibleTerminalIds: [] },
      'project-a',
      'Visible only',
    );
    expect(preset.terminals).toEqual([]);
  });

  it('supports an empty preset without inventing an active terminal', () => {
    const result = instantiateLaunchPreset(
      {
        id: 'empty',
        projectId: 'project-a',
        name: 'Empty',
        layout: 'tabs',
        gridColumns: null,
        terminals: [],
      },
      'project-a',
      'C:/repo',
      { idFactory: () => 'unused' },
    );
    expect(result.terminals).toEqual([]);
    expect(result.activeTerminalId).toBeNull();
  });
});
