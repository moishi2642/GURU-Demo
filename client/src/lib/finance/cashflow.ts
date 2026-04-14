// ─── Cash-flow P&L engine ─────────────────────────────────────────────────────
// Canonical definitions for the P&L row schema, month sequence, and all
// derived cash-flow analytics. Every view that needs CF totals imports from here.
//
// IMPORTANT: CF_PL_ROWS is the static fallback. The DB-driven path calls
// cfRulesToPLRows(cfCategoryRules) which the CashFlowForecastView uses when
// cfCategoryRules is non-empty. Both produce PLRowDef[].

import type { CashFlow, CfCategoryRule } from "@shared/schema";
import { buildForecast } from "./forecast";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CFRowValues {
  /** key → 12-element array of monthly values (signed: income positive, expense negative) */
  [key: string]: number[];
}

// buildMonthMap and computeLiveMonthlyCF live in ./forecast — imported at top of this file.

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

// computeCumulativeNCF (canonical version with cumulativeByMonth/troughIdx/netByMonth) is below.

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

// ─── PLRowDef ─────────────────────────────────────────────────────────────────
// Shape of a single P&L table row. Views render PLRowDef[] into columns × months.
export type PLRowDef =
  | { key: string; kind: "group";    label: string }
  | { key: string; kind: "item";     label: string; descs: string[]; renderAs?: "subtotal" }
  | { key: string; kind: "subtotal"; label: string; sumOf?: string[]; descs?: string[] }
  | { key: string; kind: "total";    label: string; sumOf?: string[]; compute?: "outflow" | "net" | "cumulative"; accent: "green" | "amber" };

// ─── CF_MONTHS ────────────────────────────────────────────────────────────────
// Ordered 12-month sequence for 2026. Shared by all CF-table views.
export const CF_MONTHS = [
  { label: "Jan", year: 2026, month: 1 },
  { label: "Feb", year: 2026, month: 2 },
  { label: "Mar", year: 2026, month: 3 },
  { label: "Apr", year: 2026, month: 4 },
  { label: "May", year: 2026, month: 5 },
  { label: "Jun", year: 2026, month: 6 },
  { label: "Jul", year: 2026, month: 7 },
  { label: "Aug", year: 2026, month: 8 },
  { label: "Sep", year: 2026, month: 9 },
  { label: "Oct", year: 2026, month: 10 },
  { label: "Nov", year: 2026, month: 11 },
  { label: "Dec", year: 2026, month: 12 },
];

