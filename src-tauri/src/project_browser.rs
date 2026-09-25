use serde::Serialize;
use std::{io::Read, path::{Path, PathBuf}, process::{Command, ExitStatus, Stdio}};

const MAX_TREE_ENTRIES: usize = 4_000;
const MAX_FILE_BYTES: u64 = 1_000_000;
const MAX_DIFF_BYTES: usize = 250_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileEntry {
    pub path: String,
    pub name: String,
    pub kind: String,
    pub size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGitChange {
    pub path: String,
    pub status: String,
    pub staged: bool,
    pub unstaged: bool,
    pub untracked: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGitStatus {
    pub root: Option<String>,
    pub branch: Option<String>,
    pub changes: Vec<ProjectGitChange>,
}

fn project_root(path: &str) -> Result<PathBuf, String> {
    let valid = crate::terminal::validate_folder(path)?;
    Ok(PathBuf::from(valid))
}

fn normalized_canonical(path: &Path) -> Result<PathBuf, String> {
    let canonical = std::fs::canonicalize(path).map_err(|e| e.to_string())?;
    let value = canonical.to_string_lossy();
    if let Some(unc) = value.strip_prefix("\\\\?\\UNC\\") {
        Ok(PathBuf::from(format!("\\\\{unc}")))
    } else {
        Ok(PathBuf::from(value.trim_start_matches("\\\\?\\")))
    }
}

fn ignored_dir(name: &str) -> bool {
    matches!(name, ".git" | "node_modules" | "target" | "dist" | ".next" | ".turbo")
}

fn collect_tree(dir: &Path, root: &Path, depth: usize, entries: &mut Vec<ProjectFileEntry>) -> Result<(), String> {
    if depth > 8 || entries.len() >= MAX_TREE_ENTRIES { return Ok(()); }
    let mut children = std::fs::read_dir(dir)
        .map_err(|e| format!("Could not read project files: {e}"))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    children.sort_by_key(|e| e.file_name().to_string_lossy().to_lowercase());
    for child in children {
        if entries.len() >= MAX_TREE_ENTRIES { break; }
        let name = child.file_name().to_string_lossy().into_owned();
        let ty = child.file_type().map_err(|e| format!("Could not inspect {name}: {e}"))?;
        if ty.is_symlink() || name == ".git" { continue; }
        let full = child.path();
        let relative = full.strip_prefix(root).map_err(|_| "Project path escaped its folder.".to_string())?;
        let rel = relative.to_string_lossy().replace('\\', "/");
        let is_dir = ty.is_dir();
        let size = if is_dir { 0 } else { child.metadata().map(|m| m.len()).unwrap_or(0) };
        entries.push(ProjectFileEntry { path: rel, name: name.clone(), kind: if is_dir { "directory" } else { "file" }.into(), size });
        if is_dir && !ignored_dir(&name) { collect_tree(&full, root, depth + 1, entries)?; }
    }
    Ok(())
}

pub fn list_files(path: String) -> Result<Vec<ProjectFileEntry>, String> {
    let root = project_root(&path)?;
    let mut entries = Vec::new();
    collect_tree(&root, &root, 0, &mut entries)?;
    Ok(entries)
}

fn checked_file(root: &Path, relative: &str) -> Result<PathBuf, String> {
    if relative.trim().is_empty() { return Err("Choose a file first.".into()); }
    let candidate = root.join(relative);
    let canonical = normalized_canonical(&candidate).map_err(|e| format!("Could not open file: {e}"))?;
    if !canonical.starts_with(root) { return Err("File is outside this project.".into()); }
    let metadata = std::fs::metadata(&canonical).map_err(|e| e.to_string())?;
    if !metadata.is_file() { return Err("Choose a file, not a folder.".into()); }
    if metadata.len() > MAX_FILE_BYTES { return Err("This file is too large to preview (limit 1 MB).".into()); }
    Ok(canonical)
}

pub fn read_file(path: String, relative: String) -> Result<String, String> {
    let root = project_root(&path)?;
    let file = checked_file(&root, &relative)?;
    let bytes = std::fs::read(file).map_err(|e| format!("Could not read file: {e}"))?;
    String::from_utf8(bytes).map_err(|_| "This file is binary and cannot be previewed as text.".into())
}

fn git(root: &Path, args: &[&str]) -> Result<std::process::Output, String> {
    Command::new("git").arg("-C").arg(root).args(args).output()
        .map_err(|e| format!("Git is unavailable: {e}"))
}

fn git_diff_output(root: &Path, args: &[&str]) -> Result<(String, bool, String, ExitStatus), String> {
    let mut child = Command::new("git").arg("-C").arg(root).args(args)
        .stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()
        .map_err(|e| format!("Git is unavailable: {e}"))?;
    let mut stdout = child.stdout.take().ok_or("Could not read Git diff output.")?;
    let mut stderr = child.stderr.take().ok_or("Could not read Git diff errors.")?;
    let out_reader = std::thread::spawn(move || {
        let mut kept = Vec::with_capacity(MAX_DIFF_BYTES);
        let mut buf = [0_u8; 8192];
        let mut truncated = false;
        loop {
            let count = match stdout.read(&mut buf) { Ok(0) | Err(_) => break, Ok(count) => count };
            let available = MAX_DIFF_BYTES.saturating_sub(kept.len());
            kept.extend_from_slice(&buf[..count.min(available)]);
            if count > available { truncated = true; }
        }
        (String::from_utf8_lossy(&kept).into_owned(), truncated)
    });
    let err_reader = std::thread::spawn(move || {
        let mut kept = Vec::with_capacity(8192);
        let mut buf = [0_u8; 4096];
        loop {
            let count = match stderr.read(&mut buf) { Ok(0) | Err(_) => break, Ok(count) => count };
            let available = 8192_usize.saturating_sub(kept.len());
            kept.extend_from_slice(&buf[..count.min(available)]);
        }
        String::from_utf8_lossy(&kept).into_owned()
    });
    let status = child.wait().map_err(|e| format!("Could not finish Git diff: {e}"))?;
    let (out, truncated) = out_reader.join().map_err(|_| "Could not collect Git diff output.".to_string())?;
    let err = err_reader.join().map_err(|_| "Could not collect Git diff errors.".to_string())?;
    Ok((out, truncated, err, status))
}

fn git_root(path: &str) -> Result<Option<PathBuf>, String> {
    let folder = project_root(path)?;
    let output = git(&folder, &["rev-parse", "--show-toplevel"])?;
    if !output.status.success() { return Ok(None); }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let root = normalized_canonical(Path::new(&text)).map_err(|e| format!("Could not resolve Git root: {e}"))?;
    Ok(Some(root))
}

pub fn git_status(path: String) -> Result<ProjectGitStatus, String> {
    let Some(root) = git_root(&path)? else {
        return Ok(ProjectGitStatus { root: None, branch: None, changes: Vec::new() });
    };
    let branch_out = git(&root, &["branch", "--show-current"])?;
    let branch = String::from_utf8_lossy(&branch_out.stdout).trim().to_string();
    let status = git(&root, &["status", "--porcelain=v1", "-z", "--untracked-files=all"])?;
    if !status.status.success() { return Err(format!("Could not read Git changes: {}", String::from_utf8_lossy(&status.stderr).trim())); }
    let mut changes = Vec::new();
    let mut records = status.stdout.split(|byte| *byte == 0);
    while let Some(record) = records.next() {
        if record.len() < 4 { continue; }
        let code = String::from_utf8_lossy(&record[..2]).into_owned();
        let path = String::from_utf8_lossy(&record[3..]).into_owned().replace('\\', "/");
        // With -z, rename/copy records carry the original pathname in the next NUL field.
        if code.contains('R') || code.contains('C') { let _ = records.next(); }
        let untracked = code == "??";
        changes.push(ProjectGitChange {
            path,
            status: code.trim().to_string(),
            staged: !untracked && code.chars().next().is_some_and(|c| c != ' '),
            unstaged: !untracked && code.chars().nth(1).is_some_and(|c| c != ' '),
            untracked,
        });
        if changes.len() >= MAX_TREE_ENTRIES { break; }
    }
    Ok(ProjectGitStatus { root: Some(root.to_string_lossy().into_owned()), branch: if branch.is_empty() { None } else { Some(branch) }, changes })
}

pub fn git_diff(path: String, relative: String) -> Result<String, String> {
    let Some(root) = git_root(&path)? else { return Err("This folder is not inside a Git repository.".into()); };
    let relative_path = Path::new(&relative);
    if relative_path.is_absolute() || relative_path.components().any(|part| matches!(part, std::path::Component::ParentDir | std::path::Component::RootDir | std::path::Component::Prefix(_))) {
        return Err("Changed file is outside this repository.".into());
    }
    let candidate = root.join(relative_path);
    let canonical = match normalized_canonical(&candidate) {
        Ok(value) => {
            if !value.starts_with(&root) { return Err("Changed file is outside this repository.".into()); }
            value
        }
        Err(_) => {
            // Deleted paths may have deleted parent folders; validate the nearest existing ancestor.
            let mut ancestor = candidate.as_path();
            let canonical_ancestor = loop {
                if let Ok(value) = normalized_canonical(ancestor) { break value; }
                ancestor = ancestor.parent().ok_or("Could not resolve changed file path.")?;
            };
            if !canonical_ancestor.starts_with(&root) { return Err("Changed file is outside this repository.".into()); }
            candidate.clone()
        }
    };
    if canonical.exists() {
        let metadata = std::fs::metadata(&canonical).map_err(|e| e.to_string())?;
        if !metadata.is_file() { return Err("Choose a file, not a folder.".into()); }
        if metadata.len() > MAX_FILE_BYTES { return Err("This file is too large to preview (limit 1 MB).".into()); }
    }
    let rel = candidate.strip_prefix(&root).map_err(|_| "Changed file is outside this repository.".to_string())?.to_string_lossy().replace('\\', "/");
    let status = git(&root, &["status", "--porcelain=v1", "-z", "--untracked-files=all"])?;
    let mut status_records = status.stdout.split(|byte| *byte == 0);
    let mut status_code = std::borrow::Cow::Borrowed("");
    let mut original_path = None;
    while let Some(record) = status_records.next() {
        if record.len() < 4 { continue; }
        let code = String::from_utf8_lossy(&record[..2]);
        let changed_path = String::from_utf8_lossy(&record[3..]).into_owned().replace('\\', "/");
        let rename_source = if code.contains('R') || code.contains('C') {
            status_records.next().map(String::from_utf8_lossy).map(|s| s.into_owned())
        } else { None };
        if changed_path == rel {
            status_code = code;
            original_path = rename_source;
            break;
        }
    }
    let is_untracked = status_code == "??";
    let output = if is_untracked {
        let content = std::fs::read_to_string(canonical).map_err(|_| "This file cannot be previewed as text.".to_string())?;
        format!("--- /dev/null\n+++ b/{rel}\n{}", content.lines().map(|line| format!("+{line}\n")).collect::<String>())
    } else {
        let mut args = vec!["--literal-pathspecs", "diff", "HEAD", "--no-ext-diff", "--find-renames", "--unified=3"];
        args.push("--");
        args.push(&rel);
        if let Some(original) = original_path.as_deref() { args.push(original); }
        let (out, truncated, err, status) = git_diff_output(&root, &args)?;
        if !status.success() { return Err(format!("Could not read Git diff: {}", err.trim())); }
        if truncated { format!("{out}\n… diff truncated at 250 KB") } else { out }
    };
    if output.len() > MAX_DIFF_BYTES {
        let mut boundary = MAX_DIFF_BYTES;
        while !output.is_char_boundary(boundary) { boundary -= 1; }
        return Ok(format!("{}\n… diff truncated at 250 KB", &output[..boundary]));
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_project_files_and_rejects_paths_outside_root() {
        let root = env!("CARGO_MANIFEST_DIR").to_string();
        let files = list_files(root.clone()).expect("project tree should be readable");
        assert!(files.iter().any(|entry| entry.path == "Cargo.toml"));
        assert!(read_file(root.clone(), "Cargo.toml".into()).unwrap().contains("[package]"));
        assert!(read_file(root, "../package.json".into()).is_err());
    }

    #[test]
    fn reads_git_status_for_the_containing_repository() {
        let root = env!("CARGO_MANIFEST_DIR").to_string();
        let status = git_status(root).expect("Git status should be readable");
        assert!(status.root.is_some());
    }

    #[test]
    fn reports_renamed_paths_with_spaces_and_unicode() {
        let unique = format!("parallelade-git-status-{}-{}", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let root = std::env::temp_dir().join(unique);
        std::fs::create_dir_all(&root).unwrap();
        let run_git = |args: &[&str]| {
            let result = Command::new("git").arg("-C").arg(&root).args(args).output().unwrap();
            assert!(result.status.success(), "{}", String::from_utf8_lossy(&result.stderr));
        };
        run_git(&["init", "--quiet"]);
        std::fs::write(root.join("before name.txt"), "contents\n").unwrap();
        std::fs::create_dir_all(root.join("removed-folder")).unwrap();
        std::fs::write(root.join("removed-folder").join("stale.txt"), "stale contents\n").unwrap();
        run_git(&["add", "--all"]);
        run_git(&["-c", "user.name=ParallelADE Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "seed"]);
        let renamed = "renamed file ü.txt";
        std::fs::rename(root.join("before name.txt"), root.join(renamed)).unwrap();
        run_git(&["add", "--all"]);

        let status = git_status(root.to_string_lossy().into_owned()).unwrap();
        assert!(status.changes.iter().any(|change| change.path == renamed && change.status.contains('R')), "{:#?}", status.changes.iter().map(|change| (&change.path, &change.status)).collect::<Vec<_>>());
        let diff = git_diff(root.to_string_lossy().into_owned(), renamed.into()).unwrap();
        assert!(diff.contains("rename to"), "diff: {diff:?}");
        std::fs::remove_dir_all(root.join("removed-folder")).unwrap();
        let deleted_diff = git_diff(root.to_string_lossy().into_owned(), "removed-folder/stale.txt".into()).unwrap();
        assert!(deleted_diff.contains("-stale contents"), "diff: {deleted_diff:?}");
        std::fs::remove_dir_all(root).unwrap();
    }
}
