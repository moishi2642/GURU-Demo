# GURU Financial — Metrics Reference

All named KPIs, definitions, formulas, current code location, and live/hardcoded status.

---

## Data Sources

All metrics derive from two live data sources:

- **`cashFlows: CashFlow[]`** — every inflow and outflow for the client, Jan–Dec 2026
- **`assets: Asset[]`** — current account balances across all buckets

`CF_MONTHS` and `CF_PL_ROWS` are file-level constants in `client-dashboard.tsx` that define the 12-month window and row-to-description mappings used by the CF tab P&L model.

---

## Cash Flow KPIs

These are computed inside `CashFlowForecastView` from live `cashFlows`.
The `computeCumulativeNCF(cashFlows)` function at file level extracts the same
logic so other panels can use the trough without duplicating the calculation.

---

### Annual Net Cash Flow
**Definition:** Total net cash position change over the 12-month forecast window.
Positive = cash-flow surplus year (bonus exceeds total spend).
Negative = cash-flow deficit year.

```
Annual Net Cash Flow = sum(netByMonth[Jan … Dec])
                     = sum(inflows) − sum(outflows)
```

**Code:** `annualNet` — computed from `netByMonth` inside `CashFlowForecastView`
**Status:** ✅ Live — derived from `cashFlows`

---

### Annual Income (Post-Tax / Net)
**Definition:** Total cash received across all inflow categories for the year —
salaries, bonuses, rental income, interest. These are NET figures (post-tax)
because the cashFlows data records what actually hits bank accounts.

```
Annual Net Income = sum(cashFlows where type="inflow", Jan–Dec)
```

**Code:** `totalIn` — computed from `monthlyInflows` inside `CashFlowForecastView`
**Status:** ✅ Live

---

### Annual Income (Pre-Tax) — MOCKUP ONLY
**Definition:** Gross earned income before tax. Not currently in the data model —
cashFlows records net/post-tax figures only. The mockup shows $856,000, which
approximates `totalIn / (1 − effectiveTaxRate)` using ~42% combined rate.

```
Annual Income (Pre-Tax) ≈ Annual Net Income / (1 − effectiveTaxRate)
```

**Code:** ❌ Not implemented — hardcoded in `cashflow-layout-mockup.html`
**To implement:** Requires either gross salary fields in the data model, or a
client-level effective tax rate parameter applied to `totalIn`.

---

### Total Annual Expenses
**Definition:** Sum of all cash outflows for the year — housing, living expenses,
taxes, education, travel, debt service, one-time items.

```
Total Annual Expenses = sum(cashFlows where type="outflow", Jan–Dec)
```

**Code:** `totalOut` — computed from `monthlyOutflows` inside `CashFlowForecastView`
**Status:** ✅ Live
**Kessler value:** ~$449,623 (not $612,000 — the mockup figure is stale/hardcoded)

---

### Coverage Ratio
**Definition:** How well annual income covers annual expenses. 100% = breakeven.
Above 100% = surplus year. Below 100% = deficit year (spend exceeds income).

```
Coverage Ratio = (Annual Net Income / Total Annual Expenses) × 100
```

**Code:** `heroCoveragePct = (totalIn / totalOut) * 100` in `CashFlowForecastView`
**Status:** ✅ Live

---

### Monthly Burn
**Definition:** Average monthly cash outflow across the year. The baseline rate
at which cash is consumed absent any inflows.

```
Monthly Burn = Total Annual Expenses / 12
```

**Code:** `heroMonthlyBurn = totalOut / 12` in `CashFlowForecastView`
**Status:** ✅ Live

---

### Cash Runway
**Definition:** How many months of current spending the total liquid position covers.
Answers: if all inflows stopped today, how long before cash runs out?

```
Cash Runway = totalLiquid / Monthly Burn
```

**Code:** `heroRunway = totalLiquid / heroMonthlyBurn` in `CashFlowForecastView`
**Status:** ✅ Live — uses `totalLiquid` from `cashBuckets(assets)`

---

### Median Monthly Cash Flow
**Definition:** The 50th percentile monthly net cash flow. More stable than average
because it excludes the December bonus spike. Represents a typical month's
net position (usually negative, since most months are deficit until bonus).

```
Median Monthly Cash Flow = median(netByMonth[Jan … Dec])
```

**Code:** `medianNet` — computed in KPI table section of `CashFlowForecastView`
**Status:** ✅ Live

---

### Cash Flow Trough
**Definition:** The deepest cumulative cash deficit projected over the 12-month
window. This is the floor — the maximum cash drawdown before the next bonus
recovery. Single source of truth for all liquidity sizing.

```
Trough Value = min(cumulativeByMonth[Jan … Dec])
Trough Depth = |Trough Value|
Trough Month = CF_MONTHS[troughIdx].label
```

