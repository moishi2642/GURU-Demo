/**
 * lib/finance/balancesheet.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Balance sheet grouping and categorization logic.
 *
 * Think of this as the "Balance Sheet Model Tab" — it takes raw asset and
 * liability records from the database and organizes them into the structured
 * groups the views need to render (by GURU bucket, by institution, etc.)
 *
 * INPUTS:  Asset[], Liability[], Account[]
 * OUTPUTS: Typed group structures ready for display
 *
 * No display code. No hardcoded client names.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Asset, Liability, Account } from "@shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

/** GURU's five allocation buckets + operating */
export type GuruBucket =
  | "operating"       // checking accounts — instant liquidity
  | "reserve"         // savings / money market — same-day liquidity
  | "capital_build"   // Treasuries, T-bills, fixed income — short-term
  | "investments"     // equities, brokerage accounts — long-term growth
  | "alternatives"    // private equity, hedge funds, illiquid
  | "retirement"      // 401k, IRA, Roth — tax-advantaged
  | "real_estate";    // primary residence + investment property

export interface BucketTotals {
  operating:    number;
  reserve:      number;
  capital_build: number;
  investments:  number;
  alternatives: number;
  retirement:   number;
  real_estate:  number;
  total:        number;
}

export interface InstitutionGroup {
  institution: string;
  total: number;
  assets: Asset[];
  accountNumber?: string;    // from accounts table (e.g. "****7842")
  isAdvisorManaged: boolean;
}

export interface LiabilityGroup {
  category: string;
  items: Array<{
    description: string;
    value: number;
    interestRate: number;
  }>;
  subtotal: number;
  avgRate: number | null;
}

// ── Bucket Classification ─────────────────────────────────────────────────────

/**
 * Assigns a GURU bucket to an asset based on its type and description.
 *
 * Classification rules (from CONTEXT.md — single source of truth):
 *   operating     = type="cash" AND description includes "checking"
 *   reserve       = type="cash" AND NOT "checking"
 *   capital_build = type="fixed_income" AND NOT retirement keywords
 *   investments   = type="equity"
 *   alternatives  = type="alternative"
 *   retirement    = any type with retirement keywords (401k, IRA, roth)
 *   real_estate   = type="real_estate"
 */
export function classifyAssetBucket(asset: Asset): GuruBucket {
  const desc = (asset.description ?? "").toLowerCase();
  const type = (asset.type ?? "").toLowerCase();

  const isRetirement = /401k|401\(k\)|ira|roth/i.test(desc);

  if (type === "real_estate")   return "real_estate";
  if (type === "alternative")   return "alternatives";
  if (isRetirement)             return "retirement";
  if (type === "fixed_income")  return "capital_build";
  if (type === "cash") {
    return desc.includes("checking") ? "operating" : "reserve";
  }
  return "investments"; // equity and anything else
}

// ── Core Function: computeBucketTotals ───────────────────────────────────────

/**
 * Sums asset values into GURU buckets.
 * This is the single source of truth for all bucket balance displays.
 */
export function computeBucketTotals(assets: Asset[]): BucketTotals {
  const totals: BucketTotals = {
    operating: 0, reserve: 0, capital_build: 0,
    investments: 0, alternatives: 0, retirement: 0,
    real_estate: 0, total: 0,
  };
  for (const asset of assets) {
    const bucket = classifyAssetBucket(asset);
    const val    = Number(asset.value);
    totals[bucket] += val;
    totals.total   += val;
  }
  return totals;
}

// ── Core Function: groupAssetsByInstitution ───────────────────────────────────

/**
 * Groups assets by institution for the balance sheet investment table.
 * Uses the accounts table for institution name and account number
 * (rather than string-matching on asset descriptions).
 *
 * Replaces the inline institution-grouping logic previously in BalanceSheetView.
 */
