# Schema-API Alignment (Automated Pipeline)

## Overview

This document describes the automated strategy for ensuring consistency between the logical domain models, the database schema, and the API specification.

## Alignment Strategy: ✅ AUTOMATED PIPELINE

We have moved away from manual alignment between separate definitions. The system uses a **Zod-to-All** pipeline centered in `packages/schema`.

### 1. Logical Source of Truth (`packages/schema`)
The canonical definition of all domain entities resides in `packages/schema` using **Zod**.
- **Rule**: Every change to the data model MUST start here.
- **Inference**: TypeScript types are strictly inferred using `z.infer`.

### 2. API Contract (`@hono/zod-openapi`)
The OpenAPI specification is **dynamically generated** from Hono route definitions in `apps/api`.
- **Mechanism**: Routes use the Zod schemas from `packages/schema` to define request/response bodies.
- **Benefit**: The `docs/openapi.yaml` (or hosted Swagger UI) is a 100% accurate reflection of the implementation. Manual edits to YAML are forbidden.

### 3. Database Layer (`packages/db`)
The physical storage layer is managed via Drizzle ORM in `packages/db`.
- **Alignment**: Drizzle schemas are manually mapped to Zod schemas but verified via automated tests.
- **Validation-at-Edge**: Services validate all data using Zod BEFORE it reaches the database, ensuring the physical layer remains consistent with the logical model.

## Validation Guardrails

To prevent "Pipeline Drift", the following automated checks are in place:

1. **Type-Safety**: The TypeScript compiler ensures that Service methods (using Zod types) and Repository methods (using Drizzle types) are compatible.
2. **Schema Sanity Tests**: Vitest suites in `packages/schema` verify that Zod definitions and Drizzle schemas share the same field names and basic types.
3. **Contract Tests**: API integration tests verify that the generated OpenAPI spec matches the actual JSON payloads.

---

## Historical Mismatches (Resolved)

Previously identified mismatches that were resolved by the transition to the automated pipeline:

- **Confidence Scale**: Standardized to `0-1` float (REAL in SQL, `z.number().min(0).max(1)` in Zod).
- **Expert/MCP Endpoints**: Fully integrated into the Zod-driven API definition.
- **Vector Storage**: Standardized embedding dimensions across Zod and Drizzle.
