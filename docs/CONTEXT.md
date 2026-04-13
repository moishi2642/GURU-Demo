# GURU Financial — Product Context

## Read this at the start of every session.
## Also read: `GURU_PRODUCT.md` (core product definition — what GURU is, what it does, the decisioning loop)

---

## What GURU Is

GURU is a 24/7 capital allocation and financial decisioning system for the personal balance sheet built for financial advisors — not a consumer app. It is powered by a data aggregation system that sees across the entire financial life, building individualized cash flow forecasts from the data. This is then used to deliver prompts and strategic decisions to the advisor. GURU makes decisions easy and execution fast and seamless so advisors can grow AUM from existing clients but also scale their business. Money movement is key to GURU — data aggregation, AI-powered decisions, and automatic money movement. Getting money to work hard and sitting at the right place at the right time.

The user is a wealth manager at an RIA managing high-net-worth client portfolios. The end client likely has $1–$50mm of assets. The end client never touches this interface directly but may experience it through the advisor. The user should really never hear the name GURU.

**Never simplify this product down to consumer level. Simplicity in GURU means clarity of dense information, not reduction of information.**

---

## Target User

- Professional wealth advisor
- Managing HNW/UHNW clients (Kessler Family demo: ~$5M+ net worth)
- Expects: general ledger detail, rates, projections, coverage ratios, AT yield calculations
- Peer comparison: Addepar, Bloomberg, Orion — not Mint, Robinhood, or personal finance apps

---

## Product Principle

> "The intelligence is complex. The decision should be simple."

GURU runs sophisticated modeling (liquidity coverage, yield optimization, goal bridge analysis) and surfaces it as clear, actionable advisor decisions. The complexity must be **visible** — it is what justifies the recommendation. The action must be **frictionless** — 3 steps, nothing moves until approved.

---

## Two-Brand Architecture

GURU is built around two distinct visual and conceptual brands that always coexist. They represent two sides of the same product: the engine and the interface.

---

### Brand 1 — GURU Intelligence

**What it represents:** The engine room. GURU ingests raw financial data from all accounts and sources, runs sophisticated CFO-level analytics — liquidity coverage modeling, yield optimization, goal bridge analysis, allocation stress tests — and produces signals. This layer makes visible the depth and rigor of what's running underneath. The intelligence must be *felt* — it's what justifies the recommendation and what differentiates GURU from a simple dashboard.

**Visual language:**
- Background: `#0c1828` — deep navy, near-black
- Accent / signal color: `#44e08a` — bright institutional green (Bloomberg terminal feel)
- Numbers: JetBrains Mono, always monospace, 24px for primary metrics
- Signal names: ALL CAPS, bold, letter-spaced (e.g. `LQ-7`, `YO-3`)
- Left accent border: `3px solid #44e08a` on every signal row
- Badges: outlined, green border/text — `OPPORTUNITY`, `ACTION`, `WATCH`
- Data rows: small label / large mono value pairs
- Confidence bars, model IDs, data source labels — all visible, all intentional
- Tone: analytical, institutional, precise

**Peer references:** Bloomberg Terminal, Addepar, Aladdin (BlackRock), FactSet

**What it is NOT:** This is not a dark mode version of the advisor UI. It is a fundamentally different visual system — a signal arriving from a different world.

---

### Brand 2 — Advisor Layer

**What it represents:** The decision surface. This is where the complexity of GURU Intelligence is distilled into clear, human-readable decisions for the advisor. It is precise, editorial, and confident — like a private banking brief or a morning memo from a trusted CFO. The advisor layer never overwhelms; it presents one clear action with supporting context.

