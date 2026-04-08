# GURU Financial — Core Product Definition

**One-Line Definition**
GURU is an always-on financial decisioning system that continuously allocates and moves capital to optimize outcomes across the personal balance sheet.

---

## What GURU Is (and Is Not)

**GURU is:**
- A decisioning engine for capital allocation
- A control layer that sits above financial accounts
- A system that orchestrates money movement over time
- The foundation for an operating system of money

**GURU is not:**
- A budgeting app
- A portfolio analytics tool
- A static planning tool
- A one-time recommendation engine

---

## The Core Problem

Today, financial lives are:
- Fragmented across accounts, products, and providers
- Full of idle or underutilized capital
- Managed periodically, not continuously
- Constrained by advisor time and limited visibility

As a result:
- Large portions of wealth remain unmanaged or inefficient
- Advisors cannot continuously optimize outcomes
- Money sits still when it should be working

---

## What GURU Does

### Continuous Capital Allocation

GURU continuously:

1. **Sees** — Aggregates all financial data into a unified, forward-looking view (net worth, cash flow, liquidity, liabilities)
2. **Decides** — Determines:
   - How much liquidity is required
   - Where capital should be allocated
   - Which products are optimal (after-tax, risk-adjusted)
3. **Moves** — Initiates and facilitates:
   - Rebalancing
   - Cash deployment
   - Ongoing money movement over time

This loop runs continuously — not quarterly, not manually.

---

## The Key Concept

**From advice → to decisioning → to execution → to autonomous money movement**

GURU closes the gap between:
- Insight
- Decision
- Action

---

## What Makes GURU Different

**Traditional systems:**
- Analyze data
- Provide recommendations
- Rely on humans to act

**GURU:**
- Analyzes
- Decides
- Initiates movement

---

## The Operating System Vision

GURU sits above all financial accounts as a control layer for capital.

Over time, it becomes: **The operating system for money movement**

A system that:
- Sees all capital
- Decides where it should go
- Directs how it moves
- Continuously optimizes outcomes

---

## Value to Advisors

GURU enables advisors to:
- **Activate dormant AUM** — Identify and deploy assets sitting in cash or outside portfolios
- **Scale client coverage** — Monitor and act across all clients continuously
- **Improve outcomes** — Keep more capital invested and working
- **Strengthen trust** — Proactively surface opportunities and take action

## Value to Clients

- More money working at all times
- Better returns without additional risk
- Coordinated financial decisioning across accounts
- Reduced fragmentation and inefficiency

---

## Core Principle for Product + Design

Every feature, screen, and interaction should reinforce:
- **GURU is deciding**, not just showing
- **GURU is acting**, not just recommending
- **GURU is continuous**, not periodic
- **GURU is simple on the surface, complex underneath**

---

## The GURU 5-Bucket Framework

GURU organizes a client's entire balance sheet into five strategic buckets. Each bucket has a distinct purpose, liquidity profile, and optimization objective. These are defined in code as `GURU_BUCKETS` (see `client-dashboard.tsx`).

### 1. Operating Cash (`reserve`)
**Color:** `#5a85b8` (slate blue)

Checking and instantly-accessible transaction accounts. This bucket is sized purely by **monthly cash expense coverage** — how many months of core outflows the client wants sitting in checking at all times. No yield optimization; this is a pure safety net.

**Sizing logic:**
> `Target = Monthly Core Expenses × Coverage Months`

GURU's default recommendation is **2 months** of coverage, but the advisor and client set this together. The client can dial the coverage target up or down; GURU recalculates the required balance and flags any excess as deployable to Liquidity Reserve.

- **Purpose:** Daily transaction float and immediate liquidity
- **Target:** Client-chosen months of expense coverage (GURU default: 2 months)
- **Input:** Monthly core expense run-rate
- **Yield:** < 0.1% (checking — no optimization)
- **Liquidity:** Instant (same-day ACH)
- **Risk:** None (FDIC insured)

---

### 2. Liquidity Reserve (`yield`)
**Color:** `#b8943f` (amber)

Capital preservation through periods of net outflow. Sized by **forward cumulative cash flow** — GURU projects net cash flow month-by-month and finds the deepest trough in the forecast window. The absolute value of that trough becomes the reserve floor: the minimum liquid balance required to ensure the client never runs short regardless of timing mismatches between income and expenses.

**Sizing logic:**
> `Target = |Trough of Cumulative Net Cash Flow| over the forecast horizon`

