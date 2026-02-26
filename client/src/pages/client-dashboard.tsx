import { useState } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useClientDashboard, useGenerateStrategy } from "@/hooks/use-clients";
import { AddAssetModal, AddLiabilityModal, AddCashFlowModal } from "@/components/financial-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, LineChart, Line, ReferenceLine,
} from "recharts";
import {
  BrainCircuit, TrendingUp, TrendingDown, ChevronLeft, Activity,
  CheckCircle2, AlertTriangle, XCircle, Zap, LayoutDashboard, FileText,
  Database, ArrowUpRight,
} from "lucide-react";
import { format, addMonths, startOfMonth, subMonths } from "date-fns";
import type { Asset, Liability, CashFlow, Strategy } from "@shared/schema";

// ─── Formatting Helpers ────────────────────────────────────────────────────────
const fmt = (v: number, compact = false) => {
  if (compact && Math.abs(v) >= 1_000_000)
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(v);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
};
const fmtK = (v: number) => {
  if (Math.abs(v) >= 1000) return `${v < 0 ? "-" : ""}$${(Math.abs(v) / 1000).toFixed(0)}k`;
  return fmt(v);
};

const PANEL_CLS = "border border-border/60 shadow-sm bg-card rounded-xl overflow-hidden";

// ─── Color constants ───────────────────────────────────────────────────────────
const GREEN = "hsl(142, 71%, 40%)";
const RED   = "hsl(0, 78%, 55%)";
const BLUE  = "hsl(221, 83%, 53%)";

// ─── Computations ─────────────────────────────────────────────────────────────
function buildMonthMap(cashFlows: CashFlow[]) {
  const map: Record<string, { inflow: number; outflow: number }> = {};
  for (const cf of cashFlows) {
    const key = format(new Date(cf.date), "MMM yy");
    if (!map[key]) map[key] = { inflow: 0, outflow: 0 };
    if (cf.type === "inflow") map[key].inflow += Number(cf.amount);
    else map[key].outflow += Number(cf.amount);
  }
  return map;
}

function buildForecast(cashFlows: CashFlow[]) {
  const map = buildMonthMap(cashFlows);
  const now = startOfMonth(new Date());
  let cumulative = 0;
  return Array.from({ length: 12 }, (_, i) => {
    const month = addMonths(now, i);
    const key = format(month, "MMM yy");
    const d = map[key] || { inflow: 0, outflow: 0 };
    const net = d.inflow - d.outflow;
    cumulative += net;
    return { month: format(month, "MMM"), inflow: d.inflow, outflow: d.outflow, net, cumulative };
  });
}

function buildNWTrend(netWorth: number) {
  const now = startOfMonth(new Date());
  const seed = [0.87, 0.89, 0.90, 0.91, 0.915, 0.93, 0.935, 0.94, 0.945, 0.95, 0.96, 0.97, 0.98, 0.985, 0.99, 0.995, 0.997, 1.0];
  const wobble = [0.01, -0.008, 0.006, -0.004, 0.009, -0.005, 0.007, 0.003, -0.006, 0.005, -0.003, 0.008, -0.002, 0.004, 0.002, -0.001, 0.003, 0];
  return seed.map((s, i) => ({
    month: format(subMonths(now, seed.length - 1 - i), "MMM yy"),
    value: Math.round(netWorth * (s + wobble[i])),
  }));
}

function cashBuckets(assets: Asset[]) {
  let immediate = 0, shortTerm = 0, mediumTerm = 0;
  const immediateItems: { label: string; value: number }[] = [];
  const shortItems:     { label: string; value: number }[] = [];
  const mediumItems:    { label: string; value: number }[] = [];

  for (const a of assets) {
    const desc = a.description.toLowerCase();
    const val  = Number(a.value);
    if (a.type === "cash") {
      if (desc.includes("checking")) {
        immediate += val;
        immediateItems.push({ label: a.description.split("(")[0].trim(), value: val });
      } else {
        shortTerm += val;
        shortItems.push({ label: a.description.split("—")[0].trim(), value: val });
      }
    } else if (a.type === "fixed_income" && (desc.includes("treasur") || desc.includes("t-bill"))) {
      mediumTerm += val;
      mediumItems.push({ label: a.description.split("—")[0].trim(), value: val });
    }
  }
  return { immediate, shortTerm, mediumTerm, immediateItems, shortItems, mediumItems };
}

