import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
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

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  type: text("type").notNull(), // e.g., equity, fixed_income, real_estate, cash
  value: numeric("value").notNull(),
  description: text("description").notNull(),
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

// Relations
export const clientsRelations = relations(clients, ({ many }) => ({
  assets: many(assets),
  liabilities: many(liabilities),
  cashFlows: many(cashFlows),
  strategies: many(strategies),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  client: one(clients, { fields: [assets.clientId], references: [clients.id] }),
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

// Schemas
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export const insertAssetSchema = createInsertSchema(assets).omit({ id: true });
export const insertLiabilitySchema = createInsertSchema(liabilities).omit({ id: true });
export const insertCashFlowSchema = createInsertSchema(cashFlows).omit({ id: true });
export const insertStrategySchema = createInsertSchema(strategies).omit({ id: true, createdAt: true });

// Types
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Liability = typeof liabilities.$inferSelect;
export type InsertLiability = z.infer<typeof insertLiabilitySchema>;
export type CashFlow = typeof cashFlows.$inferSelect;
export type InsertCashFlow = z.infer<typeof insertCashFlowSchema>;
export type Strategy = typeof strategies.$inferSelect;
export type InsertStrategy = z.infer<typeof insertStrategySchema>;

// API Request Types
export type CreateClientRequest = InsertClient;
export type CreateAssetRequest = InsertAsset;
export type CreateLiabilityRequest = InsertLiability;
export type CreateCashFlowRequest = InsertCashFlow;

export interface ClientDashboardResponse {
  client: Client;
  assets: Asset[];
  liabilities: Liability[];
  cashFlows: CashFlow[];
  strategies: Strategy[];
}

// ─── Design System ───────────────────────────────────────────────────

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
