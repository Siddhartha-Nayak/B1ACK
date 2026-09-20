import type { TerminalSession, TerminalStatus } from '../../types/workspace';
export interface OutputPacket {
  id: string;
  data: number[];
  truncated: boolean;
  status: TerminalStatus;
  error: string | null;
}
/** A transport boundary; UI and workspace state do not depend on a local PTY. */
export interface TerminalService {
  start(session: TerminalSession, cols: number, rows: number): Promise<void>;
  write(id: string, data: string): Promise<void>;
  resize(id: string, cols: number, rows: number): Promise<void>;
  close(id: string): Promise<void>;
  drain(): Promise<OutputPacket[]>;
}
