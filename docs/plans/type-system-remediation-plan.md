# TypeScript Workspace Type System Remediation

Fix persistent type resolution issues by implementing TypeScript project references and aligning build/type-check workflows across all packages.

## Root Causes

**Path Mapping vs Distribution Mismatch**
- Root `tsconfig.json` maps `@repo/*` to `src/`, but builds consume from `dist/`
- Creates IDE vs runtime vs build mismatches
- Stale dist artifacts cause "missing export" errors

**Missing TypeScript Project References**
- No package uses `references` array despite workspace dependencies
- TypeScript can't track cross-package type changes incrementally
- Manual rebuild order (schema → db → core) is a workaround, not a solution

**Type-Check Scope Issues**
- `@repo/db` and `@repo/core` use `--rootDir ../..` to access src mappings
- Creates divergence: type-check validates src/, build validates dist/

## Pragmatic Solution (All Packages, All at Once)

### 1. Implement TypeScript Project References

**Update `packages/schema/tsconfig.json`:**
- Already has `composite: true` ✓
- No changes needed (no dependencies)

**Update `packages/db/tsconfig.json`:**
- Add `composite: true`
- Add `references: [{ "path": "../schema" }]`

**Update `packages/core/tsconfig.json`:**
- Add `composite: true`
- Add `references: [{ "path": "../schema" }, { "path": "../db" }]`

**Update root `tsconfig.json`:**
- Keep current strict settings
- Keep path mappings (IDE needs them for navigation)
- Add top-level `references` array pointing to all packages
- This enables `tsc --build` from root

### 2. Fix Type-Check Scripts

**All packages:** Change from `tsc --noEmit --rootDir ../..` to just `tsc --noEmit`
- Each package validates its own scope against referenced packages' declarations
- No more root-level type validation workaround

**Root package.json:** Keep existing Turbo-based `type-check` script
- Turbo handles parallel execution and dependency order
- Already has `dependsOn: ["^build"]` configured correctly

### 3. Establish Required Build Workflow

**Document as explicit requirement:**
```bash
# First-time setup or after clean:
pnpm build

# Then start dev mode:
pnpm dev
```

**Why not auto-build in dev?**
- Adds complexity to watch mode coordination
- Build is fast with Turbo cache
- Explicit build step is clearer and safer
- Matches existing remediation log pattern

### 4. Verify Turbo Configuration

**Confirm `turbo.json` already handles this correctly:**
- `type-check.dependsOn: ["^build"]` ensures upstream packages build first
- `dev` has no build dependency (expects manual build first)
- No changes needed to Turbo config

## Implementation Steps

1. **Update all three package tsconfigs** (schema, db, core)
2. **Add root-level references array** to root tsconfig.json
3. **Update type-check scripts** in all three package.json files
4. **Test the workflow:**
   ```bash
   # Clean slate
   rm -rf packages/*/dist
   
   # Should build in correct order
   pnpm build
   
   # Should pass using project references
   pnpm type-check
   
   # Should work without type errors
   pnpm dev
   ```
5. **Update type-remediation-log.md** with solution and workflow

## Validation Checkpoints

- [ ] All packages have `composite: true` and correct `references`
- [ ] Root tsconfig has `references` array
- [ ] All package type-check scripts use `tsc --noEmit` only
- [ ] Clean build succeeds: `rm -rf packages/*/dist && pnpm build`
- [ ] Type-check passes after clean build: `pnpm type-check`
- [ ] Dev mode works after build: `pnpm build && pnpm dev`
- [ ] Schema change triggers proper rebuild chain

## Benefits

- **Eliminates manual rebuild order** - TypeScript knows the dependency graph
- **Consistent validation** - type-check and build use same artifact paths
- **Clear workflow** - explicit build requirement, no hidden complexity
- **IDE support** - path mappings remain for Go to Definition
- **Turbo optimization** - existing cache and parallelization work correctly
