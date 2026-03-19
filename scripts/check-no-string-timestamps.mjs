#!/usr/bin/env node
/**
 * Phase 1c enforcement: no string timestamp comparisons in query code.
 *
 * After the preprocessor boundary, startTime/endTime string columns must
 * NEVER appear in gte/lte/gt/lt/eq/where expressions. Only startTimeMs/
 * endTimeMs (integer ms) may be used for computation.
 *
 * This script fails if any repository or service file in packages/db or
 * packages/core contains a drizzle comparator call referencing the string
 * startTime or endTime column directly.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SEARCH_DIRS = ["packages/db/src", "packages/core/src"];

// Pattern: drizzle comparators on the bare startTime / endTime columns.
// Matches things like: gte(transcriptChunks.startTime, ...) or
// lte(someTable.endTime, ...) but NOT startTimeMs / endTimeMs.
const VIOLATION_RE =
  /\b(gte|lte|gt|lt|eq|ne|between)\s*\(\s*\w+\.(start|end)Time\s*[^M]/;

function walkFiles(dir, ext = ".ts") {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkFiles(full, ext));
    } else if (full.endsWith(ext) && !full.includes(".test.") && !full.includes("/dist/")) {
      results.push(full);
    }
  }
  return results;
}

let violations = 0;

for (const dir of SEARCH_DIRS) {
  const absDir = join(ROOT, dir);
  let files;
  try {
    files = walkFiles(absDir);
  } catch {
    continue; // directory may not exist yet
  }

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (VIOLATION_RE.test(line)) {
        console.error(
          `\x1b[31m[no-string-timestamps]\x1b[0m ${relative(ROOT, file)}:${i + 1}`,
        );
        console.error(`  ${line.trim()}`);
        violations++;
      }
    }
  }
}

if (violations > 0) {
  console.error(
    `\n\x1b[31m✖ ${violations} string-timestamp comparison(s) found.\x1b[0m`,
  );
  console.error(
    "  Use startTimeMs / endTimeMs (integer ms) in all query expressions.",
  );
  process.exit(1);
} else {
  console.log("\x1b[32m✔ No string-timestamp comparisons found in db/core queries.\x1b[0m");
}