where `cumulativeByMonth[i] = sum(netByMonth[0 … i])` starting from 0 post-bonus.

**Code:**
- `heroTroughValue = Math.min(...cumulativeByMonth)` — in `CashFlowForecastView` (display)
- `computeCumulativeNCF(cashFlows)` — file-level, returns `{ troughIdx, troughDepth, cumulativeByMonth, netByMonth }`
- Called by `computeLiquidityTargets()` for all downstream sizing

**Status:** ✅ Live in React app — ❌ Hardcoded in `cashflow-layout-mockup.html`
**Kessler value:** −$129,385 in November (live from `computeCumulativeNCF()`)

---

## Liquidity KPIs

These are computed by `computeLiquidityTargets(assets, cashFlows)` at file level.
Called by: AdvisorBriefView, GuruLandingView, CashFlowForecastView detection panel.

---

### Bucket Definitions

| Bucket | Filter on `assets` | Liquidity | Yield | Protection |
|---|---|---|---|---|
| **Operating Cash** | `type="cash"` + description includes "checking" | Instant | None | FDIC |
| **Liquidity Reserve** | `type="cash"` + NOT "checking" | T+0 / T+1 | Optimized | FDIC |
| **Capital Build** | `type="fixed_income"` + NOT 401k / IRA / Roth | T+2 to T+5 | Higher | Market |

```typescript
operatingCash    = assets[type="cash", checking]
liquidityReserve = assets[type="cash", NOT checking]   // savings, MM accounts, HY savings
capitalBuild     = assets[type="fixed_income", NOT retirement]  // Treasuries, T-bills, MMFs, CDs, munis
totalLiquid      = operatingCash + liquidityReserve + capitalBuild
```

---

### Operating Target (today)
**Definition:** The cash the operating account needs to hold right now — 2 months
of outflows immediately following the bonus landing date. Sized for today,
not the trough.

```
Operating Target = outflows(bonusMonth+1) + outflows(bonusMonth+2)
```
With bonus Dec 31 2025: Jan 2026 ($40,537) + Feb 2026 ($23,037) = **$63,574**

**Code:** `operatingTarget` in `computeLiquidityTargets()`

---

### Operating Floor at Trough
**Definition:** The cash the operating account needs AT THE TROUGH MOMENT — same
2-month-forward methodology as Operating Target, but anchored to the trough
month instead of today. This is what the reserve must cover for the client to
stay solvent through the trough period before the next bonus.

```
Operating Floor at Trough = outflows(troughMonth+1) + outflows(troughMonth+2)
```
Trough = November → Dec 2026 ($67,179) + Jan 2026 ($40,537) = **$107,716**

**Code:** `operatingFloorAtTrough` in `computeLiquidityTargets()`

---

### Reserve Target
**Definition:** 12-month liquidity required across the two bank-deposit buckets —
Operating Cash and Liquidity Reserve. Covers the worst-case cash deficit through
the year plus the operating buffer at the trough moment. Capital Build (Goal Savings)
is separately accounted for; together they form the Total Liquidity Requirement.

```
reserveTarget + goalSavings = Total Liquidity Requirement   (all 3 buckets)
```

**Important:** `reserveTarget` is NOT the Liquidity Reserve bucket's individual target.
See `liquidityReserveTarget` below for that.

```
Reserve Target = Trough Depth + Operating Floor at Trough
```
$129,385 + $107,716 = **$237,101**

**Code:** `reserveTarget` in `computeLiquidityTargets()`

---

### Liquidity Reserve Target
**Definition:** The target balance for the Liquidity Reserve bucket specifically.
The Operating Cash bucket already covers the 2-month `operatingTarget`,
so the Liquidity Reserve bucket covers only the remaining shortfall.

```
Liquidity Reserve Target = Reserve Target − Operating Target
```
$237,101 − $63,574 = **$173,527**

**Code:** `liquidityReserveTarget` in `computeLiquidityTargets()`

---

### Goal Savings
**Definition:** Capital earmarked for a defined near-term expenditure (home
purchase, business investment, etc.). Currently equals the Capital Build
balance — Treasuries already deployed toward the goal.

For a new client with no fixed income, this is $0 automatically.

```
Goal Savings = capitalBuild      // current: Treasuries earmarked for home purchase
```

TODO: derive properly as `max(0, eventAmount − projectedNCFtoEventDate)`

**Code:** `goalSavings` in `computeLiquidityTargets()`
**Kessler value:** $135,000 (US Treasuries)

---

### Total Liquidity Requirement
**Definition:** Everything the client needs to hold for liquidity purposes —
12-month coverage plus goal savings.

