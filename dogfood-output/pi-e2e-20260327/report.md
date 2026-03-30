# Dogfood Report — Kanban pi end-to-end

- Date: 2026-03-27
- Target: Kanban current checkout
- Focus: First-class pi support end-to-end
- Environment: local Linux, live Kanban runtime + real pi binary
- Base URL: http://127.0.0.1:3486/kanban

## Findings summary

- Critical: 0
- High: 0
- Medium: 1
- Low: 0

## Issues

### ISSUE-001: pi task did not complete within observation window

- Severity: medium
- Description: A simple live pi task successfully launched, showed a terminal-backed session, and backend logs confirmed `pi_task_session_started`, but it did not visibly reach Review within 45 seconds.
- Expected: A simple task like creating a one-line markdown file should complete quickly or at least surface clearer progress/completion in the board UI.
- Actual: The task started and the terminal became visible, but no visible transition to Review or explicit failure appeared within the 45-second observation window.
- Repro:
  1. Dismiss startup onboarding if present
  2. Open Settings and select pi as the task agent
  3. Create a simple backlog task (e.g. create a tiny markdown file in the repo root)
  4. Open the created task and click Start
  5. Wait 45 seconds
- Evidence: 07-task-opened.png, 08-task-started.png, 09-terminal-visible.png

## Notes

- The pi-specific settings copy rendered correctly.
- The task launch path did work far enough to open a terminal-backed session.
- Runtime logs confirmed:
  - `pi_extension_generated`
  - `pi_task_session_started`
  - `pi_launch_prepared`
- The Share Feedback button is visible in the sidebar after re-enable.
