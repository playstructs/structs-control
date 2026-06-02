# EVENTS

Catalog of every `CustomEvent` the app dispatches on `window`, who fires it, and who listens.

Canonical names live in `src/js/constants/Events.js`. Always reference them via that import -- don't string-literal anywhere else.

## Auth

| Event | Payload | Fired by | Listeners |
| --- | --- | --- | --- |
| `structs:auth:login` | `{ playerId, address }` | `AuthManager.login` | `HeaderViewModel` (refresh address), any future analytics |
| `structs:auth:logout` | — | `AuthManager.logout` | `LayoutViewModel` (unmount), `GrassManager` (stop) |
| `structs:auth:failed` | `{ reason }` | reserved | — |

## Chain

| Event | Payload | Fired by | Listeners |
| --- | --- | --- | --- |
| `structs:block:height-changed` | `{ height }` | `BlockListener` | `TxQueue` (future: retry-on-block) |
| `structs:tx:enqueued` | `{ txId, typeUrl }` | reserved | — |
| `structs:tx:broadcast` | `{ txId, hash }` | reserved | — |
| `structs:tx:confirmed` | `{ hash, height, code }` | `TxListener` | `TxQueue` (future) |
| `structs:tx:failed` | `{ txId, error }` | reserved | — |

`TxQueue` currently doesn't depend on `structs:tx:*` -- it uses `pollingConfirmStrategy`. The events are the seed for replacing the poll-based strategy once the Guild API has a stable tx endpoint or GRASS surface.

## Navigation

| Event | Payload | Fired by | Listeners |
| --- | --- | --- | --- |
| `structs:route:changed` | reserved -- router uses its own `onChange` callback today | — | — |
| `structs:sidebar:toggled` | `{ expanded: boolean }` | `SidebarViewModel` toggle button | `LayoutViewModel` (swap `data-sidebar` attr -> CSS swaps grid widths) |

## Conventions

- Every event name lives in `EVENTS` in `src/js/constants/Events.js`.
- Payloads MUST be plain serializable objects.
- Don't dispatch events between view models in the same controller -- use a direct method call. Events are for cross-cutting concerns (auth, chain, sidebar shell).
- Listeners attached in a view model `mount()` MUST be removed in `unmount()` (`AbstractViewModel._unsubs` is the canonical place to register cleanup).
