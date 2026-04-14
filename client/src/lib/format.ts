/**
 * lib/format.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * All number and string formatting helpers used across views.
 *
 * Import from here — never define formatters inline in a view.
 * These are pure functions with no dependencies on React or the engine.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── fmtUSD ────────────────────────────────────────────────────────────────────
// Standard dollar format. Zeros display as "—", negatives as (parentheses).
// Used by GI tables, CF forecast, balance sheet, and reallocation calculator.
//   fmtUSD(123456)   → "123,456"
//   fmtUSD(-5000)    → "(5,000)"
//   fmtUSD(0)        → "—"
export function fmtUSD(v: number): string {
  if (Math.round(v) === 0) return "—";
  const abs = Math.abs(Math.round(v));
  const s   = abs.toLocaleString("en-US");
  return v < 0 ? `(${s})` : s;
}

// ── fmtUSDSigned ─────────────────────────────────────────────────────────────
// Like fmtUSD but prefixes a "+" for positive values.
// Used by CF net/cumulative rows and income pickup displays.
//   fmtUSDSigned(5000)  → "+5,000"
//   fmtUSDSigned(-5000) → "(5,000)"
export function fmtUSDSigned(v: number): string {
  if (Math.round(v) === 0) return "—";
  const abs = Math.abs(Math.round(v));
  const s   = abs.toLocaleString("en-US");
  return v < 0 ? `(${s})` : `+${s}`;
}

// ── fmtDollar ─────────────────────────────────────────────────────────────────
// Simple $X format without parens for negatives. Used by inline callouts.
//   fmtDollar(12345) → "$12,345"
export function fmtDollar(v: number): string {
  return `$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
}

// ── fmtDollarSigned ──────────────────────────────────────────────────────────
// $X with sign prefix. Used by income pickup stats.
//   fmtDollarSigned(5000)  → "+$5,000"
//   fmtDollarSigned(-5000) → "-$5,000"
export function fmtDollarSigned(v: number): string {
  const abs = Math.round(Math.abs(v)).toLocaleString("en-US");
  return v < 0 ? `-$${abs}` : `+$${abs}`;
}

// ── fmtPct ────────────────────────────────────────────────────────────────────
// Percentage with 2 decimal places. Input is a decimal (0.054 → "5.40%").
//   fmtPct(0.054)  → "5.40%"
//   fmtPct(0.35)   → "35.00%"
export function fmtPct(v: number, decimals = 2): string {
  return `${(v * 100).toFixed(decimals)}%`;
}

// ── fmtPct1 ───────────────────────────────────────────────────────────────────
// Percentage with 1 decimal place. Used by coverage ratios and yield displays.
//   fmtPct1(0.054) → "5.4%"
export function fmtPct1(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

// ── fmtMonths ─────────────────────────────────────────────────────────────────
// "X.X months" format. Used by liquidity coverage displays.
//   fmtMonths(14.2) → "14.2 months"
export function fmtMonths(v: number): string {
  return `${v.toFixed(1)} months`;
}

// ── fmtRate ───────────────────────────────────────────────────────────────────
// 3-decimal yield rate. Used by balance sheet AT yield cells.
// Zero returns "—".
//   fmtRate(0.0228) → "2.280%"
//   fmtRate(0)      → "—"
export function fmtRate(v: number): string {
  if (v === 0) return "—";
  return `${(v * 100).toFixed(3)}%`;
}

// ── fmtRateAt ─────────────────────────────────────────────────────────────────
// After-tax rate with sign. Used by return optimization account rows.
//   fmtRateAt(0.0228) → "+2.280%"
export function fmtRateAt(v: number): string {
  if (v === 0) return "—";
  return v < 0 ? `-${(Math.abs(v) * 100).toFixed(3)}%` : `+${(v * 100).toFixed(3)}%`;
}

// ── parseYieldFromDesc ────────────────────────────────────────────────────────
// Extracts a yield percentage from an asset description string.
// e.g. "Capital One 360 Performance Savings (3.80%)" → 0.038
// Returns null if no match found.
export function parseYieldFromDesc(description: string): number | null {
  const m = (description ?? "").match(/(\d+\.?\d*)%/);
  return m ? parseFloat(m[1]) / 100 : null;
}
