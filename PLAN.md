# PLAN: Linear issue integration for Shuvban

## Objective

Implement Linear as the first external task source for Shuvban without replacing Shuvban’s existing execution model.

The currently implemented behavior lets a user:
- detect whether Linear is configured via `LINEAR_API_KEY`
- browse/search Linear issues inside Shuvban
- import a Linear issue into an existing Shuvban project backlog
- run the imported task with the normal worktree + PTY agent flow
- sync Shuvban execution state back to Linear using explicit or inferred status mappings
- refresh imported issue metadata safely
- see external issue metadata and sync state on cards and in task details

Still pending:
- UI support for creating Linear issues/sub-issues before import
- direct import of newly created issues into a chosen backlog
- broader routing/cross-project enhancements
- the remaining automated + manual validation items listed later in this plan

Shuvban remains the execution and review plane. Linear is added as an external issue source and status peer.

---

## Scope

### In scope

- Linear-only provider support for the first implementation
- importing Linear issues into existing Shuvban projects
- persisted external-source metadata on board cards
- controlled local-to-remote status sync
- manual and background metadata refresh for imported issues
- conflict-safe remote refresh behavior
- telemetry for all integration operations
- backend, frontend, and test coverage required to ship this safely

### Out of scope

- replacing `RuntimeBoardData` with a remote board model
- multi-provider abstraction beyond what is needed to keep Linear code isolated
- webhook-driven sync in the initial ship
- multi-user collaboration/locking semantics
- cross-project automatic routing in the first ship
- storing third-party secrets in `src/config/runtime-config.ts`

---

## Implementation constraints

The implementation must preserve these existing runtime realities:

- board columns remain `backlog`, `in_progress`, `review`, and `trash`
- the existing project/workspace system remains the only project container model
- imported issues must become normal Shuvban cards so they work with:
  - task worktrees
  - agent sessions
  - review flows
  - dependencies
  - auto-review behavior
- realtime updates must use the existing runtime state + websocket flow
- external provider auth/config must live outside `src/config/runtime-config.ts`
- only launch-supported agents (`claude`, `codex`, `pi`) should be assumed in agent-related flows

Primary codebase touchpoints:
- `src/core/api-contract.ts`
- `src/core/task-board-mutations.ts`
- `src/integrations/config-store.ts`
- `src/integrations/linear-client.ts`
- `src/integrations/linear-types.ts`
- `src/integrations/issue-import.ts`
- `src/integrations/issue-sync.ts`
- `src/integrations/status-mapper.ts`
- `src/integrations/telemetry.ts`
- `src/server/runtime-server.ts`
- `src/trpc/app-router.ts`
- `src/trpc/integrations-api.ts`
- `web-ui/src/App.tsx`
- `web-ui/src/runtime/integrations-query.ts`
- `web-ui/src/runtime/types.ts`
- `web-ui/src/state/board-state.ts`
- `web-ui/src/types/board.ts`
- `web-ui/src/components/project-navigation-panel.tsx`
- `web-ui/src/components/task-create-dialog.tsx`
- `web-ui/src/components/board-card.tsx`
- `web-ui/src/components/card-detail-view.tsx`

---

## Target architecture

Add a dedicated integration layer that enriches the existing Shuvban board model instead of introducing a second task system.

### Backend modules

Create:

```text
src/integrations/
├── config-store.ts
├── linear-client.ts
├── linear-types.ts
├── issue-import.ts
├── issue-sync.ts
├── status-mapper.ts
└── telemetry.ts
```

Add:

```text
src/trpc/integrations-api.ts
```

Responsibilities:
- `config-store.ts`: persisted non-runtime integration settings and provider config lookup
- `linear-client.ts`: thin Linear SDK wrapper with telemetry and normalized error handling
- `linear-types.ts`: normalized DTOs used by the rest of the app
- `issue-import.ts`: convert Linear issue data into a Shuvban card payload
- `issue-sync.ts`: local→remote and remote→local sync orchestration
- `status-mapper.ts`: mapping between board columns/transitions and Linear workflow states
- `telemetry.ts`: structured log/span helpers for integration operations
- `integrations-api.ts`: tRPC surface for connect/search/import/refresh/sync actions

### Frontend modules

Create:

