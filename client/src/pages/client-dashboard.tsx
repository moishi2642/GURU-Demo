import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useClientDashboard, useGenerateStrategy } from "@/hooks/use-clients";
import { AddAssetModal, AddLiabilityModal, AddCashFlowModal } from "@/components/financial-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, LineChart, Line, ReferenceLine, ReferenceDot,
  ComposedChart, Bar, LabelList, Legend,
} from "recharts";
import {
  BrainCircuit, TrendingUp, TrendingDown, ChevronLeft, Activity,
  CheckCircle2, AlertTriangle, XCircle, Zap, LayoutDashboard, FileText,
  Database, ArrowUpRight, CalendarClock, BarChart2, PieChart as PieChartIcon, Scale,
} from "lucide-react";
import { format, addMonths, startOfMonth, subMonths } from "date-fns";
import type { Asset, Liability, CashFlow, Strategy } from "@shared/schema";

// ─── Market Data (kept for BrokeragePanel) ────────────────────────────────────
interface QuoteItem {
  symbol: string;
  shortName: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  marketState: string;
}

function useMarketQuotes() {
  return useQuery<QuoteItem[]>({
    queryKey: ["/api/market/quotes"],
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}

// ─── Cash Flow Upcoming Events Ticker ─────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  salary: "Salary", investments: "Investment Income", housing: "Housing",
  living_expenses: "Living", taxes: "Taxes", education: "Education",
  travel: "Travel", lifestyle: "Lifestyle", bonus: "Bonus", other: "Other",
};

// Only show meaningful, non-recurring events in the live feed
const CHUNKY_ALWAYS = new Set(["taxes", "education", "bonus", "travel", "lifestyle"]);
function isChunkyEvent(cf: CashFlow): boolean {
  if (CHUNKY_ALWAYS.has(cf.category)) return true;
  // Capital calls, large investment events (not routine dividend/rental income)
  if (cf.category === "investments" && Number(cf.amount) >= 5_000) return true;
  return false;
}

function CashFlowTicker({ cashFlows }: { cashFlows: CashFlow[] }) {
  const now = new Date();
  const horizon = addMonths(now, 12);

  const all12 = cashFlows.filter(cf => { const d = new Date(cf.date); return d >= now && d <= horizon; });

  const items = all12
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(cf => ({
      date: format(new Date(cf.date), "MMM d"),
      label: cf.description.split("(")[0].split("—")[0].split("–")[0].trim(),
      amount: Number(cf.amount),
      type: cf.type as "inflow" | "outflow",
      category: cf.category,
    }));

  if (items.length === 0) return null;

  // Footer totals always reflect ALL 12-month flows, not just visible rows
  const totalIn  = all12.filter(c => c.type === "inflow").reduce((s, c) => s + Number(c.amount), 0);
  const totalOut = all12.filter(c => c.type === "outflow").reduce((s, c) => s + Number(c.amount), 0);
  const net      = totalIn - totalOut;
  const rowH     = 32; // px per row
  const visRows  = 6;
  const duration = Math.max(20, items.length * 2.2); // seconds

  const fmtAmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="rounded-xl border border-[hsl(221,39%,22%)] bg-[hsl(221,39%,10%)] overflow-hidden select-none shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-bold text-white/70 uppercase tracking-widest">Cashflow Forecast</span>
        </div>
        <span className="text-[10px] text-white/30 font-medium">Next 12 months · {items.length} events · hover to pause</span>
      </div>

      {/* Column headers */}
      <div className="grid text-[10px] font-bold uppercase tracking-widest text-white/30 border-b border-white/5 px-4 py-1.5"
        style={{ gridTemplateColumns: "68px 110px 1fr 90px" }}>
        <span>Date</span>
        <span>Category</span>
        <span>Description</span>
        <span className="text-right">Amount</span>
      </div>

      {/* Scrolling rows */}
      <div className="overflow-hidden" style={{ height: rowH * visRows }}>
        <div className="animate-feed" style={{ animationDuration: `${duration}s` }}>
          {[...items, ...items].map((item, i) => {
            const isIn = item.type === "inflow";
            const cat  = CATEGORY_LABELS[item.category] ?? item.category;
            return (
              <div
                key={i}
                className={`grid items-center px-4 border-b border-white/5 text-xs ${isIn ? "hover:bg-emerald-950/40" : "hover:bg-rose-950/40"} transition-colors`}
                style={{ height: rowH, gridTemplateColumns: "68px 110px 1fr 90px" }}
              >
                <span className="text-white/40 font-medium tabular-nums">{item.date}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit ${isIn ? "bg-emerald-900/50 text-emerald-400" : "bg-rose-900/40 text-rose-400"}`}>
                  {isIn ? "▲" : "▼"} {cat}
                </span>
                <span className="text-white/70 truncate pr-4">{item.label}</span>
                <span className={`font-bold tabular-nums text-right ${isIn ? "text-emerald-400" : "text-rose-400"}`}>
                  {isIn ? "+" : "−"}{fmtAmt(item.amount)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary footer */}
      <div className="grid grid-cols-3 divide-x divide-white/8 border-t border-white/10 text-xs">
        <div className="px-4 py-2.5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-0.5">12-Mo Inflows</p>
          <p className="font-bold text-emerald-400 tabular-nums">+{fmtAmt(totalIn)}</p>
        </div>
        <div className="px-4 py-2.5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-0.5">12-Mo Outflows</p>
          <p className="font-bold text-rose-400 tabular-nums">−{fmtAmt(totalOut)}</p>
        </div>
        <div className="px-4 py-2.5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-0.5">12-Mo Net</p>
          <p className={`font-bold tabular-nums ${net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{net >= 0 ? "+" : "−"}{fmtAmt(Math.abs(net))}</p>
        </div>
      </div>
    </div>
  );
}

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

// ─── GURU Method: 5 Strategic Bucket Definitions ─────────────────────────────
const GURU_BUCKETS = {
  reserve:      { label: "Reserve",      short: "Instantly available transaction accounts",                          color: "hsl(221,83%,53%)",  tagCls: "bg-blue-100   text-blue-700"    },
  yield:        { label: "Yield",        short: "Penalty-free, higher-yielding accounts",                            color: "hsl(43,74%,50%)",   tagCls: "bg-amber-100  text-amber-700"   },
  tactical:     { label: "Tactical",     short: "1–2 days to settle or committed for a term",                        color: "hsl(142,71%,40%)",  tagCls: "bg-emerald-100 text-emerald-700" },
  growth:       { label: "Growth",       short: "Long-horizon investments — higher return potential",                 color: "hsl(262,72%,55%)",  tagCls: "bg-violet-100 text-violet-700"  },
  alternatives: { label: "Alternatives", short: "Real estate, private equity, RSUs — strategic illiquid assets",    color: "hsl(25,90%,52%)",   tagCls: "bg-orange-100 text-orange-700"  },
} as const;
type GuroBucket = keyof typeof GURU_BUCKETS;

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

function buildNWProjection(netWorth: number, cashFlows: CashFlow[], assets: Asset[]) {
  const annualSurplus = buildForecast(cashFlows).reduce((s, d) => s + d.net, 0);
  // Growth assets (equity + alternatives + real estate) compound at conservative 6.5% annually
  const growthValue = assets
    .filter(a => ["equity", "alternative", "real_estate"].includes(a.type))
    .reduce((s, a) => s + Number(a.value), 0);
  const GROWTH_RATE = 0.065;
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const assetGrowth = growthValue * (Math.pow(1 + GROWTH_RATE, i) - 1);
    const cashAccum   = annualSurplus * i;
    return {
      label: i === 0 ? "Now" : `${i}Y`,
      year:  format(addMonths(now, i * 12), "yyyy"),
      value: Math.round(netWorth + assetGrowth + cashAccum),
    };
  });
}

function cashBuckets(assets: Asset[]) {
  let reserve = 0, yieldBucket = 0, tactical = 0, growth = 0, alts = 0;
  const reserveItems:  { label: string; value: number }[] = [];
  const yieldItems:    { label: string; value: number }[] = [];
  const tacticalItems: { label: string; value: number }[] = [];
  const growthItems:   { label: string; value: number }[] = [];
  const altItems:      { label: string; value: number }[] = [];

  for (const a of assets) {
    const desc = (a.description ?? "").toLowerCase();
    const val  = Number(a.value);
    const lbl  = (a.description ?? "").split("(")[0].split("—")[0].split("–")[0].trim();
    if (a.type === "cash") {
      if (desc.includes("checking"))   { reserve += val;      reserveItems.push({ label: lbl, value: val }); }
      else if (desc.includes("brokerage")) { growth += val;  growthItems.push({ label: lbl, value: val }); }
      else                             { yieldBucket += val;  yieldItems.push({ label: lbl, value: val }); }
    } else if (a.type === "fixed_income") {
      if (desc.includes("treasur") || desc.includes("t-bill") || desc.includes("short")) {
        tactical += val; tacticalItems.push({ label: lbl, value: val });
      } else {
        growth += val; growthItems.push({ label: lbl, value: val });
      }
    } else if (a.type === "equity") {
      if (desc.includes("rsu") || desc.includes("unvested") || desc.includes("carry")) {
        alts += val; altItems.push({ label: lbl, value: val });
      } else {
        growth += val; growthItems.push({ label: lbl, value: val });
      }
    } else if (a.type === "alternative") {
      alts += val; altItems.push({ label: lbl, value: val });
    } else if (a.type === "real_estate") {
      alts += val; altItems.push({ label: lbl, value: val });
    }
  }

  const totalLiquid = reserve + yieldBucket + tactical;
  // Backward-compat aliases
  return {
    reserve, yieldBucket, tactical, growth, alts, totalLiquid,
    reserveItems, yieldItems, tacticalItems, growthItems, altItems,
    // legacy aliases
    immediate: reserve, shortTerm: yieldBucket, mediumTerm: tactical,
    immediateItems: reserveItems, shortItems: yieldItems, mediumItems: tacticalItems,
  };
}

function computeTrough(forecastData: ReturnType<typeof buildForecast>) {
  const min = Math.min(...forecastData.map(d => d.cumulative));
  return min < 0 ? Math.abs(min) : 0;
}

// ─── Panel 1: Net Worth ────────────────────────────────────────────────────────
// Liquidity score: lower = more liquid. Maps to GURU 5-bucket system.
function liquidityScore(a: Asset): number {
  const desc = (a.description ?? "").toLowerCase();
  if (a.type === "cash") return desc.includes("checking") ? 1 : 2;
  if (a.type === "fixed_income") return desc.includes("treasur") || desc.includes("t-bill") || desc.includes("short") ? 3 : 4;
  if (a.type === "equity") {
    if (desc.includes("401") || desc.includes("ira") || desc.includes("roth")) return 4;
    if (desc.includes("rsu") || desc.includes("unvested") || desc.includes("carry")) return 5;
    return 4;
  }
  if (a.type === "alternative") return 5;
  if (a.type === "real_estate") return 5;
  return 4;
}

function liquidityTag(a: Asset): { label: string; tagCls: string } {
  const score = liquidityScore(a);
  const desc  = (a.description ?? "").toLowerCase();
  if (score === 1) return GURU_BUCKETS.reserve;
  if (score === 2) return GURU_BUCKETS.yield;
  if (score === 3) return GURU_BUCKETS.tactical;
  // score 4 = growth; score 5 = alternatives
  if (a.type === "equity" && !desc.includes("rsu") && !desc.includes("unvested") && !desc.includes("carry")) return GURU_BUCKETS.growth;
  if (a.type === "fixed_income") return GURU_BUCKETS.growth;
  return GURU_BUCKETS.alternatives;
}

function NetWorthPanel({ assets, liabilities, cashFlows }: { assets: Asset[]; liabilities: Liability[]; cashFlows: CashFlow[] }) {
  const [view, setView] = useState<"assets" | "liabilities">("assets");
  const totalAssets  = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalLiab    = liabilities.reduce((s, l) => s + Number(l.value), 0);
  const netWorth     = totalAssets - totalLiab;
  const projData     = buildNWProjection(netWorth, cashFlows, assets);
  const projYear5    = projData[projData.length - 1].value;

  // Assets sorted by liquidity (most liquid first)
  const sortedAssets = [...assets].sort((a, b) => liquidityScore(a) - liquidityScore(b));

  // Liability rollup sorted by value
  const liabGroups: Record<string, number> = {};
  for (const l of liabilities) {
    const label = l.description.split("(")[0].split("—")[0].trim();
    liabGroups[label] = (liabGroups[label] || 0) + Number(l.value);
  }

  return (
    <div className={PANEL_CLS}>
      <div className="px-4 pt-4 pb-0 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Net Worth <span className="text-muted-foreground/60 font-normal normal-case tracking-normal">· Today</span></p>
          <p className="text-2xl font-bold text-foreground" data-testid="kpi-net-worth">{fmt(netWorth)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">5-Year Projection</p>
          <p className="text-base font-bold text-blue-600">{fmt(projYear5, true)}</p>
        </div>
      </div>
      <div className="h-28 px-1 mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={projData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BLUE} stopOpacity={0.2} />
                <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} />
            <Area
              type="monotone" dataKey="value" stroke={BLUE} strokeWidth={2} fill="url(#nwGrad)"
              dot={(props: any) => {
                const { cx, cy, index } = props;
                if (index === 0) return (
                  <g key="nw-now">
                    <circle cx={cx} cy={cy} r={10} fill={BLUE} opacity={0.12} style={{ animation: "live-pulse 2s ease-in-out infinite", transformOrigin: `${cx}px ${cy}px` }} />
                    <circle cx={cx} cy={cy} r={3.5} fill={BLUE} stroke="white" strokeWidth={1.5} />
                  </g>
                );
                if (index === projData.length - 1) return <circle key="nw-end" cx={cx} cy={cy} r={3.5} fill={BLUE} stroke="white" strokeWidth={1.5} />;
                return <g key={index} />;
              }}
              activeDot={{ r: 5, stroke: "white", strokeWidth: 2 }}
            />
            <ReferenceLine x="Now" stroke={BLUE} strokeDasharray="3 3" strokeOpacity={0.4} />
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
          {view === "assets" ? (
            <>
              {sortedAssets.slice(0, 9).map(a => {
                const tag   = liquidityTag(a);
                const label = a.description.split("(")[0].split("—")[0].trim();
                return (
                  <div key={a.id} className="flex justify-between items-center text-xs py-0.5 gap-1">
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0 ${tag.tagCls}`}>{tag.label}</span>
                    <span className="text-muted-foreground truncate flex-1" title={label}>{label}</span>
                    <span className="font-semibold tabular-nums flex-shrink-0">{fmt(Number(a.value))}</span>
                  </div>
                );
              })}
              <div className="flex justify-between items-center text-xs py-1 border-t border-border mt-1 font-bold">
                <span>Total Assets</span>
                <span>{fmt(totalAssets)}</span>
              </div>
            </>
          ) : (
            <>
              {Object.entries(liabGroups).sort((a, b) => b[1] - a[1]).map(([label, value]) => (
                <div key={label} className="flex justify-between items-center text-xs py-0.5">
                  <span className="text-muted-foreground truncate pr-2" style={{ maxWidth: "65%" }}>{label}</span>
                  <span className="font-semibold tabular-nums text-rose-600">-{fmt(value)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center text-xs py-1 border-t border-border mt-1 font-bold">
                <span>Total Liabilities</span>
                <span className="text-rose-600">-{fmt(totalLiab)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Panel 2: Projected Cumulative Cash Flow ──────────────────────────────────
function CashFlowForecastPanel({ cashFlows }: { cashFlows: CashFlow[] }) {
  const data = buildForecast(cashFlows);
  const annualNet = data.reduce((s, d) => s + d.net, 0);
  const minVal = Math.min(...data.map(d => d.cumulative));
  const maxVal = Math.max(...data.map(d => d.cumulative));
  const troughIdx = data.findIndex(d => d.cumulative === minVal);
  const troughMonth = data[troughIdx]?.month ?? "";
  const hasTrough = minVal < 0;
  const range = maxVal - minVal || 1;
  const zeroOffset = `${Math.max(0, Math.min(100, ((maxVal / range) * 100))).toFixed(1)}%`;
  const finalVal = data[data.length - 1]?.cumulative ?? 0;
  const isPositive = annualNet >= 0;

  return (
    <div className={PANEL_CLS}>
      <div className="px-4 pt-4 pb-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">12-Month Cash Flow</p>
            <div className="flex items-center gap-2 mt-0.5">
              {isPositive
                ? <TrendingUp className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                : <TrendingDown className="w-5 h-5 text-rose-500 flex-shrink-0" />}
              <p className={`text-xl font-bold ${isPositive ? "text-emerald-600" : "text-rose-600"}`} data-testid="kpi-annual-net">
                {isPositive ? "+" : ""}{fmt(annualNet, true)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isPositive ? "Net surplus over 12 months" : "Net deficit over 12 months"}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground mt-0.5">
            <p>Monthly avg</p>
            <p className={`font-bold text-sm ${annualNet / 12 >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {annualNet / 12 >= 0 ? "+" : ""}{fmtK(Math.round(annualNet / 12))}/mo
            </p>
          </div>
        </div>
      </div>
      <div className="px-1 pb-2" style={{ height: 198 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 30, right: 48, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset={zeroOffset} stopColor={GREEN} stopOpacity={0.28} />
                <stop offset={zeroOffset} stopColor={RED}   stopOpacity={0.22} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} width={44} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
            {hasTrough && (
              <ReferenceLine
                x={troughMonth}
                stroke="hsl(0,72%,65%)"
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={(props: any) => {
                  const vb = props?.viewBox;
                  if (!vb) return null;
                  const { x, y } = vb;
                  return (
                    <g>
                      <rect x={x - 33} y={y - 34} width={66} height={28} rx={4} fill="hsl(0,80%,97%)" stroke="hsl(0,80%,80%)" strokeWidth={1} />
                      <text x={x} y={y - 22} textAnchor="middle" fill="hsl(0,72%,50%)" fontSize={8} fontWeight="700">TROUGH</text>
                      <text x={x} y={y - 11} textAnchor="middle" fill="hsl(0,72%,45%)" fontSize={9} fontWeight="800">{fmt(minVal, true)}</text>
                      <polygon points={`${x - 5},${y - 6} ${x + 5},${y - 6} ${x},${y}`} fill="hsl(0,80%,80%)" />
                    </g>
                  );
                }}
              />
            )}
            <RechartsTooltip
              formatter={(v: number, name: string) => [fmt(v), name === "cumulative" ? "Cumulative Net" : "Monthly Net"]}
              contentStyle={{ fontSize: 11 }}
            />
            <Bar dataKey="net" radius={[2, 2, 0, 0]} maxBarSize={12}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.net >= 0 ? "hsl(142,60%,55%)" : "hsl(0,72%,60%)"} fillOpacity={0.4} />
              ))}
            </Bar>
            <Area
              type="monotone" dataKey="cumulative"
              stroke={isPositive ? GREEN : RED}
              strokeWidth={2.5}
              fill="url(#cfGrad)"
              activeDot={{ r: 4, stroke: "white", strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={900}
              animationEasing="ease-out"
              dot={(props: any) => {
                const { cx, cy, index } = props;
                if (index === 0) {
                  const liveCol = isPositive ? GREEN : RED;
                  return (
                    <g key="cf-live">
                      <circle cx={cx} cy={cy} r={11} fill={liveCol} opacity={0.12} style={{ animation: "live-pulse 2s ease-in-out infinite", transformOrigin: `${cx}px ${cy}px` }} />
                      <circle cx={cx} cy={cy} r={4.5} fill={liveCol} stroke="white" strokeWidth={1.5} />
                      <text x={cx} y={cy - 11} textAnchor="middle" fill={liveCol} fontSize={8} fontWeight="800">NOW</text>
                    </g>
                  );
                }
                if (index === data.length - 1) {
                  const arrowChar = isPositive ? "▲" : "▼";
                  const col = isPositive ? "hsl(142,71%,35%)" : "hsl(0,72%,50%)";
                  return (
                    <g key="end-dot">
                      <circle cx={cx} cy={cy} r={5} fill={isPositive ? GREEN : RED} stroke="white" strokeWidth={2} />
                      <text x={cx + 8} y={cy + 4} fill={col} fontSize={8} fontWeight="800">{arrowChar} {fmtK(finalVal)}</text>
                    </g>
                  );
                }
                return <g key={index} />;
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex px-4 pb-3 gap-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Surplus</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Deficit</span>
        {hasTrough && <span className="flex items-center gap-1 ml-auto text-rose-500 font-semibold">Trough at {troughMonth}</span>}
      </div>
    </div>
  );
}

// ─── Panel 3: GURU Method — Cash Management ───────────────────────────────────
const GURU_BUCKET_ORDER: GuroBucket[] = ["reserve", "yield", "tactical", "growth", "alternatives"];

function CashManagementPanel({ assets, cashFlows }: { assets: Asset[]; cashFlows: CashFlow[] }) {
  const [active, setActive] = useState<GuroBucket>("reserve");
  const { reserve, yieldBucket, tactical, growth, alts,
          reserveItems, yieldItems, tacticalItems, growthItems, altItems,
          totalLiquid } = cashBuckets(assets);

  const bucketValues: Record<GuroBucket, number> = {
    reserve, yield: yieldBucket, tactical, growth, alternatives: alts,
  };
  const bucketItems: Record<GuroBucket, { label: string; value: number }[]> = {
    reserve: reserveItems, yield: yieldItems, tactical: tacticalItems,
    growth: growthItems, alternatives: altItems,
  };

  const forecastData = buildForecast(cashFlows);
  const cashTrough   = computeTrough(forecastData);
  const isSufficient = totalLiquid >= cashTrough;
  const totalAll     = reserve + yieldBucket + tactical + growth + alts;

  const donutData = GURU_BUCKET_ORDER.map(k => ({
    name: GURU_BUCKETS[k].label, value: bucketValues[k], color: GURU_BUCKETS[k].color,
  })).filter(d => d.value > 0);

  const activeItems = bucketItems[active] ?? [];
  const activeTotal = bucketValues[active] ?? 0;
  const isLiquid    = active === "reserve" || active === "yield" || active === "tactical";

  return (
    <div className={PANEL_CLS + " flex flex-col"}>
      <div className="px-4 pt-4 pb-2 border-b border-border">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">The GURU Method</p>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold ${isSufficient ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {isSufficient ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {isSufficient ? "LIQUID RESERVES SUFFICIENT" : "CASH SHORTFALL — ACTION NEEDED"}
        </div>
      </div>

      {/* Donut + legend */}
      <div className="flex items-center px-3 py-2 gap-2">
        <div style={{ width: 88, height: 88, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={24} outerRadius={40} dataKey="value" paddingAngle={2}>
                {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <RechartsTooltip formatter={(v: number, n: string) => [fmt(v), n]} contentStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-0.5 text-xs min-w-0">
          {GURU_BUCKET_ORDER.map(k => {
            const v = bucketValues[k];
            if (!v) return null;
            const pct = totalAll > 0 ? Math.round((v / totalAll) * 100) : 0;
            return (
              <button key={k} onClick={() => setActive(k)}
                className={`w-full flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-colors text-left ${active === k ? "bg-secondary" : "hover:bg-secondary/50"}`}
                data-testid={`bucket-${k}`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: GURU_BUCKETS[k].color }} />
                <span className={`font-bold flex-shrink-0 ${active === k ? "text-foreground" : "text-muted-foreground"}`}>{GURU_BUCKETS[k].label}</span>
                <span className="text-muted-foreground ml-auto tabular-nums flex-shrink-0">{pct}%</span>
                <span className="font-semibold tabular-nums flex-shrink-0">{fmt(v, true)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active bucket detail */}
      <div className="px-3 pb-3 flex-1">
        <div className={`rounded-lg px-3 py-2 mb-2 border ${GURU_BUCKETS[active].tagCls.split(" ").map(c => c.replace("text-", "border-").replace("700", "200").replace("bg-", "bg-")).join(" ")}`} style={{ borderColor: GURU_BUCKETS[active].color + "40" }}>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GURU_BUCKETS[active].color }}>{GURU_BUCKETS[active].label}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{GURU_BUCKETS[active].short}</p>
        </div>
        <div className="space-y-0.5">
          {activeItems.map((item, i) => (
            <div key={`${item.label}-${i}`} className="flex justify-between text-xs">
              <span className="text-muted-foreground truncate pr-2">{item.label}</span>
              <span className="font-semibold tabular-nums">{fmt(item.value)}</span>
            </div>
          ))}
          {activeItems.length > 0 && (
            <div className="flex justify-between text-xs font-bold border-t border-border pt-1 mt-1">
              <span>{GURU_BUCKETS[active].label} Total</span>
              <span>{fmt(activeTotal)}</span>
            </div>
          )}
          {activeItems.length === 0 && <p className="text-xs text-muted-foreground italic">No assets in this bucket</p>}
          {!isLiquid && (
            <p className="text-[10px] text-muted-foreground mt-1 italic">Not included in 12-month liquidity calculation</p>
          )}
        </div>
      </div>

      {/* Liquidity vs trough footer */}
      <div className="grid grid-cols-2 divide-x divide-border border-t border-border text-xs">
        <div className="px-3 py-2">
          <p className="text-muted-foreground">Liquid (R+Y+T)</p>
          <p className="font-bold text-emerald-600">{fmt(totalLiquid, true)}</p>
        </div>
        <div className="px-3 py-2">
          <p className="text-muted-foreground">12-Mo Required</p>
          <p className="font-bold text-rose-600">{fmt(cashTrough, true)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Panel 4: Brokerage + Retirement ─────────────────────────────────────────
function BrokeragePanel({ assets }: { assets: Asset[] }) {
  const { data: quotes } = useMarketQuotes();
  const gsQuote = quotes?.find(q => q.symbol === "GS");
  const spyQuote = quotes?.find(q => q.symbol === "SPY");

  const brokerageTypes = ["equity", "fixed_income", "alternative"];
  const brokerageAssets = assets.filter(a => brokerageTypes.includes(a.type) && !((a.description ?? "").toLowerCase()).includes("carry") && !((a.description ?? "").toLowerCase()).includes("rsu"));
  const retirementAssets = assets.filter(a => ((a.description ?? "").toLowerCase()).includes("401") || ((a.description ?? "").toLowerCase()).includes("ira") || ((a.description ?? "").toLowerCase()).includes("roth"));
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

  const spyUp = (spyQuote?.changePercent ?? 0) >= 0;

  return (
    <div className={PANEL_CLS}>
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Taxable Brokerage + Retirement</p>
        <p className="text-2xl font-bold text-foreground" data-testid="kpi-brokerage">{fmt(total, true)}</p>
        <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
          <span>Brokerage <span className="font-semibold text-foreground">{fmt(totalBrok, true)}</span></span>
          <span>Retirement <span className="font-semibold text-foreground">{fmt(totalRet, true)}</span></span>
        </div>
        {spyQuote ? (
          <div className="flex items-center gap-3 text-xs mt-1">
            <span className={`font-semibold flex items-center gap-0.5 ${spyUp ? "text-emerald-600" : "text-rose-600"}`}>
              {spyUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              S&P {spyUp ? "+" : ""}{spyQuote.changePercent?.toFixed(2)}% today
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground">SPY ${spyQuote.price?.toFixed(2)}</span>
          </div>
        ) : (
          <div className="flex gap-4 text-xs mt-1">
            <span className="text-emerald-600 font-semibold flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />4.32% YTD</span>
          </div>
        )}
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
        {[...brokerageAssets, ...retirementAssets].slice(0, 5).map(a => {
          const isGS = ((a.description ?? "").toLowerCase()).includes("goldman") || ((a.description ?? "").toLowerCase()).includes("rsu");
          const livePrice = isGS && gsQuote ? gsQuote : null;
          const gsUp = (gsQuote?.changePercent ?? 0) >= 0;
          return (
            <div key={a.id} className="flex justify-between items-center text-xs gap-1">
              <span className="text-muted-foreground truncate pr-1 flex-1">{a.description.split("(")[0].split("—")[0].trim()}</span>
              {livePrice && (
                <span className={`font-semibold flex-shrink-0 ${gsUp ? "text-emerald-600" : "text-rose-600"}`}>
                  GS ${livePrice.price?.toFixed(2)}
                </span>
              )}
              <span className="font-semibold tabular-nums flex-shrink-0">{fmt(Number(a.value), true)}</span>
            </div>
          );
        })}
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
  const { reserve, yieldBucket, tactical, totalLiquid } = cashBuckets(assets);
  const forecastData = buildForecast(cashFlows);
  const cashTrough = computeTrough(forecastData);
  const cashExcess = totalLiquid - cashTrough;

  // Idle cash in checking earning near-zero → yield improvement
  const additionalCashIncome = Math.round(reserve * 0.036); // ~3.6% money market rate on Reserve cash

  // Investment optimization: cash sitting in brokerage + excess bank cash
  const brokerageCash = assets.filter(a => a.type === "cash" && ((a.description ?? "").toLowerCase()).includes("brokerage")).reduce((s, a) => s + Number(a.value), 0);
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

// ─── Balance Sheet helpers ─────────────────────────────────────────────────────
function extractRate(description: string): string | null {
  const m = description.match(/(\d+\.\d+)%/);
  return m ? m[1] : null;
}

type AssetComment = { text: string; color: "red" | "orange" | "muted" };

function assetComment(a: Asset, groupTotal?: number): AssetComment | null {
  const desc = ((a.description ?? "").toLowerCase());
  const val  = Number(a.value);
  if (a.type === "cash" && desc.includes("checking") && val > 50000) return { text: "Excess", color: "red" };
  if (a.type === "cash" && (desc.includes("money market") || desc.includes("savings")) && val > 150000)
    return { text: "Excess", color: "red" };
  if (a.type === "real_estate" && (desc.includes("invest") || desc.includes("rent") || desc.includes("sarasota")))
    return { text: "Below 5%", color: "orange" };
  if (a.type === "cash" && desc.includes("checking") && val < 30000) return { text: "Main Account", color: "muted" };
  return null;
}

function liabComment(l: Liability): AssetComment | null {
  const rate = parseFloat(l.interestRate);
  if (l.type === "credit_card") return { text: "Need to review", color: "red" };
  if (l.type === "mortgage" && (l.description.toLowerCase().includes("sarasota") || l.description.toLowerCase().includes("invest")))
    return null;
  if (l.type === "mortgage" && rate > 5) return { text: "Floating in 3 mo", color: "orange" };
  return null;
}

interface BsGroup {
  category: string;
  items: { label: string; value: number; rate: string | null; comment: AssetComment | null }[];
  subtotal: number;
  avgRate: string | null;
}

function buildAssetGroups(assets: Asset[]): BsGroup[] {
  const isRetirement = (a: Asset) => {
    const d = ((a.description ?? "").toLowerCase());
    return d.includes("401") || d.includes("ira") || d.includes("roth");
  };
  const isCarry = (a: Asset) => ((a.description ?? "").toLowerCase()).includes("carry");
  const isRSU   = (a: Asset) => ((a.description ?? "").toLowerCase()).includes("rsu");
  const isBrokerage = (a: Asset) =>
    (a.type === "equity" || a.type === "fixed_income") &&
    !isRetirement(a) && !isRSU(a) &&
    (((a.description ?? "").toLowerCase()).includes("brokerage") || ((a.description ?? "").toLowerCase()).includes("taxable") || ((a.description ?? "").toLowerCase()).includes("fidelity"));

  const checking   = assets.filter(a => a.type === "cash" && ((a.description ?? "").toLowerCase()).includes("checking"));
  const savingsMM  = assets.filter(a => a.type === "cash" && !((a.description ?? "").toLowerCase()).includes("checking"));
  const brokerage  = assets.filter(a => isBrokerage(a));
  const altAssets  = assets.filter(a => a.type === "alternative" && !isCarry(a));
  const carry      = assets.filter(a => isCarry(a));
  const rsus       = assets.filter(a => isRSU(a));
  const realEstate = assets.filter(a => a.type === "real_estate");
  const retirement = assets.filter(a => isRetirement(a));

  const toItem = (a: Asset) => ({
    label: a.description.split("(")[0].split("—")[0].split("–")[0].trim(),
    value: Number(a.value),
    rate: extractRate(a.description),
    comment: assetComment(a),
  });

  const subtot = (arr: Asset[]) => arr.reduce((s, a) => s + Number(a.value), 0);
  const wavgRate = (arr: Asset[]) => {
    const total = subtot(arr);
    if (!total) return null;
    const weighted = arr.reduce((s, a) => {
      const r = extractRate(a.description);
      return s + (r ? parseFloat(r) * Number(a.value) : 0);
    }, 0);
    return weighted > 0 ? (weighted / total).toFixed(2) : null;
  };

  const groups: BsGroup[] = [];

  if (checking.length > 0) {
    groups.push({ category: "Checking Bank Accounts", items: checking.map(toItem), subtotal: subtot(checking), avgRate: wavgRate(checking) });
  }
  if (savingsMM.length > 0) {
    groups.push({ category: "Savings & Money Market Accounts", items: savingsMM.map(toItem), subtotal: subtot(savingsMM), avgRate: wavgRate(savingsMM) });
  }
  const totalCash = subtot([...checking, ...savingsMM]);
  if (totalCash > 0) {
    groups.push({ category: "Cash", items: [], subtotal: totalCash, avgRate: wavgRate([...checking, ...savingsMM]) });
  }
  const investments = [...brokerage, ...altAssets];
  if (brokerage.length > 0) {
    groups.push({ category: "Taxable Brokerage", items: brokerage.map(toItem), subtotal: subtot(brokerage), avgRate: null });
  }
  if (altAssets.length > 0) {
    groups.push({ category: "Alternative Assets", items: altAssets.map(toItem), subtotal: subtot(altAssets), avgRate: null });
  }
  if (investments.length > 0) {
    groups.push({ category: "Investments", items: [], subtotal: subtot(investments), avgRate: null });
  }
  if (carry.length > 0) {
    groups.push({ category: "Carry", items: carry.map(toItem), subtotal: subtot(carry), avgRate: null });
  }
  if (rsus.length > 0) {
    const carryAndRSUs = [...carry, ...rsus];
    groups.push({ category: "Carry and RSUs", items: rsus.map(toItem), subtotal: subtot(carryAndRSUs), avgRate: null });
  }
  if (realEstate.length > 0) {
    groups.push({ category: "Real Estate", items: realEstate.map(toItem), subtotal: subtot(realEstate), avgRate: null });
  }
  if (retirement.length > 0) {
    groups.push({ category: "Retirement", items: retirement.map(toItem), subtotal: subtot(retirement), avgRate: null });
  }

  return groups;
}

function buildLiabilityGroups(liabilities: Liability[]): BsGroup[] {
  const cc      = liabilities.filter(l => l.type === "credit_card");
  const student = liabilities.filter(l => l.type === "student_loan");
  const mortg   = liabilities.filter(l => l.type === "mortgage");
  const profLoan = liabilities.filter(l => l.type === "personal_loan" && parseFloat(l.interestRate) > 0);
  const capComm  = liabilities.filter(l => l.type === "personal_loan" && parseFloat(l.interestRate) === 0);

  const subtot = (arr: Liability[]) => arr.reduce((s, l) => s + Number(l.value), 0);
  const wavgRate = (arr: Liability[]) => {
    const total = subtot(arr);
    if (!total) return null;
    const weighted = arr.reduce((s, l) => s + parseFloat(l.interestRate) * Number(l.value), 0);
    return weighted > 0 ? (weighted / total).toFixed(2) : null;
  };

  const toItem = (l: Liability) => ({
    label: l.description.split("(")[0].split("—")[0].split("–")[0].trim(),
    value: Number(l.value),
    rate: parseFloat(l.interestRate) > 0 ? parseFloat(l.interestRate).toFixed(2) : null,
    comment: liabComment(l),
  });

  const groups: BsGroup[] = [];
  if (cc.length)       groups.push({ category: "Credit Cards / Lines of Credit", items: cc.map(toItem), subtotal: subtot(cc), avgRate: wavgRate(cc) });
  if (student.length)  groups.push({ category: "Student Loans", items: student.map(toItem), subtotal: subtot(student), avgRate: wavgRate(student) });
  if (mortg.length)    groups.push({ category: "Mortgages", items: mortg.map(toItem), subtotal: subtot(mortg), avgRate: wavgRate(mortg) });
  if (profLoan.length) groups.push({ category: "Professional Loans (Private Equity)", items: profLoan.map(toItem), subtotal: subtot(profLoan), avgRate: wavgRate(profLoan) });
  if (capComm.length)  groups.push({ category: "Remaining Capital Commitment", items: capComm.map(toItem), subtotal: subtot(capComm), avgRate: null });
  return groups;
}

// ─── Balance Sheet Table ───────────────────────────────────────────────────────
function BsTable({ groups, totalLabel, totalValue, totalRate, isLiability = false }: {
  groups: BsGroup[]; totalLabel: string; totalValue: number; totalRate?: string | null; isLiability?: boolean;
}) {
  const isSubtotalOnly = (g: BsGroup) => g.items.length === 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden text-xs">
      <div className="grid bg-[hsl(221,39%,24%)] text-white font-semibold" style={{ gridTemplateColumns: "1fr 90px 56px 90px" }}>
        <div className="px-3 py-2">{isLiability ? "Liability Category" : "Asset Category"}</div>
        <div className="px-2 py-2 text-right">Current Balance</div>
        <div className="px-2 py-2 text-right">{isLiability ? "Cost" : "Return"}</div>
        <div className="px-2 py-2">Comments</div>
      </div>

      {groups.map((group, gi) => (
        <div key={gi}>
          {!isSubtotalOnly(group) && group.items.map((item, ii) => (
            <div key={ii} className="grid border-t border-border hover:bg-secondary/20" style={{ gridTemplateColumns: "1fr 90px 56px 90px" }}>
              <div className="px-4 py-1.5 text-muted-foreground pl-5">{item.label}</div>
              <div className="px-2 py-1.5 text-right tabular-nums font-medium">{item.value > 0 ? fmt(item.value) : "—"}</div>
              <div className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                {item.rate ? `${item.rate}%` : item.value > 0 ? <span className="italic text-muted-foreground/60">[Ret]</span> : "—"}
              </div>
              <div className="px-2 py-1.5">
                {item.comment && (
                  <span className={`font-semibold ${item.comment.color === "red" ? "text-rose-600" : item.comment.color === "orange" ? "text-amber-600" : "text-muted-foreground"}`}>
                    {item.comment.text}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div className={`grid border-t font-semibold ${isSubtotalOnly(group) ? "bg-[hsl(221,39%,20%)] text-white" : "bg-[hsl(221,15%,88%)] text-[hsl(221,39%,20%)]"}`} style={{ gridTemplateColumns: "1fr 90px 56px 90px" }}>
            <div className="px-3 py-1.5">{group.category}</div>
            <div className="px-2 py-1.5 text-right tabular-nums">{fmt(group.subtotal)}</div>
            <div className="px-2 py-1.5 text-right tabular-nums">{group.avgRate ? `${group.avgRate}%` : isSubtotalOnly(group) ? "" : ""}</div>
            <div className="px-2 py-1.5" />
          </div>
        </div>
      ))}

      <div className="grid border-t-2 border-[hsl(221,39%,24%)] bg-[hsl(43,74%,56%)] text-white font-bold" style={{ gridTemplateColumns: "1fr 90px 56px 90px" }}>
        <div className="px-3 py-2">{totalLabel}</div>
        <div className="px-2 py-2 text-right tabular-nums">{fmt(totalValue)}</div>
        <div className="px-2 py-2 text-right tabular-nums">{totalRate ? `${totalRate}%` : ""}</div>
        <div className="px-2 py-2" />
      </div>
    </div>
  );
}

// ─── Cash Flow Forecast View ──────────────────────────────────────────────────
interface WaterfallEntry {
  name: string; quarter: string; type: "balance" | "income" | "core" | "onetime";
  invisible: number; income: number; coreExp: number; oneTime: number; balance: number;
  rawValue: number; running: number;
}

function buildWaterfallData(cashFlows: CashFlow[], startBalance: number): WaterfallEntry[] {
  const quarters = [
    { label: "Q1 2026", months: [[2026,3],[2026,4],[2026,5]], endLabel: "Mar–May" },
    { label: "Q2 2026", months: [[2026,6],[2026,7],[2026,8]], endLabel: "Jun–Aug" },
    { label: "Q3 2026", months: [[2026,9],[2026,10],[2026,11]], endLabel: "Sep–Nov" },
    { label: "Q4 / Q1", months: [[2026,12],[2027,1],[2027,2]], endLabel: "Dec–Feb" },
  ];
  const result: WaterfallEntry[] = [];
  let running = startBalance;
  result.push({ name: "Begin", quarter: "", type: "balance", invisible: 0, income: 0, coreExp: 0, oneTime: 0, balance: running, rawValue: running, running });
  for (const { label, months, endLabel } of quarters) {
    const qFlows = cashFlows.filter(cf => {
      const d = new Date(cf.date); const y = d.getFullYear(); const m = d.getMonth() + 1;
      return months.some(([qy, qm]) => qy === y && qm === m);
    });
    const income   = qFlows.filter(cf => cf.type === "inflow").reduce((s, cf) => s + Number(cf.amount), 0);
    const coreExp  = qFlows.filter(cf => cf.type === "outflow" && ["housing","living_expenses"].includes(cf.category)).reduce((s, cf) => s + Number(cf.amount), 0);
    const oneTime  = qFlows.filter(cf => cf.type === "outflow" && !["housing","living_expenses"].includes(cf.category)).reduce((s, cf) => s + Number(cf.amount), 0);
    const prevRun  = running;
    // Income bar: invisible base = prevRun, green bar = income
    result.push({ name: "Income", quarter: label, type: "income", invisible: prevRun, income, coreExp: 0, oneTime: 0, balance: 0, rawValue: income, running: prevRun + income });
    // Core expenses bar: invisible = prevRun+income-coreExp, red = coreExp (bar appears eating from top)
    result.push({ name: "Core Exp", quarter: label, type: "core", invisible: prevRun + income - coreExp, income: 0, coreExp, oneTime: 0, balance: 0, rawValue: -coreExp, running: prevRun + income - coreExp });
    // One-time: invisible = prevRun+income-coreExp-oneTime, red = oneTime
    result.push({ name: "One-Time", quarter: label, type: "onetime", invisible: prevRun + income - coreExp - oneTime, income: 0, coreExp: 0, oneTime, balance: 0, rawValue: -oneTime, running: prevRun + income - coreExp - oneTime });
    running = prevRun + income - coreExp - oneTime;
    result.push({ name: endLabel, quarter: label, type: "balance", invisible: 0, income: 0, coreExp: 0, oneTime: 0, balance: running, rawValue: running, running });
  }
  return result;
}

function WfLabel(props: { x?: number; y?: number; width?: number; value?: number; type?: string }) {
  const { x = 0, y = 0, width = 0, value, type } = props;
  if (!value || value === 0) return null;
  const cx = x + width / 2;
  const cy = y - 10;
  return (
    <text x={cx} y={cy} textAnchor="middle" fontSize={11} fontWeight={700}
      fill="hsl(221,39%,28%)">
      {fmt(value)}
    </text>
  );
}

type PLRowDef =
  | { key: string; kind: "group";    label: string }
  | { key: string; kind: "item";     label: string; descs: string[] }
  | { key: string; kind: "subtotal"; label: string; sumOf: string[] };

const CF_PL_ROWS: PLRowDef[] = [
  { key: "g_income",   kind: "group",    label: "EARNED INCOME" },
  { key: "salary",     kind: "item",     label: "Monthly Net Salary — P1 + P2",        descs: ["Monthly Net Salary"] },
  { key: "bonus_p1",   kind: "item",     label: "Partner 1 Year-End Bonus",             descs: ["Partner 1 Year-End"] },
  { key: "bonus_p2",   kind: "item",     label: "Partner 2 Year-End Bonus",             descs: ["Partner 2 Year-End"] },
  { key: "sub_income", kind: "subtotal", label: "Total Earned Income",                  sumOf: ["salary","bonus_p1","bonus_p2"] },
  { key: "g_tribeca",  kind: "group",    label: "TRIBECA — PRIMARY RESIDENCE" },
  { key: "trib_exp",   kind: "item",     label: "Mortgage + Maintenance + Insurance + Utilities", descs: ["Tribeca Mortgage"] },
  { key: "nyc_tax",    kind: "item",     label: "NYC Property Taxes (semi-annual)",     descs: ["NYC Property Taxes"] },
  { key: "sub_trib",   kind: "subtotal", label: "Net Tribeca",                          sumOf: ["trib_exp","nyc_tax"] },
  { key: "g_sara",     kind: "group",    label: "SARASOTA — INVESTMENT PROPERTY" },
  { key: "sara_in",    kind: "item",     label: "Rental Income (net of mgmt fee)",      descs: ["Sarasota Rental Income"] },
  { key: "sara_exp",   kind: "item",     label: "Property Expenses (mgmt + HOA + mortgage)", descs: ["Sarasota Property Expenses"] },
  { key: "fl_tax",     kind: "item",     label: "FL Property Taxes (annual)",           descs: ["FL Property Taxes"] },
  { key: "sub_sara",   kind: "subtotal", label: "Net Sarasota",                         sumOf: ["sara_in","sara_exp","fl_tax"] },
  { key: "g_living",   kind: "group",    label: "LIVING EXPENSES" },
  { key: "childcare",  kind: "item",     label: "Childcare / Babysitter",               descs: ["Childcare"] },
  { key: "food",       kind: "item",     label: "Food, Groceries & Dining",             descs: ["Food, Groceries"] },
  { key: "sub_living", kind: "subtotal", label: "Total Living Expenses",                sumOf: ["childcare","food"] },
  { key: "g_edu",      kind: "group",    label: "EDUCATION" },
  { key: "tuition",    kind: "item",     label: "Private School Tuition (quarterly)",   descs: ["Tuition"] },
  { key: "g_debt",     kind: "group",    label: "DEBT SERVICE" },
  { key: "pe_loan",    kind: "item",     label: "PE Fund II Professional Loan",         descs: ["PE Fund II Professional"] },
  { key: "student",    kind: "item",     label: "Student Loan Payments",                descs: ["Student Loan"] },
  { key: "sub_debt",   kind: "subtotal", label: "Total Debt Service",                   sumOf: ["pe_loan","student"] },
  { key: "g_tax",      kind: "group",    label: "TAXES" },
  { key: "fed_tax",    kind: "item",     label: "Q4 Estimated Federal Income Tax",      descs: ["Estimated Federal"] },
  { key: "g_travel",   kind: "group",    label: "TRAVEL & LIFESTYLE" },
  { key: "trav_mem",   kind: "item",     label: "Memorial Day Travel",                  descs: ["Memorial Day"] },
  { key: "trav_wknd",  kind: "item",     label: "Weekend Travel",                       descs: ["Weekend Travel"] },
  { key: "trav_sum",   kind: "item",     label: "Summer Vacation (Europe)",             descs: ["Summer Vacation"] },
  { key: "golf",       kind: "item",     label: "Golf Club Annual Dues",                descs: ["Golf Club"] },
  { key: "sub_travel", kind: "subtotal", label: "Total Travel & Lifestyle",             sumOf: ["trav_mem","trav_wknd","trav_sum","golf"] },
];

const CF_MONTHS = [
  {label:"Mar",year:2026,month:3},{label:"Apr",year:2026,month:4},{label:"May",year:2026,month:5},
  {label:"Jun",year:2026,month:6},{label:"Jul",year:2026,month:7},{label:"Aug",year:2026,month:8},
  {label:"Sep",year:2026,month:9},{label:"Oct",year:2026,month:10},{label:"Nov",year:2026,month:11},
  {label:"Dec",year:2026,month:12},{label:"Jan",year:2027,month:1},{label:"Feb",year:2027,month:2},
];

function CashFlowForecastView({ assets, cashFlows }: { assets: Asset[]; cashFlows: CashFlow[] }) {
  const { reserve } = cashBuckets(assets);
  const startBalance = reserve;
  const wfData = buildWaterfallData(cashFlows, startBalance);

  function monthVal(descs: string[], year: number, month: number): number {
    return cashFlows.filter(cf => {
      const d = new Date(cf.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month
        && descs.some(dm => cf.description.toLowerCase().includes(dm.toLowerCase()));
    }).reduce((s, cf) => s + (cf.type === "inflow" ? Number(cf.amount) : -Number(cf.amount)), 0);
  }

  const vals: Record<string, number[]> = {};
  for (const row of CF_PL_ROWS) {
    if (row.kind === "item") {
      vals[row.key] = CF_MONTHS.map(m => monthVal(row.descs, m.year, m.month));
    } else if (row.kind === "subtotal") {
      vals[row.key] = CF_MONTHS.map((_, mi) => row.sumOf.reduce((s, k) => s + (vals[k]?.[mi] ?? 0), 0));
    } else {
      vals[row.key] = CF_MONTHS.map(() => 0);
    }
  }

  const netByMonth = CF_MONTHS.map((_, mi) =>
    CF_PL_ROWS.filter(r => r.kind === "item").reduce((s, r) => s + (vals[r.key]?.[mi] ?? 0), 0)
  );
  const annualNet = netByMonth.reduce((s, v) => s + v, 0);

  function medianOf(arr: number[]): number {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : Math.round(s[m]);
  }

  const monthlyInflows  = CF_MONTHS.map(m => cashFlows.filter(cf => { const d = new Date(cf.date); return d.getFullYear() === m.year && d.getMonth() + 1 === m.month && cf.type === "inflow"; }).reduce((s, cf) => s + Number(cf.amount), 0));
  const monthlyOutflows = CF_MONTHS.map(m => cashFlows.filter(cf => { const d = new Date(cf.date); return d.getFullYear() === m.year && d.getMonth() + 1 === m.month && cf.type === "outflow"; }).reduce((s, cf) => s + Number(cf.amount), 0));
  const medianIn  = medianOf(monthlyInflows);
  const medianOut = medianOf(monthlyOutflows);
  const totalIn   = monthlyInflows.reduce((s, v) => s + v, 0);
  const totalOut  = monthlyOutflows.reduce((s, v) => s + v, 0);

  function fmtCell(v: number): string {
    if (v === 0) return "—";
    return v > 0 ? `+${fmt(v)}` : `(${fmt(Math.abs(v))})`;
  }

  return (
    <div className="space-y-5">
      {/* Median Monthly Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl" data-testid="stat-avg-inflow">
          <p className="text-xs font-medium text-muted-foreground mb-1">Median Monthly Inflows</p>
          <p className="text-2xl font-display font-black tabular-nums text-emerald-700">+{fmt(medianIn, true)}</p>
          <p className="text-xs text-muted-foreground mt-1">{fmt(totalIn, true)} annually</p>
        </div>
        <div className="p-4 border border-rose-200 bg-rose-50 dark:bg-rose-950/20 rounded-xl" data-testid="stat-avg-outflow">
          <p className="text-xs font-medium text-muted-foreground mb-1">Median Monthly Outflows</p>
          <p className="text-2xl font-display font-black tabular-nums text-rose-700">({fmt(medianOut, true)})</p>
          <p className="text-xs text-muted-foreground mt-1">{fmt(totalOut, true)} annually</p>
        </div>
        <div className={`p-4 border rounded-xl ${annualNet >= 0 ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20" : "border-rose-200 bg-rose-50"}`} data-testid="stat-net">
          <p className="text-xs font-medium text-muted-foreground mb-1">12-Month Net</p>
          <p className={`text-2xl font-display font-black tabular-nums ${annualNet >= 0 ? "text-blue-700" : "text-rose-700"}`}>
            {annualNet >= 0 ? "+" : ""}{fmt(Math.abs(annualNet), true)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Incl. year-end bonuses</p>
        </div>
      </div>

      {/* Waterfall Chart */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-5 pt-4 pb-2 border-b border-border">
          <p className="font-display font-bold text-base text-foreground">12-Month Cashflow Waterfall</p>
          <p className="text-xs text-muted-foreground mt-0.5">Quarterly view · Starting from checking balance · {fmt(startBalance)} beginning</p>
        </div>
        <div className="p-4 bg-card">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={wfData} margin={{ top: 30, right: 20, left: 20, bottom: 20 }} barCategoryGap="8%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={v => v >= 1000 ? `$${Math.round(v/1000)}K` : `$${v}`} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={60} />
              <RechartsTooltip
                formatter={(value: number, name: string) => {
                  if (name === "invisible") return null;
                  const labels: Record<string, string> = { income: "Income", coreExp: "Core Expenses", oneTime: "One-Time", balance: "Balance" };
                  return [fmt(value), labels[name] ?? name];
                }}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                itemStyle={{ padding: "2px 0" }}
              />
              {[3, 7, 11].map(i => (
                <ReferenceLine key={i} x={wfData[i]?.name} stroke="hsl(var(--border))" strokeDasharray="4 2" />
              ))}
              <Bar dataKey="invisible" stackId="wf" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="income"  stackId="wf" fill="#1a6b3a" radius={[3,3,0,0]} isAnimationActive={false} />
              <Bar dataKey="coreExp" stackId="wf" fill="#c0392b" radius={[3,3,0,0]} isAnimationActive={false} />
              <Bar dataKey="oneTime" stackId="wf" fill="#922b21" radius={[3,3,0,0]} isAnimationActive={false} />
              <Bar dataKey="balance" fill="hsl(221,39%,38%)" radius={[4,4,0,0]} isAnimationActive={false}>
                <LabelList content={(p: any) => <WfLabel {...p} type="balance" />} />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#1a6b3a" }} />Income</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#c0392b" }} />Core Expenses</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#922b21" }} />One-Time</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[hsl(221,39%,38%)] inline-block" />Cash Balance</span>
          </div>
        </div>
      </div>

      {/* P&L Detail Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="bg-[hsl(221,39%,24%)] text-white">
                <th className="text-left px-4 py-2.5 font-semibold" style={{ minWidth: 230 }}>Cash Flow P&L · Mar 2026 – Feb 2027</th>
                {CF_MONTHS.map(m => (
                  <th key={m.label} className="text-right px-1.5 py-2.5 font-semibold whitespace-nowrap opacity-80" style={{ minWidth: 50 }}>{m.label}</th>
                ))}
                <th className="text-right px-4 py-2.5 font-semibold opacity-80" style={{ minWidth: 70 }}>Annual</th>
              </tr>
            </thead>
            <tbody>
              {CF_PL_ROWS.map((row, rowIdx) => {
                if (row.kind === "group") {
                  return (
                    <tr key={row.key} className="bg-[hsl(221,39%,20%)] text-white border-t border-[hsl(221,39%,30%)]">
                      <td className="px-4 py-1.5 font-bold text-[10px] uppercase tracking-widest opacity-90" colSpan={15}>
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                const rowVals = vals[row.key] ?? [];
                const annual  = rowVals.reduce((s, v) => s + v, 0);
                if (row.kind === "item") {
                  const stripe = rowIdx % 2 === 0 ? "bg-white dark:bg-card" : "bg-[hsl(221,39%,98%)] dark:bg-secondary/10";
                  return (
                    <tr key={row.key} className={`border-t border-border/20 hover:bg-[hsl(221,39%,95%)] dark:hover:bg-secondary/20 transition-colors ${stripe}`}>
                      <td className="px-4 py-1.5 pl-7 text-foreground/80">{row.label}</td>
                      {rowVals.map((v, i) => (
                        <td key={i} className={`text-right px-1.5 py-1.5 tabular-nums ${v > 0 ? "text-emerald-700" : v < 0 ? "text-rose-600" : "text-muted-foreground/25"}`}>
                          {fmtCell(v)}
                        </td>
                      ))}
                      <td className={`text-right px-4 py-1.5 tabular-nums font-semibold ${annual > 0 ? "text-emerald-700" : annual < 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                        {fmtCell(annual)}
                      </td>
                    </tr>
                  );
                }
                if (row.kind === "subtotal") {
                  return (
                    <tr key={row.key} className="border-t border-[hsl(221,39%,70%)] bg-[hsl(221,15%,88%)] dark:bg-[hsl(221,25%,22%)] text-[hsl(221,39%,20%)] dark:text-white/90">
                      <td className="px-4 py-1.5 pl-7 font-bold">{row.label}</td>
                      {rowVals.map((v, i) => (
                        <td key={i} className={`text-right px-1.5 py-1.5 tabular-nums font-bold ${v > 0 ? "text-emerald-700 dark:text-emerald-400" : v < 0 ? "text-rose-600 dark:text-rose-400" : "opacity-30"}`}>
                          {fmtCell(v)}
                        </td>
                      ))}
                      <td className={`text-right px-4 py-1.5 tabular-nums font-bold ${annual >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {fmtCell(annual)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })}
              {/* NET CASH FLOW */}
              <tr className="border-t-2 border-[hsl(221,39%,24%)] bg-[hsl(43,74%,56%)] text-white">
                <td className="px-4 py-2.5 font-display font-black text-sm tracking-tight">NET CASH FLOW</td>
                {netByMonth.map((v, i) => (
                  <td key={i} className="text-right px-1.5 py-2.5 tabular-nums font-bold">
                    {fmtCell(v)}
                  </td>
                ))}
                <td className="text-right px-4 py-2.5 tabular-nums font-black text-sm">
                  {fmtCell(annualNet)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── GURU Asset Allocation View ───────────────────────────────────────────────
const MODEL_PORTFOLIO: { category: string; current: number; target: number; action: string; ticker: string }[] = [
  { category: "Cash (Idle — Deploy)",      current: 186586, target: 0,      action: "sell",  ticker: "" },
  { category: "US Large Cap (S&P 500)",    current: 435000, target: 353233, action: "trim",  ticker: "VOO" },
  { category: "US Total Market",           current: 379878, target: 141293, action: "trim",  ticker: "VTI" },
  { category: "US Large Cap Growth",       current: 0,      target: 141293, action: "buy",   ticker: "QQQ / VUG" },
  { category: "US Dividend / Quality",     current: 94369,  target: 70647,  action: "trim",  ticker: "SCHD / DGRO" },
  { category: "US Small Cap",              current: 49318,  target: 82839,  action: "buy",   ticker: "VB / IWM" },
  { category: "Developed International",   current: 116538, target: 109083, action: "trim",  ticker: "VEA / IEFA" },
  { category: "Bonds / Fixed Income",      current: 0,      target: 282587, action: "buy",   ticker: "AGG / Muni" },
  { category: "Crypto",                    current: 9500,   target: 8892,   action: "trim",  ticker: "BTC/ETH" },
  { category: "Meta (Single Stock)",       current: 238311, target: 238311, action: "hold",  ticker: "META" },
  { category: "Bank of America",           current: 60000,  target: 60000,  action: "hold",  ticker: "BAC" },
];

function GuruAllocationView({ assets, cashFlows }: { assets: Asset[]; cashFlows: CashFlow[] }) {
  const { reserve, yieldBucket, tactical, totalLiquid, reserveItems, yieldItems, tacticalItems } = cashBuckets(assets);
  const forecastData = buildForecast(cashFlows);
  const cashTrough   = computeTrough(forecastData);
  const cashExcess   = totalLiquid - cashTrough;
  const brokerageCash = assets.filter(a => a.type === "cash" && (a.description ?? "").toLowerCase().includes("brokerage")).reduce((s, a) => s + Number(a.value), 0);
  const totalToInvest = Math.round(brokerageCash + Math.max(0, cashExcess));

  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const growth = assets.filter(a => a.type === "equity" || (a.type === "cash" && (a.description ?? "").toLowerCase().includes("brokerage"))).reduce((s, a) => s + Number(a.value), 0);
  const alts   = assets.filter(a => a.type === "alternative" || a.type === "real_estate").reduce((s, a) => s + Number(a.value), 0);
  const retirement = assets.filter(a => a.type === "fixed_income" && (a.description ?? "").toLowerCase().includes("ira") || (a.type === "fixed_income" && (a.description ?? "").toLowerCase().includes("401"))).reduce((s, a) => s + Number(a.value), 0);

  const buckets = [
    { label: "Immediate",    sublabel: "Checking — transaction accounts",   value: reserve,      color: "hsl(221,83%,53%)",  pct: (reserve / totalAssets) * 100 },
    { label: "Short-Term",   sublabel: "Savings & money market",            value: yieldBucket,  color: "hsl(43,74%,50%)",   pct: (yieldBucket / totalAssets) * 100 },
    { label: "Medium-Term",  sublabel: "Treasuries — 1–3 yr horizon",       value: tactical,     color: "hsl(142,71%,40%)",  pct: (tactical / totalAssets) * 100 },
    { label: "Long-Term",    sublabel: "Equities & brokerage investments",  value: growth,       color: "hsl(262,72%,55%)",  pct: (growth / totalAssets) * 100 },
    { label: "Alternatives", sublabel: "Real estate, PE, carry, RSUs",      value: alts,         color: "hsl(25,90%,52%)",   pct: (alts / totalAssets) * 100 },
  ];

  const totalPortfolio = MODEL_PORTFOLIO.reduce((s, r) => s + r.current, 0);

  return (
    <div className="space-y-6">
      {/* 5-Bucket Overview */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-secondary/20">
          <p className="font-display font-bold text-sm text-foreground">GURU 5-Bucket Asset Framework</p>
          <p className="text-xs text-muted-foreground mt-0.5">Current allocation across {fmt(totalAssets)} total assets</p>
        </div>
        <div className="p-5 space-y-4">
          {/* Full-width stacked bar */}
          <div className="flex h-5 rounded-full overflow-hidden w-full">
            {buckets.map(b => (
              <div key={b.label} style={{ width: `${b.pct}%`, background: b.color }} title={`${b.label}: ${b.pct.toFixed(1)}%`} />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
            {buckets.map(b => (
              <div key={b.label} className="p-3 border border-border rounded-lg" data-testid={`bucket-${b.label.toLowerCase()}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: b.color }} />
                  <span className="font-bold text-xs text-foreground">{b.label}</span>
                  <span className="ml-auto text-xs font-semibold text-muted-foreground">{b.pct.toFixed(1)}%</span>
                </div>
                <p className="font-bold text-base tabular-nums">{fmt(b.value, true)}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{b.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* GURU Optimizer — Cash to Deploy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-secondary/20">
            <p className="font-display font-bold text-sm text-foreground flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" />Cash Management Optimizer</p>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Total Liquid (Reserve + Yield + Tactical)</span>
              <span className="font-bold tabular-nums">{fmt(totalLiquid, true)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">12-Month Cash Trough</span>
              <span className="font-bold tabular-nums text-rose-600">({fmt(cashTrough, true)})</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm font-semibold text-foreground">Liquid Surplus / Deficit</span>
              <span className={`font-bold text-lg tabular-nums ${cashExcess >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{cashExcess >= 0 ? "+" : ""}{fmt(cashExcess, true)}</span>
            </div>
            <div className="bg-secondary/30 rounded-lg px-4 py-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Reserve (Checking)</span><span className="font-medium tabular-nums">{fmt(reserve)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Yield (Savings / MM)</span><span className="font-medium tabular-nums">{fmt(yieldBucket)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tactical (Treasuries)</span><span className="font-medium tabular-nums">{fmt(tactical)}</span></div>
            </div>
          </div>
        </div>

        <div className="border-2 border-primary/30 rounded-xl overflow-hidden bg-primary/5">
          <div className="px-5 py-3 border-b border-primary/20 bg-primary/10">
            <p className="font-display font-bold text-sm text-foreground flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-primary" />Total Cash Available to Invest</p>
          </div>
          <div className="p-5 space-y-3">
            <div className="text-center py-2">
              <p className="text-4xl font-display font-black tabular-nums text-primary">{fmt(totalToInvest, true)}</p>
              <p className="text-xs text-muted-foreground mt-1">Ready to deploy into the model portfolio</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center px-3 py-2 bg-background rounded-lg border border-border">
                <div>
                  <span className="font-semibold text-foreground">A — Idle Brokerage Cash</span>
                  <p className="text-xs text-muted-foreground">Fidelity Cash Sweep (earning near 0%)</p>
                </div>
                <span className="font-bold tabular-nums text-foreground">{fmt(brokerageCash, true)}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 bg-background rounded-lg border border-border">
                <div>
                  <span className="font-semibold text-foreground">B — GURU Cash Reallocation</span>
                  <p className="text-xs text-muted-foreground">Liquid surplus above 12-mo trough</p>
                </div>
                <span className={`font-bold tabular-nums ${cashExcess >= 0 ? "text-foreground" : "text-rose-500"}`}>{fmt(Math.max(0, cashExcess), true)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Portfolio Recommendations */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-secondary/20 flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-sm text-foreground">Model Portfolio — Current vs Target</p>
            <p className="text-xs text-muted-foreground mt-0.5">Based on GURU 5-bucket allocation framework · Fidelity Taxable Brokerage</p>
          </div>
          <Badge variant="outline" className="text-xs">{fmt(totalToInvest, true)} to deploy</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-secondary/10">
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Category</th>
                <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Ticker</th>
                <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Current</th>
                <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Target</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Change</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {MODEL_PORTFOLIO.map(row => {
                const delta = row.target - row.current;
                return (
                  <tr key={row.category} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">{row.category}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-muted-foreground font-mono">{row.ticker || "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{row.current > 0 ? fmt(row.current) : "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{row.target > 0 ? fmt(row.target) : "—"}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                      {delta === 0 ? "—" : delta > 0 ? `+${fmt(delta)}` : `(${fmt(Math.abs(delta))})`}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {row.action === "buy"  && <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Buy</Badge>}
                      {row.action === "trim" && <Badge className="text-xs bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100">Trim</Badge>}
                      {row.action === "hold" && <Badge variant="outline" className="text-xs text-muted-foreground">Hold</Badge>}
                      {row.action === "sell" && <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Deploy</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-border bg-secondary/20">
              <tr>
                <td className="px-4 py-2.5 font-bold text-foreground" colSpan={2}>Total Liquid Portfolio</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold">{fmt(totalPortfolio)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold">{fmt(MODEL_PORTFOLIO.reduce((s, r) => s + r.target, 0))}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-bold text-emerald-600">+{fmt(totalToInvest)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Balance Sheet View (renamed from Details View) ───────────────────────────
function DetailsView({ assets, liabilities, cashFlows, clientId }: { assets: Asset[]; liabilities: Liability[]; cashFlows: CashFlow[]; clientId: number }) {
  const [tab, setTab] = useState<"bs" | "assets" | "liab" | "cf">("bs");
  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalLiab   = liabilities.reduce((s, l) => s + Number(l.value), 0);
  const netWorth    = totalAssets - totalLiab;

  const assetGroups = buildAssetGroups(assets);
  const liabGroups  = buildLiabilityGroups(liabilities);

  const totalAssetRate = (() => {
    const cashAssets = assets.filter(a => a.type === "cash");
    const weighted = cashAssets.reduce((s, a) => {
      const r = extractRate(a.description);
      return s + (r ? parseFloat(r) * Number(a.value) : 0);
    }, 0);
    return weighted > 0 ? (weighted / totalAssets * 100).toFixed(2) : null;
  })();

  const totalLiabRate = (() => {
    const weighted = liabilities.reduce((s, l) => s + parseFloat(l.interestRate) * Number(l.value), 0);
    return weighted > 0 ? (weighted / totalLiab).toFixed(2) : null;
  })();

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
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <BsTable
              groups={assetGroups}
              totalLabel="Total Assets"
              totalValue={totalAssets}
              totalRate={totalAssetRate}
            />
            <div className="space-y-3">
              <BsTable
                groups={liabGroups}
                totalLabel="Total Liabilities"
                totalValue={totalLiab}
                totalRate={totalLiabRate}
                isLiability
              />
              <div className="border-2 border-[hsl(221,39%,24%)] rounded-lg overflow-hidden">
                <div className="grid bg-[hsl(155,60%,35%)] text-white font-bold" style={{ gridTemplateColumns: "1fr 90px 56px 90px" }}>
                  <div className="px-3 py-2.5 text-base">Net Worth</div>
                  <div className="px-2 py-2.5 text-right tabular-nums text-base">{fmt(netWorth)}</div>
                  <div className="px-2 py-2.5" />
                  <div className="px-2 py-2.5" />
                </div>
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
type ActiveView = "dashboard" | "strategy" | "balancesheet" | "cashflow" | "guru";

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

  // ── Top-level cash metrics (shared across banner + panels) ──────────────────
  const _forecastData    = buildForecast(cashFlows);
  const { reserve: reserveTop, yieldBucket: yieldTop, tactical: tacticalTop, totalLiquid: totalLiquidTop } = cashBuckets(assets);
  const cashTroughTop    = computeTrough(_forecastData);
  const cashExcessTop    = totalLiquidTop - cashTroughTop;            // liquid surplus / deficit
  const isPositiveTop    = cashExcessTop >= 0;
  const minCumTop        = Math.min(..._forecastData.map(d => d.cumulative));
  const troughMonthTop   = _forecastData.find(d => d.cumulative === minCumTop)?.month ?? "";

  // GURU Optimizer "Total Cash to Invest" = A (idle acct cash) + B (liquid surplus) — mirrors G29
  const brokerageCashTop  = assets
    .filter(a => a.type === "cash" && ((a.description ?? "").toLowerCase()).includes("brokerage"))
    .reduce((s, a) => s + Number(a.value), 0);
  const totalToInvestTop  = Math.round(brokerageCashTop + Math.max(0, cashExcessTop));

  // Next month's net cash flow
  const _nextMonthDate = addMonths(new Date(), 1);
  const _nextMonthFlows = cashFlows.filter(cf => {
    const d = new Date(cf.date);
    return d.getFullYear() === _nextMonthDate.getFullYear() && d.getMonth() === _nextMonthDate.getMonth();
  });
  const nextMonthNet = _nextMonthFlows.reduce((s, c) => s + (c.type === "inflow" ? 1 : -1) * Number(c.amount), 0);

  const riskColor: Record<string, string> = {
    conservative: "bg-blue-100 text-blue-700",
    moderate: "bg-amber-100 text-amber-700",
    aggressive: "bg-rose-100 text-rose-700",
  };

  const navItems: { key: ActiveView; label: string; icon: React.ElementType }[] = [
    { key: "dashboard",    label: "Dashboard",         icon: LayoutDashboard },
    { key: "strategy",     label: "Strategy",          icon: BrainCircuit },
    { key: "balancesheet", label: "Balance Sheet",     icon: Scale },
    { key: "cashflow",     label: "Cash Flow Forecast",icon: BarChart2 },
    { key: "guru",         label: "GURU Allocation",   icon: PieChartIcon },
  ];

  const handleGenerate = () => {
    generateStrategy.mutate();
    setActiveView("strategy");
  };

  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <Link href="/">
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3" data-testid="link-back-clients">
            <ChevronLeft className="w-3.5 h-3.5" /> All Clients
          </button>
        </Link>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-client-name">{client.name}</h1>
              <Badge className={`${riskColor[client.riskTolerance] || "bg-secondary text-secondary-foreground"} capitalize text-xs font-semibold border-0`}>
                {client.riskTolerance} Risk
              </Badge>
              <Badge variant="outline" className="text-xs">Age {client.age}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {strategies.length > 0
                ? `${strategies.length} active AI recommendation${strategies.length > 1 ? "s" : ""} · Last updated today`
                : "No AI strategy generated yet"}
            </p>
          </div>

          {/* ── Always-visible AI button ─────────────────────────────────────── */}
          <Button
            onClick={handleGenerate}
            disabled={generateStrategy.isPending}
            size="lg"
            className={`gap-2 font-semibold shadow-lg transition-all ${
              generateStrategy.isPending
                ? "bg-indigo-400 text-white cursor-not-allowed"
                : strategies.length === 0
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-indigo-400/30 hover:shadow-indigo-500/40 hover:scale-[1.02]"
                  : "bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white shadow-indigo-300/30"
            }`}
            data-testid="button-generate-strategy"
          >
            {generateStrategy.isPending ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <BrainCircuit className="w-4 h-4" />
                {strategies.length === 0 ? "Run AI Analysis" : "Refresh AI Analysis"}
              </>
            )}
          </Button>
        </div>

        {/* ── Tab Navigation ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-0 mt-5 border-b border-border">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              data-testid={`nav-${key}`}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeView === key
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {key === "strategy" && strategies.length > 0 && (
                <span className="ml-1 bg-indigo-100 text-indigo-600 text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {strategies.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Dashboard View ─────────────────────────────────────────────────────── */}
      {activeView === "dashboard" && (
        <div className="space-y-4">
          {/* ── Cash Position Hero Banner ────────────────────────────────────── */}
          <div className={`rounded-xl border shadow-sm px-6 py-5 ${isPositiveTop ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200" : "bg-gradient-to-r from-rose-50 to-orange-50 border-rose-200"}`}>
            <div className="flex flex-col sm:flex-row gap-6">
              {/* LEFT: Where cash is sitting */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Cash Allocation</p>
                {[
                  { key: "reserve",  label: "Reserve",  value: reserveTop,  color: GURU_BUCKETS.reserve.color  },
                  { key: "yield",    label: "Yield",    value: yieldTop,    color: GURU_BUCKETS.yield.color    },
                  { key: "tactical", label: "Tactical", value: tacticalTop, color: GURU_BUCKETS.tactical.color },
                ].map(b => {
                  const pct = totalLiquidTop > 0 ? (b.value / totalLiquidTop) * 100 : 0;
                  return (
                    <div key={b.key} className="flex items-center gap-3 mb-2.5">
                      <span className="text-xs font-semibold w-16 flex-shrink-0" style={{ color: b.color }}>{b.label}</span>
                      <div className="flex-1 h-1.5 bg-black/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: b.color }} />
                      </div>
                      <span className="text-xs font-bold tabular-nums w-20 text-right text-foreground">{fmt(b.value, true)}</span>
                    </div>
                  );
                })}
              </div>

              {/* DIVIDER */}
              <div className={`hidden sm:block w-px self-stretch ${isPositiveTop ? "bg-emerald-200" : "bg-rose-200"}`} />

              {/* RIGHT: Cash Available headline + 3 supporting stats */}
              <div className="sm:w-72 flex-shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="rounded-lg p-1.5 bg-emerald-100">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                    Total Cash to Invest
                  </p>
                </div>
                <p className="text-4xl font-extrabold leading-tight tabular-nums mb-1 text-emerald-700" data-testid="kpi-cash-excess">
                  {fmt(totalToInvestTop)}
                </p>
                <p className="text-[10px] text-muted-foreground mb-3">GURU Optimizer · A + B</p>
                <div className={`grid grid-cols-3 gap-3 border-t pt-3 ${isPositiveTop ? "border-emerald-200" : "border-rose-200"}`}>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium leading-tight mb-0.5">A: Idle Cash</p>
                    <p className="text-sm font-bold tabular-nums text-foreground">{fmt(brokerageCashTop, true)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium leading-tight mb-0.5">B: Liquid Surplus</p>
                    <p className={`text-sm font-bold tabular-nums ${cashExcessTop >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {cashExcessTop >= 0 ? "+" : ""}{fmt(cashExcessTop, true)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium leading-tight mb-0.5">12-Mo Req'd</p>
                    <p className="text-sm font-bold tabular-nums text-foreground">{fmt(cashTroughTop, true)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <CashFlowTicker cashFlows={cashFlows} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <NetWorthPanel assets={assets} liabilities={liabilities} cashFlows={cashFlows} />
            <CashFlowForecastPanel cashFlows={cashFlows} />
            <CashManagementPanel assets={assets} cashFlows={cashFlows} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BrokeragePanel assets={assets} />
            <IncomeExpensePanel cashFlows={cashFlows} />
            <GuruOptimizerPanel assets={assets} cashFlows={cashFlows} />
          </div>

          {/* ── GURU Insights strip (shown when strategies exist) ─────────────── */}
          {strategies.length > 0 && !generateStrategy.isPending && (
            <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                    <BrainCircuit className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-indigo-900">GURU AI Insights</p>
                    <p className="text-xs text-indigo-500">{strategies.length} recommendations · Full analysis in Strategy tab</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveView("strategy")}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                >
                  View all <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {strategies.slice(0, 3).map((s, i) => (
                  <div
                    key={s.id}
                    className="bg-white/70 backdrop-blur-sm rounded-lg p-3.5 border border-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer"
                    onClick={() => setActiveView("strategy")}
                    data-testid={`insight-card-${s.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        +{fmt(Number(s.impact), true)}/yr
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-foreground leading-snug mb-1">{s.name}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{s.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AI prompt card (shown when no strategies yet) ──────────────────── */}
          {strategies.length === 0 && !generateStrategy.isPending && (
            <div
              className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
              onClick={handleGenerate}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <BrainCircuit className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">No AI analysis yet</p>
                  <p className="text-xs text-muted-foreground">Run GURU to get balance sheet strategy and cash management recommendations</p>
                </div>
              </div>
              <Button
                onClick={handleGenerate}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-0 shadow-md shadow-indigo-300/30 flex-shrink-0"
              >
                <BrainCircuit className="w-4 h-4 mr-2" /> Run AI Analysis
              </Button>
            </div>
          )}

          {generateStrategy.isPending && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-6 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm text-indigo-800">GURU is analyzing the balance sheet…</p>
                <p className="text-xs text-indigo-500">Reviewing cash flows, liquidity position, and asset allocation</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Strategy View ─────────────────────────────────────────────────────── */}
      {activeView === "strategy" && (
        <StrategyView
          strategies={strategies}
          clientId={clientId}
          isPending={generateStrategy.isPending}
          onGenerate={handleGenerate}
        />
      )}

      {/* ── Balance Sheet View ─────────────────────────────────────────────────── */}
      {activeView === "balancesheet" && (
        <DetailsView assets={assets} liabilities={liabilities} cashFlows={cashFlows} clientId={clientId} />
      )}

      {/* ── Cash Flow Forecast View ────────────────────────────────────────────── */}
      {activeView === "cashflow" && (
        <CashFlowForecastView assets={assets} cashFlows={cashFlows} />
      )}

      {/* ── GURU Asset Allocation View ─────────────────────────────────────────── */}
      {activeView === "guru" && (
        <GuruAllocationView assets={assets} cashFlows={cashFlows} />
      )}
    </Layout>
  );
}
