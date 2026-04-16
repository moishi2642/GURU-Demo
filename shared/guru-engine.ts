// ═════════════════════════════════════════════════════════════════════════════
// GURU ENGINE — Core Financial Model & Computations
//
// Extracted from client-dashboard.tsx (Phase 1 of refactor).
// This is the IP — all compute functions, bucket logic, tax calculations,
// and financial modeling lives here. Views import and use, never recompute.
// ═════════════════════════════════════════════════════════════════════════════

import { CashFlow, Asset } from "./schema";
import { format, addMonths } from "date-fns";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

// Demo date: December 31, 2025
export const DEMO_NOW = new Date(2025, 11, 31);

// GURU's 5-bucket framework
export const GURU_BUCKETS = {
  reserve: {
    label: "Operating Cash",
    short: "Checking — instantly available transaction accounts",
    color: "#1E4F9C",
    tagCls: "bg-transparent border border-[#1E4F9C]/35 text-[#1E4F9C]",
  },
  yield: {
    label: "Liquidity Reserve",
    short: "Savings & money market — penalty-free, higher-yielding",
    color: "#835800",
    tagCls: "bg-transparent border border-[#835800]/35 text-[#835800]",
  },
  tactical: {
    label: "Capital Build",
    short: "Treasuries & fixed income — 1–3 year horizon",
    color: "#195830",
    tagCls: "bg-transparent border border-[#195830]/35 text-[#195830]",
  },
  growth: {
    label: "Investments",
    short: "Long-horizon investments — equities, compounding wealth",
    color: "#4A3FA0",
    tagCls: "bg-transparent border border-[#4A3FA0]/35 text-[#4A3FA0]",
  },
  alternatives: {
    label: "Alternatives",
    short: "Real estate, private equity, RSUs — strategic illiquid assets",
    color: "#5C5C6E",
    tagCls: "bg-transparent border border-slate-400/40 text-slate-600",
  },
} as const;

export type GuroBucket = keyof typeof GURU_BUCKETS;

// Tax rates (NYC combined)
export const BANK_TAX = 0.47;    // 47% — NYC combined: federal (35%) + state (8%) + city (4%)
export const TREAS_TAX = 0.35;   // 35% — federal only; treasury securities state/city exempt
export const LTCG_TAX = 0.20;    // 20% — long-term capital gains
export const INVEST_GROSS = 0.10; // 10% — assumed gross investment portfolio return
export const CHECKING_GROSS = 0.0001; // 0.01% — actual checking yield

// Pro-forma after-tax yields by bucket
export const PROFORMA_AT = {
  checking: 0.0228, // CIT Money Market: 4.30% gross × (1 − 47%) = 2.28% AT
  reserve:  0.0280, // JPMorgan 100% Treasuries MMF: 4.30% × (1 − 35%) = 2.80% AT
  capital:  0.0520, // S&P Low Volatility Index: 6.50% × (1 − 20% LTCG) = 5.20% AT
  equity:   INVEST_GROSS * (1 - LTCG_TAX), // 8.00% AT
} as const;

// Cash Flow P&L structure — row definitions
export type PLRowDef =
  | { key: string; kind: "group";    label: string }
  | { key: string; kind: "item";     label: string; descs: string[]; renderAs?: "subtotal" }
  | { key: string; kind: "subtotal"; label: string; sumOf?: string[]; descs?: string[] }
  | { key: string; kind: "total";    label: string; sumOf?: string[]; compute?: "outflow" | "net" | "cumulative"; accent: "green" | "amber" };

// 12-month forecast structure for 2026
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

