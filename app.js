const MIRROR_NODES = {
  mainnet: [
    'https://mainnet-public.mirrornode.hedera.com',
    'https://mainnet.hashio.io',
  ],
  testnet: [
    'https://testnet.mirrornode.hedera.com',
    'https://testnet.hashio.io',
  ],
};
// Tracks the currently active node index per network (sticky for the session).
const mirrorNodeIndex = { mainnet: 0, testnet: 0 };
const HASHSCAN_BASE = {
  mainnet: 'https://hashscan.io/mainnet',
  testnet: 'https://hashscan.io/testnet',
};

// Fetch from a mirror node with automatic failover.
// Cycles through MIRROR_NODES[network] starting at the current sticky index.
// Returns the Response on success (including 404). Throws if all nodes fail.
async function fetchMirrorNode(network, path) {
  const nodes = MIRROR_NODES[network];
  const start = mirrorNodeIndex[network];

  for (let offset = 0; offset < nodes.length; offset++) {
    const idx = (start + offset) % nodes.length;
    let res;
    try {
      res = await fetch(nodes[idx] + path);
    } catch {
      continue; // network-level error — try next node
    }

    // 404 = resource genuinely not found; no point cycling to another node.
    if (res.status === 404) {
      mirrorNodeIndex[network] = idx;
      return res;
    }

    // Server errors or rate-limiting — try the next node.
    if (res.status >= 500 || res.status === 429) {
      if (offset > 0) console.info(`[mirror] fell back to node ${idx} (${nodes[idx]}) for ${network}`);
      continue;
    }

    // Any other response is a valid reply from this node; make it sticky.
    mirrorNodeIndex[network] = idx;
    if (offset > 0) console.info(`[mirror] fell back to node ${idx} (${nodes[idx]}) for ${network}`);
    return res;
  }

  throw new Error(`All mirror nodes failed for ${network}. Please try again later.`);
}

function getNetwork() {
  return document.querySelector('input[name="network"]:checked').value;
}

function setStatus(msg, type = '') {
  const el = document.getElementById('status');
  el.className = type;
  el.innerHTML = msg;
}

function formatBalance(raw, decimals) {
  if (decimals === 0) return Number(raw).toLocaleString();
  const divisor = Math.pow(10, decimals);
  const val = Number(raw) / divisor;
  return val.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function rankBadgeClass(i) {
  if (i === 0) return 'gold';
  if (i === 1) return 'silver';
  if (i === 2) return 'bronze';
  return '';
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'copied';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('copied'); }, 1500);
  } catch {
    btn.textContent = '!err';
  }
}

