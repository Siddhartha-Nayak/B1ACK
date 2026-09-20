# Validation record — ParallelADE 0.2.0

Verified on this Windows x64 development host on 2026-09-09. Node 25.8.1, Rust 1.97.1, Tauri 2.11.5 and xterm.js 5.5.0. These are observations from one host, not cross-machine performance guarantees.

## Build and automated checks

- Strict TypeScript and Vite production build succeeded.
- 12 frontend tests passed: adaptive geometry, scalable manual columns, minimum dimensions, resize math, schema validation, v1 migration, backup recovery, storage failures, workspace isolation and ownership after asynchronous switches.
- All 4 native integration tests passed, including the opt-in installed Codex startup test, 20 concurrent interactive PowerShell PTYs, missing executable/folder errors, batch shims, natural exit, resize, restart and cleanup.
- `cargo clippy --all-targets -- -D warnings` passed.
- npm audit reported zero vulnerabilities.
- Windows optimized executable and unsigned x64 NSIS installer built successfully.
- The bundled 0.2.0 executable launched PowerShell, accepted typed input and returned `RELEASEVERIFIED`; native CPU/RAM displayed.
- A normal close/reopen of the bundled executable preserved the workspace, manual columns and saved custom preset, with zero restored live PTYs.

Release artifacts:

- `src-tauri/target/release/parallelade.exe`
- `src-tauri/target/release/bundle/nsis/ParallelADE_0.2.0_x64-setup.exe`

## Desktop acceptance

Tests used real Tauri IPC, ConPTY and WebView2. They ran in a separate validation identity/profile, not the normal user profile. The release smoke test used a separate profile verified from WebView launch arguments.

- Auto Grid: 1, 4, 9 and 16 panes produced 1, 2, 3 and 4 columns at the test viewport; minimum useful dimensions and scrolling were checked.
- Manual columns use a numeric control. A 10-column arrangement was tested in geometry tests at sufficient width; small windows reduce effective columns.
- Dragged Terminal 9 before Terminal 2 with a visible drop target. Running terminal PIDs remained unchanged.
- Horizontal resizing produced a width ratio greater than 1.9; horizontal and vertical gestures propagated native columns/rows without replacing the process.
- Maximize/restore, visibility selection and Tabs/Grid switching preserved sessions. Split reused the same panes.
- Responsive widths 1440, 1024, 800, 390 and 360 px had no document-level horizontal overflow; narrow views rendered one active terminal.
- Workspace create/rename/switch/delete, project add/reorder/rename/move/collapse, sidebar width and cross-workspace token search passed. Project removal affects configuration, never disk contents.
- Moving projects and switching workspaces retained live PIDs. Missing external folders produced an indicator.
- Custom `cmd.exe` preset creation launched a real shell and saved the correct preset reference.
- Actual app restart restored the complete saved library and custom presets as stopped definitions.
- Restart changed only that terminal's PID and cleared its prior display. Rename/close and invalid folder errors passed.
- ANSI red output remained red within monochrome application chrome. Nonzero exit code 7 stayed visible after a layout change.
- Successful desktop suites and release smoke tests reported no page errors.

The native folder chooser and Explorer folder-opening action are implemented but were not automated. Folder-path entry was tested.

## CLI coverage

| CLI            | Observed result                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex          | Interactive `Ask Codex` prompt reached; seven concurrent prompts in this iteration's mixed run                                                                                          |
| PowerShell     | Real keyboard input, independent directories/output and native concurrency tests passed                                                                                                 |
| Command Prompt | Real custom/built-in command sessions and independent output passed                                                                                                                     |
| Claude Code    | Not installed; missing-PATH feedback and Retry tested; interactive behavior NOT VERIFIED                                                                                                |
| Gemini CLI     | Not installed; missing-PATH feedback and Retry tested; interactive behavior NOT VERIFIED                                                                                                |
| WSL            | PTY launched the installed default Ubuntu distribution, which requested first-run account setup. Setup was not completed; shell interaction and project-directory behavior NOT VERIFIED |

