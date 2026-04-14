import { db } from "./db";
import {
  clients, accounts, assets, liabilities, cashFlows, strategies,
  type InsertClient, type InsertAccount, type InsertAsset,
  type InsertLiability, type InsertCashFlow, type InsertStrategy,
  type Client, type Account, type Asset,
  type Liability, type CashFlow, type Strategy
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  deleteClient(id: number): Promise<void>;
  setOnboardingComplete(id: number, complete: boolean): Promise<Client | undefined>;

  getAccounts(clientId: number): Promise<Account[]>;
  createAccount(account: InsertAccount): Promise<Account>;

  getAssets(clientId: number): Promise<Asset[]>;
  createAsset(asset: InsertAsset): Promise<Asset>;

  getLiabilities(clientId: number): Promise<Liability[]>;
  createLiability(liability: InsertLiability): Promise<Liability>;

  getCashFlows(clientId: number): Promise<CashFlow[]>;
  createCashFlow(cashFlow: InsertCashFlow): Promise<CashFlow>;

  getStrategies(clientId: number): Promise<Strategy[]>;
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
}

export class DatabaseStorage implements IStorage {
  async getClients(): Promise<Client[]> {
    return await db.select().from(clients);
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [created] = await db.insert(clients).values(client).returning();
    return created;
  }

  async deleteClient(id: number): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async setOnboardingComplete(id: number, complete: boolean): Promise<Client | undefined> {
    const [updated] = await db.update(clients)
      .set({ onboardingComplete: complete })
      .where(eq(clients.id, id))
      .returning();
    return updated;
  }

  async getAccounts(clientId: number): Promise<Account[]> {
    return await db.select().from(accounts).where(eq(accounts.clientId, clientId));
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    const [created] = await db.insert(accounts).values(account).returning();
    return created;
  }

  async getAssets(clientId: number): Promise<Asset[]> {
    return await db.select().from(assets).where(eq(assets.clientId, clientId));
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const [created] = await db.insert(assets).values(asset).returning();
    return created;
  }

  async getLiabilities(clientId: number): Promise<Liability[]> {
    return await db.select().from(liabilities).where(eq(liabilities.clientId, clientId));
  }

  async createLiability(liability: InsertLiability): Promise<Liability> {
    const [created] = await db.insert(liabilities).values(liability).returning();
    return created;
  }

  async getCashFlows(clientId: number): Promise<CashFlow[]> {
    return await db.select().from(cashFlows).where(eq(cashFlows.clientId, clientId));
  }

  async createCashFlow(cashFlow: InsertCashFlow): Promise<CashFlow> {
    const [created] = await db.insert(cashFlows).values(cashFlow).returning();
    return created;
  }

  async getStrategies(clientId: number): Promise<Strategy[]> {
    return await db.select().from(strategies).where(eq(strategies.clientId, clientId));
  }

  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const [created] = await db.insert(strategies).values(strategy).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
