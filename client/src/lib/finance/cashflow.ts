/**
 * lib/finance/cashflow.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ALL cash flow calculation logic lives here.
 *
 * Think of this as the "Cash Flow Model Tab" in an Excel model.
 * It takes raw transaction records from the database and produces
 * clean, typed outputs that views can consume directly.
 *
 * INPUTS:  CashFlow[] — raw records from the cash_flows DB table
 * OUTPUTS: Typed objects with 12-month arrays and summary figures
 *
 * No display code. No hardcoded client names. No React.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { CashFlow, CfCategoryRule } from "@shared/schema";

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun",
                      "Jul","Aug","Sep","Oct","Nov","Dec"] as const;

// "Plain" months = no large one-time items (bonus, taxes, travel).
// Used to compute the baseline monthly expense.
// Mar (2), Sep (8), Oct (9) are clean regular-expense months.
const BASELINE_MONTHS = [2, 8, 9];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MonthlyCF {
  /** Gross outflows per month (positive number = money going out) */
  grossOutflow: number[];
  /** Gross inflows per month (positive number = money coming in) */
  grossInflow: number[];
  /** Rental income per month, broken out separately */
  rentalInflow: number[];
  /**
   * Net expenses per month = grossOutflow − rentalInflow
   * Matches Excel Row 63 "Cash Expenses" which nets rental income
   * against Florida property expenses.
   */
  netExpenses: number[];
  /** Net cash flow per month = grossInflow − grossOutflow */
  netCashFlow: number[];
  /**
   * Baseline monthly expense — the "normal month" cost of running this household.
   * Computed as the average of BASELINE_MONTHS (months with no large one-time items).
   * Used for bucket coverage calculations (2-month operating floor, 12-month reserve).
   */
  baseMonthlyCFExpense: number;
}

export interface CFRowValues {
  /** key → 12-element array of monthly values (signed: income positive, expense negative) */
  [key: string]: number[];
}

// ── Core Function: buildMonthMap ──────────────────────────────────────────────

/**
 * Groups raw cash flow records into a map keyed by "MMM yy" (e.g. "Jan 26").
 * Returns { inflow, outflow } totals per month.
 * This is the foundation all other calculations build on.
 */
export function buildMonthMap(cashFlows: CashFlow[]): Record<string, { inflow: number; outflow: number }> {
  const map: Record<string, { inflow: number; outflow: number }> = {};
  for (const cf of cashFlows) {
    const d = new Date(cf.date as string);
    const yr  = d.getUTCFullYear().toString().slice(2); // "26"
    const mon = MONTH_LABELS[d.getUTCMonth()];          // "Jan"
    const key = `${mon} ${yr}`;
    if (!map[key]) map[key] = { inflow: 0, outflow: 0 };
    if (cf.type === "inflow")  map[key].inflow  += Number(cf.amount);
    if (cf.type === "outflow") map[key].outflow += Number(cf.amount);
  }
  return map;
}

// ── Core Function: computeMonthlyCF ──────────────────────────────────────────

/**
 * Main cash flow calculation function.
 *
 * Takes raw DB records → returns typed monthly arrays for the current year.
 * Previously hardcoded as static arrays in MoneyMovementView and BalanceSheetView.
 */
export function computeMonthlyCF(cashFlows: CashFlow[]): MonthlyCF {
  const map  = buildMonthMap(cashFlows);
  const year = new Date().getUTCFullYear().toString().slice(2); // dynamic year

  const key = (m: number) => `${MONTH_LABELS[m]} ${year}`;

  const grossOutflow = Array.from({ length: 12 }, (_, i) =>
    Math.round(map[key(i)]?.outflow ?? 0)
  );
  const grossInflow = Array.from({ length: 12 }, (_, i) =>
    Math.round(map[key(i)]?.inflow ?? 0)
  );

  // Rental income broken out so it can offset Florida property expenses
  const rentalInflow = Array.from({ length: 12 }, (_, i) => {
    return cashFlows
      .filter(cf => {
        const d = new Date(cf.date as string);
        return (
          cf.type === "inflow" &&
          d.getUTCFullYear() === 2000 + Number(year) &&
          d.getUTCMonth() === i &&
          (cf.description ?? "").toLowerCase().includes("rental")
        );
      })
      .reduce((sum, cf) => sum + Number(cf.amount), 0);
  });

  // Net expenses net out rental income (matches Excel "Cash Expenses" row)
  const netExpenses = Array.from({ length: 12 }, (_, i) =>
    grossOutflow[i] - rentalInflow[i]
  );

  const netCashFlow = Array.from({ length: 12 }, (_, i) =>
    grossInflow[i] - grossOutflow[i]
  );

  const baseMonthlyCFExpense = Math.round(
    BASELINE_MONTHS.reduce((sum, i) => sum + netExpenses[i], 0) / BASELINE_MONTHS.length
  );

  return { grossOutflow, grossInflow, rentalInflow, netExpenses, netCashFlow, baseMonthlyCFExpense };
}

