# GURU — AI Financial Decisioning System

An AI-powered wealth advisor platform that aggregates a unified view of end clients, forecasts cash flows, intelligently matches liquidity, and determines a full balance sheet strategy including cash management.

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Drizzle ORM)
- **AI**: OpenAI (Replit AI Integrations — no API key required)
- **Routing**: Wouter
- **State**: TanStack Query v5

## Architecture

### Key Routes
- `GET /api/clients` — List all wealth clients
- `GET /api/clients/:id` — Single client profile
- `GET /api/clients/:id/dashboard` — Full unified view: client + assets + liabilities + cashFlows + strategies
- `POST /api/clients` — Create new client
- `POST /api/assets` — Add asset to client
- `POST /api/liabilities` — Add liability to client
- `POST /api/cash-flows` — Log a cash flow event
- `POST /api/clients/:id/generate-strategy` — AI strategy generation (OpenAI gpt-5.1)

### Pages
- `/` — Client Portfolios list with summary statistics
- `/client/:id` — Detailed client dashboard

### Database Tables
- `clients` — Client profiles (name, email, age, riskTolerance)
- `assets` — Asset holdings per client (type, value, description)
- `liabilities` — Debt obligations per client (type, value, interestRate, description)
- `cash_flows` — Income and expense events (type, amount, category, date, description)
- `strategies` — AI-generated strategy recommendations (name, recommendation, impact)

## Key Features

1. **Unified Client Profile** — All financial data aggregated in one view
2. **KPI Dashboard** — Net Worth, Net Cash Flow, Debt-to-Assets Ratio, Annual Income
3. **Asset Allocation Chart** — Pie chart breakdown by asset class
4. **12-Month Cash Flow Forecast** — Area chart projecting cumulative net position
5. **Liquidity Analysis Panel** — Matches liquid assets to cash flow obligations, shows coverage ratio (months)
6. **Balance Sheet View** — Traditional double-entry layout showing assets vs. liabilities + net worth
7. **AI Strategy Generation** — GPT-5.1 analyzes full balance sheet to generate 3 specific recommendations including liquidity matching and cash deployment strategies
8. **Add Assets / Liabilities / Cash Flows** — Modal forms to build out client profiles

## Seed Data
One demo client is seeded on first run (only if the database is empty):
- **Sarah & Michael Kessler** (44, moderate risk) — HNW dual-income family, $5.99M assets, $1.35M liabilities

## Live Market Data

- **Ticker bar**: Bloomberg-style scrolling marquee: SPY, QQQ, ^DJI, GS, ^TNX, BTC-USD, ^VIX
- **Backend proxy**: `GET /api/market/quotes` fetches from Yahoo Finance query2 API using cookie+crumb auth
- **Auth flow**: `fc.yahoo.com` → cookies → `query2.finance.yahoo.com/v1/test/getcrumb` → crumb → quote endpoint
- **Persistence**: Auth cached in `/tmp/guru-yahoo-auth.json` (survives restarts, 1hr TTL)
- **If 429 rate-limited**: Run `curl -s -c /tmp/yf2.txt "https://fc.yahoo.com/" -L -o /dev/null && curl -s -b /tmp/yf2.txt "https://query2.finance.yahoo.com/v1/test/getcrumb"` to get a fresh crumb, then write it to the cache file
- **BrokeragePanel**: Shows live SPY % change and live GS stock price inline with holdings

## GURU Method — 5 Strategic Bucket Framework

All asset categorization uses the `GURU_BUCKETS` constant defined in `client-dashboard.tsx`:

| Bucket | Key | Color | Description |
|---|---|---|---|
| **Reserve** | `reserve` | Blue | Instantly available transaction accounts (checking) |
| **Yield** | `yield` | Amber | Penalty-free, higher-yielding accounts (savings, MM) |
| **Tactical** | `tactical` | Emerald | 1–2 days to settle or committed for a term (T-bills) |
| **Growth** | `growth` | Violet | Long-horizon investments — equities, bonds, retirement |
| **Alternatives** | `alternatives` | Orange | Real estate, PE, RSUs — strategic illiquid assets |

- **Liquid** = Reserve + Yield + Tactical (used in 12-month sufficiency check)
- `cashBuckets(assets)` → returns `{ reserve, yieldBucket, tactical, growth, alts, totalLiquid, ...items }`
- `liquidityTag(a)` → returns `{ label, tagCls }` from GURU_BUCKETS for badge rendering in NetWorthPanel
- Legacy aliases (`immediate`, `shortTerm`, `mediumTerm`) are preserved in `cashBuckets()` return value for backward compat

## Dashboard Layout (client-dashboard.tsx)

### Hero Banner (2-column)
- **Left**: "Cash Allocation" — horizontal progress bars for Reserve / Yield / Tactical showing each bucket's share of `totalLiquid` and exact dollar value
- **Right**: "Cash Available to Invest" + large `cashExcessTop` (liquid − 12-mo trough) + 3 sub-stats: Total Liquid, 12-Mo Req'd, Next Month net

### 6-Panel Grid (3-column)
1. `NetWorthPanel` — today's net worth + 5-year forward projection chart (Now/1Y/2Y/3Y/4Y/5Y XAxis), pulsing dot at Now
2. `CashFlowForecastPanel` — 12-month bar + area cumulative chart with trough marker
3. `CashManagementPanel` — "The GURU Method" 5-bucket donut with clickable legend, active description card, liquidity footer
4. `NetWorthPanel` (balance sheet tab) — assets vs liabilities breakdown with GURU badges
5. `BrokeragePanel` — live GS price, SPY % change, holdings breakdown
6. `GuruOptimizerPanel` — AI-generated strategies with impact scores

### Key Helpers
- `buildNWProjection(netWorth, cashFlows, assets)` → 6-point array `{ label, year, value }` using 6.5% growth on equity/RE/alts + annual surplus
- `cashBuckets(assets)` → `{ reserve, yieldBucket, tactical, growth, alts, totalLiquid, ...items }`
- `buildForecast(cashFlows)` → 12-month forecast with cumulative net
- `computeTrough(forecastData)` → worst cumulative position = the 12-month cash requirement figure
- `isChunkyEvent(cf)` → filters CashFlowTicker to taxes, education, bonus, travel, lifestyle, investments ≥ $5K
- `liquidityTag(a)` → GURU bucket label + CSS class for NetWorthPanel badges

## Development Notes

- All numeric values stored as `numeric` (Drizzle) which returns strings — always coerce with `Number()`
- Cash flow forecast is computed client-side from monthly averages (monthly * 12 projected)
- Asset descriptions may be undefined in edge cases — always use `(a.description ?? "").toLowerCase()`
- AI strategies are accumulated (not replaced) — each generation appends to existing strategies
- `cashFlows` prop must be passed to `NetWorthPanel` — it uses it for the 5-year projection
- Hero banner variables: `reserveTop`, `yieldTop`, `tacticalTop`, `totalLiquidTop`, `cashTroughTop`, `cashExcessTop`, `isPositiveTop`, `nextMonthNet`
