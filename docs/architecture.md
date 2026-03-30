# Architecture Overview

Shuvban is a local Node runtime plus a React app for running many coding-agent tasks in parallel.

There are three big ideas to keep in mind:

1. The browser is a control surface. It renders state, sends commands, and reacts to live updates.
2. The local runtime is the source of truth for projects, worktrees, sessions, git operations, and streaming state.
3. Agent execution is PTY-backed and command-driven. Shuvban launches supported CLI agents inside task worktrees and streams their state back to the browser.

## System Diagram

```text
+----------------------------------------------------------------------------------+
| Browser UI                                                                       |
| web-ui/src                                                                       |
|                                                                                  |
| App.tsx, hooks/, components/, runtime/, terminal/                               |
+---------------------------------------+------------------------------------------+
                                        |
                                        | TRPC requests and websocket updates
                                        v
+----------------------------------------------------------------------------------+
| Local Runtime                                                                    |
| src/                                                                             |
|                                                                                  |
| trpc/app-router.ts, trpc/runtime-api.ts, server/runtime-state-hub.ts             |
+-------------------------------+--------------------------------+------------------+
                                |                                |
                                v                                v
+-------------------------------+--+          +------------------+-------------------+
| PTY Runtime                      |          | Workspace / Git / State              |
| src/terminal/                    |          | src/workspace/, src/state/           |
|                                  |          |                                      |
| agent-registry.ts                |          | task-worktree.ts                     |
| session-manager.ts               |          | get-workspace-changes.ts             |
| pty-session.ts                   |          | git-history.ts / git-sync.ts         |
| agent-session-adapters.ts        |          | workspace-state.ts                   |
+-------------------------------+--+          +------------------+-------------------+
                                |
                                v
+-------------------------------+--+
| Worktrees and shell processes    |
| per-task cwd, CLI agents, shell  |
+----------------------------------+
```

## Request and Stream Flow

```text
User action in UI
    |
    v
component
    |
    v
hook or runtime query helper
    |
    v
TRPC client
    |
    v
app-router.ts
    |
    v
runtime-api.ts / workspace-api.ts / projects-api.ts
    |
    +--> terminal/session-manager.ts for task and shell sessions
    +--> workspace/* helpers for git, worktrees, and diffs
    +--> config/runtime-config.ts for preferences

Live runtime output
    |
    +--> terminal session summaries
    +--> workspace metadata updates
    +--> project list updates
    |
    v
runtime-state-hub.ts
    |
    v
websocket stream
    |
    v
browser runtime state hooks
    |
    v
board, detail view, sidebar, and terminal panels
```

## Mental Model

The browser layer owns presentation and short-lived UI state.

The runtime layer owns coordination:
- which session to start
- where it runs
- which worktree it uses
- how it is resumed or stopped
- what state gets streamed back to the browser

The execution layer is the actual agent process. Shuvban treats supported agents as CLI tools attached to a PTY. That keeps the runtime model simple and uniform across Claude Code, Codex, pi, and other supported CLIs.

## Core Concepts

| Concept | Meaning | Why it matters |
| --- | --- | --- |
| Workspace | an indexed git repository that Shuvban has opened | most runtime state is scoped to a workspace |
| Task card | a board item with a prompt, base ref, and review settings | the board's unit of work |
| Worktree | a per-task git worktree | task agents run inside one |
| Task session | the live PTY-backed runtime attached to a task card | connects long-running agent work to UI state |
| Home agent session | a synthetic, project-scoped session used by the sidebar agent surface | lets the sidebar reuse session primitives without creating a real task card |
| Runtime summary | the small state object the board uses to track idle/running/review/failed state | drives board badges, detail panes, and notifications |

## Ownership

| Concern | Primary owner | Notes |
| --- | --- | --- |
| board state, workspace state, review state | Shuvban | product state |
| worktree lifecycle | Shuvban | task worktrees are a Shuvban concept |
| agent process lifecycle | Shuvban terminal runtime | start, resize, output, stop, resume |
| runtime preferences | `src/config/runtime-config.ts` | selected agent, shortcuts, prompt templates |
| UI rendering state | browser hooks and components | local presentation state |
| live state fanout | `runtime-state-hub.ts` | browser reacts to streamed state instead of polling |

## Backend Architecture

### TRPC layer