// Cash Flow P&L rows — defines the structure of the cash flow forecast
export const CF_PL_ROWS: PLRowDef[] = [
  { key: "g_income", kind: "group", label: "EARNED INCOME" },
  {
    key: "michael_salary",
    kind: "item",
    label: "Michael — Net Monthly Salary",
    descs: ["Michael — Net Monthly", "Monthly Net Salaries"],
  },
  {
    key: "sarah_salary",
    kind: "item",
    label: "Sarah — Net Monthly Salary",
    descs: ["Sarah — Net Monthly"],
  },
  {
    key: "bonus_p1",
    kind: "item",
    label: "Michael — Year-End Bonus",
    descs: ["Partner 1 Year-End"],
  },
  {
    key: "bonus_p2",
    kind: "item",
    label: "Sarah — Year-End Bonus",
    descs: ["Partner 2 Year-End"],
  },
  {
    key: "sub_income",
    kind: "subtotal",
    label: "Cash Compensation",
    sumOf: ["michael_salary", "sarah_salary", "bonus_p1", "bonus_p2"],
  },
  {
    key: "reserve_int",
    kind: "item",
    label: "Interest From Bank Accounts",
    descs: ["Reserve MMF"],
  },
  {
    key: "sub_total_income",
    kind: "total",
    label: "TOTAL CASH INCOME",
    sumOf: ["sub_income", "reserve_int"],
    accent: "green",
  },
  { key: "g_tribeca", kind: "group", label: "TRIBECA — PRIMARY RESIDENCE" },
  { key: "trib_mortgage", kind: "item", label: "Mortgage",          descs: ["Tribeca — Mortgage"] },
  { key: "trib_hoa",      kind: "item", label: "HOA & Maintenance", descs: ["Tribeca — HOA"] },
  { key: "trib_ins",      kind: "item", label: "Home Insurance",    descs: ["Tribeca — Home Insurance"] },
  { key: "trib_util",     kind: "item", label: "Cable & Utilities", descs: ["Tribeca — Cable"] },
  { key: "nyc_tax",       kind: "item", label: "NYC Property Taxes", descs: ["NYC Property Taxes"] },
  { key: "sub_trib", kind: "subtotal", label: "12 Warren NYC — Primary Residence", sumOf: ["trib_mortgage", "trib_hoa", "trib_ins", "trib_util", "nyc_tax"] },
  { key: "g_sara", kind: "group", label: "SARASOTA — INVESTMENT PROPERTY" },
  { key: "sara_in",    kind: "item", label: "Rental Income",              descs: ["Investment Property Rental Income"] },
  { key: "sara_mgmt",  kind: "item", label: "Property Management",        descs: ["Investment Property — Property Management"] },
  { key: "sara_mtg",   kind: "item", label: "Mortgage",                   descs: ["Investment Property — Mortgage"] },
  { key: "sara_maint", kind: "item", label: "Maintenance / HOA",          descs: ["Investment Property — Maintenance"] },
  { key: "sara_golf",  kind: "item", label: "Golf Club Annual Dues",      descs: ["Golf Club Annual Dues", "Sarasota — Golf Club"] },
  { key: "fl_tax",     kind: "item", label: "Property Taxes (FL annual)", descs: ["Investment Property Taxes"] },
  { key: "sub_sara", kind: "subtotal", label: "Sarasota Investment Property", sumOf: ["sara_in", "sara_mgmt", "sara_mtg", "sara_maint", "sara_golf", "fl_tax"] },
  { key: "g_living", kind: "group", label: "DEPENDENT CARE & EDUCATION" },
  {
    key: "childcare",
    kind: "item",
    label: "Nanny",
    descs: ["Childcare"],
  },
  {
    key: "tuition",
    kind: "item",
    label: "Private School Tuition (Dalton)",
    descs: ["Private School Tuition", "Dalton Tuition"],
  },
  {
    key: "sub_living",
    kind: "subtotal",
    label: "Dependent Care & Education",
    sumOf: ["childcare", "tuition"],
  },
  { key: "g_credit", kind: "group", label: "CREDIT CARD" },
  {
    key: "cc_pay",
    kind: "item",
    label: "Credit Card Payments",
    descs: ["Credit Card Payments"],
    renderAs: "subtotal",
  },
  { key: "g_lifestyle", kind: "group", label: "LIFESTYLE" },
  {
    key: "phone_util",
    kind: "item",
    label: "Phone / Utilities",
    descs: ["Phone, Cable"],
  },
  {
    key: "sub_lifestyle",
    kind: "subtotal",
    label: "Lifestyle",
    sumOf: ["phone_util"],
  },
  { key: "g_debt", kind: "group", label: "DEBT SERVICE" },
  {
    key: "pe_loan",
    kind: "item",
    label: "Professional Loan (Private Equity)",
    descs: ["PE Fund II Professional"],
  },
  {
    key: "student",
    kind: "item",
    label: "Student Debt (Undergrad + Graduate)",
    descs: ["Student Loan Payments"],
  },
  {
    key: "sub_debt",
    kind: "subtotal",
    label: "Debt Service",
    sumOf: ["pe_loan", "student"],
  },
  { key: "g_tax", kind: "group", label: "TAXES" },
  {
    key: "fed_tax",
    kind: "item",
    label: "Federal Estimated Tax",
    descs: ["Federal Estimated Income Tax"],
  },
  { key: "g_travel", kind: "group", label: "TRAVEL" },
  { key: "trav_all", kind: "item", label: "Travel", descs: ["Memorial Day Travel", "Weekend Travel", "Summer Travel", "Thanksgiving Travel", "Holiday Travel"] },
  { key: "g_misc", kind: "group", label: "YEAR-END & MISC" },
  {
    key: "yr_end_fees",
    kind: "item",
    label: "Year-End Fees & Misc",
    descs: ["Year-End Fees"],
  },
  {
    key: "yr_end_dist",
    kind: "item",
    label: "Year-End Investment Distributions",
    descs: ["Year-End Investment"],
  },
  {
    key: "total_expenses", kind: "total", label: "TOTAL CASH EXPENSES",
    sumOf: [
      "trib_mortgage", "trib_hoa", "trib_ins", "trib_util", "nyc_tax",
      "sara_in", "sara_mgmt", "sara_mtg", "sara_maint", "sara_golf", "fl_tax",
      "childcare", "tuition",
      "cc_pay",
      "phone_util",
      "pe_loan", "student",
      "fed_tax",
      "trav_all",
      "yr_end_fees",
    ],
    accent: "green",
  },
  { key: "total_net",      kind: "total", label: "TOTAL NET CASH FLOW",    compute: "net",         accent: "amber" },
  { key: "total_cum",      kind: "total", label: "CUMULATIVE NET CASH FLOW", compute: "cumulative", accent: "amber" },
];

