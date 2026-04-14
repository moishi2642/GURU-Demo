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

import type { Asset, AssetReturn, ClientTaxProfile } from "@shared/schema";

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
