import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

/*
 * Helper to fetch the current price of a stock ticker.
 *
 * This helper tries a few different data sources in order to return a
 * reliable price without requiring API keys.  The primary source is
 * Yahoo Finance's chart API (v8) which provides current and recent
 * price information without authentication.  Because browsers enforce
 * cross‑origin restrictions, the request is routed through the
 * allorigins proxy which adds the appropriate CORS headers.  If the
 * Yahoo call fails or the returned data doesn't include a valid price
 * (which can happen for delisted or ill‑formed tickers), the helper
 * falls back to the Stooq CSV service.  Stooq uses a different
 * ticker format: U.S. equities are suffixed with `.us` and many
 * cryptocurrencies use a `.v` suffix (e.g. `btc.v`).  See
 * https://stooq.pl/ for details on their naming conventions.
 *
 * On success this function resolves to a number representing the last
 * traded price.  If no price can be determined it resolves to null.
 */
async function fetchCurrentPrice(ticker) {
  if (!ticker) return null;
  // CORS proxy base.  We route all outbound requests through this
  // proxy so that the target server's response includes permissive
  // CORS headers.  allorigins returns the raw contents of any URL
  // when prefaced with `https://api.allorigins.win/raw?url=`.
  const proxyBase = 'https://api.allorigins.win/raw?url=';

  // First try Yahoo Finance's v7 quote endpoint.  This endpoint
  // returns a `quoteResponse` object with a `regularMarketPrice`
  // property.  Using the quote API is more reliable for the
  // latest price than the chart API because it is less likely to
  // report null or outdated values.  We URL‑encode the entire
  // endpoint when passing it through the proxy.
  try {
    const quoteEndpoint = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
      ticker
    )}`;
    const quoteRes = await fetch(
      `${proxyBase}${encodeURIComponent(quoteEndpoint)}`
    );
    if (quoteRes.ok) {
      const quoteData = await quoteRes.json();
      const result = quoteData?.quoteResponse?.result?.[0] ?? {};
      const price =
        result.regularMarketPrice ??
        result.regularMarketPreviousClose ??
        null;
      if (typeof price === 'number' && !isNaN(price)) {
        return price;
      }
    }
  } catch {
    // ignore and fall back
  }

  // If the quote endpoint returns no data, fall back to Yahoo
  // Finance's v8 chart API.  The chart API includes price meta
  // information, but occasionally returns null for the current
  // price.  We request a 1‑day range with a 1‑day interval to keep
  // the payload small.
  try {
    const chartEndpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?range=1d&interval=1d`;
    const chartRes = await fetch(
      `${proxyBase}${encodeURIComponent(chartEndpoint)}`
    );
    if (chartRes.ok) {
      const chartData = await chartRes.json();
      const meta = chartData?.chart?.result?.[0]?.meta ?? {};
      const price =
        meta.regularMarketPrice ?? meta.chartPreviousClose ?? null;
      if (typeof price === 'number' && !isNaN(price)) {
        return price;
      }
    }
  } catch {
    // ignore and continue to fallback
  }

  // Final fallback: query the Stooq CSV service.  Stooq uses
  // different suffix conventions.  If the ticker consists of
  // alphabetic characters only (e.g. AAPL), append `.us`.  If it
  // ends with `-USD` (common for cryptocurrencies), replace that
  // suffix with `.v`.  The CSV returned by Stooq includes the
  // closing price in the seventh column.  See stooq.pl for details.
  let stooqSymbol = ticker.toLowerCase();
  if (/^[a-z]+$/i.test(stooqSymbol)) {
    stooqSymbol = `${stooqSymbol}.us`;
  } else if (stooqSymbol.endsWith('-usd')) {
    stooqSymbol = stooqSymbol.replace(/-usd$/, '.v');
  }
  try {
    const stooqUrl = `https://stooq.pl/q/l/?s=${encodeURIComponent(
      stooqSymbol
    )}&f=sd2t2ohlcvn&h&e=csv`;
    const stooqRes = await fetch(
      `${proxyBase}${encodeURIComponent(stooqUrl)}`
    );
    if (stooqRes.ok) {
      const csv = await stooqRes.text();
      const lines = csv.trim().split(/\r?\n/);
      if (lines.length > 1) {
        const parts = lines[1].split(',');
        // fields: Symbol,Date,Time,Open,High,Low,Close,Volume,Name
        const close = parseFloat(parts[6]);
        if (!isNaN(close)) {
          return close;
        }
      }
    }
  } catch {
    // final fallback fails silently
  }

  // If all attempts fail, return null to indicate that no price
  // could be retrieved.
  return null;
}