```
Total Liquidity Requirement = Reserve Target + Goal Savings
```
$237,101 + $135,000 = **$372,101**

**Code:** `totalLiquidityReq` in `computeLiquidityTargets()`

---

### Excess Liquidity
**Definition:** How much cash could be redeployed to investments today without
compromising 12-month coverage or near-term goals.

```
Excess Liquidity = Total Liquid − Total Liquidity Requirement
```

**Code:** `excessLiquidity` in `computeLiquidityTargets()`

---

### Operating Excess
**Definition:** How much excess is specifically in the operating bucket above
its 2-month target.

```
Operating Excess = max(0, operatingCash − operatingTarget)
```

---

### Reserve Excess
**Definition:** How much excess is in the Liquidity Reserve bucket above its
own bucket target (NOT above the full reserveTarget). Capital Build is a
separate bucket and is not included.

```
Reserve Excess = max(0, liquidityReserve − liquidityReserveTarget)
             = max(0, liquidityReserve − (reserveTarget − operatingTarget))
```

**Code:** `reserveExcess` in `computeLiquidityTargets()`

---

### Monthly Rate
**Definition:** Average monthly outflow derived from the Operating Target.
Used for coverage ratio and runway calculations.

```
Monthly Rate = Operating Target / 2
```
$63,574 / 2 = **$31,787/month**

---

### Coverage Months (Liquidity)
**Definition:** How many months the total liquid position covers at the current
monthly outflow rate.

```
Coverage Months = Total Liquid / Monthly Rate
```
$693,636 / $31,787 = **21.8 months**

---

## Income Optimization KPIs

These are computed by `computeReturnOptimization(assets)` at file level.
Called by: AdvisorBriefView, NetWorthPanel, CashFlowForecastView, GuruAllocationView.

The function iterates **every liquid, non-retirement account** and computes the
current after-tax yield alongside the best available GURU product yield for that
bucket. The **Income Pickup** is the delta between pro-forma and current — it is
**not** just the total optimized return.

**Accounts included:** `type="cash"`, `type="fixed_income"` (non-retirement), `type="equity"` (non-retirement, non-RSU/carry)
**Accounts excluded:** `real_estate`, `alternative`, retirement (401k/IRA/Roth), unvested equity (RSU/carry)

---

### Tax Rates

| Asset Class | Tax Treatment | Rate |
|---|---|---|
| Cash interest, savings, MM, fixed income | Ordinary income | 35% blended effective |
| Checking | Effective AT baseline | 0% additional (0.80% used as net) |
| Equity / investment portfolio | Long-term capital gains | 20% |

---

### Current Annual AT Income

**Definition:** Sum of after-tax annual income across all eligible accounts at their
current yield rates.

```
For each account:
  Checking:       currentATYield = 0.80%  (effective AT rate, no additional tax)
  Savings / MM:   currentATYield = grossYield × (1 − 35%)
  Fixed income:   currentATYield = grossYield × (1 − 35%)
  Equity:         currentATYield = 10.00% × (1 − 20%) = 8.00%

currentATIncome per account  = balance × currentATYield
currentAnnualIncome          = sum(currentATIncome across all accounts)
```

**Kessler account breakdown (current):**

| Account | Balance | Gross Yield | AT Yield | AT Income/yr |
|---|---|---|---|---|
| Chase Total Checking | $25,050 | 0.80% | 0.80% | $200 |
| Citizens Checking (Excess) | $107,000 | 0.80% | 0.80% | $856 |
| Citizens Private Bank MM | $225,000 | 3.65% | 2.37% | $5,333 |
| CapitalOne 360 Savings | $15,000 | 3.78% | 2.46% | $369 |
| Fidelity Cash Sweep (Idle) | $186,586 | 2.50% | 1.63% | $3,032 |
| US Treasuries | $135,000 | 3.95% | 2.57% | $3,467 |
| Cresset Capital (advisor) | $814,877 | 10.00% | 8.00% | $65,190 |
| Schwab Intl Index ETF | $116,538 | 10.00% | 8.00% | $9,323 |
| E*Trade — Meta (single) | $238,311 | 10.00% | 8.00% | $19,065 |
| E*Trade — BofA (single) | $60,000 | 10.00% | 8.00% | $4,800 |

**Kessler total current AT income: ~$111,635/yr**

**Code:** `currentAnnualIncome` returned by `computeReturnOptimization(assets)`

---

### Pro-Forma Annual AT Income

**Definition:** Same balances, but each account's yield is replaced with the
best available GURU product for that GURU bucket. Equity accounts are unchanged
(already in the investment portfolio at 10% gross).

**Best-product AT yields by bucket (pro-forma):**

