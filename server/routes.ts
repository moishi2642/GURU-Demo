import type { Express } from "express";
import type { Server } from "http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { db, pool } from "./db";
import { eq } from "drizzle-orm";
import { cashFlows as cfTable, assets as assetsTable, clients as clientsTable, liabilities as liabilitiesTable, strategies as strategiesTable } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Run migrations before any Drizzle queries touch the DB
  await runMigrations();
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
    const [assets, liabilities, cashFlows, strategies] = await Promise.all([
      storage.getAssets(id),
      storage.getLiabilities(id),
      storage.getCashFlows(id),
      storage.getStrategies(id),
    ]);
    res.json({ client, assets, liabilities, cashFlows, strategies });
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
  await pool.query(`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false
  `);

  // Remove stale test profiles (keep Kessler and Mari Oishi only)
  const keepNames = ["Sarah & Michael Kessler", "Mari Oishi"];
  const allClients = await pool.query(`SELECT id, name FROM clients`);
  for (const row of allClients.rows) {
    if (!keepNames.includes(row.name)) {
      await pool.query(`DELETE FROM cash_flows WHERE client_id = $1`, [row.id]);
      await pool.query(`DELETE FROM assets WHERE client_id = $1`, [row.id]);
      await pool.query(`DELETE FROM liabilities WHERE client_id = $1`, [row.id]);
      await pool.query(`DELETE FROM strategies WHERE client_id = $1`, [row.id]);
      await pool.query(`DELETE FROM clients WHERE id = $1`, [row.id]);
      console.log(`[migrate] Removed stale test profile: ${row.name} (id=${row.id})`);
    }
  }

  // Ensure Mari Oishi profile exists (onboarding not complete)
  const { rows } = await pool.query(`SELECT id FROM clients WHERE name = 'Mari Oishi'`);
  if (rows.length === 0) {
    await pool.query(
      `INSERT INTO clients (name, email, age, risk_tolerance, onboarding_complete) VALUES ($1,$2,$3,$4,$5)`,
      ["Mari Oishi", "", 0, "moderate", false]
    );
    console.log("[migrate] Created Mari Oishi profile");
  }

  // Mark Kessler as onboarding complete (they have full data)
  await pool.query(
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
    const cfs = await storage.getCashFlows(kessler.id);
    // Check if Kessler data is up to date — if yes, skip
    const needsMigration = cfs.length === 0 || cfs.some(cf =>
      cf.description?.includes("Monthly Net Salaries") ||
      cf.description?.includes("Tribeca — Mortgage, Maintenance") ||
      cf.description?.includes("Management, Mortgage & Maintenance")
    ) || !cfs.some(cf => cf.description?.includes("Thanksgiving Travel"))
      || cfs.some(cf => cf.description?.includes("Investment Property Taxes") && cf.amount === "11012")
      || !cfs.some(cf => cf.description?.includes("Sarasota — Golf Club"))
      || cfs.some(cf => cf.description?.includes("Annual Memberships") && new Date(cf.date).getUTCMonth() === 10)
      || cfs.some(cf => cf.description === "Golf Club Annual Dues")
      || cfs.some(cf => cf.description?.includes("Year-End Investment") && Number(cf.amount) < 20000);
    if (!needsMigration) return; // Kessler data is good, nothing to do

    console.log("[seed] Reseeding Kessler data with updated cash flows...");
    await db.delete(cfTable).where(eq(cfTable.clientId, kessler.id));
    await db.delete(assetsTable).where(eq(assetsTable.clientId, kessler.id));
    await db.delete(liabilitiesTable).where(eq(liabilitiesTable.clientId, kessler.id));
    await db.delete(strategiesTable).where(eq(strategiesTable.clientId, kessler.id));
    await db.delete(clientsTable).where(eq(clientsTable.id, kessler.id));
    console.log("[seed] Kessler data cleared — reseeding");
  }

  // ── Client 1: Sarah & Michael Kessler ───────────────────────────────────────
  // HNW dual-income family — exact financials from model
  // Assets: $5,996,550 | Liabilities: $1,348,166 | Net Worth: $4,648,384
  const c1 = await storage.createClient({
    name: "Sarah & Michael Kessler",
    email: "kessler.family@privatebank.com",
    age: 44,
    riskTolerance: "moderate",
  });

  await Promise.all([
    // Cash & Bank Accounts — $372,050
    storage.createAsset({ clientId: c1.id, type: "cash", value: "25050",     description: "Chase Total Checking (Main Account)" }),
    storage.createAsset({ clientId: c1.id, type: "cash", value: "107000",    description: "Citizens Private Banking Checking (Excess)" }),
    storage.createAsset({ clientId: c1.id, type: "cash", value: "225000",    description: "Citizens Private Bank Money Market — 3.65% yield" }),
    storage.createAsset({ clientId: c1.id, type: "cash", value: "15000",     description: "CapitalOne 360 Performance Savings — 3.78% yield" }),
    // Brokerage Cash (Idle) — A in GURU Optimizer
    storage.createAsset({ clientId: c1.id, type: "cash", value: "186586",    description: "Fidelity — Cash Sweep / Money Market (Idle) — 2.50% yield" }),
    // Investments — $1,509,500 liquid + $186,586 cash
    storage.createAsset({ clientId: c1.id, type: "fixed_income", value: "135000",  description: "US Treasuries — 3.95% yield" }),
    storage.createAsset({ clientId: c1.id, type: "equity",       value: "814877",  description: "Cresset Capital (advisor-managed, US ETFs & Mutual Funds)" }),
    storage.createAsset({ clientId: c1.id, type: "equity",       value: "116538",  description: "Schwab - International Index (ETF)" }),
    storage.createAsset({ clientId: c1.id, type: "equity",       value: "238311",  description: "E*Trade - Meta Platforms (Single Stock)" }),
    storage.createAsset({ clientId: c1.id, type: "equity",       value: "60000",   description: "E*Trade - Bank of America (Single Stock)" }),
    storage.createAsset({ clientId: c1.id, type: "alternative",  value: "9500",    description: "Coinbase — Crypto (BTC/ETH)" }),
    // Alternative & Illiquid — $1,080,000
    storage.createAsset({ clientId: c1.id, type: "alternative",  value: "75000",   description: "Carlyle Partners VIII (PE Fund — NAV)" }),
    storage.createAsset({ clientId: c1.id, type: "alternative",  value: "175000",  description: "Carlyle Partners IX (PE Fund — NAV)" }),
    storage.createAsset({ clientId: c1.id, type: "alternative",  value: "325000",  description: "Carlyle Partners VIII — Carry (est. FMV)" }),
    storage.createAsset({ clientId: c1.id, type: "alternative",  value: "510000",  description: "Carlyle Partners IX — Carry (est. FMV)" }),
    storage.createAsset({ clientId: c1.id, type: "equity",       value: "80000",   description: "Goldman Sachs RSUs (unvested, 2-yr cliff)" }),
    // Real Estate — $1,815,000
    storage.createAsset({ clientId: c1.id, type: "real_estate",  value: "1525000", description: "Tribeca Condo (Primary Residence, NYC)" }),
    storage.createAsset({ clientId: c1.id, type: "real_estate",  value: "290000",  description: "Sarasota Property (Investment, FL — rented at $2,100/mo)" }),
    // Retirement — $1,000,000
    storage.createAsset({ clientId: c1.id, type: "fixed_income", value: "620000",  description: "Fidelity 401(k) / Traditional IRA" }),
    storage.createAsset({ clientId: c1.id, type: "equity",       value: "380000",  description: "Fidelity Roth IRA" }),
  ]);

  await Promise.all([
    // Mortgages — $1,092,000 (from balance sheet)
    storage.createLiability({ clientId: c1.id, type: "mortgage",      value: "945000", interestRate: "3.15", description: "Tribeca Condo Mortgage (30yr fixed @ 3.15%)" }),
    storage.createLiability({ clientId: c1.id, type: "mortgage",      value: "147000", interestRate: "2.55", description: "Sarasota Investment Property Mortgage (@ 2.55%)" }),
    // Consumer / Student Debt — $81,166
    storage.createLiability({ clientId: c1.id, type: "credit_card",   value: "11466",  interestRate: "22.99", description: "Chase Sapphire + Amex — paid monthly" }),
    storage.createLiability({ clientId: c1.id, type: "student_loan",  value: "69700",  interestRate: "4.50",  description: "Student Loans (Partner 1 + Partner 2)" }),
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
    cfBatch.push({ clientId: c1.id, type: "inflow", category: "salary",      amount: "13302", date: d, description: "Michael — Net Monthly Salary" });
    cfBatch.push({ clientId: c1.id, type: "inflow", category: "salary",      amount: "5511",  date: d, description: "Sarah — Net Monthly Salary" });
    cfBatch.push({ clientId: c1.id, type: "inflow", category: "investments", amount: "2100",  date: d, description: "Investment Property Rental Income" });
    cfBatch.push({ clientId: c1.id, type: "inflow", category: "investments", amount: "388",   date: d, description: "Reserve MMF & Savings Interest" });

    // ── Recurring monthly expenses ($23,037 gross) ────────────────────────
    // Primary residence: Tribeca mortgage $2,481 + HOA $819 + cable $106 + utilities $287 + insurance $830
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing",         amount: "2481",  date: d, description: "Tribeca — Mortgage" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing",         amount: "819",   date: d, description: "Tribeca — HOA & Maintenance" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing",         amount: "830",   date: d, description: "Tribeca — Home Insurance" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing",         amount: "393",   date: d, description: "Tribeca — Cable & Utilities" });
    // Credit cards cover lifestyle: food, dining, entertainment, gas, shopping
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "lifestyle",       amount: "11466", date: d, description: "Credit Card Payments (Lifestyle Expenses)" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "4333",  date: d, description: "Childcare / Nanny" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "677",   date: d, description: "PE Fund II Professional Loan — Monthly Service" });
    // Student loans: $165 undergrad + $594 graduate
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "759",   date: d, description: "Student Loan Payments ($165 undergrad + $594 graduate)" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "346",   date: d, description: "Phone, Cable & Utilities" });
    // Investment property — split into individual line items
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing", amount: "378", date: d, description: "Investment Property — Property Management" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing", amount: "312", date: d, description: "Investment Property — Mortgage" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing", amount: "243", date: d, description: "Investment Property — Maintenance" });

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
      cfBatch.push({ clientId: c1.id, type: "inflow", category: "bonus",       amount: "191556", date: d, description: "Partner 1 Year-End Bonus" });
      cfBatch.push({ clientId: c1.id, type: "inflow", category: "bonus",       amount: "25085",  date: d, description: "Partner 2 Year-End Bonus" });
      cfBatch.push({ clientId: c1.id, type: "inflow", category: "investments", amount: "22333",  date: d, description: "Year-End Investment Distributions & Interest" });
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "education",      amount: "15000", date: d, description: "Private School Tuition — December Installment" });
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "lifestyle",       amount: "4000",  date: d, description: "Annual Memberships & Fees" });
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "lifestyle",       amount: "4102",  date: d, description: "NYC — Golf Club Annual Dues" });
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "lifestyle",       amount: "4102",  date: d, description: "Sarasota — Golf Club Annual Dues" });
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "lifestyle",       amount: "2140",  date: d, description: "Annual Insurance Premiums (home + umbrella)" });
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "travel",          amount: "4000",  date: d, description: "Holiday Travel" });
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "taxes",           amount: "4697",  date: d, description: "Investment Property Taxes (FL annual, Dec)" });
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "6101",  date: d, description: "Year-End Fees, Subscriptions & Misc" });
    }
  }

  for (const cf of cfBatch) {
    await storage.createCashFlow(cf);
  }

  // Mark Kessler as onboarding complete after seeding
  await storage.setOnboardingComplete(c1.id, true);
  console.log("[seed] Kessler seeded and marked onboarding complete");
}
