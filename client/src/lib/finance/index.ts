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

// Forecast & net-worth timeline builders
export * from "./forecast";

// Asset bucket classification (cashBuckets, assetBucketKey)
export * from "./buckets";

// Cash-flow P&L engine (CF_PL_ROWS, CF_MONTHS, PLRowDef, computeCumulativeNCF, etc.)
export * from "./cashflow";

// Liquidity target calculations (computeLiquidityTargets)
export * from "./liquidity";

// After-tax yield & return optimization (computeReturnOptimization, liquidAssetYields, etc.)
export * from "./returns";

// Balance sheet grouping & categorization
export * from "./balancesheet";

// Monthly running balance simulation (computeMonthlyBalances)
export * from "./balances";

// Payroll deductions & gross-to-net salary (computeGrossToNet, monthlyNetSalary)
export * from "./deductions";
