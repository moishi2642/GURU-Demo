import { createContext, useContext } from "react";
import type { ClientTaxProfile, AssetReturn, CfCategoryRule } from "@shared/schema";

// ─── Client Config Context ─────────────────────────────────────────────────────
// Provides DB-sourced config to every view without prop drilling.
// Think of this as the "Inputs Tab" being available everywhere in the model.
//
// taxProfile      — client tax rates (replaces BANK_TAX / TREAS_TAX / LTCG_TAX constants)
// assetReturns    — performance labels per holding (replaces ASSET_RETURNS array)
// cfCategoryRules — P&L row structure (replaces CF_PL_ROWS constant)

interface ClientConfig {
  taxProfile:      ClientTaxProfile | null;
  assetReturns:    AssetReturn[];
  cfCategoryRules: CfCategoryRule[];
}

const ClientConfigContext = createContext<ClientConfig>({
  taxProfile:      null,
  assetReturns:    [],
  cfCategoryRules: [],
});

/** Hook — use inside any view to access DB-sourced config */
function useClientConfig(): ClientConfig {
  return useContext(ClientConfigContext);
}

export { ClientConfigContext, useClientConfig };
export type { ClientConfig };
