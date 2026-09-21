import { Terminal } from '@xterm/xterm';
import { SerializeAddon } from '@xterm/addon-serialize';
import { FitAddon } from '@xterm/addon-fit';
import type { TerminalService } from './TerminalService';
const LIMIT = 256 * 1024;
export class TerminalBuffer {
  private chunks: Uint8Array[] = [];
  private size = 0;
  private lost = false;
  push(data: Uint8Array, truncated = false) {
    if (truncated) {
      this.chunks = [];
      this.size = 0;
      this.lost = true;
    }
    if (data.length > LIMIT) {
      data = data.slice(-LIMIT);
      this.chunks = [];
      this.size = 0;
      this.lost = true;
    }
    if (data.length) {
      this.chunks.push(data);
      this.size += data.length;
    }
    while (this.size > LIMIT && this.chunks.length) {
      this.size -= this.chunks.shift()!.length;
      this.lost = true;
    }
  }
  take() {
    const result = { chunks: this.chunks, lost: this.lost };
    this.chunks = [];
    this.size = 0;
    this.lost = false;
    return result;
  }
}
/** Hidden sessions parse escape sequences and answer PTY queries without an open renderer. */
export class TerminalView {
  private terminal: Terminal;
  private serialize: SerializeAddon;
  private buffer = new TerminalBuffer();
  private settle: Promise<void> = Promise.resolve();
  private paused = false;
  private disposed = false;
  private pendingBytes = 0;
  cols = 100;
  rows = 30;
  constructor(
    readonly id: string,
    private service: TerminalService,
    private onError: (e: unknown) => void,
  ) {
    [this.terminal, this.serialize] = this.create();
  }
  private create(): [Terminal, SerializeAddon] {
    const terminal = new Terminal({
      cols: this.cols,
      rows: this.rows,
      scrollback: 1500,
      fontFamily: 'Cascadia Code, Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      theme: {
        background: '#111111',
        foreground: '#e6e6e6',
        cursor: '#f5f5f5',
        selectionBackground: '#505050',
        black: '#1b1b1b',
        brightBlack: '#8b8b8b',
        green: '#d2d2d2',
        blue: '#bdbdbd',
        red: '#eeeeee',
      },
    });
    const serialize = new SerializeAddon();
    terminal.loadAddon(serialize);
    terminal.onData((data) => {
      if (!this.disposed) void this.service.write(this.id, data).catch(this.onError);
    });
    return [terminal, serialize];
  }
  receive(data: Uint8Array, truncated: boolean) {
    if (this.disposed) return;
    this.buffer.push(data, truncated);
    this.flush();
  }
  private flush() {
    if (this.paused || this.disposed || this.pendingBytes > LIMIT) return;
    const { chunks, lost } = this.buffer.take();
    if (lost)
      this.terminal.write(
        '\x1bc\r\n[Output exceeded the bounded buffer; older output was discarded.]\r\n',
      );
    for (const chunk of chunks) {
      this.pendingBytes += chunk.length;
      this.terminal.write(chunk, () => {
        this.pendingBytes -= chunk.length;
        this.flush();
      });
    }
  }
  async mount(element: HTMLElement, shortcuts: (event: KeyboardEvent) => boolean) {
    await this.settle;
    if (!element.isConnected || this.disposed) return () => {};
    const terminal = this.terminal;
    const serialize = this.serialize;
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(element);
    terminal.attachCustomKeyEventHandler(shortcuts);
    let frame = 0;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let lastResize = 0;
    const sendResize = () => {
      lastResize = performance.now();
      void this.service.resize(this.id, terminal.cols, terminal.rows).catch(this.onError);
    };
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!element.clientWidth || !element.clientHeight) return;
        fit.fit();
        this.cols = terminal.cols;
        this.rows = terminal.rows;
        clearTimeout(resizeTimer);
        if (performance.now() - lastResize >= 50) sendResize();
        else resizeTimer = setTimeout(sendResize, 50 - (performance.now() - lastResize));
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    terminal.focus();
    return () => {
      observer.disconnect();
      clearTimeout(resizeTimer);
      cancelAnimationFrame(frame);
      if (this.disposed) return;
      this.paused = true;
      this.settle = new Promise((resolve) =>
        terminal.write('', () => {
          if (!this.disposed) {
            const snapshot = serialize.serialize({ scrollback: 1500 });
            terminal.dispose();
            [this.terminal, this.serialize] = this.create();
            this.terminal.write(snapshot, () => {
              this.paused = false;
              this.flush();
              resolve();
            });
          } else resolve();
        }),
      );
    };
  }
  clear() {
    this.buffer.take();
    this.terminal.reset();
  }
  focus() {
    this.terminal.focus();
  }
  dispose() {
    this.disposed = true;
    this.buffer.take();
    this.terminal.dispose();
  }
}
