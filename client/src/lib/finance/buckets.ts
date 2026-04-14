// ─── Asset bucket classification ─────────────────────────────────────────────
// Pure functions — no React, no DB calls. Used by liquidity, returns, and GI tabs.

import type { Asset } from "@shared/schema";

// ─── assetBucketKey ───────────────────────────────────────────────────────────
// Maps an asset to its GURU bucket key. Used by liquidAssetYields and
// computeMonthlyBucketInterest to group assets by liquidity tier.
export function assetBucketKey(a: Asset): "reserve" | "yield_" | "tactical" | "growth" | "alts" {
  const d = (a.description ?? "").toLowerCase();
  if (a.type === "cash") return d.includes("checking") ? "reserve" : "yield_";
  if (a.type === "fixed_income")
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
    const desc = (a.description ?? "").toLowerCase();
    const val = Number(a.value);
    const lbl = (a.description ?? "")
      .split("(")[0]
      .split("—")[0]
      .split("–")[0]
      .trim();
    if (a.type === "cash") {
      if (desc.includes("checking")) {
        reserve += val;
        reserveItems.push({ label: lbl, value: val });
      } else {
        yieldBucket += val;
        yieldItems.push({ label: lbl, value: val });
      }
    } else if (a.type === "fixed_income") {
      // Capital Build: all non-retirement fixed income
      // Matches computeLiquidityTargets() capitalBuild filter exactly
      if (!/401|ira|roth/i.test(a.description ?? "")) {
        tactical += val;
        tacticalItems.push({ label: lbl, value: val });
      } else {
        growth += val;
        growthItems.push({ label: lbl, value: val });
      }
    } else if (a.type === "equity") {
      if (
        desc.includes("rsu") ||
        desc.includes("unvested") ||
        desc.includes("carry")
      ) {
        alts += val;
        altItems.push({ label: lbl, value: val });
      } else {
        growth += val;
        growthItems.push({ label: lbl, value: val });
      }
    } else if (a.type === "alternative") {
      alts += val;
      altItems.push({ label: lbl, value: val });
    } else if (a.type === "real_estate") {
      alts += val;
      altItems.push({ label: lbl, value: val });
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
