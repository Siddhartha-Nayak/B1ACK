import { invoke } from '@tauri-apps/api/core';
import type { TerminalService } from './TerminalService';
const writes = new Map<string, Promise<void>>();
const epochs = new Map<string, number>();
export const desktopTerminal: TerminalService = {
  start: (config, cols, rows) => invoke('terminal_start', { config, cols, rows }),
  write(id, data) {
    const epoch = epochs.get(id) ?? 0;
    const next = (writes.get(id) ?? Promise.resolve())
      .catch(() => {})
      .then(() => {
        if ((epochs.get(id) ?? 0) !== epoch)
          throw new Error('Input cancelled: terminal was closed.');
        return invoke<void>('terminal_write', { id, data });
      });
    writes.set(id, next);
    void next
      .finally(() => {
        if (writes.get(id) === next) writes.delete(id);
      })
      .catch(() => {});
    return next;
  },
  resize: (id, cols, rows) => invoke('terminal_resize', { id, cols, rows }),
  async close(id) {
    epochs.set(id, (epochs.get(id) ?? 0) + 1);
    const pending = writes.get(id);
    await invoke('terminal_close', { id });
    // Kill first to unblock a full input pipe, then settle old writes before a restart.
    await pending?.catch(() => {});
  },
  drain: () => invoke('terminal_drain'),
};
