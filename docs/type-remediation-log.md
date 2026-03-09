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
