import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

// Helper to fetch the current price of a stock ticker.  This first
// attempts to query Yahoo Finance via a CORS proxy and falls back to
// the publicly available Stooq CSV service if Yahoo fails.  On
// success it returns a number; otherwise it returns null.
async function fetchCurrentPrice(ticker) {
  const cors = 'https://corsproxy.io/?';
  // Attempt Yahoo Finance quote endpoint
  try {
    const url = `${cors}https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
      ticker
    )}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const result = data?.quoteResponse?.result?.[0];
      const price = result?.regularMarketPrice;
      if (typeof price === 'number' && !isNaN(price)) {
        return price;
      }
    }
  } catch (e) {
    // ignore and fall back
  }
  // Fallback to Stooq CSV; ticker must be in the .us format for U.S. equities
  try {
    const normalized = ticker.replace(/\./g, '').toLowerCase();
    const url = `${cors}https://stooq.com/q/l/?s=${normalized}.us&i=d`;
    const res = await fetch(url);
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n');
      if (lines.length > 1) {
        const row = lines[1].split(',');
        // Stooq CSV: Symbol,Date,Open,High,Low,Close,Volume
        const closePrice = parseFloat(row[3]);
        if (!isNaN(closePrice)) {
          return closePrice;
        }
      }
    }
  } catch (e) {
    // ignore
  }
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

  // When a ticker is changed, fetch the latest price.  The price
  // field is non‑editable and updates automatically.  If fetching
  // fails, an error message is stored on the row.
  const updateTicker = (id, ticker) => {
    setAssets(prev =>
      prev.map(asset =>
        asset.id === id
          ? { ...asset, ticker, currentPrice: null, loading: true, error: null }
          : asset
      )
    );
    if (!ticker) return;
    fetchCurrentPrice(ticker).then(price => {
      setAssets(prev =>
        prev.map(asset => {
          if (asset.id === id) {
            return {
              ...asset,
              currentPrice: price,
              loading: false,
              error: price == null ? 'Price unavailable' : null
            };
          }
          return asset;
        })
      );
    });
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

  // Derived data: compute per‑row values and totals.  The current and
  // target values multiply shares by price; if price is unavailable
  // they are zero.  Totals sum across all rows.
  const rows = assets.map(asset => {
    const current = (asset.shares || 0) * (asset.currentPrice || 0);
    const target = (asset.shares || 0) * (asset.targetPrice || 0);
    return { ...asset, currentValue: current, targetValue: target, gain: target - current };
  });
  const currentTotal = rows.reduce((acc, r) => acc + r.currentValue, 0);
  const targetTotal = rows.reduce((acc, r) => acc + r.targetValue, 0);
  const gainTotal = targetTotal - currentTotal;

  // Data for the bar chart.  Each bar compares current vs target value
  // for a particular ticker.  Filtering out rows with no ticker or
  // price prevents zero bars from showing.
  const chartData = rows
    .filter(r => r.ticker && r.currentValue > 0 && r.targetValue > 0)
    .map(r => ({
      name: r.ticker.toUpperCase(),
      Current: parseFloat(r.currentValue.toFixed(2)),
      Target: parseFloat(r.targetValue.toFixed(2))
    }));

  return (
    <div className="container">
      <header className="mb-6">
        <h1 className="title">Portfolio Projection</h1>
        <p className="text-sm text-gray-600">
          Enter a stock ticker and number of shares. The app fetches the current
          price and allows you to set a target price to see potential returns.
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
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={v => `$${v}`} />
                <Tooltip
                  formatter={(value) => `$${parseFloat(value).toLocaleString()}`}
                />
                <Legend />
                <Bar dataKey="Current" fill="#60a5fa" />
                <Bar dataKey="Target" fill="#6ee7b7" />
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