// Return account detail for income optimization
export interface ReturnAccountDetail {
  description:      string;
  balance:          number;
  grossYield:       number;
  currentATYield:   number;
  currentATIncome:  number;
  proformaATYield:  number;
  proformaATIncome: number;
  bucket:           keyof typeof PROFORMA_AT;
}

// ─── HELPER: Asset Bucket Classification ──────────────────────────────────────
// Single source of truth for bucket membership.
// Both cashBuckets() and computeLiquidityTargets() call this.

export function classifyAsset(asset: Asset): GuroBucket {
  const desc = (asset.description ?? "").toLowerCase();

  if (asset.type === "cash") {
    return desc.includes("checking") ? "reserve" : "yield";
  }

  if (asset.type === "fixed_income") {
    return !/401|ira|roth/i.test(asset.description ?? "") ? "tactical" : "growth";
  }

  if (asset.type === "equity") {
    if (
      desc.includes("rsu") ||
      desc.includes("unvested") ||
      desc.includes("carry")
    ) {
      return "alternatives";
    }
    return "growth";
  }

  if (asset.type === "alternative" || asset.type === "real_estate") {
    return "alternatives";
  }

  return "growth"; // default
}

// ─── COMPUTE: Cash Buckets ───────────────────────────────────────────────────

export function cashBuckets(assets: Asset[]) {
  let reserve = 0,
    yieldBucket = 0,
    tactical = 0,
    growth = 0,
    alts = 0;
  const reserveItems: { label: string; value: number }[] = [];
  const yieldItems: { label: string; value: number }[] = [];
  const tacticalItems: { label: string; value: number }[] = [];
  const growthItems: { label: string; value: number }[] = [];
  const altItems: { label: string; value: number }[] = [];

  for (const a of assets) {
    const val = Number(a.value);
    const lbl = (a.description ?? "")
      .split("(")[0]
      .split("—")[0]
      .split("–")[0]
      .trim();

    const bucket = classifyAsset(a);

    if (bucket === "reserve") {
      reserve += val;
      reserveItems.push({ label: lbl, value: val });
    } else if (bucket === "yield") {
      yieldBucket += val;
      yieldItems.push({ label: lbl, value: val });
    } else if (bucket === "tactical") {
      tactical += val;
      tacticalItems.push({ label: lbl, value: val });
    } else if (bucket === "growth") {
      growth += val;
      growthItems.push({ label: lbl, value: val });
    } else if (bucket === "alternatives") {
      alts += val;
      altItems.push({ label: lbl, value: val });
    }
  }

  const totalLiquid = reserve + yieldBucket + tactical;

  return {
    reserve,
    yieldBucket,
    tactical,
    growth,
    alts,
    totalLiquid,
    reserveItems,
    yieldItems,
    tacticalItems,
    growthItems,
    altItems,
    // legacy aliases
    immediate: reserve,
    shortTerm: yieldBucket,
    mediumTerm: tactical,
    immediateItems: reserveItems,
    shortItems: yieldItems,
    mediumItems: tacticalItems,
  };
}

