# kanbanana

Kanbanana is a TypeScript npm package and CLI scaffold for building a kanban system for coding agents.

## What is here now

- TypeScript source and build config
- Minimal CLI entrypoint
- Vitest test setup with one starter test
- Biome linting and formatting
- Husky pre-commit hook
- GitHub Actions for CI and publish

## Requirements

- Node.js 20+
- npm 10+

## Quick start

```bash
npm install
npm run build
npm run check
node dist/cli.js --help
```

## CLI

```bash
kanbanana --help
kanbanana --json
```

## Scripts

- `npm run build`: compile TypeScript into `dist`
- `npm run dev`: run CLI in watch mode
- `npm run lint`: run Biome checks
- `npm run format`: format with Biome
- `npm run typecheck`: run TypeScript in no-emit mode
- `npm run test`: run Vitest once
- `npm run check`: lint, typecheck, and test

## Guardrails

- Biome lint rules are configured in `biome.json`
- Biome GritQL plugin rules live in `grit/`
- Current GritQL rules:
  - `grit/no-process-env-destructure.grit`
  - `grit/no-console.grit`
  - `grit/no-process-exit.grit`

## Tests

- `test/core`: unit tests for core logic
- `test/cli`: unit tests for CLI behavior
- `test/integration`: higher-level integration tests
- `test/fixtures`: test data fixtures
- `test/utilities`: shared test helpers

## Publish checklist

- Verify package name availability on npm
- Add `NPM_TOKEN` secret in GitHub repo settings
- Create a GitHub Release to trigger publish workflow
