# ParallelADE

**Run multiple Codex sessions. One lightweight workspace.**

A Windows-first terminal workspace built with Tauri 2, React, strict TypeScript, Rust and xterm.js. Run independent installed coding CLIs across projects in one window. The human controls every terminal.

## Windows alpha 0.2

- Named local workspaces with independent projects, selection, layout and pane sizes. Switching workspaces keeps their processes running.
- Adaptive Auto Grid, scalable manual column count, Tabs, and resizable Split. No four-pane paging or artificial terminal limit.
- Drag the dotted header handle to reorder panes. Drag vertical/horizontal boundaries to resize. Double-click empty header space or use maximize to focus a pane; restore returns to the saved arrangement.
- Choose a visible subset; hidden and offscreen sessions keep running. Selecting a hidden terminal reveals it.
- Codex CLI, Claude Code, Gemini CLI, PowerShell, Command Prompt, WSL and saved custom CLI presets. PATH detection and Retry in the creation dialog.
- Add, rename, reorder, collapse, remove and move projects between workspaces. Open their folder location and detect missing directories. Removing a project never deletes its files.
- Cross-workspace search, terminal rename/restart/close, responsive project drawer, native CPU/RAM status and monochrome application chrome. Terminal ANSI colors remain supported.
- Local versioned configuration with v1 migration and a last-known-good backup.

No provider APIs, orchestration, networking, accounts, telemetry or cloud backend are included. Install and authenticate your coding CLIs separately.

## Install dependencies and develop

Windows prerequisites: Node.js 22.12+ or a supported LTS, Rust stable with the MSVC target, Visual Studio C++ Build Tools with a Windows SDK, and Microsoft Edge WebView2 Runtime.

```powershell
npm ci
npm run desktop
```

Cargo fetches Rust dependencies on the first native build. Both lockfiles are included. `npm run dev` runs only the frontend; a normal browser cannot launch local PTYs. Restart ParallelADE after changing PATH.

Custom commands take an executable name/path and a JSON array of arguments, such as `["-NoLogo", "-NoProfile"]`. Arguments are not split on spaces. For shell syntax, explicitly select a shell executable with its command argument. Save a reusable preset with a display name. Windows npm-style `.cmd` and `.bat` shims are supported through PowerShell. WSL uses `wsl.exe --cd <project folder>` and requires an initialized default distribution.

## Build for Windows

```powershell
npm run bundle
```

Outputs:

- `src-tauri/target/release/parallelade.exe`
- `src-tauri/target/release/bundle/nsis/ParallelADE_0.2.0_x64-setup.exe`

The x64 installer is unsigned. Signing and clean-machine installation/uninstallation validation remain follow-ups.

## Layout behavior

Auto considers available width, height, visible terminal count and minimum dimensions. Manual columns accept any practical positive count; the effective count decreases at narrow widths and grows back when space returns. Grid/split panes have a 280 px minimum width and 210 px minimum height; rows scroll instead of becoming unusable. Below 768 px the active pane fills the available workspace and projects move to a drawer.

Resizing supports unequal widths independently within each row. A horizontal divider changes that row's height; panes in a row share their height. This is a compact row-based multiplexer, not an arbitrary overlapping/freeform canvas. Saved width weights and row heights survive reordering, workspace switching and app restarts. Reset pane sizes returns to adaptive sizing. Maximize is temporary and does not replace the saved layout.

## Keyboard controls

| Action                   | Outside terminal input    | Inside terminal input |
| ------------------------ | ------------------------- | --------------------- |
| New terminal             | Ctrl+N                    | Ctrl+Shift+N          |
| Add project              | Ctrl+O                    | Ctrl+Shift+O          |
| Close terminal           | Ctrl+W                    | Ctrl+Shift+W          |
| Search                   | Ctrl+K                    | Ctrl+Shift+K          |
| Next / previous terminal | Ctrl+Tab / Ctrl+Shift+Tab | Same                  |
| Select terminal 1–9      | Ctrl+1–9                  | Same                  |

Tabs span the active workspace. Search matches workspace, project, terminal and command names. Arrow keys on focused resize boundaries resize panes; Alt+Left/Right on a drag handle reorders. Click a terminal title to rename. Restart and Close terminate the process and attempt descendant cleanup.

## Persistence and lifecycle

`parallelade.library.v2` in the application's WebView local storage holds schema version 2. It saves named workspaces, project/terminal order and definitions, visibility, selected items, pane weights/heights, grid mode, sidebar settings and custom presets. Native pointers, PTY handles, output and process state are excluded.

Existing `parallelade.workspace.v1` data migrates into a Default workspace without deleting the original key. Each successful update retains a last-known-good `.backup` value. A damaged primary record can recover from that backup with a warning; unreadable data without a valid backup is not silently overwritten. A failed storage write leaves in-memory configuration unchanged. Local storage provides atomic replacement of one value, not a database transaction or disk-level durability guarantee.

App restart restores **stopped definitions**, not prior processes, terminal history or agent conversation memory. Start creates a new process. Use each CLI's own resume features where available. Reloading the frontend closes stale app-owned PTYs.

Workspace switching preserves live runtimes. Deleting a workspace or removing a project terminates its terminals; it never deletes project folders. Normal app exit cleans up its PTYs. Windows process-tree termination uses `taskkill /T` with child termination fallback. Detached processes, WSL descendants and abrupt OS/app termination are not guaranteed to clean up.