// Generates a unique identifier for each row using the current
// timestamp combined with a random component.  This ensures that
// React keys remain stable across re-renders when rows are added
// or removed.
function genId() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export default function App() {
  // Initialize state with a single empty asset row.  Each row tracks
  // the ticker symbol, share count, fetched current price and the
  // user‑entered target price.  The `loading` flag is used while
  // asynchronously fetching the current price.
  const [assets, setAssets] = useState([
    {
      id: genId(),
      ticker: '',
      shares: 0,
      currentPrice: null,
      targetPrice: 0,
      loading: false,
      error: null
    }
  ]);

  // Whether dark mode is enabled.  Toggling this updates a CSS class
  // on the <body> element via the effect below.  Default is light mode.
  const [darkMode, setDarkMode] = useState(false);

  // Apply or remove the 'dark' class on the document body whenever
  // darkMode changes.  This allows CSS rules to switch theme colors
  // based on the presence of the .dark class.
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  // When a ticker is changed, fetch the latest price.  The price
  // field is non‑editable and updates automatically.  If fetching
  // fails, an error message is stored on the row.
  const updateTicker = (id, ticker) => {
    // Update only the ticker and reset any previously fetched price.
    // We no longer fetch automatically here; users trigger price
    // retrieval via the "Fetch Prices" button.
    setAssets(prev =>
      prev.map(asset =>
        asset.id === id
          ? {
              ...asset,
              ticker,
              currentPrice: null,
              loading: false,
              error: null
            }
          : asset
      )
    );
    return;
  };

  // Update share count for a row.  Negative values are not allowed.
  const updateShares = (id, shares) => {
    const parsed = parseFloat(shares);
    setAssets(prev =>
      prev.map(asset =>
        asset.id === id ? { ...asset, shares: isNaN(parsed) ? 0 : parsed } : asset
      )
    );
  };

  // Update target price for a row.  Negative values are not allowed.
  const updateTarget = (id, price) => {
    const parsed = parseFloat(price);
    setAssets(prev =>
      prev.map(asset =>
        asset.id === id ? { ...asset, targetPrice: isNaN(parsed) ? 0 : parsed } : asset
      )
    );
  };

  // Add a new blank asset row.  Defaults to zero shares and zero target
  // price.  The current price will remain null until the user enters
  // a ticker.
  const addRow = () => {
    setAssets(prev => [
      ...prev,
      {
        id: genId(),
        ticker: '',
        shares: 0,
        currentPrice: null,
        targetPrice: 0,
        loading: false,
        error: null
      }
    ]);
  };

  // Remove a row by id.  If only one row remains, reset it to a
  // blank state instead of removing entirely.
  const removeRow = id => {
    setAssets(prev => {
      if (prev.length === 1) {
        return [
          {
            id: prev[0].id,
            ticker: '',
            shares: 0,
            currentPrice: null,
            targetPrice: 0,
            loading: false,
            error: null
          }
        ];
      }
      return prev.filter(asset => asset.id !== id);
    });
  };

  // Fetch current prices for all entered tickers.  This function sets
  // the loading state for each row with a ticker, then performs all
  // price fetches in parallel.  Once complete it updates each row
  // with the retrieved price (or an error if unavailable).
  const fetchAllPrices = async () => {
    // Mark all tickers as loading
    setAssets(prev =>
      prev.map(asset =>
        asset.ticker
          ? { ...asset, loading: true, error: null, currentPrice: null }
          : asset
      )
    );
    // Fetch prices concurrently
    const results = await Promise.all(
      assets.map(async asset => {
        if (!asset.ticker) {
          return { id: asset.id, price: null, error: null };
        }
        const price = await fetchCurrentPrice(asset.ticker);
        return {
          id: asset.id,
          price,
          error: price == null ? 'Price unavailable' : null
        };
      })
    );
    // Update state with fetched prices
    setAssets(prev =>
      prev.map(asset => {
        const res = results.find(r => r.id === asset.id);
        if (!res || !asset.ticker) return { ...asset, loading: false };
        return {
          ...asset,
          currentPrice: res.price,
          loading: false,
          error: res.error
        };
      })
    );
  };

  // Derived data: compute per‑row values and totals.  The current and
  // target values multiply shares by price; if price is unavailable
  // they are zero.  Totals sum across all rows.
  const rows = assets.map(asset => {
    const current = (asset.shares || 0) * (asset.currentPrice || 0);
    const target = (asset.shares || 0) * (asset.targetPrice || 0);
    const gain = target - current;
    const returnPct = current > 0 ? (gain / current) * 100 : null;
    return {
      ...asset,
      currentValue: current,
      targetValue: target,
      gain,
      returnPct
    };
  });
  const currentTotal = rows.reduce((acc, r) => acc + r.currentValue, 0);
  const targetTotal = rows.reduce((acc, r) => acc + r.targetValue, 0);
  const gainTotal = targetTotal - currentTotal;
  // Overall portfolio return percentage based on current and target totals.
  const portfolioReturnPct = currentTotal > 0 ? ((targetTotal - currentTotal) / currentTotal) * 100 : null;

  // Data for the bar chart.  Each bar compares current vs target value
  // for a particular ticker.  Filtering out rows with no ticker or
  // price prevents zero bars from showing.
  const chartData = rows
    .filter(r => r.ticker && r.currentValue > 0 && r.targetValue > 0)
    .map(r => ({
      name: r.ticker.toUpperCase(),
      Current: parseFloat(r.currentValue.toFixed(2)),
      Target: parseFloat(r.targetValue.toFixed(2)),
      ReturnPct:
        r.returnPct != null
          ? parseFloat(r.returnPct.toFixed(2))
          : null
    }));

  return (
    <div className="container">
      <header className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="title">Portfolio Projection</h1>
          <button
            onClick={() => setDarkMode(prev => !prev)}
            className="ml-4"
            aria-label="Toggle dark mode"
          >
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
        <p className="text-sm text-gray-600">
          Enter a stock ticker, number of shares and a target price. Once you&apos;re ready, click
          &quot;Fetch Prices&quot; to retrieve the latest data and see your potential returns.
        </p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left side: input table */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">Assets</h2>
            <button onClick={addRow} aria-label="Add asset">
              <Plus size={16} className="inline mr-1" /> Add
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Shares</th>
                <th>Current Price</th>
                <th>Target Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="text"
                      value={row.ticker}
                      placeholder="e.g. AAPL"
                      onChange={e => updateTicker(row.id, e.target.value.trim())}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.shares}
                      onChange={e => updateShares(row.id, e.target.value)}
                    />
                  </td>
                  <td>
                    {row.loading ? (
                      <span className="text-gray-400 italic">Loading…</span>
                    ) : row.error ? (
                      <span className="text-red-500 text-xs">{row.error}</span>
                    ) : row.currentPrice != null ? (
                      <span>${row.currentPrice.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-400 italic">—</span>
                    )}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.targetPrice}
                      onChange={e => updateTarget(row.id, e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      aria-label="Remove asset"
                      style={{ backgroundColor: 'transparent', color: '#ef4444' }}
                    >
                      <X size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Fetch all prices button below the table */}
          <div className="mt-4 flex justify-end">
            <button onClick={fetchAllPrices} aria-label="Fetch all prices">
              Fetch Prices
            </button>
          </div>
        </div>
        {/* Right side: summary and chart */}
        <div className="card">
          <h2 className="font-semibold text-lg mb-2">Summary</h2>
          <div className="mb-4">
            <p>
              <strong>Current Portfolio Value:</strong> ${currentTotal.toFixed(2)}
            </p>
            <p>
              <strong>Target Portfolio Value:</strong> ${targetTotal.toFixed(2)}
            </p>
            <p>
              <strong>Total Gain/Loss:</strong>{' '}
              <span
                style={{ color: gainTotal >= 0 ? '#16a34a' : '#dc2626' }}
              >
                {gainTotal >= 0 ? '+' : ''}${gainTotal.toFixed(2)}
              </span>
            </p>
            <p>
              <strong>Average Portfolio Return %:</strong>{' '}
              <span
                style={{ color: portfolioReturnPct != null && portfolioReturnPct >= 0 ? '#16a34a' : '#dc2626' }}
              >
                {portfolioReturnPct != null
                  ? `${portfolioReturnPct >= 0 ? '+' : ''}${portfolioReturnPct.toFixed(2)}%`
                  : '—'}
              </span>
            </p>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" />
                {/* Left Y axis for dollar values */}
                <YAxis yAxisId="left" tickFormatter={v => `$${v}`} />
                {/* Right Y axis for percentage returns */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={v => (v != null ? `${v}%` : '')}
                />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'ReturnPct') {
                      return [`${value}%`, 'Return %'];
                    }
                    return [`$${parseFloat(value).toLocaleString()}`, name];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="Current" fill="#60a5fa" />
                <Bar yAxisId="left" dataKey="Target" fill="#6ee7b7" />
                <Bar yAxisId="right" dataKey="ReturnPct" fill="#fbbf24" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 italic">Enter data to see the chart.</p>
          )}
        </div>
      </div>
      {/* Detailed breakdown table */}
      <div className="card mt-6">
        <h2 className="font-semibold text-lg mb-2">Breakdown</h2>
        {rows.length === 0 ? (
          <p className="text-gray-500 italic">No assets entered.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Shares</th>
                <th>Current Price</th>
                <th>Current Value</th>
                <th>Target Price</th>
                <th>Target Value</th>
                <th>Gain/Loss</th>
                <th>Return %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td>{row.ticker || '—'}</td>
                  <td>{row.shares}</td>
                  <td>
                    {row.currentPrice != null
                      ? `$${row.currentPrice.toFixed(2)}`
                      : '—'}
                  </td>
                  <td>
                    {row.currentValue
                      ? `$${row.currentValue.toFixed(2)}`
                      : '—'}
                  </td>
                  <td>{row.targetPrice ? `$${row.targetPrice.toFixed(2)}` : '—'}</td>
                    
                  <td>
                    {row.targetValue
                      ? `$${row.targetValue.toFixed(2)}`
                      : '—'}
                  </td>
                  <td>
                    {row.gain
                      ? `${row.gain >= 0 ? '+' : ''}$${row.gain.toFixed(2)}`
                      : '—'}
                  </td>
                  <td>
                    {row.returnPct != null
                      ? `${row.returnPct >= 0 ? '+' : ''}${row.returnPct.toFixed(2)}%`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {/* Vercel Analytics and Speed Insights */}
      <SpeedInsights />
      <Analytics />
    </div>
  );
}
