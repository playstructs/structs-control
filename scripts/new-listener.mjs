#!/usr/bin/env node
/**
 * Scaffold a new GRASS listener.
 *
 * Usage:
 *   npm run new:listener -- ThingListener subject=structs.thing.* key=thing
 */
import { readFile, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const args = process.argv.slice(2);
if (!args[0]) {
  console.error("Usage: npm run new:listener -- <Name>Listener [subject=...] [key=...]");
  process.exit(1);
}
const Name = args[0];
const kv = Object.fromEntries(args.slice(1).map((a) => a.split("=")));
const subject = kv.subject ?? "structs.thing.*";
const key = kv.key ?? "thing";

const target = join(root, "src/js/grass_listeners", `${Name}.js`);
try {
  await access(target);
  console.error(`File exists: ${target}`);
  process.exit(1);
} catch {}

const tpl = await readFile(join(root, "scripts/_templates/listener.js.tpl"), "utf-8");
await writeFile(
  target,
  tpl
    .replaceAll("__NAME__", Name)
    .replaceAll("__SUBJECT__", subject)
    .replaceAll("__KEY__", key),
);
console.log(`Created ${target}`);
console.log(`Register it in src/js/index.js startGrass(): grass.registerListener(new ${Name}(store));`);