No coding-agent task was submitted. These tests do not establish performance with concurrent active inference jobs.

## Concurrency and performance

Real desktop test: 10 projects with 7 Codex prompts, 7 PowerShell shells and 6 Command Prompt shells. Checkpoints verified 10, 16 and 20 simultaneously live terminals. All 20 PIDs survived drag/resize and 40 workspace switches. Shell responses contained the correct session marker and working directory; no other session's marker appeared.

| Live sessions | Mean frame interval | Maximum frame interval | Sample JS heap |
| ------------- | ------------------- | ---------------------- | -------------- |
| 10            | 16.38 ms            | 16.9 ms                | 17.0 MB        |
| 16            | 16.48 ms            | 17.0 ms                | 19.2 MB        |
| 20            | 16.50 ms            | 16.9 ms                | 27.2 MB        |

- Tab switch verification: 68–102 ms.
- Shell input-to-response checks: 98–831 ms; PowerShell had larger outliers than Command Prompt. These include Playwright polling/IPC overhead and are not keystroke-only benchmarks.
- Full simulated resize gesture plus native update: 413 ms. This includes the duration of the pointer gesture; it does not isolate the trailing resize delay.
- Seven PowerShell sessions generated output during drag/resize. The sampled grid mounted eight nearby xterm views, not all twenty. Mean frame interval remained 16.50 ms, maximum 16.9 ms; transient JS heap was 44.3 MB.
- After 40 workspace switches, forced-GC JS heap changed from 12,278,964 to 12,071,016 bytes: no retained growth in this short sample.
- Whole-host CPU samples were 62–80% during startup and 44.6% under the output sample. Host used RAM reached 7.79 GB of 7.89 GB, so this was a memory-constrained machine, not a controlled idle benchmark.
- Separate two-second idle sample: app plus WebView working sets totaled 337.5 MiB and approximately 1.46% normalized CPU. CLI/console descendants totaled 1,634.5 MiB and 0.06% CPU. Summed working sets may double-count shared pages; native CLI memory is additional to the UI heap.
- Normal shutdown: 54 tracked app/WebView/CLI/console processes, zero survivors after the close check.

A separate native integration test also exercised 20 simultaneous PowerShell PTYs, each with a unique working directory and isolated response markers.

## Evidence and reproducibility

Run `npm run test:app` in one PowerShell and `npm run test:desktop` / `npm run test:stress` in another. Test scripts guard the validation title and replace only that app's data. Production-profile isolation uses the documented [WebView2 user-data environment override](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/webview2-idl?view=webview2-1.0.3967.48); the release script also checks its actual launch arguments.

Raw evidence in ignored `artifacts/`:

- `iteration2-layout-results.json`, `iteration2-workspace-results.json`, `iteration2-regression-results.json`
- `iteration2-stress-results.json`, `iteration2-process-metrics.json`, `iteration2-shutdown-results.json`
- `iteration2-reopen-results.json`, `iteration2-release-results.json`, `iteration2-release-reopen-results.json`, `iteration2-wsl-results.json`
- `iteration2-grid-*.png`, `iteration2-responsive-*.png`, `iteration2-twenty-live.png`, `iteration2-release.png`

Earlier failed test attempts were corrected and rerun where applicable: preset-label and asynchronous assertion mistakes, a multi-element locator in the first reopen assertion, and a close IPC permission denial (normal Windows close was used instead). WSL setup remains an environmental limitation, not a passed shell test.

## Known limitations

- Windows x64 only; installer signing and clean-machine install/uninstall are not verified.
- Claude/Gemini are unavailable and WSL needs user initialization on this host.
- Row-based unequal widths and shared row heights; arbitrary recursive split trees are deferred.
- No restoration of prior process memory, terminal history or coding-agent conversations.
- No guarantee for detached/WSL descendants or abrupt app/OS termination.
- Bounded output/history may truncate display under sustained excess output.
- Long-duration active-output/inference soak and wider hardware testing remain open.
- Vite reports a >500 kB JavaScript chunk warning: approximately 565 kB raw / 156 kB gzip. No speculative dependency or renderer replacement was introduced to hide it.

