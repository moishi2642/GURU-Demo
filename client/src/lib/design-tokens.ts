/**
 * lib/design-tokens.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared design tokens for all GURU views.
 *
 * GURU has two distinct visual languages:
 *
 *   GI (GURU Intelligence) — dark navy theme used in all analytical tabs.
 *     Primary bg: #141c2b — #0c1828
 *     Accent: green (#5ecc8a), amber (#ffc83c)
 *     Text: white/rgba hierarchy
 *
 *   ADVISOR — warm off-white theme used in the Advisor Brief.
 *     Primary bg: white / warm paper tones
 *     Text: near-black
 *     Accent: institutional green
 *
 * Import from here — never define color or font constants inline in a view.
 *
 * Docs: ADVISOR_BRIEF_RULES.md, GI_TABLE_RULES.md
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Typography ────────────────────────────────────────────────────────────────
export const FONT_MONO  = "'JetBrains Mono', 'Courier New', monospace";
export const FONT_UI    = "Inter, system-ui, sans-serif";
export const FONT_SERIF = "'Instrument Serif', Georgia, serif";

// ── GI palette (dark navy — all GURU Intelligence tabs) ───────────────────────
export const GI = {
  // Backgrounds (darkest → lightest)
  bgBase:    "#0c1828",   // page background
  bgDeep:    "#141c2b",   // panel / card base
  bgCard:    "#1e2838",   // elevated card
  bgRaised:  "#1a2433",   // button / input / raised element

  // Borders & separators
  border:    "rgba(255,255,255,0.08)",
  divider:   "rgba(255,255,255,0.06)",
  borderSec: "#2a4a6e",   // secondary border (blue-tinted, used in balance sheet)

  // Text hierarchy
  txt:       "rgba(255,255,255,0.90)",
  txt2:      "rgba(255,255,255,0.85)",
  txtMuted:  "rgba(255,255,255,0.60)",
  txtDim:    "rgba(255,255,255,0.50)",
  txtFaint:  "rgba(255,255,255,0.32)",
  txtGhost:  "rgba(255,255,255,0.22)",

  // Accent colors
  green:     "#5ecc8a",   // primary positive signal
  greenDim:  "rgba(94,204,138,0.65)",
  greenBg:   "rgba(94,204,138,0.08)",
  amber:     "#ffc83c",   // secondary signal / advisory
  amberDim:  "rgba(154,123,60,0.85)",
  amberBg:   "rgba(154,123,60,0.08)",
  red:       "#ff6464",
  blue:      "#5b9cf6",
  gold:      "#ffc83c",   // alias for amber

  // Fonts (for inline style usage)
  INTER:     "Inter, system-ui, sans-serif",
  SERIF:     "'Instrument Serif', Georgia, serif",
  MONO:      "'JetBrains Mono', 'Courier New', monospace",
} as const;

// ── Liquidity bucket colors ───────────────────────────────────────────────────
// Consistent across all tabs that show the three-bucket breakdown.
export const BUCKET_COLORS = {
  operating: "#4a7fd4",   // Operating Cash — blue
  reserve:   "#e8a830",   // Liquidity Reserve — amber/gold
  capital:   "#2a9a5a",   // Capital Build — green
} as const;

// ── Balance Sheet tokens ──────────────────────────────────────────────────────
export const BS = {
  bgBase:    "#0f1e33",
  bgAlt:     "#122038",
  bgGrpHdr:  "#162843",
  bgSecTot:  "#1a2d47",
  bgGrandTot:"#0d1b2e",
  border:    "#1e3352",
  borderSec: "#2a4a6e",
  greenDim:  "hsl(152,45%,42%)",
  greenMed:  "hsl(152,52%,55%)",
  text:      "hsl(0,0%,88%)",
  textMuted: "hsl(210,15%,52%)",
  MONO:      "'JetBrains Mono', monospace",
} as const;

// ── GI table layout constants ─────────────────────────────────────────────────
// Column widths (px) used in CF Forecast and Liquidity Waterfall tables.
export const GI_TABLE = {
  labelWidth:  240,   // row label column
  labelWidthSm:220,   // narrower variant (CF forecast)
  colWidth:     76,   // each month column
  annualWidth:  92,   // annual total column
} as const;

// ── Advisor Brief palette (warm — used only in AdvisorBriefView) ──────────────
// Full specification in ADVISOR_BRIEF_RULES.md — do not change without reading it.
export const ADVISOR = {
  bg:          "#FAFAF8",
  paper:       "#FFFFFF",
  ink:         "#1a1a1a",
  inkMuted:    "rgba(26,26,26,0.55)",
  inkFaint:    "rgba(26,26,26,0.35)",
  border:      "rgba(0,0,0,0.07)",
  borderMed:   "rgba(0,0,0,0.12)",
  muted:       "rgba(0,0,0,0.38)",
  green:       "#1a6b3c",
  greenLight:  "#e8f5ee",
  amber:       "#7a5c1e",
  amberLight:  "#fdf3e0",
  FONT_UI:     "Inter, system-ui, sans-serif",
  FONT_SERIF:  "'Instrument Serif', Georgia, serif",
  FONT_MONO:   "'JetBrains Mono', monospace",
} as const;