export function groupAssetsByInstitution(
  assets: Asset[],
  accounts: Account[]
): InstitutionGroup[] {
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const groups     = new Map<string, InstitutionGroup>();

  for (const asset of assets) {
    // Prefer account record for institution name; fall back to description parsing
    const account    = asset.accountId ? accountMap.get(asset.accountId) : null;
    const instName   = account?.institutionName ?? inferInstitution(asset.description ?? "");
    const acctNumber = account?.accountNumber ?? undefined;
    const isManaged  = account?.isAdvisorManaged ?? false;

    if (!groups.has(instName)) {
      groups.set(instName, {
        institution:      instName,
        total:            0,
        assets:           [],
        accountNumber:    acctNumber,
        isAdvisorManaged: isManaged,
      });
    }
    const group = groups.get(instName)!;
    group.total += Number(asset.value);
    group.assets.push(asset);
  }

  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

// ── Core Function: groupLiabilities ──────────────────────────────────────────

/**
 * Groups liabilities by category for the balance sheet liabilities section.
 * Replaces buildLiabilityGroups() in client-dashboard.tsx.
 */
export function groupLiabilities(liabilities: Liability[]): LiabilityGroup[] {
  const groups: LiabilityGroup[] = [];

  // Helper: build a LiabilityGroup from a filtered set
  const makeGroup = (
    category: string,
    items: Liability[]
  ): LiabilityGroup => {
    const subtotal = items.reduce((s, l) => s + Number(l.value), 0);
    const rates    = items.map(l => Number(l.interestRate)).filter(r => r > 0);
    const avgRate  = rates.length
      ? rates.reduce((s, r) => s + r, 0) / rates.length
      : null;
    return {
      category,
      items: items.map(l => ({
        description:  l.description,
        value:        Number(l.value),
        interestRate: Number(l.interestRate),
      })),
      subtotal,
      avgRate,
    };
  };

  // ── Mortgages ──────────────────────────────────────────────────────────────
  const mortgages = liabilities.filter(l =>
    l.type === "mortgage" || l.description.toLowerCase().includes("mortgage")
  );
  if (mortgages.length) groups.push(makeGroup("Mortgages", mortgages));

  // ── Student Loans ──────────────────────────────────────────────────────────
  const studentLoans = liabilities.filter(l =>
    l.type === "student_loan" || l.description.toLowerCase().includes("student loan")
  );
  if (studentLoans.length) groups.push(makeGroup("Student Loans", studentLoans));

  // ── Private Equity — Professional Loan + Capital Commitments (combined) ───
  // These are shown together per the advisor brief design: both are PE-related obligations.
  const profLoan  = liabilities.filter(l => l.description.toLowerCase().includes("professional loan"));
  const capComm   = liabilities.filter(l =>
    l.description.toLowerCase().includes("capital commitment") ||
    l.description.toLowerCase().includes("remaining commitment")
  );
  const allPE = [...profLoan, ...capComm];
  if (allPE.length) {
    const peSubtotal = allPE.reduce((s, l) => s + Number(l.value), 0);
    const profRates  = profLoan.map(l => Number(l.interestRate)).filter(r => r > 0);
    const avgPERate  = profRates.length
      ? profRates.reduce((s, r) => s + r, 0) / profRates.length
      : null;
    groups.push({
      category: "Private Equity — Capital Calls & Commitments",
      items: allPE.map(l => ({
        description:  l.description,
        value:        Number(l.value),
        interestRate: Number(l.interestRate),
      })),
      subtotal: peSubtotal,
      avgRate:  avgPERate,
    });
  }

  // ── Other Liabilities (catch-all for anything not matched above) ───────────
  const categorized = new Set([...mortgages, ...studentLoans, ...allPE].map(l => l.id));
  const other       = liabilities.filter(l => !categorized.has(l.id));
  if (other.length) groups.push(makeGroup("Other Liabilities", other));

  return groups;
}

// ── Utility: inferInstitution ─────────────────────────────────────────────────

/**
 * Fallback institution name inference from asset description.
 * Only used when asset.accountId is null (unlinked assets).
 * Prefer using the accounts table over this function.
 */
export function inferInstitution(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes("cresset"))          return "Cresset Capital";
  if (desc.includes("fidelity"))         return "Fidelity";
  if (desc.includes("e*trade") || desc.includes("etrade") || desc.includes("morgan stanley"))
                                         return "E*Trade";
  if (desc.includes("chase"))            return "JPMorgan Chase";
  if (desc.includes("citizens"))         return "Citizens Private Bank";
  if (desc.includes("capital one") || desc.includes("capitalon"))
                                         return "Capital One";
  if (desc.includes("coinbase"))         return "Coinbase";
  if (desc.includes("carlyle"))          return "Carlyle Group";
  if (desc.includes("tribeca") || desc.includes("sarasota"))
                                         return "Real Estate";
  return "Other";
}

// ── Utility: computeNetWorth ──────────────────────────────────────────────────

/**
 * Net worth = total assets − total liabilities.
 * Simple but important to have as a single function so it's consistent.
 */
export function computeNetWorth(assets: Asset[], liabilities: Liability[]): number {
  const totalAssets      = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.value), 0);
  return totalAssets - totalLiabilities;
}
