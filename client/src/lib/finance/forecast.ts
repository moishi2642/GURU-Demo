// ─── Forecast & Net-Worth timeline builders ───────────────────────────────────
// Pure functions — no React, no DB calls. Depend only on CashFlow[] and Asset[].
// Used by: MoneyMovementView, GuruLandingView, AdvisorBriefView, and the net
// worth chart in BalanceSheetView.

import { format, addMonths } from "date-fns";
import type { Asset, CashFlow } from "@shared/schema";
import { DEMO_NOW } from "@/lib/dashboard/constants";

// ─── buildMonthMap ────────────────────────────────────────────────────────────
// Aggregates raw cash-flow rows into a per-month lookup keyed by "MMM yy"
// (e.g. "Jan 26"). Shared by buildForecast and computeLiveMonthlyCF.
export function buildMonthMap(cashFlows: CashFlow[]) {
  const map: Record<string, { inflow: number; outflow: number }> = {};
  for (const cf of cashFlows) {
    const d = new Date(cf.date);
    const key = format(new Date(d.getUTCFullYear(), d.getUTCMonth(), 1), "MMM yy");
    if (!map[key]) map[key] = { inflow: 0, outflow: 0 };
    if (cf.type === "inflow") map[key].inflow += Number(cf.amount);
    else map[key].outflow += Number(cf.amount);
  }
  return map;
}

// ─── computeLiveMonthlyCF ─────────────────────────────────────────────────────
// Single source of truth for per-month financial aggregates derived from the DB.
// Returns 12-element arrays (index 0 = Jan 2026 … index 11 = Dec 2026).
// All views that previously used hardcoded static arrays should call this instead.
export function computeLiveMonthlyCF(cashFlows: CashFlow[]) {
  const map = buildMonthMap(cashFlows);
  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const key = (m: number) => `${MONTH_LABELS[m]} 26`; // "Jan 26" … "Dec 26"

  // Gross outflows and inflows per calendar month (positive numbers)
  const grossOutflow = Array.from({length:12}, (_, i) => Math.round(map[key(i)]?.outflow ?? 0));
  const grossInflow  = Array.from({length:12}, (_, i) => Math.round(map[key(i)]?.inflow  ?? 0));

  // Rental income separately — needed to compute "net expenses" matching Excel structure
  // (Excel Row 63 "Cash Expenses" nets rental income against Florida outflows)
  const rentalInflow = Array.from({length:12}, (_, i) => {
    return cashFlows
      .filter(cf => {
        const d = new Date(cf.date as string);
        return cf.type === "inflow"
          && d.getUTCFullYear() === 2026
          && d.getUTCMonth() === i
          && (cf.description ?? "").toLowerCase().includes("rental");
      })
      .reduce((s, cf) => s + Number(cf.amount), 0);
  });

  // Net expenses = gross outflows − rental income (positive = money out, matching "Cash Expenses")
  const netExpenses = Array.from({length:12}, (_, i) => grossOutflow[i] - rentalInflow[i]);

  // Signed net cash flow per month (positive = surplus, negative = deficit)
  const netCashFlow = Array.from({length:12}, (_, i) => grossInflow[i] - grossOutflow[i]);

  // Base monthly expense: average of the 4 "plain" months with no special items
  // (Mar, Sep, Oct = months with only recurring expenses and no tuition/taxes/travel)
  const plainMonths = [2, 8, 9]; // 0-indexed: Mar, Sep, Oct
  const baseMonthlyCFExpense = Math.round(
    plainMonths.reduce((s, i) => s + netExpenses[i], 0) / plainMonths.length
  );

  return { grossOutflow, grossInflow, rentalInflow, netExpenses, netCashFlow, baseMonthlyCFExpense };
}

// ─── buildForecast ────────────────────────────────────────────────────────────
// Builds a 12-month rolling forecast from the current Jan 1. Returns monthly
// inflow/outflow/net/cumulative array. Used everywhere a "forecast" is needed.
export function buildForecast(cashFlows: CashFlow[]) {
  const map = buildMonthMap(cashFlows);
  const now = new Date(new Date().getFullYear(), 0, 1);
  let cumulative = 0;
  return Array.from({ length: 12 }, (_, i) => {
    const month = addMonths(now, i);
    const key = format(month, "MMM yy");
    const d = map[key] || { inflow: 0, outflow: 0 };
    const net = d.inflow - d.outflow;
    cumulative += net;
    return {
      month: format(month, "MMM"),
      inflow: d.inflow,
      outflow: d.outflow,
      net,
      cumulative,
    };
  });
}

// ─── buildNWTimeline ─────────────────────────────────────────────────────────
// Historical + forward net-worth series used in the NW chart.
// Historical: 5 realistic prior-year multipliers (2021–2025).
// Forward: 5-year projection using GROWTH_RATE on growable assets + annual surplus.
export function buildNWTimeline(
  netWorth: number,
  cashFlows: CashFlow[],
  assets: Asset[],
) {
  const annualSurplus = buildForecast(cashFlows).reduce((s, d) => s + d.net, 0);
  const growthValue = assets
    .filter((a) => ["equity", "alternative", "real_estate"].includes(a.type))
    .reduce((s, a) => s + Number(a.value), 0);
  const GROWTH_RATE = 0.065;

  // Historical: realistic multipliers going back 5 years.
  // 2022 was the dip year (S&P -18%, bonds worst year in decades).
  const histMultipliers = [
    { label: "2021", m: 0.66 },
    { label: "2022", m: 0.55 }, // dip — S&P −18%, rates spiked
    { label: "2023", m: 0.73 }, // recovery begins
    { label: "2024", m: 0.86 }, // S&P +26%
    { label: "2025", m: 0.93 },
  ];

  const histPoints = histMultipliers.map(({ label, m }) => ({
    label,
    histValue: Math.round(netWorth * m),
    projValue: undefined as number | undefined,
  }));

  // "Now" bridges both series
  const nowPoint = {
    label: "Now",
    histValue: netWorth,
    projValue: netWorth,
  };

  // Forward projections (1Y–5Y)
  const projPoints = Array.from({ length: 5 }, (_, i) => {
    const yr = i + 1;
    const assetGrowth = growthValue * (Math.pow(1 + GROWTH_RATE, yr) - 1);
    const cashAccum = annualSurplus * yr;
    return {
      label: `${yr}Y`,
      histValue: undefined as number | undefined,
      projValue: Math.round(netWorth + assetGrowth + cashAccum),
    };
  });

  return [...histPoints, nowPoint, ...projPoints];
}

// ─── buildNWProjection ────────────────────────────────────────────────────────
// Simpler 6-point projection (Now + 1Y–5Y) used for projYear5 callers.
export function buildNWProjection(
  netWorth: number,
  cashFlows: CashFlow[],
  assets: Asset[],
) {
  const annualSurplus = buildForecast(cashFlows).reduce((s, d) => s + d.net, 0);
  const growthValue = assets
    .filter((a) => ["equity", "alternative", "real_estate"].includes(a.type))
    .reduce((s, a) => s + Number(a.value), 0);
  const GROWTH_RATE = 0.065;
  const now = DEMO_NOW;
  return Array.from({ length: 6 }, (_, i) => {
    const assetGrowth = growthValue * (Math.pow(1 + GROWTH_RATE, i) - 1);
    const cashAccum = annualSurplus * i;
    return {
      label: i === 0 ? "Now" : `${i}Y`,
      year: format(addMonths(now, i * 12), "yyyy"),
      value: Math.round(netWorth + assetGrowth + cashAccum),
    };
  });
}