```text
web-ui/src/components/integrations/
├── linear-connect-panel.tsx
├── linear-issue-picker-dialog.tsx
└── external-issue-badge.tsx

web-ui/src/hooks/
├── use-linear-issues.ts
├── use-import-linear-issue.ts
├── use-linear-integration-status.ts
├── use-imported-issue-actions.ts
├── use-imported-issue-refresh.ts
└── use-imported-issue-sync.ts

web-ui/src/runtime/
└── integrations-query.ts
```

Extend existing surfaces instead of creating a parallel task UI.

---

## Data model changes

## 1. Extend board card schema

Update `RuntimeBoardCard` in `src/core/api-contract.ts` to support imported issue metadata.

Add:

```ts
externalSource?: {
  provider: "linear";
  issueId: string;
  identifier: string;
  url: string;
  teamId: string | null;
  projectId: string | null;
  parentIssueId: string | null;
  lastRemoteUpdatedAt: number | null;
  lastSyncedAt: number | null;
  remoteState?: {
    id: string;
    name: string;
    type: string;
  } | null;
  labelNames?: string[];
};
externalSync?: {
  status: "idle" | "syncing" | "error";
  lastError: string | null;
};
```

Apply the same shape across:
- persisted runtime schemas in `src/core/api-contract.ts`
- browser board types in `web-ui/src/types/board.ts`
- any runtime type exports consumed by the web UI

Requirements:
- backward-compatible schema change
- old workspaces must load without a migration script
- default missing fields to `undefined`/`null` safely

## 2. Imported-card prompt format

Imported Linear issues should still populate the existing `prompt` field.

Prompt assembly format:

```text
[ENG-123] Issue title

Source: https://linear.app/...

<issue description>
```

Rules:
- preserve identifier and URL
- preserve enough issue body detail for agent execution
- do not add a new required `title` field in this phase

---

## Configuration and auth

## 1. Integration config storage

Do not use `src/config/runtime-config.ts`.

Store integration config under the Shuvban runtime home at:
- `~/.shuvban/integrations.json`

The implementation also ensures `~/.shuvban/integrations/` exists for future provider-specific files, but the current source of truth is the single JSON file above.

Persist only non-secret integration settings, such as:
- default team ID
- searchable team IDs
- status mapping configuration
- import formatting options

## 2. Authentication

For the first ship:
- use `LINEAR_API_KEY` from environment
- treat missing API key as an unconfigured integration state
- do not implement OAuth in this phase

UI requirements:
- clear configured/unconfigured state
- clear missing-env guidance
- no misleading implication that secrets are stored in runtime config
- no in-app credential entry flow in this phase; the current UI is status/import only

---

## API plan

Add `src/trpc/integrations-api.ts` and mount it from `src/trpc/app-router.ts`.

Initial procedures:
- `getIntegrationStatus`
- `listLinearIssues`
- `getLinearIssue`
- `importLinearIssue`
- `refreshImportedIssue`
- `syncImportedIssueStatus`

Later procedures, but still part of the overall plan structure:
- `createLinearIssue`
- `createLinearSubIssue`

Procedure requirements:
- validate all input with Zod
- return normalized DTOs only
- log all provider calls with correlation fields
- make failures user-visible without corrupting local board state

---

## Status sync behavior

## 1. Board-to-Linear mapping

Local board columns remain:
- `backlog`
- `in_progress`
- `review`
- `trash`

Required mapping behavior:
- `backlog` → configured Linear backlog/todo state, or an inferred fallback state by type/name
- `in_progress` → configured in-progress state, or an inferred fallback state by type/name
- `review` → configured in-review state, or an inferred fallback state by type/name
- `review -> trash` → configured done state, or an inferred fallback completed state

## 2. Trash safety rule

`trash` is overloaded in Shuvban, so it must not always mean done.

Required behavior:
- only `review -> trash` is allowed to auto-sync to Linear Done
- moving an imported card to `trash` from `backlog` or `in_progress` must not automatically mark it done remotely
- non-review trash transitions must either:
  - remain local-only, or
  - use an explicit cancel/archive action later

Do not ship behavior that silently maps all trash transitions to Done.

## 3. Sync directions

### Local → Linear
Push when:
- imported card enters `in_progress`
- imported card enters `review`
- imported card completes via `review -> trash`
- user triggers manual sync

### Linear → Local
Pull only for imported cards, and only for:
- title/body updates
- project/team/label metadata
- parent/sub-issue metadata
- remote workflow state used for display/sync awareness

