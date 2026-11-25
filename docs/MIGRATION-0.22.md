# Migrating structs-control for structsd v0.22 / v0.23

Admin SPA adoption notes for the [client migration guide](https://structs.ai/develop/client/migration.html), structsd **v0.22.0** (Vortexia) and **v0.23.0** (Whirlend). This project is a **browser using a shared Guild API** — not a gameplay client, indexer, or TSA key host.

Pinned review identities (from the migration page; verify against your deployment):

| Component | Identity |
| --- | --- |
| Reference webapp | `0.22.0-migration` / current `main` |
| structsd | v0.22.0 `96cea3a` → v0.23.0 `f6dc004` |
| structs-pg | `400e1c1` (paired with 0.22) |

## Adopted in this repo

| Contract | Status |
| --- | --- |
| Protobuf codecs from webapp (`src/js/ts/structs.structs/`) | Synced; includes vaults / exact uint64 strings |
| Exact integers (`ExactInteger.js`, `MessagePayload.js`) | Wired through `txMessages.js` builders |
| `POST /auth/logout` | Replaces GET |
| Envelope `meta` | `JsonAjaxer.lastMeta` + `{ envelope: true }`; `GET /block` snapshot |
| Tx readiness gate | `TxQueue` blocks broadcast when `meta.transaction_ready === false` |
| 401/403 session recovery | `GuildAPI.setReauthenticator` → `AuthManager.reauthenticate` (single-flight) |
| `MsgVaultSend` builder | Available for vault transfers |
| Bank mint/redeem/confiscate | Exact uint64 + optional `guildId` |
| Substation connection capacity maximum (v0.23) | Hand codec + Substation detail UI + Energy Grid column + grid attr |
| Player funds fields | Typed + shown on player profile (spendable / available / retained / vault) |
| Player total capacity | `capacity + connection_capacity` for overload % |
| Grid index values | Exact decimal strings (no silent `Number()` for uint64) |
| Substation operating loss | Documented: usable capacity `floor(incoming × 9/10)` |

## Out of scope (player / worker / TSA clients)

Do **not** port these into the admin SPA unless a design requests them:

- Gameplay workers, task recovery, Sector Blitz, tutorial `SimulatedTaskManager`
- Full durable signing journal / Web Locks multi-tab contract (admin `TxQueue` remains the admin path; upgrade later if operators need uncertain-send recovery)
- Device registration / activation-code flows beyond what auth already does
- Retained-funds shortfall collection (`MsgPlayerSend` prefix groups) for player HUD transfers
- Planet `sector` display (no planet admin surfaces yet)
- Native LCD snapshot clients / `STRUCTS_LCD_URL` (Guild API host concern)
- Bearer `POST /auth/token` (cross-origin / native clients only)

## Remaining gaps / follow-ups

1. **Proto regen for v0.23** — `MsgSubstationUpdateConnectionCapacityMaximum` is hand-maintained until webapp regenerates against structsd v0.23. Re-run webapp `proto:sync` and re-copy when available; drop the hand file after registry includes the generated type.
2. **Signing recovery** — Adopt webapp `SigningSubmission` / journal patterns if operators need reload-safe uncertain sends.
3. **Cache keys** — Include chain/protocol/contract identity when multi-network deploys share one SPA build.
4. **Guild rank purchase** — New guild fields / msgs exist on chain; no admin UI yet.

## Source map

| Area | This repo | Upstream |
| --- | --- | --- |
| Codecs | `src/js/ts/structs.structs/` | `references/structs-webapp/src/js/ts/structs.structs/` |
| Exact values | `src/js/util/ExactInteger.js`, `MessagePayload.js` | same under webapp `src/js/util/` |
| Tx builders | `src/js/util/txMessages.js` | webapp `SigningClientManager` + prep modules |
| Auth | `src/js/api/GuildAPI.js`, `AuthManager.js` | webapp `GuildAPI.logout` POST + `setReauthenticator` |
| Readiness | `JsonAjaxer.js`, `protocolReadiness.js`, `TxQueue` | webapp `getBlockSnapshot` + envelope meta |
| Grid / substations | `unitDisplay.js`, `SubstationDetailController.js` | structsd v0.23 release notes |
