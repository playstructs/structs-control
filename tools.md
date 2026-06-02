# tools.md -- structs-control

Tools, scripts, and external services agents can rely on while working in this repo.

## Local toolchain

| Tool | Version | Purpose |
| --- | --- | --- |
| Node | 20+ | Build, dev server, tests |
| npm | bundled with Node | Package management |
| Webpack | 5 | Bundling (see `webpack.config.js`) |
| TypeScript | 5.3 | `checkJs` against JSDoc, no emit |
| ESLint + Prettier | 8.57 / 3 | Style + convention enforcement (see `.eslintrc.cjs`) |
| Bootstrap | 5.3 + bootstrap-icons | UI primitives only |
| @cosmjs | 0.32 | Wallet, signing, Stargate |
| @nats-io/nats-core | 3.0 | NATS WS client (GRASS) |

## npm scripts

| Script | What |
| --- | --- |
| `npm run dev` | `webpack-dev-server` on `:8080` with `/api` proxy |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint + Prettier check |
| `npm run lint:fix` | Apply both autofixers |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run new:page NAME` | Scaffold a controller, route, sidebar pill |
| `npm run new:listener NAME` | Scaffold a GRASS listener |
| `npm run new:manager NAME` | Scaffold a domain Manager + Store keys |
| `npm run new:endpoint METHOD PATH` | Scaffold an API method + JSDoc shape |

## Environment + runtime config

Two layers, in order:

1. **Build-time** env vars (consumed by `webpack.DefinePlugin`):
   - `STRUCTS_GUILD_API_URL` -- base URL for the Guild API host (used by the dev proxy and as a fallback).
   - `STRUCTS_GUILD_API_HOST` -- value of the `Host:` header sent through the dev proxy (DNS workaround).
   - `STRUCTS_DEV_GALLERY=1` -- expose `/dev/components` and `/dev/tests`.

2. **Runtime** config (consumed at boot from `window.STRUCTS_CONFIG`):
   - `guildApiUrl`, `chainWsUrl`, `natsWsUrl`, `defaultGuildId`, `devGallery`.

   Edit `public/config.js` after deploy; no rebuild required. This is the recommended path for static-CDN deploys against a guild host.

## CORS expectations

Static-hosted SPA + cross-origin Guild API needs:
- `Access-Control-Allow-Origin: https://<spa-host>`
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Headers: Content-Type, Accept`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- Cookies must be `SameSite=None; Secure`.

Documented for guild operators in `docs/guild-api-requirements.md`.

## References (read-only)

`references/` is git-ignored and contains:
- `references/structs-webapp/` -- source patterns for framework + managers.
- `references/structs-ai/` -- Symfony API source. Verify endpoint shapes here when in doubt.

These are clones from GitHub at boot of the workspace; they are NOT shipped, NOT imported, and NOT modified.

## External services

| Service | Purpose | Where configured |
| --- | --- | --- |
| Guild API (Symfony) | All reads + auth | `public/config.js#guildApiUrl` |
| Stargate WS | Tx broadcasting | `public/config.js#chainWsUrl` or `/guild/this#client_websocket` |
| NATS WS | GRASS subscriptions | `public/config.js#natsWsUrl` or `/guild/this#grass_nats_websocket` |
| `https://structs.ai/llms.txt` | Source of truth for the chain RPC + streaming subject taxonomy | distilled into `docs/llms-summary.md` |