function buildTable(balances, tokenDecimals, totalSupply, network) {
  const hashscan = HASHSCAN_BASE[network];
  const top50 = balances.slice(0, 50);
  const totalSupplyNum = Number(totalSupply);

  let rows = '';
  top50.forEach((entry, i) => {
    const { account, balance } = entry;
    const decimals = tokenDecimals;
    const fmt = formatBalance(balance, decimals);
    const pct = totalSupplyNum > 0
      ? ((Number(balance) / totalSupplyNum) * 100).toFixed(4)
      : '—';
    const badgeCls = rankBadgeClass(i);

    rows += `
      <tr>
        <td><span class="rank-badge ${badgeCls}">${i + 1}</span></td>
        <td>
          <div class="acct-cell">
            <a href="${hashscan}/account/${account}" target="_blank" rel="noopener">${account}</a>
            <button class="copy-btn" onclick="copyText('${account}', this)">copy</button>
          </div>
        </td>
        <td class="right mono">${fmt}</td>
        <td class="right">
          <div class="share-bar">
            <span>${pct}%</span>
            <div class="share-bar-fill">
              <div class="share-bar-fill-inner" style="width:${Math.min(parseFloat(pct)||0, 100)}%"></div>
            </div>
          </div>
        </td>
      </tr>`;
  });

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:52px">#</th>
            <th>Wallet Address</th>
            <th class="right">Balance</th>
            <th class="right">% of Supply</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function queryToken() {
  const raw = document.getElementById('token-input').value.trim();
  if (!raw) { setStatus('Please enter a token ID.', 'error'); return; }

  // Validate rough format
  if (!/^\d+\.\d+\.\d+$/.test(raw)) {
    setStatus('Invalid token ID format. Expected format: 0.0.XXXXXXX', 'error');
    return;
  }

  const network = getNetwork();
  const hashscan = HASHSCAN_BASE[network];
  const btn = document.getElementById('query-btn');
  btn.disabled = true;

  // Hide previous results
  document.getElementById('token-info').classList.remove('visible');
  document.getElementById('table-container').innerHTML = '';
  setStatus('<span class="spinner"></span>Fetching token info…', 'loading');

  try {
    // 1. Fetch token metadata
    const tokenRes = await fetchMirrorNode(network, `/api/v1/tokens/${raw}`);
    if (!tokenRes.ok) {
      if (tokenRes.status === 404) throw new Error(`Token ${raw} not found on ${network}.`);
      throw new Error(`Mirror node error ${tokenRes.status} while fetching token info.`);
    }
    const tokenData = await tokenRes.json();

    const decimals = parseInt(tokenData.decimals ?? '0', 10);
    const totalSupply = tokenData.total_supply ?? '0';
    const adjustedSupply = formatBalance(totalSupply, decimals);

    // Populate info card
    document.getElementById('info-name').textContent    = tokenData.name    || '—';
    document.getElementById('info-symbol').textContent  = tokenData.symbol  || '—';
    document.getElementById('info-id').textContent      = tokenData.token_id || raw;
    document.getElementById('info-decimals').textContent = decimals;
    document.getElementById('info-supply').textContent  = adjustedSupply;
    document.getElementById('info-type').textContent    = tokenData.type    || '—';
    document.getElementById('token-info').classList.add('visible');

    // Update hashscan footer link
    document.getElementById('hashscan-link').href = `${hashscan}/token/${raw}`;

    // 2. Paginate through ALL holders, sort by balance desc, take top 50.
    //    The Mirror Node orders by account ID — there is no server-side sort by
    //    balance — so we must collect every page and sort client-side.
    const PAGE_SIZE = 100;          // max allowed by the API
    const PAGE_CAP  = 200;          // safety cap: 200 × 100 = 20 000 holders
    let allBalances = [];
    let nextPath = `/api/v1/tokens/${raw}/balances?limit=${PAGE_SIZE}`;
    let pagesFetched = 0;
    let cappedEarly = false;

    while (nextPath) {
      pagesFetched++;
      setStatus(
        `<span class="spinner"></span>Fetching holders… page ${pagesFetched} (${allBalances.length} collected)`,
        'loading'
      );

      const balRes = await fetchMirrorNode(network, nextPath);
      if (!balRes.ok) {
        throw new Error(`Mirror node error ${balRes.status} while fetching balances.`);
      }
      const balData = await balRes.json();
      const page = balData.balances ?? [];
      allBalances = allBalances.concat(page);

      // links.next is already a root-relative path — use it directly.
      nextPath = balData.links?.next ?? null;

      if (pagesFetched >= PAGE_CAP && nextPath) {
        cappedEarly = true;
        nextPath = null;
      }
    }

    // Sort all holders by balance descending, then slice top 50
    allBalances.sort((a, b) => {
      const diff = BigInt(b.balance) - BigInt(a.balance);
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });
    const balances = allBalances.slice(0, 50);

    if (balances.length === 0) {
      document.getElementById('table-container').innerHTML =
        `<div class="empty-state"><p>No holder data found for this token.</p></div>`;
      setStatus(`Token found, but no balance data available.`, 'ok');
      return;
    }

    // Render table
    document.getElementById('table-container').innerHTML =
      buildTable(balances, decimals, totalSupply, network);

    const cappedNote = cappedEarly
      ? ` <span style="color:var(--muted)">(sampled first ${PAGE_CAP * PAGE_SIZE} holders — token has more)</span>`
      : '';
    setStatus(
      `Top 50 of <strong>${allBalances.length.toLocaleString()}</strong> total holders for <strong>${tokenData.name || raw}</strong> (${tokenData.symbol || ''})${cappedNote}`,
      'ok'
    );

  } catch (err) {
    setStatus(err.message, 'error');
    document.getElementById('table-container').innerHTML =
      `<div class="empty-state"><p>${err.message}</p></div>`;
  } finally {
    btn.disabled = false;
  }
}

// ── Top Tokens by 24h Volume (CoinGecko) ───────────────────────────────────
const COINGECKO = 'https://api.coingecko.com/api/v3';

function fmtUsd(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
  if (v >= 1)   return '$' + v.toFixed(2);
  return '$' + v.toPrecision(4);
}

function fmtPct(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return (v >= 0 ? '▲ +' : '▼ ') + Math.abs(v).toFixed(2) + '%';
}

function buildSparkSVG(prices, isPos) {
  const color = isPos ? '#3fb950' : '#f85149';
  const W = 136, H = 36;
  if (!prices || prices.length < 2) {
    const y1 = H / 2, y2 = isPos ? H * 0.3 : H * 0.7;
    return `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line x1="0" y1="${y1}" x2="${W}" y2="${y2}" stroke="${color}" stroke-width="1.8" stroke-linecap="round" opacity="0.9"/>
    </svg>`;
  }
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const pad = 3;
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = H - pad - ((p - min) / range) * (H - pad * 2);
    return [x.toFixed(1), y.toFixed(1)];
  });
  const polyline = pts.map(p => p.join(',')).join(' ');
  const fillPts = `${pts[0][0]},${H} ` + polyline + ` ${pts[pts.length - 1][0]},${H}`;
  const uid = 'sg' + Math.random().toString(36).slice(2, 7);
  return `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs>
      <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <polygon points="${fillPts}" fill="url(#${uid})"/>
    <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

async function loadTopTokens() {
  const scroll = document.getElementById('top-tokens-scroll');
  const btn    = document.getElementById('top-tokens-refresh');
  scroll.innerHTML = '<div class="top-tokens-msg"><span class="spinner"></span>Loading…</div>';
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(
      `${COINGECKO}/coins/markets?vs_currency=usd&category=hedera-ecosystem` +
      `&order=volume_desc&per_page=10&page=1&sparkline=true&price_change_percentage=24h`
    );
    if (res.status === 429) throw new Error('Rate limited — try again shortly');
    if (!res.ok) throw new Error(`CoinGecko API ${res.status}`);
    const tokens = await res.json();
    if (!tokens.length) throw new Error('No token data returned');

    scroll.innerHTML = tokens.map((t, i) => {
      const chg    = t.price_change_percentage_24h ?? 0;
      const isPos  = chg >= 0;
      // Subsample 168 hourly points → ~24 for a clean sparkline
      const raw    = t.sparkline_in_7d?.price ?? [];
      const step   = Math.max(1, Math.floor(raw.length / 24));
      const prices = raw.filter((_, j) => j % step === 0);
      const spark  = buildSparkSVG(prices, isPos);
      return `
        <div class="token-card" data-idx="${i}">
          <div class="token-card-top">
            <span class="tc-symbol">${t.symbol.toUpperCase()}</span>
            <span class="tc-rank">#${i + 1}</span>
          </div>
          <div class="tc-name">${t.name}</div>
          <div class="tc-spark">${spark}</div>
          <div class="tc-price">${fmtUsd(t.current_price)}</div>
          <div class="tc-change ${isPos ? 'up' : 'down'}">${fmtPct(chg)}</div>
          <div class="tc-vol">${fmtUsd(t.total_volume)} vol</div>
        </div>`;
    }).join('');

    // Attach click handlers after rendering so token data is captured in a
    // closure — no inline onclick means no HTML-encoding issues with any
    // token ID or symbol containing special characters.
    scroll.querySelectorAll('.token-card').forEach((card, i) => {
      card.addEventListener('click', () => useTopToken(tokens[i].id, tokens[i].symbol));
    });

  } catch (err) {
    scroll.innerHTML = `<span class="top-tokens-err">Could not load: ${err.message}</span>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Cache resolved CoinGecko coinId → HTS token ID so each coin is only fetched once.
