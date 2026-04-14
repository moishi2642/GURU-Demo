/**
 * lib/finance/returns.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Asset performance and yield calculation logic.
 *
 * Think of this as the "Returns & Yield Model Tab" in an Excel model.
 * It takes asset records + client tax profile → produces after-tax yield
 * calculations and performance labels for display.
 *
 * INPUTS:  Asset[], ClientTaxProfile, AssetReturn[]
 * OUTPUTS: After-tax yields, weighted portfolio returns, performance labels
 *
 * Replaces:
 *   - ASSET_RETURNS hardcoded array (~30 entries)
 *   - BANK_TAX, TREAS_TAX, LTCG_TAX hardcoded constants
 *   - PROFORMA_AT hardcoded object
 *   - parseYieldFromDesc() function (still kept in dashboard for compatibility)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Asset, AssetReturn, CashFlow, ClientTaxProfile } from "@shared/schema";
import { computeLiquidityTargets } from "./liquidity";
import { buildForecast } from "./forecast";
import { assetBucketKey } from "./buckets";

// ── Default tax rates (fallback if no DB profile exists) ─────────────────────
// These match the Kessler profile but are labeled clearly as defaults.

const DEFAULT_TAX = {
  combined:  0.47,  // NYC: federal 37% + state/local 10%
  treasury:  0.35,  // Federal only — US Treasuries are state-tax-exempt
  ltcg:      0.20,  // Long-term capital gains (federal)
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaxRates {
  combined:  number;  // ordinary income: federal + state/local
  treasury:  number;  // treasury income: federal only
  ltcg:      number;  // long-term capital gains
}

export interface AfterTaxYields {
  /** After-tax yield on bank/money market deposits (ordinary income rate) */
  bankDeposit: number;
  /** After-tax yield on US Treasuries (federal-only rate) */
  treasury: number;
  /** After-tax return on equity/investment portfolio (LTCG rate) */
  equity: number;
  /** Pro-forma checking yield (essentially 0) */
  checking: number;
}

export interface AssetReturnLabel {
  label:      string;   // e.g. "+14.2%", "3.65% yield", "12.4% IRR"
  returnType: string;   // "equity_return" | "yield" | "irr" | "pe_carry"
}

// ── Core Function: getTaxRates ────────────────────────────────────────────────

/**
 * Extracts tax rates from the client's DB profile.
 * Falls back to DEFAULT_TAX if no profile is available.
 */
export function getTaxRates(taxProfile: ClientTaxProfile | null): TaxRates {
  if (!taxProfile) return DEFAULT_TAX;
  return {
    combined: Number(taxProfile.combinedOrdinaryRate),
    treasury: Number(taxProfile.treasuryTaxRate),
    ltcg:     Number(taxProfile.ltcgRate),
  };
}

// ── Core Function: computeAfterTaxYields ─────────────────────────────────────

/**
 * Computes pro-forma after-tax yields for the three main asset categories.
 * Previously hardcoded as PROFORMA_AT in the dashboard.
 *
 * Example for NYC client:
 *   Bank deposit  4.30% gross × (1 − 0.47) = 2.28% after-tax
 *   Treasury      4.30% gross × (1 − 0.35) = 2.80% after-tax (state-exempt)
 *   Equity        10.0% gross × (1 − 0.20) = 8.00% after-tax
 */
export function computeAfterTaxYields(
  taxProfile: ClientTaxProfile | null,
  grossRates: { bankDeposit: number; treasury: number; equity: number; checking: number }
): AfterTaxYields {
  const tax = getTaxRates(taxProfile);
  return {
    bankDeposit: grossRates.bankDeposit * (1 - tax.combined),
    treasury:    grossRates.treasury    * (1 - tax.treasury),
    equity:      grossRates.equity      * (1 - tax.ltcg),
    checking:    grossRates.checking,   // effectively 0, no meaningful tax impact
  };
}

// ── Core Function: lookupAssetReturn ─────────────────────────────────────────

/**
 * Finds the performance/yield label for a given asset description.
 * Matches by lowercase substring, lowest sort_priority wins.
 *
 * Previously: ASSET_RETURNS was a hardcoded 30-entry array in the dashboard.
 * Now: rules come from the asset_returns DB table, ordered by sort_priority.
 *
 * Returns null if no match found.
 */
