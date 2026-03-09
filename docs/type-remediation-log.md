# Type Remediation Log

## 2026-03-09 - Workspace declaration outputs causing package-local build failures

### Symptom
- `packages/core` DTS builds can fail after schema or db type changes with errors like missing exported members or missing declaration files for `@repo/schema` / `@repo/db`.
- The code itself can be correct while package-local build output is stale.

### Trigger observed
- Added `ReadableTranscriptRow.chunkIds` in `packages/schema/src/index.ts`.
- `packages/core` still saw the older `@repo/schema` declarations until `@repo/schema` was rebuilt.
- `packages/core` DTS build also required `@repo/db` declarations to exist before rebuilding `@repo/core`.

### Working remediation
1. Rebuild upstream workspace packages first.
2. Then rebuild the dependent package.

### Known-good order
```bash
pnpm --filter @repo/schema build
pnpm --filter @repo/db build
pnpm --filter @repo/core build
```

### Notes
- Repo-wide validation can still pass when Turbo executes builds in dependency order.
- Package-local validation is more likely to surface this issue when a dependency's dist declarations are stale.
- If this keeps recurring, consider adding explicit dependency-aware build orchestration or prebuild guards rather than relying on manual rebuild order.

## 2026-03-09 - Watch-mode package entrypoints mismatched emitted files

### Symptom
- `pnpm dev` failed in `@repo/api` with a runtime ESM import error claiming `@repo/schema` did not export `CreateMeetingSchema`.

### Trigger observed
- `packages/schema/package.json` advertised:
  - `main: ./dist/index.js`
  - `types: ./dist/index.d.ts`
- but `tsup` emits:
  - `dist/index.mjs`
  - `dist/index.d.mts`

### Working remediation
1. Align package metadata with actual emitted files.
2. Rebuild the package.
3. Verify runtime exports directly with a Node ESM import.

### Fix applied
```json
{
  "main": "./dist/index.mjs",
  "types": "./dist/index.d.mts",
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs",
      "default": "./dist/index.mjs"
    }
  }
}
```

### Verification
- `node --input-type=module -e 'import("@repo/schema")'` resolved runtime schema exports successfully after the fix.

## 2026-03-09 - Watch-mode DTS generation caused cascading workspace type failures

### Symptom
- `pnpm dev` surfaced many TS7016 and DTS bundling errors in `@repo/db` and `@repo/core` against workspace packages such as `@repo/schema`.
- The app runtime could still be fine, but `tsup --watch` declaration bundling failed noisily and repeatedly.

### Trigger observed
- Package `dev` scripts for `@repo/schema`, `@repo/db`, and `@repo/core` used `tsup --watch` with DTS generation enabled.
- In watch mode, declaration bundling across workspace package boundaries proved much less stable than normal builds.

### Working remediation
1. Keep `build` producing declarations.
2. Disable DTS generation for `dev` watch scripts.
3. Use normal `build` / `type-check` commands for declaration validation.

### Fix applied
```json
{
  "dev": "tsup --watch --no-dts"
}
```

### Notes
- This is a dev-loop stabilization fix, not a reduction in release/build validation.
- `build` still generates `.d.mts` outputs.
- `type-check` remains the place for strict TS validation during development.

## 2026-03-09 - Watch-mode clean step caused transient missing-package runtime failures

### Symptom
- `@repo/api` sometimes failed during `pnpm dev` with runtime import errors against workspace packages even though direct imports worked and package exports were valid.

### Trigger observed
- `tsup --watch` still cleaned the output folder at startup.
- During that window, `dist` could be temporarily empty while `@repo/api` booted.

### Working remediation
1. Keep cleaning enabled for normal builds.
2. Disable cleaning in watch mode.

### Fix applied
```ts
export default defineConfig((options) => ({
  clean: !options.watch,
}));
```

### Notes
- This prevents temporary disappearance of `dist` artifacts during watch startup.
- It complements the `--no-dts` dev-script change rather than replacing it.

