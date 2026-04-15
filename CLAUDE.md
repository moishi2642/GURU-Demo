# GURU Demo — Session Instructions

Read these files at the start of every session before touching any code:

1. `docs/CONTEXT.md` — product context, UI rules, file map, standing rules
2. `docs/GURU_PRODUCT.md` — 5-bucket framework definitions, brand language
3. `docs/GURU_METRICS.md` — all KPI definitions, formulas, and Kessler reference values.
   Read carefully when doing any work touching liquidity, cash flow, or bucket calculations.
4. `docs/ADVISOR_BRIEF_RULES.md` — **master design rules for the AdvisorBriefView component**.
   Read before touching any advisor brief code. Covers fonts, spacing, colors, stat bar order,
   card structure, font size table, and rules that must never change.
5. `docs/GI_TABLE_RULES.md` — **master design rules for all GURU Intelligence (dark) tables**.
   Read before building or modifying any GI tab table. Covers the four-tier row hierarchy,
   design tokens, section headers, green accent rules, grand totals, and rules that must never change.

## Active Reminders
- **DO NOT touch the allocation/reallocation tool in client-dashboard.tsx or income-optimization.html.**
  A major refactor is in progress on another branch. Design work for the allocation tool
  should ONLY happen in the standalone mockup file: `client/public/allocation-mockup.html`.
