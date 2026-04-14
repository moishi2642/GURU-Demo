// ─── Asset bucket classification ─────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for all asset-to-bucket mapping.
// Both cashBuckets() and computeLiquidityTargets() call these predicates.
// Never duplicate this logic inline elsewhere — always import from here.
//
// Liquidity tier predicates:
//   isOperatingCash    → checking accounts (same-day, no yield)
//   isLiquidityReserve → bank deposit products (savings, money market, T+1)
//   isCapitalBuild     → non-retirement fixed income (treasuries, CDs, munis)
//
// These three predicates map exactly to the three liquid buckets in
// computeLiquidityTargets. The retirement exclusion (401k/IRA/Roth) keeps
// long-horizon illiquid accounts out of the liquidity model.

import type { Asset } from "@shared/schema";

// ── Liquidity-tier predicates (used by cashBuckets AND computeLiquidityTargets) ──
export const isOperatingCash    = (a: Asset) =>
  a.type === "cash" && (a.description ?? "").toLowerCase().includes("checking");

export const isLiquidityReserve = (a: Asset) =>
  a.type === "cash" && !(a.description ?? "").toLowerCase().includes("checking");

export const isCapitalBuild     = (a: Asset) =>
  a.type === "fixed_income" && !/401|ira|roth/i.test(a.description ?? "");

// ─── assetBucketKey ───────────────────────────────────────────────────────────
// Maps an asset to its GURU bucket key. Used by liquidAssetYields and
// computeMonthlyBucketInterest to group assets by liquidity tier.
export function assetBucketKey(a: Asset): "reserve" | "yield_" | "tactical" | "growth" | "alts" {
  const d = (a.description ?? "").toLowerCase();
  if (isOperatingCash(a))    return "reserve";
  if (isLiquidityReserve(a)) return "yield_";
  if (isCapitalBuild(a))
    return d.includes("treasur") || d.includes("t-bill") || d.includes("short") ? "tactical" : "growth";
  if (a.type === "equity")
    return d.includes("rsu") || d.includes("unvested") || d.includes("carry") ? "alts" : "growth";
  return "alts"; // alternative, real_estate
}

// ─── cashBuckets ──────────────────────────────────────────────────────────────
// Sorts assets into the 5 GURU buckets and returns totals + itemized lists.
// Used by GuruLandingView, BalanceSheetView, and the allocation tool.
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
    const lbl = (a.description ?? "").split("(")[0].split("—")[0].split("–")[0].trim();
    const bucket = assetBucketKey(a);
    switch (bucket) {
      case "reserve":  reserve     += val; reserveItems.push({ label: lbl, value: val });  break;
      case "yield_":   yieldBucket += val; yieldItems.push({ label: lbl, value: val });    break;
      case "tactical": tactical    += val; tacticalItems.push({ label: lbl, value: val }); break;
      case "growth":   growth      += val; growthItems.push({ label: lbl, value: val });   break;
      case "alts":     alts        += val; altItems.push({ label: lbl, value: val });      break;
    }
  }

  const totalLiquid = reserve + yieldBucket + tactical;
  // Backward-compat aliases
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