## Architecture

```text
React presentation
  ├── WorkspaceStore → WorkspacePersistence → versioned local library
  ├── TerminalLayout → geometry → reusable TerminalPane / TerminalView
  ├── TerminalController → TerminalService → LocalDesktopTerminal
  │                                          Tauri IPC → Rust Manager → ConPTY
  └── WorkspacePlatform → folder services / PATH detection / system metrics
```

The layout owns geometry and visibility only. `TerminalController` owns runtime state independently of the active workspace. Rust retains process/PTY handles. Presentation does not call Windows process APIs. A future remote transport can implement `TerminalService` for an iOS companion; no networking or mobile backend is implemented.

Important files:

- `src/features/layout/geometry.ts`: adaptive arrangement and constrained resize math.
- `src/components/terminal/TerminalLayout.tsx`: stable pane identity, drag handles and viewport visibility.
- `src/services/terminal/TerminalService.ts`: transport contract.
- `src/services/terminal/TerminalController.ts`: runtime lifecycle and batched output polling.
- `src/services/terminal/TerminalView.ts`: xterm rendering, hidden parsing, bounded history and resize throttling.
- `src/features/workspace/WorkspaceStore.ts`: named-workspace operations and ownership.
- `src/services/persistence/workspace.ts`: schema validation, migration, backup and atomic value replacement.
- `src/features/terminals/presets.ts`: built-in local command definitions.
- `src/components/layout/`: project/workspace management and search.
- `src-tauri/src/terminal/`: preserved PTY engine and real native integration tests.
- `src-tauri/src/commands/`: async IPC adapters and read-only session diagnostics.

## Performance policy

Terminal output does not enter React state. Native output uses a 256 KiB per-session bounded queue, drained in 32 KiB batches about every 40 ms. xterm keeps 1,500 scrollback lines and bounded pending parser data. Hidden sessions retain an unopened parser to answer terminal protocol queries, while their rendered DOM is disposed. Screen contents survive normal view switching through xterm serialization.

Tabs render one terminal. Grid/split render viewports near the scroll area, not every existing terminal. Resize fits on animation frames and throttles native size updates to at most once per 50 ms, with a trailing update. Sustained excess output may discard older display data with a notice; this is not a lossless log recorder.

CPU/RAM in the status bar are whole-system metrics sampled every three seconds. CLI process memory remains additional to the workspace's own memory.

## Verification

```powershell
npm test
npm run build
npm run test:native
cargo test --manifest-path src-tauri/Cargo.toml --lib -- --include-ignored --test-threads=1
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

The opt-in native Codex test requires the installed CLI and sends no agent prompt. Native tests launch real PowerShell PTYs, including 20 concurrent sessions.

Desktop tests replace test data and close test terminals. Use the isolated app launcher:

```powershell
# Terminal 1: separate app identity and data directory, localhost debug port 9224
npm run test:app

# Terminal 2
npm run test:desktop
npm run test:stress
```

The scripts verify the native validation-window title before changing data. They never target the normal application profile. No debugging port is enabled in shipped builds. Historical v0.1 scripts are disabled because their storage/layout assumptions are obsolete. Screenshots and measurements go to ignored `artifacts/`. If OneDrive locks Rust incremental files, use `$env:CARGO_INCREMENTAL = '0'` or a non-synced checkout.

See [VALIDATION.md](VALIDATION.md) for measured results, limitations and acceptance coverage, and [FUTURE.md](FUTURE.md) for deferred scope.

Implementation references: [Tauri](https://v2.tauri.app/develop/calling-frontend/), [portable-pty](https://docs.rs/portable-pty/latest/portable_pty/), [xterm.js](https://xtermjs.org/). MIT licensed.

### Matte black presentation

The application chrome prefers Helvetica Neue, Helvetica, then Arial on Windows. No proprietary font files are bundled. Terminal output stays monospaced for alignment and retains its ANSI colors. The matte treatment uses flat black and charcoal surfaces, consistent control radii, quiet borders and matching SVG icons. There are no decorative gradients, glows, dotted textures, animated backgrounds or additional UI dependencies. Presentation overrides live in `src/workspace-theme.css`.

### GitHub-inspired workspace chrome

The workspace chrome uses a restrained GitHub-style developer palette: near-black canvas, slate panels, blue focus states, green action buttons and fine separators. The current project path sits beneath the project title so switching between folders stays legible. Terminal content remains the primary surface, with the same responsive grid, tab and mobile behavior.

## Local file library

Open **Library** in the top bar from any workspace. Import files of any type, create prompts/notes, search filenames, copy saved text, paste clipboard images while the panel is focused, and export independent copies. Terminals remain mounted and continue running while the panel is open.

Library content is stored outside project folders in the operating system's local app-data directory under the application identifier, in `library/`. Each item has its own content file and JSON metadata. Importing copies the original; changing or deleting a project does not remove library items. This is ordinary local storage, not an access-control vault or backup service.

Text and common raster image formats support previews up to 10 MB. Other formats and larger files can be stored and exported. Clipboard imports above 10 MB should use **Import files** instead. Markdown is displayed as plain text; imported HTML and scripts are never executed. Prompts are saved as new entries; in-place editing and content search are not included.
