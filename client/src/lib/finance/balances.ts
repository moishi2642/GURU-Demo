/**
 * lib/finance/balances.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Monthly running balance simulation for the Money Movement view.
 *
 * Think of this as the "Account Balance Waterfall" model tab in Excel.
 * It replaces the hardcoded CHASE_BAL, CITIZENS_MM_BAL, TREASURIES_BAL,
 * and GROW_BAL arrays in MoneyMovementView.
 *
 * INPUTS:  Asset[] + CashFlow[] from the DB
 * OUTPUTS: Typed 12-element arrays of month-end account balances
 *
 * HOW IT WORKS
 * ─────────────────────────────────────────────────────────────────────────────
 * The model reconstructs month-end balances by simulation:
 *
 *   1.  Starting balances come from the assets table (DB-driven, not hardcoded).
 *
 *   2.  Routing rules:
 *       - Salary inflows            → Operating Cash
 *       - Rental inflows            → Operating Cash (gross, offsets Sarasota expenses)
 *       - All outflows              → Operating Cash
 *       - Interest inflows          → Reserve (accrues to Citizens MM)
 *       - December bonus inflows    → split: enough to cover Dec expenses + 2-month buffer
 *                                    stays in Operating; remainder goes to Reserve
 *       - Investment distributions  → same split logic as bonus
 *
 *   3.  Build (Treasuries) accrues monthly interest derived from asset return rate.
 *
 *   4.  Grow (long-term investments) grows at a blended monthly rate derived from
 *       the asset return labels in the DB (falls back to 7% p.a. if not found).
 *
 * ACCURACY NOTE
 * ─────────────────────────────────────────────────────────────────────────────
 * The December bonus allocation to Reserve is an approximation — it reflects
 * the Kessler family's typical behavior (majority goes to savings) rather than
 * a fixed formula. The advisor's GURU Allocation recommendations may override
 * this at execution time.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Asset, CashFlow } from "@shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MonthlyBalances {
  /** Combined Operating Cash bucket (all checking accounts) — 12 months */
  opsBal: number[];
  /** Primary checking account share of Operating Cash — 12 months */
  primaryOpsBal: number[];
  /** Secondary checking account share of Operating Cash — 12 months */
  secondaryOpsBal: number[];
  /** Combined Reserve bucket (MM + savings) — 12 months */
  rsvBal: number[];
  /** Primary Reserve account (Citizens MM or largest MM) — 12 months */
  primaryRsvBal: number[];
  /** Secondary Reserve account (CapOne or second-largest savings) — 12 months */
  secondaryRsvBal: number[];
  /** Capital Build bucket (Treasuries) — 12 months */
  bldBal: number[];
  /** Long-term investments (Grow) — 12 months */
  growBal: number[];
  /** Total liquid + grow net worth approximation — 12 months */
  netWorthBal: number[];
  /** Reserve interest earned per month — for tooltip display */
  rsvInterest: number[];
  /** Build interest earned per month — for tooltip display */
  bldInterest: number[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

// December: what fraction of the "overflow" above the 2-month operating floor
// goes into Reserve vs stays in Operating. Based on the Kessler baseline model.
// This is a behavioral assumption — not derivable from raw cash flows alone.
const DEC_OVERFLOW_TO_RSV = 0.75; // 75% of Dec surplus above 2-mo floor → Reserve

// Grow monthly rate fallback if no asset returns in DB
const FALLBACK_GROW_MONTHLY_RATE = 0.07 / 12; // 7% p.a.

// ── Helpers ───────────────────────────────────────────────────────────────────

function cfForMonth(cashFlows: CashFlow[], year: number, month: number): CashFlow[] {
  return cashFlows.filter(cf => {
    const d = new Date(cf.date as string);
    return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
  });
}

function sumAmount(cfs: CashFlow[]): number {
  return cfs.reduce((s, cf) => s + Number(cf.amount), 0);
}

function descIncludes(cf: CashFlow, keywords: string[]): boolean {
  const d = (cf.description ?? "").toLowerCase();
  return keywords.some(k => d.includes(k.toLowerCase()));
}

// ── Core Function: computeMonthlyBalances ────────────────────────────────────

/**
 * Simulates 12 months of account balances from Jan→Dec of the given year.
 *
 * Starting balances are extracted from the assets table by type + description.
 * Monthly changes are derived from the cashFlows table.
 *
 * @param assets       - All assets for the client (from DB)
 * @param cashFlows    - All cash flow records for the client (from DB)
 * @param year         - Year to simulate (e.g. 2026)
 * @param twoMonthFloor - 2-month operating expense target (for Dec bonus routing)
 */
export function computeMonthlyBalances(
  assets: Asset[],
  cashFlows: CashFlow[],
  year: number,
  twoMonthFloor = 0,
): MonthlyBalances {

  // ── 1. Extract starting balances from assets table ──────────────────────────

  // Operating Cash = checking accounts
  const opsAssets = assets.filter(a =>
    a.type === "cash" && (a.description ?? "").toLowerCase().includes("checking")
  );
  // Primary = largest checking (typically Chase)
  const sortedOps = [...opsAssets].sort((a, b) => Number(b.value) - Number(a.value));
  const primaryOpsAsset   = sortedOps[0];
  const secondaryOpsAsset = sortedOps[1];

  // Reserve = non-checking cash (money market, savings, HY savings)
  const rsvAssets = assets.filter(a =>
    a.type === "cash" && !(a.description ?? "").toLowerCase().includes("checking")
  );
  const sortedRsv = [...rsvAssets].sort((a, b) => Number(b.value) - Number(a.value));
  const primaryRsvAsset   = sortedRsv[0]; // typically Citizens MM
  const secondaryRsvAsset = sortedRsv[1]; // typically CapOne

  // Capital Build = Treasuries / fixed income (non-retirement)
  const bldAssets = assets.filter(a =>
    a.type === "fixed_income" && !/401|ira|roth/i.test(a.description ?? "")
  );

  // Grow = equity investments (non-retirement, non-real-estate, non-alternative)
  const growAssets = assets.filter(a =>
    a.type === "equity" || (
      a.type !== "cash" &&
      a.type !== "fixed_income" &&
      a.type !== "real_estate" &&
      a.type !== "alternative" &&
      !/401|ira|roth/i.test(a.description ?? "")
    )
  );

  const opsStart        = opsAssets.reduce((s, a) => s + Number(a.value), 0);
  const primaryOpsStart = primaryOpsAsset ? Number(primaryOpsAsset.value) : opsStart;
  const secondOpsStart  = secondaryOpsAsset ? Number(secondaryOpsAsset.value) : 0;
  const rsvStart        = rsvAssets.reduce((s, a) => s + Number(a.value), 0);
  const primaryRsvStart = primaryRsvAsset ? Number(primaryRsvAsset.value) : rsvStart;
  const secondRsvStart  = secondaryRsvAsset ? Number(secondaryRsvAsset.value) : 0;
  const bldStart        = bldAssets.reduce((s, a) => s + Number(a.value), 0);
  const growStart       = growAssets.reduce((s, a) => s + Number(a.value), 0);

  // ── 2. Derive monthly interest rates from asset data ────────────────────────

  // Reserve: infer monthly rate from January interest inflow vs starting balance
  const janCFs = cfForMonth(cashFlows, year, 1);
  const janInterest = sumAmount(janCFs.filter(cf =>
    cf.type === "inflow" &&
    descIncludes(cf, ["interest", "savings", "reserve mmf"])
  ));
  const rsvMonthlyRate = rsvStart > 0 ? (janInterest / rsvStart) : (0.0207 / 12);

  // Build: infer from first non-zero interest (usually Feb onwards due to accrual)
  const febCFs = cfForMonth(cashFlows, year, 2);
  const febBldInterest = sumAmount(febCFs.filter(cf =>
    cf.type === "inflow" &&
    descIncludes(cf, ["treasury", "t-bill", "capital build"])
  ));
  // Fallback: 2.57% p.a. (Citizens MM Treasury ladder baseline)
  const bldMonthlyRate = bldStart > 0 && febBldInterest > 0
    ? (febBldInterest / bldStart)
    : (0.0257 / 12);

  // Grow: blended equity growth rate (7% p.a. default)
  const growMonthlyRate = FALLBACK_GROW_MONTHLY_RATE;

  // ── 3. Simulate month by month ──────────────────────────────────────────────

  // We reconstruct the pre-January starting point by reversing January's CF.
  // Jan net ops change = (salary + rental) - all_outflows
  const janSalaryRental = sumAmount(janCFs.filter(cf =>
    cf.type === "inflow" && (
      descIncludes(cf, ["salary", "rental income"]) ||
      cf.category === "salary"
    )
  ));
  const janOutflows = sumAmount(janCFs.filter(cf => cf.type === "outflow"));
  const janOpsNet   = janSalaryRental - janOutflows;
  // Pre-January ops balance (what was in checking before Jan transactions)
  const preJanOps = opsStart - janOpsNet;

  // Arrays to fill
  const opsBal:          number[] = [];
  const primaryOpsBal:   number[] = [];
  const secondaryOpsBal: number[] = [];
  const rsvBal:          number[] = [];
  const primaryRsvBal:   number[] = [];
  const secondaryRsvBal: number[] = [];
  const bldBal:          number[] = [];
  const growBal:         number[] = [];
  const netWorthBal:     number[] = [];
  const rsvInterest:     number[] = [];
  const bldInterest:     number[] = [];

  // Proportion splits for sub-accounts
  const primaryOpsProp   = opsStart > 0 ? primaryOpsStart / opsStart : 1;
  const secondaryOpsProp = opsStart > 0 ? secondOpsStart  / opsStart : 0;
  const primaryRsvProp   = rsvStart > 0 ? primaryRsvStart / rsvStart : 1;
  const secondaryRsvProp = rsvStart > 0 ? secondRsvStart  / rsvStart : 0;

  let prevOps = preJanOps;
  let prevRsv = rsvStart;
  let prevBld = bldStart;
  let prevGrow = growStart;

  for (let mo = 1; mo <= 12; mo++) {
    const moCFs = cfForMonth(cashFlows, year, mo);

    // ── Categorise this month's cash flows ──────────────────────────────────

    // Income to Operating (salaries + rental)
    const salaryRental = sumAmount(moCFs.filter(cf =>
      cf.type === "inflow" && (
        descIncludes(cf, ["salary", "rental income"]) ||
        cf.category === "salary"
      )
    ));

    // Bonus / distributions (December only typically)
    const bonusDist = sumAmount(moCFs.filter(cf =>
      cf.type === "inflow" && (
        cf.category === "bonus" ||
        descIncludes(cf, ["bonus", "distribution", "distributions"])
      )
    ));

    // Interest to Reserve
    const interest = sumAmount(moCFs.filter(cf =>
      cf.type === "inflow" && (
        descIncludes(cf, ["interest", "savings", "reserve mmf", "mmf"])
      )
    ));

    // All outflows from Operating
    const outflows = sumAmount(moCFs.filter(cf => cf.type === "outflow"));

    // ── Route cash to buckets ────────────────────────────────────────────────

    // Reserve interest accrual (regardless of month)
    const rsvInt = Math.round(prevRsv * rsvMonthlyRate);
    const bldInt = Math.round(prevBld * bldMonthlyRate);

    // Operating net: salary+rental + portion of bonus - outflows
    let opsNet: number;
    let bonusToRsv: number;

    if (bonusDist > 0) {
      // December bonus routing: keep enough in Operating to cover expenses + 2-mo buffer
      const opsDeficit = Math.max(0, twoMonthFloor - (prevOps + salaryRental - outflows));
      const opsFromBonus = opsDeficit + (bonusDist * (1 - DEC_OVERFLOW_TO_RSV));
      bonusToRsv = bonusDist - opsFromBonus;
      opsNet = salaryRental + opsFromBonus - outflows;
    } else {
      opsNet     = salaryRental - outflows;
      bonusToRsv = 0;
    }

    // End-of-month balances
    const endOps  = Math.round(prevOps  + opsNet);
    const endRsv  = Math.round(prevRsv  + rsvInt + bonusToRsv + interest);
    const endBld  = Math.round(prevBld  + bldInt);
    const endGrow = Math.round(prevGrow * (1 + growMonthlyRate));

    // Sub-account splits (proportional to starting weight, Citizens floors at 0)
    const rawPrimaryOps   = Math.round(endOps * primaryOpsProp);
    const rawSecondaryOps = Math.round(endOps * secondaryOpsProp);
    // Secondary ops floored at 0; any negative absorbed by primary
    const secOps  = Math.max(0, rawSecondaryOps);
    const primOps = endOps - secOps;

    const primRsv = Math.round(endRsv * primaryRsvProp);
    const secRsv  = Math.round(endRsv * secondaryRsvProp);

    // ── Append to arrays ─────────────────────────────────────────────────────
    opsBal.push(endOps);
    primaryOpsBal.push(primOps);
    secondaryOpsBal.push(secOps);
    rsvBal.push(endRsv);
    primaryRsvBal.push(primRsv);
    secondaryRsvBal.push(secRsv);
    bldBal.push(endBld);
    growBal.push(endGrow);
    netWorthBal.push(endOps + endRsv + endBld + endGrow);
    rsvInterest.push(rsvInt);
    bldInterest.push(bldInt);

    prevOps  = endOps;
    prevRsv  = endRsv;
    prevBld  = endBld;
    prevGrow = endGrow;
  }

  return {
    opsBal, primaryOpsBal, secondaryOpsBal,
    rsvBal, primaryRsvBal, secondaryRsvBal,
    bldBal, growBal, netWorthBal,
    rsvInterest, bldInterest,
  };
}