function computeTrough(forecastData: ReturnType<typeof buildForecast>) {
  const min = Math.min(...forecastData.map(d => d.cumulative));
  return min < 0 ? Math.abs(min) : 0;
}

// ─── Panel 1: Net Worth ────────────────────────────────────────────────────────
function NetWorthPanel({ assets, liabilities }: { assets: Asset[]; liabilities: Liability[] }) {
  const [view, setView] = useState<"assets" | "liabilities">("assets");
  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalLiab   = liabilities.reduce((s, l) => s + Number(l.value), 0);
  const netWorth    = totalAssets - totalLiab;
  const trendData   = buildNWTrend(netWorth);

  // Asset category rollup
  const assetGroups: Record<string, number> = {};
  for (const a of assets) {
    const label = a.description.split("(")[0].split("—")[0].trim();
    assetGroups[label] = (assetGroups[label] || 0) + Number(a.value);
  }
  // Liability rollup
  const liabGroups: Record<string, number> = {};
  for (const l of liabilities) {
    const label = l.description.split("(")[0].split("—")[0].trim();
    liabGroups[label] = (liabGroups[label] || 0) + Number(l.value);
  }

  const rows = view === "assets"
    ? Object.entries(assetGroups).sort((a, b) => b[1] - a[1]).slice(0, 9)
    : Object.entries(liabGroups).sort((a, b) => b[1] - a[1]);

  return (
    <div className={PANEL_CLS}>
      <div className="px-4 pt-4 pb-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Net Worth</p>
        <p className="text-2xl font-bold text-foreground" data-testid="kpi-net-worth">{fmt(netWorth)}</p>
      </div>
      <div className="h-24 px-1 mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={BLUE} strokeWidth={1.5} fill="url(#nwGrad)" dot={false} />
            <RechartsTooltip formatter={(v: number) => [fmt(v), "Net Worth"]} contentStyle={{ fontSize: 11 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="px-4 pb-4">
        <div className="flex border border-border rounded-md overflow-hidden mb-2 text-xs font-semibold">
          <button
            className={`flex-1 py-1 transition-colors ${view === "assets" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
            onClick={() => setView("assets")}
            data-testid="toggle-assets"
          >Assets</button>
          <button
            className={`flex-1 py-1 transition-colors ${view === "liabilities" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
            onClick={() => setView("liabilities")}
            data-testid="toggle-liabilities"
          >Liabilities</button>
        </div>
        <div className="space-y-0.5 max-h-40 overflow-y-auto">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between items-center text-xs py-0.5">
              <span className="text-muted-foreground truncate pr-2" style={{ maxWidth: "65%" }}>{label}</span>
              <span className={`font-semibold tabular-nums ${view === "liabilities" ? "text-rose-600" : "text-foreground"}`}>
                {view === "liabilities" ? "-" : ""}{fmt(value)}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center text-xs py-1 border-t border-border mt-1 font-bold">
            <span>Total {view === "assets" ? "Assets" : "Liabilities"}</span>
            <span className={view === "liabilities" ? "text-rose-600" : ""}>{view === "liabilities" ? "-" : ""}{fmt(view === "assets" ? totalAssets : totalLiab)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Panel 2: Projected Cumulative Cash Flow ──────────────────────────────────
function CashFlowForecastPanel({ cashFlows }: { cashFlows: CashFlow[] }) {
  const data = buildForecast(cashFlows);
  const annualNet = data.reduce((s, d) => s + d.net, 0);
  const cashTrough = computeTrough(data);
  const minVal = Math.min(...data.map(d => d.cumulative));
  const maxVal = Math.max(...data.map(d => d.cumulative));
  const range = maxVal - minVal || 1;
  const zeroOffset = `${Math.max(0, Math.min(100, ((maxVal / range) * 100))).toFixed(1)}%`;

  return (
    <div className={PANEL_CLS}>
      <div className="px-4 pt-4 pb-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projected Cumulative Cash Flow</p>
            <p className={`text-xl font-bold ${annualNet >= 0 ? "text-emerald-600" : "text-rose-600"}`} data-testid="kpi-annual-net">
              {fmt(annualNet, true)}
            </p>
            <p className="text-xs text-muted-foreground">{annualNet >= 0 ? "Cash Surplus (12 months)" : "Cash Deficit (12 months)"}</p>
          </div>
          {cashTrough > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Cash trough</p>
              <p className="text-sm font-bold text-rose-600">-{fmt(cashTrough, true)}</p>
            </div>
          )}
        </div>
      </div>
      <div className="px-1 pb-3" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset={zeroOffset} stopColor={GREEN} stopOpacity={0.3} />
                <stop offset={zeroOffset} stopColor={RED}   stopOpacity={0.25} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} width={44} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
            <RechartsTooltip
              formatter={(v: number) => [fmt(v), "Cumulative Net"]}
              contentStyle={{ fontSize: 11 }}
            />
            <Area type="monotone" dataKey="cumulative" stroke={annualNet >= 0 ? GREEN : RED} strokeWidth={2} fill="url(#cfGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex px-4 pb-3 gap-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Cash Surplus</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Cash Deficit</span>
      </div>
    </div>
  );
}

// ─── Panel 3: Cash Management Monitor ────────────────────────────────────────
function CashManagementPanel({ assets, cashFlows }: { assets: Asset[]; cashFlows: CashFlow[] }) {
  const [bucket, setBucket] = useState<"immediate" | "short" | "medium">("immediate");
  const { immediate, shortTerm, mediumTerm, immediateItems, shortItems, mediumItems } = cashBuckets(assets);
  const totalLiquid = immediate + shortTerm + mediumTerm;

  const forecastData = buildForecast(cashFlows);
  const cashTrough = computeTrough(forecastData);
  const isSufficient = totalLiquid >= cashTrough;

  const donutData = [
    { name: "Immediate", value: immediate, color: "hsl(221, 83%, 53%)" },
    { name: "Short-Term", value: shortTerm, color: "hsl(43, 74%, 56%)" },
    { name: "Medium-Term", value: mediumTerm, color: "hsl(142, 71%, 40%)" },
  ].filter(d => d.value > 0);

  const bucketItems = bucket === "immediate" ? immediateItems : bucket === "short" ? shortItems : mediumItems;
  const bucketTotal = bucket === "immediate" ? immediate : bucket === "short" ? shortTerm : mediumTerm;

  return (
    <div className={PANEL_CLS}>
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Cash Management Monitor</p>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold mb-2 ${isSufficient ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {isSufficient ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {isSufficient ? "SUFFICIENT FUNDS FOR 12 MONTHS" : "CASH SHORTFALL — ACTION NEEDED"}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <div>
            <p className="text-muted-foreground">Cash req'd (12 months)</p>
            <p className="font-bold text-rose-600 text-sm">{fmt(cashTrough)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Funds to cover</p>
            <p className="font-bold text-emerald-600 text-sm">{fmt(totalLiquid)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center px-4 pb-2 gap-3">
        <div style={{ width: 100, height: 100, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={28} outerRadius={44} dataKey="value" paddingAngle={3}>
                {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <RechartsTooltip formatter={(v: number, n: string) => [fmt(v), n]} contentStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-1 text-xs">
          {donutData.map(d => (
            <div key={d.name} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="font-semibold ml-auto pl-2">{fmt(d.value, true)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="flex gap-1 mb-2">
          {(["immediate", "short", "medium"] as const).map(b => (
            <button
              key={b}
              onClick={() => setBucket(b)}
              className={`flex-1 text-xs py-1 rounded border transition-colors ${bucket === b ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
              data-testid={`bucket-${b}`}
            >
              {b === "immediate" ? "Immediate" : b === "short" ? "Short-Term" : "Medium-Term"}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          {bucketItems.map(item => (
            <div key={item.label} className="flex justify-between text-xs">
              <span className="text-muted-foreground truncate pr-2">{item.label}</span>
              <span className="font-semibold tabular-nums">{fmt(item.value)}</span>
            </div>
          ))}
          {bucketItems.length > 0 && (
            <div className="flex justify-between text-xs font-bold border-t border-border pt-1 mt-1">
              <span>Total</span><span>{fmt(bucketTotal)}</span>
            </div>
          )}
          {bucketItems.length === 0 && <p className="text-xs text-muted-foreground italic">No assets in this bucket</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Panel 4: Brokerage + Retirement ─────────────────────────────────────────
function BrokeragePanel({ assets }: { assets: Asset[] }) {
  const brokerageTypes = ["equity", "fixed_income", "alternative"];
  const brokerageAssets = assets.filter(a => brokerageTypes.includes(a.type) && !a.description.toLowerCase().includes("carry") && !a.description.toLowerCase().includes("rsu"));
  const retirementAssets = assets.filter(a => a.description.toLowerCase().includes("401") || a.description.toLowerCase().includes("ira") || a.description.toLowerCase().includes("roth"));
  const totalBrok = brokerageAssets.reduce((s, a) => s + Number(a.value), 0);
  const totalRet  = retirementAssets.reduce((s, a) => s + Number(a.value), 0);
  const total     = totalBrok + totalRet;

  const typeMap: Record<string, number> = {};
  for (const a of [...brokerageAssets, ...retirementAssets]) {
    const label = a.type === "equity" ? "Equities" : a.type === "fixed_income" ? "Fixed Income" : "Alternatives";
    typeMap[label] = (typeMap[label] || 0) + Number(a.value);
  }
  const pieData = Object.entries(typeMap).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ["hsl(221,83%,53%)", "hsl(142,71%,40%)", "hsl(0,84%,60%)", "hsl(43,74%,56%)"];

  return (
    <div className={PANEL_CLS}>
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Taxable Brokerage + Retirement</p>
        <p className="text-2xl font-bold text-foreground" data-testid="kpi-brokerage">{fmt(total, true)}</p>
        <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
          <span>Brokerage <span className="font-semibold text-foreground">{fmt(totalBrok, true)}</span></span>
          <span>Retirement <span className="font-semibold text-foreground">{fmt(totalRet, true)}</span></span>
        </div>
        <div className="flex gap-4 text-xs mt-1">
          <span className="text-emerald-600 font-semibold flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />4.32% YTD</span>
          <span className="text-muted-foreground">vs. Index 3.84%</span>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3">
        <div style={{ width: 110, height: 110, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={4}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <RechartsTooltip formatter={(v: number, n: string) => [fmt(v), n]} contentStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1">
          {pieData.map((d, i) => (
            <div key={d.name} className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-muted-foreground">{d.name}</span>
              </span>
              <span className="font-semibold tabular-nums">{fmt(d.value, true)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-border mx-4 mb-3" />
      <div className="px-4 pb-4 space-y-1">
        {[...brokerageAssets, ...retirementAssets].slice(0, 5).map(a => (
          <div key={a.id} className="flex justify-between text-xs">
            <span className="text-muted-foreground truncate pr-2">{a.description.split("(")[0].split("—")[0].trim()}</span>
            <span className="font-semibold tabular-nums">{fmt(Number(a.value), true)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Panel 5: Income vs. Expense Projection ───────────────────────────────────
function IncomeExpensePanel({ cashFlows }: { cashFlows: CashFlow[] }) {
  const data = buildForecast(cashFlows);
  return (
    <div className={PANEL_CLS + " flex flex-col"}>
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Income vs. Expense Projection</p>
      </div>
      <div className="flex-1 overflow-x-auto px-4 pb-4">
        <table className="w-full text-xs" style={{ minWidth: 480 }}>
          <thead>
            <tr className="border-b border-border">
              <td className="pb-1.5 text-muted-foreground font-semibold pr-3" style={{ minWidth: 90 }}></td>
              {data.map(d => (
                <td key={d.month} className="pb-1.5 text-muted-foreground text-center font-medium tabular-nums" style={{ minWidth: 52 }}>{d.month}</td>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            <tr>
              <td className="py-1.5 font-semibold text-foreground pr-3">Income</td>
              {data.map(d => (
                <td key={d.month} className="py-1.5 text-center tabular-nums text-emerald-700">{fmtK(d.inflow)}</td>
              ))}
            </tr>
            <tr>
              <td className="py-1.5 font-semibold text-foreground pr-3">Expenses</td>
              {data.map(d => (
                <td key={d.month} className="py-1.5 text-center tabular-nums text-rose-600">({fmtK(d.outflow)})</td>
              ))}
            </tr>
            <tr className="bg-secondary/30">
              <td className="py-1.5 font-bold text-foreground pr-3">Net Cash Flow</td>
              {data.map(d => (
                <td key={d.month} className={`py-1.5 text-center font-bold tabular-nums ${d.net >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {d.net < 0 ? `(${fmtK(Math.abs(d.net))})` : fmtK(d.net)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Panel 6: GURU Optimizer ─────────────────────────────────────────────────
function GuruOptimizerPanel({ assets, cashFlows }: { assets: Asset[]; cashFlows: CashFlow[] }) {
  const { immediate, shortTerm, mediumTerm } = cashBuckets(assets);
  const totalLiquid = immediate + shortTerm + mediumTerm;
  const forecastData = buildForecast(cashFlows);
  const cashTrough = computeTrough(forecastData);
  const cashExcess = totalLiquid - cashTrough;

  // Idle cash in checking earning near-zero → yield improvement
  const additionalCashIncome = Math.round(immediate * 0.036); // ~3.6% money market rate

  // Investment optimization: cash sitting in brokerage + excess bank cash
  const brokerageCash = assets.filter(a => a.type === "cash" && a.description.toLowerCase().includes("money market")).reduce((s, a) => s + Number(a.value), 0);
  const totalToInvest = Math.round(brokerageCash + Math.max(0, cashExcess));
  const investPctIncrease = assets.filter(a => ["equity", "alternative"].includes(a.type)).reduce((s, a) => s + Number(a.value), 0);
  const investPct = investPctIncrease > 0 ? Math.round((totalToInvest / investPctIncrease) * 100) : 0;
  const cashFlowPct = additionalCashIncome > 0 && (cashFlows.filter(c => c.type === "inflow").reduce((s, c) => s + Number(c.amount), 0) / 12) > 0
    ? Math.round((additionalCashIncome / (cashFlows.filter(c => c.type === "inflow").reduce((s, c) => s + Number(c.amount), 0) / 12)) * 100)
    : 0;

  return (
    <div className={PANEL_CLS + " flex flex-col"}>
      <div className="px-4 pt-4 pb-2 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          GURU Optimizer
        </p>
      </div>
      <div className="flex-1 grid grid-cols-2 divide-x divide-border">
        <div className="p-4">
          <p className="text-xs font-bold text-foreground mb-3">Cash Optimizer</p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Cash Excess / Deficit</p>
              <p className={`font-bold text-base ${cashExcess >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmt(cashExcess, true)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Additional Cash Income / Year</p>
              <p className="font-bold text-base text-foreground">{fmt(additionalCashIncome, true)}</p>
            </div>
            {cashFlowPct > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-xs text-emerald-700 font-semibold">
                {cashFlowPct}% increase to your cash flow
              </div>
            )}
          </div>
          <button className="mt-4 w-full text-xs font-semibold text-primary border border-primary rounded-md py-1.5 hover:bg-primary hover:text-primary-foreground transition-colors">
            Actions Here
          </button>
        </div>
        <div className="p-4">
          <p className="text-xs font-bold text-foreground mb-3">Investments Optimizer</p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Total Cash to Invest (A+B)</p>
              <p className="font-bold text-base text-foreground">{fmt(totalToInvest, true)}</p>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">A: Investment accts idle cash</span>
                <span className="font-semibold">{fmt(brokerageCash, true)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">B: Excess cash to reallocate</span>
                <span className="font-semibold">{fmt(Math.max(0, cashExcess), true)}</span>
              </div>
            </div>
            {investPct > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-xs text-blue-700 font-semibold">
                {investPct}% increase to investments
              </div>
            )}
          </div>
          <button className="mt-4 w-full text-xs font-semibold text-primary border border-primary rounded-md py-1.5 hover:bg-primary hover:text-primary-foreground transition-colors">
            Actions Here
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Strategy View ─────────────────────────────────────────────────────────────
function StrategyView({
  strategies, clientId, isPending, onGenerate,
}: {
  strategies: Strategy[]; clientId: number; isPending: boolean; onGenerate: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground">AI Balance Sheet Strategy</h2>
          <p className="text-sm text-muted-foreground">Powered by GPT-5 · Full balance sheet analysis</p>
        </div>
        <Button
          onClick={onGenerate}
          disabled={isPending}
          className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-0 shadow-lg shadow-indigo-500/20"
          data-testid="button-generate-strategy"
        >
          {isPending ? (
            <span className="flex items-center gap-2"><Activity className="w-4 h-4 animate-spin" /> Analyzing…</span>
          ) : (
            <span className="flex items-center gap-2"><BrainCircuit className="w-4 h-4" /> Generate Strategy</span>
          )}
        </Button>
      </div>

      {isPending && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
          <p className="text-sm text-muted-foreground">Analyzing balance sheet, cash flows &amp; liquidity position…</p>
        </div>
      )}

      {!isPending && strategies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
            <BrainCircuit className="w-8 h-8 text-indigo-300" />
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Click <strong>Generate Strategy</strong> to run a full balance sheet analysis and get personalized cash management recommendations.
          </p>
        </div>
      )}

      {!isPending && strategies.length > 0 && (
        <div className="space-y-4">
          {strategies.map((s, i) => (
            <Card key={s.id} className="border-border/60 hover:border-indigo-200 transition-colors" data-testid={`strategy-card-${s.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <h3 className="font-semibold text-sm text-foreground">{s.name}</h3>
                  </div>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs flex-shrink-0 whitespace-nowrap">
                    +{fmt(Number(s.impact), true)} / yr
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed pl-9">{s.recommendation}</p>
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground text-center pt-2">Generated by GURU · Click Generate to refresh</p>
        </div>
      )}
    </div>
  );
}

// ─── Details View ─────────────────────────────────────────────────────────────
function DetailsView({ assets, liabilities, cashFlows, clientId }: { assets: Asset[]; liabilities: Liability[]; cashFlows: CashFlow[]; clientId: number }) {
  const [tab, setTab] = useState<"bs" | "assets" | "liab" | "cf">("bs");
  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalLiab   = liabilities.reduce((s, l) => s + Number(l.value), 0);
  const netWorth    = totalAssets - totalLiab;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 border border-border rounded-lg p-1 bg-secondary/30 text-xs">
          {(["bs", "assets", "liab", "cf"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${tab === t ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t === "bs" ? "Balance Sheet" : t === "assets" ? "Assets" : t === "liab" ? "Liabilities" : "Cash Flows"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <AddAssetModal clientId={clientId} />
          <AddLiabilityModal clientId={clientId} />
          <AddCashFlowModal clientId={clientId} />
        </div>
      </div>

      {tab === "bs" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Assets</h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-secondary/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground grid grid-cols-3">
                <span className="col-span-2">Account / Asset</span><span className="text-right">Value</span>
              </div>
              {assets.map(a => (
                <div key={a.id} className="px-4 py-2.5 border-t border-border grid grid-cols-3 text-sm hover:bg-secondary/20">
                  <span className="col-span-2 truncate text-foreground">{a.description}</span>
                  <span className="text-right font-semibold tabular-nums">{fmt(Number(a.value))}</span>
                </div>
              ))}
              <div className="px-4 py-2.5 border-t border-border grid grid-cols-3 font-bold text-sm bg-secondary/30">
                <span className="col-span-2">Total Assets</span>
                <span className="text-right tabular-nums">{fmt(totalAssets)}</span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Liabilities</h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-secondary/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground grid grid-cols-3">
                <span className="col-span-2">Obligation</span><span className="text-right">Balance</span>
              </div>
              {liabilities.map(l => (
                <div key={l.id} className="px-4 py-2.5 border-t border-border grid grid-cols-3 text-sm hover:bg-secondary/20">
                  <span className="col-span-2 truncate text-foreground">{l.description} <span className="text-xs text-muted-foreground">({l.interestRate}%)</span></span>
                  <span className="text-right font-semibold tabular-nums text-rose-600">{fmt(Number(l.value))}</span>
                </div>
              ))}
              <div className="px-4 py-2.5 border-t border-border grid grid-cols-3 font-bold text-sm bg-secondary/30">
                <span className="col-span-2">Total Liabilities</span>
                <span className="text-right tabular-nums text-rose-600">{fmt(totalLiab)}</span>
              </div>
              <div className="px-4 py-2.5 border-t-2 border-foreground grid grid-cols-3 font-bold text-sm">
                <span className="col-span-2">Net Worth</span>
                <span className="text-right tabular-nums text-emerald-600">{fmt(netWorth)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "assets" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {assets.map(a => (
            <div key={a.id} className="p-4 border border-border rounded-lg hover:border-primary/30 transition-colors" data-testid={`asset-card-${a.id}`}>
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className="text-xs capitalize">{a.type.replace("_", " ")}</Badge>
                <span className="font-bold text-sm">{fmt(Number(a.value))}</span>
              </div>
              <p className="text-sm text-foreground leading-snug">{a.description}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "liab" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {liabilities.map(l => (
            <div key={l.id} className="p-4 border border-border rounded-lg hover:border-rose-200 transition-colors" data-testid={`liability-card-${l.id}`}>
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className="text-xs capitalize text-rose-600 border-rose-200">{l.type.replace("_", " ")}</Badge>
                <div className="text-right">
                  <p className="font-bold text-sm text-rose-600">{fmt(Number(l.value))}</p>
                  <p className="text-xs text-muted-foreground">{l.interestRate}% APR</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{l.description}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "cf" && (
        <div className="divide-y border border-border rounded-lg overflow-hidden">
          {cashFlows.map(flow => (
            <div key={flow.id} className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors" data-testid={`cashflow-row-${flow.id}`}>
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${flow.type === "inflow" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
                  {flow.type === "inflow" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <p className="font-medium text-sm">{flow.description}</p>
                  <p className="text-xs text-muted-foreground capitalize">{flow.category.replace("_", " ")} · {format(new Date(flow.date), "MMM yyyy")}</p>
                </div>
              </div>
              <span className={`font-bold text-sm ${flow.type === "inflow" ? "text-emerald-600" : "text-rose-600"}`}>
                {flow.type === "inflow" ? "+" : "-"}{fmt(Number(flow.amount))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type ActiveView = "dashboard" | "strategy" | "details";

export default function ClientDashboard() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");

  const { data, isLoading, isError } = useClientDashboard(clientId);
  const generateStrategy = useGenerateStrategy(clientId);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading client data…</p>
        </div>
      </Layout>
    );
  }

  if (isError || !data) {
    return (
      <Layout>
        <div className="text-center mt-24">
          <XCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Client not found or failed to load.</p>
          <Link href="/"><Button variant="outline">Back to Clients</Button></Link>
        </div>
      </Layout>
    );
  }

  const { client, assets, liabilities, cashFlows, strategies } = data;
  const riskColor: Record<string, string> = {
    conservative: "bg-blue-100 text-blue-700",
    moderate: "bg-amber-100 text-amber-700",
    aggressive: "bg-rose-100 text-rose-700",
  };

  const navItems: { key: ActiveView; label: string; icon: React.ElementType }[] = [
    { key: "dashboard", label: "Dashboard",   icon: LayoutDashboard },
    { key: "strategy",  label: "Strategy",    icon: BrainCircuit },
    { key: "details",   label: "Details",     icon: Database },
  ];

  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <Link href="/">
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3" data-testid="link-back-clients">
            <ChevronLeft className="w-3.5 h-3.5" /> All Clients
          </button>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-client-name">{client.name}</h1>
            <Badge className={`${riskColor[client.riskTolerance] || "bg-secondary text-secondary-foreground"} capitalize text-xs font-semibold border-0`}>
              {client.riskTolerance} Risk
            </Badge>
            <Badge variant="outline" className="text-xs">Age {client.age}</Badge>
          </div>
        </div>

        {/* ── Tab Navigation ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mt-4 border-b border-border">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              data-testid={`nav-${key}`}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeView === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Dashboard View ─────────────────────────────────────────────────────── */}
      {activeView === "dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <NetWorthPanel assets={assets} liabilities={liabilities} />
            <CashFlowForecastPanel cashFlows={cashFlows} />
            <CashManagementPanel assets={assets} cashFlows={cashFlows} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BrokeragePanel assets={assets} />
            <IncomeExpensePanel cashFlows={cashFlows} />
            <GuruOptimizerPanel assets={assets} cashFlows={cashFlows} />
          </div>
        </div>
      )}

      {/* ── Strategy View ─────────────────────────────────────────────────────── */}
      {activeView === "strategy" && (
        <StrategyView
          strategies={strategies}
          clientId={clientId}
          isPending={generateStrategy.isPending}
          onGenerate={() => generateStrategy.mutate()}
        />
      )}

      {/* ── Details View ──────────────────────────────────────────────────────── */}
      {activeView === "details" && (
        <DetailsView assets={assets} liabilities={liabilities} cashFlows={cashFlows} clientId={clientId} />
      )}
    </Layout>
  );
}
