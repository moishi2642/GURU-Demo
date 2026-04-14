# Views Directory

This directory contains view component exports for the GURU dashboard.

## Components

Each file in this directory re-exports a major view component from `@/pages/client-dashboard.tsx`:

### `CashFlowForecastView.tsx`
Re-exports the CashFlowForecastView component.

**Component Props:**
- `assets: Asset[]`
- `cashFlows: CashFlow[]`
- `clientId: number`
- `autoFullScreen?: boolean`
- `onCloseFullScreen?: () => void`

**Features:**
- 12-month cash flow forecast visualization
- Waterfall chart showing income, expenses, and balance
- P&L table with grouping and collapsible sections
- Liquidity KPI dashboard
- Full-screen modal support

### `MoneyMovementView.tsx`
Re-exports the MoneyMovementView component.

**Features:**
- Sankey diagram showing cash flows between accounts
- Ledger view of movements
- Transfer planning interface

### `GuruAllocationView.tsx`
Re-exports the GuruAllocationView component.

**Features:**
- GURU bucket allocation visualization
- Pie charts and distribution analysis
- Optimization recommendations

### `AdvisorBriefView.tsx`
Re-exports the AdvisorBriefView component.

**Features:**
- Executive summary for advisors
- Key metrics and KPIs
- Action items and alerts
- Client discussion points

### `GuruLandingView.tsx`
Re-exports the GuruLandingView component.

**Features:**
- Landing page / dashboard entry point
- Key financial metrics
- Navigation to other views
- Quick access to common tasks

### `BalanceSheetView.tsx`
Re-exports the BalanceSheetView component.

**Features:**
- Assets grouped by type
- Liabilities organized by category
- Net worth calculations
- Detailed holding information

### `DetectionSystemView.tsx`
Re-exports the DetectionSystemView component.

**Features:**
- Alert system for financial anomalies
- Risk detection
- Recommendation engine

## Import Options

### Option 1: Import all views
```tsx
import { CashFlowForecastView, AdvisorBriefView } from "@/views";
```

### Option 2: Import specific view
```tsx
import { CashFlowForecastView } from "@/views/CashFlowForecastView";
```

### Option 3: Import from dashboard directly
```tsx
import { CashFlowForecastView } from "@/pages/client-dashboard";
```

## Implementation Details

Each view file simply re-exports the corresponding component from the main dashboard module. This creates a clean separation of concerns while maintaining all functionality in the centralized `client-dashboard.tsx`.

**Example View File Structure:**
```tsx
// Re-export of CashFlowForecastView from the main dashboard module
// This file enables importing as: import { CashFlowForecastView } from "@/views/CashFlowForecastView"

export { CashFlowForecastView } from "@/pages/client-dashboard";
```

## Future Improvements

Future refactoring can:
1. Move individual view component logic into separate files
2. Create shared view utilities as the components grow
3. Implement lazy loading of views for better performance
4. Create additional specialized views as needed

## Shared Dependencies

All views use:
- `useClientConfig()` hook for accessing client configuration
- Shared constants from `@/lib/dashboard`
- Utility functions from `@/pages/client-dashboard.tsx`
- React and UI component libraries
