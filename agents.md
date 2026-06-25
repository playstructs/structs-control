# agents.md -- structs-control

Read this first. It points at the workflow conventions every coding agent (human or AI) should follow when touching this repo.

## What this project is

`structs-control` is a **headless admin SPA** for the Structs game. Operators log in with a Cosmos mnemonic, the SPA hits a per-Guild Symfony PHP API for reads, signs Stargate transactions for writes, and listens to NATS/GRASS for real-time updates.

There is **no React**, **no Vite**, **no Tailwind**. It is vanilla JavaScript with light TypeScript (`.ts` for protobufs only, JSDoc + `checkJs` everywhere else), bundled with **Webpack 5**, styled with **Bootstrap 5 + SCSS**.

## References directory (`references/`)

When asked to **set up the workspace**, clone the following read-only reference repos into `references/` (git-ignored):

```bash
git clone --depth 1 https://github.com/playstructs/structs-ai.git references/structs-ai
git clone --depth 1 https://github.com/playstructs/structs-webapp.git references/structs-webapp
```

| Clone path | Upstream | What it is for |
|------------|----------|----------------|
| `references/structs-ai` | [playstructs/structs-ai](https://github.com/playstructs/structs-ai) | All information about Structs the game and related infrastructure. |
| `references/structs-webapp` | [playstructs/structs-webapp](https://github.com/playstructs/structs-webapp) | The game interface used by players. Also home to important code that can be pulled out for the transaction-signing system, hashing systems, etc. Includes the Symfony backend API — good to reference for endpoint shapes and auth flows. |

**Never edit files under `references/` directly.** Treat them as read-only documentation: search, read, and copy patterns into `src/` when needed. Do not import from `references/` in application code.

**Before starting a new task**, run `git pull` in each reference clone so you are working against the latest upstream code:

```bash
git -C references/structs-ai pull
git -C references/structs-webapp pull
```

## How the pieces fit

```
  ┌──────────────┐    fetch     ┌────────────┐
  │  Controllers │─────────────►│  Managers  │
  │ (per page)   │              │ (per       │
  │              │              │  domain)   │
  └──────┬───────┘              └─────┬──────┘
         │ mountContent()             │ store.query(...)
         ▼                            ▼
   ┌──────────┐                ┌──────────────┐
   │ View     │◄───subscribe───│    Store     │
   │ models   │                │  (Resource   │
   └──────────┘                │   envelopes) │
                               └──────┬───────┘
                                      │ store.tx.enqueue()
                                      ▼
                               ┌──────────────┐
                               │   TxQueue    │
                               │ (cosmjs)     │
                               └──────────────┘
```

GRASS messages enter via `InvalidationBridge` and mark cache keys stale, which causes any subscribed view model to refetch automatically.

## Always

- Hit the Guild API via `src/js/api/GuildAPI.js`. **Never** `fetch()` from a view model or controller.
- Read data with `store.query(...)` (via a Manager). **Never** stash API responses in a view-model field.
- Mutate chain state with `store.tx.enqueue(...)`. **Never** call `signingClient.signAndBroadcast` directly.
- Persist the mnemonic in `sessionStorage` via `store.session`. **Never** in `localStorage`.
- Authenticate with `credentials: "include"`. **Never** a JWT / bearer / API key.
- Use the `@/` alias for `src/js/*`. **Never** `../../../foo`.
- Import from `references/` is forbidden -- it's read-only documentation. Copy what you need into `src/`.
- The Figma file uses "Faction"; in code, always say **Guild**.
- The sidebar is fixed at five items (Guild / Bank / Energy Market / Dashboards / Settings). Don't add or reorder without an explicit design change.
- 404 on the Guild API means render an empty state (`Resource{status:"missing"}`). Don't throw, don't crash.
- whenever you have the option to implement a portion of something or implement fully always implement fully

## File layout

```
src/js/
  api/            GuildAPI client (and only place that builds fetch calls)
  constants/      Routes, Sidebar, Events, MessageTypes
  controllers/    One per page; thin orchestrator over Managers + view models
  errors/         GuildAPIError, GrassError, NotImplementedError
  framework/      Abstracts (Controller, ViewModel, Listener, Router, ...)
  grass_listeners/  Subscribers that invalidate Store keys on NATS messages
  managers/       WalletManager, AuthManager, SigningClientManager, domain managers
  store/          Store, QueryClient, TxQueue, Session, notify, validator
  types/          JSDoc typedefs for API contracts
  util/           validate.js (forms)
  view_models/    LayoutViewModel, HeaderViewModel, SidebarViewModel, page VMs
  view_models/components/  DataTable, ResourceView, StatCard, FloatingLabelField
  ts/             Generated protobuf code (copy from references/structs-webapp)

references/       Read-only clones of structs-ai + structs-webapp (see above)
```

## Adding things (links into PATTERNS.md)

- **A new page**: `npm run new:page` → adds a controller stub + route + sidebar pill.
- **A new Guild API endpoint**: edit `api/GuildAPI.js`, add a Manager method, document in `docs/guild-api-requirements.md`.
- **A new GRASS listener**: `npm run new:listener` → subclass of `AbstractGrassListener` + wire into `invalidationBridge` if it's about cache, or do explicit `store.write` otherwise.
- **A new domain manager**: `npm run new:manager`.
- **Anything that writes to chain state**: read `docs/TRANSACTIONS.md` first — the full guide to issuing, monitoring, reviewing, and acting on transactions via the `store.tx` queue.

Full recipes in `docs/PATTERNS.md`. Architecture in `docs/ARCHITECTURE.md`. Event catalog in `docs/EVENTS.md`. Transaction system in `docs/TRANSACTIONS.md`.

## Run / build / test

```bash
npm install
STRUCTS_GUILD_API_URL=https://guild.example.com npm run dev   # localhost:8081
npm run build                                                 # production to dist/
npm run lint                                                  # eslint + prettier
npm run typecheck                                             # tsc on JSDoc

# Docker (see docker-structs-guild for compose wiring):
docker build -t structs/structs-control:latest .

# In the running app:
#   /dev/components       -- visual gallery (requires STRUCTS_DEV_GALLERY=1)
#   /dev/tests            -- in-browser test runner
```

For runtime config without rebuilds, edit `public/config.js` and reload.

## Docker

Single [`Dockerfile`](Dockerfile) published as `structs/structs-control`. Runtime mode is selected with **`STRUCTS_CONTROL_MODE`**:

| Mode | Env | Listens | Use case |
| --- | --- | --- | --- |
| `prod` (default) | `STRUCTS_CONTROL_MODE=prod` | `:80` | Static nginx serving baked `dist/` |
| `dev` | `STRUCTS_CONTROL_MODE=dev` | `:8081` | webpack-dev-server + HMR (bind-mount source) |

```bash
docker build -t structs/structs-control:latest .

# Prod (default)
docker run -p 8080:80 structs/structs-control:latest

# Dev with live source
docker run -p 8081:8081 -v "$(pwd):/app" -v /app/node_modules \
  -e STRUCTS_CONTROL_MODE=dev \
  -e STRUCTS_DEV_PROXY_TARGET=http://host.docker.internal:8080 \
  -e CHOKIDAR_USEPOLLING=true \
  structs/structs-control:latest
```

**Dev with bind mount** (wired in [docker-structs-guild](https://github.com/playstructs/docker-structs-guild)):

- `STRUCTS_CONTROL_MODE=dev`
- Mount repo root → `/app`, plus anonymous volume on `/app/node_modules`
- `STRUCTS_DEV_PROXY_TARGET=http://structs-webapp:80` — forwards `/api` to the Symfony Guild API
- `CHOKIDAR_USEPOLLING=true` — file watching on Docker Desktop (macOS)

**Prod** — map host port to container `:80`; set `guildApiUrl` in `public/config.js` (copied to `dist/` at build time).

## Design system (Figma)

Visual source of truth: **[Factions Admin Design System](https://www.figma.com/design/ruigfX3qz9rGGALfbpdUXR/Factions-Admin-Design-System?node-id=571-9200)** (`fileKey: ruigfX3qz9rGGALfbpdUXR`).

| Page / frame | Node ID | Notes |
|--------------|---------|-------|
| Components (inputs, buttons, cards, modals, tables) | `571:9200` | Use child node IDs for MCP `get_design_context` |
| Icons (Bootstrap set) | `15:19548` | Matches `bi-*` classes in code |
| Navigation (header, sidebar, breadcrumbs, pills) | `661:11652` | Sidebar: 72px collapsed / 256px expanded |
| Tables | `571:21113` | Toolbar, status dots, pagination |
| Guild bank / Mint-Redeem screen | `2234:22100` | Reference for Bank section layout |

**Naming:** Figma says "Faction"; code and copy always say **Guild**.

**Tokens:** Bootstrap overrides live in `src/styles/_tokens.scss`; app-shell tokens in `_custom-vars.scss` (`--sg-*`). Match Figma variables (`--surface/subtle-blue`, `--button/space-blue`, etc.) to those files — do not inline hex in view models.

**MCP tip:** Page-level nodes often fail; pass a specific child `node-id` (e.g. `661:11655` for the header bar).

## When in doubt

Search `references/structs-webapp/` and `references/structs-ai/` for prior art. Copy patterns; adapt to the Store/QueryClient/TxQueue contracts above. If the prior art doesn't fit (e.g. game-state-heavy AuthManager), simplify.