export function lookupAssetReturn(
  description: string,
  assetReturns: AssetReturn[]
): AssetReturnLabel | null {
  const desc = description.toLowerCase();
  // assetReturns is already sorted by sort_priority ascending (from DB query)
  for (const row of assetReturns) {
    if (desc.includes(row.matchPattern.toLowerCase())) {
      return { label: row.returnLabel, returnType: row.returnType };
    }
  }
  return null;
}

// ── Core Function: computeWeightedYield ──────────────────────────────────────

/**
 * Computes the weighted average after-tax yield across a group of assets.
 * Used in balance sheet institution rows to show blended portfolio yield.
 *
 * For equity assets: uses LTCG rate
 * For cash/fixed income: uses combined ordinary rate
 */
export function computeWeightedYield(
  assets: Asset[],
  assetReturns: AssetReturn[],
  taxProfile: ClientTaxProfile | null
): number | null {
  const tax    = getTaxRates(taxProfile);
  let totalVal = 0;
  let wtdSum   = 0;
  let hasData  = false;

  for (const asset of assets) {
    const val    = Number(asset.value);
    const match  = lookupAssetReturn(asset.description ?? "", assetReturns);
    if (!match) continue;

    // Parse the gross rate from the label (e.g. "+14.2%" → 0.142)
    const raw    = match.label.replace(/[^0-9.]/g, "");
    const gross  = parseFloat(raw) / 100;
    if (isNaN(gross) || gross === 0) continue;

    // Apply the right tax rate based on return type
    const taxRate = match.returnType === "yield" ? tax.combined
                  : match.returnType === "irr"   ? 0           // IRR shown pre-tax
                  : tax.ltcg;                                   // equity

    const atYield = gross * (1 - taxRate);
    wtdSum   += atYield * val;
    totalVal += val;
    hasData   = true;
  }

  if (!hasData || totalVal === 0) return null;
  return wtdSum / totalVal;
}

// ── Utility: formatAfterTaxYield ─────────────────────────────────────────────

/**
 * Formats an after-tax yield as a display string.
 * e.g. 0.0228 → "2.28% AT"
 */
export function formatAfterTaxYield(atYield: number | null): string | null {
  if (atYield === null) return null;
  return `${(atYield * 100).toFixed(2)}% AT`;
}

// ─── Full tax rate matrix by instrument type ──────────────────────────────────
// Source of truth for all after-tax yield calculations.
// Replaces the three hardcoded constants (BANK_TAX, TREAS_TAX, LTCG_TAX).
// Reads from client_tax_profiles DB row when available; falls back to Kessler defaults.
//
// ── Instrument tax treatment (NYC resident example) ───────────────────────────
//   Bank deposits / Money Market Accounts:  Fed 37% + State 8% + City 4% = 47%  (ordinary, all jurisdictions)
//   100% Treasury MMFs (SPAXX/VMFXX etc):  Fed 37% only = 35% effective         (state + city exempt)
//   T-bills / Treasuries direct:            Fed 37% only = 35% effective         (state + city exempt)
//   Muni bonds (in-state):                  0%                                   (triple tax-exempt)
//   Muni bonds (out-of-state):              Fed 37% only = 35%                   (state exempt, city not)
//   Equities / ETFs:                        LTCG 20%                             (long-term capital gains)
//   Private equity / carried interest:      LTCG 20%                             (same as equity)
//
// NOTE: muniRate is 0 for in-state munis and should come from the DB once
// client_tax_profiles adds a muni_rate column (currently missing — TODO).

