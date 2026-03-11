import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");

const artifactPaths = [
  "packages/db/drizzle/*.sql",
  "packages/db/drizzle/meta/*.json",
];

function git(args) {
  return execSync(`git ${args}`, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function getTrackedArtifactFiles() {
  const files = git(`ls-files ${artifactPaths.map((pattern) => `"${pattern}"`).join(" ")}`)
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean)
    .sort();

  return files;
}

function buildFingerprint(files) {
  const hash = createHash("sha256");

  for (const relativePath of files) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(resolve(rootDir, relativePath)));
    hash.update("\0");
  }

  return hash.digest("hex");
}

const trackedFilesBefore = getTrackedArtifactFiles();
const fingerprintBefore = buildFingerprint(trackedFilesBefore);

execSync("pnpm db:generate", {
  cwd: rootDir,
  stdio: "inherit",
});

const trackedFilesAfter = getTrackedArtifactFiles();
const fingerprintAfter = buildFingerprint(trackedFilesAfter);

if (fingerprintBefore !== fingerprintAfter) {
  console.error("Database artifact drift detected. Committed Drizzle SQL/meta files changed after generation.");
  console.error("Review and commit the updated files under packages/db/drizzle before continuing.");
  process.exit(1);
}

console.log("Database artifact drift check passed.");