## 2026-03-09 - Root tsconfig mixed no-emit IDE settings with buildable workspace package settings

### Symptom
- Adding TypeScript project references surfaced compiler errors such as referenced projects "may not disable emit" or "must have setting `composite: true`".
- Package-local type-check behavior diverged from build behavior because buildable packages inherited root no-emit settings meant for editor/workspace validation.

### Trigger observed
- `packages/schema`, `packages/db`, `packages/core`, and buildable apps extended the root `tsconfig.json`.
- Root `tsconfig.json` included `noEmit: true` and `allowImportingTsExtensions: true`.
- Those settings are acceptable for IDE/no-emit validation, but incompatible with emit-capable composite projects used by TypeScript project references.

### Working remediation
1. Split shared compiler settings into a build-safe base config.
2. Keep the root workspace config as the IDE/no-emit entrypoint.
3. Point buildable packages/apps at the build-safe base config.
4. Add `composite: true` and `references` only on emit-capable projects.
5. Replace package-local `--rootDir ../..` type-check workarounds with project-build-aware TypeScript commands.
6. Align package metadata and emitted declaration layouts with the files actually produced by `tsup` and `tsc`.

### Fix applied
```text
tsconfig.base.json
  - shared strict compiler options
  - workspace path mappings
  - no noEmit
  - no allowImportingTsExtensions

tsconfig.json
  - extends ./tsconfig.base.json
  - sets noEmit: true
  - holds workspace references for editor/build graph awareness

packages/* and buildable apps/*
  - extend ../../tsconfig.base.json
  - set composite: true where referenced
  - set noEmit: false
  - declare references to upstream workspace packages

package scripts
  - stop using `tsc --noEmit --rootDir ../..`
  - use project-build-aware commands for referenced packages where declaration artifacts are required

package metadata/output follow-up
  - align `@repo/schema` package.json exports with actual emitted files (`index.js`, `index.cjs`, `index.d.ts`)
  - align `@repo/db` declaration output layout with downstream expectations by keeping `rootDir` under `src`
```

### Verification notes
- `@repo/core` no longer fails with TS6305 after the `@repo/db` declaration-layout fix.
- `@repo/schema` runtime exports exist in the built `dist/index.js` bundle after package metadata was realigned.
- `@repo/db` may still surface DTS build-specific constraints if the composite project file list and emitted output layout drift apart.
- Remaining `@repo/api` failures should be treated as runtime/package-resolution follow-up rather than missing source exports in `@repo/schema`.

### Workflow going forward
```bash
pnpm build
pnpm type-check
pnpm dev
```

### Notes
- Do not use a single root tsconfig for both no-emit editor validation and emit-capable referenced workspace packages.
- `allowImportingTsExtensions` is a no-emit-oriented setting and should stay out of the emit-capable shared base config.
- If project references are reintroduced or expanded later, ensure new referenced projects do not inherit root no-emit settings by accident.
- `tsup` runtime output naming and TypeScript declaration output naming can differ; package.json export maps must match the files that actually exist.
- For referenced workspace packages, declaration generation is part of the dependency contract; if a downstream package depends on declarations, plain `tsc --noEmit` may not be enough to validate the real integration path.

## 2026-03-09 - `@repo/db` still fails during `tsup` DTS bundling even after project-reference remediation

### Symptom
- `pnpm build` still fails in `@repo/db` while JavaScript bundling succeeds but DTS bundling fails.
- Error class is `TS6307`: files imported from `src/index.ts` are reported as not being listed in the project file list.

### Trigger observed
- `@repo/db` JavaScript output builds successfully with `tsup`.
- `@repo/core` package-local type-check improved after the `@repo/db` declaration-layout fix.
- `@repo/db` still fails specifically when `tsup` invokes DTS generation against the composite project.
- Reported files include:
  - `src/schema.ts`
  - `src/client.ts`
  - multiple `src/repositories/*.ts` files

