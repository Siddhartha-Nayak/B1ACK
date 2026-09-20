use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, VecDeque},
    io::{Read, Write},
    sync::{Arc, Mutex},
    thread,
};

const OUTPUT_LIMIT: usize = 256 * 1024;
const DRAIN_LIMIT: usize = 32 * 1024;
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub id: String,
    pub cwd: String,
    pub command: String,
    pub args: Vec<String>,
}
#[derive(Default)]
struct Output {
    bytes: VecDeque<u8>,
    lost: bool,
    eof: bool,
    error: Option<String>,
}
struct Session {
    master: Option<Box<dyn MasterPty + Send>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    child: Box<dyn Child + Send + Sync>,
    output: Arc<Mutex<Output>>,
}
#[derive(Default)]
pub struct Manager {
    sessions: Mutex<HashMap<String, Session>>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Packet {
    pub id: String,
    pub data: Vec<u8>,
    pub truncated: bool,
    pub status: String,
    pub error: Option<String>,
}
fn size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows: rows.clamp(2, 500),
        cols: cols.clamp(2, 1000),
        pixel_width: 0,
        pixel_height: 0,
    }
}

pub fn validate_folder(path: &str) -> Result<String, String> {
    let path =
        std::fs::canonicalize(path).map_err(|e| format!("Cannot open project folder: {e}"))?;
    if !path.is_dir() {
        return Err("Choose a directory, not a file.".into());
    }
    let value = path.to_string_lossy();
    if let Some(unc) = value.strip_prefix("\\\\?\\UNC\\") {
        Ok(format!("\\\\{unc}"))
    } else {
        Ok(value.trim_start_matches("\\\\?\\").to_owned())
    }
}
fn command_builder(
    executable: &std::path::Path,
    args: &[String],
) -> Result<CommandBuilder, String> {
    #[cfg(windows)]
    if executable
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("cmd") || e.eq_ignore_ascii_case("bat"))
    {
        // npm exposes Codex through a batch shim. PowerShell literal arguments avoid shell interpolation.
        let shell = which::which("powershell.exe")
            .map_err(|_| "PowerShell is required to launch Windows batch shims")?;
        let literal = |s: &str| format!("'{}'", s.replace('\'', "''"));
        let mut script = format!("& {}", literal(&executable.to_string_lossy()));
        for arg in args {
            script.push(' ');
            script.push_str(&literal(arg));
        }
        script.push_str("; exit $LASTEXITCODE");
        let mut cmd = CommandBuilder::new(shell);
        cmd.args(["-NoLogo", "-NoProfile", "-Command", &script]);
        return Ok(cmd);
    }
    let mut cmd = CommandBuilder::new(executable);
    cmd.args(args);
    Ok(cmd)
}
#[derive(Serialize)]
pub struct SessionInfo {
    pub id: String,
    pub pid: Option<u32>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
}
impl Manager {
    pub fn inspect(&self) -> Result<Vec<SessionInfo>, String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "Terminal registry unavailable")?;
        Ok(sessions
            .iter()
            .map(|(id, s)| {
                let size = s.master.as_ref().and_then(|m| m.get_size().ok());
                SessionInfo {
                    id: id.clone(),
                    pid: s.child.process_id(),
                    cols: size.as_ref().map(|s| s.cols),
                    rows: size.as_ref().map(|s| s.rows),
                }
            })
            .collect())
    }
    pub fn start(&self, config: Config, cols: u16, rows: u16) -> Result<(), String> {
        if config.id.is_empty() || config.id.len() > 128 {
            return Err("Invalid terminal ID.".into());
        }
        let cwd = validate_folder(&config.cwd)?;
        let executable = which::which(&config.command).map_err(|_| format!("{} was not found in PATH. Install it, then restart ParallelADE or choose another executable.", config.command))?;
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "Terminal registry unavailable")?;
        if sessions.contains_key(&config.id) {
            return Err("Terminal already exists. Close it before restarting.".into());
        }
        let pair = native_pty_system()
            .openpty(size(cols, rows))
            .map_err(|e| format!("PTY creation failed: {e}"))?;
        let mut cmd = command_builder(&executable, &config.args)?;
        cmd.cwd(cwd);
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let writer = Arc::new(Mutex::new(
            pair.master.take_writer().map_err(|e| e.to_string())?,
        ));
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Could not launch {}: {e}", config.command))?;
        drop(pair.slave);
        let output = Arc::new(Mutex::new(Output::default()));
        let stream = output.clone();
        thread::spawn(move || {
            let mut buffer = [0u8; 8192];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        if let Ok(mut o) = stream.lock() {
                            o.eof = true;
                        }
                        break;
                    }
                    Ok(n) => {
                        let Ok(mut o) = stream.lock() else { break };
                        let excess = (o.bytes.len() + n).saturating_sub(OUTPUT_LIMIT);
                        if excess > 0 {
                            o.bytes.drain(..excess);
                            o.lost = true;
                        }
                        o.bytes.extend(&buffer[..n]);
                    }
                    Err(e) => {
                        if let Ok(mut o) = stream.lock() {
                            o.eof = true;
                            o.error = Some(format!("Terminal stream closed: {e}"));
                        }
                        break;
                    }
                }
            }
        });
        sessions.insert(
            config.id,
            Session {
                master: Some(pair.master),
                writer,
                child,
                output,
            },
        );
        Ok(())
    }
    pub fn write(&self, id: &str, data: &str) -> Result<(), String> {
        if data.len() > 1024 * 1024 {
            return Err("Paste is too large (maximum 1 MiB).".into());
        }
        let writer = {
            let sessions = self
                .sessions
                .lock()
                .map_err(|_| "Terminal registry unavailable")?;
            sessions
                .get(id)
                .ok_or("Terminal is closed. Start it again.")?
                .writer
                .clone()
        };
        let mut writer = writer.lock().map_err(|_| "Terminal input unavailable")?;
        writer
            .write_all(data.as_bytes())
            .and_then(|_| writer.flush())
            .map_err(|e| format!("Could not send input: {e}"))
    }
    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "Terminal registry unavailable")?;
        sessions
            .get(id)
            .ok_or("Terminal is closed")?
            .master
            .as_ref()
            .ok_or("Terminal has exited")?
            .resize(size(cols, rows))
            .map_err(|e| format!("Could not resize terminal: {e}"))
    }
    pub fn drain(&self) -> Result<Vec<Packet>, String> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "Terminal registry unavailable")?;
        let mut packets = Vec::with_capacity(sessions.len());
        for (id, s) in sessions.iter_mut() {
            let exit = s.child.try_wait().map_err(|e| e.to_string())?;
            // ConPTY keeps its output pipe open after the root process exits.
            // Close the master now; the reader drains final bytes before reporting EOF.
            if exit.is_some() {
                drop(s.master.take());
            }
            let mut o = s.output.lock().map_err(|_| "Terminal output unavailable")?;
            let n = o.bytes.len().min(DRAIN_LIMIT);
            let data = o.bytes.drain(..n).collect();
            let truncated = std::mem::take(&mut o.lost);
            let status = if exit.is_some() && o.eof && o.bytes.is_empty() {
                "Exited"
            } else {
                "Running"
            };
            packets.push(Packet {
                id: id.clone(),
                data,
                truncated,
                status: status.into(),
                error: o.error.take().or_else(|| {
                    exit.as_ref().filter(|e| !e.success()).map(|e| {
                        format!(
                            "Process exited with code {}. Restart to try again.",
                            e.exit_code()
                        )
                    })
                }),
            });
        }
        Ok(packets)
    }
    pub fn close(&self, id: &str) -> Result<(), String> {
        let session = self
            .sessions
            .lock()
            .map_err(|_| "Terminal registry unavailable")?
            .remove(id);
        if let Some(mut s) = session {
            // Windows taskkill /T terminates descendants as well as the PTY root.
            #[cfg(windows)]
            if s.child.try_wait().map_err(|e| e.to_string())?.is_none() {
                if let Some(pid) = s.child.process_id() {
                    use std::os::windows::process::CommandExt;
                    let _ = std::process::Command::new("taskkill.exe")
                        .args(["/PID", &pid.to_string(), "/T", "/F"])
                        .creation_flags(0x08000000)
                        .output();
                }
            }
            let _ = s.child.kill();
            // Dropping the master closes ConPTY; the reader owns its handle until EOF.
            drop(s.writer);
            drop(s.master);
            thread::spawn(move || {
                let _ = s.child.wait();
            });
        }
        Ok(())
    }
    pub fn shutdown(&self) {
        let ids = self
            .sessions
            .lock()
            .map(|s| s.keys().cloned().collect::<Vec<_>>())
            .unwrap_or_default();
        for id in ids {
            let _ = self.close(&id);
        }
    }
}
impl Drop for Manager {
    fn drop(&mut self) {
        self.shutdown();
    }
}

#[cfg(test)]
mod tests;
