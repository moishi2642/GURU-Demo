// ─── Liquidity Target Calculations ───────────────────────────────────────────
// Canonical source-of-truth for all liquidity metrics.
// AdvisorBriefView, GuruLandingView, and GuruAllocationView all call this.
// Never re-derive these numbers inline — always import from here.
//
// ── Terminology ──────────────────────────────────────────────────────────────
//
//  RESERVE TARGET
//    12-month liquidity required across the two bank-deposit buckets:
//    Operating Cash + Liquidity Reserve. Capital Build (goalSavings) is separate.
//    = troughDepth + operatingFloorAtTrough
//
//  LIQUIDITY RESERVE TARGET
//    The target balance for the Liquidity Reserve bucket specifically.
//    = reserveTarget − operatingTarget
//
//  OPERATING FLOOR AT TROUGH
//    2-month forward outflow baseline anchored to the trough month.
//    = outflows(troughMonth+1) + outflows(troughMonth+2)
//
//  OPERATING TARGET (today)
//    2-month forward outflow baseline from the bonus landing date.
//    = outflows(bonusMonth+1) + outflows(bonusMonth+2)
//
//  GOAL SAVINGS
//    Capital earmarked for a near-term expenditure (home purchase etc.).
//    Currently equals capitalBuild; TODO: derive from event planning data.
//
//  TOTAL LIQUIDITY REQUIREMENT = reserveTarget + goalSavings
//
//  EXCESS LIQUIDITY = totalLiquid − totalLiquidityReq

import type { Asset, CashFlow } from "@shared/schema";
import { computeCumulativeNCF, CF_MONTHS } from "./cashflow";

export function computeLiquidityTargets(
  assets: Asset[],
  cashFlows: CashFlow[],
  bonusDate: Date = new Date(2025, 11, 31), // Dec 31, 2025
): {
  operatingCash:           number;
  operatingTarget:         number;
  operatingExcess:         number;
  liquidityReserve:        number;
  reserveTarget:           number;          // full 12-month liquidity requirement
  liquidityReserveTarget:  number;          // Liquidity Reserve bucket target = reserveTarget − operatingTarget
  reserveExcess:           number;          // liquidityReserve above its own bucket target
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

  // Liquidity Reserve: bank deposit products (savings, money market)
  // same-day to T+1, FDIC-insured, yield-optimized
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

  // ── Trough — single source of truth from CF tab computation ──────────────
  const { troughIdx, troughDepth } = computeCumulativeNCF(cashFlows);

  // ── Operating floor AT the trough ────────────────────────────────────────
  // 2 months forward from the trough month (not from today).
  const fwd1 = CF_MONTHS[(troughIdx + 1) % CF_MONTHS.length];
  const fwd2 = CF_MONTHS[(troughIdx + 2) % CF_MONTHS.length];
  const operatingFloorAtTrough = monthOutflows(fwd1.year, fwd1.month)
                               + monthOutflows(fwd2.year, fwd2.month);

  // ── Reserve Target = total 12-month liquidity needed ─────────────────────
  const reserveTarget = troughDepth + operatingFloorAtTrough;

  // ── Operating target (today) ──────────────────────────────────────────────
  const bm  = bonusDate.getMonth();
  const bm1 = (bm + 1) % 12;
  const by1 = bm === 11 ? bonusDate.getFullYear() + 1 : bonusDate.getFullYear();
  const bm2 = (bm1 + 1) % 12;
  const by2 = bm1 === 11 ? by1 + 1 : by1;
  const operatingTarget = monthOutflows(by1, bm1 + 1) + monthOutflows(by2, bm2 + 1) || 63574;

  // ── Goal Savings ──────────────────────────────────────────────────────────
  // TODO: derive from event planning: max(0, eventAmount − projectedNCFtoEventDate)
  const goalSavings = capitalBuild;

  // ── Total Liquidity Requirement & Excess ─────────────────────────────────
  const totalLiquidityReq = reserveTarget + goalSavings;
  const excessLiquidity   = Math.max(0, totalLiquid - totalLiquidityReq);

  const operatingExcess = Math.max(0, operatingCash - operatingTarget);

  // ── Per-bucket targets ────────────────────────────────────────────────────
  const liquidityReserveTarget = Math.max(0, reserveTarget - operatingTarget);
  const reserveExcess          = Math.max(0, liquidityReserve - liquidityReserveTarget);

  const monthlyRate    = operatingTarget / 2;
  const coverageMonths = monthlyRate > 0 ? totalLiquid / monthlyRate : 0;

  return {
    operatingCash,    operatingTarget,         operatingExcess,
    liquidityReserve, reserveTarget,           liquidityReserveTarget,  reserveExcess,
    capitalBuild,     totalLiquid,
    goalSavings,      totalLiquidityReq,
    operatingFloorAtTrough, troughDepth,
    excessLiquidity, monthlyRate, coverageMonths,
  };
}
