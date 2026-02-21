# CLAUDE.md — HEDERA.TOKEN

## Project Overview

**HEDERA.TOKEN** is a zero-dependency, browser-only Hedera Token Holder Dashboard.
It runs directly from `index.html` with no build step, no framework, and no npm install.

Live: https://sirkselwonk-star.github.io/HEDERA.TOKEN/

---

## Architecture

| File | Role |
|---|---|
| `index.html` | Full UI shell — layout, styles inline, script tag pointing at `app.js` |
| `app.js` | All application logic — API calls, DOM manipulation, rendering |
| `style.css` | Hand-rolled dark theme (GitHub-inspired) |

There is intentionally **no build system**. Do not introduce one without discussion.

---

## Key Concepts

### Mirror Node failover
`fetchMirrorNode(network, path)` in `app.js` cycles through a list of Hedera Mirror Node
base URLs. It uses a sticky index per network (mainnet / testnet) so healthy nodes stay
preferred across calls. Server errors (5xx) and rate-limits (429) trigger failover;
404s are passed through immediately.

Mirror node list:
- **Mainnet**: `mainnet-public.mirrornode.hedera.com`, `mainnet.hashio.io`
- **Testnet**: `testnet.mirrornode.hedera.com`, `testnet.hashio.io`

### Holder pagination
The Mirror Node `/api/v1/tokens/{id}/balances` endpoint orders by account ID, not balance.
The app fetches **all pages client-side** (up to a 200-page / 20,000-holder safety cap),
sorts by balance descending using `BigInt` comparison, and renders the top 50.

### Top tokens feed
Loaded on page init via `loadTopTokens()`. Uses the CoinGecko free public API
(`/coins/markets?category=hedera-ecosystem`) — no API key required. Includes 7-day
sparklines subsampled from 168 hourly points down to ~24 for clean rendering.

### EVM → HTS resolution
CoinGecko often returns EVM hex addresses for Hedera tokens. `useTopToken()` resolves
these by querying `/api/v1/tokens/{evmAddress}` on the Mirror Node to get the native
`0.0.X` token ID before running a holder query.

---

## Development

Open `index.html` directly in a browser — no server needed.

```bash
# If you want a local URL:
npx serve .
# or
python3 -m http.server 8080
```

---

## APIs Used

| API | Endpoint pattern | Auth |
|---|---|---|
| Hedera Mirror Node | `/api/v1/tokens/{id}` | None |
| Hedera Mirror Node | `/api/v1/tokens/{id}/balances?limit=100` | None |
| CoinGecko (free) | `/api/v3/coins/markets?category=hedera-ecosystem` | None |
| CoinGecko (free) | `/api/v3/coins/{id}` | None |

---

## Constraints & Caveats

- **No server-side sort** available on the Mirror Node — all sorting is client-side.
- Holder view is capped at **200 pages × 100 = 20,000 entries** before sorting.
- Only the **top 50 holders** are rendered in the table.
- CoinGecko free tier is rate-limited; do not add polling or auto-refresh loops.
- Balance data reflects last indexed Mirror Node state, not real-time consensus.
- `style.css` targets modern browsers only — no IE/legacy polyfills needed.

---

## What Not to Do

- Do not add a bundler (webpack, vite, etc.) unless the project explicitly moves to that.
- Do not add npm dependencies — the zero-dependency constraint is intentional.
- Do not introduce a backend or server component.
- Do not add inline `<script>` blocks to `index.html`; all logic belongs in `app.js`.
