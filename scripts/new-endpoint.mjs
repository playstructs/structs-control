#!/usr/bin/env node
/**
 * Print a recipe for adding a new endpoint. We don't auto-rewrite GuildAPI.js
 * (too many call sites + ordering) -- we tell you exactly what to do.
 *
 * Usage:
 *   npm run new:endpoint -- GET /thing/:id
 */
const method = (process.argv[2] || "GET").toUpperCase();
const path = process.argv[3] || "/thing/:id";

console.log(`Add ${method} ${path}:

  1. src/js/api/GuildAPI.js -- add a method:
     async getThing(id) {
       return await this.ajax.${method.toLowerCase()}(\`${path.replace(":id", "${encodeURIComponent(id)}")}\`);
     }

  2. (optional) register as optional if it may 404 on some deployments:
     this.ajax.registerOptional("${path.replace(/:[^/]+/g, "")}");

  3. src/js/store/keys.js -- add a cache key:
     thing: (id) => Object.freeze(["thing", String(id)]),

  4. Pick or create a Manager (e.g. src/js/managers/ThingManager.js):
     fetchThing(id) {
       return this.store.query(keys.thing(id), () => this.guildAPI.getThing(id));
     }

  5. src/js/types/api.js -- add a JSDoc @typedef for the response shape.

  6. docs/guild-api-requirements.md -- add the endpoint to the "in use" table.
`);
