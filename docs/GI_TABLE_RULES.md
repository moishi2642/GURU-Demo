# GURU Intelligence Table — Master Design Rules

> Single source of truth for every table rendered inside a GURU Intelligence (dark) tab.
> Derived from the NW-1 Balance Sheet / BsTable design language and refined through
> the LQ-7 Asset Forecast mockup. Read this before building or modifying any GI table.
> These rules supersede earlier ad-hoc styling in individual views.

---

## 1. Design Tokens (CSS Variables)

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#141c2b` | Page background (outside table) |
| `--bs-base` | `#0f1e33` | Default data row background |
| `--bs-alt` | `#122038` | Alternating data row background |
| `--bs-grphdr` | `#162843` | Section header row background |
| `--bs-sectot` | `#1a2d47` | Section total row background (Beginning Balance, Ending Balance, After-Tax Interest) |
| `--bs-grandtot` | `#0d1b2e` | Grand total row background |
| `--bs-border` | `#1e3352` | Standard cell border (1px) |
| `--bs-border-sec` | `#2a4a6e` | Heavier divider border (2px) — section total top/bottom, Annual column left border |
| `--bs-green-dim` | `hsl(152,45%,42%)` | Green left-border accent on Ending Balance rows |
| `--bs-green-med` | `hsl(152,52%,55%)` | Green text on Ending Balance label + grand total text |
| `--gi-green` | `#44e08a` | Bright green — grand total left border accent |
| `--bs-text` | `hsl(0,0%,88%)` | Primary white text (section totals, headers) |
| `--bs-text-sub` | `rgba(255,255,255,0.82)` | Subaccount row text — legible white, slightly softer |
| `--amber` | `#ffc83c` | Warning/negative highlight (e.g. negative ending balance) |

### Bucket Accent Colors (for section header top stripes)

| Bucket | Color |
|---|---|
| Operating Cash | `#1E4F9C` |
| Liquidity Reserve | `#835800` |
| Capital Build | `#195830` |
| Investments | `#4A3FA0` |
| Alternatives | `#5C5C6E` |

---

## 2. Fonts

| Context | Font | Weight | Size |
|---|---|---|---|
| All table numbers | JetBrains Mono | 300–800 (varies by tier) | 10.5px (data), 12px (headers/grand totals) |
| Table column headers | JetBrains Mono | 800 | 10.5px |
| GURU Intelligence header labels | Inter | 700 | 10px |
| GURU Intelligence description | Inter | 400 | 13px |

**Rule:** JetBrains Mono is the ONLY number font in GURU Intelligence tables. Inter is used only for non-table UI elements (header labels, descriptions, footnotes).

---

## 3. The Four-Tier Row Hierarchy

Every row in a GI table falls into exactly one of four tiers. There are no other row types.

### Tier 1 — Section Headers

The bucket name row that introduces each grouped section.

| Property | Value |
|---|---|
| Background | `--bs-grphdr` (`#162843`) |
| Font | JetBrains Mono, 12px, weight 800 |
| Text transform | ALL CAPS |
| Letter spacing | 0.12em |
| Text color | `#fff` |
| Top border | 4px solid `{bucket-color}` — full-width colored stripe |
| Bottom border | 1px solid `--bs-border-sec` |
| Padding | 12px 14px |
| Colspan | Full row (all columns) |

**Rules:**
- Section headers contain ONLY the bucket name — no pills, no yield info, no badges
- The 4px top stripe uses the bucket's accent color (see table above)
- ALL CAPS with wide letter spacing to clearly distinguish from data rows

---

### Tier 2 — Subaccount Rows (Detail Data)

Individual line items within a section (income, expenses, allocations, individual accounts).

| Property | Value |
|---|---|
| Background | Alternating `--bs-base` / `--bs-alt` |
| Font | JetBrains Mono, 10.5px, weight 400 |
| Text color | `--bs-text-sub` (`rgba(255,255,255,0.82)`) |
| Left padding (label) | 28px (same indent as yield rows) |
| Cell border | 1px solid `--bs-border` |
| Number format | `tabular-nums` |