`src/trpc/app-router.ts` defines the typed contract between the browser and runtime.

- `runtime-api.ts` handles runtime commands like loading config, starting/stopping task sessions, shell sessions, and command execution.
- `workspace-api.ts` handles workspace diffs, worktree operations, git metadata, and state persistence.
- `projects-api.ts` handles project indexing and workspace selection.

These files should validate and route, then hand off to smaller helpers rather than accumulate deep business logic.

### Terminal runtime

`src/terminal/` owns process-oriented behavior:

- detecting installed CLIs
- resolving launch commands
- preparing agent-specific wrappers and hook wiring
- spawning PTY sessions
- capturing output and session summaries
- handling the workspace shell terminal

This is the main execution path for supported agents.

For pi specifically, Shuvban keeps the integration PTY-backed in v1 and injects a generated extension under `~/.shuvban/hooks/pi/shuvban-extension.ts`. Task sessions use deterministic `--session-dir` paths scoped by encoded workspace/task ids so `--continue` can reliably resume trashed tasks without reusing raw task ids as filesystem segments. Home sidebar sessions are intentionally ephemeral and therefore use `--no-session` instead of `--session-dir`.

### Workspace and git layer

`src/workspace/` owns repository-facing behavior:

- task worktree creation and deletion
- diff generation
- git history browsing
- fetch/pull/push/checkout/discard helpers
- task turn checkpoints

### State streaming

`src/server/runtime-state-hub.ts` is the main live-update fanout point.

It listens to:
- terminal session summaries
- workspace metadata changes
- project list changes
- workspace state updates

and broadcasts websocket messages consumed by the browser runtime hooks.

## Frontend Architecture

The frontend follows a hooks-first architecture.

- components render UI surfaces
- hooks own domain orchestration
- runtime query helpers talk to TRPC
- terminal components render PTY-backed session views

Important areas:
- `web-ui/src/App.tsx`: top-level composition
- `web-ui/src/hooks/`: domain orchestration for navigation, sessions, onboarding, git actions, and notifications
- `web-ui/src/runtime/`: query/state helpers and websocket stream handling
- `web-ui/src/components/detail-panels/agent-terminal-panel.tsx`: task and sidebar terminal surface

## Typical Flows

### Starting a task

1. The browser asks the runtime to start a task session.
2. The runtime resolves the task worktree cwd.
3. The agent registry resolves the selected CLI command.
4. The terminal runtime starts a PTY-backed process.
5. Session summaries stream back to the browser through the runtime state hub.

### Reviewing changes

1. The detail view requests workspace changes.
2. `workspace-api.ts` resolves the relevant worktree and diff mode.
3. The workspace helpers compute either the full working-copy diff or the last-turn diff.
4. The browser renders the diff alongside the terminal panel.

### Sidebar home agent session

1. The browser creates a synthetic home session id for the current workspace.
2. The runtime starts a terminal-backed session at the repo root.
3. The sidebar renders the same PTY-backed terminal surface used elsewhere, but without creating a board task.

## Change Guidelines

When making changes:
- keep agent execution PTY-backed unless there is a very strong reason not to
- keep runtime config focused on Shuvban-owned preferences
- keep TRPC handlers thin
- prefer extracting behavior into hooks and utilities over adding wrapper layers
- preserve the single source of truth: runtime state lives in the runtime, not the browser

## Where To Look First

| If you need to change... | Start here |
| --- | --- |
| agent detection or launch flags | `src/terminal/agent-registry.ts`, `src/terminal/agent-session-adapters.ts` |
| PTY session lifecycle | `src/terminal/session-manager.ts`, `src/terminal/pty-session.ts` |
| worktrees | `src/workspace/task-worktree.ts` |
| diff behavior | `src/trpc/workspace-api.ts`, `src/workspace/get-workspace-changes.ts` |
| runtime websocket state | `src/server/runtime-state-hub.ts`, `web-ui/src/runtime/use-runtime-state-stream.ts` |
| settings UI | `web-ui/src/components/runtime-settings-dialog.tsx`, `web-ui/src/runtime/use-runtime-config.ts` |
| sidebar/home agent behavior | `web-ui/src/hooks/use-home-agent-session.ts`, `web-ui/src/hooks/use-home-sidebar-agent-panel.tsx` |
