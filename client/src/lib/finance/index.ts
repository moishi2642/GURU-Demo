/**
 * lib/finance/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single entry point for all finance calculation functions.
 *
 * Views import from here:
 *   import { computeMonthlyCF, computeCFRowValues } from "@/lib/finance";
 *   import { computeBucketTotals, groupLiabilities } from "@/lib/finance";
 *   import { lookupAssetReturn, getTaxRates }        from "@/lib/finance";
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Cash flow calculations (Model Tab: Cash Flow)
export * from "./cashflow";

// Asset performance & yield calculations (Model Tab: Returns)
export * from "./returns";

// Balance sheet grouping & categorization (Model Tab: Balance Sheet)
export * from "./balancesheet";