// ── Fallback tax rates (Kessler — NYC, married filing jointly) ────────────────
// Source: Prototype_Model_v4.xlsx → Cash Flow tab BB6:BB15
// Used ONLY when taxProfile is not available from the DB.
// In production, always read from clientTaxProfiles (federalRate, stateRate, cityRate, etc.)
//
// COMPONENT RATES:
export const FEDERAL_RATE   = 0.35;    // 35% — federal ordinary income (BB8)
export const STATE_RATE     = 0.08;    // 8%  — NY state income tax      (BB7)
export const CITY_RATE      = 0.04;    // 4%  — NYC city income tax       (BB6)
export const LTCG_RATE      = 0.20;    // 20% — long-term capital gains   (BB15)
//
// DERIVED RATES (= formula, not separate inputs):
export const BANK_TAX       = FEDERAL_RATE + STATE_RATE + CITY_RATE; // 0.47 = combined ordinary (BB9)
export const TREAS_TAX      = FEDERAL_RATE;                           // 0.35 = federal only (state/city exempt)
export const MUNI_TAX       = 0.00;    // 0%  — in-state munis, triple tax-exempt
export const LTCG_TAX       = LTCG_RATE; // alias for backward compat

export const INVEST_GROSS   = 0.10;    // 10% — assumed gross investment portfolio return
export const CHECKING_GROSS = 0.0001;  // 0.01% — actual checking yield (effectively 0)

// ── deriveTaxRates ────────────────────────────────────────────────────────────
// Single function to derive all effective tax rates from a client's tax profile.
// This is the one place that implements: combined = fed + state + city,
// treasury = fed only, muni = 0.
// All other functions call this — never derive rates inline.
export interface EffectiveTaxRates {
  federal:    number;  // federal ordinary income rate (e.g. 0.35)
  state:      number;  // state income tax rate        (e.g. 0.08)
  city:       number;  // city/local income tax rate   (e.g. 0.04)
  combined:   number;  // bank/MMA: fed+state+city     (e.g. 0.47) — all jurisdictions tax
  treasury:   number;  // treasury: fed only           (e.g. 0.35) — state+city exempt
  muni:       number;  // muni bonds: 0%              (e.g. 0.00) — triple tax-exempt
  ltcg:       number;  // long-term capital gains      (e.g. 0.20)
}

export function deriveTaxRates(taxProfile?: ClientTaxProfile | null): EffectiveTaxRates {
  if (taxProfile) {
    const federal  = Number(taxProfile.federalRate ?? FEDERAL_RATE);
    const state    = Number(taxProfile.stateRate   ?? 0);
    const city     = Number(taxProfile.cityRate    ?? 0);
    const ltcg     = Number(taxProfile.ltcgRate    ?? LTCG_RATE);
    const muni     = Number(taxProfile.muniRate    ?? 0);
    return {
      federal,
      state,
      city,
      combined:  Number(taxProfile.combinedOrdinaryRate ?? (federal + state + city)),
      treasury:  Number(taxProfile.treasuryTaxRate      ?? federal),
      muni,
      ltcg,
    };
  }
  // Fallback: Kessler defaults
  return {
    federal:  FEDERAL_RATE,
    state:    STATE_RATE,
    city:     CITY_RATE,
    combined: BANK_TAX,
    treasury: TREAS_TAX,
    muni:     MUNI_TAX,
    ltcg:     LTCG_RATE,
  };
}

// ── computeProformaATYields ───────────────────────────────────────────────────
// Best available product yields per bucket, CALCULATED from tax rates.
// Gross product yields sourced from OPTIMIZER tab of Prototype_Model_v4.xlsx:
//   Checking / MMA (bank deposit):  CIT Money Market Fund         4.31% gross
//   Reserve (treasury MMF):         JPMorgan 100% Treasury MMF    4.30% gross
//   Capital Build (equity index):   Growth equity market ETFs     7.00% gross
//   Equity portfolio:               Diversified growth portfolio   10.0% gross
//
// AT yield = gross × (1 − applicable_tax_rate)
// Tax rates come from deriveTaxRates() — one source of truth.
export interface ProformaATYields {
  checking: number;  // bank deposit AT yield
  reserve:  number;  // treasury MMF AT yield
  capital:  number;  // equity index AT yield
  equity:   number;  // diversified portfolio AT yield
}

export const PROFORMA_GROSS = {
  checking: 0.0431,  // CIT Money Market Fund (OPTIMIZER AW24)
  reserve:  0.0430,  // JPMorgan 100% Treasury MMF (OPTIMIZER AW25)
  capital:  0.0700,  // Growth equity market ETFs (OPTIMIZER AW27)
  equity:   INVEST_GROSS, // 10.0% assumed gross portfolio return
} as const;

