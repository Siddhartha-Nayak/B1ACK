import type { TerminalSession, TerminalState } from '../../types/workspace';
import type { TerminalService } from './TerminalService';
import { TerminalView } from './TerminalView';
const STOPPED: TerminalState = { status: 'Stopped' };
export class TerminalController {
  private states: Record<string, TerminalState> = {};
  private views = new Map<string, TerminalView>();
  private listeners = new Set<() => void>();
  private busy = new Set<string>();
  private generations = new Map<string, number>();
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = true;
  constructor(private service: TerminalService) {}
  getSnapshot = () => this.states;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  state(id: string) {
    return this.states[id] ?? STOPPED;
  }
  private set(id: string, state: TerminalState) {
    const old = this.state(id);
    if (old.status === state.status && old.error === state.error) return;
    this.states = { ...this.states, [id]: state };
    this.listeners.forEach((l) => l());
  }
  view(id: string) {
    let view = this.views.get(id);
    if (!view) {
      view = new TerminalView(id, this.service, (e) => {
        if (this.state(id).status === 'Running')
          this.set(id, { ...this.state(id), error: String(e) });
      });
      this.views.set(id, view);
    }
    return view;
  }
  startPolling() {
    this.stopped = false;
    let initial = true;
    const poll = async () => {
      if (this.stopped) return;
      const generations = new Map(this.generations);
      try {
        if (
          initial ||
          Object.values(this.states).some((s) => s.status === 'Running' || s.status === 'Starting')
        ) {
          for (const p of await this.service.drain()) {
            if (!generations.has(p.id)) {
              if (!this.generations.has(p.id)) await this.service.close(p.id);
              continue;
            }
            if (this.generations.get(p.id) !== generations.get(p.id)) continue;
            this.views.get(p.id)?.receive(new Uint8Array(p.data), p.truncated);
            this.set(p.id, { status: p.status, ...(p.error ? { error: p.error } : {}) });
            if (p.status === 'Exited')
              void this.service
                .close(p.id)
                .catch((e) => this.set(p.id, { status: 'Exited', error: String(e) }));
          }
        }
      } catch (e) {
        for (const [id, state] of Object.entries(this.states))
          if (state.status === 'Running')
            this.set(id, { ...state, error: `Terminal connection failed: ${String(e)}` });
      }
      initial = false;
      if (!this.stopped) this.timer = setTimeout(poll, 40);
    };
    void poll();
    return () => {
      this.stopped = true;
      clearTimeout(this.timer);
    };
  }
  async start(session: TerminalSession) {
    if (this.busy.has(session.id)) return;
    this.busy.add(session.id);
    this.set(session.id, { status: 'Starting' });
    try {
      await this.service.close(session.id);
      this.generations.set(session.id, (this.generations.get(session.id) ?? 0) + 1);
      this.views.get(session.id)?.dispose();
      this.views.delete(session.id);
      const view = this.view(session.id);
      await this.service.start(session, view.cols, view.rows);
      this.set(session.id, { status: 'Running' });
    } catch (e) {
      this.set(session.id, { status: 'Error', error: String(e) });
    } finally {
      this.busy.delete(session.id);
    }
  }
  async close(id: string) {
    if (this.busy.has(id))
      throw new Error('Terminal is starting. Try closing it again in a moment.');
    this.busy.add(id);
    try {
      await this.service.close(id);
      this.generations.set(id, (this.generations.get(id) ?? 0) + 1);
      this.views.get(id)?.dispose();
      this.views.delete(id);
      this.set(id, { status: 'Stopped' });
    } finally {
      this.busy.delete(id);
    }
  }
}