// ─── CF_PL_ROWS ───────────────────────────────────────────────────────────────
// Static fallback P&L row definitions (Kessler demo). Mirrors the Excel model
// row layout exactly. The DB-driven path (cfRulesToPLRows) replaces this when
// cfCategoryRules is seeded.
export const CF_PL_ROWS: PLRowDef[] = [
  { key: "g_income", kind: "group", label: "EARNED INCOME" },
  { key: "michael_salary", kind: "item", label: "Michael — Net Monthly Salary", descs: ["Michael — Net Monthly", "Monthly Net Salaries"] },
  { key: "sarah_salary",   kind: "item", label: "Sarah — Net Monthly Salary",   descs: ["Sarah — Net Monthly"] },
  { key: "bonus_p1",       kind: "item", label: "Michael — Year-End Bonus",     descs: ["Partner 1 Year-End"] },
  { key: "bonus_p2",       kind: "item", label: "Sarah — Year-End Bonus",       descs: ["Partner 2 Year-End"] },
  { key: "sub_income",     kind: "subtotal", label: "Cash Compensation",        sumOf: ["michael_salary", "sarah_salary", "bonus_p1", "bonus_p2"] },
  { key: "reserve_int",    kind: "item", label: "Interest From Bank Accounts",  descs: ["Reserve MMF"] },
  { key: "sub_total_income", kind: "total", label: "TOTAL CASH INCOME", sumOf: ["sub_income", "reserve_int"], accent: "green" },
  { key: "g_tribeca",      kind: "group", label: "TRIBECA — PRIMARY RESIDENCE" },
  { key: "trib_mortgage",  kind: "item", label: "Mortgage",           descs: ["Tribeca — Mortgage"] },
  { key: "trib_hoa",       kind: "item", label: "HOA & Maintenance",  descs: ["Tribeca — HOA"] },
  { key: "trib_ins",       kind: "item", label: "Home Insurance",     descs: ["Tribeca — Home Insurance"] },
  { key: "trib_util",      kind: "item", label: "Cable & Utilities",  descs: ["Tribeca — Cable"] },
  { key: "nyc_tax",        kind: "item", label: "NYC Property Taxes", descs: ["NYC Property Taxes"] },
  { key: "sub_trib", kind: "subtotal", label: "12 Warren NYC — Primary Residence", sumOf: ["trib_mortgage", "trib_hoa", "trib_ins", "trib_util", "nyc_tax"] },
  { key: "g_sara",         kind: "group", label: "SARASOTA — INVESTMENT PROPERTY" },
  { key: "sara_in",        kind: "item", label: "Rental Income",              descs: ["Investment Property Rental Income"] },
  { key: "sara_mgmt",      kind: "item", label: "Property Management",        descs: ["Investment Property — Property Management"] },
  { key: "sara_mtg",       kind: "item", label: "Mortgage",                   descs: ["Investment Property — Mortgage"] },
  { key: "sara_maint",     kind: "item", label: "Maintenance / HOA",          descs: ["Investment Property — Maintenance"] },
  { key: "sara_golf",      kind: "item", label: "Golf Club Annual Dues",      descs: ["Golf Club Annual Dues", "Sarasota — Golf Club"] },
  { key: "fl_tax",         kind: "item", label: "Property Taxes (FL annual)", descs: ["Investment Property Taxes"] },
  { key: "sub_sara", kind: "subtotal", label: "Sarasota Investment Property", sumOf: ["sara_in", "sara_mgmt", "sara_mtg", "sara_maint", "sara_golf", "fl_tax"] },
  { key: "g_living",       kind: "group", label: "DEPENDENT CARE & EDUCATION" },
  { key: "childcare",      kind: "item", label: "Nanny", descs: ["Childcare"] },
  { key: "tuition",        kind: "item", label: "Private School Tuition (Dalton)", descs: ["Private School Tuition", "Dalton Tuition"] },
  { key: "sub_living",     kind: "subtotal", label: "Dependent Care & Education", sumOf: ["childcare", "tuition"] },
  { key: "g_credit",       kind: "group", label: "CREDIT CARD" },
  { key: "cc_pay",         kind: "item", label: "Credit Card Payments", descs: ["Credit Card Payments"], renderAs: "subtotal" },
  { key: "g_lifestyle",    kind: "group", label: "LIFESTYLE" },
  { key: "phone_util",     kind: "item", label: "Phone / Utilities", descs: ["Phone, Cable"] },
  { key: "sub_lifestyle",  kind: "subtotal", label: "Lifestyle", sumOf: ["phone_util"] },
  { key: "g_debt",         kind: "group", label: "DEBT SERVICE" },
  { key: "pe_loan",        kind: "item", label: "Professional Loan (Private Equity)", descs: ["PE Fund II Professional"] },
  { key: "student",        kind: "item", label: "Student Debt (Undergrad + Graduate)", descs: ["Student Loan Payments"] },
  { key: "sub_debt",       kind: "subtotal", label: "Debt Service", sumOf: ["pe_loan", "student"] },
  { key: "g_tax",          kind: "group", label: "TAXES" },
  { key: "fed_tax",        kind: "item", label: "Federal Estimated Tax", descs: ["Federal Estimated Income Tax"] },
  { key: "g_travel",       kind: "group", label: "TRAVEL" },
  { key: "trav_all",       kind: "item", label: "Travel", descs: ["Memorial Day Travel", "Weekend Travel", "Summer Travel", "Thanksgiving Travel", "Holiday Travel"] },
  { key: "g_misc",         kind: "group", label: "YEAR-END & MISC" },
  { key: "yr_end_fees",    kind: "item", label: "Year-End Fees & Misc",                descs: ["Year-End Fees"] },
  { key: "yr_end_dist",    kind: "item", label: "Year-End Investment Distributions",  descs: ["Year-End Investment"] },
  {
    key: "total_expenses", kind: "total", label: "TOTAL CASH EXPENSES",
    sumOf: ["trib_mortgage","trib_hoa","trib_ins","trib_util","nyc_tax","sara_in","sara_mgmt","sara_mtg","sara_maint","sara_golf","fl_tax","childcare","tuition","cc_pay","phone_util","pe_loan","student","fed_tax","trav_all","yr_end_fees"],
    accent: "green",
  },
  { key: "total_net", kind: "total", label: "TOTAL NET CASH FLOW",      compute: "net",         accent: "amber" },
  { key: "total_cum", kind: "total", label: "CUMULATIVE NET CASH FLOW",  compute: "cumulative",  accent: "amber" },
];

// ─── cfRulesToPLRows ──────────────────────────────────────────────────────────
// DB-to-PLRowDef converter. When cfCategoryRules is seeded, views call this
// instead of using the static CF_PL_ROWS constant.
export function cfRulesToPLRows(rules: CfCategoryRule[]): PLRowDef[] {
  return rules.map(r => {
    const descs = (r.matchDescs as string[] | null) ?? [];
    const sumOf = (r.sumOf as string[] | null) ?? undefined;
    switch (r.kind) {
      case "row":      return { key: r.key, kind: "item"    as const, label: r.label, descs };
      case "total":    return { key: r.key, kind: "total"   as const, label: r.label, sumOf, accent: (r.accent === "blue" ? "green" : r.accent ?? "green") as "green" | "amber" };
      case "subtotal": return { key: r.key, kind: "subtotal"as const, label: r.label, sumOf };
      case "section":  return { key: r.key, kind: "group"   as const, label: r.label };
      default:         return { key: r.key, kind: "group"   as const, label: r.label };
    }
  });
}

