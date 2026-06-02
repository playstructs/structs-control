#!/usr/bin/env node
/**
 * Scaffold a new page. Creates:
 *   - src/js/controllers/<Name>Controller.js
 *   - appends a route to src/js/constants/Routes.js
 *   - appends a lazy registration to src/js/index.js
 *
 * Usage:
 *   npm run new:page -- ThingProfile path=/things/:id sidebar=guild pill=/things
 */
import { readFile, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const args = process.argv.slice(2);
if (!args[0]) {
  console.error("Usage: npm run new:page -- <Name> [path=...] [sidebar=...] [pill=...]");
  process.exit(1);
}
const Name = args[0];
const kv = Object.fromEntries(args.slice(1).map((a) => a.split("=")));
const path = kv.path || `/${Name.toLowerCase()}`;
const sidebar = kv.sidebar || "guild";
const pill = kv.pill || path;

const controllerPath = join(root, "src/js/controllers", `${Name}Controller.js`);
await ensureDoesNotExist(controllerPath);

const tpl = await readFile(join(root, "scripts/_templates/controller.js.tpl"), "utf-8");
const out = tpl
  .replaceAll("__NAME__", Name)
  .replaceAll("__name__", Name.toLowerCase());

await writeFile(controllerPath, out);
console.log(`Created ${controllerPath}`);

await appendRoute(path, Name, sidebar, pill);
await registerLazy(Name);

console.log(`Done. Next:`);
console.log(`  1. Implement render() in src/js/controllers/${Name}Controller.js`);
console.log(`  2. (Optional) add a pill in src/js/constants/Sidebar.js`);

async function ensureDoesNotExist(p) {
  try {
    await access(p);
    console.error(`File exists: ${p}`);
    process.exit(1);
  } catch {
    // ok
  }
}

async function appendRoute(path, name, sidebar, pill) {
  const file = join(root, "src/js/constants/Routes.js");
  let text = await readFile(file, "utf-8");
  const row = `  { path: "${path}", controller: "${name}", page: "index", sidebar: "${sidebar}", pill: "${pill}", loginRequired: true },`;
  text = text.replace(/(\];\s*)$/m, `${row}\n$1`);
  await writeFile(file, text);
}

async function registerLazy(name) {
  const file = join(root, "src/js/index.js");
  let text = await readFile(file, "utf-8");
  const stub = `  router.registerLazyController("${name}", () =>
    import("./controllers/${name}Controller.js").then((m) => new m.${name}Controller({ store, layout })),
  );`;
  text = text.replace(/(if \(config\.devGallery === "1"\))/, `${stub}\n\n  $1`);
  await writeFile(file, text);
}