export function computeProformaATYields(taxProfile?: ClientTaxProfile | null): ProformaATYields {
  const r = deriveTaxRates(taxProfile);
  return {
    checking: PROFORMA_GROSS.checking * (1 - r.combined),  // bank deposit: all jurisdictions
    reserve:  PROFORMA_GROSS.reserve  * (1 - r.treasury),  // treasury MMF: federal only
    capital:  PROFORMA_GROSS.capital  * (1 - r.ltcg),      // equity index: LTCG rate
    equity:   PROFORMA_GROSS.equity   * (1 - r.ltcg),      // portfolio: LTCG rate
  };
}

// Legacy constant — kept for backward compat with callers not yet updated.
// New code should call computeProformaATYields(taxProfile) instead.
export const PROFORMA_AT = computeProformaATYields(null);

// ── Per-account yield lookup map (current holdings) ───────────────────────────
// Maps asset descriptions → actual gross yield and applicable keep-rate.
// keepRate = (1 − effectiveTaxRate) using the correct jurisdiction for each product type.
// Used by liquidAssetYields() to compute weighted AT yields across a bucket.
export const LIQUID_YIELD_MAP: Array<{ test: (d: string) => boolean; pretax: number; keepRate: number }> = [
  { test: d => d.includes("capital one") || d.includes("360 performance"),  pretax: 3.78, keepRate: 1 - BANK_TAX  },  // bank deposit (combined rate)
  { test: d => d.includes("citizens") && d.includes("money market"),        pretax: 3.65, keepRate: 1 - BANK_TAX  },  // bank deposit (combined rate)
  { test: d => d.includes("fidelity") && (d.includes("money market") || d.includes("spaxx") || d.includes("cash sweep")), pretax: 2.50, keepRate: 1 - TREAS_TAX }, // treasury MMF (fed only)
  { test: d => d.includes("treasur") || d.includes("t-bill"),               pretax: 3.95, keepRate: 1 - TREAS_TAX },  // direct treasury (fed only)
  { test: d => d.includes("muni"),                                           pretax: 3.50, keepRate: 1 - MUNI_TAX  },  // muni bond (triple exempt = 0%)
  { test: d => d.includes("checking"),                                       pretax: 0.01, keepRate: 1 - BANK_TAX  },  // checking (combined rate)
];

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

export function parseYieldFromDesc(description: string): number | null {
  const m = (description ?? "").match(/(\d+\.?\d*)%/);
  return m ? parseFloat(m[1]) / 100 : null;
}

// ─── liquidAssetYields ────────────────────────────────────────────────────────
// Weighted average pre-tax + after-tax yield across a group of assets.
// Used by computeMonthlyBucketInterest to tie interest income across tabs.
export function liquidAssetYields(bucketAssets: Asset[]): { pretax: number; at: number } {
  let wPre = 0, wAt = 0, vSum = 0;
  for (const a of bucketAssets) {
    const d = (a.description ?? "").toLowerCase();
    const v = Number(a.value);
    if (v <= 0) continue;
    const match = LIQUID_YIELD_MAP.find(m => m.test(d));
    if (match) { wPre += v * match.pretax; wAt += v * match.pretax * match.keepRate; vSum += v; }
  }
  if (vSum === 0) return { pretax: 0, at: 0 };
  return { pretax: wPre / vSum / 100, at: wAt / vSum / 100 };
}

// ─── computeMonthlyBucketInterest ─────────────────────────────────────────────
// Compute 12 monthly After-Tax interest amounts for all three liquid buckets.
// Returns array of length 12 (Jan–Dec). Feeds Asset Forecast and CF Forecast tabs.
// 1-year T-bill pays at maturity (December only, index 11).
export function computeMonthlyBucketInterest(assets: Asset[], cashFlows: CashFlow[]): number[] {
  const { operatingCash, liquidityReserve, capitalBuild } = computeLiquidityTargets(assets, cashFlows);
  const opYields  = liquidAssetYields(assets.filter(a => assetBucketKey(a) === "reserve"));
  const rsvYields = liquidAssetYields(assets.filter(a => assetBucketKey(a) === "yield_"));
  const bldYields = liquidAssetYields(assets.filter(a => assetBucketKey(a) === "tactical"));

  const forecast = buildForecast(cashFlows);
  let opsBal = operatingCash;
  return Array.from({ length: 12 }, (_, i) => {
    const { inflow, outflow } = forecast[i];
    const opsEnd = opsBal + inflow - outflow;
    const opsAtInt = Math.max(0, opsEnd) * (opYields.at / 12);
    opsBal = opsEnd;
    const rsvAtInt = liquidityReserve * (rsvYields.at / 12);
    const bldAtInt = i === 11 ? capitalBuild * bldYields.at : 0;
    return opsAtInt + rsvAtInt + bldAtInt;
  });
}