// ─── computeCumulativeNCF ─────────────────────────────────────────────────────
// Single source of truth for the cumulative cash-flow curve.
// Drives the CF chart AND the trough calculation in computeLiquidityTargets.
// Returns same shape used everywhere in client-dashboard.tsx.
export function computeCumulativeNCF(cashFlows: CashFlow[]): {
  cumulativeByMonth: number[];
  troughIdx:   number;
  troughDepth: number;
  netByMonth:  number[];
} {
  const mvCF = (descs: string[], year: number, month: number): number =>
    cashFlows
      .filter((cf) => {
        const d = new Date(cf.date as string);
        return (
          d.getUTCFullYear() === year &&
          d.getUTCMonth() + 1 === month &&
          descs.some((dm) => cf.description.toLowerCase().includes(dm.toLowerCase()))
        );
      })
      .reduce((s, cf) => s + (cf.type === "inflow" ? Number(cf.amount) : -Number(cf.amount)), 0);

  const vals: Record<string, number[]> = {};
  for (const row of CF_PL_ROWS) {
    if (row.kind === "item") {
      vals[row.key] = CF_MONTHS.map((m) => mvCF(row.descs, m.year, m.month));
    } else if (row.kind === "subtotal") {
      if (row.sumOf)       vals[row.key] = CF_MONTHS.map((_, mi) => row.sumOf!.reduce((s, k) => s + (vals[k]?.[mi] ?? 0), 0));
      else if (row.descs)  vals[row.key] = CF_MONTHS.map((m) => mvCF(row.descs!, m.year, m.month));
      else                 vals[row.key] = CF_MONTHS.map(() => 0);
    } else if (row.kind === "total" && row.sumOf) {
      vals[row.key] = CF_MONTHS.map((_, mi) => row.sumOf!.reduce((s, k) => s + (vals[k]?.[mi] ?? 0), 0));
    } else {
      vals[row.key] = CF_MONTHS.map(() => 0);
    }
  }

  const netByMonth = CF_MONTHS.map((_, mi) =>
    CF_PL_ROWS.filter((r) => r.kind === "item").reduce((s, r) => s + (vals[r.key]?.[mi] ?? 0), 0)
  );

  const cumulativeByMonth = netByMonth.reduce<number[]>((acc, v, i) => {
    acc.push((acc[i - 1] ?? 0) + v);
    return acc;
  }, []);

  const troughIdx   = cumulativeByMonth.reduce((minI, v, i) => (v < cumulativeByMonth[minI] ? i : minI), 0);
  const troughMin   = cumulativeByMonth[troughIdx];
  const troughDepth = troughMin < 0 ? Math.abs(troughMin) : troughMin;

  return { cumulativeByMonth, troughIdx, troughDepth, netByMonth };
}

// ─── computeCashFlowKPIs ──────────────────────────────────────────────────────
// Single source of truth for ALL derived cash flow KPIs.
export function computeCashFlowKPIs(
  cashFlows: CashFlow[],
  totalLiquid: number,
): {
  annualInflows:      number;
  annualOutflows:     number;
  annualNetCF:        number;
  monthlyBurn:        number;
  coverageRatio:      number;
  liquidityCoverage:  number;
  cashRunwayMonths:   number;
  cashRunway:         string;
  medianMonthly:      number;
} {
  const forecastData      = buildForecast(cashFlows);
  const annualInflows     = forecastData.reduce((s, d) => s + d.inflow,  0);
  const annualOutflows    = forecastData.reduce((s, d) => s + d.outflow, 0);
  const annualNetCF       = annualInflows - annualOutflows;
  const monthlyBurn       = Math.round(annualOutflows / 12);
  const coverageRatio     = annualOutflows > 0 ? Math.round((annualInflows / annualOutflows) * 100) : 0;
  const liquidityCoverage = annualOutflows > 0 ? (totalLiquid / annualOutflows) * 100 : 999;
  const cashRunwayMonths  = monthlyBurn > 0 ? totalLiquid / monthlyBurn : 0;
  const cashRunway        = monthlyBurn > 0 ? cashRunwayMonths.toFixed(1) : "—";
  const { netByMonth }    = computeCumulativeNCF(cashFlows);
  const sortedNet         = [...netByMonth].sort((a, b) => a - b);
  const medianMonthly     = sortedNet[Math.floor(sortedNet.length / 2)] ?? 0;
  return { annualInflows, annualOutflows, annualNetCF, monthlyBurn, coverageRatio,
           liquidityCoverage, cashRunwayMonths, cashRunway, medianMonthly };
}