// ─── COMPUTE: Monthly Cash Flow Aggregation ──────────────────────────────────

function buildMonthMap(cashFlows: CashFlow[]) {
  const map: Record<string, { inflow: number; outflow: number }> = {};
  for (const cf of cashFlows) {
    const d = new Date(cf.date as string);
    const key = format(new Date(d.getUTCFullYear(), d.getUTCMonth(), 1), "MMM yy");
    if (!map[key]) map[key] = { inflow: 0, outflow: 0 };
    if (cf.type === "inflow") map[key].inflow += Number(cf.amount);
    else map[key].outflow += Number(cf.amount);
  }
  return map;
}

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

// ─── COMPUTE: Live Monthly Cash Flow ─────────────────────────────────────────

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

// ─── COMPUTE: Cumulative Net Cash Flow & Trough ────────────────────────────

export function computeCumulativeNCF(cashFlows: CashFlow[], assets?: Asset[]): {
  cumulativeByMonth: number[];
  troughIdx: number;
  troughDepth: number;
  netByMonth: number[];
} {
  // Helper to compute monthly CF values from CashFlow entries
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

  // Use asset forecast model for reserve interest (same as CashFlowForecastView)
  const monthlyBucketInt = assets ? computeMonthlyBucketInterest(assets, cashFlows) : [];

  // Compute values for each CF_PL_ROWS entry
  const vals: Record<string, number[]> = {};
  for (const row of CF_PL_ROWS) {
    if (row.kind === "item") {
      // Reserve interest overridden by asset-forecast model for consistency
      if (row.key === "reserve_int" && assets && monthlyBucketInt.length > 0) {
        vals[row.key] = monthlyBucketInt;
      } else {
        vals[row.key] = CF_MONTHS.map((m) => mvCF(row.descs, m.year, m.month));
      }
    } else if (row.kind === "subtotal") {
      if (row.sumOf) {
        vals[row.key] = CF_MONTHS.map((_, mi) => row.sumOf!.reduce((s, k) => s + (vals[k]?.[mi] ?? 0), 0));
      } else if (row.descs) {
        vals[row.key] = CF_MONTHS.map((m) => mvCF(row.descs!, m.year, m.month));
      } else {
        vals[row.key] = CF_MONTHS.map(() => 0);
      }
    } else if (row.kind === "total" && row.sumOf) {
      vals[row.key] = CF_MONTHS.map((_, mi) => row.sumOf!.reduce((s, k) => s + (vals[k]?.[mi] ?? 0), 0));
    } else {
      vals[row.key] = CF_MONTHS.map(() => 0);
    }
  }

  // Net per month = sum of all items (inflows - outflows)
  const netByMonth = CF_MONTHS.map((_, mi) =>
    CF_PL_ROWS.filter((r) => r.kind === "item").reduce((s, r) => s + (vals[r.key]?.[mi] ?? 0), 0)
  );

  // Cumulative NCF
  const cumulativeByMonth = netByMonth.reduce<number[]>((acc, v, i) => {
    acc.push((acc[i - 1] ?? 0) + v);
    return acc;
  }, []);

  // Trough (minimum point)
  const troughIdx = cumulativeByMonth.reduce(
    (minI, v, i) => (v < cumulativeByMonth[minI] ? i : minI),
    0,
  );

  // troughDepth: cash needed at the low point
  const troughMin  = cumulativeByMonth[troughIdx];
  const troughDepth = troughMin < 0 ? Math.abs(troughMin) : troughMin;

  return { cumulativeByMonth, troughIdx, troughDepth, netByMonth };
}

