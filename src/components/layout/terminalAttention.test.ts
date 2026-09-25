import { describe, expect, it } from 'vitest';
import { terminalAttentionLabel, terminalNeedsAttention } from './terminalAttention';

describe('terminal attention', () => {
  it('flags startup errors', () => {
    const state = { status: 'Error' as const, error: 'command not found' };
    expect(terminalNeedsAttention(state)).toBe(true);
    expect(terminalAttentionLabel(state)).toBe('command not found');
  });

  it('flags exited terminals only when an error is reported', () => {
    expect(terminalNeedsAttention({ status: 'Exited' })).toBe(false);
    expect(terminalNeedsAttention({ status: 'Exited', error: 'Process exited with code 1.' })).toBe(
      true,
    );
  });

  it('supports an explicit input-wait signal without guessing from output', () => {
    expect(terminalNeedsAttention({ status: 'Running' })).toBe(false);
    expect(terminalNeedsAttention({ status: 'Running', waitingForInput: true } as never)).toBe(
      true,
    );
    expect(terminalAttentionLabel({ status: 'Running', waitingForInput: true } as never)).toBe(
      'Terminal is waiting for input',
    );
  });
});
