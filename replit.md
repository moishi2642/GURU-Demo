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
- `/client/:id` — Detailed client dashboard (5-tab navigation)

### Database Tables
- `clients` — Client profiles (name, email, age, riskTolerance)
- `assets` — Asset holdings per client (type, value, description)
- `liabilities` — Debt obligations per client (type, value, interestRate, description)
- `cash_flows` — Income and expense events (type, amount, category, date, description)
- `strategies` — AI-generated strategy recommendations (name, recommendation, impact)

## Demo Client

**Sarah & Michael Kessler** — single seeded demo client, populated from Prototype_Model_v4.xlsx

- **DB asset total**: $5,912,862 (live sum of `assets` table)
- **PROTO_TOTAL_ASSETS**: 5,996,550 (hardcoded — used only for GURU `growTarget` math, NOT for display)
- **DEMO_NOW**: `new Date(2025, 11, 1)` = December 1, 2025

## Navigation (5 Tabs)

| Tab | ActiveView key | Accent |
|---|---|---|
| Advisor Brief | `advisorbrief` | rose |
| Dashboard | `dashboard` | — |
| Client Financials & Forecast | `financials` | — |
| GURU Allocation | `guru` | — |
| Money Movement | `moneymovement` | — |

## Live Market Data

- **Ticker bar**: Bloomberg-style scrolling marquee: SPY, QQQ, ^DJI, GS, ^TNX, BTC-USD, ^VIX
- **Backend proxy**: `GET /api/market/quotes` fetches from Yahoo Finance query2 API using cookie+crumb auth
- **Auth flow**: `fc.yahoo.com` → cookies → `query2.finance.yahoo.com/v1/test/getcrumb` → crumb → quote endpoint
- **Persistence**: Auth cached in `/tmp/guru-yahoo-auth.json` (survives restarts, 1hr TTL)
- **If 429 rate-limited**: Run `curl -s -c /tmp/yf2.txt "https://fc.yahoo.com/" -L -o /dev/null && curl -s -b /tmp/yf2.txt "https://query2.finance.yahoo.com/v1/test/getcrumb"` to get a fresh crumb, then write it to the cache file

## GURU Allocation Tab

### Hero Bar
- **Total Assets**: `assets.reduce((s, a) => s + Number(a.value), 0)` — live DB sum ($5,912,862)
- **Potential Excess Cash**: computed from `reserveDelta` + `flowDelta` overshoots
- `PROTO_TOTAL_ASSETS = 5,996,550` is used internally ONLY for `growTarget` allocation math

### Bucket Framework (4 active + 3 passive)
| Bucket | Color | Description |
|---|---|---|
| Operating Cash | Blue | Day-to-day transaction accounts |
| Reserve | Amber | Emergency + irregular expense buffer |
| Build | Green | Medium-term T-bills/savings ladder |
| Grow | Violet | Long-horizon equity/alternative investments |
| Real Estate | Gray | Illiquid property — passive display |
| Alternative Assets | Gray | PE NAV + Carry — passive display |
| 529 Plans | Gray | Education — passive display |

Each active bucket row has:
- LEFT: account list with current balances
- MIDDLE: `BucketExecutionPanel` — transfer amount, months stepper, route selector, Execute button
- RIGHT: `BucketProductPanel` — top 3 recommended products, yield pickup vs current, allocation % inputs

### Key Constants (in GURU tab IIFE)
- `PROTO_TOTAL_ASSETS = 5,996,550` — for growTarget math only
- `growTarget = PROTO_TOTAL_ASSETS - reserveTarget - flowTarget - buildTarget - otherCurrent`
- `heroCardTotal = assets.reduce(...)` — live DB sum for display

## Balance Sheet (Client Financials → Balance Sheet tab)

### Two-Level Section Hierarchy

`buildAssetGroups(assets)` returns `BsSection[]`:
```typescript
interface BsSection { label: string; groups: BsGroup[]; total: number }
interface BsGroup { category: string; label: string; items: BsGroupItem[]; subtotal: number }
interface BsGroupItem { label: string; value: number; rate: string|null; ret: string|null; comment: AssetComment|null }
```

**5 sections**: Cash → Investments → Real Estate → Carry → Retirement

### BsTable Component
- **Assets**: `sections?: BsSection[]` — 5-col grid (`1fr 90px 56px 72px 80px`) incl. Return column
- **Liabilities**: `groups?: BsGroup[]` — 4-col grid (`1fr 90px 56px 90px`) — flat, no Return column
- Header row: `bg-slate-800 text-slate-300`
- Section header rows: `bg-slate-200` with section total
- Sub-group subtotal rows: italic, `bg-slate-50`
- Item rows: `pl-10` deep indent
- Grand total row: `bg-slate-900 text-white`

### ASSET_RETURNS Lookup
Per-account returns hardcoded in `buildAssetGroups`:
- Meta +28.3%, Cresset +14.2%, Carlyle VIII 12.4% IRR, Coinbase +47.3%, etc.
- Green for positive equity/alts, amber for fixed rates, muted for retirement/RE

## Cash Flow P&L Table (Client Financials → Cash Flows tab)

### Row Structure (`CF_PL_ROWS`)
- `kind: "group"` — collapsible section header (▶ LABEL), `bg-slate-200/70`, indented `pl-7`
- `kind: "item"` — individual line item, `bg-card`, `pl-8`
- `kind: "subtotal"` — section subtotal, `bg-slate-100`, `pl-8 font-bold`

### Footer Rows (bottom of table, in order)
1. **Total Cash Inflow** — `bg-emerald-50`, sum of all positive item values per month
2. **Total Cash Expenses** — `bg-rose-50`, sum of all negative item values per month
3. **Net Cash Flow** — `bg-emerald-50` or `bg-rose-50` depending on sign, `border-t-2`
4. **Cumulative Net** — `bg-blue-100`, `border-t-2 border-blue-300` (prominent), rolling YTD, trough circled in rose

### Key Computed Values
```typescript
inflowByMonth  = CF_MONTHS.map(mi => sum of Math.max(0, vals[item][mi]))
outflowByMonth = CF_MONTHS.map(mi => sum of Math.min(0, vals[item][mi]))
netByMonth     = inflowByMonth + outflowByMonth (per month)
cumulativeByMonth = running sum of netByMonth
troughIdx      = index of minimum cumulativeByMonth value
```

## Key Helpers (client-dashboard.tsx)

- `buildAssetGroups(assets)` → `BsSection[]` — two-level section hierarchy for balance sheet
- `buildLiabilityGroups(liabilities)` → `BsGroup[]` — flat groups for liability table
- `buildNWProjection(netWorth, cashFlows, assets)` → 6-point array `{ label, year, value }`
- `cashBuckets(assets)` → `{ reserve, yieldBucket, tactical, growth, alts, totalLiquid, ...items }`
- `buildForecast(cashFlows)` → 12-month forecast with cumulative net
- `computeTrough(forecastData)` → worst cumulative position
- `isChunkyEvent(cf)` → filters CashFlowTicker to taxes, education, bonus, travel ≥ $5K

## Development Notes

- All numeric values stored as `numeric` (Drizzle) which returns strings — always coerce with `Number()`
- `CF_MONTHS` date filters use `getUTCFullYear()` / `getUTCMonth()` (not local time)
- `CardCheckHeader` title prop is `React.ReactNode` (supports JSX/italic text)
- AI strategies are accumulated (not replaced) — each generation appends to existing strategies
- FIGMA DESIGNS: permanently rejected — never implement from Figma
- `ActiveView` type: `"dashboard" | "advisorbrief" | "financials" | "guru" | "moneymovement"`
