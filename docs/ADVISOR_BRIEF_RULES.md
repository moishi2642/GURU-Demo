# Advisor Brief — Master Design Rules

> Single source of truth for the `AdvisorBriefView` component in `client-dashboard.tsx`. Read this before touching any advisor brief code. These rules supersede earlier notes in `ADVISOR_BRIEF_SPEC.html` where they conflict.

---

## 1. Design Tokens

| Token | Value | Usage |
|---|---|---|
| `FONT` | `'DM Sans', system-ui, sans-serif` | All UI text, numbers, labels |
| `SERIF` | `'Playfair Display', Georgia, serif` | Page headline, card headlines only |
| `BG` | `hsl(220,5%,93%)` | Page background |
| `--liq` | `#2e7a52` | Liquidity card stripe, label, dominant KPI |
| `--inv` | `#1E4F9C` | Investments card stripe, label, dominant KPI |
| `--rate` | `#c47c2b` | Rates card stripe, label, dominant KPI |
| `--navy` | `#1a2a4a` | Primary text, supporting KPIs |
| `--t2` | `rgba(0,0,0,0.55)` | Body copy, card subtext |
| `--t3` | `rgba(0,0,0,0.38)` | Labels, hints, KPI sublabels |
| `--border` | `rgba(0,0,0,0.08)` | Card borders, dividers |

---

## 2. Page Header

- **Eyebrow**: Playfair Display 22px/400, `rgba(0,0,0,0.38)`, `whiteSpace: "nowrap"` — never wraps
- **Headline**: Playfair Display 38px/400, `#1a2a4a`, `letterSpacing: -0.025em`, `lineHeight: 1.12`
- **Status line**: DM Sans 13px/600, `#1e9955` — single line, no icon, reads "GURU analysis complete · Ready to execute"

---

## 3. Situation Overview

- Two-column grid: `120px 1fr`
- Left cell: section label 10px/700, uppercase, `rgba(0,0,0,0.38)`
- Right cell: body copy 13px/400, `rgba(0,0,0,0.55)`, `lineHeight: 1.7`
- Strong highlights use accent colors inline

---

## 4. Stats Strip

Sits flush below situation overview (no top border gap). White background, 1px border (no top). `display: flex`, `padding: "0 16px"`.

**Order (left → right):**
1. Net Worth
2. Bonus Cash Sitting Idle
3. Potential After-Tax Income Increase from Optimization
4. Rate Lock Window Closes
5. April Cash Flows

**Item styling:**
- NO colored border-left on any item — removed
- Dividers between items: `borderRight: "1px solid rgba(0,0,0,0.08)"`
- Label: DM Sans 11px/700, uppercase, `rgba(0,0,0,0.38)`, `letterSpacing: 0.07em`
- Value: DM Sans 18px/500, colored per meaning, `letterSpacing: -0.02em`
- Descriptor (inline): DM Sans 12px/400, `rgba(0,0,0,0.38)`, same flex row as value with `alignItems: baseline, gap: 5`
- Padding: first item `"14px 20px 14px 0"`, others `"14px 20px 14px 20px"`

---

## 5. Card Grid

- 3 columns: `1fr 1fr 1fr`, `gap: 20`
- Padding: `12px 32px`
- Card 4 (Money Movement): `gridColumn: "span 2"` in the same grid row

---

## 6. Card Shell (`cardStyle`)

- Background `#FFFFFF`, border `rgba(0,0,0,0.08)`, no border-radius, no shadow
- `display: flex, flexDirection: column, overflow: hidden`
- **Top stripe**: `height: 3`, full-width horizontal, colored per card — NOT a left stripe

---

## 7. Card Header Band

- `padding: "16px 16px 14px"`, `borderBottom: rgba(0,0,0,0.08)`
- Left: card category label 10px/700, uppercase, `letterSpacing: 0.13em`, card accent color
- Right: priority badge 8px/700, uppercase, with colored border — badges stay at 8px (they are decorative)

---

## 8. Card Headline Section (`headStyle`)

