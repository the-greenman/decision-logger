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

- **Dev/runtime path improved**
  - `pnpm dev` no longer shows the earlier `@repo/schema` missing-export failure in `@repo/api`
  - Current dev failure is environmental (`EADDRINUSE` on port `3000`)

### Still Open

- **Active blocker: published declaration availability for downstream type-check**
  - `pnpm build` now passes, but downstream packages still need published declarations in the paths they consume
  - `@repo/api type-check` remains the best signal for the remaining mismatch
  - Current focus is `@repo/core` / `@repo/db` declaration publication, not JavaScript bundling

## Reference Material

- **Detailed findings log**
  - See `docs/type-remediation-log.md`
  - Use that file as the running source of truth for discovered failure modes and partial remediations

## Revised Plan

### 1. Resolve published declaration output for `@repo/core` / `@repo/db`

- Ensure declaration files are emitted into the package paths advertised by `package.json`
- Verify downstream packages resolve those declaration files during `type-check`
- Keep fixes local to package publishing/build configuration where possible

### 2. Revalidate downstream consumers

- Confirm `@repo/api type-check` passes
- Confirm `pnpm type-check` passes workspace-wide
- Confirm `pnpm dev` starts cleanly once the local port conflict is removed

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
- [ ] Full workspace `pnpm type-check` passes
- [x] `pnpm dev` starts without the previous `@repo/schema` runtime export error
- [ ] Published declarations for `@repo/core` / `@repo/db` are available in the paths downstream consumers resolve
- [ ] `pnpm dev` starts cleanly when port `3000` is free

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
- The current plan intentionally narrows scope to the remaining downstream declaration-consumption blocker.

## Benefits

- **Less plan churn** - completed repo-wide changes stay marked done
- **Focused debugging** - remaining effort is centered on one concrete downstream packaging blocker
- **Better historical record** - plan and remediation log now point at the same current bottleneck
