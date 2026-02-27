import type { Express } from "express";
import type { Server } from "http";
import { readFileSync, writeFileSync } from "fs";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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

  return httpServer;
}

// ── Seed Data ──────────────────────────────────────────────────────────────────
function monthDate(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

async function seedDatabase() {
  const existing = await storage.getClients();
  if (existing.length > 0) return;

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
    storage.createAsset({ clientId: c1.id, type: "cash", value: "25050",  description: "Chase Total Checking (Main Account)" }),
    storage.createAsset({ clientId: c1.id, type: "cash", value: "107000", description: "Citizens Private Banking Checking (Excess)" }),
    storage.createAsset({ clientId: c1.id, type: "cash", value: "225000", description: "Citizens Private Bank Money Market — 3.65% yield" }),
    storage.createAsset({ clientId: c1.id, type: "cash", value: "15000",  description: "CapitalOne 360 Performance Savings — 3.78% yield" }),
    // Investments — $1,894,500
    storage.createAsset({ clientId: c1.id, type: "fixed_income", value: "135000",  description: "US Treasuries — 3.95% yield" }),
    storage.createAsset({ clientId: c1.id, type: "equity",       value: "1201689", description: "Fidelity Taxable Brokerage — ETFs & Mutual Funds" }),
    storage.createAsset({ clientId: c1.id, type: "equity",       value: "298311",  description: "Fidelity Taxable Brokerage — Single Stock (Goldman RSU vested)" }),
    storage.createAsset({ clientId: c1.id, type: "alternative",  value: "9500",    description: "Crypto — BTC/ETH" }),
    // Alternative & Illiquid — $1,165,000
    storage.createAsset({ clientId: c1.id, type: "alternative",  value: "75000",   description: "Private Equity Fund I" }),
    storage.createAsset({ clientId: c1.id, type: "alternative",  value: "175000",  description: "Private Equity Fund II" }),
    storage.createAsset({ clientId: c1.id, type: "alternative",  value: "325000",  description: "Carry — PE Fund I (est. FMV)" }),
    storage.createAsset({ clientId: c1.id, type: "alternative",  value: "510000",  description: "Carry — PE Fund II (est. FMV)" }),
    storage.createAsset({ clientId: c1.id, type: "equity",       value: "80000",   description: "Goldman Sachs RSUs (unvested, 2-yr cliff)" }),
    // Real Estate — $1,815,000
    storage.createAsset({ clientId: c1.id, type: "real_estate",  value: "1525000", description: "Tribeca Condo (Primary Residence, NYC)" }),
    storage.createAsset({ clientId: c1.id, type: "real_estate",  value: "290000",  description: "Sarasota Property (Investment, FL — rented at $2,100/mo)" }),
    // Retirement — $1,000,000
    storage.createAsset({ clientId: c1.id, type: "fixed_income", value: "620000",  description: "Fidelity 401(k) / Traditional IRA" }),
    storage.createAsset({ clientId: c1.id, type: "equity",       value: "380000",  description: "Fidelity Roth IRA" }),
  ]);

  await Promise.all([
    // Mortgages — $1,092,000
    storage.createLiability({ clientId: c1.id, type: "mortgage",      value: "962000", interestRate: "3.75", description: "Tribeca Condo Mortgage (30yr fixed)" }),
    storage.createLiability({ clientId: c1.id, type: "mortgage",      value: "130000", interestRate: "5.25", description: "Sarasota Investment Property Mortgage" }),
    // Consumer / Student Debt — $81,166
    storage.createLiability({ clientId: c1.id, type: "credit_card",   value: "11466",  interestRate: "22.99", description: "Chase Sapphire + Amex — paid monthly" }),
    storage.createLiability({ clientId: c1.id, type: "student_loan",  value: "69700",  interestRate: "4.50",  description: "Student Loans (Partner 1 + Partner 2)" }),
    // Investment Debt — $175,000
    storage.createLiability({ clientId: c1.id, type: "personal_loan", value: "125000", interestRate: "6.50",  description: "Professional Loan — PE Fund II Capital Call" }),
    storage.createLiability({ clientId: c1.id, type: "personal_loan", value: "50000",  interestRate: "0.00",  description: "Remaining Capital Commitment — PE Fund II" }),
  ]);

  // ── Per-month cash flows: March 2026 → February 2027 ──────────────────────
  // Pattern: salary every month, lumpy big-ticket items in specific months,
  // year-end bonus in Dec. 11 months are net-negative; Dec is very positive.
  // Based on: Annual salary $226,000 | Annual bonus $216,641 | Core expenses ~$24,939/mo

  const cfBatch: Array<{ clientId: number; type: "inflow" | "outflow"; category: string; amount: string; date: Date; description: string }> = [];

  const months = [
    { y: 2026, m: 3 }, { y: 2026, m: 4 }, { y: 2026, m: 5 },
    { y: 2026, m: 6 }, { y: 2026, m: 7 }, { y: 2026, m: 8 },
    { y: 2026, m: 9 }, { y: 2026, m: 10 }, { y: 2026, m: 11 },
    { y: 2026, m: 12 },
    { y: 2027, m: 1 }, { y: 2027, m: 2 },
  ];

  for (const { y, m } of months) {
    const d = monthDate(y, m);
    // Monthly salary — both partners (after tax take-home)
    cfBatch.push({ clientId: c1.id, type: "inflow", category: "salary", amount: "18813", date: d, description: "Monthly Net Salary — P1 ($13,302) + P2 ($5,511)" });
    // Rental income from Sarasota
    cfBatch.push({ clientId: c1.id, type: "inflow", category: "investments", amount: "1722", date: d, description: "Sarasota Rental Income (net of mgmt fee)" });
    // Core monthly expenses: housing, food, childcare, utilities, car, phone, insurance
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing", amount: "7793", date: d, description: "Tribeca Mortgage + Maintenance + Insurance + Utilities" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "4333", date: d, description: "Childcare / Babysitter" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "3500", date: d, description: "Food, Groceries & Dining" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "677",  date: d, description: "PE Fund II Professional Loan — Monthly Service" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "510",  date: d, description: "Student Loan Payments" });
    cfBatch.push({ clientId: c1.id, type: "outflow", category: "housing", amount: "1243", date: d, description: "Sarasota Property Expenses (mgmt + HOA + mortgage)" });

    // Lumpy: May, Jun, Jul — private school tuition ($15K/quarter)
    if ([5, 6, 7].includes(m)) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "education", amount: "15000", date: d, description: "Private School Tuition — Q2/Q3 Installment" });
    }
    // Lumpy: Sep — private school tuition Q3
    if (m === 9) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "education", amount: "15000", date: d, description: "Private School Tuition — Q3 Installment" });
    }
    // Lumpy: March — NYC property taxes (semi-annual)
    if (m === 3) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "taxes", amount: "17500", date: d, description: "Tribeca Condo — NYC Property Taxes (semi-annual)" });
    }
    // Lumpy: August — Florida property taxes (annual)
    if (m === 8) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "taxes", amount: "4697", date: d, description: "Sarasota Property — FL Property Taxes (annual)" });
    }
    // Lumpy: September — NYC property taxes (semi-annual, second installment)
    if (m === 9) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "taxes", amount: "17500", date: d, description: "Tribeca Condo — NYC Property Taxes (semi-annual)" });
    }
    // Lumpy: May travel, June travel, July travel
    if (m === 5) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "travel", amount: "4000", date: d, description: "Memorial Day Travel" });
    }
    if (m === 6) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "travel", amount: "1000", date: d, description: "Weekend Travel" });
    }
    if (m === 7) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "travel", amount: "12000", date: d, description: "Summer Vacation (Europe)" });
    }
    // Lumpy: November — estimated tax payment (Q4)
    if (m === 11) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "taxes", amount: "30000", date: d, description: "Q4 Estimated Federal Income Tax Payment" });
    }
    // December — year-end bonus (both partners) — transforms the year
    if (m === 12) {
      cfBatch.push({ clientId: c1.id, type: "inflow", category: "bonus", amount: "191556", date: d, description: "Partner 1 Year-End Bonus" });
      cfBatch.push({ clientId: c1.id, type: "inflow", category: "bonus", amount: "25085", date: d, description: "Partner 2 Year-End Bonus" });
    }
    // January — golf club dues (annual)
    if (m === 1) {
      cfBatch.push({ clientId: c1.id, type: "outflow", category: "lifestyle", amount: "4102", date: d, description: "Golf Club Annual Dues" });
    }
  }

  for (const cf of cfBatch) {
    await storage.createCashFlow(cf);
  }

  // ── Client 2: James Okonkwo ──────────────────────────────────────────────────
  // Growth phase, aggressive — startup founder with concentrated positions
  const c2 = await storage.createClient({ name: "James Okonkwo", email: "jokonkwo@venturebuilder.io", age: 38, riskTolerance: "aggressive" });
  const c2Months = [
    { y: 2026, m: 3 }, { y: 2026, m: 4 }, { y: 2026, m: 5 },
    { y: 2026, m: 6 }, { y: 2026, m: 7 }, { y: 2026, m: 8 },
    { y: 2026, m: 9 }, { y: 2026, m: 10 }, { y: 2026, m: 11 },
    { y: 2026, m: 12 }, { y: 2027, m: 1 }, { y: 2027, m: 2 },
  ];
  await Promise.all([
    storage.createAsset({ clientId: c2.id, type: "equity",      value: "680000",  description: "Tech Concentrated Equity (FAANG + Growth ETFs)" }),
    storage.createAsset({ clientId: c2.id, type: "alternative", value: "400000",  description: "Angel Investment Portfolio (12 startups)" }),
    storage.createAsset({ clientId: c2.id, type: "real_estate", value: "620000",  description: "Primary Residence — Miami, FL" }),
    storage.createAsset({ clientId: c2.id, type: "cash",        value: "45000",   description: "Operating Account & Emergency Fund" }),
    storage.createAsset({ clientId: c2.id, type: "alternative", value: "120000",  description: "Cryptocurrency — BTC/ETH" }),
    storage.createAsset({ clientId: c2.id, type: "fixed_income",value: "80000",   description: "Short-term Treasuries (6-month)" }),
    storage.createLiability({ clientId: c2.id, type: "mortgage",      value: "425000", interestRate: "6.50", description: "Primary Residence Mortgage" }),
    storage.createLiability({ clientId: c2.id, type: "margin",        value: "85000",  interestRate: "8.25", description: "Margin Loan — Equity Portfolio" }),
    storage.createLiability({ clientId: c2.id, type: "personal_loan", value: "35000",  interestRate: "9.50", description: "Business Investment Loan" }),
  ]);
  // James: mostly steady, but Q2 capital calls make it lumpy, big Q4 consulting fee
  for (const { y, m } of c2Months) {
    const d = monthDate(y, m);
    await storage.createCashFlow({ clientId: c2.id, type: "inflow",  category: "business",      amount: "28000", date: d, description: "Startup Consulting Retainer" });
    await storage.createCashFlow({ clientId: c2.id, type: "inflow",  category: "investments",    amount: "1200",  date: d, description: "Dividend Income" });
    await storage.createCashFlow({ clientId: c2.id, type: "outflow", category: "housing",        amount: "5200",  date: d, description: "Mortgage + HOA + Insurance" });
    await storage.createCashFlow({ clientId: c2.id, type: "outflow", category: "living_expenses",amount: "6800",  date: d, description: "Living & Lifestyle Expenses" });
    await storage.createCashFlow({ clientId: c2.id, type: "outflow", category: "living_expenses",amount: "3200",  date: d, description: "Debt Service (Margin + Business Loan)" });
    if (m === 5) await storage.createCashFlow({ clientId: c2.id, type: "outflow", category: "investments", amount: "50000", date: d, description: "Angel Capital Call — Series A follow-on" });
    if (m === 9) await storage.createCashFlow({ clientId: c2.id, type: "outflow", category: "investments", amount: "35000", date: d, description: "Angel Capital Call — New Seed Deal" });
    if (m === 11) await storage.createCashFlow({ clientId: c2.id, type: "inflow",  category: "business",  amount: "120000", date: d, description: "Year-end Consulting Project Bonus" });
  }

  // ── Client 3: Eleanor & Robert Chen ─────────────────────────────────────────
  // Near-retirement, conservative — income-focused, bond-heavy
  const c3 = await storage.createClient({ name: "Eleanor & Robert Chen", email: "chen.wealth@gmail.com", age: 63, riskTolerance: "conservative" });
  const c3Months = [
    { y: 2026, m: 3 }, { y: 2026, m: 4 }, { y: 2026, m: 5 },
    { y: 2026, m: 6 }, { y: 2026, m: 7 }, { y: 2026, m: 8 },
    { y: 2026, m: 9 }, { y: 2026, m: 10 }, { y: 2026, m: 11 },
    { y: 2026, m: 12 }, { y: 2027, m: 1 }, { y: 2027, m: 2 },
  ];
  await Promise.all([
    storage.createAsset({ clientId: c3.id, type: "fixed_income", value: "950000",  description: "Municipal Bond Portfolio (Tax-Exempt, laddered)" }),
    storage.createAsset({ clientId: c3.id, type: "equity",       value: "420000",  description: "Dividend Blue-Chip Equities (VYM, SCHD)" }),
    storage.createAsset({ clientId: c3.id, type: "real_estate",  value: "1100000", description: "Primary Residence — Greenwich, CT" }),
    storage.createAsset({ clientId: c3.id, type: "cash",         value: "180000",  description: "CD Ladder + High-Yield Savings" }),
    storage.createAsset({ clientId: c3.id, type: "fixed_income", value: "350000",  description: "Deferred Income Annuity (starts age 70)" }),
    storage.createLiability({ clientId: c3.id, type: "mortgage", value: "95000", interestRate: "2.75", description: "Remaining Primary Residence Mortgage" }),
  ]);
  // Chen: stable and predictable, but property tax lump in Q1 and healthcare spike Q3
  for (const { y, m } of c3Months) {
    const d = monthDate(y, m);
    await storage.createCashFlow({ clientId: c3.id, type: "inflow",  category: "salary",         amount: "8200",  date: d, description: "Combined Social Security Benefits" });
    await storage.createCashFlow({ clientId: c3.id, type: "inflow",  category: "salary",         amount: "5800",  date: d, description: "Robert's Pension (Boeing)" });
    await storage.createCashFlow({ clientId: c3.id, type: "inflow",  category: "investments",    amount: "3950",  date: d, description: "Muni Bond Interest (monthly avg)" });
    await storage.createCashFlow({ clientId: c3.id, type: "inflow",  category: "investments",    amount: "1650",  date: d, description: "Dividend Income" });
    await storage.createCashFlow({ clientId: c3.id, type: "outflow", category: "housing",        amount: "2100",  date: d, description: "Mortgage + HOA" });
    await storage.createCashFlow({ clientId: c3.id, type: "outflow", category: "living_expenses",amount: "5800",  date: d, description: "Monthly Living Expenses" });
    await storage.createCashFlow({ clientId: c3.id, type: "outflow", category: "living_expenses",amount: "1900",  date: d, description: "Healthcare & Medicare Supplement" });
    if (m === 3) await storage.createCashFlow({ clientId: c3.id, type: "outflow", category: "taxes", amount: "14000", date: d, description: "CT Property Taxes (semi-annual)" });
    if (m === 9) await storage.createCashFlow({ clientId: c3.id, type: "outflow", category: "taxes", amount: "14000", date: d, description: "CT Property Taxes (semi-annual)" });
    if (m === 7) await storage.createCashFlow({ clientId: c3.id, type: "outflow", category: "living_expenses", amount: "8500", date: d, description: "Summer Travel & Grandchildren Visits" });
    if (m === 12) await storage.createCashFlow({ clientId: c3.id, type: "outflow", category: "living_expenses", amount: "6000", date: d, description: "Holiday Gifts & Charitable Giving" });
    if (m === 4) await storage.createCashFlow({ clientId: c3.id, type: "outflow", category: "taxes", amount: "8000", date: d, description: "Federal Income Tax Balance Due" });
  }
}
