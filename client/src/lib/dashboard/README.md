# Dashboard Library Modules

This directory contains shared infrastructure for the GURU financial advisor dashboard.

## Files

### `context.tsx`
Provides the `ClientConfigContext` and `useClientConfig` hook for accessing DB-sourced configuration throughout the application.

**Exports:**
- `ClientConfigContext` - React Context for client configuration
- `useClientConfig()` - Hook to access client configuration
- `ClientConfig` - TypeScript interface for the config shape

**Usage:**
```tsx
import { useClientConfig } from "@/lib/dashboard/context";

function MyComponent() {
  const { taxProfile, assetReturns, cfCategoryRules } = useClientConfig();
  // ...
}
```

### `constants.ts`
Contains all shared constants used across the dashboard views.

**Exports:**
- `DEMO_NOW` - Simulated "today" date (December 31, 2025)
- `HERO_COLORS` - Color palette for hero cards
- `FLAG_META` - Metadata for client flags (excess cash, deficit, etc.)
- `BOB_CLIENTS` - Synthetic Book of Business client data
- `PANEL_CLS` - CSS class for light panels
- `INTEL_PANEL_CLS` - CSS class for dark intelligence panels
- `GREEN`, `RED`, `BLUE` - Core color values
- `INTEL_GREEN`, `INTEL_GREEN_DIM`, `INTEL_GRID` - Intelligence tab colors
- `GURU_BUCKETS` - 5-bucket framework definitions
- `GuroBucket`, `FlagKey`, `BobClient` - TypeScript types

**Usage:**
```tsx
import { DEMO_NOW, GURU_BUCKETS, HERO_COLORS } from "@/lib/dashboard/constants";

const bucketColor = GURU_BUCKETS.reserve.color;
const heroCard = HERO_COLORS["Operating Cash"];
```

### `formatters.ts`
Contains number and currency formatting utilities.

**Exports:**
- `fmt(value, compact?)` - Format number as USD currency
- `fmtK(value)` - Format number as currency in thousands notation

**Usage:**
```tsx
import { fmt, fmtK } from "@/lib/dashboard/formatters";

const fullFormat = fmt(50000);        // "$50,000"
const compactFormat = fmt(1500000, true);  // "$1.5M"
const kiloFormat = fmtK(150000);      // "$150k"
```

### `index.ts`
Barrel export file for convenient importing of all dashboard utilities.

**Usage:**
```tsx
import { DEMO_NOW, fmt, useClientConfig, GURU_BUCKETS } from "@/lib/dashboard";
```

## Architecture

These shared modules are imported by:
- `@/pages/client-dashboard.tsx` - Main dashboard component
- View components in `@/views/` - Individual view components
- Other parts of the application needing dashboard utilities

## Key Design Decisions

1. **Context over Props**: `ClientConfigContext` enables all views to access client config without prop drilling
2. **Centralized Constants**: All shared constants live here to ensure single source of truth
3. **Composition**: `constants.ts`, `context.tsx`, and `formatters.ts` are separate files with clear responsibilities
4. **Barrel Exports**: `index.ts` provides convenient imports while allowing specific file imports for tree-shaking

## Migration Notes

These modules were extracted from `client-dashboard.tsx` (originally ~14,000 lines) to improve code organization and enable better separation of concerns across multiple view files.
