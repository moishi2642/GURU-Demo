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
Three realistic client profiles are seeded on first run:
- **Sarah Mitchell** (52, moderate risk) — $3.15M assets, $790K liabilities, HNW executive profile
- **James Okonkwo** (38, aggressive) — Growth phase, startup income, concentrated tech + angel investments
- **Eleanor & Robert Chen** (63, conservative) — Near-retirement, income-focused, bond-heavy portfolio

## Development Notes

- All numeric values stored as `numeric` (Drizzle) which returns strings — always coerce with `Number()`
- Cash flow forecast is computed client-side from monthly averages (monthly * 12 projected)
- Liquidity coverage uses `cash` + `fixed_income` as liquid asset types
- AI strategies are accumulated (not replaced) — each generation appends to existing strategies