**Visual language:**
- Page background: `hsl(220,5%,93%)` — cool gray, all advisor tabs (Advisor Brief, Balance Sheet, Investments, Allocation)
- Cards: `#ffffff`, `border: 0.5px solid rgba(0,0,0,0.07)`, **no border-radius**, **no box-shadow**
- Card footer / GURU Insights area (`.bc-result`): `background: hsl(220,5%,97%)`, `border-top: 0.5px solid rgba(0,0,0,0.07)`
- Bucket cards: 4px solid colored top stripe (full bucket color, no opacity), followed by card header + stats rows + footer
- Headline font: **Playfair Display** — used for all editorial headlines, often italic for emphasis
  - Example: *"Your cash position has an opportunity."* or *"$221,000 is working below its potential."*
- Body/UI font: **Inter** — 400/500 weight, relaxed leading
- Numbers in this layer: Inter weight 300, tabular-nums, letter-spacing -0.025em, navy (`hsl(222,45%,12%)`)
- Accent color for positive outcomes: `#2e7a52` (green)
- Accent color for flags/alerts: `#9a7b3c` (gold)
- CTAs: dark navy filled buttons, rounded 4px, full-width or anchored bottom-right
- Step cards: white card, navy circle number, title + description + tag
- Tags: soft filled (not outlined) — `review`, `confirm`, `execute`
- Minimum font size: **10px** — no label, description, or data value may render smaller than 10px
- Tone: analytical, institutional, precise

**Card CSS spec (canonical — applies to all advisor tab cards):**
```css
/* Card container */
background: #FFFFFF;
border: 0.5px solid rgba(0,0,0,0.07);
border-radius: 0;              /* no radius */
box-shadow: none;
overflow: hidden;

/* 4px colored top stripe */
height: 4px;
background: <bucket-color>;   /* solid, no opacity */

/* Card header */
padding: 16px 18px 12px;
border-bottom: 0.5px solid rgba(0,0,0,0.07);

/* Stats rows */
padding: 0 18px;
border-bottom: 0.5px solid rgba(0,0,0,0.06);

/* GURU Insights footer (.bc-result) */
background: hsl(220,5%,97%);
border-top: 0.5px solid rgba(0,0,0,0.07);
padding: 10px 18px;
```

**Bucket card grid:**
```css
display: grid;
grid-template-columns: repeat(5, 1fr);
gap: 12px;
```
All 5 bucket cards display on a single row.

**Reference screen:** Balance Sheet tab bucket card layout — 4px colored top stripe per bucket, clean white card, cool gray page, no radius. This is the canonical Advisor Layer visual.

**What it is NOT:** Consumer finance. No emojis, no progress bars toward "goals," no motivational copy. This is a professional brief for a professional.

---

### The Narrative These Two Brands Tell Together

> GURU ingests everything. It runs the models. Then it gets out of the advisor's way.

When both layers appear on screen together (e.g. allocation landing, cashflow tab), the layout communicates a story:
- **Left (dark):** Here is what the intelligence found. Signal ID, model output, confidence, magnitude.
- **Right (linen):** Here is what you do about it. Three steps. Read-only first. Nothing moves until you approve.

The dark card validates the recommendation. The linen panel makes it actionable. Neither exists without the other.

---

## Design Language Reference

### Colors
- `--page-bg: hsl(220,5%,93%)` — Advisor Layer page background (all advisor tabs)
- `--card-bg: #FFFFFF` — Advisor Layer card background
- `--card-border: rgba(0,0,0,0.07)` — all card and panel borders (0.5px solid)
- `--footer-bg: hsl(220,5%,97%)` — card footer / GURU Insights area background
- `--navy: hsl(222,45%,12%)` — headings, CTAs, nav
- `--gold: #9a7b3c` — flag/problem numbers, advisor layer accents
- `--green: #2e7a52 / #5ecc8a` — opportunity, positive projections
- `--amber: #c47c2b` — action required, urgent signals
- `--ds-bg: #0c1828` — GURU Intelligence card/panel background
- `--ds-green: #44e08a` — GURU Intelligence accent (signals, badges, bars)

### Bucket Colors (GURU_BUCKETS constant — canonical)
| Bucket | Key | Color |
|---|---|---|
| Operating Cash | `reserve` | `#1E4F9C` |
| Liquidity Reserve | `yield` | `#835800` |
| Capital Build | `tactical` | `#195830` |
| Investments | `growth` | `#4A3FA0` |
| Alternatives | `alternatives` | `#5C5C6E` |

