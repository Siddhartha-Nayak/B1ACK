# Future compatibility and scope

Deferred; no implementation in this alpha:

- macOS and Linux native presets, testing and packaging.
- iOS/iPadOS as a remote companion; do not assume arbitrary local CLI processes or desktop PTYs.
- Remote terminal transport behind `TerminalService` to a user-controlled desktop/server.
- Arbitrary recursive split trees beyond the current resizable row-based layout.
- Windows installer signing and clean-machine release validation.
- Long-running active-output and active-inference memory/latency soak tests across hardware.
- Installed Claude Code and Gemini interactive validation; this host does not have either CLI.
- WSL shell and descendant-cleanup validation after the user's distribution initialization.
- Stronger process-tree ownership for abnormal shutdown and deliberately detached children.
- Optional quick actions for frequently used presets, only if they keep creation simple.

Explicit product non-goals, not an implementation backlog:

- Agent orchestration, agent communication, planning, decomposition or workflow engines.
- CI/PR monitoring, Git automation, automated repair loops and remote workers.
- Goals, schedules and autonomous task execution.
- RAG, model inference, provider API wrappers and built-in chat.
- Authentication, cloud services, team collaboration, billing and telemetry.

ParallelADE manages the environment. The user controls every terminal.
