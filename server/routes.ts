import type { Express } from "express";
import type { Server } from "http";
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
      const monthlyInflow = cashFlows.filter(c => c.type === "inflow").reduce((s, c) => s + Number(c.amount), 0);
      const monthlyOutflow = cashFlows.filter(c => c.type === "outflow").reduce((s, c) => s + Number(c.amount), 0);
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
async function seedDatabase() {
  const existing = await storage.getClients();
  if (existing.length > 0) return;

  // Client 1 — High-net-worth, moderate risk
  const c1 = await storage.createClient({ name: "Sarah Mitchell", email: "sarah.m@mitchellgroup.com", age: 52, riskTolerance: "moderate" });
  await Promise.all([
    storage.createAsset({ clientId: c1.id, type: "equity", value: "1250000", description: "Diversified Equity Portfolio (Fidelity)" }),
    storage.createAsset({ clientId: c1.id, type: "real_estate", value: "850000", description: "Primary Residence — Palo Alto" }),
    storage.createAsset({ clientId: c1.id, type: "real_estate", value: "520000", description: "Investment Property — Austin TX" }),
    storage.createAsset({ clientId: c1.id, type: "fixed_income", value: "300000", description: "US Treasury Bonds (Laddered)" }),
    storage.createAsset({ clientId: c1.id, type: "cash", value: "85000", description: "High-Yield Savings (Marcus)" }),
    storage.createAsset({ clientId: c1.id, type: "alternative", value: "150000", description: "Private Equity Fund III" }),
    storage.createLiability({ clientId: c1.id, type: "mortgage", value: "480000", interestRate: "3.25", description: "Primary Residence Mortgage" }),
    storage.createLiability({ clientId: c1.id, type: "mortgage", value: "310000", interestRate: "5.75", description: "Investment Property Mortgage" }),
    storage.createCashFlow({ clientId: c1.id, type: "inflow", category: "salary", amount: "28000", date: new Date(), description: "Monthly Executive Compensation" }),
    storage.createCashFlow({ clientId: c1.id, type: "inflow", category: "investments", amount: "4200", date: new Date(), description: "Rental Income (Austin)" }),
    storage.createCashFlow({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "9500", date: new Date(), description: "Monthly Living Expenses" }),
    storage.createCashFlow({ clientId: c1.id, type: "outflow", category: "taxes", amount: "7800", date: new Date(), description: "Federal & State Tax Withholding" }),
    storage.createCashFlow({ clientId: c1.id, type: "outflow", category: "living_expenses", amount: "6200", date: new Date(), description: "Mortgage Payments (Both Properties)" }),
  ]);

  // Client 2 — Growth phase, aggressive risk
  const c2 = await storage.createClient({ name: "James Okonkwo", email: "jokonkwo@venturebuilder.io", age: 38, riskTolerance: "aggressive" });
  await Promise.all([
    storage.createAsset({ clientId: c2.id, type: "equity", value: "680000", description: "Tech Concentrated Equity (FAANG + Growth)" }),
    storage.createAsset({ clientId: c2.id, type: "alternative", value: "400000", description: "Angel Investment Portfolio (12 startups)" }),
    storage.createAsset({ clientId: c2.id, type: "real_estate", value: "620000", description: "Primary Residence — Miami" }),
    storage.createAsset({ clientId: c2.id, type: "cash", value: "45000", description: "Operating Account & Emergency Fund" }),
    storage.createAsset({ clientId: c2.id, type: "alternative", value: "120000", description: "Cryptocurrency (BTC/ETH)" }),
    storage.createLiability({ clientId: c2.id, type: "mortgage", value: "425000", interestRate: "6.5", description: "Primary Residence Mortgage" }),
    storage.createLiability({ clientId: c2.id, type: "margin", value: "85000", interestRate: "8.25", description: "Margin Loan — Equity Portfolio" }),
    storage.createLiability({ clientId: c2.id, type: "personal_loan", value: "35000", interestRate: "9.5", description: "Personal Loan (Business Investment)" }),
    storage.createCashFlow({ clientId: c2.id, type: "inflow", category: "business", amount: "35000", date: new Date(), description: "Startup Consulting Income" }),
    storage.createCashFlow({ clientId: c2.id, type: "inflow", category: "investments", amount: "2500", date: new Date(), description: "Dividend Income" }),
    storage.createCashFlow({ clientId: c2.id, type: "outflow", category: "living_expenses", amount: "8200", date: new Date(), description: "Monthly Living & Lifestyle" }),
    storage.createCashFlow({ clientId: c2.id, type: "outflow", category: "taxes", amount: "5500", date: new Date(), description: "Estimated Tax Payments" }),
    storage.createCashFlow({ clientId: c2.id, type: "outflow", category: "living_expenses", amount: "4800", date: new Date(), description: "Debt Service (All Loans)" }),
  ]);

  // Client 3 — Near retirement, conservative
  const c3 = await storage.createClient({ name: "Eleanor & Robert Chen", email: "chen.wealth@gmail.com", age: 63, riskTolerance: "conservative" });
  await Promise.all([
    storage.createAsset({ clientId: c3.id, type: "fixed_income", value: "950000", description: "Municipal Bond Portfolio (Tax-Exempt)" }),
    storage.createAsset({ clientId: c3.id, type: "equity", value: "420000", description: "Dividend Blue-Chip Equities" }),
    storage.createAsset({ clientId: c3.id, type: "real_estate", value: "1100000", description: "Primary Residence — Greenwich CT" }),
    storage.createAsset({ clientId: c3.id, type: "cash", value: "180000", description: "CD Ladder + HYSA" }),
    storage.createAsset({ clientId: c3.id, type: "fixed_income", value: "350000", description: "Annuity (Deferred Income)" }),
    storage.createLiability({ clientId: c3.id, type: "mortgage", value: "95000", interestRate: "2.75", description: "Remaining Mortgage Balance" }),
    storage.createCashFlow({ clientId: c3.id, type: "inflow", category: "salary", amount: "14000", date: new Date(), description: "Combined Social Security + Pension" }),
    storage.createCashFlow({ clientId: c3.id, type: "inflow", category: "investments", amount: "5600", date: new Date(), description: "Bond Interest & Dividend Income" }),
    storage.createCashFlow({ clientId: c3.id, type: "outflow", category: "living_expenses", amount: "7200", date: new Date(), description: "Monthly Living Expenses" }),
    storage.createCashFlow({ clientId: c3.id, type: "outflow", category: "taxes", amount: "2800", date: new Date(), description: "Income Tax & Property Tax" }),
    storage.createCashFlow({ clientId: c3.id, type: "outflow", category: "living_expenses", amount: "1800", date: new Date(), description: "Healthcare & Insurance Premiums" }),
  ]);
}