**Yield rows** are a subtype of Tier 2:
- Same 10.5px size as other subaccounts (never smaller)
- Font style: italic (to visually distinguish without changing size)
- Text color: `--bs-text-sub` — same white as other subaccounts
- Left padding: 28px (same indent as other subaccounts)
- No green text on any yield row (pre-tax or after-tax)

**Parenthetical values** (expenses shown as negatives):
- Use `(amount)` format, not minus sign
- Same `--bs-text-sub` color as other subaccount values

---

### Tier 3 — Section Totals

Summary rows within a section: Beginning Balance, Ending Balance, After-Tax Interest Income.

| Property | Value |
|---|---|
| Background | `--bs-sectot` (`#1a2d47`) |
| Font | JetBrains Mono, 10.5px, weight 800 |
| Letter spacing | 0.06em |
| Number color | `--bs-text` (`hsl(0,0%,88%)`) — white, NOT green |
| Top/bottom borders | 2px solid `--bs-border-sec` |
| Left padding (label) | 12px (flush left, not indented) |

**Ending Balance gets special treatment:**
- Label (first cell): green text `--bs-green-med` (`hsl(152,52%,55%)`)
- Left border: 3px solid `--bs-green-dim` (`hsl(152,45%,42%)`)
- Number cells: white `--bs-text` — NOT green

**Beginning Balance and After-Tax Interest Income:**
- Label (first cell): white `--bs-text` — NO green text
- NO green left border
- Otherwise identical to Ending Balance styling

**Why only Ending Balance gets green:** It is the single most important number in each section — the bottom line. Green label + left border draws the eye to it without making every total row compete for attention.

---

### Tier 4 — Grand Totals

The final summary rows at the bottom of the entire table.

| Property | Value |
|---|---|
| Background | `--bs-grandtot` (`#0d1b2e`) |
| Font | JetBrains Mono, 12px, weight 800 |
| Text color (label) | `--bs-green-med` (`hsl(152,52%,55%)`) |
| Text color (numbers) | `--bs-green-med` — green across the entire row |
| Left border | 4px solid `--gi-green` (`#44e08a`) — bright green accent |
| Top border | 3px solid `--bs-border-sec` |
| Bottom border | none |
| Padding | 10px 8px |
| Letter spacing (label) | 0.10em |
| Text transform (label) | uppercase |

**Rule:** Grand totals are the ONLY rows where numbers are green. Every other row's numbers are white.

---

## 4. Table Container

| Property | Value |
|---|---|
| Outer border | 1px solid `--bs-border` |
| Border radius | 10px (outer container only — inner table has no radius) |
| Overflow | hidden (clips to rounded corners) |
| Min width | 1280px (horizontal scroll if viewport is narrower) |

---

## 5. Column Headers (thead)

| Property | Value |
|---|---|
| Background | `--bs-grandtot` (`#0d1b2e`) |
| Font | JetBrains Mono, 10.5px, weight 800 |
| Text transform | uppercase |
| Letter spacing | 0.10em |
| Text color | `hsl(210,35%,65%)` — muted blue-gray |
| Text align | right (numbers), left (first column) |
| Bottom border | 1px solid `--bs-border-sec` |
| Cell padding | 7px 8px |

**First column (sticky):**
- `position: sticky; left: 0; z-index: 3`
- min-width: 240px
- Left-aligned
- Background matches header bg (prevents transparency on scroll)

**Annual column:**
- Left border: 2px solid `--bs-border-sec` (heavier divider to separate from monthly columns)
- min-width: 96px

---

## 6. Section Separators

18px of page background (`--bg`) between bucket sections. Implemented as a spacer row with:
- `background: var(--bg)`
- `height: 18px`
- All borders transparent

---

## 7. GURU Intelligence Header (above table)

