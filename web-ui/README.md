# Kanban Web UI

This package contains the Kanban frontend served by the runtime.

## Stack

- React + TypeScript + Vite
- Palantir Blueprint v6 (`@blueprintjs/core`, `@blueprintjs/icons`, `@blueprintjs/select`)
- Atlassian pragmatic drag-and-drop
- Vitest
- Playwright

## Telemetry

Frontend telemetry is currently disabled in this fork.

- `POSTHOG_KEY` and `POSTHOG_HOST` are ignored by the current build.
- The app does not initialize PostHog.
- Session replay, autocapture, and pageview reporting are off.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run test`
- `npm run e2e`
