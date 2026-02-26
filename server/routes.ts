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
  // Seed initial data if empty
  seedDatabase().catch(console.error);

  app.get(api.clients.list.path, async (req, res) => {
    const clients = await storage.getClients();
    res.json(clients);
  });

  app.get(api.clients.get.path, async (req, res) => {
    const id = Number(req.params.id);
    const client = await storage.getClient(id);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    res.json(client);
  });

  app.get(api.clients.dashboard.path, async (req, res) => {
    const id = Number(req.params.id);
    const client = await storage.getClient(id);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    
    const [assets, liabilities, cashFlows, strategies] = await Promise.all([
      storage.getAssets(id),
      storage.getLiabilities(id),
      storage.getCashFlows(id),
      storage.getStrategies(id)
    ]);

    res.json({
      client,
      assets,
      liabilities,
      cashFlows,
      strategies
    });
  });

  app.post(api.clients.create.path, async (req, res) => {
    try {
      const input = api.clients.create.input.parse(req.body);
      const client = await storage.createClient(input);
      res.status(201).json(client);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.assets.create.path, async (req, res) => {
    try {
      const bodySchema = api.assets.create.input.extend({
        clientId: z.coerce.number(),
        value: z.coerce.string(), // numeric columns come as strings from DB but let's allow coercion
      });
      const input = bodySchema.parse(req.body);
      const asset = await storage.createAsset({
        ...input,
        value: input.value.toString()
      });
      res.status(201).json(asset);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

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
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.cashFlows.create.path, async (req, res) => {
    try {
      const bodySchema = api.cashFlows.create.input.extend({
        clientId: z.coerce.number(),
        amount: z.coerce.string(),
        date: z.coerce.date(),
      });
      const input = bodySchema.parse(req.body);
      const cashFlow = await storage.createCashFlow({
        ...input,
        amount: input.amount.toString()
      });
      res.status(201).json(cashFlow);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.clients.generateStrategy.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const [assets, liabilities, cashFlows] = await Promise.all([
        storage.getAssets(id),
        storage.getLiabilities(id),
        storage.getCashFlows(id)
      ]);

      const prompt = `
      You are an expert wealth advisor. Analyze the following client data and suggest 3 strategic actions to optimize their balance sheet and cash flow.
      
      Client Profile:
      - Age: ${client.age}
      - Risk Tolerance: ${client.riskTolerance}
      
      Assets:
      ${assets.map(a => `- ${a.type}: $${a.value} (${a.description})`).join('\n')}
      
      Liabilities:
      ${liabilities.map(l => `- ${l.type}: $${l.value} at ${l.interestRate}% interest (${l.description})`).join('\n')}
      
      Cash Flows:
      ${cashFlows.map(c => `- ${c.type} (${c.category}): $${c.amount} on ${c.date.toISOString().split('T')[0]} (${c.description})`).join('\n')}
      
      Respond with exactly a JSON array of 3 strategy objects. 
      Each object must have these exact keys:
      - "name": A short title for the strategy (string)
      - "recommendation": A detailed explanation of the action to take (string)
      - "impact": The estimated positive impact on net worth in dollars (number)
      
      Output ONLY the raw JSON array.
      `;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }, // we'll ask for an object containing strategies to ensure valid JSON
      });

      // The prompt actually asked for an array, let's fix that by ensuring we parse the AI response properly.
      // Wait, response_format: { type: "json_object" } requires the output to be a JSON object, not an array.
      // Let's modify the prompt to ask for an object with a "strategies" array.
      
      const promptObj = `
      You are an expert wealth advisor. Analyze the following client data and suggest 3 strategic actions to optimize their balance sheet and cash flow.
      
      Client Profile:
      - Age: ${client.age}
      - Risk Tolerance: ${client.riskTolerance}
      
      Assets:
      ${assets.map(a => `- ${a.type}: $${a.value} (${a.description})`).join('\n')}
      
      Liabilities:
      ${liabilities.map(l => `- ${l.type}: $${l.value} at ${l.interestRate}% interest (${l.description})`).join('\n')}
      
      Cash Flows:
      ${cashFlows.map(c => `- ${c.type} (${c.category}): $${c.amount} on ${c.date.toISOString().split('T')[0]} (${c.description})`).join('\n')}
      
      Respond with a JSON object containing a "strategies" array. 
      Each item in the array must have these exact keys:
      - "name": A short title for the strategy (string)
      - "recommendation": A detailed explanation of the action to take (string)
      - "impact": The estimated positive impact on net worth in dollars (number)
      `;

      const aiResponseObj = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: promptObj }],
        response_format: { type: "json_object" },
      });

      const content = aiResponseObj.choices[0]?.message?.content || '{"strategies":[]}';
      const parsed = JSON.parse(content);
      
      const newStrategies = [];
      for (const s of (parsed.strategies || [])) {
        const strategy = await storage.createStrategy({
          clientId: id,
          name: s.name,
          recommendation: s.recommendation,
          impact: String(s.impact),
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

async function seedDatabase() {
  const existingClients = await storage.getClients();
  if (existingClients.length === 0) {
    const client = await storage.createClient({
      name: "Alice Johnson",
      email: "alice.j@example.com",
      age: 45,
      riskTolerance: "moderate",
    });

    await storage.createAsset({
      clientId: client.id,
      type: "equity",
      value: "250000",
      description: "Vanguard S&P 500 ETF",
    });

    await storage.createAsset({
      clientId: client.id,
      type: "cash",
      value: "50000",
      description: "High Yield Savings",
    });

    await storage.createLiability({
      clientId: client.id,
      type: "mortgage",
      value: "350000",
      interestRate: "3.5",
      description: "Primary Residence Mortgage",
    });

    await storage.createCashFlow({
      clientId: client.id,
      type: "inflow",
      category: "salary",
      amount: "12000",
      date: new Date(),
      description: "Monthly Salary",
    });

    await storage.createCashFlow({
      clientId: client.id,
      type: "outflow",
      category: "living_expenses",
      amount: "6000",
      date: new Date(),
      description: "Monthly Living Expenses",
    });
  }
}