## Black-and-silver theme follow-up

- Chrome now prefers Helvetica Neue / Helvetica, with Arial fallback where unavailable; terminal text remains monospaced and ANSI colors are preserved.
- CSS-only silver controls, dark metallic pane headers, fine borders, and static dotted-light accents; no extra UI dependencies or background animation loops.
- The live desktop suite passed with the theme: adaptive grids, drag/reorder, native resize/PID preservation, workspace/preset controls, terminal lifecycle and ANSI output.
- A new 20-frame regression check covers fractional Windows display scaling. It exposed rounded content-box measurements toggling scrollbars; measuring and flooring the ResizeObserver content box resolved the jitter.
- Four real PowerShell sessions and a 390 px viewport were visually checked. Screenshots: `artifacts/silver-workspace.png`, `silver-empty.png`, `silver-mobile.png`.
- Rebuilt the Windows installer and verified the packaged silver theme, Helvetica font stack and interactive PowerShell through the isolated release profile (`artifacts/silver-release-results.json`).

## Matte black presentation follow-up

- Replaced the silver treatment with flat black/charcoal surfaces, quiet borders, consistent corner radii and matching SVG controls. Helvetica font preferences and terminal ANSI colors remain intact.
- Frontend build, all 12 unit tests and the desktop acceptance suite passed. Desktop checks covered adaptive layouts, live terminal drag/resize, workspace controls, lifecycle and narrow viewports.
- Excluded native build output and test artifacts from Vite watching after a concurrent packaging run triggered a development page reload during the first drag check. The clean desktop rerun passed.
- Visually inspected four real PowerShell terminals, the empty workspace and a 390 px viewport: `artifacts/matte-workspace.png`, `matte-empty.png`, `matte-mobile.png`.
- Rebuilt the Windows installer and verified the actual packaged executable's matte theme, Helvetica stack and interactive PowerShell with an isolated profile. Evidence: `artifacts/matte-release-results.json`.

## Local Library follow-up

- Frontend production build and all 12 existing unit tests passed. The native desktop application compiled and launched using the isolated validation identifier.
- `scripts/library-check.mjs` verified prompt creation/read/copy, arbitrary binary import retaining independent bytes after source modification, byte-exact export, pasted PNG preview, reload persistence, invalid-ID rejection, responsive 390 px layout and a live PowerShell process keeping its PID/output while Library was open.
- Existing desktop layout/workspace/terminal regression suites passed after adding Library.
- Results: `artifacts/library-results.json`; screenshots: `artifacts/library-desktop.png` and `artifacts/library-mobile.png`.
- Native import/save dialog interaction, manual OS clipboard capture and clean-machine installer testing remain manual checks; the desktop test uses native commands for import/export and a synthetic clipboard file event for image paste.
- Additional checks passed for 10 MB preview limits with unrestricted native import/export, failed-import cleanup, shared Library contents across workspace switches, initial panel focus, default `.md` prompt filenames and Escape dismissal. Evidence: `artifacts/library-edge-results.json` and `artifacts/library-keyboard-results.json`.

## GitHub-inspired chrome follow-up

- Updated the presentation layer to a GitHub-inspired dark developer palette: near-black canvas, slate panels, blue active/focus states, green action buttons and quiet 1px separators.
- Added the active project path below the workspace title for clearer folder context without changing terminal/session behavior.
- Updated xterm’s surface and selection colors to match the chrome while preserving ANSI red output coverage.
- Full desktop layout, workspace and terminal regression suites passed with no page errors. The 1440 px, 390 px and empty-state previews were visually checked in `artifacts/matte-workspace.png`, `artifacts/matte-mobile.png` and `artifacts/matte-empty.png`.
- Rebuilt the NSIS package and smoke-tested the actual packaged executable with an isolated profile: slate canvas color, Helvetica stack and interactive PowerShell all passed. Evidence: `artifacts/github-release-results.json`.
