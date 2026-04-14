/**
 * lib/finance/deductions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Payroll deductions and gross-to-net salary calculation.
 *
 * Think of this as the "Cash Flow — BB6:BB15" section of the Excel model.
 * It starts from GROSS salary and subtracts every deduction to arrive at
 * NET TAKE-HOME — the number that actually flows into the CF forecast as
 * "Michael — Net Monthly Salary" and "Sarah — Net Monthly Salary."
 *
 * FLOW (mirrors Excel BB column):
 *   Gross Annual Salary
 *   − Pre-tax deductions (reduce TAXABLE income before income tax is applied)
 *       401K employee contribution       (BB13)
 *       Health insurance premiums        (BB12)
 *   = Taxable Gross (for income tax calculation)
 *   − Income taxes
 *       Federal income tax               (BB8 × taxable gross)
 *       State income tax                 (BB7 × taxable gross)
 *       City income tax                  (BB6 × taxable gross)
 *   − FICA taxes (computed on raw gross, NOT reduced by pre-tax deductions)
 *       Social Security                  (BB10 — flat annual cap ~$9,932)
 *       Medicare                         (BB11 — 2.45% uncapped)
 *   = Annual Net Take-Home
 *   ÷ 12
 *   = Monthly Net Salary (goes into CF forecast income rows)
 *
 * Source: Prototype_Model_v4.xlsx → Cash Flow tab, column BB, rows 6–15
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { EffectiveTaxRates } from "./returns";

// ── Default deduction values (Kessler profile) ────────────────────────────────
// Source: Prototype_Model_v4.xlsx → Cash Flow tab BB10:BB14
//
// These are EMPLOYEE-SIDE payroll deductions only.
// Employer-side matching (401K match, employer health premium) is NOT included —
// those are compensation cost to the employer, not a deduction from employee pay.

// BB10 — Social Security (OASDI)
// 6.2% employee rate × SS wage base. 2026 wage base ≈ $176,100 → cap ≈ $10,918.
// Kessler-specific value from model: ~$9,932 (reflects actual reported wages).
export const DEFAULT_SS_CAP_ANNUAL    = 9_932;   // flat dollar — capped once gross hits wage base

// BB11 — Medicare (HI)
// 1.45% standard employee rate + 0.9% Additional Medicare Tax on wages > $200K (single)
// or > $250K (MFJ). NYC high-income = 1.45% + 1.0% = 2.45% effective.
export const DEFAULT_MEDICARE_RATE    = 0.0245;  // 2.45% — matches Excel BB11

// BB12 — Health Insurance (employee premium, pre-tax)
// Annual employee-paid portion of employer health plan. Pre-tax → reduces taxable income.
export const DEFAULT_HEALTH_INS_ANNUAL = 15_000; // $15,000/yr (BB12)

// BB13 — 401K employee elective deferral (pre-tax)
// 2026 IRS limit: $23,500 standard + $7,500 catch-up if age 50+.
// Kessler profile uses standard limit.
export const DEFAULT_401K_ANNUAL      = 23_000;  // $23,000/yr (BB13)

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * PayrollDeductionsProfile — all the per-person payroll deduction inputs.
 * These are the "BB6:BB15" inputs for a single earner.
 *
 * In the Excel model this table lives once (per client) and applies to each
 * earner row. In code we can store per-person overrides if needed, but the
 * default applies to both partners.
 */
export interface PayrollDeductionsProfile {
  // Pre-tax deductions (reduce taxable income before income tax)
  contribution401kAnnual:   number;  // BB13 — 401K elective deferral ($23,000)
  healthInsuranceAnnual:    number;  // BB12 — employee health premium ($15,000)

  // FICA (applied to gross wages, NOT reduced by pre-tax deductions)
  socialSecurityCapAnnual:  number;  // BB10 — annual SS cap ($9,932)
  medicareRate:             number;  // BB11 — Medicare rate as decimal (0.0245)
}

/**
 * GrossToNetBreakdown — full decomposition of gross → net for one earner.
 * The `netAnnual` field is the number that feeds the CF forecast salary rows.
 */
export interface GrossToNetBreakdown {
  // Inputs
  grossAnnual:              number;

  // Pre-tax deductions (these come OFF before income tax is computed)
  contribution401kAnnual:   number;
  healthInsuranceAnnual:    number;
  totalPreTaxDeductions:    number;

  // Taxable gross (for income tax purposes)
  taxableGross:             number;

  // Income taxes (applied to taxableGross)
  federalTax:               number;
  stateTax:                 number;
  cityTax:                  number;
  totalIncomeTax:           number;

  // FICA taxes (applied to raw gross, not reduced by pre-tax)
  socialSecurity:           number;
  medicare:                 number;
  totalFICA:                number;

  // Totals
  totalDeductions:          number;  // BB14 = preTax + incomeTax + FICA
  netAnnual:                number;  // grossAnnual − totalDeductions → feeds CF forecast
  netMonthly:               number;  // netAnnual ÷ 12 → "Net Monthly Salary" in P&L
  effectiveTotalRate:       number;  // totalDeductions / grossAnnual (e.g. 0.5439 = 54.39%)
}

