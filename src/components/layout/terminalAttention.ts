import type { TerminalState } from '../../types/workspace';

/**
 * Attention is deliberately opt-in for input waits. A terminal cannot be
 * reliably classified as waiting from its rendered text alone, so a future
 * controller may provide `waitingForInput: true` without making prompts
 * noisy for normal command output.
 */
export function terminalNeedsAttention(state: TerminalState | undefined): boolean {
  if (!state) return false;
  if (state.status === 'Error') return true;
  if (state.status === 'Exited') return Boolean(state.error?.trim());
  return Boolean((state as TerminalState & { waitingForInput?: boolean }).waitingForInput);
}

export function terminalAttentionLabel(state: TerminalState | undefined): string {
  if (!terminalNeedsAttention(state)) return '';
  if (state?.status === 'Error') return state.error?.trim() || 'Terminal failed to start';
  if (state?.status === 'Exited') return state.error?.trim() || 'Terminal exited with an error';
  return 'Terminal is waiting for input';
}