### Working interpretation
1. The repo now has a meaningful distinction between:
   - TypeScript project-reference/type-check behavior
   - `tsup` declaration bundling behavior
2. A config change can improve downstream `tsc` reference resolution while still leaving `tsup` DTS bundling unhappy.
3. `@repo/db` should be treated as the current build bottleneck, not `@repo/core`.

### Current state of remediation
- `@repo/schema` package metadata was realigned to the actual emitted files.
- `@repo/core` no longer shows the previous TS6305 declaration-path issue against `@repo/db`.
- `@repo/db` local build now succeeds after moving declaration emission out of `tsup`'s DTS worker.
- `@repo/core` later showed the same `tsup` DTS-worker failure mode and was moved to the same declaration-first / JS-bundling-second build pattern.
- Full `pnpm build` now passes.

### Fix applied
```json
{
  "build": "tsc --build --emitDeclarationOnly && tsup --no-dts"
}
```

### Why this worked
- `tsc --build --emitDeclarationOnly` handles the composite-project declaration graph directly.
- `tsup --no-dts` remains responsible only for JavaScript bundling.
- This avoids the failing `tsup` DTS worker path while preserving emitted declarations for downstream packages.

### Follow-up discovered
- Build success does not automatically mean downstream package consumers can resolve published declaration files.
- `@repo/api type-check` still surfaces declaration-consumption issues for `@repo/core` / `@repo/db`.
- The remaining blocker is now declaration publication / resolution for type-check, not JavaScript bundling.

## 2026-03-09 - Build is green, dev no longer hits schema export mismatch, remaining blocker is declaration publication for type-check

### Symptom
- `pnpm build` now succeeds.
- `pnpm dev` no longer fails with the earlier `@repo/schema` missing-export runtime error.
- `pnpm dev` currently stops in `@repo/api` only because port `3000` is already in use (`EADDRINUSE`).
- `pnpm --filter @repo/api type-check` and `pnpm type-check` still fail because downstream packages cannot reliably consume published declaration outputs from `@repo/core` / `@repo/db`.

### Trigger observed
- `@repo/db` and `@repo/core` were both moved off `tsup` DTS bundling to avoid `TS6307` failures.
- Package metadata for `@repo/core` / `@repo/db` was then adjusted toward `.js` / `.d.ts` outputs.
- Despite improved build stability, declaration files were not yet confirmed in the published locations expected by downstream package type-check.

### Working interpretation
1. There are now two separate success criteria:
   - JavaScript/runtime build health
   - Published declaration availability for downstream package type-check
2. The repo has progressed from broad workspace instability to a narrower packaging problem around declaration publication.
3. `pnpm dev` is no longer blocked by the original workspace-type problem; its current failure is operational (`EADDRINUSE`).

### Current state
- `pnpm build` passes.
- `pnpm dev` gets past the previous schema export/runtime mismatch.
- `pnpm dev` currently fails only because another process is already bound to port `3000`.
- Remaining technical blocker: make `@repo/core` / `@repo/db` publish declarations in the exact paths consumed by downstream package type-check.

### Notes
- Treat `EADDRINUSE` as a local environment/runtime issue, not as evidence that the type-system remediation regressed.
- The next strategy should focus on declaration publication paths and package-consumer expectations, not on more broad tsconfig/reference changes.

### Recommended validation sequence
```bash
pnpm --filter @repo/schema build
pnpm --filter @repo/db build
pnpm --filter @repo/core type-check
pnpm build
```

### Notes
- Keep distinguishing `tsc` project-reference success from `tsup` DTS bundling success; they are not currently equivalent in this repo.
- `@repo/db` no longer needs `tsup` DTS bundling in its `build` script as long as declaration emission is handled explicitly by `tsc` first.
- Downstream/full-workspace validation can still fail for separate reasons; treat `@repo/db` DTS worker failure as resolved unless it reappears through another path.