- `padding: "14px 16px 12px"`, `borderBottom: rgba(0,0,0,0.08)`
- **Headline**: Playfair Display 20px/400, `#1a2a4a`, `lineHeight: 1.3`, `minHeight: 52` (for alignment across all 3 cards)
- **Subtext**: DM Sans 13px/400, `rgba(0,0,0,0.55)`, `lineHeight: 1.55`, `marginTop: 8`

---

## 9. KPI Strip (`statStrip`)

- Grid: `1.5fr 1fr 1fr` (2-col variant: `1.5fr 1fr`)
- Container: `padding: "0 16px"`, `borderBottom: rgba(0,0,0,0.08)`
- **Column label**: DM Sans 10px/700, uppercase, `letterSpacing: 0.09em`, `rgba(0,0,0,0.38)`, `marginBottom: 5`
- **Sub-label**: DM Sans 11px/400, `rgba(0,0,0,0.38)`, `marginTop: 3`, `lineHeight: 1.4`
- Cell padding: first col `"12px 14px 12px 0"`, others `"12px 0 12px 14px"`
- Cell divider: `borderRight: rgba(0,0,0,0.08)`

**KPI number rules — ONE colored dominant per card:**
- `bigNum(val, color)`: 22px/300, colored, `letterSpacing: -0.03em` — FIRST column only
- `suppNum(val, unit?)`: 14px/300, `#1a2a4a` (navy), `letterSpacing: -0.02em` — all other columns

---

## 10. Card Body Table Rows

Inline styles (not using `dataRow` helper — that helper is for other tabs):

- **Row label**: DM Sans 13px/500, `#1a2a4a`, `lineHeight: 1.3`
- **Row sub-label**: DM Sans 11px/400, `rgba(0,0,0,0.38)`, `marginTop: 2`
- **Row value**: DM Sans 13px/300, `#1a2a4a`, `flexShrink: 0`, `fontVariantNumeric: tabular-nums`, `letterSpacing: -0.02em`
- **Row padding**: `"9px 0 9px 14px"` (indented rows), `borderBottom: rgba(0,0,0,0.04)`

**Section header** (above table rows):
- DM Sans 10px/700, uppercase, `letterSpacing: 0.09em`, `rgba(0,0,0,0.38)`, `padding: "10px 0 5px"`, `borderBottom: rgba(0,0,0,0.04)`

**Subtotal / total rows** — SAME font size as detail rows:
- Label: DM Sans 13px/600, accent color (not grey)
- Value: DM Sans 13px/600, accent color
- `borderTop: rgba(0,0,0,0.08)` above totals

---

## 11. Card 1 — Excess Liquidity

**KPI strip labels:**
- Col 1: "Excess Liquidity" → `bigNum`, green
- Col 2: "Coverage"
- Col 3: "Potential After-Tax Income Increase from Optimization"

**Table section header:** "GURU's Estimate of Kesslers 12 Month Cash Liquidity Need"

**Table rows** (all indented 14px):
1. Cash for next 12 months of net outflows
2. Operating cash on hand — 2 months
3. Capital preservation — home purchase
4. **Total liquidity needed** (subtotal — 13px/600, navy)
5. Total liquid assets (indented — 13px/500, muted)
6. **Deployable excess** (total — 13px/600, green)

---

## 12. Card 2 — Investments / Portfolio

**KPI strip labels:**
- Col 1: "Diversification Added" → `bigNum`, navy/invest
- Col 2: "Cash Deployed"
- Col 3: "5-Year Weighted Avg Return"

**Fund rows:** checkbox + name 13px/500, stats 11px (5-yr historical, exposure), description 12px/400

**Total row:** "Total invested from redeployed cash" → 13px/600, invest color

---

## 13. Card 3 — Interest Rates

**KPI strip labels:**
- Col 1: "Rate-Vulnerable Cash" → `bigNum`, amber
- Col 2: "After-Tax Income at Risk"
- Col 3: "T-Bill Rate Available"

