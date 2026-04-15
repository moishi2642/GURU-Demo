# GURU Demo — Refactor Brief

Prepared for the Cowork refactor session. This document covers what's well-designed, what's broken, and a prioritized plan to fix it — organized around Mari's three-layer mental model.

---

## Mari's Three Layers

```
1. DATABASE / SEED DATA     → schema.ts, routes.ts, seed functions
2. MODEL / ANALYTICS        → the GURU Intelligence engine (compute functions)
3. OUTPUTS                  → views, tabs, charts, the advisor brief
```

Every refactor decision should be evaluated against this hierarchy. Layer 2 is the intellectual property. Layers 1 and 3 serve it.

---

## What's Well-Designed

### The Schema (Layer 1)

The `accounts → assets` (container → holdings) hierarchy in `schema.ts` is correct and forward-looking. Key strengths:

- **`guruBucket` on accounts** — lets GURU's allocation logic diverge from the institution's account type. A Fidelity brokerage can hold both idle cash sweep (reserve bucket) and index ETFs (investments bucket). This is how the real world works and most fintech schemas get it wrong.
- **`isAdvisorManaged`** — cleanly separates advisor AUM from self-directed holdings. This drives the investment split narrative and will matter for the advisor dashboard.
- **`dataSource` field** — already models where data comes from (Plaid, Fidelity API, manual, Zillow). This is the right schema for the data aggregator even though it's not built yet.
- **Drizzle + Postgres + Zod validation** — solid stack, no migration headaches later.

One note: the `designSystem` export at the bottom of `schema.ts` doesn't belong there. It's UI concern, not data concern. Move it to a shared design tokens file when you refactor.

### The Compute Layer (Layer 2)

The core financial logic is sound. These functions are the GURU engine:

| Function | What It Does | Lines | Status |
|---|---|---|---|
| `computeCumulativeNCF()` | 12-month cumulative net cash flow, trough detection | ~60 | Clean, well-documented |
| `computeLiquidityTargets()` | Full liquidity model — trough, operating floor, reserve target, excess | ~110 | Clean, excellent comments |
| `computeReturnOptimization()` | Current vs. pro-forma AT income, pickup calculation | ~100 | Clean, tax logic is correct |
| `computeCashFlowKPIs()` | Annual income/expenses, burn rate, runway, coverage, median | ~30 | Clean wrapper |
| `cashBuckets()` | Asset classification into 5 GURU buckets | ~80 | Clean, matches targets logic |
| `computeMonthlyBucketInterest()` | Monthly interest income by bucket | ~20 | Clean |
| `buildForecast()` / `buildMonthMap()` | Monthly inflow/outflow aggregation from raw cashFlows | ~40 | Clean |
| `computeLiveMonthlyCF()` | Gross/net expenses, rental netting, base monthly expense | ~40 | Clean |

**What's right about these:**

- `computeLiquidityTargets` has a 40-line comment block that reads like a glossary. Every term is defined. Every formula is explicit. This is institutional-grade documentation and it's the reason the numbers are trustworthy.
- The trough-based reserve sizing correctly wraps months at year boundary (Nov trough → Dec + Jan outflows).
- Tax rates in `computeReturnOptimization` properly differentiate NYC combined rate (47%) from federal-only treasury rate (35%) from LTCG (20%). This is the kind of nuance a Goldman M&A person catches and an engineer wouldn't.
- `computeCashFlowKPIs` exists as a single entry point so views don't re-derive metrics. Good discipline.

**What needs attention:**

- `operatingTarget` has a fallback: `|| 63574` (line 914). If the cashFlows query returns empty, it silently uses a hardcoded Kessler value instead of surfacing an error. This is a landmine for any non-Kessler client.
- `goalSavings = capitalBuild` is marked TODO — it should be `max(0, eventAmount − projectedNCFtoEventDate)`. For the demo this is fine. For a real pilot it breaks immediately.
- `computeCumulativeNCF` rebuilds the entire P&L model row-by-row using `CF_PL_ROWS` and string-matching descriptions. This is tightly coupled to the seed data format. If a new client's expense descriptions don't match the hardcoded strings, the trough calculation silently returns wrong numbers.

### The Documentation

`GURU_METRICS.md`, `CONTEXT.md`, `GI_TABLE_RULES.md`, `ADVISOR_BRIEF_RULES.md` — this documentation suite is unusually strong for a 3-week-old prototype. Every KPI has a formula, a code location, a live/hardcoded status, and Kessler reference values. This is the kind of documentation that lets Claude (or a future engineer) make changes confidently without breaking the model. Keep maintaining these as the refactor progresses.

---

## The Problem

### Everything Is In One File

`client-dashboard.tsx` is 14,172 lines. It contains:

- ~600 lines of compute functions (Layer 2)
- ~200 lines of constants, types, color definitions
- ~200 lines of formatting helpers and utility functions
- ~13,000 lines of React components (Layer 3) — 15+ distinct views

This creates several real problems:

1. **Claude context window limits.** When the Cowork session is working on the Advisor Brief (line 8604), it can't see the compute functions (line 839) or the constants they depend on without burning context. This leads to accidental duplication and inconsistencies.

2. **Accidental coupling.** Views share inline helper functions that should be extracted. `cashBuckets()` and `computeLiquidityTargets()` have overlapping bucket classification logic that *must* stay in sync but lives in two separate function bodies.

3. **No testability.** The compute functions can't be unit tested because they're not importable. You can't write a test that says "given these assets and cashFlows, does `computeLiquidityTargets` return the correct Kessler values?" without importing from a 14K-line React component.