// ── Core Function: computeGrossToNet ─────────────────────────────────────────

/**
 * Full gross-to-net calculation for one earner.
 *
 * @param grossAnnual     - Annual gross salary (e.g. 500_000)
 * @param taxRates        - From deriveTaxRates() — one source of truth for income tax rates
 * @param deductions      - Per-person deduction inputs (defaults to Kessler profile if omitted)
 *
 * @returns GrossToNetBreakdown — full line-by-line waterfall, same structure as Excel BB column
 *
 * Example (Kessler, $500K gross):
 *   Gross:              $500,000
 *   − 401K:             ($23,000)   pre-tax
 *   − Health Ins:       ($15,000)   pre-tax
 *   = Taxable Gross:    $462,000
 *   − Federal (35%):   ($161,700)
 *   − State (8%):       ($36,960)
 *   − City (4%):        ($18,480)
 *   − Social Security:   ($9,932)   on gross $500K, capped
 *   − Medicare (2.45%): ($12,250)   on gross $500K, uncapped
 *   = Net Annual:       $247,678
 *   ÷ 12 = Net Monthly:  $20,640
 */
export function computeGrossToNet(
  grossAnnual:   number,
  taxRates:      EffectiveTaxRates,
  deductions?:   Partial<PayrollDeductionsProfile>,
): GrossToNetBreakdown {
  // Merge provided deductions with defaults
  const d: PayrollDeductionsProfile = {
    contribution401kAnnual:  deductions?.contribution401kAnnual  ?? DEFAULT_401K_ANNUAL,
    healthInsuranceAnnual:   deductions?.healthInsuranceAnnual   ?? DEFAULT_HEALTH_INS_ANNUAL,
    socialSecurityCapAnnual: deductions?.socialSecurityCapAnnual ?? DEFAULT_SS_CAP_ANNUAL,
    medicareRate:            deductions?.medicareRate            ?? DEFAULT_MEDICARE_RATE,
  };

  // Pre-tax deductions — reduce taxable income
  const totalPreTaxDeductions = d.contribution401kAnnual + d.healthInsuranceAnnual;
  const taxableGross          = Math.max(0, grossAnnual - totalPreTaxDeductions);

  // Income taxes — applied to taxableGross (NOT gross)
  const federalTax  = taxableGross * taxRates.federal;
  const stateTax    = taxableGross * taxRates.state;
  const cityTax     = taxableGross * taxRates.city;
  const totalIncomeTax = federalTax + stateTax + cityTax;

  // FICA — applied to raw gross (pre-tax deductions do NOT reduce SS/Medicare base)
  const socialSecurity = d.socialSecurityCapAnnual;                    // flat cap
  const medicare       = grossAnnual * d.medicareRate;                 // uncapped
  const totalFICA      = socialSecurity + medicare;

  // Totals
  const totalDeductions     = totalPreTaxDeductions + totalIncomeTax + totalFICA;
  const netAnnual           = Math.round(grossAnnual - totalDeductions);
  const netMonthly          = Math.round(netAnnual / 12);
  const effectiveTotalRate  = grossAnnual > 0 ? totalDeductions / grossAnnual : 0;

  return {
    grossAnnual,
    contribution401kAnnual:   d.contribution401kAnnual,
    healthInsuranceAnnual:    d.healthInsuranceAnnual,
    totalPreTaxDeductions,
    taxableGross,
    federalTax:               Math.round(federalTax),
    stateTax:                 Math.round(stateTax),
    cityTax:                  Math.round(cityTax),
    totalIncomeTax:           Math.round(totalIncomeTax),
    socialSecurity:           Math.round(socialSecurity),
    medicare:                 Math.round(medicare),
    totalFICA:                Math.round(totalFICA),
    totalDeductions:          Math.round(totalDeductions),
    netAnnual,
    netMonthly,
    effectiveTotalRate,
  };
}

// ── Convenience shorthand ─────────────────────────────────────────────────────

/**
 * Returns ONLY the monthly net salary — the number that goes into the CF
 * forecast as "Michael — Net Monthly Salary" or "Sarah — Net Monthly Salary."
 *
 * This is the connection point between the deductions engine and the P&L table.
 * The CF_PL_ROWS entry for michael_salary matches on description "Monthly Net Salaries"
 * which the seed data populates with the value from this function.
 */
export function monthlyNetSalary(
  grossAnnual:  number,
  taxRates:     EffectiveTaxRates,
  deductions?:  Partial<PayrollDeductionsProfile>,
): number {
  return computeGrossToNet(grossAnnual, taxRates, deductions).netMonthly;
}

// ── Default deductions profile (Kessler) ─────────────────────────────────────
// Pre-built defaults — use when no per-client overrides are available.
export const DEFAULT_DEDUCTIONS_PROFILE: PayrollDeductionsProfile = {
  contribution401kAnnual:   DEFAULT_401K_ANNUAL,
  healthInsuranceAnnual:    DEFAULT_HEALTH_INS_ANNUAL,
  socialSecurityCapAnnual:  DEFAULT_SS_CAP_ANNUAL,
  medicareRate:             DEFAULT_MEDICARE_RATE,
};