// ─── COMPUTE: Cash Flow KPIs ────────────────────────────────────────────────

export function computeCashFlowKPIs(
  cashFlows: CashFlow[],
  totalLiquid: number,
  assets?: Asset[],
): {
  annualInflows: number;
  annualOutflows: number;
  annualNetCF: number;
  monthlyBurn: number;
  coverageRatio: number;
  liquidityCoverage: number;
  cashRunwayMonths: number;
  cashRunway: string;
  medianMonthly: number;
} {
  const forecastData = buildForecast(cashFlows);
  const annualInflows = forecastData.reduce((s, d) => s + d.inflow, 0);
  const annualOutflows = forecastData.reduce((s, d) => s + d.outflow, 0);
  const annualNetCF = annualInflows - annualOutflows;
  const monthlyBurn = Math.round(annualOutflows / 12);
  const coverageRatio =
    annualOutflows > 0 ? Math.round((annualInflows / annualOutflows) * 100) : 0;
  const liquidityCoverage =
    annualOutflows > 0 ? (totalLiquid / annualOutflows) * 100 : 999;
  const cashRunwayMonths = monthlyBurn > 0 ? totalLiquid / monthlyBurn : 0;
  const cashRunway = monthlyBurn > 0 ? cashRunwayMonths.toFixed(1) : "—";

  const { netByMonth } = computeCumulativeNCF(cashFlows, assets);
  const sortedNet = [...netByMonth].sort((a, b) => a - b);
  const medianMonthly = sortedNet[Math.floor(sortedNet.length / 2)] ?? 0;

  return {
    annualInflows,
    annualOutflows,
    annualNetCF,
    monthlyBurn,
    coverageRatio,
    liquidityCoverage,
    cashRunwayMonths,
    cashRunway,
    medianMonthly,
  };
}

// ─── COMPUTE: Liquidity Targets ──────────────────────────────────────────────
// Canonical source-of-truth for all liquidity metrics.
// Both AdvisorBriefView and GuruLandingView call this.

