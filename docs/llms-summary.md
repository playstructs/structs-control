# llms-summary

A distilled, opinionated subset of `https://structs.ai/llms.txt`, focused on what the admin SPA cares about. The full text is the source of truth; this file is for quick lookup.

> Refetch with `curl https://structs.ai/llms.txt` whenever something in the surface changes.

## Auth

- Cookie-based session, set by `POST /api/auth/login` on a per-guild Symfony deployment.
- All authenticated requests need `credentials: "include"`.
- Login message format:
  ```
  LOGIN_GUILD{guildId}ADDRESS{address}DATETIME{unix_timestamp}
  ```
  SHA256-then-secp256k1, hex-encoded, fixed-length signature.
- Guild IDs use the `0-{n}` form (e.g. `0-1`, `0-2`).

## Catalog reads (May 2026)

Paginated list endpoints follow:

```
GET /api/{entity}/.../page/{page}
```

Responses use the Symfony envelope with `data` as a **flat row array** (page size 100). The SPA normalizes this in `src/js/api/catalogPage.js`. Symfony source: `references/structs-webapp/src/src/Controller/CatalogReadController.php`. See `docs/guild-api-requirements.md`.

## v0.16 UGC + transactions

- `PUT /api/player/username` **removed**. Use on-chain `MsgPlayerUpdateName` and `MsgPlayerUpdatePfp`.
- Pure `structs` module txs (guild settings, bank, UGC, membership) can use **empty fee.amount** (free-gas path). Still set `--gas auto` / explicit gas limit.
- New permission bit 24: `PermGuildUGCUpdate` for guild-moderated name/pfp updates.

## Streaming subjects (GRASS)

NATS over WebSocket. Subjects are dotted; common prefixes:

| Prefix | What |
| --- | --- |
| `structs.block.*` | block height + commits |
| `structs.tx.*` | tx broadcast / confirmation |
| `structs.player.*` | player created / updated / kicked / etc. |
| `structs.guild.*` | guild settings updated; membership applications |
| `structs.substation.*` | substation created / updated / migrated |
| `structs.allocation.*` | allocations created / changed |
| `structs.reactor.*` | reactor state changes |

Subscribe to a wildcard (`structs.>`) and let `InvalidationBridge` route. `TxListener` feeds `hybridConfirmStrategy` for faster tx confirmation.

## Cosmos chain

- Bech32 prefix: `structs`
- Default WS RPC: derived from `GET /guild/this` → `data.client_websocket`
- Sign with `SigningStargateClient.signAndBroadcast(address, [msg], fee, memo)`
- Custom message registry: `src/js/ts/structs.structs/registry.js` (copied from structs-webapp)
- Message builders: `src/js/util/txMessages.js` using protobuf `fromPartial`

## Permissions

Two layers:

1. **Address permissions** -- bitmask on `player_address` rows
2. **Guild rank** -- numeric; lower number = higher rank (`0` = owner)

Admin actions assume the signed-in user is the guild owner or has equivalent rank.

## Chain endpoints we care about

- `/structs.structs.MsgGuildUpdate*` -- guild settings
- `/structs.structs.MsgGuildBank*` -- mint, redeem, confiscate-and-burn
- `/structs.structs.MsgGuildMembership*` -- invite/request approve/deny, kick
- `/structs.structs.MsgPlayerUpdate*` -- update player name/pfp/guild rank
- `/structs.structs.MsgSubstation*` -- connect/migrate/disconnect
- `/structs.structs.MsgAllocation*` -- create/update/transfer/delete
- `/structs.structs.MsgReactorInfuse / Defuse / BeginMigration`

Enumerated in `src/js/constants/MessageTypes.js`. Proto shapes in `src/js/util/txMessages.js`.

## Admin pages added for catalog API

| Page | Read path |
| --- | --- |
| Applications | `/guild-membership-application/guild/{guildId}/page/{n}` |
| Energy agreements | `/provider/all/page/{n}`, `/agreement/all/page/{n}` |
| Dashboards metrics | `/stat/{metric}/object/{guildId}/range/page/{n}` |