### Typography

**Advisor Layer** (linen environment — this is the canonical font system):
- Headlines: `'Playfair Display', Georgia, serif` — weight 400, italic available, letter-spacing -0.02em
- Body / UI: `'Inter', system-ui, sans-serif` — weights 300–600
- Numbers / balances: **Inter weight 300**, `font-variant-numeric: tabular-nums`, `letter-spacing: -0.025em` — NOT JetBrains Mono
- Account amounts: Inter weight 400, tabular-nums
- Eyebrow labels: Inter 9–10px, weight 700, ALL CAPS, letter-spacing 0.10–0.16em
- Taglines / descriptions: Inter 13px, weight 400, color rgba(0,0,0,0.55)

**GURU Intelligence Layer** (dark #0c1828 environment only):
- Numbers / data: `'JetBrains Mono'` — weights 300–500
- Labels / signal names: Inter, ALL CAPS, weight 700, letter-spacing 0.08–0.14em
- JetBrains Mono is EXCLUSIVE to the GURU Intelligence dark cards — never use it in the linen/advisor layer

---

## Current Tab Structure

**Left group (Advisor):**
- Advisor Brief (`advisorbrief`)
- Allocation (`guru`) — the main allocation workflow with GURU Intelligence card + 3-step process
- Allocation v1 (`guru_v1`) — legacy
- Investments (`investments`)

**Right group (GURU Intelligence):**
- Net Worth (`financials / balancesheet`)
- Cash Flow (`financials / cashflow`)
- Money Movement (`moneymovement`)

**Dashboard (default landing view — still live in app):**
- Net worth chart (line chart, historical trend)
- Summary stats strip
- This is the first screen the user sees on load. It has NOT been removed. Do not rebuild it unless asked.

**To add:**
- Asset Overview — bucket card layout (Advisor Layer brand), mockup at `Claude/asset-overview-mockup.html`

---

## Demo Client: Kessler Family

- Sarah & Michael Kessler
- ~$5M+ net worth, HNW
- Year-end bonus scenario: $299,966 idle cash
- Home purchase goal: June 2027, target $548K down payment
- Tax bracket: 37%

### Kessler Liquidity Reference Values (Jan–Dec 2026, from live seed data)

| Metric | Value |
|---|---|
| Trough Depth | $129,385 (November) — live from `computeCumulativeNCF()` |
| Operating Floor at Trough (Dec + Jan) | $107,716 |
| Reserve Target (Operating Cash + Liquidity Reserve requirement) | $237,101 |
| Liquidity Reserve Bucket Target (reserveTarget − operatingTarget) | $173,527 |
| Goal Savings (US Treasuries earmarked for home) | $135,000 |
| Total Liquidity Requirement | $372,101 |
| Operating Target (Jan + Feb after bonus) | $63,574 |

---

## Liquidity Calculation Methodology

See `GURU_METRICS.md` for full definitions and code locations.

### Bucket classification (single definition — `computeLiquidityTargets()` and `cashBuckets()` must match)
- **Operating Cash:** `type="cash"` AND description includes "checking" — instant liquidity, FDIC
- **Liquidity Reserve:** `type="cash"` AND NOT "checking" — savings, money market accounts, HY savings, T+0/T+1, FDIC
- **Capital Build:** `type="fixed_income"` AND NOT `/401|ira|roth/i` — Treasuries, T-bills, money market funds, CDs, munis

### Core formulas (all live from `cashFlows` + `assets`)
```
totalLiquid             = operatingCash + liquidityReserve + capitalBuild

troughDepth             = |min(cumulativeNCF[Jan…Dec])|   via computeCumulativeNCF()
operFloorAtTrough       = outflows(troughMonth+1) + outflows(troughMonth+2)
reserveTarget           = troughDepth + operatingFloorAtTrough   ← covers Operating Cash + Liquidity Reserve

liquidityReserveTarget  = reserveTarget − operatingTarget        ← target for Liquidity Reserve bucket only
                                                                    (operating account covers the first 2 months)

totalLiquidityReq       = reserveTarget + goalSavings
excessLiquidity         = totalLiquid − totalLiquidityReq
```

### Operating Target (today, sizes operating account only — NOT part of reserve target)
```
operatingTarget  = outflows(bonusMonth+1) + outflows(bonusMonth+2)
```
With bonus Dec 31 2025 → Jan 2026 + Feb 2026 outflows.

### Single source of truth: `computeLiquidityTargets(assets, cashFlows)`
Called by AdvisorBriefView, GuruLandingView, and CashFlowForecastView detection panel.
Do NOT recompute these locally in any view — always destructure from this function.

---

## Standing UI Rules (enforced by user)

- ✅ **Totals always appear BELOW their sub-lines.** Never use a bucket/category name + total as a header row above accounts. Account rows render first; the subtotal row renders after (below) them. This applies to every table, ledger, or grouped list in the app.

- ✅ **`investmentsTotal` is the single source of truth for the Investments bucket.** Defined once at the top of `BalanceSheetView`'s totals section as `investmentsTotal = growTotal + cryptoTotal`. Used in the Investments BSBucketCard and in the detail ledger panel 2. Never recompute this inline elsewhere.

- ✅ **Minimum font size is 10px** throughout all advisor tab cards. No label, description, data value, or footnote may render smaller than 10px.

- ✅ **Advisor tab page background is `hsl(220,5%,93%)`** (cool gray) — applies to Advisor Brief, Balance Sheet, Investments, and Allocation tabs. The Allocation landing page dark pane (`#0d2044` gradient) is hardcoded inline and is exempt.

---

## What NOT To Do

- ❌ Don't use linen (`#f0ece5`) as the Advisor Layer page background — it has been replaced by `hsl(220,5%,93%)` (cool gray)
- ❌ Don't add border-radius or box-shadow to advisor tab cards — cards are flat white with a 0.5px border only
- ❌ Don't strip numbers out to make it "cleaner" — density is appropriate for this audience
- ❌ Don't use consumer finance language ("your money," "goals," "savings jar")
- ❌ No abbreviations anywhere in the UI — write out full names always. "Money Market Fund" not "MMF", "Treasury" not "TSY", "basis points" not "bps" in copy, etc. This applies to account names, labels, descriptions, and data rows. Specific banned abbreviations: "AT" → always write "After-Tax"; "Pre-Tax" is acceptable written out in full; never "YTM", "TY", "NCF", "CF" in UI-facing labels.
- ❌ Never abbreviate dollar amounts — always show to the dollar. "$4,564,696" not "$4.6M", "$87,432" not "$87K". No rounding, no shorthand.
- ✅ On the Allocation tab, GURU Intelligence is deliberately woven into the advisor layer — it should feel like an insight arriving directly from the intelligence engine, not a separate section. The dark card is not decorative; it is the reason the advisor is being asked to act.
- ❌ Don't skip steps in the allocation workflow — each step has a specific trust-building purpose
- ❌ Don't make the allocation landing page vertical-only — the app is horizontal/landscape
- ❌ Don't remove the model ID / signal confidence from GURU cards — that's what builds trust

---

## Key Files

- `client/src/pages/client-dashboard.tsx` — main app (~9600 lines), all views live here
- `client/public/allocation-tab-mockup.html` — Step 1 iframe with live calculator
- `client/public/alloc-v1-original.html` — Allocation v1 iframe
- `shared/schema.ts` — database schema (clients, assets, liabilities, cashFlows, strategies)
- `server/routes.ts` — API routes + migrations
- `server/db.ts` — Neon/Postgres connection with retry logic

## Key Mockups (in Claude folder)
- `alloc-landing-horizontal.html` — approved allocation landing page design (3 scenarios)
- `alloc-landing-scenarios.html` — vertical scenario exploration (superseded by horizontal)