4. **Fragile hardcoded values.** Several views have their own hardcoded numbers that should come from the compute layer:
   - Line 914: `|| 63574` fallback in operatingTarget
   - Line 1831: Hardcoded sub-items in CashManagementPanel
   - Line 8244: Hardcoded liquid account balance forecast
   - Line 8652: Hardcoded days-idle-since-bonus
   - Line 11480: Hardcoded Zillow estimates

### The Constants Are Scattered

`CF_PL_ROWS`, `CF_MONTHS`, `GURU_BUCKETS`, `BUCKET_PRODUCTS`, `PROFORMA_AT`, tax rate constants — these are defined at various points throughout the file. Some are near the top, some are mid-file near the functions that use them. They should be in one place.

### Duplicate Bucket Classification

`cashBuckets()` (line 602) and `computeLiquidityTargets()` (line 839) both classify assets into Operating Cash / Liquidity Reserve / Capital Build using the same string-matching logic, but they're independently maintained. A comment on line 632 says "Matches computeLiquidityTargets() capitalBuild filter exactly" — the word "matches" means "we hope these stay in sync." That's a bug waiting to happen.

### Views Call Compute Functions Redundantly

`computeLiquidityTargets` is called independently in at least 10 different views (AdvisorBrief, GuruLanding, CashFlowForecast, DetectionSystem, BalanceSheet, AssetOverview, MoneyMovement, etc.). Each call recomputes the full model from scratch. For a demo with one client this is fine, but it's wasteful and it means if two views are on screen at once, they could theoretically show different numbers if the underlying data changes mid-render.

---

## Refactor Prioritization

### Phase 1 — Extract the Engine (Layer 2)

**Priority: Highest. Do this first.**

Create `client/src/lib/guru-engine.ts` containing:

```
── Constants ──────────────────────────────
  GURU_BUCKETS, CF_MONTHS, CF_PL_ROWS
  BUCKET_PRODUCTS, PROFORMA_AT
  Tax rate constants (BANK_TAX, TREAS_TAX, LTCG_TAX, etc.)
  DEMO_NOW, BONUS_DATE

── Bucket Classification (single source of truth) ──
  classifyAsset(asset) → bucket key
  cashBuckets(assets) → bucket totals + items

── Core Compute Functions ──────────────────
  computeCumulativeNCF(cashFlows)
  computeLiquidityTargets(assets, cashFlows, bonusDate?)
  computeReturnOptimization(assets, cashFlows?)
  computeCashFlowKPIs(cashFlows, totalLiquid)
  computeLiveMonthlyCF(cashFlows)

── Forecast Builders ──────────────────────
  buildMonthMap(cashFlows)
  buildForecast(cashFlows)
  buildNWTimeline(netWorth, cashFlows, assets)
  buildNWProjection(netWorth, cashFlows, assets)
  computeMonthlyBucketInterest(assets, cashFlows)
```

**Key rule:** `classifyAsset()` becomes the single function that determines bucket membership. Both `cashBuckets()` and `computeLiquidityTargets()` call it. No more duplicate string-matching.

**Validation:** After extraction, the app should behave identically. Every number on every tab should be unchanged. Run the app and spot-check the Kessler reference values from `GURU_METRICS.md`.

### Phase 2 — Extract Shared Utilities

Create `client/src/lib/format.ts`:

```
  fmtUSD(value)         — currency formatting (no abbreviations, to the dollar)
  fmtPct(value)         — percentage formatting
  fmtMonths(value)      — "X.X months" formatting
  parseYieldFromDesc()  — yield extraction from description strings
```

Create `client/src/lib/design-tokens.ts`:

```
  Color constants (institutional palette, bucket colors)
  Font constants (MONO, UI, SERIF)
  GI table tokens
  Advisor layer tokens
```

### Phase 3 — Split Views (Layer 3)

Split one view at a time. Each view becomes its own file under `client/src/views/` (or `client/src/pages/views/`). Start with whichever views are most actively being worked on.

Suggested order:

1. `DetectionSystemView` — it's the landing page and most visible
2. `AdvisorBriefView` — complex, has its own design rules doc
3. `CashFlowForecastView` — largest single view, heavily data-driven
4. `BalanceSheetView` — complex with nested helpers
5. `MoneyMovementView`
6. `GuruLandingView` / `GuruAllocationView`
7. Everything else (AssetOverview, BookOfBusiness, Onboarding, etc.)

**Each extracted view should:**
- Import compute functions from `guru-engine.ts`
- Import formatters from `format.ts`
- Import tokens from `design-tokens.ts`
- Export a single default component
- Move its own helper functions (like `acctMeta`, `GroupHead`, `AssetRow`) into the same file as private functions

### Phase 4 — Clean Up Hardcoded Values

After the engine is extracted and views are split, audit every remaining hardcoded value:

- Replace `|| 63574` fallback with proper error handling
- Wire the Zillow estimates through the data model
- Replace hardcoded forecast data in CashFlowAdvisorView with live compute calls
- Replace hardcoded days-idle and days-until-Fed with computed values from DEMO_NOW

---

## What NOT to Refactor Right Now

- **The database schema.** It's clean enough for the demo. Don't add complexity until the data aggregator is being built.
- **The server routes.** CRUD endpoints and seed data are fine. The Yahoo Finance proxy is a nice-to-have for the demo ticker.
- **The iframe-based Reallocation Calculator.** It works. Leave it until the core app is stable.
- **The design system.** The two-brand architecture (GI dark + Advisor warm) is well-documented and working. Don't change visual language during a refactor.

---

## Success Criteria

The refactor is done when:

1. `guru-engine.ts` exists as a standalone module with all compute functions and constants
2. Bucket classification has ONE code path (`classifyAsset`)
3. Every view imports from the engine — no view recomputes metrics locally
4. The app runs and all Kessler reference values from `GURU_METRICS.md` match
5. Claude (in any Cowork session) can work on a single view without loading the entire 14K-line file
