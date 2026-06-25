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
| `structs:block:height-changed` | `{ height }` | `BlockListener` | `TxQueue` (paces broadcasts: one tx per block) |
| `structs:tx:enqueued` | `{ id, status, typeUrl, hash, height, error }` | `TxQueue.enqueue` | open (UIs may listen instead of subscribing) |
| `structs:tx:broadcast` | `{ id, status, typeUrl, hash, height, error }` | `TxQueue` (on signing) | open |
| `structs:tx:confirmed` | `{ id, status, typeUrl, hash, height, error }` | `TxQueue` (terminal success) + `TxListener` (GRASS) | `TxQueue` (GRASS confirm hook), open |
| `structs:tx:failed` | `{ id, status, typeUrl, hash, height, error }` | `TxQueue` (terminal failure/cancel) | open |

`TxQueue` now drives broadcast pacing off `structs:block:height-changed` (one tx per block, with a timer fallback when GRASS is offline). Confirmation uses `hybridConfirmStrategy`: it waits briefly for a GRASS `structs.tx.*` message (surfaced to `TxQueue` via `notifyGrassTxConfirmed` in `confirmStrategy.js`, which also dispatches `structs:tx:confirmed`), then falls back to Stargate `getTx` polling.

The `structs:tx:*` lifecycle events carry the same `detail` shape (`{ id, status, typeUrl, hash, height, error }`). They are an alternative to `store.tx.subscribe()` for event-driven consumers; most UI should prefer `subscribe()`. See `docs/TRANSACTIONS.md`.

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
