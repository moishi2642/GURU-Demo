import type { Express } from "express";
import type { Server } from "http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { db, pool, queryWithRetry } from "./db";
import { eq } from "drizzle-orm";
import { cashFlows as cfTable, accounts as accountsTable, assets as assetsTable, clients as clientsTable, liabilities as liabilitiesTable, strategies as strategiesTable } from "@shared/schema";

const openai = process.env.AI_INTEGRATIONS_OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    })
  : null;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Run migrations before any Drizzle queries touch the DB
  await runMigrations().catch((e) => console.error("[db] Migration skipped (offline):", e.message));
  seedDatabase().catch(console.error);

  // ── Clients ──────────────────────────────────────────────────────────────
  app.get(api.clients.list.path, async (req, res) => {
    const clients = await storage.getClients();
    res.json(clients);
  });

  app.get(api.clients.get.path, async (req, res) => {
    const id = Number(req.params.id);
    const client = await storage.getClient(id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  });

  app.get(api.clients.dashboard.path, async (req, res) => {
    const id = Number(req.params.id);
    const client = await storage.getClient(id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    const [accounts, assets, liabilities, cashFlows, strategies] = await Promise.all([
      storage.getAccounts(id),
      storage.getAssets(id),
      storage.getLiabilities(id),
      storage.getCashFlows(id),
      storage.getStrategies(id),
    ]);
    res.json({ client, accounts, assets, liabilities, cashFlows, strategies });
  });

  // ── Accounts ──────────────────────────────────────────────────────────────
  app.get(api.accounts.list.path, async (req, res) => {
    const id = Number(req.params.id);
    const client = await storage.getClient(id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    const accounts = await storage.getAccounts(id);
    res.json(accounts);
  });

  // ── Market Data Proxy ─────────────────────────────────────────────────────
  const YAHOO_AUTH_FILE = "/tmp/guru-yahoo-auth.json";
  let _yahooAuth: { cookies: string; crumb: string; expiresAt: number } | null = null;

  function loadCachedAuth() {
    try { const d = JSON.parse(readFileSync(YAHOO_AUTH_FILE, "utf8")); return d.expiresAt > Date.now() ? d : null; } catch { return null; }
  }

  async function getYahooAuth() {
    if (_yahooAuth && Date.now() < _yahooAuth.expiresAt) return _yahooAuth;
    const fromFile = loadCachedAuth();
    if (fromFile) { _yahooAuth = fromFile; return _yahooAuth; }
    const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    const cookieResp = await fetch("https://fc.yahoo.com/", { redirect: "follow", headers: { "User-Agent": UA } });
    const rawCookies: string[] = [];
    try {
      const sc = (cookieResp.headers as any).getSetCookie?.();
      if (Array.isArray(sc)) rawCookies.push(...sc);
    } catch { /* ignore */ }
    if (rawCookies.length === 0) {
      const raw = cookieResp.headers.get("set-cookie");
      if (raw) rawCookies.push(...raw.split(/,(?=[^ ])/));
    }
    const cookies = rawCookies.map(c => c.split(";")[0].trim()).join("; ");

    const crumbResp = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, "Cookie": cookies },
    });
    if (crumbResp.status === 429) throw new Error("Yahoo rate-limited");
    const crumb = await crumbResp.text();
    if (!crumb || crumb.includes('"error"') || crumb.includes("Too Many")) throw new Error(`Yahoo crumb: ${crumb.substring(0, 80)}`);

    _yahooAuth = { cookies, crumb, expiresAt: Date.now() + 3_600_000 };
    try { writeFileSync(YAHOO_AUTH_FILE, JSON.stringify(_yahooAuth)); } catch { /* ignore */ }
    console.log("[yahoo/auth] refreshed crumb OK:", crumb.substring(0, 20));
    return _yahooAuth;
  }

  app.get("/api/market/quotes", async (req, res) => {
    const symbols = (req.query.symbols as string) || "SPY,QQQ,^DJI,GS,^TNX,BTC-USD,^VIX";
    const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
    try {
      const { cookies, crumb } = await getYahooAuth();
      const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&crumb=${encodeURIComponent(crumb)}`;
      const response = await fetch(url, {
        headers: { "User-Agent": UA, "Cookie": cookies, "Accept": "application/json" },
      });
      if (!response.ok) {
        _yahooAuth = null;
        throw new Error(`Yahoo: ${response.status}`);
      }
      const data = await response.json() as any;
      const results = (data?.quoteResponse?.result || []).map((q: any) => ({
        symbol: q.symbol,
        shortName: q.shortName || q.displayName || q.symbol,
        price: q.regularMarketPrice ?? null,
        change: q.regularMarketChange ?? null,
        changePercent: q.regularMarketChangePercent ?? null,
        open: q.regularMarketOpen ?? null,
        high: q.regularMarketDayHigh ?? null,
        low: q.regularMarketDayLow ?? null,
        volume: q.regularMarketVolume ?? null,
        marketState: q.marketState ?? "CLOSED",
      }));
      res.json(results);
    } catch (err) {
      console.error("[market/quotes]", err);
      res.status(502).json({ error: "Market data unavailable" });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    const id = Number(req.params.id);
    // Delete child records first (FK constraints)
    await db.delete(cfTable).where(eq(cfTable.clientId, id));
    await db.delete(assetsTable).where(eq(assetsTable.clientId, id));
    await db.delete(liabilitiesTable).where(eq(liabilitiesTable.clientId, id));
    await db.delete(strategiesTable).where(eq(strategiesTable.clientId, id));
    await storage.deleteClient(id);
    res.status(204).end();
  });

  app.patch("/api/clients/:id/onboarding", async (req, res) => {
    const id = Number(req.params.id);
    const { complete } = req.body;
    const updated = await storage.setOnboardingComplete(id, !!complete);
    if (!updated) return res.status(404).json({ message: "Client not found" });
    res.json(updated);
  });

  // One-time setup: add onboarding_complete column if missing
  app.post("/api/admin/migrate", async (req, res) => {
    try {
      await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false`);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(api.clients.create.path, async (req, res) => {
    try {
      const input = api.clients.create.input.parse(req.body);
      const client = await storage.createClient(input);
      res.status(201).json(client);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Assets ────────────────────────────────────────────────────────────────
  app.post(api.assets.create.path, async (req, res) => {
    try {
      const bodySchema = api.assets.create.input.extend({
        clientId: z.coerce.number(),
        value: z.coerce.string(),
      });
      const input = bodySchema.parse(req.body);
      const asset = await storage.createAsset({ ...input, value: input.value.toString() });
      res.status(201).json(asset);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Liabilities ───────────────────────────────────────────────────────────
  app.post(api.liabilities.create.path, async (req, res) => {
    try {
      const bodySchema = api.liabilities.create.input.extend({
        clientId: z.coerce.number(),
        value: z.coerce.string(),
        interestRate: z.coerce.string(),
      });
      const input = bodySchema.parse(req.body);
      const liability = await storage.createLiability({
        ...input,
        value: input.value.toString(),
        interestRate: input.interestRate.toString(),
      });
      res.status(201).json(liability);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Cash Flows ────────────────────────────────────────────────────────────
  app.post(api.cashFlows.create.path, async (req, res) => {
    try {
      const bodySchema = api.cashFlows.create.input.extend({
        clientId: z.coerce.number(),
        amount: z.coerce.string(),
        date: z.coerce.date(),
      });
      const input = bodySchema.parse(req.body);
      const cashFlow = await storage.createCashFlow({ ...input, amount: input.amount.toString() });
      res.status(201).json(cashFlow);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── AI Strategy Generation ────────────────────────────────────────────────
  app.post(api.clients.generateStrategy.path, async (req, res) => {
    if (!openai) return res.status(503).json({ message: "AI features unavailable — no OpenAI API key configured." });
    try {
      const id = Number(req.params.id);
      const client = await storage.getClient(id);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const [assets, liabilities, cashFlows] = await Promise.all([
        storage.getAssets(id),
        storage.getLiabilities(id),
        storage.getCashFlows(id),
      ]);

      const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
      const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.value), 0);
      const netWorth = totalAssets - totalLiabilities;
      // Cash flows stored as per-month events — sum = annual totals
      const annualInflow = cashFlows.filter(c => c.type === "inflow").reduce((s, c) => s + Number(c.amount), 0);
      const annualOutflow = cashFlows.filter(c => c.type === "outflow").reduce((s, c) => s + Number(c.amount), 0);
      const monthlyInflow = annualInflow / 12;
      const monthlyOutflow = annualOutflow / 12;
      const liquidAssets = assets.filter(a => ["cash", "fixed_income"].includes(a.type)).reduce((s, a) => s + Number(a.value), 0);
      const liquidityCoverageMonths = monthlyOutflow > 0 ? liquidAssets / monthlyOutflow : Infinity;

      const prompt = `You are an expert wealth advisor using an AI financial decisioning system called GURU.

Analyze the following client profile and generate 3 specific, actionable strategic recommendations to optimize their full balance sheet and cash management strategy. Focus on:
1. Matching liquidity with cash flow requirements
2. Optimal cash management and deployment
3. Balance sheet efficiency (debt optimization, asset allocation rebalancing)

Client Profile:
- Name: ${client.name}
- Age: ${client.age}
- Risk Tolerance: ${client.riskTolerance}

Balance Sheet Summary:
- Total Assets: $${totalAssets.toLocaleString()}
- Total Liabilities: $${totalLiabilities.toLocaleString()}
- Net Worth: $${netWorth.toLocaleString()}
- Debt-to-Assets: ${totalAssets > 0 ? ((totalLiabilities / totalAssets) * 100).toFixed(1) : 0}%

Assets:
${assets.map(a => `- ${a.type.replace("_", " ")}: $${Number(a.value).toLocaleString()} (${a.description})`).join("\n")}

Liabilities:
${liabilities.map(l => `- ${l.type.replace("_", " ")}: $${Number(l.value).toLocaleString()} at ${l.interestRate}% APR (${l.description})`).join("\n") || "None"}

Cash Flow Summary:
- Monthly Inflows: $${monthlyInflow.toLocaleString()}
- Monthly Outflows: $${monthlyOutflow.toLocaleString()}
- Monthly Net: $${(monthlyInflow - monthlyOutflow).toLocaleString()}
- Liquid Assets: $${liquidAssets.toLocaleString()} (${isFinite(liquidityCoverageMonths) ? liquidityCoverageMonths.toFixed(1) + " months coverage" : "unlimited coverage"})

Cash Flows Detail:
${cashFlows.map(c => `- [${c.type}] ${c.category}: $${Number(c.amount).toLocaleString()} — ${c.description}`).join("\n") || "None recorded"}

Respond with a JSON object with a "strategies" array. Each element must have:
- "name": Short, specific action title (6-10 words)
- "recommendation": Clear, 2-3 sentence explanation with specific numbers and rationale
- "impact": Estimated annual dollar impact on net worth (integer, always positive)`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 2000,
      });

      const content = aiResponse.choices[0]?.message?.content || '{"strategies":[]}';
      const parsed = JSON.parse(content);

      const newStrategies = [];
      for (const s of (parsed.strategies || []).slice(0, 3)) {
        const strategy = await storage.createStrategy({
          clientId: id,
          name: String(s.name),
          recommendation: String(s.recommendation),
          impact: String(Math.abs(Number(s.impact) || 0)),
        });
        newStrategies.push(strategy);
      }

      res.json(newStrategies);
    } catch (error) {
      console.error("Error generating strategy:", error);
      res.status(500).json({ message: "Failed to generate strategies" });
    }
  });

  // ── Document upload endpoint ─────────────────────────────────────────────────
  app.post("/api/clients/:id/documents", async (req, res) => {
    try {
      const clientId = parseInt(req.params.id, 10);
      const { name, type, data } = req.body as { name: string; type: string; data: string };

      if (!name || !data) {
        res.status(400).json({ message: "name and data are required" });
        return;
      }

      // Save file to uploads directory
      const uploadsDir = join(process.cwd(), "uploads", String(clientId));
      if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

      const safeName = name.replace(/[^a-zA-Z0-9._\-]/g, "_");
      const filePath = join(uploadsDir, `${Date.now()}_${safeName}`);
      writeFileSync(filePath, Buffer.from(data, "base64"));

      console.log(`[upload] Saved ${name} for client ${clientId} → ${filePath}`);

      res.json({ ok: true, filename: safeName, path: filePath });
    } catch (err) {
      console.error("[upload] Error:", err);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  return httpServer;
}

// ── Migrations ─────────────────────────────────────────────────────────────────
async function runMigrations() {
  // Add onboarding_complete column if it doesn't exist yet
  await queryWithRetry(`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false
  `);

  // ── Accounts table — institution-level containers for holdings ──────────────
  // accountType:  checking | savings | money_market | brokerage | 401k | ira |
  //               roth_ira | real_estate | private_equity | crypto |
  //               fixed_income | equity_compensation
  // guruBucket:   operating | reserve | capital_build | investments |
  //               alternatives | retirement | real_estate
  await queryWithRetry(`
    CREATE TABLE IF NOT EXISTS accounts (
      id                serial      PRIMARY KEY,
      client_id         integer     NOT NULL REFERENCES clients(id),
      institution_name  text        NOT NULL,
      account_name      text        NOT NULL,
      account_number    text,
      account_type      text        NOT NULL,
      guru_bucket       text,
      is_advisor_managed boolean    NOT NULL DEFAULT false,
      data_source       text,
      last_synced_at    timestamp,
      created_at        timestamp   DEFAULT now()
    )
  `);

  // ── Holdings (assets) — add account linkage + security-level fields ─────────
  // account_id: FK to accounts — which account container holds this holding
  // ticker:       security symbol (VTI, META, SPAXX) — null for managed/illiquid
  // shares:       units held — null for cash balances and managed portfolios
  // price_per_share: price per unit — null for non-tradeable positions
  await queryWithRetry(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS account_id integer REFERENCES accounts(id)`);
  await queryWithRetry(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS ticker text`);
  await queryWithRetry(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS shares numeric`);
  await queryWithRetry(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS price_per_share numeric`);

  // Remove stale test profiles (keep Kessler and Mari Oishi only)
  const keepNames = ["Sarah & Michael Kessler", "Mari Oishi"];
  const allClients = await queryWithRetry(`SELECT id, name FROM clients`);
  for (const row of allClients.rows) {
    if (!keepNames.includes(row.name)) {
      await queryWithRetry(`DELETE FROM cash_flows WHERE client_id = $1`, [row.id]);
      await queryWithRetry(`DELETE FROM assets WHERE client_id = $1`, [row.id]);
      await queryWithRetry(`DELETE FROM liabilities WHERE client_id = $1`, [row.id]);
      await queryWithRetry(`DELETE FROM strategies WHERE client_id = $1`, [row.id]);
      await queryWithRetry(`DELETE FROM clients WHERE id = $1`, [row.id]);
      console.log(`[migrate] Removed stale test profile: ${row.name} (id=${row.id})`);
    }
  }

  // Ensure Mari Oishi profile exists (onboarding not complete)
  const { rows } = await queryWithRetry(`SELECT id FROM clients WHERE name = 'Mari Oishi'`);
  if (rows.length === 0) {
    await queryWithRetry(
      `INSERT INTO clients (name, email, age, risk_tolerance, onboarding_complete) VALUES ($1,$2,$3,$4,$5)`,
      ["Mari Oishi", "", 0, "moderate", false]
    );
    console.log("[migrate] Created Mari Oishi profile");
  }

  // Mark Kessler as onboarding complete (they have full data)
  await queryWithRetry(
    `UPDATE clients SET onboarding_complete = true WHERE name = 'Sarah & Michael Kessler'`
  );
}

// ── Seed Data ──────────────────────────────────────────────────────────────────
function monthDate(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

async function seedDatabase() {
  const existing = await storage.getClients();
  const kessler = existing.find(c => c.name === "Sarah & Michael Kessler");

  if (kessler) {
    const cfs      = await storage.getCashFlows(kessler.id);
    const liabs    = await storage.getLiabilities(kessler.id);
    const assets   = await storage.getAssets(kessler.id);
    const accts    = await storage.getAccounts(kessler.id);
    // Check if Kessler data is up to date — if yes, skip
    const needsMigration = cfs.length === 0 || cfs.some(cf =>
      cf.description?.includes("Monthly Net Salaries") ||
      cf.description?.includes("Tribeca — Mortgage, Maintenance") ||
      cf.description?.includes("Management, Mortgage & Maintenance")
    ) || !cfs.some(cf => cf.description?.includes("Thanksgiving Travel"))
      || cfs.some(cf => cf.description?.includes("Investment Property Taxes") && cf.amount === "11012")
      || cfs.some(cf => cf.description?.includes("Annual Memberships") && new Date(cf.date).getUTCMonth() === 10)
      || cfs.some(cf => cf.description?.includes("Year-End Investment") && Number(cf.amount) < 20000)
      // Reseed if student loans are still the old combined single entry
      || liabs.some(l => l.description?.includes("Partner 1 + Partner 2"))
      // Reseed if old Schwab account still present with International Index (replaced by Total Market Index)
      || assets.some(a => a.description?.includes("Schwab - International Index"))
      // Reseed if Cresset is still the old $814,877 value
      || assets.some(a => a.description?.includes("Cresset Capital") && Number(a.value) < 898565)
      // Reseed if accounts layer hasn't been seeded yet
      || accts.length === 0
      // Reseed if student loan still references old Sallie Mae name
      || liabs.some(l => l.description?.includes("Sallie Mae"))
      // Reseed if student loan names are still old (Dept. of Education / SoFi on Michael)
      || liabs.some(l => l.description?.includes("Dept. of Education"))
      || liabs.some(l => l.description?.includes("Michael Kessler (SoFi"))
      // Reseed if T-Bills are still in a separate Treasury Bills account (should be in Fidelity Brokerage)
      || accts.some(a => a.accountName?.includes("Treasury Bills"))
      // Reseed if Cresset is still a single-line holding (should be broken into 4 sleeves)
      || assets.some(a => a.description?.includes("Cresset Capital (advisor-managed"))
      // Reseed if Total Market Index still uses old VTI description (now "Fidelity — Total Market Index Fund")
      || assets.some(a => a.description?.includes("Fidelity - VTI Total Market Index"))
      || assets.some(a => a.description?.includes("Fidelity — VTI Total Market Index"))
      // Reseed if Total Market Index was temporarily assigned to Schwab (it belongs in Fidelity)
      || assets.some(a => a.description?.includes("Schwab — Total Market Index"))
      // Reseed if Cresset still has old "Real Assets & Infrastructure" sleeve
      || assets.some(a => a.description?.includes("Cresset — Real Assets & Infrastructure"))
      // Reseed if Cresset still has "US Small Cap Value" sleeve (moved to Fidelity)
      || assets.some(a => a.description?.includes("Cresset — US Small Cap Value"))
      // Reseed if Fidelity Small Cap Value Index is missing
      || !assets.some(a => a.description?.includes("Small Cap Value Index"))
      // Reseed if Cresset still has the fabricated Investment Grade Fixed Income sleeve
      || assets.some(a => a.description?.includes("Cresset — Investment Grade Fixed Income"))
      // Reseed if private school tuition is missing (ensures tuition appears in cash flow forecast)
      || !cfs.some(cf => cf.description?.includes("Private School Tuition"))
      // Reseed if old monthly Sarasota insurance still present (removed — not a 2026 recurring expense)
      || cfs.some(cf => cf.description?.includes("Investment Property — Homeowner's Insurance"))
      // Reseed if duplicate Sarasota golf entry still present (Excel has one golf entry only)
      || cfs.some(cf => cf.description?.includes("Sarasota — Golf Club Annual Dues"))
      // Reseed if fake annual lifestyle items still present (not in Excel model)
      || cfs.some(cf => cf.description?.includes("Annual Memberships & Fees"))
      || cfs.some(cf => cf.description?.includes("Annual Insurance Premiums"))
      || cfs.some(cf => cf.description?.includes("Year-End Fees, Subscriptions"))
      // Reseed if phone still being added in December (should be $0 that month per Excel)
      || cfs.some(cf => cf.description?.includes("Phone, Cable") && new Date(cf.date).getUTCMonth() === 11)
      // Reseed if HOA amount is still old rounded integer ($819 → now $819.48 to match Excel)
      || cfs.some(cf => cf.description?.includes("Tribeca — HOA") && Number(cf.amount) === 819);
    if (!needsMigration) return; // Kessler data is good, nothing to do

    console.log("[seed] Reseeding Kessler data...");
    await db.delete(cfTable).where(eq(cfTable.clientId, kessler.id));
    await db.delete(assetsTable).where(eq(assetsTable.clientId, kessler.id));
    await db.delete(liabilitiesTable).where(eq(liabilitiesTable.clientId, kessler.id));
    await db.delete(strategiesTable).where(eq(strategiesTable.clientId, kessler.id));
    await db.delete(accountsTable).where(eq(accountsTable.clientId, kessler.id));
    // NOTE: we intentionally do NOT delete the client row — preserving kessler.id
    // prevents the URL from changing every reseed (avoids "Client not found" 404s).
    console.log("[seed] Kessler data cleared — reseeding (client id preserved)");
  }

  // ── Client 1: Sarah & Michael Kessler ───────────────────────────────────────
  // HNW dual-income family — exact financials from model
  // Asset breakdown (from Prototype_Model_v4.xlsx — taxable brokerage only):
  // Cash: $357,050 (Chase $25,050 + Citizens $107,000 + Citizens MM $225,000 + CapOne $15,000)
  // Fidelity brokerage: Total Market $379,878 + Small Cap Value $49,318 + Cash Sweep $186,586 + T-Bills $135,000 = $750,782
  // Cresset (3 sleeves from Excel): US Large Cap $375K + International $116.5K + JP Morgan $94.4K = $585,907
  // E*Trade (META + BAC): $298,311 | 401(k) + Roth IRA: $1,000,000 | Real estate: $1,815,000
  // Alternatives (Carlyle × 4 + Crypto + RSU): $1,174,500
  // Total assets $5,996,550 | Liabilities $1,348,166 | Net Worth ~$4,648,384
  // Re-use existing client row if present, otherwise create fresh.
  const existingKessler = (await storage.getClients()).find(c => c.name === "Sarah & Michael Kessler");
  const c1 = existingKessler ?? await storage.createClient({
    name: "Sarah & Michael Kessler",
    email: "kessler.family@privatebank.com",
    age: 44,
    riskTolerance: "moderate",
  });

  // ── Step 1: Create accounts (containers) — must exist before holdings ───────
  // Accounts are ordered: cash → brokerage → retirement → real estate → alternatives
  // dataSource reflects how GURU would actually pull this data in production.
  const acctChaseChecking = await storage.createAccount({
    clientId: c1.id, institutionName: "JPMorgan Chase Bank, N.A.",
    accountName: "Chase Total Checking", accountNumber: "****4821",
    accountType: "checking", guruBucket: "operating",
    isAdvisorManaged: false, dataSource: "plaid",
    lastSyncedAt: new Date("2025-12-31"),
  });
  const acctCitizensChecking = await storage.createAccount({
    clientId: c1.id, institutionName: "Citizens Bank, N.A.",
    accountName: "Citizens Private Banking Checking", accountNumber: "****2847",
    accountType: "checking", guruBucket: "operating",
    isAdvisorManaged: false, dataSource: "plaid",
    lastSyncedAt: new Date("2025-12-31"),
  });
  const acctCitizensMM = await storage.createAccount({
    clientId: c1.id, institutionName: "Citizens Bank, N.A.",
    accountName: "Citizens Private Bank Money Market", accountNumber: "****7204",
    accountType: "money_market", guruBucket: "reserve",
    isAdvisorManaged: false, dataSource: "plaid",
    lastSyncedAt: new Date("2025-12-31"),
  });
  const acctCapitalOne = await storage.createAccount({
    clientId: c1.id, institutionName: "Capital One, N.A.",
    accountName: "Capital One 360 Performance Savings", accountNumber: "****1482",
    accountType: "savings", guruBucket: "reserve",
    isAdvisorManaged: false, dataSource: "plaid",
    lastSyncedAt: new Date("2025-12-31"),
  });
  // Fidelity brokerage (self-directed): holds both idle cash sweep + VTI index ETF.
  // guruBucket="investments" reflects the primary use; GURU re-categorizes the cash
  // sweep holding as "reserve" in the liquidity model based on asset type + description.
  const acctFidelityBrokerage = await storage.createAccount({
    clientId: c1.id, institutionName: "Fidelity Investments",
    accountName: "Fidelity Brokerage — Self-Directed", accountNumber: "****3314",
    accountType: "brokerage", guruBucket: "investments",
    isAdvisorManaged: false, dataSource: "fidelity",
    lastSyncedAt: new Date("2025-12-31"),
  });
  // Cresset: RIA-managed account — this is the advisor's AUM.
  const acctCresset = await storage.createAccount({
    clientId: c1.id, institutionName: "Cresset Asset Management, LLC",
    accountName: "Cresset Capital — Managed Portfolio (US)", accountNumber: "****3391",
    accountType: "brokerage", guruBucket: "investments",
    isAdvisorManaged: true, dataSource: "manual",
    lastSyncedAt: new Date("2025-12-31"),
  });
  // E*Trade: self-directed brokerage — concentrated single-stock positions (story: risk).
  const acctEtrade = await storage.createAccount({
    clientId: c1.id, institutionName: "Morgan Stanley (E*Trade)",
    accountName: "E*Trade Brokerage — Self-Directed", accountNumber: "****9782",
    accountType: "brokerage", guruBucket: "investments",
    isAdvisorManaged: false, dataSource: "plaid",
    lastSyncedAt: new Date("2025-12-31"),
  });
  // (No separate Treasury Bills account — US Treasuries are held inside acctFidelityBrokerage)
  const acctFidelity401k = await storage.createAccount({
    clientId: c1.id, institutionName: "Fidelity Investments",
    accountName: "Fidelity Workplace 401(k) — Traditional", accountNumber: "****8821",
    accountType: "401k", guruBucket: "retirement",
    isAdvisorManaged: false, dataSource: "fidelity",
    lastSyncedAt: new Date("2025-12-31"),
  });
  const acctFidelityRoth = await storage.createAccount({
    clientId: c1.id, institutionName: "Fidelity Investments",
    accountName: "Fidelity Roth IRA", accountNumber: "****4412",
    accountType: "roth_ira", guruBucket: "retirement",
    isAdvisorManaged: false, dataSource: "fidelity",
    lastSyncedAt: new Date("2025-12-31"),
  });
  const acctTribeca = await storage.createAccount({
    clientId: c1.id, institutionName: "—",
    accountName: "Tribeca Condo — Primary Residence, NYC", accountNumber: null,
    accountType: "real_estate", guruBucket: "real_estate",
    isAdvisorManaged: false, dataSource: "zillow",
    lastSyncedAt: new Date("2025-12-31"),
  });
  const acctSarasota = await storage.createAccount({
    clientId: c1.id, institutionName: "—",
    accountName: "Sarasota Investment Property — FL", accountNumber: null,
    accountType: "real_estate", guruBucket: "real_estate",
    isAdvisorManaged: false, dataSource: "zillow",
    lastSyncedAt: new Date("2025-12-31"),
  });
  const acctCarlyle = await storage.createAccount({
    clientId: c1.id, institutionName: "The Carlyle Group",
    accountName: "Carlyle Partners — LP & Carry Interests", accountNumber: null,
    accountType: "private_equity", guruBucket: "alternatives",
    isAdvisorManaged: false, dataSource: "manual",
    lastSyncedAt: new Date("2025-12-31"),
  });
  const acctCoinbase = await storage.createAccount({
    clientId: c1.id, institutionName: "Coinbase, Inc.",
    accountName: "Coinbase Custody", accountNumber: null,
    accountType: "crypto", guruBucket: "alternatives",
    isAdvisorManaged: false, dataSource: "plaid",
    lastSyncedAt: new Date("2025-12-31"),
  });
  const acctGoldmanRSU = await storage.createAccount({
    clientId: c1.id, institutionName: "Goldman Sachs & Co. LLC",
    accountName: "Goldman Sachs RSU Award", accountNumber: null,
    accountType: "equity_compensation", guruBucket: "alternatives",
    isAdvisorManaged: false, dataSource: "manual",
    lastSyncedAt: new Date("2025-12-31"),
  });

  // ── Step 2: Create holdings (assets) — linked to account containers ──────────
  // ticker / shares / pricePerShare: populated for publicly-traded securities.
  // Prices as of 2025-12-31 (approximate). value field is always authoritative.
  await Promise.all([
    // ── Operating Cash ────────────────────────────────────────────────────────
    storage.createAsset({ clientId: c1.id, accountId: acctChaseChecking.id,
      type: "cash",  value: "25050",  description: "Chase Total Checking (Main Account)" }),
    storage.createAsset({ clientId: c1.id, accountId: acctCitizensChecking.id,
      type: "cash",  value: "107000", description: "Citizens Private Banking Checking (Excess)" }),
    // ── Liquidity Reserve ─────────────────────────────────────────────────────
    storage.createAsset({ clientId: c1.id, accountId: acctCitizensMM.id,
      type: "cash",  value: "225000", description: "Citizens Private Bank Money Market — 3.65% yield" }),
    storage.createAsset({ clientId: c1.id, accountId: acctCapitalOne.id,
      type: "cash",  value: "15000",  description: "CapitalOne 360 Performance Savings — 3.78% yield" }),
    // ── Fidelity Brokerage — 3 holdings: Total Market ETF + Small Cap Value + idle cash sweep ─
    // The cash sweep is the GURU opportunity: $186,586 earning 2.50% when it could be deployed.
    storage.createAsset({ clientId: c1.id, accountId: acctFidelityBrokerage.id,
      type: "equity", value: "379878", description: "Fidelity — Total Market Index Fund (ETF, self-directed)",
      ticker: "VTI", shares: "1334", pricePerShare: "284.77" }),
    storage.createAsset({ clientId: c1.id, accountId: acctFidelityBrokerage.id,
      type: "equity", value: "49318",  description: "Fidelity — Small Cap Value Index Fund (FISVX, self-directed)" }),
    storage.createAsset({ clientId: c1.id, accountId: acctFidelityBrokerage.id,
      type: "cash",   value: "186586", description: "Fidelity — Cash Sweep / Money Market (Idle) — 2.50% yield",
      ticker: "SPAXX", shares: "186586", pricePerShare: "1.00" }),
    // ── Cresset Capital — advisor-managed (RIA AUM), 3 sleeves from Excel data ──
    // US Large Cap ($375K) + International ($116.5K) + JP Morgan Equity Income ($94.4K) = $585,907
    storage.createAsset({ clientId: c1.id, accountId: acctCresset.id,
      type: "equity", value: "375000", description: "Cresset — US Large Cap Core (ETF sleeve)" }),
    storage.createAsset({ clientId: c1.id, accountId: acctCresset.id,
      type: "equity", value: "116538", description: "Cresset — International Developed Markets (ETF sleeve)" }),
    storage.createAsset({ clientId: c1.id, accountId: acctCresset.id,
      type: "equity", value: "94369",  description: "Cresset — Equity Income — Active (JP Morgan)" }),
    // ── E*Trade — self-directed, concentrated single-stock positions ─────────
    storage.createAsset({ clientId: c1.id, accountId: acctEtrade.id,
      type: "equity", value: "238311", description: "E*Trade - Meta Platforms (Single Stock)",
      ticker: "META", shares: "397", pricePerShare: "600.28" }),
    storage.createAsset({ clientId: c1.id, accountId: acctEtrade.id,
      type: "equity", value: "60000",  description: "E*Trade - Bank of America (Single Stock)",
      ticker: "BAC", shares: "1277", pricePerShare: "46.99" }),
    // ── Capital Build — US Treasuries held inside Fidelity Brokerage (Goal Savings: home purchase Jun 2027) ──
    storage.createAsset({ clientId: c1.id, accountId: acctFidelityBrokerage.id,
      type: "fixed_income", value: "135000", description: "U.S. Treasury Bill — 26-Week (182-Day), Matures Jun 2026, 3.95% yield" }),
    // ── Retirement ────────────────────────────────────────────────────────────
    storage.createAsset({ clientId: c1.id, accountId: acctFidelity401k.id,
      type: "fixed_income", value: "620000", description: "Fidelity 401(k) / Traditional IRA" }),
    storage.createAsset({ clientId: c1.id, accountId: acctFidelityRoth.id,
      type: "equity",       value: "380000", description: "Fidelity Roth IRA" }),
    // ── Real Estate ───────────────────────────────────────────────────────────
    storage.createAsset({ clientId: c1.id, accountId: acctTribeca.id,
      type: "real_estate",  value: "1525000", description: "Tribeca Condo (Primary Residence, NYC)" }),
    storage.createAsset({ clientId: c1.id, accountId: acctSarasota.id,
      type: "real_estate",  value: "290000",  description: "Sarasota Property (Investment, FL — rented at $2,100/mo)" }),
    // ── Alternative & Illiquid ────────────────────────────────────────────────
    storage.createAsset({ clientId: c1.id, accountId: acctCarlyle.id,
      type: "alternative",  value: "75000",   description: "Carlyle Partners VIII (PE Fund — NAV)" }),
    storage.createAsset({ clientId: c1.id, accountId: acctCarlyle.id,
      type: "alternative",  value: "175000",  description: "Carlyle Partners IX (PE Fund — NAV)" }),
    storage.createAsset({ clientId: c1.id, accountId: acctCarlyle.id,
      type: "alternative",  value: "325000",  description: "Carlyle Partners VIII — Carry (est. FMV)" }),
    storage.createAsset({ clientId: c1.id, accountId: acctCarlyle.id,
      type: "alternative",  value: "510000",  description: "Carlyle Partners IX — Carry (est. FMV)" }),
    storage.createAsset({ clientId: c1.id, accountId: acctCoinbase.id,
      type: "alternative",  value: "9500",    description: "Coinbase — Crypto (BTC/ETH)" }),
    storage.createAsset({ clientId: c1.id, accountId: acctGoldmanRSU.id,
      type: "equity",       value: "80000",   description: "Goldman Sachs RSUs (unvested, 2-yr cliff)" }),
  ]);

  await Promise.all([
    // Mortgages — $1,092,000 (from balance sheet)
    storage.createLiability({ clientId: c1.id, type: "mortgage",      value: "945000", interestRate: "3.15", description: "Tribeca Condo Mortgage (30yr fixed @ 3.15%)" }),
    storage.createLiability({ clientId: c1.id, type: "mortgage",      value: "147000", interestRate: "2.55", description: "Sarasota Investment Property Mortgage (@ 2.55%)" }),
    // Consumer / Student Debt — $81,166
    storage.createLiability({ clientId: c1.id, type: "credit_card",   value: "11466",  interestRate: "22.99", description: "Chase Sapphire + Amex — paid monthly" }),
    storage.createLiability({ clientId: c1.id, type: "student_loan",  value: "42000",  interestRate: "5.50",  description: "Student Loan — Sarah Kessler (SoFi, Private Refinanced)" }),
    storage.createLiability({ clientId: c1.id, type: "student_loan",  value: "27700",  interestRate: "7.20",  description: "Student Loan — Michael Kessler (Nelnet, Federal)" }),
    // Investment Debt — $175,000
    storage.createLiability({ clientId: c1.id, type: "personal_loan", value: "125000", interestRate: "6.50",  description: "Professional Loan — PE Fund II Capital Call" }),
    storage.createLiability({ clientId: c1.id, type: "personal_loan", value: "50000",  interestRate: "0.00",  description: "Remaining Capital Commitment — PE Fund II" }),
  ]);

  // ── Per-month cash flows: January 2026 → December 2026 ───────────────────
  // Source: Prototype_Model_v4.xlsx
  // Monthly income: salaries $18,814 + rental $2,100 + interest $388 = $21,302
  // Monthly base expenses: $23,037 → base net ≈ −$1,735/mo
  // Cumulative trough: ~−$125,096 in November. Dec bonus + portfolio distributions flip to ~+$68,000 annual net.

  const cfBatch: Array<{ clientId: number; type: "inflow" | "outflow"; category: string; amount: string; date: Date; description: string }> = [];

  const months = [
    { y: 2026, m: 1 }, { y: 2026, m: 2 }, { y: 2026, m: 3 },
    { y: 2026, m: 4 }, { y: 2026, m: 5 }, { y: 2026, m: 6 },
    { y: 2026, m: 7 }, { y: 2026, m: 8 }, { y: 2026, m: 9 },
    { y: 2026, m: 10 }, { y: 2026, m: 11 }, { y: 2026, m: 12 },
  ];

  for (const { y, m } of months) {
    const d = monthDate(y, m);

    // ── Recurring monthly income ──────────────────────────────────────────
    cfBatch.push({ clientId: c1.id, type: "inflow", category: "salary",      amount: "13302.50", date: d, description: "Michael — Net Monthly Salary" });
    cfBatch.push({ clientId: c1.id, type: "inflow", category: "salary",      amount: "5511.03",  date: d, description: "Sarah — Net Monthly Salary" });
    cfBatch.push({ clientId: c1.id, type: "inflow", category: "investments", amount: "2100",     date: d, description: "Investment Property Rental Income" });
    cfBatch.push({ clientId: c1.id, type: "inflow", category: "investments", amount: "388",      date: d, description: "Reserve MMF & Savings Interest" });

    // ── Recurring monthly expenses — exact values from Prototype_Model_v4.xlsx ─
    // Primary residence: mortgage $2,480.63 + HOA $819.48 + cable+utils $393.78 + insurance $830
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing",         amount: "2480.63",  date: d, description: "Tribeca — Mortgage" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing",         amount: "819.48",   date: d, description: "Tribeca — HOA & Maintenance" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing",         amount: "830",      date: d, description: "Tribeca — Home Insurance" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing",         amount: "393.78",   date: d, description: "Tribeca — Cable & Utilities" });
    // Credit cards cover lifestyle: food, dining, entertainment, gas, shopping
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "lifestyle",       amount: "11466.03", date: d, description: "Credit Card Payments (Lifestyle Expenses)" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "4333.33",  date: d, description: "Childcare / Nanny" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "677.08",   date: d, description: "PE Fund II Professional Loan — Monthly Service" });
    // Student loans: $165.07 undergrad + $594.38 graduate = $759.44/mo
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "759.44",   date: d, description: "Student Loan Payments ($165 undergrad + $594 graduate)" });
    // Phone: $345.94/mo Jan–Nov only; $0 in December (per Excel model)
    if (m !== 12) cfBatch.push({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "345.94", date: d, description: "Phone, Cable & Utilities" });
    // Investment property — split into individual line items (no monthly insurance — annual only, not applicable in 2026)
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing", amount: "378",    date: d, description: "Investment Property — Property Management" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing", amount: "312.38", date: d, description: "Investment Property — Mortgage" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing", amount: "243.34", date: d, description: "Investment Property — Maintenance" });

    // ── January: NYC property taxes semi-annual (1st installment) ─────────
    if (m === 1) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "taxes", amount: "17500", date: d, description: "Tribeca Condo — NYC Property Taxes (semi-annual, Jan)" });
    }
    // ── April: Q1 estimated federal taxes + spring school tuition ─────────
    if (m === 4) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "taxes",     amount: "30000", date: d, description: "Federal Estimated Income Tax — Q1 Payment" });
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "education", amount: "15000", date: d, description: "Private School Tuition — Spring Installment" });
    }
    // ── May: Memorial Day travel ──────────────────────────────────────────
    if (m === 5) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "travel", amount: "4000", date: d, description: "Memorial Day Travel" });
    }
    // ── June: Weekend travel ──────────────────────────────────────────────
    if (m === 6) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "travel", amount: "1000", date: d, description: "Weekend Travel" });
    }
    // ── July: NYC property taxes semi-annual (2nd installment) + travel ───
    if (m === 7) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "taxes",  amount: "17500", date: d, description: "Tribeca Condo — NYC Property Taxes (semi-annual, Jul)" });
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "travel", amount: "2000",  date: d, description: "Summer Travel" });
    }
    // ── August: Fall school tuition ───────────────────────────────────────
    if (m === 8) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "education", amount: "15000", date: d, description: "Private School Tuition — Fall Installment" });
    }
    // ── November: Thanksgiving travel only ────────────────────────────────
    if (m === 11) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "travel",    amount: "4000", date: d, description: "Thanksgiving Travel" });
    }
    // ── December: year-end bonuses + all annual one-time expenses ─────────
    if (m === 12) {
      cfBatch.push({ clientId: c1.id, type: "inflow", category: "bonus",       amount: "191555.94", date: d, description: "Partner 1 Year-End Bonus" });
      cfBatch.push({ clientId: c1.id, type: "inflow", category: "bonus",       amount: "25084.71",  date: d, description: "Partner 2 Year-End Bonus" });
      cfBatch.push({ clientId: c1.id, type: "inflow", category: "investments", amount: "22333",     date: d, description: "Year-End Investment Distributions & Interest" });
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "education", amount: "15000",   date: d, description: "Private School Tuition — December Installment" });
      // One golf dues entry only — $4,102.30 per Excel (single December row)
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "lifestyle", amount: "4102.30", date: d, description: "Golf Club Annual Dues" });
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "travel",    amount: "4000",    date: d, description: "Holiday Travel" });
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "taxes",     amount: "4696.60", date: d, description: "Investment Property Taxes (FL annual, Dec)" });
    }
  }

  for (const cf of cfBatch) {
    await storage.createCashFlow(cf);
  }

  // Mark Kessler as onboarding complete after seeding
  await storage.setOnboardingComplete(c1.id, true);
  console.log("[seed] Kessler seeded and marked onboarding complete");
}
