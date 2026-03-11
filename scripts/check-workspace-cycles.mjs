import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");

const packageJsonFiles = [
  "apps/api/package.json",
  "apps/cli/package.json",
  "apps/transcription/package.json",
  "apps/web/package.json",
  "packages/core/package.json",
  "packages/db/package.json",
  "packages/schema/package.json",
];

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(rootDir, relativePath), "utf8"));
}

const workspacePackages = packageJsonFiles.map((relativePath) => {
  const pkg = readJson(relativePath);
  return {
    name: pkg.name,
    relativePath,
    dependencies: {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    },
  };
});

const workspaceNames = new Set(workspacePackages.map((pkg) => pkg.name));
const graph = new Map(
  workspacePackages.map((pkg) => [
    pkg.name,
    Object.keys(pkg.dependencies)
      .filter((dependencyName) => workspaceNames.has(dependencyName))
      .sort(),
  ]),
);

const visiting = new Set();
const visited = new Set();
const cycles = [];

function dfs(node, path) {
  if (visiting.has(node)) {
    const cycleStartIndex = path.indexOf(node);
    cycles.push([...path.slice(cycleStartIndex), node]);
    return;
  }

  if (visited.has(node)) {
    return;
  }

  visiting.add(node);
  const neighbors = graph.get(node) ?? [];
  for (const neighbor of neighbors) {
    dfs(neighbor, [...path, neighbor]);
  }
  visiting.delete(node);
  visited.add(node);
}

for (const node of graph.keys()) {
  dfs(node, [node]);
}

if (cycles.length > 0) {
  console.error("Workspace dependency cycle check failed:\n");
  for (const cycle of cycles) {
    console.error(`- ${cycle.join(" -> ")}`);
  }
  process.exit(1);
}

console.log("Workspace dependency cycle check passed.");
