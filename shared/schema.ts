import { pgTable, text, serial, integer, boolean, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  age: integer("age").notNull(),
  riskTolerance: text("risk_tolerance").notNull(), // e.g., conservative, moderate, aggressive
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Accounts ────────────────────────────────────────────────────────────────
// Represents a financial account at an institution — the container for holdings.
// GURU aggregates data from connected accounts (Plaid, direct API, manual entry).
// Each account is categorized into a GURU bucket for liquidity/allocation modeling.
//
// accountType — the institution's classification of the account:
//   "checking" | "savings" | "money_market" | "brokerage" | "401k" | "ira" |
//   "roth_ira" | "real_estate" | "private_equity" | "crypto" | "fixed_income" |
//   "equity_compensation"
//
// guruBucket — GURU's allocation bucket (may differ from accountType, because
//   a single brokerage can hold both idle cash sweep → "reserve" and index ETFs → "investments"):
//   "operating" | "reserve" | "capital_build" | "investments" |
//   "alternatives" | "retirement" | "real_estate"
//
// isAdvisorManaged — true means RIA-managed; false means self-directed by client.
//   This distinction drives the investment split story (advisor AUM vs. self-directed risk).
//
// dataSource — where GURU is pulling the data from:
//   "plaid" | "fidelity" | "schwab_api" | "etrade_api" | "manual" | "zillow"

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  institutionName: text("institution_name").notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number"),           // masked, e.g. "****3314"
  accountType: text("account_type").notNull(),
  guruBucket: text("guru_bucket"),
  isAdvisorManaged: boolean("is_advisor_managed").default(false).notNull(),
  dataSource: text("data_source"),                 // "plaid" | "fidelity" | "manual" | "zillow"
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Assets (Holdings) ────────────────────────────────────────────────────────
// Each row is a single holding within an account.
// accountId links back to the account container.
// ticker / shares / pricePerShare are populated for publicly-traded securities.
// For cash, managed portfolios, and illiquid positions, these may be null.
// value is always authoritative — ticker math is supplementary display data.

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  accountId: integer("account_id").references(() => accounts.id),  // which account holds this
  type: text("type").notNull(),            // "equity" | "fixed_income" | "cash" | "real_estate" | "alternative"
  value: numeric("value").notNull(),       // authoritative total value (USD)
  description: text("description").notNull(),
  ticker: text("ticker"),                  // e.g. "VTI", "META", "SPAXX" — null for managed/illiquid
  shares: numeric("shares"),              // number of shares/units held — null for non-security
  pricePerShare: numeric("price_per_share"), // price per unit — null for non-security
});

export const liabilities = pgTable("liabilities", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  type: text("type").notNull(), // e.g., mortgage, personal_loan
  value: numeric("value").notNull(),
  interestRate: numeric("interest_rate").notNull(),
  description: text("description").notNull(),
});

export const cashFlows = pgTable("cash_flows", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  type: text("type").notNull(), // inflow, outflow
  amount: numeric("amount").notNull(),
  category: text("category").notNull(), // e.g., salary, business, living_expenses, taxes
  date: timestamp("date").notNull(),
  description: text("description").notNull(),
});