export function computeLiquidityTargets(
  assets: Asset[],
  cashFlows: CashFlow[],
  bonusDate: Date = new Date(2025, 11, 31), // Dec 31, 2025
): {
  operatingCash:           number;
  operatingTarget:         number;
  operatingExcess:         number;
  liquidityReserve:        number;
  totalLiquidityTarget:    number;
  liquidityReserveTarget:  number;
  reserveExcess:           number;
  capitalBuild:            number;
  totalLiquid:             number;
  goalSavings:             number;
  totalLiquidityReq:       number;
  operatingFloorAtTrough:  number;
  troughDepth:             number;
  excessLiquidity:         number;
  monthlyRate:             number;
  coverageMonths:          number;
} {
  // ── Account groupings ──────────────────────────────────────────────────────
  // Operating Cash: checking accounts — instant same-day liquidity, no yield
  const operatingCash = assets
    .filter(a => a.type === "cash" && (a.description ?? "").toLowerCase().includes("checking"))
    .reduce((s, a) => s + Number(a.value), 0);

  // Liquidity Reserve: bank deposit products (savings, money market accounts,
  // high-yield savings) — same-day to T+1, FDIC-insured, yield-optimized
  const liquidityReserve = assets
    .filter(a => a.type === "cash" && !(a.description ?? "").toLowerCase().includes("checking"))
    .reduce((s, a) => s + Number(a.value), 0);

  // Capital Build: investment-grade short-duration market instruments —
  // Treasuries, T-bills, money market funds, CDs, munis, short-duration fixed income.
  // Excludes retirement accounts (401k, IRA, Roth) which are long-horizon, illiquid.
  const capitalBuild = assets
    .filter(a => a.type === "fixed_income" && !/401|ira|roth/i.test(a.description ?? ""))
    .reduce((s, a) => s + Number(a.value), 0);

  const totalLiquid = operatingCash + liquidityReserve + capitalBuild;

  // ── Helper: sum outflows for a given year/month (1-indexed month) ─────────
  const monthOutflows = (year: number, month: number): number =>
    cashFlows
      .filter(cf => cf.type === "outflow")
      .filter(cf => {
        const d = new Date(cf.date as string);
        return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
      })
      .reduce((s, cf) => s + Number(cf.amount), 0);

  // ── Trough — single source of truth from CF tab computation (with asset forecast model) ──
  const { troughIdx, troughDepth } = computeCumulativeNCF(cashFlows, assets);

  // ── Operating floor AT the trough ────────────────────────────────────────
  // 2 months forward from the trough month (not from today).
  // troughIdx is 0-based into CF_MONTHS (Nov trough → idx 10).
  // Wraps correctly: Nov+1 = Dec (idx 11), Nov+2 = Jan (idx 0).
  const fwd1 = CF_MONTHS[(troughIdx + 1) % CF_MONTHS.length];
  const fwd2 = CF_MONTHS[(troughIdx + 2) % CF_MONTHS.length];
  const operatingFloorAtTrough = monthOutflows(fwd1.year, fwd1.month)
                               + monthOutflows(fwd2.year, fwd2.month);

  // ── Total Liquidity Target = total 12-month liquidity needed ─────────────
  const totalLiquidityTarget = troughDepth + operatingFloorAtTrough;

  // ── Operating target (today) ──────────────────────────────────────────────
  // 2 months forward from the bonus landing date. Sizes the operating account now.
  const bm  = bonusDate.getMonth();                                        // 0-indexed
  const bm1 = (bm + 1) % 12;
  const by1 = bm === 11 ? bonusDate.getFullYear() + 1 : bonusDate.getFullYear();
  const bm2 = (bm1 + 1) % 12;
  const by2 = bm1 === 11 ? by1 + 1 : by1;
  const operatingTarget = monthOutflows(by1, bm1 + 1) + monthOutflows(by2, bm2 + 1) || 63574;

  // ── Goal Savings ──────────────────────────────────────────────────────────
  // Capital earmarked for a near-term goal (home purchase, etc.).
  // For now: equals the Capital Build balance (Treasuries already earmarked).
  // For a new client with no Treasuries this is 0 automatically.
  const goalSavings = capitalBuild;

  // ── Total Liquidity Requirement & Excess ─────────────────────────────────
  const totalLiquidityReq = totalLiquidityTarget + goalSavings;
  const excessLiquidity   = Math.max(0, totalLiquid - totalLiquidityReq);

  const operatingExcess = Math.max(0, operatingCash - operatingTarget);

  // ── Per-bucket targets ────────────────────────────────────────────────────
  // The Liquidity Reserve bucket does NOT need to cover the full totalLiquidityTarget —
  // the Operating Cash bucket already covers the 2-month operatingTarget.
  // Liquidity Reserve target = the remainder of the 12-month requirement.
  const liquidityReserveTarget = Math.max(0, totalLiquidityTarget - operatingTarget);
  const reserveExcess          = Math.max(0, liquidityReserve - liquidityReserveTarget);

  const monthlyRate    = operatingTarget / 2;
  const coverageMonths = monthlyRate > 0 ? totalLiquid / monthlyRate : 0;

  return {
    operatingCash,    operatingTarget,         operatingExcess,
    liquidityReserve, totalLiquidityTarget,           liquidityReserveTarget,  reserveExcess,
    capitalBuild,     totalLiquid,
    goalSavings,      totalLiquidityReq,
    operatingFloorAtTrough, troughDepth,
    excessLiquidity, monthlyRate, coverageMonths,
  };
}

// ─── COMPUTE: Return Optimization ───────────────────────────────────────────
// Computes current vs. pro-forma after-tax annual income across all liquid,
// non-retirement accounts. "Pro-forma" uses the highest AT yield from
// PROFORMA_AT for each bucket.