// ─── computeReturnOptimization ────────────────────────────────────────────────
// Computes current vs. pro-forma after-tax annual income across all liquid,
// non-retirement accounts. Drives the GURU Allocation tab's annualPickup figure.
//
// Tax rates read from DB profile when available; fall back to hardcoded constants.
// Pro-forma uses the highest AT yield from BUCKET_PRODUCTS for each GURU bucket.
export function computeReturnOptimization(assets: Asset[], cashFlows?: CashFlow[], taxProfile?: ClientTaxProfile | null): {
  accounts:             ReturnAccountDetail[];
  currentAnnualIncome:  number;
  proformaAnnualIncome: number;
  annualPickup:         number;
} {
  // All tax rates derived from one source of truth — deriveTaxRates()
  const tax = deriveTaxRates(taxProfile);
  const proformaAT = computeProformaATYields(taxProfile);
  const bankTax  = tax.combined;
  const treasTax = tax.treasury;
  const ltcgTax  = tax.ltcg;

  const accounts: ReturnAccountDetail[] = [];

  for (const a of assets) {
    const rawDesc = a.description ?? "";
    const desc    = rawDesc.toLowerCase();
    const balance = Number(a.value ?? 0);
    if (balance <= 0) continue;

    if (a.type === "real_estate")         continue;
    if (a.type === "alternative")         continue;
    if (/401|ira|roth/i.test(rawDesc))    continue;
    if (/rsu|unvested|carry/i.test(desc)) continue;

    let bucket: ReturnAccountDetail["bucket"];
    let grossYield: number;
    let taxRate: number;

    if (a.type === "cash") {
      if (desc.includes("checking")) {
        bucket     = "checking";
        grossYield = CHECKING_GROSS;
        taxRate    = bankTax;
      } else {
        bucket     = "reserve";
        grossYield = parseYieldFromDesc(rawDesc) ?? CHECKING_GROSS;
        taxRate    = bankTax;
      }
    } else if (a.type === "fixed_income") {
      bucket     = "capital";
      grossYield = parseYieldFromDesc(rawDesc) ?? 0.035;
      taxRate    = treasTax;
    } else if (a.type === "equity") {
      bucket     = "equity";
      grossYield = INVEST_GROSS;
      taxRate    = ltcgTax;
    } else {
      continue;
    }

    const currentATYield  = grossYield * (1 - taxRate);
    const proformaATYield = proformaAT[bucket];

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
    // Target-based pro-forma: each bucket sized to its target;
    // excess cash deployed to new investments at equity rate.
    const {
      operatingTarget,
      liquidityReserveTarget,
      capitalBuild: capitalBuildBal,
      excessLiquidity,
    } = computeLiquidityTargets(assets, cashFlows);

    const equityProforma = accounts
      .filter(a => a.bucket === "equity")
      .reduce((s, a) => s + a.proformaATIncome, 0);

    proformaAnnualIncome = Math.round(
      operatingTarget        * proformaAT.checking +
      liquidityReserveTarget * proformaAT.reserve  +
      capitalBuildBal        * proformaAT.capital  +
      equityProforma                               +
      excessLiquidity        * proformaAT.equity
    );
  } else {
    proformaAnnualIncome = accounts.reduce((s, a) => s + a.proformaATIncome, 0);
  }

  const annualPickup = proformaAnnualIncome - currentAnnualIncome;

  return { accounts, currentAnnualIncome, proformaAnnualIncome, annualPickup };
}