const htsIdCache = {};

// symbol is passed from the card onclick so we can fall back to Mirror Node
// search if CoinGecko doesn't have the platforms field populated for that token.
async function useTopToken(coinId, symbol) {
  if (!coinId) return;

  // Use cached value immediately — no extra API call needed.
  if (htsIdCache[coinId]) {
    document.getElementById('token-input').value = htsIdCache[coinId];
    queryToken();
    return;
  }

  setStatus('<span class="spinner"></span>Resolving token…', 'loading');

  const network = getNetwork();
  let htsId = null;

  try {
    // Step 1 — try CoinGecko platform data.
    // CoinGecko doesn't always have platforms['hedera-hashgraph'] filled in,
    // so treat any failure here as a non-fatal miss and fall through to step 2.
    const res = await fetch(
      `${COINGECKO}/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`
    );
    if (res.ok) {
      const data = await res.json();
      const platformId = data.platforms?.['hedera-hashgraph'];
      if (platformId) {
        if (/^0x[0-9a-f]{40}$/i.test(platformId)) {
          // EVM hex address — resolve to native 0.0.X via Mirror Node
          const mRes = await fetchMirrorNode(network, `/api/v1/tokens/${platformId}`);
          if (mRes.ok) htsId = (await mRes.json()).token_id;
        } else if (/^\d+\.\d+\.\d+$/.test(platformId)) {
          htsId = platformId;
        }
      }
    }

    // Step 2 — fall back to Mirror Node symbol search when CoinGecko didn't
    // return a usable platform address (field missing, rate-limited, etc.).
    if (!htsId && symbol) {
      const sym = encodeURIComponent(symbol.toUpperCase());
      const sRes = await fetchMirrorNode(network, `/api/v1/tokens?symbol=${sym}&limit=25`);
      if (sRes.ok) {
        const sData = await sRes.json();
        const matches = (sData.tokens ?? []).filter(t => t.type === 'FUNGIBLE_COMMON' && !t.deleted);
        if (matches.length > 0) {
          // Pick the token with the largest total supply — most likely to be the
          // canonical one when multiple tokens share the same symbol.
          matches.sort((a, b) => {
            const diff = BigInt(b.total_supply ?? '0') - BigInt(a.total_supply ?? '0');
            return diff > 0n ? 1 : diff < 0n ? -1 : 0;
          });
          htsId = matches[0].token_id;
        }
      }
    }

    if (htsId && /^\d+\.\d+\.\d+$/.test(htsId)) {
      htsIdCache[coinId] = htsId; // cache so subsequent clicks are instant
      document.getElementById('token-input').value = htsId;
      queryToken();
    } else {
      setStatus(`Could not find a Hedera token ID for ${symbol || coinId}.`, 'error');
    }
  } catch (err) {
    setStatus('Failed to resolve token: ' + err.message, 'error');
  }
}

loadTopTokens();

// Allow Enter key to trigger query
document.getElementById('token-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') queryToken();
});