| Bucket | Best Product | Pro-Forma AT Yield |
|---|---|---|
| Operating Cash (checking) | — operational constraint | 0.80% AT |
| Liquidity Reserve (savings/MM) | Cresset Short Duration | 5.40% AT (6.10% gross) |
| Capital Build (fixed income) | Cresset Short Duration | 5.40% AT (6.10% gross) |
| Taxable Equity (investments) | Investment portfolio | 8.00% AT (10% gross, 20% LTCG) |

```
proformaATIncome per account  = balance × PROFORMA_AT[bucket]
proformaAnnualIncome          = sum(proformaATIncome across all accounts)
```

**Kessler total pro-forma AT income: ~$129,760/yr**

**Code:** `proformaAnnualIncome` returned by `computeReturnOptimization(assets)`

---

### Annual Income Pickup

**Definition:** The true delta — how much more after-tax income the client
would receive annually under the optimized scenario vs. the current state.
This is NOT the total optimized return; it is the incremental gain.

```
Annual Income Pickup = proformaAnnualIncome − currentAnnualIncome
```

~$129,760 − ~$111,635 = **~$18,125/yr**

The pickup comes entirely from the savings, MM, and fixed income accounts
being redeployed to higher-yield products (Cresset Short Duration at 5.40% AT).
Equity accounts contribute zero to the pickup because they are already assumed
at the investment portfolio rate (8.00% AT) in both scenarios.

**Code:** `annualPickup` returned by `computeReturnOptimization(assets)`

---

## Status Summary

| KPI | Live in React? | In Mockup HTML? | Source |
|---|---|---|---|
| Annual Net Cash Flow | ✅ | — | `cashFlows` via `netByMonth` |
| Annual Income (Net) | ✅ | — | `cashFlows` |
| Annual Income (Pre-Tax) | ❌ hardcoded | $856,000 | Needs gross income data |
| Total Annual Expenses | ✅ | $612,000 wrong | `cashFlows` |
| Coverage Ratio | ✅ | hardcoded | `totalIn / totalOut` |
| Monthly Burn | ✅ | hardcoded | `totalOut / 12` |
| Cash Runway | ✅ | hardcoded | `totalLiquid / monthlyBurn` |
| Median Monthly Cash Flow | ✅ | hardcoded | `median(netByMonth)` |
| Cash Flow Trough | ✅ React, ❌ mockup | $129,385 wrong | `computeCumulativeNCF()` |
| Operating Target | ✅ | — | `computeLiquidityTargets()` |
| Operating Floor at Trough | ✅ | — | `computeLiquidityTargets()` |
| Reserve Target | ✅ | — | `computeLiquidityTargets()` |
| Goal Savings | ✅ | — | `capitalBuild` (TODO: goal bridge) |
| Total Liquidity Requirement | ✅ | — | `computeLiquidityTargets()` |
| Excess Liquidity | ✅ | — | `computeLiquidityTargets()` |
| Operating Excess | ✅ | — | `computeLiquidityTargets()` |
| Reserve Excess | ✅ | — | `computeLiquidityTargets()` |
| Current Annual AT Income | ✅ | — | `computeReturnOptimization()` |
| Pro-Forma Annual AT Income | ✅ | — | `computeReturnOptimization()` |
| Annual Income Pickup | ✅ | — | `computeReturnOptimization()` |

---

## What Goes in CONTEXT.md

The following section should be added to `CONTEXT.md` under the Kessler Family block:

```markdown
## Liquidity Calculation Methodology

See `GURU_METRICS.md` for full definitions.

### Bucket classification
- Operating Cash:    type="cash" + "checking"
- Liquidity Reserve: type="cash" + NOT "checking"
- Capital Build:     type="fixed_income" + NOT "401|IRA|Roth"

### Core formulas (all live from cashFlows)
- Trough Depth = |min(cumulativeNCF)| — computeCumulativeNCF()
- Reserve Target = Trough Depth + Operating Floor at Trough
- Operating Floor at Trough = outflows(troughMonth+1) + outflows(troughMonth+2)
- Total Liquidity Requirement = Reserve Target + Goal Savings
- Excess Liquidity = Total Liquid − Total Liquidity Requirement

### Kessler reference values (from seed data, Jan–Dec 2026)
- Trough: −$125,096 in November
- Operating Floor at Trough (Dec+Jan): $107,716
- Reserve Target: $232,812
- Goal Savings (US Treasuries): $135,000
- Total Liquidity Requirement: $367,812
- Total Liquid: $693,636
- Excess Liquidity: $325,824

### Known issues
- cashflow-layout-mockup.html has hardcoded $129,385 trough — wrong, needs wiring
- Annual Income (Pre-Tax) not in data model — needs gross income fields or tax rate param
- DashboardFlowWidget has hardcoded $129,385 — needs assets/cashFlows props
```
