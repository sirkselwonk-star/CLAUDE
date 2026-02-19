# 🪙 Hedera Token Holder Dashboard

![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen)
![Browser Ready](https://img.shields.io/badge/runtime-browser-blue)
![Hedera](https://img.shields.io/badge/network-Hedera-8259ef)
![License](https://img.shields.io/badge/license-MIT-yellow)

A lightweight, zero-dependency browser tool for exploring the top 50 token holders of any **Hedera Token Service (HTS)** token in real time.

## ✨ What It Does

Enter any HTS token ID (e.g. `0.0.1234567`) and the dashboard will:

1. 🔍 Fetch token metadata (name, symbol, decimals, total supply, type) from the Hedera Mirror Node REST API.
2. 📄 Paginate through **all** token holders client-side (up to 20,000 accounts) and sort them by balance descending.
3. 🏆 Display the **top 50 wallets** ranked by holdings, with:
   - 🥇 🥈 🥉 Gold / silver / bronze rank badges for the top 3
   - 🔗 Clickable wallet addresses linking directly to HashScan
   - 📋 One-click copy buttons for each address
   - 🔢 Balance formatted with correct decimal precision
   - 📊 Each holder's percentage share of total supply with a visual bar

🌐 Supports both **Mainnet** and **Testnet** with a simple radio toggle.

## 🛠️ Tech Stack

| Layer | Details |
|---|---|
| ⚡ Runtime | Pure browser — no build step, no framework, no dependencies |
| 📡 Data | [Hedera Mirror Node REST API](https://docs.hedera.com/hedera/sdks-and-apis/rest-api) |
| 🔭 Explorer links | [HashScan](https://hashscan.io) |
| 🎨 Styling | Hand-rolled CSS with a dark GitHub-inspired theme |

## 🚀 Usage

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

## 📡 API Details

Holder data is fetched from:
```
GET /api/v1/tokens/{tokenId}/balances?limit=100
```

Because the Mirror Node orders results by account ID (not balance), the app collects every page and sorts client-side. A safety cap of **200 pages × 100 accounts = 20,000 holders** is applied to avoid unbounded fetches on extremely large tokens — a note is shown when this cap is hit.

## ⚠️ Limitations

- Top 50 holders only (sufficient for most analysis use cases)
- Balance data reflects the Mirror Node's last indexed state, not real-time consensus
- Very large tokens (>20,000 holders) are sampled at 20,000 entries before sorting