The advisor and client choose the forecast window (GURU default: 12–18 months). Excess above the trough is deployable to Capital Build or Investments.

- **Purpose:** Preserve capital through periods of net cash outflow
- **Target:** Absolute value of the cumulative cash flow trough over chosen horizon
- **Input:** Forward cumulative cash flow projection (inflows, outflows, one-time events)
- **Liquidity:** Same-day (T+0 / T+1)
- **Risk:** Very Low — instruments chosen to protect principal, not optimize yield

---

### 3. Capital Build (`tactical`)
**Color:** `#3da870` (green)

Capital earmarked for a **specific near-term expenditure** — a home down payment, a wedding, a business investment, a tax payment. The objective is to **protect and grow** this capital until the event date. The advisor and client choose how it is deployed: conservative instruments (short Treasuries, fixed income) for capital protection, or market-exposed strategies if the timeline and risk tolerance allow.

**Sizing logic:**
> `Capital Needed Today = Event Amount − Projected Net Cash Flow from Now to Event Date`

GURU works backward from the event: how much is needed at the event date, minus the net cash flow expected to accumulate between now and then. If the client already has $300,000 toward a $500,000 down payment in 18 months, and projects +$80,000 of net cash flow, the Capital Build target today is $420,000 — flagging a $120,000 gap.

Multiple capital events can be stacked; each gets its own sub-target with its own timeline. GURU continuously recomputes as cash flow projections update.

- **Purpose:** Protect and grow capital earmarked for a defined near-term expenditure
- **Target:** `Event Amount − Projected Net Cash Flow to Event Date`
- **Input:** Event amount, event date, projected net cash flow
- **Deployment:** Advisor/client choice — conservative (Treasuries, fixed income) to market-exposed depending on horizon and risk tolerance
- **Liquidity:** Days to weeks (T+2 to T+5)
- **Risk:** Low to Moderate — depends on deployment choice

---

### 4. Investment Portfolio (`growth`)
**Color:** `#5585ae` (blue)

Equities and retirement accounts managed for long-horizon compounded growth. CIO-managed. Not available for liquidity needs. 5–30 year horizon.

- **Purpose:** Long-term wealth compounding
- **Expected Return:** 6–8% gross (CIO target)
- **Horizon:** 5–30 years
- **Liquidity:** 2–5 days (T+2 settlement)
- **Risk:** Moderate–High (market risk)
- **Sub-categories:** Taxable equities, 401(k)/IRA/retirement accounts

---

### 5. Alternatives / Tracked Assets (`alternatives`)
**Color:** `#888888` (gray)

Illiquid or hard-to-rebalance holdings tracked for net worth but outside the GURU liquidity model. Includes three distinct sub-categories:

- **Real Estate** — Primary residence and investment properties. Values sourced from Zillow estimates. Net equity = Zillow value minus associated mortgages.
- **PE & Carry** — Private equity fund interests and carry vehicles. Valued at estimated FMV. Multi-year lock-ups, no bid market.
- **Deferred Comp / RSUs** — Goldman Sachs RSUs and deferred compensation awards. Unvested balances tracked at grant value. 10+ year horizon, illiquid until vesting.

- **Purpose:** Tracked for net worth; outside GURU active management
- **Horizon:** 10+ years
- **Liquidity:** Illiquid (no bid)
- **Risk:** High / Illiquid

---

### Bucket Color Constants (canonical — from `GURU_BUCKETS` in `client-dashboard.tsx`)

```typescript
const GURU_BUCKETS = {
  reserve:      { label: "Operating Cash",     color: "#5a85b8" },  // slate blue  — instant liquidity
  yield:        { label: "Liquidity Reserve",  color: "#b8943f" },  // amber gold  — same-day reserves
  tactical:     { label: "Capital Build",      color: "#3da870" },  // sage green  — near-term events
  growth:       { label: "Investments",        color: "#5585ae" },  // steel blue  — long-horizon growth
  alternatives: { label: "Other Assets",       color: "#888888" },  // neutral gray — illiquid / tracked
};

// Liabilities (not a GURU bucket — used in table/ledger only):
//   liab:  "#9b2020"  — consumer + mortgage
//   liabP: "#50287a"  — investment financing (PE capital calls)
```

**Rule:** Always use `GURU_BUCKETS` colors. Do not hardcode bucket colors anywhere in the UI — every card, table row, chart segment, badge, and legend entry must reference `GURU_BUCKETS[key].color`.

---

## Core Principle for Product + Design (continued)
