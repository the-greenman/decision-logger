# TypeScript Workspace Type System Remediation

Stabilize the remaining workspace type/build issues by preserving the completed TypeScript project-reference refactor and focusing the remaining work on published declaration availability for downstream package consumers, as documented in `docs/type-remediation-log.md`.

## Current Status

### Completed

- **Root config split**
  - Added `tsconfig.base.json` for build-safe shared compiler settings
  - Kept root `tsconfig.json` as the workspace/editor `noEmit` config

- **Project references added**
  - `@repo/db` references `@repo/schema`
  - `@repo/core` references `@repo/schema` and `@repo/db`
  - `@repo/api` references `@repo/schema`, `@repo/db`, and `@repo/core`

- **Package type-check scripts updated**
  - Removed stale `--rootDir ../..` workarounds
  - Shifted referenced packages toward project-build-aware type-check commands

- **Schema runtime metadata aligned**
  - `@repo/schema` package metadata now matches actual emitted files
  - Runtime export investigation confirmed the built bundle exports the expected schemas

- **Core declaration-path issue improved**
  - `@repo/core` no longer shows the earlier TS6305 failure against `@repo/db`

- **Build pipeline stabilized**
  - `@repo/db` and `@repo/core` were moved off `tsup` DTS bundling after repeated `TS6307` failures
  - Full `pnpm build` now passes

- **Workspace type-check stabilized**
  - Full `pnpm type-check` now passes
  - `@repo/api` package-local standalone type-check passes against published workspace declarations

- **Dev/runtime path improved**
  - `pnpm dev` no longer shows the earlier `@repo/schema` missing-export failure in `@repo/api`
  - Current remaining dev failure is declaration-runtime resolution under `tsx` for workspace package `.d.ts` imports

### Still Open

- **Active blocker: `pnpm dev` still has one workspace declaration-runtime resolution error**
  - root `pnpm build` passes
  - root `pnpm type-check` passes
  - the remaining issue is `tsx` following workspace `.d.ts` imports during API dev startup and resolving a nonexistent runtime target from package `dist`
  - current focus is keeping declaration entrypoints valid for type-check while ensuring watch-mode runtime does not treat `.d.ts` relative imports as executable module paths

## Reference Material

- **Detailed findings log**
  - See `docs/type-remediation-log.md`
  - Use that file as the running source of truth for discovered failure modes and partial remediations

## Revised Plan

### 1. Fix the remaining `pnpm dev` declaration-runtime resolution error

- Identify the specific package declaration import path that `tsx` is resolving as a runtime module during `pnpm dev`
- Keep package-local type-check green while fixing the watch/runtime resolution path
- Reopen package metadata or declaration publication only if the runtime trace points back there

### 2. Revalidate the final workspace flow

- Confirm root `pnpm type-check` still passes workspace-wide
- Confirm root `pnpm build` still passes workspace-wide
- Confirm `pnpm dev` starts without the current declaration-runtime resolution error
- If `pnpm dev` still fails, capture the exact remaining runtime import target and keep scope local to package publication/watch-mode behavior

### 3. Finalize documentation and workflow

- Update `docs/type-remediation-log.md` with the final db fix and validation outcome
- Keep the recommended workflow explicit and minimal

## Validation Checkpoints

- [x] Root/shared tsconfig layering split is in place
- [x] Workspace project references are in place
- [x] Schema package metadata matches actual emitted runtime files
- [x] Core no longer fails with the previous TS6305 declaration-path issue
- [x] `@repo/db` `pnpm build` passes without the previous `tsup` DTS-worker failure
- [x] Full workspace `pnpm build` passes
- [x] Full workspace `pnpm type-check` passes
- [x] `pnpm dev` starts without the previous `@repo/schema` runtime export error
- [x] Published declarations for `@repo/core` / `@repo/db` are available in the paths downstream consumers resolve
- [x] `@repo/api type-check` passes with package-local `tsc --noEmit`
- [x] Isolated `@repo/core` declaration/type-check passes
- [x] Isolated CLI package type-check passes
- [ ] `pnpm dev` starts cleanly without declaration-runtime resolution failures

## Working Validation Sequence

```bash
pnpm --filter @repo/schema build
pnpm --filter @repo/db build
pnpm build
pnpm type-check
pnpm dev
```

## Notes

- The original broad remediation plan is mostly complete; avoid redoing those steps unless the remaining declaration-publication investigation proves they were incorrect.
- The current plan intentionally narrows scope to the remaining dev-mode declaration/runtime edge case.

## Benefits

- **Less plan churn** - completed repo-wide changes stay marked done
- **Focused debugging** - remaining effort is centered on one concrete dev-mode runtime/declaration diagnostic
- **Better historical record** - plan and remediation log now point at the same current bottleneck
