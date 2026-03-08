# CLI Runtime Blocker Plan

## Problem Summary

The CLI command surface is not booting under `tsx`, even for help commands such as:

```bash
pnpm exec tsx src/index.ts decisions --help
pnpm exec tsx src/index.ts context --help
```

The observed runtime error is:

```text
SyntaxError: The requested module '@repo/core' does not provide an export named 'createMeetingService'
```

After switching command modules to a local CLI shim, the same failure shape persisted with:

```text
SyntaxError: The requested module '../core' does not provide an export named 'createMeetingService'
```

## What Was Successfully Completed Before Hitting This Blocker

- M5 meeting workflow API slice is implemented and validated.
- M5 context-state API slice is implemented and validated.
- `@repo/api` type-check passed.
- API E2E suite passed with `43/43` tests.
- CLI flagged-decision workflow was improved in source by adding:
  - `decisions list`
  - active-meeting fallback for `decisions flag`
- `apps/cli` TypeScript type-check passes.

## Current Symptom Details

### Runtime behavior

- `pnpm type-check` in `apps/cli` succeeds.
- `pnpm exec tsx src/index.ts decisions --help` fails at runtime.
- `pnpm exec tsx src/index.ts context --help` fails at runtime.
- Failure occurs during module loading before command execution.

### Failing import site

Initial failing import:

- `apps/cli/src/commands/meeting.ts`
- `import { createMeetingService } from '@repo/core';`

After workaround attempt:

- `apps/cli/src/commands/meeting.ts`
- `import { createMeetingService } from '../core';`

## Evidence Collected

### 1. `@repo/core` source entry does export `createMeetingService`

`packages/core/src/index.ts` re-exports `createMeetingService` from `./service-factory`.

### 2. `packages/core/src/service-factory.ts` defines `createMeetingService`

The factory exists and is implemented.

### 3. Built core artifact appears to export `createMeetingService`

`packages/core/dist/index.mjs` contains `createMeetingService` in the final export list.

### 4. Direct runtime import probe from `apps/cli` succeeded

A plain Node ESM import probe showed that `import('@repo/core')` exposes `createMeetingService`.

This suggests the failure is not a simple missing export in the published runtime module.

### 5. Failure appears specific to `tsx` executing the CLI source tree

The problem consistently appears when running the CLI entrypoint with `tsx`.

## Attempts Already Made

### Attempt 1: Add missing CLI workflow command support

Changes made:

- Added `decisions list` to `apps/cli/src/commands/decisions.ts`
- Added active-meeting fallback for `decisions flag`

Result:

- Source changes type-check successfully.
- Did not resolve runtime boot failure.

### Attempt 2: Adjust `packages/core/package.json` entrypoints

Changes made:

- Changed `main` from `./dist/index.js` to `./dist/index.mjs`
- Added `types` and `default` fields to the package `exports` map

Result:

- Did not resolve `tsx` CLI boot failure.

### Attempt 3: Tighten CLI `tsconfig` path aliases

Changes made:

- Updated `apps/cli/tsconfig.json` path aliases to explicit entry files:
  - `../../packages/core/src/index.ts`
  - `../../packages/schema/src/index.ts`
  - `../../packages/db/src/index.ts`

Result:

- `apps/cli` still type-checks.
- `tsx` runtime failure persisted.

### Attempt 4: Add a CLI-local core shim

Changes made:

- Added `apps/cli/src/core.ts` with:

```ts
export * from '../../../packages/core/src/index.ts';
```

- Repointed CLI command modules from `@repo/core` to `../core`

Affected command files:

- `apps/cli/src/commands/meeting.ts`
- `apps/cli/src/commands/transcript.ts`
- `apps/cli/src/commands/decision.ts`
- `apps/cli/src/commands/field.ts`
- `apps/cli/src/commands/template.ts`
- `apps/cli/src/commands/context.ts`
- `apps/cli/src/commands/decisions.ts`
- `apps/cli/src/commands/draft.ts`
- `apps/cli/src/commands/supplementary.ts`

Result:

- CLI type-check still passes.
- Runtime failure persists, now reported against `../core` instead of `@repo/core`.

## Most Likely Hypotheses

### Hypothesis 1: `tsx` is mishandling re-exported TypeScript entry surfaces

`tsx` may be resolving the re-export graph differently from plain Node ESM, especially across workspace boundaries and `.ts` entry re-exports.

### Hypothesis 2: One or more upstream modules in `packages/core/src/index.ts` are causing partial namespace materialization

A loader or evaluation issue in the core entry graph may be surfacing as a misleading named export error.

### Hypothesis 3: CLI bootstrap imports every command too eagerly

`apps/cli/src/index.ts` imports all command modules up front. A single problematic module or transitive dependency can prevent even `--help` for unrelated commands from loading.

### Hypothesis 4: The best short-term fix may be reducing the CLI dependency surface rather than continuing to debug loader behavior

The CLI is scheduled to move toward API-client behavior in M5 anyway, so further deep investment in direct service imports may not be the highest-leverage path.

## Recommended Next Steps

### Option A: Isolate the minimal failing export path

1. Replace `apps/cli/src/core.ts` re-export with a single explicit export:
   - `export { createMeetingService } from '../../../packages/core/src/service-factory.ts';`
2. Test whether `meeting.ts` can boot.
3. Add explicit exports incrementally until the exact failing import or transitive dependency is identified.

### Option B: Split CLI bootstrap to lazy-load command modules

1. Stop importing every command eagerly in `apps/cli/src/index.ts`.
2. Lazy-load command modules per top-level command.
3. Confirm whether `decisions --help` and `context --help` still fail when unrelated command modules are not imported.

### Option C: Pivot M5 CLI to API-client wiring sooner

1. Pause further direct-service CLI repair work.
2. Implement CLI HTTP client wiring for the M5 commands that matter now.
3. Use the working API as the source of truth for the multi-decision workflow.

## Suggested Immediate Investigation Order

1. Try **Option A** first because it is the smallest diagnostic step.
2. If the failure persists, try **Option B** to determine whether bootstrap eagerness is masking the real fault.
3. If both are messy or low-signal, stop and pivot to **Option C**.

## Files Touched During This Investigation

- `packages/core/src/services/global-context-service.ts`
- `apps/cli/src/commands/decisions.ts`
- `packages/core/package.json`
- `apps/cli/tsconfig.json`
- `apps/cli/src/core.ts`
- `apps/cli/src/commands/meeting.ts`
- `apps/cli/src/commands/transcript.ts`
- `apps/cli/src/commands/decision.ts`
- `apps/cli/src/commands/field.ts`
- `apps/cli/src/commands/template.ts`
- `apps/cli/src/commands/context.ts`
- `apps/cli/src/commands/draft.ts`
- `apps/cli/src/commands/supplementary.ts`

## Status

- API M5 context-state slice: complete and validated
- CLI multi-decision source improvements: partially implemented
- CLI runtime boot issue: unresolved
- Recommended next action: isolate the minimal failing export path before making more architectural changes
