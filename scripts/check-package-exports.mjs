import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");

const packageJsonFiles = [
  "packages/core/package.json",
  "packages/db/package.json",
  "packages/schema/package.json",
];

const errors = [];

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(rootDir, relativePath), "utf8"));
}

function assertPathExists(packageJsonPath, packageDir, fieldName, relativeTarget) {
  const absoluteTarget = resolve(packageDir, relativeTarget);
  if (!existsSync(absoluteTarget)) {
    errors.push(`${packageJsonPath}: ${fieldName} points to missing file ${relativeTarget}`);
  }
}

function visitExports(packageJsonPath, packageDir, prefix, value) {
  if (typeof value === "string") {
    assertPathExists(packageJsonPath, packageDir, prefix, value);
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      visitExports(packageJsonPath, packageDir, `${prefix}.${key}`, nested);
    }
  }
}

for (const packageJsonPath of packageJsonFiles) {
  const pkg = readJson(packageJsonPath);
  const packageDir = resolve(rootDir, dirname(packageJsonPath));

  for (const fieldName of ["main", "module", "types"]) {
    if (typeof pkg[fieldName] === "string") {
      assertPathExists(packageJsonPath, packageDir, fieldName, pkg[fieldName]);
    }
  }

  if (pkg.exports && typeof pkg.exports === "object") {
    for (const [exportKey, exportValue] of Object.entries(pkg.exports)) {
      visitExports(packageJsonPath, packageDir, `exports.${exportKey}`, exportValue);
    }
  }
}

if (errors.length > 0) {
  console.error("Package export surface validation failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Package export surface validation passed.");
