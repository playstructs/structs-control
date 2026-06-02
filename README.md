# structs-control

The headless admin SPA for Structs guild operators. It's a vanilla JavaScript project bundled with Webpack 5, styled with Bootstrap 5 and SCSS, and wired to a per-guild Symfony API for reads and @cosmjs for on-chain writes. Operators log in with a Cosmos mnemonic, the SPA hits the Guild API over cookie-based auth, signs Stargate transactions for mutations, and listens to NATS/GRASS for real-time cache invalidation. There is no React, no Vite, and no Tailwind.

## Structs
In the distant future the species of the galaxy are embroiled in a race for Alpha Matter, the rare and dangerous substance that fuels galactic civilization. Players take command of Structs, a race of sentient machines, and must forge alliances, conquer enemies and expand their influence to control Alpha Matter and the fate of the galaxy.

## Setup

### 1. Clone the repository

`git clone https://github.com/playstructs/structs-control.git`

### 2. Install dependencies

`npm install`

### 3. Clone reference repositories

These read-only clones are used to grep prior art during development. They are gitignored under `references/`.

`git clone --depth 1 https://github.com/playstructs/structs-webapp.git references/structs-webapp`

`git clone --depth 1 https://github.com/playstructs/structs-ai.git references/structs-ai`

### 4. Run the dev server

Point the webpack dev proxy at a guild host:

`STRUCTS_GUILD_API_URL=https://your-guild-host.example.com npm run dev`


## Connecting to the app

### 1. Web Browser

`http://localhost:8081/`


## Learn more

- [`agents.md`](./agents.md) — start here; required reading before contributing
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — how Store, Managers, TxQueue, and GRASS fit together
- [`docs/PATTERNS.md`](./docs/PATTERNS.md) — day-to-day recipes for pages, endpoints, and listeners
- [`docs/EVENTS.md`](./docs/EVENTS.md) — event catalog
- [`docs/guild-api-requirements.md`](./docs/guild-api-requirements.md) — API gaps and CORS requirements
- [Structs](https://playstructs.com)
- [Project Wiki](https://watt.wiki)
- [@PlayStructs Twitter](https://twitter.com/playstructs)


## License

Copyright 2021 [Slow Ninja Inc](https://slow.ninja).

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

[http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