## 4. Conflict policy

If an imported card has an active local session:
- do not silently overwrite important local state from remote updates
- surface a sync warning/error state
- allow explicit manual refresh/reconcile

---

## Backend implementation workstreams

## Phase 0 — schema and foundations

- [x] Extend `RuntimeBoardCard` in `src/core/api-contract.ts` with `externalSource` and `externalSync`
- [x] Update browser/runtime board types to match
- [x] Ensure workspace-state load/save remains backward-compatible
- [x] Add normalized integration DTOs and schemas in `src/integrations/linear-types.ts`
- [x] Add integration telemetry helpers in `src/integrations/telemetry.ts`

Exit criteria:
- existing boards still load
- typecheck passes
- new card metadata is available end-to-end in runtime and UI types

## Phase 1 — Linear client and config

- [x] Add `@linear/sdk`
- [x] Implement `src/integrations/config-store.ts`
- [x] Implement `src/integrations/linear-client.ts`
- [x] Read `LINEAR_API_KEY` from env in the integration layer only
- [x] Add integration status resolution for configured/unconfigured UI states
- [x] Instrument all Linear client requests with structured logs/spans

Exit criteria:
- runtime can determine whether Linear is configured
- runtime can fetch/search issues through a typed client
- request failures are observable and surfaced cleanly

## Phase 2 — issue import

- [x] Implement `src/integrations/issue-import.ts`
- [x] Add tRPC endpoints for issue search/details/import
- [x] Convert imported Linear issues into normal Shuvban backlog cards
- [x] Persist external metadata on imported cards
- [x] Ensure imported cards behave exactly like existing local cards in session/worktree flows

Exit criteria:
- user can search Linear and import an issue into any existing project backlog
- imported cards persist source metadata and normal Shuvban task fields
- imported tasks start and run without special-case task execution logic

## Phase 3 — UI integration

- [x] Build `linear-connect-panel.tsx`
- [x] Build `linear-issue-picker-dialog.tsx`
- [x] Build `external-issue-badge.tsx`
- [x] Add an “Import from Linear” entry point near task creation
- [x] Extend `card-detail-view.tsx` with external source metadata and manual refresh/sync actions
- [x] Show sync state and last error in card/detail UI

Exit criteria:
- user can discover connection state
- user can import issues from UI without leaving Shuvban
- imported cards display identifier, provider, deep link, and sync status

## Phase 4 — local-to-remote status sync

- [x] Implement `src/integrations/status-mapper.ts`
- [x] Implement `src/integrations/issue-sync.ts` for local→remote transitions
- [x] Sync imported cards on entry to `in_progress`
- [x] Sync imported cards on entry to `review`
- [x] Sync only `review -> trash` to Done
- [x] Surface sync failures in persisted card sync state and detail UI
- [x] Ensure sync attempts do not block core local board behavior

Exit criteria:
- imported cards update Linear predictably
- unsafe trash transitions do not mark remote issues done
- sync errors are visible and recoverable

## Phase 5 — remote refresh and conflict handling

- [x] Add manual refresh for imported issues
- [x] Add background metadata refresh for imported cards only
- [x] Detect and surface conflicts when remote changes arrive during active local execution
- [x] Preserve local execution state when refresh conflicts occur
- [x] Log conflict detection and refresh outcomes with correlation fields

Exit criteria:
- imported cards can refresh remote metadata safely
- active task execution is not silently overwritten
- users can identify and recover from conflicts

## Phase 6 — issue creation support

- [x] Add backend `createLinearIssue`
- [x] Add backend `createLinearSubIssue`
- [ ] Allow newly created issues to be imported directly into a chosen project backlog
- [ ] Preserve parent/sub-issue linkage in persisted card metadata for create flows
- [ ] Extend task creation flows to optionally create in Linear first
- [ ] Add frontend/runtime query helpers that actually call the create endpoints

Exit criteria:
- Shuvban can both consume and originate Linear work from the shipped product surface, not just backend APIs
- created/imported relationships persist correctly

## Phase 7 — routing and cross-project enhancements

- [ ] Add optional routing rules from Linear labels/projects to Shuvban projects
- [ ] Support parent issue fan-out into multiple local projects where appropriate
- [ ] Add cross-project imported-task views using the existing project registry/sidebar
- [ ] Reassess webhook support only after polling/manual refresh behavior is proven

