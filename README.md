<div align="center">

```
 ██╗  ██╗████████╗███████╗    ██████╗  █████╗ ███████╗██╗  ██╗
 ██║  ██║╚══██╔══╝██╔════╝    ██╔══██╗██╔══██╗██╔════╝██║  ██║
 ███████║   ██║   ███████╗    ██║  ██║███████║███████╗███████║
 ██╔══██║   ██║   ╚════██║    ██║  ██║██╔══██║╚════██║██╔══██║
 ██║  ██║   ██║   ███████║    ██████╔╝██║  ██║███████║██║  ██║
 ╚═╝  ╚═╝   ╚═╝   ╚══════╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
         TOKEN  HOLDER  DASHBOARD
```

### *On-chain intelligence. Zero friction. Pure signal.*

---

![Status](https://img.shields.io/badge/status-beta-blueviolet?style=for-the-badge)
![Network](https://img.shields.io/badge/network-Hedera-8259ef?style=for-the-badge)
![Dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge)

</div>

---

## The Mission

> *"The chain doesn't lie. The data doesn't hide. The only question is — are you reading it?"*

This isn't just a token explorer. It's a **live intelligence layer** on top of the Hedera network — built lean, built fast, built to surface the signals that matter. No logins. No API keys. No installs. Open the file, query a token, see the truth.

The dashboard started as a simple top-50 holder lookup. It evolved into something bigger.

---

## What It Does

### The Top Tokens Feed

Before you even type a token ID, the dashboard shows you what's moving:

- Live feed of the **top 10 Hedera ecosystem tokens** ranked by 24-hour trading volume
- Each card shows current price, 24h % change, volume, and a **7-day sparkline** (real price history)
- Click any card → the token is auto-resolved from EVM address to native `0.0.X` HTS ID and queried instantly
- Data sourced from the **CoinGecko free public API** — no API key, no auth, no friction

### The Holder Lookup

Enter any HTS token ID (`0.0.XXXXXXX`) and the dashboard will:

1. Fetch token metadata (name, symbol, decimals, total supply, type) from the Hedera Mirror Node
2. Paginate through **all** token holders client-side (up to 20,000 accounts) and sort by balance descending
3. Display the **top 50 wallets** ranked by holdings, with:
   - Gold / silver / bronze rank badges for the top 3
   - Clickable wallet addresses linking directly to HashScan
   - One-click copy buttons for each address
   - Balance formatted with correct decimal precision
   - Each holder's percentage share of total supply with a visual progress bar

Supports both **Mainnet** and **Testnet** via a simple radio toggle.

---

## Tech Stack

| Layer | Details |
|---|---|
| Runtime | Pure browser — no build step, no framework, no dependencies |
| Market Data | [CoinGecko API](https://www.coingecko.com/en/api) — free tier, no key required |
| Chain Data | [Hedera Mirror Node REST API](https://docs.hedera.com/hedera/sdks-and-apis/rest-api) |
| Explorer Links | [HashScan](https://hashscan.io) |
| Styling | Hand-rolled CSS — dark GitHub-inspired theme |

---

## Usage

Just open `index.html` in any modern browser — no server required.

```
open index.html
```

Or serve it locally if you need it on a URL:

```bash
npx serve .
# or
python3 -m http.server 8080
```

**[Launch the tool →](https://sirkselwonk-star.github.io/CLAUDE/)**

---

## API Details

**Top tokens feed:**
```
GET https://api.coingecko.com/api/v3/coins/markets
    ?vs_currency=usd&category=hedera-ecosystem
    &order=volume_desc&per_page=10&sparkline=true
    &price_change_percentage=24h
```

**Holder lookup:**
```
GET /api/v1/tokens/{tokenId}/balances?limit=100
```

Because the Mirror Node orders results by account ID (not balance), the app collects every page and sorts client-side. A safety cap of **200 pages × 100 accounts = 20,000 holders** is applied to avoid unbounded fetches — a note is shown when this cap is hit.

**EVM → HTS resolution** *(used when clicking a top tokens card)*:
```
GET /api/v1/tokens/{evmAddress}
```

---

## Caveats

- Holder view shows top 50 only (sufficient for most analysis use cases)
- Balance data reflects the Mirror Node's last indexed state, not real-time consensus
- Very large tokens (>20,000 holders) are sampled at 20,000 entries before sorting
- CoinGecko free tier is rate-limited; sparkline data refreshes on page load only

---

## Connect

Got feedback? Found a bug? Think something could be sharper?

- Open an issue
- Drop a pull request
- Or just explore and let the data speak

---

<div align="center">

*Built in public. Shipped lean. Data-first, always.*

**HEDERA TOKEN HOLDER DASHBOARD** — *because the chain never lies.*

</div>
