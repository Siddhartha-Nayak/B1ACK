import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
export interface LibraryEntry {
  id: string;
  name: string;
  size: number;
}
export const fileLibrary = {
  list: () => invoke<LibraryEntry[]>('library_list'),
  read: (id: string) => invoke<number[]>('library_read', { id }),
  remove: (id: string) => invoke('library_delete', { id }),
  async save(name: string, bytes: Uint8Array) {
    await invoke('library_add', {
      id: crypto.randomUUID(),
      name,
      bytes: Array.from(bytes),
      source: null,
    });
  },
  async import() {
    const paths = await open({ multiple: true, directory: false, title: 'Import into Library' });
    for (const source of paths ?? [])
      await invoke('library_add', {
        id: crypto.randomUUID(),
        name: source.split(/[\\/]/).pop(),
        source,
        bytes: null,
      });
  },
  async export(entry: LibraryEntry) {
    const destination = await save({
      defaultPath: entry.name.replace(/[\\/:*?"<>|]/g, '_'),
      title: 'Export a copy',
    });
    if (destination) await invoke('library_export', { id: entry.id, destination });
  },
};