export const strategies = pgTable("strategies", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  name: text("name").notNull(),
  recommendation: text("recommendation").notNull(),
  impact: numeric("impact").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Client Tax Profile ───────────────────────────────────────────────────────
// Stores the client's tax situation so yield and return calculations are
// client-specific rather than hardcoded constants.
//
// This replaces the hardcoded BANK_TAX, TREAS_TAX, LTCG_TAX constants
// and the PROFORMA_AT object in client-dashboard.tsx.
//
// combinedOrdinaryRate   = federalOrdinaryRate + stateLocalRate  (e.g. 0.47 for NYC)
// treasuryTaxRate        = federalOrdinaryRate only — US Treasuries are exempt
//                          from state/local income tax
// ltcgRate               = long-term capital gains rate (federal)

export const clientTaxProfiles = pgTable("client_tax_profiles", {
  id:                    serial("id").primaryKey(),
  clientId:              integer("client_id").notNull().references(() => clients.id),
  filingStatus:          text("filing_status").notNull(),        // "married_filing_jointly" | "single" | "head_of_household"
  taxJurisdiction:       text("tax_jurisdiction").notNull(),     // "NYC" | "CA" | "TX" | etc.
  federalOrdinaryRate:   numeric("federal_ordinary_rate").notNull(), // e.g. "0.37"
  stateLocalRate:        numeric("state_local_rate").notNull(),      // e.g. "0.10"
  combinedOrdinaryRate:  numeric("combined_ordinary_rate").notNull(),// e.g. "0.47"
  treasuryTaxRate:       numeric("treasury_tax_rate").notNull(),     // e.g. "0.35" (federal only)
  ltcgRate:              numeric("ltcg_rate").notNull(),             // e.g. "0.20"
  createdAt:             timestamp("created_at").defaultNow(),
});

// ─── Asset Returns ────────────────────────────────────────────────────────────
// Maps asset descriptions to their performance/yield labels for display.
// Replaces the hardcoded ASSET_RETURNS array in client-dashboard.tsx.
//
// matchPattern   — lowercase substring to match against asset.description
//                  (e.g. "cresset — us large cap" matches that holding)
// returnLabel    — display string shown in the UI (e.g. "+16.4%", "3.65% yield")
// returnType     — drives how the label is colored/formatted:
//                  "equity_return" | "yield" | "irr" | "pe_carry"
// sortPriority   — lower number = try to match first (handles overlapping patterns,
//                  e.g. "cresset — us large cap core" before "cresset")

export const assetReturns = pgTable("asset_returns", {
  id:            serial("id").primaryKey(),
  clientId:      integer("client_id").references(() => clients.id), // null = global default
  matchPattern:  text("match_pattern").notNull(),
  returnLabel:   text("return_label").notNull(),
  returnType:    text("return_type").notNull(),   // "equity_return" | "yield" | "irr" | "pe_carry"
  sortPriority:  integer("sort_priority").notNull().default(100),
  createdAt:     timestamp("created_at").defaultNow(),
});

// ─── Cash Flow Category Rules ─────────────────────────────────────────────────
// Defines the P&L row structure for the Cash Flow Forecast view, per client.
// Replaces the hardcoded CF_PL_ROWS constant in client-dashboard.tsx.
//
// Each row in this table is one line in the P&L — either a data row (matches
// actual transactions from cash_flows) or a calculated row (subtotal / total).
//
// key        — unique identifier for this row within a client's P&L
// kind       — "row"      : a single line item matched from cash_flows
//              "subtotal" : sum of a group, shown inline
//              "total"    : bold summary row (e.g. TOTAL CASH EXPENSES)
//              "section"  : header label with no value
//              "blank"    : visual spacer row
// matchDescs — JSON array of description substrings to match in cash_flows
//              (only used when kind = "row")
// cfType     — "inflow" | "outflow" | null (null = match either)
// sumOf      — JSON array of row keys to add together (used for totals/subtotals)
// accent     — visual highlight: "green" | "blue" | null
// sortOrder  — controls display sequence

export const cfCategoryRules = pgTable("cf_category_rules", {
  id:          serial("id").primaryKey(),
  clientId:    integer("client_id").notNull().references(() => clients.id),
  key:         text("key").notNull(),
  kind:        text("kind").notNull(),          // "row" | "subtotal" | "total" | "section" | "blank"
  label:       text("label").notNull(),
  matchDescs:  jsonb("match_descs"),            // string[] — description substrings to match
  cfType:      text("cf_type"),                 // "inflow" | "outflow" | null
  sumOf:       jsonb("sum_of"),                 // string[] — keys to sum for totals
  accent:      text("accent"),                  // "green" | "blue" | null
  sortOrder:   integer("sort_order").notNull(),
  note:        text("note"),
  createdAt:   timestamp("created_at").defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const clientsRelations = relations(clients, ({ many }) => ({
  accounts:        many(accounts),
  assets:          many(assets),
  liabilities:     many(liabilities),
  cashFlows:       many(cashFlows),
  strategies:      many(strategies),
  taxProfile:      many(clientTaxProfiles),
  assetReturns:    many(assetReturns),
  cfCategoryRules: many(cfCategoryRules),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  client:   one(clients,  { fields: [accounts.clientId],  references: [clients.id] }),
  holdings: many(assets),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  client:  one(clients,  { fields: [assets.clientId],  references: [clients.id] }),
  account: one(accounts, { fields: [assets.accountId], references: [accounts.id] }),
}));

export const liabilitiesRelations = relations(liabilities, ({ one }) => ({
  client: one(clients, { fields: [liabilities.clientId], references: [clients.id] }),
}));

export const cashFlowsRelations = relations(cashFlows, ({ one }) => ({
  client: one(clients, { fields: [cashFlows.clientId], references: [clients.id] }),
}));

export const strategiesRelations = relations(strategies, ({ one }) => ({
  client: one(clients, { fields: [strategies.clientId], references: [clients.id] }),
}));

export const clientTaxProfilesRelations = relations(clientTaxProfiles, ({ one }) => ({
  client: one(clients, { fields: [clientTaxProfiles.clientId], references: [clients.id] }),
}));

export const assetReturnsRelations = relations(assetReturns, ({ one }) => ({
  client: one(clients, { fields: [assetReturns.clientId], references: [clients.id] }),
}));

export const cfCategoryRulesRelations = relations(cfCategoryRules, ({ one }) => ({
  client: one(clients, { fields: [cfCategoryRules.clientId], references: [clients.id] }),
}));

// ─── Insert Schemas ────────────────────────────────────────────────────────────

export const insertClientSchema         = createInsertSchema(clients).omit({ id: true, createdAt: true });
export const insertAccountSchema        = createInsertSchema(accounts).omit({ id: true, createdAt: true });
export const insertAssetSchema          = createInsertSchema(assets).omit({ id: true });
export const insertLiabilitySchema      = createInsertSchema(liabilities).omit({ id: true });
export const insertCashFlowSchema       = createInsertSchema(cashFlows).omit({ id: true });
export const insertStrategySchema       = createInsertSchema(strategies).omit({ id: true, createdAt: true });
export const insertClientTaxProfileSchema = createInsertSchema(clientTaxProfiles).omit({ id: true, createdAt: true });
export const insertAssetReturnSchema    = createInsertSchema(assetReturns).omit({ id: true, createdAt: true });
export const insertCfCategoryRuleSchema = createInsertSchema(cfCategoryRules).omit({ id: true, createdAt: true });

// ─── Types ────────────────────────────────────────────────────────────────────

export type Client           = typeof clients.$inferSelect;
export type InsertClient     = z.infer<typeof insertClientSchema>;
export type Account          = typeof accounts.$inferSelect;
export type InsertAccount    = z.infer<typeof insertAccountSchema>;
export type Asset            = typeof assets.$inferSelect;
export type InsertAsset      = z.infer<typeof insertAssetSchema>;
export type Liability        = typeof liabilities.$inferSelect;
export type InsertLiability  = z.infer<typeof insertLiabilitySchema>;
export type CashFlow         = typeof cashFlows.$inferSelect;
export type InsertCashFlow   = z.infer<typeof insertCashFlowSchema>;
export type Strategy         = typeof strategies.$inferSelect;
export type InsertStrategy   = z.infer<typeof insertStrategySchema>;
export type ClientTaxProfile    = typeof clientTaxProfiles.$inferSelect;
export type InsertClientTaxProfile = z.infer<typeof insertClientTaxProfileSchema>;
export type AssetReturn         = typeof assetReturns.$inferSelect;
export type InsertAssetReturn   = z.infer<typeof insertAssetReturnSchema>;
export type CfCategoryRule      = typeof cfCategoryRules.$inferSelect;
export type InsertCfCategoryRule = z.infer<typeof insertCfCategoryRuleSchema>;

// ─── API Request Types ────────────────────────────────────────────────────────

export type CreateClientRequest    = InsertClient;
export type CreateAccountRequest   = InsertAccount;
export type CreateAssetRequest     = InsertAsset;
export type CreateLiabilityRequest = InsertLiability;
export type CreateCashFlowRequest  = InsertCashFlow;

export interface ClientDashboardResponse {
  client:          Client;
  accounts:        Account[];         // account containers — each holds one or more assets
  assets:          Asset[];           // individual holdings, linked to accounts via accountId
  liabilities:     Liability[];
  cashFlows:       CashFlow[];
  strategies:      Strategy[];
  taxProfile:      ClientTaxProfile | null;   // client's tax rates (replaces hardcoded constants)
  assetReturns:    AssetReturn[];             // performance labels per holding (replaces ASSET_RETURNS)
  cfCategoryRules: CfCategoryRule[];          // P&L row structure (replaces CF_PL_ROWS)
}

// ─── Design System ───────────────────────────────────────────────────────────

export const designSystem = {
  colors: {
    // Brand
    primary: "#183B6E",    // Navy
    green: "#1e6b45",      // Success / positive
    amber: "#9A6B10",      // Warning / attention
    danger: "#8B2020",     // Error / negative

    // Neutrals
    background: "#F0EDE8", // Warm parchment
    card: "#FFFFFF",
    text: "#1A1915",
    muted: "#9A9890",
    border: "rgba(0,0,0,0.08)",

    // Extended neutrals
    neutral50: "#FAFAF8",
    neutral100: "#F5F3EF",
    neutral200: "#E8E5DF",
    neutral300: "#D5D2CC",
    neutral400: "#B0ADA6",
    neutral500: "#9A9890",
    neutral600: "#6E6C66",
    neutral700: "#4A4843",
    neutral800: "#2C2A26",
    neutral900: "#1A1915",
  },

  typography: {
    fontFamily: {
      sans: "'DM Sans', sans-serif",
      serif: "'Playfair Display', serif",
    },
    fontSize: {
      xs: "10px",
      sm: "12px",
      base: "13px",
      md: "14px",
      lg: "16px",
      xl: "19px",
      "2xl": "24px",
      "3xl": "32px",
      "4xl": "42px",
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },

  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    base: "16px",
    lg: "20px",
    xl: "24px",
    "2xl": "32px",
    "3xl": "48px",
  } as const,

  borderRadius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "9999px",
  },

  shadows: {
    card: "0 2px 12px rgba(0,0,0,0.06)",
    cardHover: "0 8px 32px rgba(0,0,0,0.10)",
    dropdown: "0 4px 16px rgba(0,0,0,0.12)",
    modal: "0 16px 48px rgba(0,0,0,0.18)",
  },
} as const;

export type DesignSystem = typeof designSystem;