Exit criteria:
- multi-project coordination works without introducing a second project model

---

## Frontend behavior requirements

Imported Linear cards must:
- render as normal cards in existing columns
- show an issue badge such as `ENG-123`
- deep-link to the source issue
- show sync state and sync errors in the detail surface
- preserve all existing task actions unless explicitly restricted by integration rules

Current frontend behavior:
- project navigation shows a `Linear` status panel with configured/unconfigured messaging
- import can be launched from project navigation and from the single-task create dialog
- imported cards show `ExternalIssueBadge` in board cards and task details
- task details expose manual `Refresh` and `Sync` actions
- app-level hooks perform best-effort background refresh and column-transition-triggered sync for imported cards

The import flow must:
- operate within the existing selected project/workspace model
- import into backlog by default
- avoid a separate board or provider-specific task list surface

---

## Telemetry requirements

Telemetry is mandatory in the same change set as the feature.

Implemented event families:
- `integration.linear.request.start`
- `integration.linear.request.complete`
- `integration.linear.request.error`
- `integration.linear.issue_imported`
- `integration.linear.status_sync`
- `integration.linear.conflict_detected`

Required fields wherever available:
- `workspaceId`
- `repoPath`
- `taskId`
- `issueId`
- `identifier`
- `provider`
- `operation`
- `durationMs`
- `ok`
- `errorName`
- `agentId` when a running session is involved

Implementation path currently in code:
- `src/integrations/telemetry.ts` wraps integration operations
- `src/telemetry/runtime-log.ts` is used for structured log emission
- `src/telemetry/sentry-node.ts` is used for error capture
- provider calls and sync flows are latency/error instrumented via logs; explicit tracing spans are not implemented yet in this work

---

## Validation plan

Run for every phase:
- [x] `npm run typecheck`
- [x] `npm run test`
- [x] `npm run web:test`

Required automated coverage:
- [x] import formatting + external metadata persistence tests (`test/runtime/linear-integration.test.ts`)
- [x] status mapping tests (`test/runtime/linear-integration.test.ts`)
- [x] `integrations-api` tests (`test/runtime/trpc/integrations-api.test.ts`)
- [x] browser board type tests for external issue metadata (`web-ui/src/types/board.test.ts`)
- [x] UI test for import dialog flow (`web-ui/src/components/integrations/linear-issue-picker-dialog.test.tsx`)
- [x] UI test for source badge rendering (`web-ui/src/components/external-issue-badge.test.tsx`)
- [ ] integration config-store tests
- [ ] Linear client tests with mocked SDK responses
- [ ] sync conflict tests
- [ ] card-detail metadata rendering tests

Required manual validation scenarios:
- [ ] import a Linear issue into project A backlog
- [ ] start the imported task and verify normal worktree/session behavior
- [ ] move the task to review and verify Linear status sync
- [ ] move from review to trash and verify Done sync
- [ ] move an imported backlog task to trash and verify it does not mark Done remotely
- [ ] refresh an imported issue while a session is active and verify conflict-safe handling

---

## Delivery order

Implement in this order:

1. schema + type foundations
2. Linear config/client layer
3. issue import backend flow
4. UI import flow and metadata rendering
5. local-to-remote status sync
6. remote refresh + conflict handling
7. issue creation/sub-issue support
8. routing and cross-project enhancements

Rules for sequencing:
- do not start sync work until imported cards persist metadata cleanly
- do not start background refresh until manual refresh and conflict-state rendering exist
- do not add routing/webhook complexity before the import and sync model is stable

---

## Shipping criteria

This plan is complete when all of the following are true:
- a user can enable Linear via env-backed configuration and see accurate configured/unconfigured UI state
- a user can search and import a Linear issue into an existing project backlog
- imported issues behave like standard Shuvban tasks during execution
- imported issue metadata is persisted and rendered in the UI
- Linear status sync works for `backlog`, `in_progress`, `review`, and `review -> trash`
- unsafe non-review trash transitions do not mark remote issues done
- refresh and conflict handling are visible and safe
- issue creation/sub-issue creation are wired through to shipped UI flows, not just backend APIs
- telemetry exists for all request/import/sync/conflict paths
- required automated coverage and manual validation scenarios pass
