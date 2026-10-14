import { readdirSync, existsSync } from "node:fs";
import { join, relative, dirname, basename, resolve } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

const localCompact = join(homedir(), ".local/bin/compact");
const compact = process.env.COMPACT_BIN ?? (existsSync(localCompact) ? localCompact : "compact");
const version = spawnSync(compact, ["compile", "--version"], { encoding: "utf8" });
if (version.status !== 0 || version.stdout.trim() !== "0.31.1") {
  console.error("Compact compiler 0.31.1 is required. Run compact update 0.31.1.");
  process.exit(1);
}

function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "managed") return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sources(path) : entry.name.endsWith(".compact") ? [path] : [];
  });
}

const args = process.argv.slice(2);
const filterIndex = args.indexOf("--filter");
const filter = filterIndex < 0 ? undefined : args[filterIndex + 1];
if (filterIndex >= 0 && !filter) throw new Error("--filter requires a source name");
const files = sources("contracts").filter((file) => !filter || file.includes(filter)).sort();
if (!files.length) throw new Error("No Compact sources matched");
for (const file of files) {
  const name = relative("contracts", file);
  const target = join("contracts/managed", dirname(name), basename(name, ".compact"));
  console.log(`Compiling ${file} with Compact 0.31.1`);
  const flags = args.includes("--skip-zk") ? ["--skip-zk"] : [];
  const result = spawnSync(compact, ["compile", ...flags, "--sourceRoot", resolve("."), file, target], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
