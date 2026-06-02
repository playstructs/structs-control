#!/usr/bin/env node
/**
 * Scaffold a new domain Manager. Stamps out fetch helpers around store.query.
 *
 * Usage:
 *   npm run new:manager -- ThingManager key=thing
 */
import { readFile, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const args = process.argv.slice(2);
if (!args[0]) {
  console.error("Usage: npm run new:manager -- <Name>Manager [key=...]");
  process.exit(1);
}
const Name = args[0];
const kv = Object.fromEntries(args.slice(1).map((a) => a.split("=")));
const key = kv.key ?? Name.replace(/Manager$/, "").toLowerCase();

const target = join(root, "src/js/managers", `${Name}.js`);
try {
  await access(target);
  console.error(`File exists: ${target}`);
  process.exit(1);
} catch {}

const tpl = await readFile(join(root, "scripts/_templates/manager.js.tpl"), "utf-8");
await writeFile(target, tpl.replaceAll("__NAME__", Name).replaceAll("__KEY__", key));
console.log(`Created ${target}`);
console.log(`Now: add the underlying GuildAPI method, then wire up to a controller.`);
