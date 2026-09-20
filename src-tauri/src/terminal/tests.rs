use super::*;
use std::time::{Duration, Instant};
fn shell(id: &str, cwd: String) -> Config {
    Config {
        id: id.into(),
        cwd,
        command: "powershell.exe".into(),
        args: vec!["-NoLogo".into(), "-NoProfile".into(), "-NoExit".into()],
    }
}
#[test]
fn missing_command_and_folder_are_actionable() {
    let m = Manager::default();
    let mut c = shell(
        "missing",
        std::env::current_dir().unwrap().to_string_lossy().into(),
    );
    c.command = "parallelade-nonexistent-executable-392819".into();
    assert!(m.start(c.clone(), 80, 24).unwrap_err().contains("PATH"));
    c.cwd = "Z:\\parallelade-no-such-folder-392819".into();
    assert!(m.start(c, 80, 24).unwrap_err().contains("folder"));
}
#[test]
#[cfg(windows)]
fn twenty_independent_interactive_powershell_sessions() {
    let m = Manager::default();
    let root = std::env::temp_dir().join(format!("parallelade-pty-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let mut results = HashMap::<String, String>::new();
    for i in 0..20 {
        let cwd = root.join(format!("project-{i}"));
        std::fs::create_dir_all(&cwd).unwrap();
        m.start(shell(&i.to_string(), cwd.to_string_lossy().into()), 100, 30)
            .unwrap();
        m.resize(&i.to_string(), 120, 36).unwrap();
    }
    let mut sent = std::collections::HashSet::new();
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(60) {
        for p in m.drain().unwrap() {
            let text = String::from_utf8_lossy(&p.data);
            if text.contains("\u{1b}[6n") {
                m.write(&p.id, "\u{1b}[1;1R").unwrap();
            }
            let result = results.entry(p.id.clone()).or_default();
            result.push_str(&text);
            if result.contains("PS ") && sent.insert(p.id.clone()) {
                m.write(
                    &p.id,
                    &format!(
                        "$p=(Get-Location).Path; Write-Output ('ADE'+'RESULT:{}:'+$p)\r",
                        p.id
                    ),
                )
                .unwrap();
            }
        }
        if (0..20).all(|i| {
            results
                .get(&i.to_string())
                .is_some_and(|s| s.contains(&format!("ADERESULT:{i}:")))
        }) {
            break;
        }
        thread::sleep(Duration::from_millis(40));
    }
    for i in 0..20 {
        let result = results.get(&i.to_string()).unwrap();
        assert!(
            result.contains(&format!("ADERESULT:{i}:")),
            "No response from session {i}: {result}"
        );
        assert!(
            result.contains(&format!("project-{i}")),
            "Wrong cwd: {result}"
        );
        for j in 0..20 {
            if i != j {
                assert!(
                    !result.contains(&format!("ADERESULT:{j}:")),
                    "Cross-session output"
                );
            }
        }
    }
    m.shutdown();
    assert!(m.drain().unwrap().is_empty());
    m.start(shell("restart", root.to_string_lossy().into()), 80, 24)
        .unwrap();
    m.close("restart").unwrap();
    m.start(shell("restart", root.to_string_lossy().into()), 80, 24)
        .unwrap();
    m.close("restart").unwrap();
    std::fs::remove_dir_all(root).unwrap();
}
#[test]
#[ignore = "Requires an installed Codex CLI; starts interactive CLI but submits no prompt"]
fn interactive_codex_startup() {
    let m = Manager::default();
    m.start(
        Config {
            id: "codex".into(),
            cwd: std::env::current_dir().unwrap().to_string_lossy().into(),
            command: "codex".into(),
            args: vec![],
        },
        120,
        36,
    )
    .unwrap();
    let start = Instant::now();
    let mut output = String::new();
    while start.elapsed() < Duration::from_secs(20) {
        for p in m.drain().unwrap() {
            let text = String::from_utf8_lossy(&p.data);
            if text.contains("\u{1b}[6n") {
                m.write("codex", "\u{1b}[1;1R").unwrap();
            }
            output.push_str(&text);
        }
        if output.contains("Ask Codex") {
            break;
        }
        thread::sleep(Duration::from_millis(50));
    }
    m.close("codex").unwrap();
    assert!(
        output.contains("Ask Codex"),
        "No Codex startup UI: {output}"
    );
    println!(
        "Codex PTY startup observed; no agent prompt sent. {} bytes",
        output.len()
    );
}

#[test]
#[cfg(windows)]
fn natural_exit_reports_status_and_batch_shim_runs() {
    let m = Manager::default();
    let root = std::env::temp_dir().join(format!("parallelade-shim-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let shim = root.join("test shim.cmd");
    std::fs::write(&shim, "@echo off\r\necho SHIM_RESULT:%~1\r\nexit /b 7\r\n").unwrap();
    m.start(
        Config {
            id: "shim".into(),
            cwd: root.to_string_lossy().into(),
            command: shim.to_string_lossy().into(),
            args: vec!["value with spaces".into()],
        },
        120,
        30,
    )
    .unwrap();
    let start = Instant::now();
    let mut output = String::new();
    let mut exited = false;
    while start.elapsed() < Duration::from_secs(15) {
        for p in m.drain().unwrap() {
            let text = String::from_utf8_lossy(&p.data);
            if text.contains("\u{1b}[6n") {
                m.write("shim", "\u{1b}[1;1R").unwrap();
            }
            output.push_str(&text);
            if p.status == "Exited" {
                exited = true;
            }
        }
        if exited {
            break;
        }
        thread::sleep(Duration::from_millis(40));
    }
    m.close("shim").unwrap();
    assert!(
        output.contains("SHIM_RESULT:value with spaces"),
        "Shim output: {output}"
    );
    assert!(exited, "Natural exit was not reported; output: {output}");
    std::fs::remove_dir_all(root).unwrap();
}