**Positions table — ONLY taxable/liquid accounts (no retirement accounts):**
1. Citizens Private Bank Money Market — 3.65%
2. CapitalOne 360 Performance Savings — 3.78%
3. Fidelity Cash Sweep / SPAXX — 2.50%
- **NOT included:** 401(k) / IRA money market sleeves (retirement accounts not rate-vulnerable in same way)

**Column headers:** 10px/700, uppercase, `rgba(0,0,0,0.38)`

**Position row fonts:** name 13px/400, sub 11px/400, yield 13px/400 (amber), balance 13px/300

**Row indent:** `padding: "10px 0 10px 22px"` (22px left indent)

**Total row:** "Total rate-vulnerable cash" → 13px/600, amber; value = `citizensMM + capitalOne + fidelityMMF` only

---

## 14. Card 4 — Money Movement

- Spans 2 columns in the 3-col grid: `gridColumn: "span 2"`
- Left-aligned with Card 1 (column 1 of grid)
- Two-column body: left = automatic transfers flow diagram, right = upcoming payments list
- Card color: `accentColor.cashflow` (#1d4ed8)

---

## 15. Talking Points

- Collapsed by default, expand on click
- Header: 10px/700 uppercase label
- Body: 13px/400, `rgba(0,0,0,0.55)`, `lineHeight: 1.7`
- Bullet items: 12px, same color

---

## 16. Card Footer

- `padding: "10px 18px"`, `borderTop: rgba(0,0,0,0.07)`
- Checkbox + CTA button
- CTA: 12px/600, accent color, no background, border accent color

---

## 17. Font Size Reference Table

| Element | Size | Weight | Color |
|---|---|---|---|
| Page eyebrow | 22px | 400 | `rgba(0,0,0,0.38)` |
| Page headline | 38px | 400 | `#1a2a4a` |
| Status line | 13px | 600 | `#1e9955` |
| Situation overview label | 10px | 700 | `rgba(0,0,0,0.38)` |
| Situation overview body | 13px | 400 | `rgba(0,0,0,0.55)` |
| Stat bar label | 11px | 700 | `rgba(0,0,0,0.38)` |
| Stat bar value | 18px | 500 | accent |
| Stat bar descriptor | 12px | 400 | `rgba(0,0,0,0.38)` |
| Card category label | 10px | 700 | accent |
| Card badge | 8px | 700 | accent (decorative) |
| Card headline | 20px | 400 | `#1a2a4a` (Playfair) |
| Card subtext | 13px | 400 | `rgba(0,0,0,0.55)` |
| KPI section header | 10px | 700 | `rgba(0,0,0,0.38)` |
| KPI sub-label | 11px | 400 | `rgba(0,0,0,0.38)` |
| KPI dominant number | 22px | 300 | accent |
| KPI supporting number | 14px | 300 | `#1a2a4a` |
| Table section header | 10px | 700 | `rgba(0,0,0,0.38)` |
| Table row label | 13px | 500 | `#1a2a4a` |
| Table row sub | 11px | 400 | `rgba(0,0,0,0.38)` |
| Table row value | 13px | 300 | `#1a2a4a` |
| Subtotal label | 13px | 600 | accent |
| Subtotal value | 13px | 600 | accent |

---

## 18. Rules That Must Never Change

1. **Playfair Display** is only used for the page eyebrow, page headline, and card headlines — never for numbers, labels, or body copy
2. **Exactly one** colored (bigNum) KPI per card — all others use suppNum (navy)
3. **No colored border-left** on stat bar items — clean dividers only
4. **Stat bar order**: Net Worth, Bonus Cash Sitting Idle, Potential After-Tax Income Increase from Optimization, Rate Lock Window Closes, April Cash Flows
5. **Card top stripe** is horizontal (3px height, full width) — never a left stripe
6. **401k / retirement accounts** are not included in rate-vulnerable cash calculations (Card 3 table)
7. **Subtotals** use the same font size as detail rows (13px) — not smaller
8. **All subtext** minimum 11px — nothing below 10px except decorative badges
9. **Card subheadline text** (situation, card bodies): minimum 13px for advisor readability

---

*Last updated: 2026-04-11*
