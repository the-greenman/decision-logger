# API E2E Testing Analysis

## Summary

During the feedback-chain refactor, API end-to-end testing appeared to show persistent failures in draft generation, draft regeneration, field regeneration, and rollback.

The failures initially looked like application regressions caused by:

- route request validation drift
- stale field identifier assumptions in tests
- missing `decision_feedback` infrastructure
- generation-path runtime errors

Some of those were real issues and were fixed, but the most misleading part of the debugging cycle was that the primary failing test command was not running the API E2E suite with the intended Vitest configuration.

As a result, the test run continued to exercise stale package-resolution behavior even after source fixes had been applied.

## Observed Symptoms

The failing endpoints were concentrated in the decision workflow happy path:

- `POST /api/decision-contexts/:id/generate-draft`
- `POST /api/decision-contexts/:id/regenerate`
- `POST /api/decision-contexts/:id/fields/:fieldId/regenerate`
- `POST /api/decision-contexts/:id/rollback`

The observed statuses included:

- `400` on generation/regeneration endpoints
- `404` on rollback after generation had failed earlier in the sequence

Additional confusion came from two different failure classes appearing at different points:

1. **Real contract drift**
   - legacy request-body validation still existed in some handlers
   - some tests still used stable field names where the route now requires UUIDs

2. **Misleading execution environment drift**
   - the command used for E2E debugging did not load `apps/api/vitest.e2e.config.ts`
   - `@repo/core` and `@repo/db` resolution therefore did not consistently point at current source

## What Was Actually Wrong

### 1. Stale API contract assumptions

A subset of E2E failures were legitimate and needed code/test changes:

- draft generation/regeneration endpoints no longer require meaningful JSON payloads
- tests still contained stale field-name route references after the UUID-only contract became authoritative
- the frontend/web surface also had stale guidance-era assumptions that needed removal

These fixes were necessary but did not fully explain why failures appeared to persist after source changes landed.

### 2. Wrong command for API E2E validation

The larger source of confusion was command selection.

This command was used repeatedly during debugging:

```bash
pnpm --filter @repo/api test -- --run src/__tests__/api.e2e.test.ts
```

But `apps/api/package.json` defines:

```json
"test": "vitest run",
"test:e2e": "vitest run --config vitest.e2e.config.ts"
```

So `test` runs the default Vitest config, while `test:e2e` runs the dedicated API E2E config.

That distinction matters because `apps/api/vitest.e2e.config.ts` defines source aliases:

```ts
resolve: {
  alias: {
    "@repo/schema": path.resolve(__dirname, "../../packages/schema/src"),
    "@repo/db": path.resolve(__dirname, "../../packages/db/src"),
    "@repo/core": path.resolve(__dirname, "../../packages/core/src"),
  },
}
```

Without that config, the API test run may resolve workspace packages through their package exports and built output instead of the patched source under `packages/*/src`.

That made it look like new fixes were not working, even when the source changes were correct.

## Why the Failure Looked Like a DB/Migration Bug

One of the clearest surfaced errors during debugging was:

```json
{"error":"relation \"decision_feedback\" does not exist"}
```

That error appeared while exercising draft generation.

This suggested one of two things:

- the test database had not been migrated to include `decision_feedback`
- or the runtime path being tested was not the one expected during source-level debugging

The second case was the more important insight for the E2E loop.

Because the wrong test command was used, source-level fixes in the feedback repository and draft generation service did not reliably affect the observed test runtime.

In other words, the error message was real, but the persistence of the error after patching source was largely explained by config mismatch.

## Why Rollback Also Failed

`rollback` returned `404` in the failing sequence, but that was downstream fallout.

The rollback test depends on draft generation succeeding first so that a saved version exists. When draft generation fails early, rollback has nothing valid to restore or the expected prior state is never created.

So the rollback failure was not the primary defect. It was a cascade from the broken generation path in the invalid test runtime.

## Debugging Lessons

### Lesson 1: Distinguish contract bugs from execution-environment bugs

Some failures were real API contract regressions.

Others persisted only because the wrong Vitest config was used.

If both are happening at once, it is easy to waste time fixing correct code while observing stale runtime behavior.

### Lesson 2: For workspace packages, E2E config is part of the test contract

In this repo, the E2E config is not optional plumbing. It is part of how the API suite is supposed to execute.

It controls whether `@repo/core`, `@repo/db`, and `@repo/schema` are loaded from source.

### Lesson 3: A single surfaced error can be accurate but still misleading

The `decision_feedback` relation error was useful, but it did not by itself prove that the source fixes were wrong.

It only proved that the runtime path being exercised still required that relation.

The missing piece was recognizing that the active test command was not the authoritative E2E path.

### Lesson 4: Targeted runs should use the same config as full E2E runs

If a targeted reproduction command does not use the same config as the passing/official E2E command, it can produce debugging noise instead of clarity.

## Correct Validation Commands

Use the dedicated API E2E command:

```bash
pnpm --filter @repo/api test:e2e -- src/__tests__/api.e2e.test.ts
```

Recommended shorthand:

```bash
pnpm --filter @repo/api test:api -- src/__tests__/api.e2e.test.ts
```

Or, equivalently:

```bash
pnpm --filter @repo/api exec vitest run --config vitest.e2e.config.ts src/__tests__/api.e2e.test.ts
```

For focused debugging:

```bash
pnpm --filter @repo/api test:e2e -- -t "generate-draft"
pnpm --filter @repo/api test:e2e -- -t "regenerate"
pnpm --filter @repo/api test:e2e -- -t "rollback"
```

Do **not** treat this as equivalent for API E2E debugging:

```bash
pnpm --filter @repo/api test -- --run src/__tests__/api.e2e.test.ts
```

That command uses the default config and can bypass the source aliasing that the API E2E suite depends on.

## Recommended Guardrails

### 1. Prefer `test:e2e` in docs and local workflows

Any documentation or plan that references API E2E execution should use `test:e2e` or an explicit `--config vitest.e2e.config.ts` form.

For day-to-day endpoint-contract testing, prefer the clearer package script alias:

```bash
pnpm --filter @repo/api test:api -- src/__tests__/api.e2e.test.ts
```

### 2. Avoid mixing default Vitest runs with E2E analysis

If the goal is endpoint-contract debugging, use the E2E config every time.

### 3. Keep targeted reproduction commands config-complete

A targeted `-t` run should preserve the same config as the full suite:

```bash
pnpm --filter @repo/api test:e2e -- -t "<term>"
```

### 4. Consider tightening script naming or defaults

If this confusion recurs, consider one of these follow-ups:

- rename the generic API test script to make clear it is not the E2E path
- add a README/testing note near the API package
- add CI/local workflow docs that call out the required E2E config explicitly

## Final Outcome

Once the API E2E suite was run with the correct config, the patched source behavior was exercised correctly and the suite passed:

```bash
pnpm --filter @repo/api test:e2e -- src/__tests__/api.e2e.test.ts
```

Equivalent clearer alias:

```bash
pnpm --filter @repo/api test:api -- src/__tests__/api.e2e.test.ts
```

Result:

- `106 passed`

## Conclusion

The incident was not just an API bug investigation. It was an E2E testing execution-path problem.

The core issue was that the observed failures were being interpreted through the wrong test runtime.

The practical takeaway is:

- fix contract drift in code and tests
- but validate API E2E only through the dedicated E2E config
- otherwise source patches can appear ineffective even when they are correct
