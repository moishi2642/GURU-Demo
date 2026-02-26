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