// ── Core Function: computeCFRowValues ────────────────────────────────────────

/**
 * Computes monthly values for every row defined in cfCategoryRules.
 *
 * This replaces the inline CF_PL_ROWS computation in CashFlowForecastView.
 * Rules come from the DB (cf_category_rules table) instead of being hardcoded.
 *
 * Returns a map of { key → [12 monthly values] }.
 * Income rows are positive. Expense rows are negative (money going out).
 * Total/subtotal rows are computed by summing their `sumOf` references.
 */
export function computeCFRowValues(
  cashFlows: CashFlow[],
  rules: CfCategoryRule[]
): CFRowValues {
  const year = new Date().getUTCFullYear();
  const vals: CFRowValues = {};

  // Pass 1: compute all "row" kind entries by matching descriptions
  for (const rule of rules) {
    if (rule.kind !== "row") continue;

    const patterns = (rule.matchDescs as string[] | null) ?? [];
    const cfType   = rule.cfType ?? null;

    const monthly = Array.from({ length: 12 }, (_, month) => {
      const matches = cashFlows.filter(cf => {
        const d = new Date(cf.date as string);
        if (d.getUTCFullYear() !== year) return false;
        if (d.getUTCMonth() !== month)    return false;
        if (cfType && cf.type !== cfType)  return false;
        const desc = (cf.description ?? "").toLowerCase();
        return patterns.some(p => desc.includes(p.toLowerCase()));
      });
      const total = matches.reduce((sum, cf) => sum + Number(cf.amount), 0);
      // Outflows stored as negative so arithmetic works naturally
      return rule.cfType === "outflow" ? -total : total;
    });

    vals[rule.key] = monthly;
  }

  // Pass 2: compute totals/subtotals by summing referenced rows
  // May need multiple passes if totals reference other totals
  const totalRules = rules.filter(r => r.kind === "total" || r.kind === "subtotal");
  for (let pass = 0; pass < 3; pass++) {
    for (const rule of totalRules) {
      const sumKeys = (rule.sumOf as string[] | null) ?? [];
      vals[rule.key] = Array.from({ length: 12 }, (_, i) =>
        sumKeys.reduce((sum, k) => sum + (vals[k]?.[i] ?? 0), 0)
      );
    }
  }

  return vals;
}

// ── Utility: computeCumulativeNCF ─────────────────────────────────────────────

/**
 * Computes cumulative net cash flow — the running balance change from Jan to Dec.
 * Used to find the trough (lowest point) for liquidity reserve sizing.
 */
export function computeCumulativeNCF(cashFlows: CashFlow[]): {
  monthly: number[];
  cumulative: number[];
  troughMonth: number;
  troughDepth: number;
} {
  const { netCashFlow } = computeMonthlyCF(cashFlows);

  const cumulative: number[] = [];
  let running = 0;
  for (const m of netCashFlow) {
    running += m;
    cumulative.push(Math.round(running));
  }

  const troughValue = Math.min(...cumulative);
  const troughMonth = cumulative.indexOf(troughValue);
  const troughDepth = Math.abs(troughValue);

  return { monthly: netCashFlow, cumulative, troughMonth, troughDepth };
}

// ── Utility: monthlyOutflows ──────────────────────────────────────────────────

/**
 * Returns the total outflows for a specific month/year.
 * Used by computeLiquidityTargets to size the operating and reserve floors.
 */
export function monthlyOutflows(
  cashFlows: CashFlow[],
  year: number,
  month: number // 1-based (1 = January)
): number {
  return cashFlows
    .filter(cf => {
      const d = new Date(cf.date as string);
      return (
        cf.type === "outflow" &&
        d.getUTCFullYear() === year &&
        d.getUTCMonth() + 1 === month
      );
    })
    .reduce((sum, cf) => sum + Number(cf.amount), 0);
}
