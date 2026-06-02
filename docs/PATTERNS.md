# PATTERNS

Common tasks, recipes-first. Use the scaffolding scripts (`npm run new:*`) for the boilerplate; this doc explains what they create and why.

## Add a new page

1. `npm run new:page` -- prompts for a name (e.g. `Reactors`). The script:
   - creates `src/js/controllers/<Name>Controller.js` extending `AbstractController`
   - appends a row to `src/js/constants/Routes.js`
   - appends a pill to the matching sidebar item in `src/js/constants/Sidebar.js` (you choose which one)
   - registers a lazy controller in `src/js/index.js`
2. Implement `activate(page, params)` on the controller. Typical body:
   ```js
   async activate(_page, params) {
     void this.someManager.fetchSomething(params.id);
     this.layout.mountContent(new SomeViewModel({ store: this.store, id: params.id }));
   }
   ```
3. The view model:
   - subclasses `AbstractViewModel`
   - calls `this.subscribe(this.store, keys.something(id))` in `mount()`
   - returns HTML from `render()`
   - wires DOM listeners in `bind()`

## Add a new Guild API endpoint

1. Add a method on `src/js/api/GuildAPI.js`:
   ```js
   async getThing(id) {
     return await this.ajax.get(`/thing/${encodeURIComponent(id)}`);
   }
   ```
2. If the endpoint may legitimately 404 on some Guild deployments, register it as optional:
   ```js
   this.ajax.registerOptional("/thing");
   ```
3. Add a Manager method that wraps it in `store.query`:
   ```js
   fetchThing(id) {
     return this.store.query(keys.thing(id), () => this.guildAPI.getThing(id));
   }
   ```
4. Add a cache-key helper to `src/js/store/keys.js`:
   ```js
   thing: (id) => Object.freeze(["thing", String(id)]),
   ```
5. If GRASS emits events about it, add a resolver in `store/invalidationBridge.js`.
6. Document the contract in `src/js/types/api.js` as a JSDoc `@typedef`.
7. If you're discovering the endpoint doesn't exist yet, append a row to `docs/guild-api-requirements.md` so the API team can pick it up.

## Add a chain transaction

1. Add the message type URL to `src/js/constants/MessageTypes.js`:
   ```js
   THING_DO_X: "/structs.structs.MsgThingDoX",
   ```
2. Build a message factory in the relevant Manager:
   ```js
   buildDoX(thingId, value) {
     return {
       typeUrl: MSG_TYPES.THING_DO_X,
       value: { creator: "", thing_id: thingId, value },
     };
   }
   ```
3. From the view model handler:
   ```js
   await this.store.tx.enqueue(this.manager.buildDoX(id, v), {
     invalidate: [keys.thing(id)],
     optimisticPatch: (store) => {
       const prev = store.read(keys.thing(id));
       store.write(keys.thing(id), { ...prev, data: { ...prev.data, value: v }, stale: true });
       return () => store.write(keys.thing(id), prev);
     },
   });
   ```

## Add a GRASS listener

1. `npm run new:listener` -- generates `src/js/grass_listeners/<Name>Listener.js`.
2. Most listeners only need `handler(data) { this.store.invalidate(keys.thing(data.id)); }`.
3. Wire it into `src/js/index.js#startGrass()`.
4. If the subject pattern is generic enough, add it to `store/invalidationBridge.js#_defaultMappings()` instead so it works without a class.

## Add a domain Manager

1. `npm run new:manager`.
2. Stamp out `fetchX`/`fetchY` methods over `store.query`.
3. Keep Managers thin: the API client owns network; the Store owns cache; the Manager owns key naming + invalidation.

## Working with the DataTable

```js
const table = new DataTable({
  id: "thing-table",
  columns: [
    { id: "id", label: "ID", get: (r) => r.id, sort: (a, b) => a.id.localeCompare(b.id) },
    { id: "name", label: "Name", get: (r) => r.name ?? "—" },
  ],
  rows: list,
  onRowClick: (r) => `/things/${r.id}`,
  sort: params.sort,
  q: params.q,
  page: Number(params.page) || 1,
});

// render
container.innerHTML = table.renderHTML();

// bind (URL-sync)
const root = container.querySelector("#thing-table");
// (see PlayersController.js for the bindDataTable helper)
```

URL params (`?sort=name:asc&q=alice&page=2`) round-trip via the router: clicking a header rewrites the URL, the router re-activates the controller with the new params, the view model re-renders with the updated DataTable props.

## Forms + validation

```js
import { validateForm, required, maxLength, readFormValues } from "../util/validate.js";
import { notify } from "../store/notify.js";

const values = readFormValues(form);
const { valid, errors } = validateForm(
  { name: [required(), maxLength(64)] },
  values,
);
if (!valid) {
  notify.formError(form.id, errors); // sets .is-invalid + .invalid-feedback
  return;
}
```

`notify.toast` for success messages, `notify.banner` for persistent warnings, `notify.fromError(err)` to surface a `GuildAPIError` as a toast.

## Graceful degradation

If `getThing` returns 404 and the endpoint is registered with `ajax.registerOptional`, the Resource becomes `{ status: "missing" }`. Use `ResourceView.render`:

```js
${ResourceView.render(resource, {
  success: (data) => `<div>${data.name}</div>`,
  // optional overrides:
  missing: () => `<div class="sg-empty">This API doesn't expose Thing yet.</div>`,
})}
```

Default `missing` and `error` rendering is built into ResourceView; only override when you need different copy.

## Don'ts

- Don't call `fetch()` outside `src/js/api/`. ESLint will flag it.
- Don't put API data in a view-model field; always read via `store.read` or subscribe.
- Don't `localStorage.setItem("mnemonic", ...)`. Use `store.session.persist()`.
- Don't import from `references/`.
- Don't add a sidebar item. Five items, fixed.
- Don't say "faction" in code, props, copy, or URLs. Say "guild".
