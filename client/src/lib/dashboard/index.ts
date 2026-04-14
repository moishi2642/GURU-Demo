// Dashboard library barrel export
// Import shared utilities via: import { DEMO_NOW, fmt } from "@/lib/dashboard"

export { ClientConfigContext, useClientConfig, type ClientConfig } from "./context";
export {
  DEMO_NOW,
  HERO_COLORS,
  FLAG_META,
  BOB_CLIENTS,
  PANEL_CLS,
  INTEL_PANEL_CLS,
  GREEN,
  RED,
  BLUE,
  INTEL_GREEN,
  INTEL_GREEN_DIM,
  INTEL_GRID,
  GURU_BUCKETS,
  type GuroBucket,
  type FlagKey,
  type BobClient,
} from "./constants";
export { fmt, fmtK } from "./formatters";
