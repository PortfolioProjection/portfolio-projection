# Portfolio Projection

This is a simple React + Vite application that lets you model how your stock positions might evolve if the price reaches a given target.  Enter the ticker symbol, number of shares and your desired target price; the app fetches the current price for each ticker (using Yahoo Finance via a CORS proxy with a Stooq fallback) and calculates your potential gain or loss.  It also charts your current vs. target values and summarizes the total impact on your portfolio.

## Features

* **Live price lookup:** As soon as you enter a ticker, the app fetches the latest market price (where available) and displays it next to your position.
* **Per‑position targeting:** Enter a target price for each asset to see the projected return and compare against current values.
* **Summary and chart:** Totals for current value, target value and overall gain/loss are shown, along with a bar chart comparing current vs. target value by ticker.
* **Responsive layout:** The interface adapts from single‑column to two‑column layouts on wider screens.

## Getting started

1. **Install dependencies:**

   ```bash
   npm install
   ```

   If you encounter network restrictions when installing packages, you can still inspect the source code directly.  The dependencies listed in `package.json` are required to run the app locally.

2. **Run the development server:**

   ```bash
   npm run dev
   ```

   Open http://localhost:5173 in your browser.  The page will automatically reload when you edit files.

3. **Build for production:**

   ```bash
   npm run build
   ```

   This will output a static build to the `dist` directory.  You can then deploy the contents of `dist` to any static hosting provider (GitHub Pages, Netlify, Vercel, etc.).

## Folder structure

```text
portfolio-projection/
├── package.json         – npm metadata and scripts
├── vite.config.js        – Vite configuration enabling React and specifying dist output
├── index.html            – the HTML entrypoint loaded by Vite
├── src/
│   ├── App.jsx           – main component handling state, fetching prices and rendering UI
│   ├── main.jsx          – React entrypoint that renders `<App />` into the DOM
│   └── index.css         – base styling; you can replace with Tailwind or your own styles
└── README.md            – this file
```

## Data sources

The application uses the following public endpoints to retrieve pricing data:

* **Yahoo Finance** – the [Finance quote endpoint](https://query1.finance.yahoo.com/v7/finance/quote) is proxied through `https://corsproxy.io/?` to bypass CORS restrictions.  Prices are taken from the `regularMarketPrice` field.
* **Stooq** – as a fallback, the CSV quote service at `https://stooq.com/q/l/` is queried via the same CORS proxy.  This service returns daily quotes for many U.S. equities.  The close price from the CSV is used if Yahoo fails.

Both services may have intermittent outages or ticker format differences.  If neither source returns a value for a given ticker, the app displays an error message on that row.

## License

This project is licensed under the MIT license.  See `LICENSE` for details.