export function computeReturnOptimization(
  assets: Asset[],
  cashFlows?: CashFlow[],
): {
  accounts:             ReturnAccountDetail[];
  currentAnnualIncome:  number;
  proformaAnnualIncome: number;
  annualPickup:         number;
} {
  const accounts: ReturnAccountDetail[] = [];

  for (const a of assets) {
    const rawDesc = a.description ?? "";
    const desc    = rawDesc.toLowerCase();
    const balance = Number(a.value ?? 0);
    if (balance <= 0) continue;

    // Exclusions
    if (a.type === "real_estate")         continue;
    if (a.type === "alternative")         continue;
    if (/401|ira|roth/i.test(rawDesc))    continue;  // retirement accounts
    if (/rsu|unvested|carry/i.test(desc)) continue;  // illiquid / unvested equity

    let bucket: ReturnAccountDetail["bucket"];
    let grossYield: number;
    let taxRate: number;

    if (a.type === "cash") {
      if (desc.includes("checking")) {
        bucket     = "checking";
        grossYield = CHECKING_GROSS; // 0.01% — actual checking yield
        taxRate    = BANK_TAX;       // 47% — NYC combined rate for bank deposit interest
      } else {
        bucket     = "reserve";
        grossYield = parseYieldFromDesc(rawDesc) ?? CHECKING_GROSS;
        taxRate    = BANK_TAX;
      }
    } else if (a.type === "fixed_income") {
      bucket     = "capital";
      grossYield = parseYieldFromDesc(rawDesc) ?? 0.035;
      taxRate    = TREAS_TAX; // Treasuries: federal only (35%), state/city exempt
    } else if (a.type === "equity") {
      bucket     = "equity";
      grossYield = INVEST_GROSS;
      taxRate    = LTCG_TAX;
    } else {
      continue;
    }

    const currentATYield  = grossYield * (1 - taxRate);
    const proformaATYield = PROFORMA_AT[bucket];

    accounts.push({
      description:      rawDesc,
      balance,
      grossYield,
      currentATYield,
      currentATIncome:  Math.round(balance * currentATYield),
      proformaATYield,
      proformaATIncome: Math.round(balance * proformaATYield),
      bucket,
    });
  }

  const currentAnnualIncome = accounts.reduce((s, a) => s + a.currentATIncome, 0);

  let proformaAnnualIncome: number;

  if (cashFlows) {
    // Target-based pro-forma: matches income optimization table exactly.
    // Each bucket is sized to its target; excess cash is deployed to new investments at equity rate.
    const {
      operatingTarget,
      liquidityReserveTarget,
      capitalBuild: capitalBuildBal,
      excessLiquidity,
    } = computeLiquidityTargets(assets, cashFlows);

    // Equity bucket: existing accounts, pro-forma rate already at PROFORMA_AT.equity
    const equityProforma = accounts
      .filter(a => a.bucket === "equity")
      .reduce((s, a) => s + a.proformaATIncome, 0);

    proformaAnnualIncome = Math.round(
      operatingTarget   * PROFORMA_AT.checking +  // Operating at CIT MM rate
      liquidityReserveTarget * PROFORMA_AT.reserve + // Reserve at JPMorgan Treasuries MMF rate
      capitalBuildBal   * PROFORMA_AT.capital +   // Capital Build at S&P Low Vol rate
      equityProforma +                             // Existing equity unchanged
      excessLiquidity   * PROFORMA_AT.equity       // New investments: excess deployed at 8% AT
    );
  } else {
    // Legacy: apply best rate to full current balance per bucket (no redistribution)
    proformaAnnualIncome = accounts.reduce((s, a) => s + a.proformaATIncome, 0);
  }

  const annualPickup = proformaAnnualIncome - currentAnnualIncome;

  return { accounts, currentAnnualIncome, proformaAnnualIncome, annualPickup };
}

// ─── COMPUTE: Monthly Bucket Interest ────────────────────────────────────────

export function computeMonthlyBucketInterest(
  assets: Asset[],
  cashFlows: CashFlow[],
): number[] {
  const { reserve, yieldBucket, tactical } = cashBuckets(assets);

  // Simple interest accrual: assume average balance over year
  const reserveInt = (reserve * CHECKING_GROSS) / 12;
  const yieldInt = (yieldBucket * 0.045) / 12; // ~4.5% money market
  const tacticalInt = (tactical * 0.035) / 12; // ~3.5% short-term treasuries

  return Array.from({ length: 12 }, () =>
    Math.round(reserveInt + yieldInt + tacticalInt),
  );
}

// ─── COMPUTE: Net Worth Timeline ─────────────────────────────────────────────

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

// ─── COMPUTE: Net Worth Projection (5-Year) ────────────────────────────────

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

// ─── UTILITY: Parse Yield from Description ──────────────────────────────────

export function parseYieldFromDesc(description: string): number | null {
  const match = description.match(/(\d+\.?\d*)%/);
  return match ? parseFloat(match[1]) / 100 : null;
}
