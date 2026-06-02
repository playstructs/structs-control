# Guild API requirements

Gaps in the Guild API surface that the admin SPA needs filled. Owned by the Guild API team; this file is updated by the SPA when an endpoint is discovered to be missing or under-specified.

## CORS

Required headers from the Guild API for the SPA to function across origins:

- `Access-Control-Allow-Origin: <SPA host>`
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Headers: Content-Type, Accept`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- Preflight (`OPTIONS`) must succeed with 2xx.
- Auth cookie must be set with `SameSite=None; Secure`.

## Envelope

Every response (success or failure) must use:

```json
{ "success": true, "errors": [], "data": { ... } }
```

The SPA validates the envelope shape at the JsonAjaxer boundary; missing `success` is a hard error.

Catalog reads return paginated data inside `data` as a **flat array** (Symfony `TableReadManager::queryAll`, page size **100**):

```json
{ "success": true, "errors": {}, "data": [ { ...row }, ... ] }
```

`errors` is typically a keyed object (e.g. `{ "authentication_error": "Login required" }`), not a string array.

**Source of truth:** Symfony routes in `references/structs-webapp/src/src/Controller/` (`CatalogReadController.php`, bespoke controllers). Legacy paths like `/reactor/list`, `/substation`, `/allocation` without `/page/` were never implemented in PHP.

## Local API matrix (localhost:8080, probed 2026-06-01)

Guild ID used for probes: `0-1`. Unauthenticated probes; catalog routes that exist return **401** (login required). Legacy bespoke routes return **404**.

| Entity | Legacy path | Legacy status | Catalog path | Catalog status | SPA strategy |
| --- | --- | --- | --- | --- | --- |
| Reactors | `GET /reactor/list` | 404 | `GET /reactor/guild/{guildId}/page/1` | 401 | Catalog only (Symfony) |
| Reactors (network) | `GET /reactor/network` | 404 | `GET /reactor/all/page/1` | 401 | Catalog only |
| Substations | `GET /substation` | 404 | `GET /substation/all/page/1` | 401 | Catalog only |
| Allocations | `GET /allocation` | 404 | `GET /allocation/all/page/1` | 401 | Catalog only |
| Infusion by reactor | `GET /infusion/reactor/{id}` | 404 | `GET /infusion/list/destination/{id}/page/1` | 401 | Catalog list (one row per player) |
| Substation players | `GET /substation/{id}/players` | (not probed) | `GET /player/list/substation/{id}/page/1` | 401 | Catalog first, legacy fallback |
| Guild power stats | — | — | `GET /guild/{id}/power/stats` | 401 | Catalog only |
| Settings | — | — | `GET /setting` | **200** | Direct |
| Membership apps | — | — | `GET /guild-membership-application/guild/{id}/page/1` | 401 | Catalog |
| Providers | — | — | `GET /provider/all/page/1` | 401 | Catalog |
| Agreements | — | — | `GET /agreement/all/page/1` | 401 | Catalog |
| Stats | — | — | `GET /stat/{metric}/object/{key}/range/page/1` | 401 | Catalog |

## Endpoints in use

| Method | Path | Used by | Notes |
| --- | --- | --- | --- |
| `GET` | `/timestamp` | AuthManager | returns `{ unix_timestamp }` |
| `POST` | `/auth/login` | AuthManager | sets session cookie |
| `GET` | `/auth/logout` | AuthManager | clears session cookie |
| `GET` | `/auth/player-address/{address}/guild/{guildId}/player-id` | AuthManager | returns `{ player_id }` |
| `GET` | `/guild/this` | OverviewController, Infrastructure | the "default" guild for the API host |
| `GET` | `/guild/{guildId}` | OverviewController, GuildDetails | full guild record |
| `GET` | `/guild/{guildId}/roster` | PlayersController | list of player records |
| `GET` | `/guild/{guildId}/members/count` | Overview | `{ count }` |
| `GET` | `/guild/{guildId}/power/stats` | Overview | guild power summary |
| `GET` | `/player/{playerId}` | PlayerProfile | one player |
| `GET` | `/player-address/player/{playerId}` | PlayerProfile | addresses on file |
| `GET` | `/infusion/player/{playerId}` | PlayerProfile | one infusion record |
| `GET` | `/infusion/list/destination/{reactorId}/page/{n}` | ReactorProfile | all player infusions at reactor |
| `GET` | `/substation/all/page/{n}` | Substations list | catalog only |
| `GET` | `/substation/{id}` | SubstationDetail | find row in catalog list (no bespoke GET) |
| `GET` | `/player/list/substation/{id}/page/{n}` | SubstationDetail | connected players |
| `GET` | `/allocation/all/page/{n}` | EnergyGrid | catalog; legacy `/allocation` fallback |
| `GET` | `/allocation/source/{sourceId}/page/{n}` | SubstationDetail | per source |
| `GET` | `/reactor/guild/{guildId}/page/{n}` | Reactors | catalog; legacy `/reactor/list` fallback |
| `GET` | `/reactor/all/page/{n}` | Reactors | network list |
| `GET` | `/reactor/{id}` | ReactorProfile | single reactor (optional) |
| `GET` | `/guild-membership-application/guild/{guildId}/page/{n}` | Applications | pending membership queue |
| `GET` | `/provider/substation/{substationId}/page/{n}` | Agreements page | providers on entry substation |
| `GET` | `/agreement/provider/{providerId}/page/{n}` | Agreements page | agreements per provider |
| `GET` | `/stat/{metric}/object/{key}/range/page/{n}` | Dashboards | time-series metrics |
| `GET` | `/setting` | Infrastructure | live tunables |

### Removed (v0.16)

| Method | Path | Replacement |
| --- | --- | --- |
| `PUT` | `/player/username` | On-chain `MsgPlayerUpdateName` / `MsgPlayerUpdatePfp` via `store.tx.enqueue` |

Player name and avatar updates are chain transactions only. The SPA no longer calls the removed HTTP endpoint.

## Endpoints we'd like

### Guild bank balances

The Mint / Redeem page can submit transactions but cannot read current balances. We'd like:

- `GET /guild/{guildId}/bank/balance` -- `{ balances: [{ denom, amount }] }`

### Tx confirmation

`TxQueue` uses hybrid GRASS + Stargate polling. A dedicated read surface would still help:

- Either a GRASS subject `structs.tx.confirmed` with `{ hash, code, height }`
- Or `GET /tx/{hash}` returning `{ confirmed, code, height }`

## CORS specifically for `/auth/login`

The login endpoint must return `Set-Cookie` with:

- `SameSite=None; Secure; HttpOnly`
- `Domain=` either omitted (host-only) or set to the API host
- The `Access-Control-Allow-Origin` header MUST echo the SPA origin exactly; wildcards are incompatible with credentialed requests.