Every GI table tab opens with this header. It sits outside the table container.

| Element | Font | Size/Weight | Color |
|---|---|---|---|
| Tab label ("GURU INTELLIGENCE · LQ-7") | Inter | 10px / 700 | `--gi-green` (`#44e08a`) |
| Subtitle ("ASSET FORECAST · FY 2026 · LIVE FROM TRANSACTION DATA") | JetBrains Mono | 10px / 400 | `rgba(255,255,255,0.28)` |
| Description (one sentence) | Inter | 13px / 400 | `rgba(255,255,255,0.50)` |

**Layout:** Label and subtitle on the same baseline (flex row, gap 16). Description below with `line-height: 1.6`. Bottom border: `1px solid rgba(255,255,255,0.06)`.

---

## 8. Conditional Formatting

| Condition | Treatment |
|---|---|
| Negative balance | Amber text `--amber` (`#ffc83c`) — applied inline on affected cells only |
| Zero / no activity | Em dash `—` — not "0" or "$0" |
| Warning threshold | Amber on the specific value, not the entire row |

---

## 9. Footnotes

| Property | Value |
|---|---|
| Font | Inter, 10px, weight 400 |
| Text color | `rgba(255,255,255,0.25)` |
| Bold labels ("Assumptions") | `rgba(255,255,255,0.40)`, weight 600 |
| Line height | 1.7 |
| Padding | `0 20px 30px` |

Footnotes sit outside and below the table container. They document assumptions and methodology.

---

## 10. Rules That Must Never Change

1. **Four tiers only.** Every row is a Section Header, Subaccount, Section Total, or Grand Total. No fifth category, no hybrid styles.

2. **Only Ending Balance gets green label + green left border** among section totals. Beginning Balance and After-Tax Interest Income use white text, no green border.

3. **Only Grand Total numbers are green.** All other number cells are white (`--bs-text` or `--bs-text-sub`).

4. **Section headers are ALL CAPS** with the 4px bucket-colored top stripe. No pills, yields, or badges in headers.

5. **Yield rows are the same font size as subaccounts** (10.5px). Distinguished by italic style only — never smaller.

6. **No green text on yield rows.** Both pre-tax and after-tax yields use `--bs-text-sub` (white).

7. **10px minimum font size.** Nothing in the table renders below 10px. The smallest elements are 10.5px (data rows).

8. **JetBrains Mono** for all table content. Inter is used only outside the table (header, footnotes).

9. **Parenthetical format for negatives** — `(40,537)` not `-40,537` or `−$40,537`.

10. **No abbreviations.** Full names always. "After-Tax Interest Income" not "AT Interest" or "AT Inc."

11. **18px section separators** between bucket groups. Consistent spacing, not variable.

12. **Grand totals at the bottom** — never at the top. Totals always follow their detail rows.

13. **Sticky first column** with matching background on every row type. Must not show transparency when scrolling horizontally.

---

## 11. CSS Class Reference

| Class | Tier | Purpose |
|---|---|---|
| `.sec-header` | 1 | Bucket section header |
| `.sec-header.ops` / `.res` / `.cap` | 1 | Bucket-specific top stripe color |
| `.row-base` | 2 | Default subaccount row (base bg) |
| `.row-alt` | 2 | Alternating subaccount row (alt bg) |
| `.row-yield` | 2 | Yield row (italic, base bg) |
| `.row-beginning` | 3 | Beginning Balance (section total, no green) |
| `.row-ending` | 3 | Ending Balance (section total, green label + left border) |
| `.row-interest` | 3 | After-Tax Interest Income (section total, no green) |
| `.row-subtotal` | 3 | Generic subtotal (if needed) |
| `.grand-total` | 4 | Grand total row (green text, green left border) |
| `.row-sep` | — | 18px spacer between sections |

---

*Derived from: NW-1 Balance Sheet (BsTable) + LQ-7 Asset Forecast mockup iterations*
*Last updated: 2026-04-13*
