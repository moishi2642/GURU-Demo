import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useClientDashboard } from "@/hooks/use-clients";
import {
  AddAssetModal,
  AddLiabilityModal,
  AddCashFlowModal,
} from "@/components/financial-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  ReferenceLine,
  ReferenceDot,
  ComposedChart,
  Bar,
  BarChart,
  LabelList,
  Legend,
} from "recharts";
import {
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronDown,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Zap,
  LayoutDashboard,
  FileText,
  Database,
  ArrowUpRight,
  CalendarClock,
  BarChart2,
  PieChart as PieChartIcon,
  Scale,
  AlertCircle,
  Check,
  MessageSquare,
  RefreshCw,
  Wallet,
  SlidersHorizontal,
  Calendar,
  ArrowLeftRight,
  Repeat2,
  CreditCard,
  Home,
  Car,
  GraduationCap,
  ShieldCheck,
  Bolt,
  ChevronRight,
  Cpu,
  ClipboardList,
  Target,
  Lightbulb,
  BadgeCheck,
  Mail,
  Send,
  Copy,
  Building2,
  CheckSquare,
  Lock,
  ArrowUp,
  ArrowDown,
  Minus,
  Link2,
  Search,
  BookOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { ResponsiveSankey } from "@nivo/sankey";
import { format, addMonths, startOfMonth, subMonths } from "date-fns";
import type { Asset, Liability, CashFlow, Strategy } from "@shared/schema";

// ─── Count-up animation ───────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1600) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    startRef.current = null;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(target * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return current;
}

function RollingNumber({
  value,
  format = "currency",
  prefix = "",
}: {
  value: number;
  format?: "currency" | "percent" | "raw";
  prefix?: string;
}) {
  const v = useCountUp(value);
  let formatted: string;
  if (format === "percent") formatted = `${v.toFixed(1)}%`;
  else if (format === "raw") formatted = `${prefix}${Math.round(v)}`;
  else
    formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(v);
  return (
    <span className="font-mono font-bold tracking-tight text-emerald-800 inline-flex items-center">
      {formatted}
      <span className="animate-blink ml-px text-[10px] opacity-25">.</span>
    </span>
  );
}

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
  salary: "Salary",
  investments: "Investment Income",
  housing: "Housing",
  living_expenses: "Living",
  taxes: "Taxes",
  education: "Education",
  travel: "Travel",
  lifestyle: "Lifestyle",
  bonus: "Bonus",
  other: "Other",
};

// Only show meaningful, non-recurring events in the live feed
const CHUNKY_ALWAYS = new Set([
  "taxes",
  "education",
  "bonus",
  "travel",
  "lifestyle",
]);
function isChunkyEvent(cf: CashFlow): boolean {
  if (CHUNKY_ALWAYS.has(cf.category)) return true;
  // Capital calls, large investment events (not routine dividend/rental income)
  if (cf.category === "investments" && Number(cf.amount) >= 5_000) return true;
  return false;
}

function CashFlowTicker({ cashFlows }: { cashFlows: CashFlow[] }) {
  const now = DEMO_NOW;
  const horizon = addMonths(now, 12);

  const all12 = cashFlows.filter((cf) => {
    const d = new Date(cf.date);
    return d >= now && d <= horizon;
  });

  const items = all12
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((cf) => ({
      date: format(new Date(cf.date), "MMM d"),
      label: cf.description.split("(")[0].split("—")[0].split("–")[0].trim(),
      amount: Number(cf.amount),
      type: cf.type as "inflow" | "outflow",
      category: cf.category,
    }));

  if (items.length === 0) return null;

  // Footer totals always reflect ALL 12-month flows, not just visible rows
  const totalIn = all12
    .filter((c) => c.type === "inflow")
    .reduce((s, c) => s + Number(c.amount), 0);
  const totalOut = all12
    .filter((c) => c.type === "outflow")
    .reduce((s, c) => s + Number(c.amount), 0);
  const net = totalIn - totalOut;
  const rowH = 32; // px per row
  const visRows = 8;
  const duration = Math.max(20, items.length * 2.2); // seconds

  const fmtAmt = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(v);

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
          <span className="text-[11px] font-bold text-white/70 uppercase tracking-widest">
            Cashflow Forecast
          </span>
        </div>
        <span className="text-[10px] text-white/30 font-medium">
          Next 12 months · {items.length} events · hover to pause
        </span>
      </div>

      {/* Column headers */}
      <div
        className="grid text-[10px] font-bold uppercase tracking-widest text-white/30 border-b border-white/5 px-4 py-1.5"
        style={{ gridTemplateColumns: "68px 110px 1fr 90px" }}
      >
        <span>Date</span>
        <span>Category</span>
        <span>Description</span>
        <span className="text-right">Amount</span>
      </div>

      {/* Scrolling rows */}
      <div className="overflow-hidden" style={{ height: rowH * visRows }}>
        <div
          className="animate-feed"
          style={{ animationDuration: `${duration}s` }}
        >
          {[...items, ...items].map((item, i) => {
            const isIn = item.type === "inflow";
            const cat = CATEGORY_LABELS[item.category] ?? item.category;
            return (
              <div
                key={i}
                className={`grid items-center px-4 border-b border-white/5 text-xs ${isIn ? "hover:bg-emerald-950/40" : "hover:bg-rose-950/40"} transition-colors`}
                style={{
                  height: rowH,
                  gridTemplateColumns: "68px 110px 1fr 90px",
                }}
              >
                <span className="text-white/40 font-medium tabular-nums">
                  {item.date}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit ${isIn ? "bg-emerald-900/50 text-emerald-400" : "bg-rose-900/40 text-rose-400"}`}
                >
                  {isIn ? "▲" : "▼"} {cat}
                </span>
                <span className="text-white/70 truncate pr-4">
                  {item.label}
                </span>
                <span
                  className={`font-bold tabular-nums text-right ${isIn ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {isIn ? "+" : "−"}
                  {fmtAmt(item.amount)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary footer */}
      <div className="grid grid-cols-3 divide-x divide-white/8 border-t border-white/10 text-xs">
        <div className="px-4 py-2.5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-0.5">
            12-Mo Inflows
          </p>
          <p className="font-bold text-emerald-400 tabular-nums">
            +{fmtAmt(totalIn)}
          </p>
        </div>
        <div className="px-4 py-2.5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-0.5">
            12-Mo Outflows
          </p>
          <p className="font-bold text-rose-400 tabular-nums">
            −{fmtAmt(totalOut)}
          </p>
        </div>
        <div className="px-4 py-2.5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-0.5">
            12-Mo Net
          </p>
          <p
            className={`font-bold tabular-nums ${net >= 0 ? "text-emerald-400" : "text-rose-400"}`}
          >
            {net >= 0 ? "+" : "−"}
            {fmtAmt(Math.abs(net))}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Demo date: simulate "today = March 6, 2026" ──────────────────────────────
const DEMO_NOW = new Date(2026, 2, 6); // March 6, 2026

const HERO_COLORS: Record<string, { bg: string; accent: string; dot: string }> = {
  "Operating Cash": { bg: "#1d4ed8", accent: "#93c5fd", dot: "#60a5fa" },
  Reserve:          { bg: "#d97706", accent: "#fde68a", dot: "#fbbf24" },
  Build:            { bg: "#16a34a", accent: "#86efac", dot: "#4ade80" },
  Grow:             { bg: "#5b21b6", accent: "#c084fc", dot: "#c084fc" },
  "Real Estate":        { bg: "#6b7280", accent: "#d1d5db", dot: "#d1d5db" },
  "Alternative Assets": { bg: "#6b7280", accent: "#d1d5db", dot: "#d1d5db" },
  "529 Plans":          { bg: "#6b7280", accent: "#d1d5db", dot: "#d1d5db" },
};

// ─── Book of Business — flag metadata & client data ───────────────────────────
type FlagKey = "excess_cash" | "cash_deficit" | "product_needed" | "follow_up" | "autobill_approval" | "money_movement";
const FLAG_META: Record<FlagKey, { label: string; short: string; color: string; bg: string; text: string; border: string }> = {
  excess_cash:       { label: "Excess Cash",      short: "Excess Cash",  color: "#f59e0b", bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
  cash_deficit:      { label: "Cash Deficit",      short: "Deficit",      color: "#ef4444", bg: "bg-rose-50",   text: "text-rose-700",   border: "border-rose-200" },
  product_needed:    { label: "Product Selection", short: "Product",      color: "#3b82f6", bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  follow_up:         { label: "Follow Up",         short: "Follow Up",    color: "#8b5cf6", bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  autobill_approval: { label: "Autobill Approval", short: "Autobill",     color: "#ec4899", bg: "bg-pink-50",   text: "text-pink-700",   border: "border-pink-200" },
  money_movement:    { label: "Money Movement",    short: "Movement",     color: "#06b6d4", bg: "bg-cyan-50",   text: "text-cyan-700",   border: "border-cyan-200" },
};
interface BobClient { id: number; name: string; initials: string; aum: number; totalAssets: number; liquidCash: number; cashPct: number; flags: FlagKey[]; advisor: string; lastContact: string; }
const BOB_CLIENTS: BobClient[] = (() => {
  const LN = ["Adams","Allen","Anderson","Baker","Barnes","Bell","Bennett","Brooks","Brown","Campbell","Carter","Clark","Collins","Cook","Cooper","Cox","Davis","Evans","Fisher","Foster","Garcia","Gonzalez","Gray","Green","Hall","Harris","Harrison","Hayes","Hill","Howard","Hughes","Jackson","James","Jenkins","Johnson","Jones","Kelly","King","Lee","Lewis","Long","Martin","Martinez","Mason","Miller","Mitchell","Moore","Morgan","Morris","Murphy","Nelson","Parker","Patterson","Perry","Peterson","Phillips","Powell","Price","Reed","Richardson","Rivera","Roberts","Robinson","Rogers","Ross","Russell","Sanders","Scott","Shaw","Simpson","Smith","Stewart","Sullivan","Taylor","Thomas","Thompson","Torres","Turner","Walker","Ward","Watson","White","Williams","Wilson","Wood","Wright","Young"];
  const FN = ["James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda","William","Barbara","David","Susan","Richard","Jessica","Joseph","Karen","Charles","Sarah","Thomas","Lisa","Daniel","Nancy","Anthony","Betty","Donald","Margaret","Mark","Sandra","Paul","Ashley","Steven","Dorothy","Andrew","Kimberly","Kenneth","Emily","Joshua","Donna","Kevin","Michelle"];
  const ADV = ["Sarah Chen","Marcus Webb","Priya Patel","James Harlow","Emma Laurent"];
  const FS: FlagKey[][] = [["excess_cash"],["excess_cash","product_needed"],["cash_deficit"],["cash_deficit","follow_up"],["product_needed"],["product_needed","follow_up"],["follow_up"],["autobill_approval"],["autobill_approval","money_movement"],["money_movement"],["money_movement","excess_cash"],[],[],["excess_cash","autobill_approval"],["cash_deficit","money_movement"],["follow_up","autobill_approval"]];
  const AUML = [750_000,1_500_000,3_200_000,7_800_000,14_500_000,28_000_000,42_000_000];
  const CTACT = ["Today","Yesterday","2d ago","1 wk ago","2 wk ago","1 mo ago","3 mo ago"];
  return Array.from({length:100},(_,i)=>{
    const flags = FS[i % FS.length];
    const aum = Math.round(AUML[i % AUML.length] * (1 + (i * 0.17) % 0.85));
    const totalAssets = Math.round(aum * (1.18 + (i * 0.041) % 0.32));
    const cpct = flags.includes("excess_cash") ? 12+(i%18) : flags.includes("cash_deficit") ? 0.4+(i%2)*0.8 : 2.5+(i%7);
    return { id:i+1, name:`${LN[i%LN.length]}, ${FN[i%FN.length]}`, initials:`${FN[i%FN.length][0]}${LN[i%LN.length][0]}`, aum, totalAssets, liquidCash:Math.round(aum*cpct/100), cashPct:Math.round(cpct*10)/10, flags, advisor:ADV[i%ADV.length], lastContact:CTACT[i%CTACT.length] };
  });
})();

// ─── Formatting Helpers ────────────────────────────────────────────────────────
const fmt = (v: number, compact = false) => {
  if (compact && Math.abs(v) >= 1_000_000)
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
};
const fmtK = (v: number) => {
  if (Math.abs(v) >= 1000)
    return `${v < 0 ? "-" : ""}$${(Math.abs(v) / 1000).toFixed(0)}k`;
  return fmt(v);
};

const PANEL_CLS =
  "border border-border/60 shadow-sm bg-card rounded-xl overflow-hidden";

// ─── Color constants ───────────────────────────────────────────────────────────
const GREEN = "hsl(142, 71%, 40%)";
const RED = "hsl(0, 78%, 55%)";
const BLUE = "hsl(221, 83%, 53%)";

// ─── GURU Method: 5 Strategic Bucket Definitions ─────────────────────────────
const GURU_BUCKETS = {
  reserve: {
    label: "Operating Cash",
    short: "Checking — instantly available transaction accounts",
    color: "#60a5fa",
    tagCls: "bg-blue-100 text-blue-600",
  },
  yield: {
    label: "Reserve",
    short: "Savings & money market — penalty-free, higher-yielding",
    color: "#fbbf24",
    tagCls: "bg-amber-100 text-amber-600",
  },
  tactical: {
    label: "Build",
    short: "Treasuries & fixed income — 1–3 year horizon",
    color: "#4ade80",
    tagCls: "bg-green-100 text-green-600",
  },
  growth: {
    label: "Grow",
    short: "Long-horizon investments — equities, compounding wealth",
    color: "#c084fc",
    tagCls: "bg-purple-100 text-purple-600",
  },
  alternatives: {
    label: "Alternatives",
    short: "Real estate, private equity, RSUs — strategic illiquid assets",
    color: "#94a3b8",
    tagCls: "bg-slate-100 text-slate-600",
  },
} as const;
type GuroBucket = keyof typeof GURU_BUCKETS;

// ─── Computations ─────────────────────────────────────────────────────────────
function buildMonthMap(cashFlows: CashFlow[]) {
  const map: Record<string, { inflow: number; outflow: number }> = {};
  for (const cf of cashFlows) {
    const d = new Date(cf.date);
    const key = format(new Date(d.getUTCFullYear(), d.getUTCMonth(), 1), "MMM yy");
    if (!map[key]) map[key] = { inflow: 0, outflow: 0 };
    if (cf.type === "inflow") map[key].inflow += Number(cf.amount);
    else map[key].outflow += Number(cf.amount);
  }
  return map;
}

function buildForecast(cashFlows: CashFlow[]) {
  const map = buildMonthMap(cashFlows);
  const now = new Date(new Date().getFullYear(), 0, 1);
  let cumulative = 0;
  return Array.from({ length: 12 }, (_, i) => {
    const month = addMonths(now, i);
    const key = format(month, "MMM yy");
    const d = map[key] || { inflow: 0, outflow: 0 };
    const net = d.inflow - d.outflow;
    cumulative += net;
    return {
      month: format(month, "MMM"),
      inflow: d.inflow,
      outflow: d.outflow,
      net,
      cumulative,
    };
  });
}

function buildNWTimeline(
  netWorth: number,
  cashFlows: CashFlow[],
  assets: Asset[],
) {
  const annualSurplus = buildForecast(cashFlows).reduce((s, d) => s + d.net, 0);
  const growthValue = assets
    .filter((a) => ["equity", "alternative", "real_estate"].includes(a.type))
    .reduce((s, a) => s + Number(a.value), 0);
  const GROWTH_RATE = 0.065;

  // Historical: realistic multipliers going back 5 years.
  // 2022 was the dip year (S&P -18%, bonds worst year in decades).
  const histMultipliers = [
    { label: "2021", m: 0.66 },
    { label: "2022", m: 0.55 }, // dip — S&P −18%, rates spiked
    { label: "2023", m: 0.73 }, // recovery begins
    { label: "2024", m: 0.86 }, // S&P +26%
    { label: "2025", m: 0.93 },
  ];

  const histPoints = histMultipliers.map(({ label, m }) => ({
    label,
    histValue: Math.round(netWorth * m),
    projValue: undefined as number | undefined,
  }));

  // "Now" bridges both series
  const nowPoint = {
    label: "Now",
    histValue: netWorth,
    projValue: netWorth,
  };

  // Forward projections (1Y–5Y)
  const projPoints = Array.from({ length: 5 }, (_, i) => {
    const yr = i + 1;
    const assetGrowth = growthValue * (Math.pow(1 + GROWTH_RATE, yr) - 1);
    const cashAccum = annualSurplus * yr;
    return {
      label: `${yr}Y`,
      histValue: undefined as number | undefined,
      projValue: Math.round(netWorth + assetGrowth + cashAccum),
    };
  });

  return [...histPoints, nowPoint, ...projPoints];
}

// Keep old name as alias so callers of projYear5 still work
function buildNWProjection(
  netWorth: number,
  cashFlows: CashFlow[],
  assets: Asset[],
) {
  const annualSurplus = buildForecast(cashFlows).reduce((s, d) => s + d.net, 0);
  const growthValue = assets
    .filter((a) => ["equity", "alternative", "real_estate"].includes(a.type))
    .reduce((s, a) => s + Number(a.value), 0);
  const GROWTH_RATE = 0.065;
  const now = DEMO_NOW;
  return Array.from({ length: 6 }, (_, i) => {
    const assetGrowth = growthValue * (Math.pow(1 + GROWTH_RATE, i) - 1);
    const cashAccum = annualSurplus * i;
    return {
      label: i === 0 ? "Now" : `${i}Y`,
      year: format(addMonths(now, i * 12), "yyyy"),
      value: Math.round(netWorth + assetGrowth + cashAccum),
    };
  });
}

function cashBuckets(assets: Asset[]) {
  let reserve = 0,
    yieldBucket = 0,
    tactical = 0,
    growth = 0,
    alts = 0;
  const reserveItems: { label: string; value: number }[] = [];
  const yieldItems: { label: string; value: number }[] = [];
  const tacticalItems: { label: string; value: number }[] = [];
  const growthItems: { label: string; value: number }[] = [];
  const altItems: { label: string; value: number }[] = [];

  for (const a of assets) {
    const desc = (a.description ?? "").toLowerCase();
    const val = Number(a.value);
    const lbl = (a.description ?? "")
      .split("(")[0]
      .split("—")[0]
      .split("–")[0]
      .trim();
    if (a.type === "cash") {
      if (desc.includes("checking")) {
        reserve += val;
        reserveItems.push({ label: lbl, value: val });
      } else if (desc.includes("brokerage")) {
        growth += val;
        growthItems.push({ label: lbl, value: val });
      } else {
        yieldBucket += val;
        yieldItems.push({ label: lbl, value: val });
      }
    } else if (a.type === "fixed_income") {
      if (
        desc.includes("treasur") ||
        desc.includes("t-bill") ||
        desc.includes("short")
      ) {
        tactical += val;
        tacticalItems.push({ label: lbl, value: val });
      } else {
        growth += val;
        growthItems.push({ label: lbl, value: val });
      }
    } else if (a.type === "equity") {
      if (
        desc.includes("rsu") ||
        desc.includes("unvested") ||
        desc.includes("carry")
      ) {
        alts += val;
        altItems.push({ label: lbl, value: val });
      } else {
        growth += val;
        growthItems.push({ label: lbl, value: val });
      }
    } else if (a.type === "alternative") {
      alts += val;
      altItems.push({ label: lbl, value: val });
    } else if (a.type === "real_estate") {
      alts += val;
      altItems.push({ label: lbl, value: val });
    }
  }

  const totalLiquid = reserve + yieldBucket + tactical;
  // Backward-compat aliases
  return {
    reserve,
    yieldBucket,
    tactical,
    growth,
    alts,
    totalLiquid,
    reserveItems,
    yieldItems,
    tacticalItems,
    growthItems,
    altItems,
    // legacy aliases
    immediate: reserve,
    shortTerm: yieldBucket,
    mediumTerm: tactical,
    immediateItems: reserveItems,
    shortItems: yieldItems,
    mediumItems: tacticalItems,
  };
}

function computeTrough(forecastData: ReturnType<typeof buildForecast>) {
  const min = Math.min(...forecastData.map((d) => d.cumulative));
  return min < 0 ? Math.abs(min) : 0;
}

// ─── Panel 1: Net Worth ────────────────────────────────────────────────────────
// Liquidity score: lower = more liquid. Maps to GURU 5-bucket system.
function liquidityScore(a: Asset): number {
  const desc = (a.description ?? "").toLowerCase();
  if (a.type === "cash") return desc.includes("checking") ? 1 : 2;
  if (a.type === "fixed_income")
    return desc.includes("treasur") ||
      desc.includes("t-bill") ||
      desc.includes("short")
      ? 3
      : 4;
  if (a.type === "equity") {
    if (desc.includes("401") || desc.includes("ira") || desc.includes("roth"))
      return 4;
    if (
      desc.includes("rsu") ||
      desc.includes("unvested") ||
      desc.includes("carry")
    )
      return 5;
    return 4;
  }
  if (a.type === "alternative") return 5;
  if (a.type === "real_estate") return 5;
  return 4;
}

function liquidityTag(a: Asset): { label: string; tagCls: string } {
  const score = liquidityScore(a);
  const desc = (a.description ?? "").toLowerCase();
  if (score === 1) return GURU_BUCKETS.reserve;
  if (score === 2) return GURU_BUCKETS.yield;
  if (score === 3) return GURU_BUCKETS.tactical;
  // score 4 = growth; score 5 = alternatives
  if (
    a.type === "equity" &&
    !desc.includes("rsu") &&
    !desc.includes("unvested") &&
    !desc.includes("carry")
  )
    return GURU_BUCKETS.growth;
  if (a.type === "fixed_income") return GURU_BUCKETS.growth;
  return GURU_BUCKETS.alternatives;
}

function NetWorthPanel({
  assets,
  liabilities,
  cashFlows,
}: {
  assets: Asset[];
  liabilities: Liability[];
  cashFlows: CashFlow[];
}) {
  const [view, setView] = useState<"assets" | "liabilities">("assets");
  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalLiab = liabilities.reduce((s, l) => s + Number(l.value), 0);
  const netWorth = totalAssets - totalLiab;
  const projData = buildNWProjection(netWorth, cashFlows, assets);
  const projYear5 = projData[projData.length - 1].value;
  const timelineData = buildNWTimeline(netWorth, cashFlows, assets);
  // Assets sorted by liquidity (most liquid first)
  const sortedAssets = [...assets].sort(
    (a, b) => liquidityScore(a) - liquidityScore(b),
  );

  // Liability rollup sorted by value
  const liabGroups: Record<string, number> = {};
  for (const l of liabilities) {
    const label = l.description.split("(")[0].split("—")[0].trim();
    liabGroups[label] = (liabGroups[label] || 0) + Number(l.value);
  }

  return (
    <div className={PANEL_CLS}>
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-border/60">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Net Worth</p>
            <p className="text-3xl font-extrabold tabular-nums text-foreground leading-tight mt-0.5" data-testid="kpi-net-worth">{fmt(netWorth)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total assets minus liabilities · Today</p>
          </div>
          <div className="text-right flex-shrink-0 mt-0.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">5yr Projection</p>
            <p className="text-lg font-extrabold tabular-nums text-emerald-600">{fmt(projYear5)}</p>
          </div>
        </div>
      </div>
      <div className="h-36 px-1 mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={timelineData}
            margin={{ top: 6, right: 4, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="nwGradHist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                <stop offset="95%" stopColor={BLUE} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="nwGradProj" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BLUE} stopOpacity={0.10} />
                <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            {/* Historical line — solid */}
            <Area
              type="monotone"
              dataKey="histValue"
              stroke={BLUE}
              strokeWidth={2}
              fill="url(#nwGradHist)"
              connectNulls
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.label === "Now")
                  return (
                    <g key="nw-now">
                      <circle cx={cx} cy={cy} r={10} fill={BLUE} opacity={0.12}
                        style={{ animation: "live-pulse 2s ease-in-out infinite", transformOrigin: `${cx}px ${cy}px` }}
                      />
                      <circle cx={cx} cy={cy} r={3.5} fill={BLUE} stroke="white" strokeWidth={1.5} />
                    </g>
                  );
                return <g key={payload.label} />;
              }}
              activeDot={{ r: 5, stroke: "white", strokeWidth: 2 }}
            />
            {/* Projection line — dashed, lighter */}
            <Area
              type="monotone"
              dataKey="projValue"
              stroke={BLUE}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              strokeOpacity={0.55}
              fill="url(#nwGradProj)"
              connectNulls
              dot={(props: any) => {
                const { cx, cy, index } = props;
                if (index === timelineData.length - 1)
                  return <circle key="nw-end" cx={cx} cy={cy} r={3} fill={BLUE} stroke="white" strokeWidth={1.5} />;
                return <g key={index} />;
              }}
              activeDot={{ r: 5, stroke: "white", strokeWidth: 2 }}
            />
            <ReferenceLine
              x="Now"
              stroke={BLUE}
              strokeDasharray="3 3"
              strokeOpacity={0.35}
              label={{ value: "Today", position: "insideTopRight", fontSize: 8, fill: BLUE, opacity: 0.6 }}
            />
            <RechartsTooltip
              formatter={(v: number, name: string) => [fmt(v), name === "histValue" ? "Net Worth" : "Projected"]}
              contentStyle={{ fontSize: 11 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="px-4 pb-4">
        <div className="flex border border-border rounded-md overflow-hidden mb-2 text-xs font-semibold">
          <button
            className={`flex-1 py-1 transition-colors ${view === "assets" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
            onClick={() => setView("assets")}
            data-testid="toggle-assets"
          >
            Assets
          </button>
          <button
            className={`flex-1 py-1 transition-colors ${view === "liabilities" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
            onClick={() => setView("liabilities")}
            data-testid="toggle-liabilities"
          >
            Liabilities
          </button>
        </div>
        <div className="space-y-0.5 max-h-36 overflow-y-auto">
          {view === "assets" ? (
            sortedAssets.slice(0, 9).map((a) => {
              const tag = liquidityTag(a);
              const label = a.description.split("(")[0].split("—")[0].trim();
              return (
                <div key={a.id} className="flex justify-between items-center text-xs py-1 gap-1">
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0 ${tag.tagCls}`}>
                    {tag.label}
                  </span>
                  <span className="text-muted-foreground truncate flex-1" title={label}>{label}</span>
                  <span className="font-semibold tabular-nums flex-shrink-0">{fmt(Number(a.value))}</span>
                </div>
              );
            })
          ) : (
            Object.entries(liabGroups)
              .sort((a, b) => b[1] - a[1])
              .map(([label, value]) => (
                <div key={label} className="flex justify-between items-center text-xs py-1">
                  <span className="text-muted-foreground truncate pr-2" style={{ maxWidth: "65%" }}>{label}</span>
                  <span className="font-semibold tabular-nums text-rose-600">-{fmt(value)}</span>
                </div>
              ))
          )}
        </div>
        {/* ── Sticky total — always visible below scroll ── */}
        <div className="mt-1 pt-1.5 border-t border-border flex justify-between items-center text-xs font-bold bg-muted/40 rounded-sm px-1.5 py-1">
          {view === "assets" ? (
            <>
              <span>Total Assets</span>
              <span>{fmt(totalAssets)}</span>
            </>
          ) : (
            <>
              <span>Total Liabilities</span>
              <span className="text-rose-600">-{fmt(totalLiab)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Panel 2: Projected Cumulative Cash Flow ──────────────────────────────────
function CashFlowForecastPanel({ cashFlows, onNavigateToCashflow }: { cashFlows: CashFlow[]; onNavigateToCashflow?: () => void }) {
  const data = buildForecast(cashFlows);
  const annualNet = data.reduce((s, d) => s + d.net, 0);
  const minVal = Math.min(...data.map((d) => d.cumulative));
  const maxVal = Math.max(...data.map((d) => d.cumulative));
  const troughIdx = data.findIndex((d) => d.cumulative === minVal);
  const troughMonth = data[troughIdx]?.month ?? "";
  const hasTrough = minVal < 0;
  const range = maxVal - minVal || 1;
  const zeroOffset = `${Math.max(0, Math.min(100, (maxVal / range) * 100)).toFixed(1)}%`;
  const finalVal = data[data.length - 1]?.cumulative ?? 0;
  const pad = range * 0.12;
  const yDomainMin = Math.floor(minVal - pad);
  const yDomainMax = Math.min(Math.ceil(maxVal + pad), 150000);
  const isPositive = annualNet >= 0;

  return (
    <div className={PANEL_CLS}>
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-border/60">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">12 Month Cumulative Cash Flow Forecast</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isPositive ? <TrendingUp className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <TrendingDown className="w-4 h-4 text-rose-500 flex-shrink-0" />}
              <p className={`text-3xl font-extrabold tabular-nums leading-tight ${isPositive ? "text-emerald-600" : "text-rose-600"}`} data-testid="kpi-annual-net">
                {isPositive ? "+" : ""}{fmt(annualNet, true)}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{isPositive ? "Net surplus over 12 months" : "Net deficit over 12 months"}</p>
          </div>
        </div>
      </div>
      {/* ── Chart 2: Cumulative area chart ── */}
      <div className="px-3 pb-2">
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 52, right: 52, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cfGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={zeroOffset} stopColor={GREEN} stopOpacity={0.30} />
                  <stop offset={zeroOffset} stopColor={RED} stopOpacity={0.22} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtK}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
                domain={[-150000, 150000]}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
              {hasTrough && (
                <ReferenceLine
                  x={troughMonth}
                  stroke="hsl(0,72%,65%)"
                  strokeDasharray="5 3"
                  strokeWidth={2}
                  label={(props: any) => {
                    const vb = props?.viewBox;
                    if (!vb) return null;
                    const { x, y } = vb;
                    return (
                      <g>
                        <rect x={x - 46} y={y - 48} width={92} height={40} rx={5} fill="hsl(0,80%,97%)" stroke="hsl(0,72%,65%)" strokeWidth={1.5} />
                        <text x={x} y={y - 32} textAnchor="middle" fill="hsl(0,72%,45%)" fontSize={11} fontWeight="800" letterSpacing="1">TROUGH</text>
                        <text x={x} y={y - 16} textAnchor="middle" fill="hsl(0,72%,40%)" fontSize={13} fontWeight="900">{fmt(minVal, true)}</text>
                        <polygon points={`${x - 6},${y - 8} ${x + 6},${y - 8} ${x},${y}`} fill="hsl(0,72%,65%)" />
                      </g>
                    );
                  }}
                />
              )}
              <RechartsTooltip
                formatter={(v: number) => [fmt(v), "Cumulative Net"]}
                contentStyle={{ fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={isPositive ? GREEN : RED}
                strokeWidth={2.5}
                fill="url(#cfGrad2)"
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
                        <circle cx={cx} cy={cy} r={10} fill={liveCol} opacity={0.12} style={{ animation: "live-pulse 2s ease-in-out infinite", transformOrigin: `${cx}px ${cy}px` }} />
                        <circle cx={cx} cy={cy} r={4} fill={liveCol} stroke="white" strokeWidth={1.5} />
                        <text x={cx} y={cy - 12} textAnchor="middle" fill={liveCol} fontSize={10} fontWeight="800">NOW</text>
                      </g>
                    );
                  }
                  if (index === data.length - 1) {
                    const col = isPositive ? "hsl(142,71%,35%)" : "hsl(0,72%,50%)";
                    return (
                      <g key="end-dot">
                        <circle cx={cx} cy={cy} r={4.5} fill={isPositive ? GREEN : RED} stroke="white" strokeWidth={2} />
                        <text x={cx + 8} y={cy + 4} fill={col} fontSize={11} fontWeight="800">
                          {isPositive ? "▲" : "▼"} {fmtK(finalVal)}
                        </text>
                      </g>
                    );
                  }
                  return <g key={index} />;
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Panel 3: GURU Method — Cash Management ───────────────────────────────────
const GURU_BUCKET_ORDER: GuroBucket[] = [
  "reserve",
  "yield",
  "tactical",
  "growth",
  "alternatives",
];

function CashManagementPanel({
  assets,
  cashFlows,
}: {
  assets: Asset[];
  cashFlows: CashFlow[];
}) {
  const { reserve, yieldBucket, tactical, totalLiquid, reserveItems, yieldItems, tacticalItems } = cashBuckets(assets);
  const forecastData = buildForecast(cashFlows);
  const annualOutflows = forecastData.reduce((s, d) => s + d.outflow, 0);
  const monthlyBurn = annualOutflows / 12;
  const monthsRunway = monthlyBurn > 0 ? totalLiquid / monthlyBurn : 0;
  const endCumulative = forecastData[forecastData.length - 1]?.cumulative ?? 0;
  const trendUp = endCumulative >= 0;
  const coveragePct = monthlyBurn > 0 ? (totalLiquid / (annualOutflows)) * 100 : 999;
  const coverageOk = coveragePct >= 100;
  const [liqLive, setLiqLive] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLiqLive(true), 350); return () => clearTimeout(t); }, []);

  return (
    <div className={PANEL_CLS + " flex flex-col"}>

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-border/60">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Liquidity Position</p>
            <p className="text-3xl font-extrabold tabular-nums text-foreground leading-tight mt-0.5">{fmt(totalLiquid)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total liquid position</p>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 mt-1 ${trendUp ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"}`}>
            {trendUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {trendUp ? "Building" : "Depleting"}
          </div>
        </div>
      </div>

      {/* ── 3 KPI tiles ── */}
      <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60">
        {/* Months Runway */}
        <div className="px-3 py-3 flex flex-col gap-0.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Cash Runway</p>
          <p className={`text-2xl font-extrabold tabular-nums leading-none ${monthsRunway >= 12 ? "text-emerald-600" : monthsRunway >= 6 ? "text-amber-600" : "text-rose-600"}`}>
            {monthsRunway.toFixed(1)}
          </p>
          <p className="text-[9px] text-muted-foreground">months of expenses</p>
        </div>
        {/* Monthly Burn */}
        <div className="px-3 py-3 flex flex-col gap-0.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Monthly Burn</p>
          <p className="text-2xl font-extrabold tabular-nums leading-none text-foreground">
            {fmt(monthlyBurn, true)}
          </p>
          <p className="text-[9px] text-muted-foreground">avg outflows / mo</p>
        </div>
        {/* Annual Coverage */}
        <div className="px-3 py-3 flex flex-col gap-0.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Coverage</p>
          <p className={`text-2xl font-extrabold tabular-nums leading-none ${coverageOk ? "text-emerald-600" : "text-rose-600"}`}>
            {coveragePct > 999 ? "—" : `${coveragePct.toFixed(0)}%`}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            {coverageOk
              ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />
              : <AlertTriangle className="w-2.5 h-2.5 text-rose-500 flex-shrink-0" />}
            <p className="text-[9px] text-muted-foreground">{coverageOk ? "fully funded" : "shortfall risk"}</p>
          </div>
        </div>
      </div>

      {/* ── Bucket tables ── */}
      <div className="px-4 py-4">
        <style>{`@keyframes liqWv{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}.liq-wv{animation:liqWv 2.2s linear infinite;}`}</style>
        {(() => {
          const buckets = [
            { label: "Operating Cash", value: reserve,     items: reserveItems  ?? [], color: "#1d4ed8", border: "border-blue-200",    rowBg: "bg-blue-50/60",    rowBorder: "border-blue-100",    textCls: "text-blue-900",    amtCls: "text-blue-700"    },
            { label: "Reserve",        value: yieldBucket, items: yieldItems    ?? [], color: "#d97706", border: "border-amber-200",   rowBg: "bg-amber-50/60",   rowBorder: "border-amber-100",   textCls: "text-amber-900",   amtCls: "text-amber-700"   },
            { label: "Build",          value: tactical,    items: tacticalItems ?? [], color: "#16a34a", border: "border-emerald-200", rowBg: "bg-emerald-50/60", rowBorder: "border-emerald-100", textCls: "text-emerald-900", amtCls: "text-emerald-700" },
          ];
          return (
            <div className="flex items-start gap-3">
              {buckets.map((b) => {
                const pct = totalLiquid > 0 ? Math.round((b.value / totalLiquid) * 100) : 0;
                const fillH = liqLive ? pct : 0;
                return (
                  <div key={b.label} className="flex-1 min-w-0">
                    {/* ── Mini water tank ── */}
                    <div style={{ width: '100%', height: 96, borderRadius: '8px 8px 0 0', border: `1.5px solid ${b.color}40`, borderBottom: 'none', background: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
                      {/* Fill */}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${fillH}%`, background: `${b.color}22`, transition: 'height 2.6s cubic-bezier(0.4,0,0.2,1)' }}>
                        {/* Wave */}
                        <svg className="liq-wv" style={{ position: 'absolute', top: -5, left: 0, width: '200%', height: 10 }} viewBox="0 0 200 10" preserveAspectRatio="none">
                          <path d="M0,5 C25,0 25,10 50,5 C75,0 75,10 100,5 C125,0 125,10 150,5 C175,0 175,10 200,5" stroke={b.color} strokeWidth="1.5" fill="none" opacity="0.7" />
                        </svg>
                      </div>
                      {/* Centered pct label */}
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: b.color, textShadow: '0 0 8px white, 0 0 8px white', lineHeight: 1 }}>{fmt(b.value, true)}</span>
                      </div>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between" style={{ background: b.color }}>
                      <span className="text-[9px] font-black uppercase tracking-widest text-white truncate">{b.label}</span>
                    </div>
                    <div className={`border border-t-0 ${b.border} rounded-b-lg overflow-hidden`}>
                      {b.items.map((item, i) => (
                        <div key={i} className={`flex items-center justify-between px-3 py-1.5 ${b.rowBg} border-b ${b.rowBorder} last:border-0`}>
                          <span className={`text-[10px] ${b.textCls} truncate pr-1 leading-tight`}>{item.label}</span>
                          <span className={`text-[10px] font-semibold tabular-nums flex-shrink-0 ${b.amtCls}`}>{fmt(item.value, true)}</span>
                        </div>
                      ))}
                      {b.items.length === 0 && (
                        <div className={`px-3 py-2 ${b.rowBg}`}>
                          <span className="text-[9px] text-muted-foreground italic">No accounts mapped</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

    </div>
  );
}

// ─── Panel 4: Brokerage + Retirement ─────────────────────────────────────────
function BrokeragePanel({ assets }: { assets: Asset[] }) {
  const { data: quotes } = useMarketQuotes();
  const gsQuote = quotes?.find((q) => q.symbol === "GS");
  const spyQuote = quotes?.find((q) => q.symbol === "SPY");

  const brokerageTypes = ["equity", "fixed_income", "alternative"];
  const brokerageAssets = assets.filter(
    (a) =>
      brokerageTypes.includes(a.type) &&
      !(a.description ?? "").toLowerCase().includes("carry") &&
      !(a.description ?? "").toLowerCase().includes("rsu"),
  );
  const retirementAssets = assets.filter(
    (a) =>
      (a.description ?? "").toLowerCase().includes("401") ||
      (a.description ?? "").toLowerCase().includes("ira") ||
      (a.description ?? "").toLowerCase().includes("roth"),
  );
  const totalBrok = brokerageAssets.reduce((s, a) => s + Number(a.value), 0);
  const totalRet = retirementAssets.reduce((s, a) => s + Number(a.value), 0);
  const total = totalBrok + totalRet;

  // ── Concentric donut: exact labels & % from Figma spec ──
  const PORT_CATS = [
    { name: "Cash",          color: "#1e3a5f" },
    { name: "International", color: "#f97316" },
    { name: "US",            color: "#38bdf8" },
    { name: "Meta",          color: "#ec4899" },
    { name: "Crypto",        color: "#a855f7" },
    { name: "Bonds",         color: "#22c55e" },
  ];
  // Outer ring = Current Portfolio (from image)
  const CURRENT_PCT: Record<string, number> = {
    Cash: 0.09, International: 0.19, US: 0.42, Meta: 0.02, Crypto: 0.10, Bonds: 0.18,
  };
  // Inner ring = Target Model Portfolio (from image)
  const TARGET_PCT: Record<string, number> = {
    Cash: 0.10, International: 0.10, US: 0.69, Meta: 0.01, Crypto: 0.06, Bonds: 0.04,
  };
  const totalAllAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const currentDonut = PORT_CATS.map(c => ({ ...c, value: (CURRENT_PCT[c.name] ?? 0) * totalAllAssets })).filter(d => d.value > 0);
  const targetDonut  = PORT_CATS.map(c => ({ ...c, value: (TARGET_PCT[c.name] ?? 0) * totalAllAssets })).filter(d => d.value > 0);

  // Sub-items per category (hardcoded from prototype model)
  const CATEGORY_SUBS: Record<string, { name: string; value: number }[]> = {
    Cash: [
      { name: "Goldman Sachs Money Market", value: 289500 },
      { name: "US Treasury Bills (T-Bill)", value: 241200 },
    ],
    International: [
      { name: "VXUS Total Intl ETF", value: 523800 },
      { name: "VWO Emerging Markets", value: 342100 },
      { name: "VGK European ETF", value: 254600 },
    ],
    US: [
      { name: "US Total Market", value: 779878 },
      { name: "US Large Cap", value: 535000 },
      { name: "US Small Cap", value: 323582 },
      { name: "US Dividend / Value", value: 94369 },
    ],
    Meta: [
      { name: "Meta Platforms (META)", value: 118000 },
    ],
    Crypto: [
      { name: "Bitcoin (BTC)", value: 421000 },
      { name: "Ethereum (ETH)", value: 169200 },
    ],
    Bonds: [
      { name: "US Treasury Bonds", value: 521400 },
      { name: "Municipal Bonds", value: 312840 },
      { name: "Corporate Bonds (IG)", value: 225600 },
    ],
  };

  const [selectedCat, setSelectedCat] = useState(PORT_CATS[2].name); // default: US
  const selectedCatDef = PORT_CATS.find(c => c.name === selectedCat)!;
  const spyUp = (spyQuote?.changePercent ?? 0) >= 0;

  return (
    <div className={PANEL_CLS}>
      <div className="px-4 pt-3 pb-2 border-b border-border/60">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Investment Portfolio</p>
            <p className="text-2xl font-bold text-foreground leading-tight mt-0.5" data-testid="kpi-brokerage">{fmt(total)}</p>
            <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
              <span>Brokerage <span className="font-semibold text-foreground">{fmt(totalBrok)}</span></span>
              <span>Retirement <span className="font-semibold text-foreground">{fmt(totalRet)}</span></span>
            </div>
          </div>
          {spyQuote ? (
            <div className={`flex items-center gap-1 text-xs font-semibold flex-shrink-0 px-2.5 py-1.5 rounded-lg border ${spyUp ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"}`}>
              {spyUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              S&P {spyUp ? "+" : ""}{spyQuote.changePercent?.toFixed(2)}%
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs font-semibold flex-shrink-0 px-2.5 py-1.5 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200">
              <ArrowUpRight className="w-3.5 h-3.5" />4.32% YTD
            </div>
          )}
        </div>
      </div>

      {/* ── Concentric donut + legend ── */}
      <div className="px-4 py-3">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
          Current vs. Target Model Portfolio
        </p>
        <div className="flex items-center gap-3">
          {/* Chart — thick rings so % labels sit inside the bands */}
          <div style={{ width: 160, height: 160, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {/* Outer ring = Current */}
                <Pie
                  data={currentDonut}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={76}
                  dataKey="value" paddingAngle={2}
                  label={false}
                  labelLine={false}
                >
                  {currentDonut.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                {/* Inner ring = Target */}
                <Pie
                  data={targetDonut}
                  cx="50%" cy="50%"
                  innerRadius={30} outerRadius={58}
                  dataKey="value" paddingAngle={2}
                  label={false}
                  labelLine={false}
                >
                  {targetDonut.map((d, i) => <Cell key={i} fill={d.color} opacity={0.65} />)}
                </Pie>
                <RechartsTooltip
                  formatter={(v: number, n: string) => [`${((v / totalAllAssets) * 100).toFixed(1)}%  (${fmt(v)})`, n]}
                  contentStyle={{ fontSize: 10 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
              <span>Category</span>
              <div className="flex gap-2">
                <span className="w-7 text-right">Cur</span>
                <span className="w-7 text-right">Tgt</span>
              </div>
            </div>
            {PORT_CATS.map(c => {
              const curPct = Math.round((CURRENT_PCT[c.name] ?? 0) * 100);
              const tgtPct = Math.round((TARGET_PCT[c.name] ?? 0) * 100);
              const diff = curPct - tgtPct;
              return (
                <div key={c.name} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-muted-foreground flex-1 truncate text-[9px]">{c.name}</span>
                  <div className="flex gap-2 items-center">
                    <span className="tabular-nums font-bold text-foreground w-7 text-right">{curPct}%</span>
                    <span className="tabular-nums text-muted-foreground w-7 text-right">{tgtPct}%</span>
                  </div>
                </div>
              );
            })}
            <div className="mt-1 pt-1 border-t border-border flex gap-3 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-foreground/20" />Current (outer)</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-foreground/10" />Target (inner)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Category dropdown + sub-items ── */}
      <div className="px-4 pb-3">
        <div className="relative">
          <select
            className="w-full appearance-none rounded-t text-sm font-semibold text-white px-3 py-2 pr-8 cursor-pointer border-0 outline-none"
            style={{ backgroundColor: selectedCatDef.color }}
            value={selectedCat}
            onChange={e => setSelectedCat(e.target.value)}
            data-testid="select-portfolio-category"
          >
            {PORT_CATS.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
        </div>
        <div className="border border-t-0 border-border rounded-b overflow-hidden">
          {(CATEGORY_SUBS[selectedCat] ?? []).map((item, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs border-t border-border first:border-t-0 hover:bg-muted/40 transition-colors">
              <span className="text-foreground">{item.name}</span>
              <span className="tabular-nums font-semibold text-foreground">{fmt(item.value, true)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Panel: Liabilities ────────────────────────────────────────────────────────
const MARKET_RATES: Record<string, number> = {
  mortgage:      6.85,
  credit_card:   24.50,
  student_loan:  6.50,
  personal_loan: 9.50,
  auto_loan:     7.25,
  heloc:         8.50,
};

// ─── Water-Flow Dashboard Widget ──────────────────────────────────────────────
const WATER_CSS = `
  @keyframes wv { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  @keyframes pipeDash { to { stroke-dashoffset: -18 } }
  .wv-s { animation: wv 2.2s linear infinite; }
  .pipe-flow { animation: pipeDash 0.7s linear infinite; }
`;

interface WFlowTank {
  id: string; label: string; sub: string; amount: number;
  startLevel: number; endLevel: number;
  color: string; border: string; fill: string;
  badge?: string; badgeSub?: string; stable?: boolean;
}

function DashboardFlowWidget({ onNavigate }: { onNavigate: () => void }) {
  const [scheduled, setScheduled] = useState<Set<string>>(new Set(["prop-tax-jan"]));

  const OBLIGATIONS = [
    { id: "prop-tax-jan", label: "NYC Property Tax — 1st Installment", amount: 17500, due: new Date(2026, 0, 15), method: "Wire", category: "tax" },
    { id: "est-tax-q1",   label: "Federal Estimated Tax — Q1 2026",    amount: 30000, due: new Date(2026, 3, 15), method: "ACH",  category: "tax" },
    { id: "tuition-spring", label: "Private School Tuition — Spring",   amount: 15000, due: new Date(2026, 3, 1),  method: "Wire", category: "education" },
    { id: "prop-tax-jul", label: "NYC Property Tax — 2nd Installment",  amount: 17500, due: new Date(2026, 6, 15), method: "Wire", category: "tax" },
    { id: "est-tax-q3",   label: "Federal Estimated Tax — Q3 2026",     amount: 30000, due: new Date(2026, 8, 15), method: "ACH",  category: "tax" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden" data-testid="dashboard-money-flow-panel">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
            <Repeat2 className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div>
            <p className="text-sm font-black text-foreground leading-none">GURU Cash Management</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Upcoming movements &amp; scheduled payments · Jan–May 2026</p>
          </div>
        </div>
        <button
          onClick={onNavigate}
          className="text-[10px] font-bold text-sky-600 hover:text-sky-500 flex items-center gap-1 transition-colors"
          data-testid="dashboard-money-flow-link"
        >
          Full view <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-2 divide-x divide-border">

        {/* ── Left: Animated Cash Flow (mini version of Card 4) ── */}
        <div className="px-4 py-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3">Scheduled Cash Movements · January</p>
          <div className="flex flex-col gap-0">

            {/* Operating Cash bucket row */}
            <div className="flex items-stretch gap-2" data-testid="mini-flow-ops">
              <div className="w-[78px] flex-shrink-0 rounded-lg flex flex-col items-center justify-center gap-1 py-3" style={{ background: "#1d4ed8" }}>
                <Wallet className="w-3 h-3 text-white/80" />
                <span className="font-black uppercase tracking-widest text-white text-center px-1 text-[8px] leading-tight">Operating Cash</span>
                <span className="font-black tabular-nums text-white/90 text-[9px]">$90,879</span>
              </div>
              <div className="flex-1 border border-blue-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-3 bg-blue-50/60">
                  <div className="min-w-0 mr-2">
                    <p className="text-[10px] font-semibold text-blue-900 leading-tight">CIT Money Market</p>
                    <p className="text-[8px] text-blue-600 mt-0.5">Primary operating · Jan ending</p>
                  </div>
                  <span className="text-[10px] font-black text-blue-700 tabular-nums flex-shrink-0">$90,879</span>
                </div>
              </div>
            </div>

            {/* Flow connector: JPMorgan → CIT ($46,739) */}
            <div className="flex items-center" style={{ minHeight: 38, paddingLeft: "calc(78px + 0.5rem)" }}>
              <div className="group relative flex items-center gap-2 cursor-default" style={{ marginLeft: 18 }}>
                <svg width="12" height="38" className="flex-shrink-0 overflow-visible">
                  <path d="M 6,36 L 6,2" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="3.5,2.5" fill="none" />
                  <polygon points="0,-4 3.5,2.5 -3.5,2.5" fill="#2563eb" opacity="0.95">
                    <animateMotion dur="1.9s" repeatCount="indefinite" calcMode="linear" path="M 6,36 L 6,2" />
                  </polygon>
                </svg>
                <span className="text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-300 px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                  ↑ $46,739 · JPMorgan → CIT
                </span>
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col z-50 pointer-events-none">
                  <div className="bg-slate-900 text-white text-[9px] font-medium rounded-lg px-3 py-2 shadow-2xl leading-relaxed max-w-[230px]">
                    Autodraw from JPMorgan 100% Treasuries MMF into CIT operating account — building 2 months of forward cash expenses
                  </div>
                  <div className="w-2 h-2 bg-slate-900 rotate-45 ml-4 -mt-1 flex-shrink-0" />
                </div>
              </div>
            </div>

            {/* Reserve bucket row */}
            <div className="flex items-stretch gap-2" data-testid="mini-flow-reserve">
              <div className="w-[78px] flex-shrink-0 rounded-lg flex flex-col items-center justify-center gap-1 py-3" style={{ background: "#d97706" }}>
                <ShieldCheck className="w-3 h-3 text-white/80" />
                <span className="font-black uppercase tracking-widest text-white text-center px-1 text-[8px] leading-tight">Reserve</span>
                <span className="font-black tabular-nums text-white/90 text-[9px]">$129,385</span>
              </div>
              {/* Branch connector */}
              <div className="flex-shrink-0 relative" style={{ width: 18, alignSelf: "stretch" }}>
                <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} viewBox="0 0 18 100" preserveAspectRatio="none">
                  <line x1="0" y1="50" x2="9" y2="50" stroke="rgba(217,119,6,0.45)" strokeWidth="1.5" />
                  <line x1="9" y1="25" x2="9" y2="75" stroke="rgba(217,119,6,0.45)" strokeWidth="1.5" />
                  <line x1="9" y1="25" x2="18" y2="25" stroke="rgba(217,119,6,0.45)" strokeWidth="1.5" />
                  <line x1="9" y1="75" x2="18" y2="75" stroke="rgba(217,119,6,0.45)" strokeWidth="1.5" />
                </svg>
              </div>
              {/* Stacked sub-account cards */}
              <div className="flex-1 flex flex-col gap-0">
                <div className="border border-amber-200 rounded-t-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 bg-amber-50/60">
                    <div className="min-w-0 mr-2">
                      <p className="text-[10px] font-semibold text-amber-900 leading-tight">JPMorgan Treasuries MMF</p>
                      <p className="text-[8px] text-amber-600 mt-0.5">Autodraw to Operating</p>
                    </div>
                    <span className="text-[10px] font-black text-amber-700 tabular-nums flex-shrink-0">$27,927</span>
                  </div>
                </div>
                {/* Flow connector: T-Bill → JPMorgan */}
                <div className="group relative flex items-center gap-2 cursor-default py-1 px-2">
                  <svg width="12" height="28" className="flex-shrink-0 overflow-visible">
                    <path d="M 6,26 L 6,2" stroke="#d97706" strokeWidth="1.5" strokeDasharray="3.5,2.5" fill="none" />
                    <polygon points="0,-3.5 3.5,2.5 -3.5,2.5" fill="#f59e0b" opacity="0.95">
                      <animateMotion dur="1.5s" repeatCount="indefinite" calcMode="linear" path="M 6,26 L 6,2" />
                    </polygon>
                  </svg>
                  <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                    ↑ $7,478 · T-Bill → JPMorgan
                  </span>
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col z-50 pointer-events-none">
                    <div className="bg-slate-900 text-white text-[9px] font-medium rounded-lg px-3 py-2 shadow-2xl leading-relaxed max-w-[220px]">
                      1-month T-Bill maturing in January — proceeds roll into JPMorgan 100% Treasuries MMF
                    </div>
                    <div className="w-2 h-2 bg-slate-900 rotate-45 ml-4 -mt-1 flex-shrink-0" />
                  </div>
                </div>
                <div className="border border-amber-200 rounded-b-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 bg-amber-50/60">
                    <div className="min-w-0 mr-2">
                      <p className="text-[10px] font-semibold text-amber-900 leading-tight">T-Bill Ladder</p>
                      <p className="text-[8px] text-amber-600 mt-0.5">3-Mo / 6-Mo / 9-Mo · Maturing</p>
                    </div>
                    <span className="text-[10px] font-black text-amber-700 tabular-nums flex-shrink-0">$101,458</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Right: Autobill Payments ── */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Autobill Payments</p>
            <span className="text-[9px] font-bold text-violet-600">{scheduled.size} of {OBLIGATIONS.length} scheduled</span>
          </div>
          <div className="space-y-2">
            {OBLIGATIONS.map((obl) => {
              const isScheduled = scheduled.has(obl.id);
              const daysUntil = Math.ceil((obl.due.getTime() - DEMO_NOW.getTime()) / 86400000);
              const isUrgent = daysUntil > 0 && daysUntil <= 45;
              const catCls = obl.category === "tax"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-violet-50 text-violet-700 border-violet-200";
              return (
                <div key={obl.id} className={`flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0 ${isScheduled ? "opacity-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border flex-shrink-0 ${catCls}`}>
                        {obl.category === "tax" ? "Tax" : "Edu"}
                      </span>
                      <p className="text-[11px] font-semibold text-foreground leading-tight truncate">{obl.label}</p>
                    </div>
                    <p className={`text-[9px] mt-0.5 font-medium ${isUrgent ? "text-rose-600" : "text-muted-foreground"}`}>
                      {format(obl.due, "MMM d, yyyy")} · {isUrgent ? `${daysUntil}d — urgent` : daysUntil > 0 ? `in ${daysUntil}d` : "past due"}
                    </p>
                  </div>
                  <span className="text-[11px] font-black tabular-nums text-rose-700 shrink-0">{fmt(obl.amount)}</span>
                  {isScheduled ? (
                    <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0">
                      <CheckSquare className="w-3 h-3 text-emerald-600" />
                      <span className="text-[8px] font-black text-emerald-700">Done</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setScheduled((s) => new Set([...s, obl.id]))}
                      className="flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-2.5 py-1 text-[9px] font-bold transition-colors shrink-0 whitespace-nowrap"
                    >
                      <Send className="w-2.5 h-2.5" />
                      {obl.method}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

function LiabilitiesPanel({ liabilities }: { liabilities: Liability[] }) {
  const totalDebt = liabilities.reduce((s, l) => s + Number(l.value), 0);
  const wtdRate = liabilities.reduce((s, l) => s + parseFloat(l.interestRate) * Number(l.value), 0) / (totalDebt || 1);

  const TYPE_LABEL: Record<string, string> = {
    mortgage: "Mortgage",
    credit_card: "Credit Card",
    student_loan: "Student Loan",
    personal_loan: "Personal Loan",
    auto_loan: "Auto Loan",
    heloc: "HELOC",
  };

  return (
    <div className={PANEL_CLS + " flex flex-col"}>
      {/* Header */}
      <div className="px-4 pt-3 pb-3 border-b border-border/60">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Liabilities</p>
            <p className="text-2xl font-bold text-rose-600 leading-tight mt-0.5">{fmt(totalDebt)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total outstanding debt</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Wtd. Avg Rate</p>
            <p className="text-lg font-extrabold tabular-nums text-foreground">{wtdRate.toFixed(2)}%</p>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60" style={{ gridTemplateColumns: "1fr 70px 52px 52px 72px" }}>
        <span>Loan</span>
        <span className="text-right">Balance</span>
        <span className="text-right">Rate</span>
        <span className="text-right">Market</span>
        <span className="text-right">vs Market</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/50 flex-1">
        {liabilities.map((l) => {
          const rate = parseFloat(l.interestRate);
          const market = MARKET_RATES[l.type] ?? 7.0;
          const diff = rate - market;
          const isAbove = diff > 0.5;
          const isBelow = diff < -0.5;
          const label = l.description.split("(")[0].split("@")[0].split("—")[0].trim();
          const typeLabel = TYPE_LABEL[l.type] ?? l.type;

          return (
            <div key={l.id} className="grid px-4 py-2.5 items-center gap-1 hover:bg-muted/20 transition-colors" style={{ gridTemplateColumns: "1fr 70px 52px 52px 72px" }}>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-foreground truncate">{label}</p>
                <p className="text-[9px] text-muted-foreground">{typeLabel}</p>
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-rose-600 text-right">{fmt(Number(l.value))}</span>
              <span className="text-[11px] font-mono tabular-nums text-foreground text-right">
                {rate === 0 ? "—" : `${rate.toFixed(2)}%`}
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground text-right">{market.toFixed(2)}%</span>
              <div className="flex justify-end">
                {rate === 0 ? (
                  <span className="text-[9px] text-muted-foreground italic">N/A</span>
                ) : isBelow ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                    ↓ {Math.abs(diff).toFixed(2)}% below
                  </span>
                ) : isAbove ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 whitespace-nowrap">
                    ↑ {diff.toFixed(2)}% above
                  </span>
                ) : (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border whitespace-nowrap">
                    ≈ at market
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/60 bg-muted/30">
        <p className="text-[9px] text-muted-foreground">Market rates as of Mar 2026 · 30yr mortgage 6.85% · CC avg 24.5% · Student 6.5%</p>
      </div>
    </div>
  );
}

// ─── Strategy View ─────────────────────────────────────────────────────────────
function StrategyView({
  strategies,
  clientId,
  isPending,
  onGenerate,
}: {
  strategies: Strategy[];
  clientId: number;
  isPending: boolean;
  onGenerate: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground">
            AI Balance Sheet Strategy
          </h2>
          <p className="text-sm text-muted-foreground">
            Powered by GPT-5 · Full balance sheet analysis
          </p>
        </div>
        <Button
          onClick={onGenerate}
          disabled={isPending}
          className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-0 shadow-lg shadow-indigo-500/20"
          data-testid="button-generate-strategy"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4 animate-spin" /> Analyzing…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4" /> Generate Strategy
            </span>
          )}
        </Button>
      </div>

      {isPending && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
          <p className="text-sm text-muted-foreground">
            Analyzing balance sheet, cash flows &amp; liquidity position…
          </p>
        </div>
      )}

      {!isPending && strategies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
            <BrainCircuit className="w-8 h-8 text-indigo-300" />
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Click <strong>Generate Strategy</strong> to run a full balance sheet
            analysis and get personalized cash management recommendations.
          </p>
        </div>
      )}

      {!isPending && strategies.length > 0 && (
        <div className="space-y-4">
          {strategies.map((s, i) => (
            <Card
              key={s.id}
              className="border-border/60 hover:border-indigo-200 transition-colors"
              data-testid={`strategy-card-${s.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <h3 className="font-semibold text-sm text-foreground">
                      {s.name}
                    </h3>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs flex-shrink-0 whitespace-nowrap"
                  >
                    +{fmt(Number(s.impact), true)} / yr
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed pl-9">
                  {s.recommendation}
                </p>
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground text-center pt-2">
            Generated by GURU · Click Generate to refresh
          </p>
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

// ─── Balance Sheet subtitle lookup (account numbers & addresses) ───────────────
// Each entry: [keywords-to-match (all must hit), subtitle string]
const BS_ASSET_SUBTITLES: Array<[string[], string]> = [
  [["chase", "checking"],                        "Acct ****7842"],
  [["capitalon"],                                "Acct ****3319"],
  [["citizens", "checking"],                     "Acct ****2201"],
  [["citizens", "money market"],                 "Acct ****8874"],
  [["citizens", "private bank"],                 "Acct ****8874"],
  [["goldman sachs", "money market"],            "Acct ****4521"],
  [["goldman sachs", "marcus"],                  "Acct ****4521"],
  [["cresset"],                                  "Acct ****5839"],
  [["schwab"],                                   "Acct ****1192"],
  [["e*trade"],                                  "Acct ****6074"],
  [["etrade"],                                   "Acct ****6074"],
  [["fidelity"],                                 "Acct ****2893"],
  [["401(k)"],                                   "Acct ****7743"],
  [["roth ira"],                                 "Acct ****3892"],
  [["traditional ira"],                          "Acct ****6615"],
  [["coinbase"],                                 "Acct ****9201"],
  [["carlyle partners viii", "carry"],           "Fund LP-8821"],
  [["carlyle partners ix", "carry"],             "Fund LP-3347"],
  [["carlyle partners viii"],                    "Fund LP-8821"],
  [["carlyle partners ix"],                      "Fund LP-3347"],
  [["tribeca"],                                  "142 Duane St, Apt 7A · New York, NY 10013"],
  [["sarasota"],                                 "4821 Gulf of Mexico Dr · Sarasota, FL 34231"],
];

const BS_LIAB_SUBTITLES: Array<[string[], string]> = [
  [["chase sapphire"],                           "Acct ****9934"],
  [["amex"],                                     "Acct ****9934"],
  [["credit card"],                              "Acct ****9934"],
  [["tribeca"],                                  "Loan ****4422"],
  [["sarasota"],                                 "Loan ****7019"],
  [["student loan"],                             "Acct ****5288"],
  [["professional loan"],                        "Acct ****6614"],
  [["capital commitment"],                       "Acct ****6614"],
];

function lookupBsSubtitle(
  desc: string | null,
  map: Array<[string[], string]>,
): string | null {
  const d = (desc ?? "").toLowerCase();
  for (const [keys, sub] of map) {
    if (keys.every((k) => d.includes(k.toLowerCase()))) return sub;
  }
  return null;
}

function assetComment(a: Asset, groupTotal?: number): AssetComment | null {
  const desc = (a.description ?? "").toLowerCase();
  const val = Number(a.value);
  if (a.type === "cash" && desc.includes("checking") && val > 50000)
    return { text: "Excess", color: "red" };
  if (
    a.type === "cash" &&
    (desc.includes("money market") || desc.includes("savings")) &&
    val > 150000
  )
    return { text: "Excess", color: "red" };
  if (
    a.type === "real_estate" &&
    (desc.includes("invest") ||
      desc.includes("rent") ||
      desc.includes("sarasota"))
  )
    return { text: "Below 5%", color: "orange" };
  if (a.type === "cash" && desc.includes("checking") && val < 30000)
    return { text: "Main Account", color: "muted" };
  return null;
}

function liabComment(l: Liability): AssetComment | null {
  const rate = parseFloat(l.interestRate);
  if (l.type === "credit_card") return { text: "Need to review", color: "red" };
  if (
    l.type === "mortgage" &&
    (l.description.toLowerCase().includes("sarasota") ||
      l.description.toLowerCase().includes("invest"))
  )
    return null;
  if (l.type === "mortgage" && rate > 5)
    return { text: "Floating in 3 mo", color: "orange" };
  return null;
}

interface BsGroup {
  category: string;
  items: {
    label: string;
    subtitle?: string | null;
    value: number;
    rate: string | null;
    ret: string | null;
    comment: AssetComment | null;
  }[];
  subtotal: number;
  avgRate: string | null;
}

interface BsSection {
  label: string;
  groups: BsGroup[];
  total: number;
}

function buildAssetGroups(assets: Asset[]): BsSection[] {
  const isRetirement = (a: Asset) => {
    const d = (a.description ?? "").toLowerCase();
    return d.includes("401") || d.includes("ira") || d.includes("roth");
  };
  const isCarry = (a: Asset) =>
    (a.description ?? "").toLowerCase().includes("carry");
  const isRSU = (a: Asset) =>
    (a.description ?? "").toLowerCase().includes("rsu");
  const isBrokerage = (a: Asset) =>
    (a.type === "equity" || a.type === "fixed_income") &&
    !isRetirement(a) &&
    !isRSU(a);
  // Cash held inside a brokerage account (e.g. Fidelity Cash Sweep) —
  // belongs in Taxable Brokerage, not the bank savings bucket.
  const isBrokerageCash = (a: Asset) =>
    a.type === "cash" &&
    ((a.description ?? "").toLowerCase().includes("fidelity") ||
     (a.description ?? "").toLowerCase().includes("sweep") ||
     (a.description ?? "").toLowerCase().includes("brokerage cash"));
  const checking    = assets.filter((a) => a.type === "cash" && (a.description ?? "").toLowerCase().includes("checking"));
  const savingsMM   = assets.filter((a) => a.type === "cash" && !(a.description ?? "").toLowerCase().includes("checking") && !isBrokerageCash(a));
  const brokerage   = assets.filter((a) => isBrokerage(a) || isBrokerageCash(a));

  // Extract the broker/institution name from an asset description.
  // "Cresset Capital Mgmt — Portfolio"  →  "Cresset Capital Mgmt"
  // "E*Trade - Meta Platforms"          →  "E*Trade"
  // "Schwab International Index (ETF)"  →  "Schwab"
  // "Fidelity Cash Sweep"               →  "Fidelity"
  const extractInstitution = (desc: string): string => {
    const d = desc.trim();
    if (d.includes(" — ")) return d.split(" — ")[0].trim();
    if (d.includes(" - "))  return d.split(" - ")[0].trim();
    // No delimiter — use first word
    return d.split(" ")[0].trim();
  };

  // Build a broker-aggregated group: one line per institution.
  const mkBrokerageGroup = (arr: Asset[]): BsGroup => {
    const map: Record<string, { value: number; descs: string[] }> = {};
    for (const a of arr) {
      const inst = extractInstitution(a.description ?? "");
      if (!map[inst]) map[inst] = { value: 0, descs: [] };
      map[inst].value += Number(a.value);
      map[inst].descs.push(a.description ?? "");
    }
    const items = Object.entries(map).map(([inst, data]) => ({
      label: inst,
      subtitle: lookupBsSubtitle(inst, BS_ASSET_SUBTITLES) ??
                lookupBsSubtitle(data.descs[0] ?? "", BS_ASSET_SUBTITLES),
      value: data.value,
      rate: null as string | null,
      ret: lookupReturn(data.descs.length === 1 ? data.descs[0] : inst),
      comment: null as string | null,
    }));
    return {
      category: "Taxable Brokerage",
      items,
      subtotal: arr.reduce((s, a) => s + Number(a.value), 0),
      avgRate: null,
    };
  };
  const altAssets   = assets.filter((a) => a.type === "alternative" && !isCarry(a));
  const carry       = assets.filter((a) => isCarry(a));
  const rsus        = assets.filter((a) => isRSU(a));
  const realEstate  = assets.filter((a) => a.type === "real_estate");
  const retirement  = assets.filter((a) => isRetirement(a));

  const ASSET_RETURNS: Array<[string, string]> = [
    ["cresset",        "+14.2%"],
    ["roth ira",       "+11.8%"],
    ["401(k)",         "+10.4%"],
    ["traditional ira","+10.4%"],
    ["meta platforms", "+28.3%"],
    ["schwab",         "+7.9%"],
    ["goldman sachs",  "+18.2%"],
    ["bank of america","+8.6%"],
    ["citizens private bank money market", "3.65%"],
    ["capitalon",      "3.78%"],
    ["citizens private banking checking",  "0.01%"],
    ["chase total",    "0.01%"],
    ["fidelity cash sweep",                "2.50%"],
    ["fidelity",       "+10.4%"],
    ["us treasuries",  "3.95%"],
    ["tribeca",        "+4.2%"],
    ["sarasota",       "+6.1%"],
    ["carlyle partners viii (pe",          "12.4% IRR"],
    ["carlyle partners ix (pe",            "14.2% IRR"],
    ["carlyle partners viii — carry",      "22.6% est."],
    ["carlyle partners ix — carry",        "26.1% est."],
    ["coinbase",       "+47.3%"],
  ];
  const lookupReturn = (desc: string | null): string | null => {
    const d = (desc ?? "").toLowerCase();
    for (const [key, val] of ASSET_RETURNS) {
      if (d.includes(key)) return val;
    }
    return null;
  };

  const toItem = (a: Asset) => ({
    label: a.description.split("(")[0].split("—")[0].split("–")[0].trim(),
    subtitle: lookupBsSubtitle(a.description, BS_ASSET_SUBTITLES),
    value: Number(a.value),
    rate: extractRate(a.description),
    ret: lookupReturn(a.description),
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
  const mkGroup = (category: string, arr: Asset[]): BsGroup => ({
    category,
    items: arr.map(toItem),
    subtotal: subtot(arr),
    avgRate: wavgRate(arr),
  });

  const sections: BsSection[] = [];

  // ── Cash ──────────────────────────────────────────────────────────────────
  const cashGroups: BsGroup[] = [];
  if (checking.length) cashGroups.push(mkGroup("Checking Bank Accounts", checking));
  if (savingsMM.length) cashGroups.push(mkGroup("Savings & Money Market Bank Accounts", savingsMM));
  if (cashGroups.length) sections.push({ label: "Cash", groups: cashGroups, total: subtot([...checking, ...savingsMM]) });

  // ── Investments ───────────────────────────────────────────────────────────
  const investGroups: BsGroup[] = [];
  if (brokerage.length) investGroups.push(mkBrokerageGroup(brokerage));
  if (altAssets.length) investGroups.push(mkGroup("Alternative Assets (PE Funds)", altAssets));
  if (investGroups.length) sections.push({ label: "Investments", groups: investGroups, total: subtot([...brokerage, ...altAssets]) });

  // ── Real Estate ───────────────────────────────────────────────────────────
  if (realEstate.length) sections.push({ label: "Real Estate", groups: [mkGroup("Properties", realEstate)], total: subtot(realEstate) });

  // ── Carry & RSUs ──────────────────────────────────────────────────────────
  const carryRsuGroups: BsGroup[] = [];
  if (carry.length) carryRsuGroups.push(mkGroup("Carried Interest (PE)", carry));
  if (rsus.length)  carryRsuGroups.push(mkGroup("RSUs & Unvested Equity", rsus));
  if (carryRsuGroups.length) sections.push({ label: "Carry and RSUs", groups: carryRsuGroups, total: subtot([...carry, ...rsus]) });

  // ── Retirement ────────────────────────────────────────────────────────────
  if (retirement.length) sections.push({ label: "Retirement", groups: [mkGroup("Tax-Advantaged Accounts", retirement)], total: subtot(retirement) });

  return sections;
}

function buildLiabilityGroups(liabilities: Liability[]): BsGroup[] {
  const cc = liabilities.filter((l) => l.type === "credit_card");
  const student = liabilities.filter((l) => l.type === "student_loan");
  const mortg = liabilities.filter((l) => l.type === "mortgage");
  const profLoan = liabilities.filter(
    (l) => l.type === "personal_loan" && parseFloat(l.interestRate) > 0,
  );
  const capComm = liabilities.filter(
    (l) => l.type === "personal_loan" && parseFloat(l.interestRate) === 0,
  );

  const subtot = (arr: Liability[]) =>
    arr.reduce((s, l) => s + Number(l.value), 0);
  const wavgRate = (arr: Liability[]) => {
    const total = subtot(arr);
    if (!total) return null;
    const weighted = arr.reduce(
      (s, l) => s + parseFloat(l.interestRate) * Number(l.value),
      0,
    );
    return weighted > 0 ? (weighted / total).toFixed(2) : null;
  };

  const toItem = (l: Liability) => ({
    label: l.description.split("(")[0].split("—")[0].split("–")[0].trim(),
    subtitle: lookupBsSubtitle(l.description, BS_LIAB_SUBTITLES),
    value: Number(l.value),
    rate:
      parseFloat(l.interestRate) > 0
        ? parseFloat(l.interestRate).toFixed(2)
        : null,
    ret: null,
    comment: liabComment(l),
  });

  const groups: BsGroup[] = [];
  if (cc.length)
    groups.push({
      category: "Credit Cards / Lines of Credit",
      items: cc.map(toItem),
      subtotal: subtot(cc),
      avgRate: wavgRate(cc),
    });
  if (student.length)
    groups.push({
      category: "Student Loans",
      items: student.map(toItem),
      subtotal: subtot(student),
      avgRate: wavgRate(student),
    });
  if (mortg.length)
    groups.push({
      category: "Mortgages",
      items: mortg.map(toItem),
      subtotal: subtot(mortg),
      avgRate: wavgRate(mortg),
    });
  if (profLoan.length)
    groups.push({
      category: "Professional Loans (Private Equity)",
      items: profLoan.map(toItem),
      subtotal: subtot(profLoan),
      avgRate: wavgRate(profLoan),
    });
  if (capComm.length)
    groups.push({
      category: "Remaining Capital Commitment",
      items: capComm.map(toItem),
      subtotal: subtot(capComm),
      avgRate: null,
    });
  return groups;
}

// ─── Balance Sheet Table ───────────────────────────────────────────────────────
function BsTable({
  sections,
  groups,
  totalLabel,
  totalValue,
  totalRate,
  isLiability = false,
}: {
  sections?: BsSection[];
  groups?: BsGroup[];
  totalLabel: string;
  totalValue: number;
  totalRate?: string | null;
  isLiability?: boolean;
}) {
  const COLS = isLiability ? "1fr 90px 72px 90px" : "1fr 90px 72px 80px";
  const retCls = (r: string | null) => {
    if (!r) return "text-muted-foreground/40";
    if (r.startsWith("+")) return "text-emerald-700 font-semibold";
    if (r.toLowerCase().includes("irr") || r.toLowerCase().includes("est")) return "text-amber-700 font-semibold";
    return "text-muted-foreground";
  };

  const renderItems = (items: BsGroup["items"], indent = "pl-8") =>
    items.map((item, ii) => (
      <div
        key={ii}
        className="grid border-t border-border/40 hover:bg-secondary/30 transition-colors"
        style={{ gridTemplateColumns: COLS }}
      >
        <div className="px-3 py-1.5 pl-10">
          <p className="text-[11px] text-muted-foreground leading-tight">{item.label}</p>
          {item.subtitle && (
            <p className="text-[9px] text-muted-foreground/55 leading-tight mt-0.5 tabular-nums">{item.subtitle}</p>
          )}
        </div>
        <div className="px-2 py-1.5 text-right tabular-nums font-medium text-foreground text-[11px]">
          {item.value > 0 ? fmt(item.value) : "—"}
        </div>
        <div className={`px-2 py-1.5 text-right tabular-nums text-[11px] ${retCls(item.ret ?? (item.rate ? `${item.rate}%` : null))}`}>
          {!isLiability
            ? (item.ret ?? (item.rate ? `${item.rate}%` : <span className="text-muted-foreground/40">—</span>))
            : (item.rate ? `${item.rate}%` : <span className="text-muted-foreground/40">—</span>)
          }
        </div>
        <div className="px-2 py-1.5">
          {item.comment && (
            <span className={`text-[9px] ${item.comment.color === "red" ? "text-rose-600" : item.comment.color === "orange" ? "text-amber-600" : "text-muted-foreground"}`}>
              {item.comment.text}
            </span>
          )}
        </div>
      </div>
    ));

  const renderGroup = (group: BsGroup, showSubtotal: boolean) => (
    <div key={group.category}>
      {renderItems(group.items, "pl-10")}
      {showSubtotal && (
        <div className="grid border-t border-border/60 bg-slate-50 text-slate-700" style={{ gridTemplateColumns: COLS }}>
          <div className="px-3 py-1.5 pl-6 font-bold text-[11px]">{group.category}</div>
          <div className="px-2 py-1.5 text-right tabular-nums text-[10px] font-bold">{fmt(group.subtotal)}</div>
          <div className="px-2 py-1.5 text-right tabular-nums text-[10px] text-slate-400">
            {group.avgRate ? `${group.avgRate}%` : ""}
          </div>
          <div className="px-2 py-1.5" />
        </div>
      )}
    </div>
  );

  return (
    <div className="border border-border rounded-xl overflow-hidden text-xs">
      {/* Header */}
      <div className="grid bg-slate-800" style={{ gridTemplateColumns: COLS }}>
        <div className="px-3 py-2.5 font-black uppercase tracking-widest text-slate-300 text-[12px]">
          {isLiability ? "Liability Category" : "Asset Category"}
        </div>
        <div className="px-2 py-2.5 text-right font-black uppercase tracking-widest text-slate-300 text-[12px]">Balance</div>
        <div className="px-2 py-2.5 text-right font-black uppercase tracking-widest text-slate-300 text-[9px]">
          {isLiability ? "Cost" : "Yield / Return"}
        </div>
        <div className="px-2 py-2.5 font-black uppercase tracking-widest text-slate-300 text-[12px]">Notes</div>
      </div>
      {/* Sectioned asset rows */}
      {sections && sections.map((sec) => (
        <div key={sec.label}>
          {/* Sub-groups within section */}
          {sec.groups.map((group) => renderGroup(group, sec.groups.length > 1 || group.items.length > 1))}
          {/* Section total — shaded blue, pinned to bottom of section */}
          <div className="grid border-t border-blue-200 bg-blue-100 text-blue-900" style={{ gridTemplateColumns: COLS }}>
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">{sec.label}</div>
            <div className="px-2 py-2 text-right tabular-nums text-[10px] font-black">{fmt(sec.total)}</div>
            <div className="px-2 py-2" />
            <div className="px-2 py-2" />
          </div>
        </div>
      ))}
      {/* Flat liability rows (no sections) */}
      {groups && groups.map((group) => (
        <div key={group.category}>
          {renderItems(group.items, "pl-6")}
          <div className="grid border-t border-blue-200 bg-blue-100 text-blue-900" style={{ gridTemplateColumns: COLS }}>
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">{group.category}</div>
            <div className="px-2 py-2 text-right tabular-nums text-[10px] font-black">{fmt(group.subtotal)}</div>
            <div className="px-2 py-2 text-right tabular-nums text-[10px] text-blue-700">
              {group.avgRate ? `${group.avgRate}%` : ""}
            </div>
            <div className="px-2 py-2" />
          </div>
        </div>
      ))}
      {/* Grand total */}
      <div
        className="grid bg-slate-800 text-slate-300 border-t-2 border-slate-700"
        style={{ gridTemplateColumns: COLS }}
      >
        <div className="px-3 py-2.5 font-black uppercase tracking-widest text-slate-300 text-[12px]">{totalLabel}</div>
        <div className="px-2 py-2.5 text-right tabular-nums font-black text-[12px] text-slate-300">
          {fmt(totalValue)}
        </div>
        <div className="px-2 py-2.5 text-right tabular-nums text-[10px] text-slate-300">
          {totalRate ? `${totalRate}%` : ""}
        </div>
        <div className="px-2 py-2.5" />
      </div>
    </div>
  );
}

// ─── Cash Flow Forecast View ──────────────────────────────────────────────────
interface WaterfallEntry {
  name: string;
  quarter: string;
  type: "balance" | "income" | "core" | "onetime";
  invisible: number;
  income: number;
  coreExp: number;
  oneTime: number;
  balance: number;
  rawValue: number;
  running: number;
}

function buildWaterfallData(
  cashFlows: CashFlow[],
  startBalance: number,
): WaterfallEntry[] {
  const quarters = [
    {
      label: "Q1 2026",
      months: [
        [2026, 3],
        [2026, 4],
        [2026, 5],
      ],
      endLabel: "Mar–May",
    },
    {
      label: "Q2 2026",
      months: [
        [2026, 6],
        [2026, 7],
        [2026, 8],
      ],
      endLabel: "Jun–Aug",
    },
    {
      label: "Q3 2026",
      months: [
        [2026, 9],
        [2026, 10],
        [2026, 11],
      ],
      endLabel: "Sep–Nov",
    },
    {
      label: "Q4 / Q1",
      months: [
        [2026, 12],
        [2027, 1],
        [2027, 2],
      ],
      endLabel: "Dec–Feb",
    },
  ];
  const result: WaterfallEntry[] = [];
  let running = startBalance;
  result.push({
    name: "Begin",
    quarter: "",
    type: "balance",
    invisible: 0,
    income: 0,
    coreExp: 0,
    oneTime: 0,
    balance: running,
    rawValue: running,
    running,
  });
  for (const { label, months, endLabel } of quarters) {
    const qFlows = cashFlows.filter((cf) => {
      const d = new Date(cf.date);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      return months.some(([qy, qm]) => qy === y && qm === m);
    });
    const income = qFlows
      .filter((cf) => cf.type === "inflow")
      .reduce((s, cf) => s + Number(cf.amount), 0);
    const coreExp = qFlows
      .filter(
        (cf) =>
          cf.type === "outflow" &&
          ["housing", "living_expenses"].includes(cf.category),
      )
      .reduce((s, cf) => s + Number(cf.amount), 0);
    const oneTime = qFlows
      .filter(
        (cf) =>
          cf.type === "outflow" &&
          !["housing", "living_expenses"].includes(cf.category),
      )
      .reduce((s, cf) => s + Number(cf.amount), 0);
    const prevRun = running;
    // Income bar: invisible base = prevRun, green bar = income
    result.push({
      name: "Income",
      quarter: label,
      type: "income",
      invisible: prevRun,
      income,
      coreExp: 0,
      oneTime: 0,
      balance: 0,
      rawValue: income,
      running: prevRun + income,
    });
    // Core expenses bar: invisible = prevRun+income-coreExp, red = coreExp (bar appears eating from top)
    result.push({
      name: "Core Exp",
      quarter: label,
      type: "core",
      invisible: prevRun + income - coreExp,
      income: 0,
      coreExp,
      oneTime: 0,
      balance: 0,
      rawValue: -coreExp,
      running: prevRun + income - coreExp,
    });
    // One-time: invisible = prevRun+income-coreExp-oneTime, red = oneTime
    result.push({
      name: "One-Time",
      quarter: label,
      type: "onetime",
      invisible: prevRun + income - coreExp - oneTime,
      income: 0,
      coreExp: 0,
      oneTime,
      balance: 0,
      rawValue: -oneTime,
      running: prevRun + income - coreExp - oneTime,
    });
    running = prevRun + income - coreExp - oneTime;
    result.push({
      name: endLabel,
      quarter: label,
      type: "balance",
      invisible: 0,
      income: 0,
      coreExp: 0,
      oneTime: 0,
      balance: running,
      rawValue: running,
      running,
    });
  }
  return result;
}

function WfLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  value?: number;
  type?: string;
}) {
  const { x = 0, y = 0, width = 0, value, type } = props;
  if (!value || value === 0) return null;
  const cx = x + width / 2;
  const cy = y - 10;
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      fontSize={11}
      fontWeight={700}
      fill="hsl(221,39%,28%)"
    >
      {fmt(value)}
    </text>
  );
}

type PLRowDef =
  | { key: string; kind: "group"; label: string }
  | { key: string; kind: "item"; label: string; descs: string[] }
  | { key: string; kind: "subtotal"; label: string; sumOf: string[] };

const CF_PL_ROWS: PLRowDef[] = [
  { key: "g_income", kind: "group", label: "EARNED INCOME" },
  {
    key: "salary",
    kind: "item",
    label: "Monthly Net Salary — P1 + P2",
    descs: ["Monthly Net Salaries"],
  },
  {
    key: "bonus_p1",
    kind: "item",
    label: "Partner 1 Year-End Bonus",
    descs: ["Partner 1 Year-End"],
  },
  {
    key: "bonus_p2",
    kind: "item",
    label: "Partner 2 Year-End Bonus",
    descs: ["Partner 2 Year-End"],
  },
  {
    key: "sub_income",
    kind: "subtotal",
    label: "Total Earned Income",
    sumOf: ["salary", "bonus_p1", "bonus_p2"],
  },
  { key: "g_tribeca", kind: "group", label: "TRIBECA — PRIMARY RESIDENCE" },
  {
    key: "trib_exp",
    kind: "item",
    label: "Mortgage + Maintenance + Insurance + Utilities",
    descs: ["Tribeca —"],
  },
  {
    key: "nyc_tax",
    kind: "item",
    label: "NYC Property Taxes (semi-annual)",
    descs: ["NYC Property Taxes"],
  },
  {
    key: "sub_trib",
    kind: "subtotal",
    label: "Net Tribeca",
    sumOf: ["trib_exp", "nyc_tax"],
  },
  { key: "g_sara", kind: "group", label: "SARASOTA — INVESTMENT PROPERTY" },
  {
    key: "sara_in",
    kind: "item",
    label: "Rental Income",
    descs: ["Investment Property Rental Income"],
  },
  {
    key: "sara_exp",
    kind: "item",
    label: "Property Expenses (mgmt + mortgage + maintenance)",
    descs: ["Investment Property — Mgmt"],
  },
  {
    key: "fl_tax",
    kind: "item",
    label: "Investment Property Taxes (semi-annual)",
    descs: ["Investment Property Taxes"],
  },
  {
    key: "sub_sara",
    kind: "subtotal",
    label: "Net Sarasota",
    sumOf: ["sara_in", "sara_exp", "fl_tax"],
  },
  { key: "g_living", kind: "group", label: "LIVING EXPENSES" },
  {
    key: "childcare",
    kind: "item",
    label: "Childcare / Nanny",
    descs: ["Childcare"],
  },
  {
    key: "phone_util",
    kind: "item",
    label: "Phone, Cable & Utilities",
    descs: ["Phone, Cable"],
  },
  {
    key: "sub_living",
    kind: "subtotal",
    label: "Total Living Expenses",
    sumOf: ["childcare", "phone_util"],
  },
  { key: "g_lifestyle", kind: "group", label: "LIFESTYLE & CREDIT" },
  {
    key: "cc_pay",
    kind: "item",
    label: "Credit Card Payments",
    descs: ["Credit Card Payments"],
  },
  {
    key: "memberships",
    kind: "item",
    label: "Annual Memberships & Fees",
    descs: ["Annual Memberships"],
  },
  {
    key: "golf",
    kind: "item",
    label: "Golf Club Annual Dues",
    descs: ["Golf Club"],
  },
  {
    key: "insurance",
    kind: "item",
    label: "Annual Insurance Premiums",
    descs: ["Annual Insurance"],
  },
  {
    key: "sub_lifestyle",
    kind: "subtotal",
    label: "Total Lifestyle",
    sumOf: ["cc_pay", "memberships", "golf", "insurance"],
  },
  { key: "g_edu", kind: "group", label: "EDUCATION" },
  {
    key: "tuition",
    kind: "item",
    label: "Private School Tuition",
    descs: ["Private School Tuition"],
  },
  { key: "g_debt", kind: "group", label: "DEBT SERVICE" },
  {
    key: "pe_loan",
    kind: "item",
    label: "PE Fund II Professional Loan",
    descs: ["PE Fund II Professional"],
  },
  {
    key: "student",
    kind: "item",
    label: "Student Loan Payments",
    descs: ["Student Loan Payments"],
  },
  {
    key: "sub_debt",
    kind: "subtotal",
    label: "Total Debt Service",
    sumOf: ["pe_loan", "student"],
  },
  { key: "g_tax", kind: "group", label: "TAXES" },
  {
    key: "fed_tax",
    kind: "item",
    label: "Federal Estimated Tax",
    descs: ["Federal Estimated Tax"],
  },
  { key: "g_travel", kind: "group", label: "TRAVEL" },
  {
    key: "trav_mem",
    kind: "item",
    label: "Memorial Day Travel",
    descs: ["Memorial Day Travel"],
  },
  {
    key: "trav_wknd",
    kind: "item",
    label: "Weekend Travel",
    descs: ["Weekend Travel"],
  },
  {
    key: "trav_sum",
    kind: "item",
    label: "Summer Travel",
    descs: ["Summer Travel"],
  },
  {
    key: "trav_hol",
    kind: "item",
    label: "Holiday Travel",
    descs: ["Holiday Travel"],
  },
  {
    key: "sub_travel",
    kind: "subtotal",
    label: "Total Travel",
    sumOf: ["trav_mem", "trav_wknd", "trav_sum", "trav_hol"],
  },
  { key: "g_misc", kind: "group", label: "YEAR-END & MISC" },
  {
    key: "yr_end_fees",
    kind: "item",
    label: "Year-End Fees & Misc",
    descs: ["Year-End Fees"],
  },
  {
    key: "yr_end_dist",
    kind: "item",
    label: "Year-End Investment Distributions",
    descs: ["Year-End Investment"],
  },
  {
    key: "reserve_int",
    kind: "item",
    label: "Reserve MMF & Savings Interest",
    descs: ["Reserve MMF"],
  },
];

const CF_MONTHS = [
  { label: "Jan", year: 2026, month: 1 },
  { label: "Feb", year: 2026, month: 2 },
  { label: "Mar", year: 2026, month: 3 },
  { label: "Apr", year: 2026, month: 4 },
  { label: "May", year: 2026, month: 5 },
  { label: "Jun", year: 2026, month: 6 },
  { label: "Jul", year: 2026, month: 7 },
  { label: "Aug", year: 2026, month: 8 },
  { label: "Sep", year: 2026, month: 9 },
  { label: "Oct", year: 2026, month: 10 },
  { label: "Nov", year: 2026, month: 11 },
  { label: "Dec", year: 2026, month: 12 },
];

function CashFlowForecastView({
  assets,
  cashFlows,
  clientId,
}: {
  assets: Asset[];
  cashFlows: CashFlow[];
  clientId: number;
}) {
  const { reserve, totalLiquid } = cashBuckets(assets);
  const startBalance = reserve;

  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const row of CF_PL_ROWS) {
      if (row.kind === "group") init[row.key] = true;
    }
    return init;
  });
  const [hoveredQuarter, setHoveredQuarter] = React.useState<number | null>(null);
  const [calloutHovered, setCalloutHovered] = React.useState(false);

  function monthVal(descs: string[], year: number, month: number): number {
    return cashFlows
      .filter((cf) => {
        const d = new Date(cf.date);
        return (
          d.getUTCFullYear() === year &&
          d.getUTCMonth() + 1 === month &&
          descs.some((dm) =>
            cf.description.toLowerCase().includes(dm.toLowerCase()),
          )
        );
      })
      .reduce(
        (s, cf) =>
          s + (cf.type === "inflow" ? Number(cf.amount) : -Number(cf.amount)),
        0,
      );
  }

  const vals: Record<string, number[]> = {};
  for (const row of CF_PL_ROWS) {
    if (row.kind === "item") {
      vals[row.key] = CF_MONTHS.map((m) =>
        monthVal(row.descs, m.year, m.month),
      );
    } else if (row.kind === "subtotal") {
      vals[row.key] = CF_MONTHS.map((_, mi) =>
        row.sumOf.reduce((s, k) => s + (vals[k]?.[mi] ?? 0), 0),
      );
    } else {
      vals[row.key] = CF_MONTHS.map(() => 0);
    }
  }

  const inflowByMonth = CF_MONTHS.map((_, mi) =>
    CF_PL_ROWS.filter((r) => r.kind === "item").reduce(
      (s, r) => s + Math.max(0, vals[r.key]?.[mi] ?? 0),
      0,
    ),
  );
  const outflowByMonth = CF_MONTHS.map((_, mi) =>
    CF_PL_ROWS.filter((r) => r.kind === "item").reduce(
      (s, r) => s + Math.min(0, vals[r.key]?.[mi] ?? 0),
      0,
    ),
  );
  const CORE_EXPENSE_KEYS = ["trib_exp", "nyc_tax", "sara_exp", "fl_tax", "childcare", "phone_util", "cc_pay", "memberships", "golf", "insurance", "pe_loan", "student"];
  const coreOutflowByMonth = CF_MONTHS.map((_, mi) =>
    CORE_EXPENSE_KEYS.reduce((s, k) => {
      const v = vals[k]?.[mi] ?? 0;
      return v < 0 ? s + Math.abs(v) : s;
    }, 0)
  );
  const onetimeOutflowByMonth = CF_MONTHS.map((_, mi) =>
    Math.max(0, Math.abs(outflowByMonth[mi] ?? 0) - (coreOutflowByMonth[mi] ?? 0))
  );
  const netByMonth = CF_MONTHS.map((_, mi) =>
    CF_PL_ROWS.filter((r) => r.kind === "item").reduce(
      (s, r) => s + (vals[r.key]?.[mi] ?? 0),
      0,
    ),
  );
  const annualNet = netByMonth.reduce((s, v) => s + v, 0);

  const cumulativeByMonth = netByMonth.reduce<number[]>((acc, v, i) => {
    acc.push((acc[i - 1] ?? 0) + v);
    return acc;
  }, []);
  const troughIdx = cumulativeByMonth.reduce(
    (minI, v, i) => (v < cumulativeByMonth[minI] ? i : minI),
    0,
  );

  function medianOf(arr: number[]): number {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0
      ? Math.round((s[m - 1] + s[m]) / 2)
      : Math.round(s[m]);
  }

  const monthlyInflows = CF_MONTHS.map((m) =>
    cashFlows
      .filter((cf) => {
        const d = new Date(cf.date);
        return (
          d.getUTCFullYear() === m.year &&
          d.getUTCMonth() + 1 === m.month &&
          cf.type === "inflow"
        );
      })
      .reduce((s, cf) => s + Number(cf.amount), 0),
  );
  const monthlyOutflows = CF_MONTHS.map((m) =>
    cashFlows
      .filter((cf) => {
        const d = new Date(cf.date);
        return (
          d.getUTCFullYear() === m.year &&
          d.getUTCMonth() + 1 === m.month &&
          cf.type === "outflow"
        );
      })
      .reduce((s, cf) => s + Number(cf.amount), 0),
  );
  const medianIn = medianOf(monthlyInflows);
  const medianOut = medianOf(monthlyOutflows);
  const totalIn = monthlyInflows.reduce((s, v) => s + v, 0);
  const totalOut = monthlyOutflows.reduce((s, v) => s + v, 0);

  const heroMonthlyBurn = totalOut / 12;
  const heroRunway = heroMonthlyBurn > 0 ? totalLiquid / heroMonthlyBurn : 0;
  const heroCoveragePct = totalOut > 0 ? (totalIn / totalOut) * 100 : 999;
  const heroCoverageOk = heroCoveragePct >= 100;
  const heroTroughValue = Math.min(...cumulativeByMonth);
  const heroTroughLabel = CF_MONTHS[troughIdx]?.label ?? "";
  const heroNetPos = annualNet >= 0;

  function fmtCell(v: number): string {
    if (v === 0) return "—";
    return v > 0 ? `+${fmt(v)}` : `(${fmt(Math.abs(v))})`;
  }

  const chartData = CF_MONTHS.map((m, i) => ({
    label: m.label,
    inflow: monthlyInflows[i],
    outflow: -monthlyOutflows[i],
    cumulative: cumulativeByMonth[i],
  }));

  return (
    <div className="space-y-5">

      {/* ── CFO Hero Bar ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
        {/* Header row */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <p className="font-display font-bold text-sm text-foreground">Cash Flow Forecast · 2026</p>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded-md">YTD Projection</span>
          </div>
          <AddCashFlowModal clientId={clientId} />
        </div>

        {/* Hero primary KPI */}
        <div className="px-5 pt-4 pb-3 border-b border-border/60">
          <div className="flex items-end gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">12-Month Net Cash Flow</p>
              <p
                className={`text-4xl font-extrabold tabular-nums leading-tight mt-0.5 ${heroNetPos ? "text-emerald-600" : "text-rose-600"}`}
                data-testid="hero-annual-net"
              >
                {heroNetPos ? "+" : ""}{fmt(Math.abs(annualNet), true)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Projected surplus / deficit · Jan–Dec 2026</p>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 mb-1 ${heroNetPos ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800" : "bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-800"}`}>
              {heroNetPos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {heroNetPos ? "Cash Positive" : "Cash Negative"}
            </div>
          </div>
        </div>

        {/* KPI tiles row */}
        <div className="grid grid-cols-8 divide-x divide-border/60">
          {/* Annual Inflows */}
          <div className="px-4 py-3 flex flex-col gap-0.5" data-testid="stat-avg-inflow">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Annual Inflows</p>
            <p className="text-xl font-extrabold tabular-nums leading-none text-emerald-600">
              +{fmt(totalIn, true)}
            </p>
            <p className="text-[9px] text-muted-foreground">med. {fmt(medianIn, true)}/mo</p>
          </div>

          {/* Annual Outflows */}
          <div className="px-4 py-3 flex flex-col gap-0.5" data-testid="stat-avg-outflow">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Annual Outflows</p>
            <p className="text-xl font-extrabold tabular-nums leading-none text-rose-600">
              ({fmt(totalOut, true)})
            </p>
            <p className="text-[9px] text-muted-foreground">med. {fmt(medianOut, true)}/mo</p>
          </div>

          {/* Monthly Burn */}
          <div className="px-4 py-3 flex flex-col gap-0.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Monthly Burn</p>
            <p className="text-xl font-extrabold tabular-nums leading-none text-foreground">
              {fmt(heroMonthlyBurn, true)}
            </p>
            <p className="text-[9px] text-muted-foreground">avg outflows / mo</p>
          </div>

          {/* Cash Runway */}
          <div className="px-4 py-3 flex flex-col gap-0.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Cash Runway</p>
            <p className={`text-xl font-extrabold tabular-nums leading-none ${heroRunway >= 12 ? "text-emerald-600" : heroRunway >= 6 ? "text-amber-600" : "text-rose-600"}`}>
              {heroRunway.toFixed(1)}
            </p>
            <p className="text-[9px] text-muted-foreground">months of expenses</p>
          </div>

          {/* Coverage */}
          <div className="px-4 py-3 flex flex-col gap-0.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Coverage</p>
            <p className={`text-xl font-extrabold tabular-nums leading-none ${heroCoverageOk ? "text-emerald-600" : "text-rose-600"}`}>
              {heroCoveragePct > 999 ? "—" : `${heroCoveragePct.toFixed(0)}%`}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {heroCoverageOk
                ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />
                : <AlertTriangle className="w-2.5 h-2.5 text-rose-500 flex-shrink-0" />}
              <p className="text-[9px] text-muted-foreground">{heroCoverageOk ? "fully funded" : "shortfall risk"}</p>
            </div>
          </div>

          {/* Trough */}
          <div className="px-4 py-3 flex flex-col gap-0.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Trough</p>
            <p className={`text-xl font-extrabold tabular-nums leading-none ${heroTroughValue >= 0 ? "text-foreground" : "text-rose-600"}`}>
              {heroTroughValue >= 0 ? "+" : ""}{fmt(Math.abs(heroTroughValue), true)}
            </p>
            <p className="text-[9px] text-muted-foreground">lowest point · {heroTroughLabel}</p>
          </div>

          {/* Avg Monthly Net */}
          <div className="px-4 py-3 flex flex-col gap-0.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Avg Monthly Net</p>
            <p className={`text-xl font-extrabold tabular-nums leading-none ${annualNet >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {annualNet >= 0 ? "+" : ""}{fmt(Math.round(annualNet / 12), true)}
            </p>
            <p className="text-[9px] text-muted-foreground">net cash flow / mo</p>
          </div>

          {/* Avg Monthly Expenses */}
          <div className="px-4 py-3 flex flex-col gap-0.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Avg Monthly Exp.</p>
            <p className="text-xl font-extrabold tabular-nums leading-none text-rose-600">
              ({fmt(Math.round(totalOut / 12), true)})
            </p>
            <p className="text-[9px] text-muted-foreground">avg expenses / mo</p>
          </div>
        </div>
      </div>

      {/* Cash Balance Walk — waterfall bridge chart */}
      {(() => {
        const Q_DEFS = [
          { qLabel: "First Quarter",  months: [0, 1, 2],  endName: "Mar 31", qIndex: 0 },
          { qLabel: "Second Quarter", months: [3, 4, 5],  endName: "Jun 30", qIndex: 1 },
          { qLabel: "Third Quarter",  months: [6, 7, 8],  endName: "Sep 30", qIndex: 2 },
          { qLabel: "Fourth Quarter", months: [9, 10, 11], endName: "Dec 31", qIndex: 3 },
        ];

        interface WFEntry {
          name: string;
          type: "balance" | "income" | "core" | "onetime";
          invisible: number;
          incomeBar: number;
          coreBar: number;
          onetimeBar: number;
          balanceBar: number;
          actual: number;
          qIndex: number;
        }

        const BLUE = "#1d4ed8";
        const GREEN_BAR = "#16a34a";
        const CORE_RED = "#dc2626";
        const ONE_TIME_RED = "#ea580c";

        const bars: WFEntry[] = [];
        let running = totalLiquid;

        bars.push({ name: "Opening", type: "balance", invisible: 0, incomeBar: 0, coreBar: 0, onetimeBar: 0, balanceBar: running, actual: running, qIndex: -1 });

        Q_DEFS.forEach((q) => {
          const qIncome   = q.months.reduce((s, mi) => s + (inflowByMonth[mi] ?? 0), 0);
          const qCore     = q.months.reduce((s, mi) => s + (coreOutflowByMonth[mi] ?? 0), 0);
          const qOnetime  = q.months.reduce((s, mi) => s + (onetimeOutflowByMonth[mi] ?? 0), 0);
          const prevRun   = running;

          bars.push({ name: `Q${q.qIndex + 1} Income`, type: "income", invisible: prevRun, incomeBar: qIncome, coreBar: 0, onetimeBar: 0, balanceBar: 0, actual: qIncome, qIndex: q.qIndex });
          bars.push({ name: `Q${q.qIndex + 1} Core`, type: "core", invisible: prevRun + qIncome - qCore, incomeBar: 0, coreBar: qCore, onetimeBar: 0, balanceBar: 0, actual: -qCore, qIndex: q.qIndex });
          bars.push({ name: `Q${q.qIndex + 1} One-Time`, type: "onetime", invisible: prevRun + qIncome - qCore - qOnetime, incomeBar: 0, coreBar: 0, onetimeBar: qOnetime, balanceBar: 0, actual: -qOnetime, qIndex: q.qIndex });

          running = prevRun + qIncome - qCore - qOnetime;
          bars.push({ name: q.endName, type: "balance", invisible: 0, incomeBar: 0, coreBar: 0, onetimeBar: 0, balanceBar: Math.max(0, running), actual: running, qIndex: q.qIndex });
        });

        const CustomLabel = (props: any) => {
          const { x, y, width, value, index } = props;
          const entry = bars[index] as WFEntry;
          if (!entry || !value || value === 0) return null;
          const cx = x + width / 2;
          let text = "";
          let color = "";
          if (entry.type === "balance") {
            text = fmt(entry.actual, true);
            color = "#1e40af";
          } else if (entry.type === "income") {
            text = `+${fmtK(entry.actual)}`;
            color = "#15803d";
          } else if (entry.type === "core") {
            text = fmtK(entry.actual);
            color = "#991b1b";
          } else {
            text = fmtK(entry.actual);
            color = "#c2410c";
          }
          return (
            <text
              x={cx} y={y - 6}
              textAnchor="middle"
              fill={color}
              fontSize={10}
              fontWeight="800"
              stroke="white"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {text}
            </text>
          );
        };

        const CustomTick = (props: any) => {
          const { x, y, payload, index } = props;
          const entry = bars[index] as WFEntry;
          const isBalance = entry?.type === "balance";
          return (
            <g transform={`translate(${x},${y})`}>
              <text x={0} y={0} dy={12} textAnchor="middle"
                fill={isBalance ? "#1e40af" : "hsl(var(--muted-foreground))"}
                fontSize={isBalance ? 10 : 9}
                fontWeight={isBalance ? 800 : 500}
              >
                {payload.value}
              </text>
            </g>
          );
        };

        const sep30Bar = bars.find((b) => b.name === "Sep 30");
        const sep30Balance = sep30Bar?.actual ?? 0;

        const Sep30CalloutLabel = (props: any) => {
          const { viewBox } = props;
          if (!viewBox) return null;
          const { x } = viewBox;
          const W = 174;
          const H = 36;
          const lx = x - W / 2;
          return (
            <g style={{ cursor: "default" }}>
              {/* Pill sticker */}
              <rect
                x={lx} y={2} width={W} height={H} rx={7}
                fill="#fef3c7" stroke="#f59e0b" strokeWidth={1.5}
                onMouseEnter={() => setCalloutHovered(true)}
                onMouseLeave={() => setCalloutHovered(false)}
              />
              <text x={x} y={16} textAnchor="middle" fill="#92400e" fontSize={10.5} fontWeight="900" style={{ pointerEvents: "none" }}>
                ⚠ Holding too much cash
              </text>
              <text x={x} y={30} textAnchor="middle" fill="#b45309" fontSize={9} fontWeight="700" style={{ pointerEvents: "none" }}>
                {fmt(sep30Balance, true)} at September trough
              </text>
              {/* Hover tooltip */}
              {calloutHovered && (
                <g>
                  <rect x={x - 128} y={H + 6} width={256} height={42} rx={7} fill="#1e293b" />
                  <text x={x} y={H + 22} textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize={9} fontWeight="600">
                    Even at trough, expected to hold
                  </text>
                  <text x={x} y={H + 38} textAnchor="middle" fill="#fbbf24" fontSize={11} fontWeight="900">
                    {fmt(sep30Balance, true)} of cash
                  </text>
                </g>
              )}
            </g>
          );
        };

        return (
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-5 pt-4 pb-2 border-b border-border flex items-start justify-between">
              <div>
                <p className="font-display font-bold text-base text-foreground">Cash Balance Walk · 2026</p>
                <p className="text-xs text-muted-foreground mt-0.5">Operating &amp; Reserve accounts · quarterly movements</p>
              </div>
              <div className={`text-2xl font-black tabular-nums pt-0.5 ${annualNet >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {annualNet >= 0 ? "+" : ""}{fmt(annualNet, true)}
              </div>
            </div>
            <div className="px-3 pb-3 bg-card">
              {/* Quarter bracket labels */}
              <div className="flex text-[8px] font-bold uppercase tracking-widest text-slate-400 pt-2 pb-1" style={{ paddingLeft: 8 }}>
                {Q_DEFS.map((q, qi) => (
                  <div key={qi} className={`flex-1 text-center border-l border-t pt-1 transition-colors ${hoveredQuarter === qi ? "border-blue-400 text-blue-600 bg-blue-50/40" : "border-slate-200"}`}>
                    {q.qLabel}
                  </div>
                ))}
              </div>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={bars}
                    margin={{ top: 50, right: 16, left: 4, bottom: 0 }}
                    barCategoryGap="18%"
                    onMouseMove={(data: any) => {
                      if (data?.activePayload?.length) {
                        const entry = data.activePayload[0].payload as WFEntry;
                        setHoveredQuarter(entry.qIndex >= 0 ? entry.qIndex : null);
                      }
                    }}
                    onMouseLeave={() => setHoveredQuarter(null)}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={<CustomTick />} axisLine={false} tickLine={false} height={28} />
                    <YAxis hide={true} domain={[100000, 'auto']} />
                    <RechartsTooltip content={() => null} />
                    {/* Sep 30 callout */}
                    <ReferenceLine x="Sep 30" stroke="transparent" label={<Sep30CalloutLabel />} />
                    {/* Invisible spacer */}
                    <Bar dataKey="invisible" stackId="wf" fill="transparent" isAnimationActive={false} />
                    {/* Income — green */}
                    <Bar dataKey="incomeBar" stackId="wf" fill={GREEN_BAR} fillOpacity={0.88} isAnimationActive={false} label={<CustomLabel />} />
                    {/* Core expenses — dark red */}
                    <Bar dataKey="coreBar" stackId="wf" fill={CORE_RED} fillOpacity={0.88} isAnimationActive={false} label={<CustomLabel />} />
                    {/* One-time expenses — orange-red */}
                    <Bar dataKey="onetimeBar" stackId="wf" fill={ONE_TIME_RED} fillOpacity={0.88} isAnimationActive={false} label={<CustomLabel />} />
                    {/* Balance — blue */}
                    <Bar dataKey="balanceBar" stackId="wf" fill={BLUE} fillOpacity={0.82} radius={[3, 3, 0, 0]} isAnimationActive animationDuration={900} label={<CustomLabel />} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-5 px-2 pb-1 text-[9px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: BLUE, opacity: 0.82 }} />Balance</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: GREEN_BAR }} />Income</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: CORE_RED }} />Core Expenses</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: ONE_TIME_RED }} />One-Time</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* P&L Detail Table — collapsible groups, sticky header */}
      {(() => {
        const groupOf: Record<string, string> = {};
        const groupSubtotalKey: Record<string, string | null> = {};
        let curGrp = "";
        for (const row of CF_PL_ROWS) {
          if (row.kind === "group") { curGrp = row.key; groupSubtotalKey[curGrp] = null; }
          else { groupOf[row.key] = curGrp; if (row.kind === "subtotal") groupSubtotalKey[curGrp] = row.key; }
        }

        const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

        const colHl = (mi: number) => hoveredQuarter !== null && Math.floor(mi / 3) === hoveredQuarter;
        const thCls = (mi: number) =>
          `text-right px-1.5 py-2.5 text-[9px] font-black uppercase tracking-widest whitespace-nowrap border-b border-border transition-colors ${
            colHl(mi) ? "bg-blue-200/80 text-blue-800" : "bg-muted/80 text-muted-foreground"
          }`;
        const tdHl = (mi: number) => colHl(mi) ? "bg-blue-50/60" : "";

        return (
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto" style={{ maxHeight: 480, overflowY: "auto" }}>
              <table className="w-full text-xs min-w-[900px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th
                      className="text-left px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-muted/80 border-b border-border"
                      style={{ minWidth: 230 }}
                    >
                      Cash Flow P&L · Jan – Dec 2026
                    </th>
                    {CF_MONTHS.map((m, mi) => (
                      <th key={m.label} className={thCls(mi)} style={{ minWidth: 50 }}>{m.label}</th>
                    ))}
                    <th className="text-right px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap bg-muted/80 border-b border-border" style={{ minWidth: 70 }}>Annual</th>
                  </tr>
                </thead>
                <tbody>
                  {CF_PL_ROWS.map((row) => {
                    if (row.kind === "group") {
                      const isOpen = !collapsed[row.key];
                      const subKey = groupSubtotalKey[row.key];
                      const subVals = subKey ? (vals[subKey] ?? []) : [];
                      const subAnnual = subVals.reduce((s, v) => s + v, 0);
                      return (
                        <tr
                          key={row.key}
                          className="bg-slate-200/70 border-t border-slate-300 cursor-pointer hover:bg-slate-300/60 transition-colors select-none"
                          onClick={() => toggle(row.key)}
                        >
                          <td className="px-4 pl-7 py-1.5 font-black text-[9px] uppercase tracking-widest text-slate-700">
                            <span className="flex items-center gap-2">
                              <span className={`text-slate-500 transition-transform duration-150 inline-block ${isOpen ? "rotate-90" : ""}`}>▶</span>
                              {row.label}
                            </span>
                          </td>
                          {!isOpen && subKey
                            ? subVals.map((v, i) => (
                                <td key={i} className={`text-right px-1.5 py-1.5 tabular-nums font-bold text-[9px] transition-colors ${tdHl(i)} ${v > 0 ? "text-emerald-700" : v < 0 ? "text-rose-600" : "opacity-30"}`}>
                                  {fmtCell(v)}
                                </td>
                              ))
                            : CF_MONTHS.map((_, i) => <td key={i} className={`transition-colors ${tdHl(i)}`} />)
                          }
                          {!isOpen && subKey
                            ? <td className={`text-right px-4 py-1.5 tabular-nums font-bold text-[9px] ${subAnnual >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{fmtCell(subAnnual)}</td>
                            : <td />
                          }
                        </tr>
                      );
                    }

                    const grp = groupOf[row.key];
                    if (collapsed[grp]) return null;

                    const rowVals = vals[row.key] ?? [];
                    const annual = rowVals.reduce((s, v) => s + v, 0);

                    if (row.kind === "item") {
                      return (
                        <tr key={row.key} className="border-t border-border/40 hover:bg-secondary/30 transition-colors bg-card">
                          <td className="px-4 py-1.5 pl-8 text-foreground/75 text-[10px]">{row.label}</td>
                          {rowVals.map((v, i) => (
                            <td key={i} className={`text-right px-1.5 py-1.5 tabular-nums text-[10px] transition-colors ${tdHl(i)} ${v > 0 ? "text-emerald-700" : v < 0 ? "text-rose-600" : "text-muted-foreground/30"}`}>
                              {fmtCell(v)}
                            </td>
                          ))}
                          <td className={`text-right px-4 py-1.5 tabular-nums font-semibold text-[10px] ${annual > 0 ? "text-emerald-700" : annual < 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                            {fmtCell(annual)}
                          </td>
                        </tr>
                      );
                    }

                    if (row.kind === "subtotal") {
                      return (
                        <tr key={row.key} className="border-t border-slate-200 bg-slate-100">
                          <td className="px-4 py-1.5 pl-8 font-bold text-[10px] text-slate-700">{row.label}</td>
                          {rowVals.map((v, i) => (
                            <td key={i} className={`text-right px-1.5 py-1.5 tabular-nums font-bold text-[10px] transition-colors ${tdHl(i)} ${v > 0 ? "text-emerald-700" : v < 0 ? "text-rose-600" : "opacity-30"}`}>
                              {fmtCell(v)}
                            </td>
                          ))}
                          <td className={`text-right px-4 py-1.5 tabular-nums font-bold text-[10px] ${annual >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                            {fmtCell(annual)}
                          </td>
                        </tr>
                      );
                    }
                    return null;
                  })}
                  {/* TOTAL CASH INFLOW */}
                  <tr className="border-t-2 border-slate-300 bg-emerald-50">
                    <td className="px-4 py-2 font-black text-[10px] uppercase tracking-wider text-emerald-800">Total Cash Inflow</td>
                    {inflowByMonth.map((v, i) => (
                      <td key={i} className={`text-right px-1.5 py-2 tabular-nums font-bold text-[10px] text-emerald-700 transition-colors ${tdHl(i)}`}>
                        {fmtCell(v)}
                      </td>
                    ))}
                    <td className="text-right px-4 py-2 tabular-nums font-black text-[10px] text-emerald-700">{fmtCell(inflowByMonth.reduce((s, v) => s + v, 0))}</td>
                  </tr>
                  {/* TOTAL CASH EXPENSES */}
                  <tr className="border-t border-rose-200 bg-rose-50">
                    <td className="px-4 py-2 font-black text-[10px] uppercase tracking-wider text-rose-800">Total Cash Expenses</td>
                    {outflowByMonth.map((v, i) => (
                      <td key={i} className={`text-right px-1.5 py-2 tabular-nums font-bold text-[10px] text-rose-600 transition-colors ${tdHl(i)}`}>
                        {fmtCell(v)}
                      </td>
                    ))}
                    <td className="text-right px-4 py-2 tabular-nums font-black text-[10px] text-rose-600">{fmtCell(outflowByMonth.reduce((s, v) => s + v, 0))}</td>
                  </tr>
                  {/* NET CASH FLOW */}
                  <tr className={`border-t-2 border-border ${annualNet >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
                    <td className={`px-4 py-2.5 font-black text-[11px] uppercase tracking-wider ${annualNet >= 0 ? "text-emerald-800" : "text-rose-800"}`}>Net Cash Flow</td>
                    {netByMonth.map((v, i) => (
                      <td key={i} className={`text-right px-1.5 py-2.5 tabular-nums font-bold text-[10px] transition-colors ${tdHl(i)} ${v >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {fmtCell(v)}
                      </td>
                    ))}
                    <td className={`text-right px-4 py-2.5 tabular-nums font-black text-[11px] ${annualNet >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{fmtCell(annualNet)}</td>
                  </tr>
                  {/* CUMULATIVE NET */}
                  <tr className="border-t-2 border-blue-300 bg-blue-100">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-[11px] uppercase tracking-wider text-blue-800">Cumulative Net</span>
                        <span className="text-[9px] font-normal text-blue-500 normal-case tracking-normal">rolling YTD</span>
                      </div>
                    </td>
                    {cumulativeByMonth.map((v, i) => {
                      const isTrough = i === troughIdx;
                      return (
                        <td key={i} className={`text-right px-1.5 py-2.5 tabular-nums text-[10px] transition-colors ${tdHl(i)}`}>
                          <span className={`relative inline-flex items-center justify-end ${isTrough ? "font-black" : "font-semibold"} ${v >= 0 ? "text-blue-700" : "text-rose-600"}`}>
                            {isTrough && <span className="absolute inset-[-4px] rounded-full border-2 border-rose-500 pointer-events-none" />}
                            {fmtCell(v)}
                          </span>
                        </td>
                      );
                    })}
                    <td className={`text-right px-4 py-2.5 tabular-nums font-black text-[11px] ${cumulativeByMonth[cumulativeByMonth.length - 1] >= 0 ? "text-blue-700" : "text-rose-600"}`}>
                      {fmtCell(cumulativeByMonth[cumulativeByMonth.length - 1])}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Bucket Execution Panel (middle column of each bucket row) ────────────────
function BucketExecutionPanel({
  bucketName,
  current,
  target,
  delta,
  accentColor,
  bgColor,
  avgYield,
  avgYieldAT,
  bpPickup,
  totalAssets,
  onExecute,
  onUndo,
  monthsInputConfig,
  fixedRoute,
}: {
  bucketName: string;
  current: number;
  target: number;
  delta: number;
  accentColor: string;
  bgColor: string;
  avgYield: number;
  avgYieldAT: number;
  bpPickup: number;
  totalAssets: number;
  onExecute?: (from: string, to: string, amount: number) => void;
  onUndo?: (from: string, to: string) => void;
  monthsInputConfig?: {
    defaultMonths: number;
    label: string;
    /* Simple multiply mode (Operating Cash) */
    monthlyUnit?: number;
    /* Dynamic trough mode (Reserve): target = abs(min cumulative over N months) + nextMonthExpenses */
    forecastCumulatives?: number[];
    nextMonthExpenses?: number;
  };
  fixedRoute?: { from: string; to: string; toLabel: string };
}) {
  const [months, setMonths] = useState(monthsInputConfig?.defaultMonths ?? 0);
  const effTarget = (() => {
    if (!monthsInputConfig) return target;
    if (monthsInputConfig.forecastCumulatives) {
      const sliced = monthsInputConfig.forecastCumulatives.slice(0, months);
      const trough = Math.abs(Math.min(0, ...sliced, 0));
      return trough + (monthsInputConfig.nextMonthExpenses ?? 0);
    }
    return (monthsInputConfig.monthlyUnit ?? 0) * months;
  })();
  const effDelta = effTarget - current;

  const needsFunding = effDelta > 1000 && bucketName !== "Grow";

  const BUCKET_NAMES = ["Operating Cash", "Reserve", "Build", "Grow"];
  const defaultFrom = fixedRoute ? fixedRoute.from : (needsFunding ? "Grow" : bucketName);
  const defaultTo   = fixedRoute ? fixedRoute.to   : (needsFunding ? bucketName : (BUCKET_NAMES.find((n) => n !== bucketName) ?? "Reserve"));

  const suggested = Math.abs(effDelta);
  const [rawAmt, setRawAmt] = useState(
    suggested > 0 ? String(Math.round(suggested)) : "",
  );
  const [executed, setExecuted] = useState(false);

  useEffect(() => {
    if (!executed) {
      setRawAmt(suggested > 0 ? String(Math.round(suggested)) : "");
    }
  }, [suggested]);
  const [fromAccount, setFromAccount] = useState(defaultFrom);
  const [toAccount, setToAccount]     = useState(defaultTo);

  const parsedAmt = parseFloat(rawAmt.replace(/[^0-9.]/g, "")) || 0;
  const fmtD = (v: number) => `$${Math.round(v).toLocaleString()}`;
  const fmtInput = (raw: string) => {
    const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? raw : Math.round(n).toLocaleString();
  };

  const AMBER = "#d97706";

  const SVG_CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

  return (
    <div className="w-[17rem] flex-shrink-0 border-l border-r border-border bg-card flex flex-col">
      <div className="flex-1 px-5 py-5 flex flex-col gap-4">

        {/* Months stepper — only for Operating Cash / Reserve */}
        {monthsInputConfig && (() => {
          const maxMonths = monthsInputConfig.forecastCumulatives?.length ?? 99;
          return (
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
                Target Coverage
              </p>
              <div className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3 border border-border">
                <button
                  onClick={() => setMonths((m) => Math.max(1, m - 1))}
                  className="w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center text-sm font-bold text-muted-foreground hover:bg-muted transition-colors select-none"
                >−</button>
                <div className="flex-1 text-center">
                  <span className="font-black tabular-nums text-foreground text-[24px]">
                    {months}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground ml-1.5 leading-none">
                    {monthsInputConfig.label}
                  </span>
                </div>
                <button
                  onClick={() => setMonths((m) => Math.min(m + 1, maxMonths))}
                  className="w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center text-sm font-bold text-muted-foreground hover:bg-muted transition-colors select-none"
                >+</button>
              </div>
            </div>
          );
        })()}

        {/* ── Transfer Amount ── */}
        {executed ? (
          <div className="rounded-lg px-3 py-2.5 flex items-start gap-2 bg-emerald-50 border border-emerald-200">
            <span className="text-base leading-none mt-0.5 text-emerald-600">✓</span>
            <div>
              <p className="text-[10px] font-black text-emerald-800">Transfer Executed</p>
              <p className="text-[9px] text-emerald-600 tabular-nums mt-0.5">
                {fmtD(parsedAmt)} moved{" "}
                <span className="font-semibold text-emerald-700">{fromAccount} → {toAccount}</span>
              </p>
              <p className="text-[9px] tabular-nums mt-0.5 font-bold" style={{ color: AMBER }}>
                New balance: {fmtD(needsFunding ? current + parsedAmt : current - parsedAmt)}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Current / Target boxes */}
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5">
                <p className="text-[8px] uppercase tracking-widest font-bold text-muted-foreground mb-1">Current</p>
                <p className="font-black tabular-nums text-foreground text-[13px]">{fmtD(current)}</p>
              </div>
              <div className="flex-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                <p className="text-[8px] uppercase tracking-widest font-bold mb-1" style={{ color: AMBER }}>Target</p>
                <p className="font-black tabular-nums text-[13px]" style={{ color: AMBER }}>{fmtD(effTarget)}</p>
              </div>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
              <p className="text-[8px] uppercase tracking-widest font-bold mb-1" style={{ color: AMBER }}>
                Transfer Amount
              </p>
              <input
                type="text"
                inputMode="numeric"
                value={fmtInput(rawAmt)}
                onChange={(e) => { setRawAmt(e.target.value.replace(/,/g, "")); setExecuted(false); }}
                placeholder="0"
                className="w-full text-[13px] font-black tabular-nums focus:outline-none bg-transparent"
                style={{ color: AMBER }}
              />
            </div>

            {/* Route */}
            <div>
              <p className="text-[9px] uppercase tracking-wider font-bold mb-2 text-muted-foreground">Route</p>
              {fixedRoute ? (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">From</p>
                    <p className="text-[11px] font-semibold text-foreground truncate">{fixedRoute.from}</p>
                  </div>
                  <span className="text-muted-foreground text-sm flex-shrink-0">→</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: AMBER }}>To</p>
                    <p className="text-[11px] font-bold truncate" style={{ color: AMBER }}>{fixedRoute.toLabel}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] uppercase tracking-wider mb-0.5 font-semibold text-muted-foreground">From</p>
                    <select
                      value={fromAccount}
                      onChange={e => setFromAccount(e.target.value)}
                      className="w-full text-[11px] font-semibold text-foreground rounded-md px-2 py-1.5 focus:outline-none appearance-none cursor-pointer bg-background border border-border"
                      style={{
                        backgroundImage: SVG_CHEVRON,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 6px center",
                        paddingRight: "22px",
                      }}
                    >
                      {BUCKET_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <span className="flex-shrink-0 mt-4 text-sm text-muted-foreground">→</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] uppercase tracking-wider mb-0.5 font-semibold text-muted-foreground">To</p>
                    <select
                      value={toAccount}
                      onChange={e => setToAccount(e.target.value)}
                      className="w-full text-[11px] font-semibold rounded-md px-2 py-1.5 focus:outline-none appearance-none cursor-pointer bg-background border border-border"
                      style={{
                        color: AMBER,
                        backgroundImage: SVG_CHEVRON,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 6px center",
                        paddingRight: "22px",
                      }}
                    >
                      {BUCKET_NAMES.filter((n) => n !== fromAccount).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {/* Execute / Undo button */}
      <div className="px-5 pb-5 pt-3 border-t border-border">
        {executed ? (
          <button
            onClick={() => { setExecuted(false); onUndo?.(fromAccount, toAccount); }}
            className="w-full py-2 rounded-lg text-xs font-black uppercase tracking-widest border border-border transition-colors text-muted-foreground hover:bg-muted"
          >
            Undo Transfer
          </button>
        ) : (
          <button
            onClick={() => { setExecuted(true); onExecute?.(fromAccount, toAccount, parsedAmt); }}
            disabled={parsedAmt <= 0}
            className="w-full py-2.5 rounded-lg text-xs font-black uppercase tracking-widest text-white transition-opacity disabled:opacity-30"
            style={{ background: parsedAmt > 0 ? bgColor : "#94a3b8" }}
          >
            Execute Transfer
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Bucket Product Panel (right column of each bucket row) ──────────────────
function BucketProductPanel({
  bgColor,
  accentColor,
  products,
  currentAvgYieldAT,
  hasPendingTransfer,
  bucketName,
  onSelectionChange,
}: {
  bgColor: string;
  accentColor: string;
  products: BucketProduct[];
  currentAvgYieldAT: number;
  hasPendingTransfer?: boolean;
  bucketName: string;
  onSelectionChange?: (selections: Array<{ product: BucketProduct; alloc: number }>) => void;
}) {
  const top3 = products.slice(0, 3);
  const parseAT = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  const maxAT = top3.length ? Math.max(...top3.map((p) => parseAT(p.atYield))) : 0;
  const highestYieldIdx = top3.findIndex((p) => parseAT(p.atYield) === maxAT && maxAT > 0);
  const initialIdx = highestYieldIdx >= 0 ? highestYieldIdx : top3.length > 0 ? 0 : -1;

  const [selected, setSelected] = useState<Set<number>>(
    new Set(initialIdx >= 0 ? [initialIdx] : []),
  );
  const [allocations, setAllocations] = useState<Record<number, number>>(
    initialIdx >= 0 ? { [initialIdx]: 100 } : {},
  );
  const [staged, setStaged] = useState(false);

  function evenSplit(indices: number[]): Record<number, number> {
    if (indices.length === 0) return {};
    const each = Math.floor(100 / indices.length);
    const rem = 100 - each * indices.length;
    return Object.fromEntries(
      indices.map((idx, pos) => [idx, each + (pos === 0 ? rem : 0)]),
    );
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      const arr = Array.from(next);
      const newAllocs = evenSplit(arr);
      setAllocations(newAllocs);
      setStaged(false);
      onSelectionChange?.(arr.map(idx => ({ product: top3[idx], alloc: newAllocs[idx] ?? 0 })));
      return next;
    });
  }

  function setAlloc(i: number, val: string) {
    const n = Math.min(100, Math.max(0, parseInt(val) || 0));
    setAllocations((prev) => {
      const next = { ...prev, [i]: n };
      const arr = Array.from(selected);
      onSelectionChange?.(arr.map(idx => ({ product: top3[idx], alloc: next[idx] ?? 0 })));
      return next;
    });
    setStaged(false);
  }

  const selectedArr = Array.from(selected);
  const totalPct = selectedArr.reduce((s, i) => s + (allocations[i] ?? 0), 0);
  const pctValid = totalPct === 100;
  const multiSelect = selected.size > 1;

  return (
    <div className="w-[20rem] flex-shrink-0 flex flex-col border-l border-border bg-card">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">
          Recommended Products
        </p>
        <div className="flex items-center gap-2">
          {multiSelect && (
            <span className="text-[9px] font-bold tabular-nums" style={{ color: pctValid ? "#22c55e" : "#f43f5e" }}>
              {totalPct}% {pctValid ? "✓" : `(need ${100 - totalPct > 0 ? "+" : ""}${100 - totalPct}%)`}
            </span>
          )}
          <span className="text-[9px] text-muted-foreground tabular-nums">
            {selected.size} selected
          </span>
        </div>
      </div>
      <div className="flex-1 px-2.5 py-2.5 flex flex-col gap-1.5">
        {top3.map((p, i) => {
          const checked = selected.has(i);
          const productAT = parseFloat(p.atYield.replace(/[^0-9.]/g, ""));
          const pickupVal = !isNaN(productAT) && productAT > 0 ? productAT - currentAvgYieldAT : NaN;
          const pickupStr = isNaN(pickupVal) ? "—" : `${pickupVal >= 0 ? "+" : ""}${pickupVal.toFixed(2)}%`;
          const pickupPositive = !isNaN(pickupVal) && pickupVal > 0;
          return (
            <div
              key={i}
              onClick={() => toggle(i)}
              className="rounded-lg border text-left transition-all cursor-pointer"
              style={{
                borderColor: checked ? bgColor + "60" : undefined,
                background: checked ? bgColor + "0d" : undefined,
              }}
            >
              {/* Top row: checkbox + name + % input */}
              <div className="w-full p-2.5 pb-1.5 text-left">
                <div className="flex items-start gap-2">
                  <div
                    className="w-3.5 h-3.5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border-2 transition-colors"
                    style={{
                      background: checked ? bgColor : "transparent",
                      borderColor: checked ? bgColor : "#94a3b8",
                    }}
                  >
                    {checked && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {highestYieldIdx === i && (
                      <span className="inline-block text-[7px] font-black px-1.5 py-px rounded bg-emerald-100 text-emerald-700 border border-emerald-200 leading-none mb-1">
                        ▲ Highest Yield
                      </span>
                    )}
                    <p className="text-[13px] font-semibold text-foreground leading-snug">
                      {p.name}
                    </p>
                  </div>
                  {/* Inline % input */}
                  {checked && (
                    <div className="flex items-center gap-0.5 flex-shrink-0 self-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={allocations[i] ?? 0}
                        onChange={e => setAlloc(i, e.target.value)}
                        className="w-12 text-right text-[11px] font-black tabular-nums rounded border px-1 py-0.5 focus:outline-none focus:ring-1 bg-background"
                        style={{ color: bgColor, borderColor: bgColor + "80" }}
                      />
                      <span className="text-[10px] font-bold" style={{ color: bgColor }}>%</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Yield metrics row — hidden for Grow bucket */}
              {bucketName !== "Grow" && (
                <div className="px-2.5 pb-2 flex items-center gap-3 ml-5">
                  <div>
                    <div className="text-[7px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Yield</div>
                    <div className="text-[9px] font-bold text-foreground tabular-nums">{p.grossYield}</div>
                  </div>
                  <div>
                    <div className="text-[7px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Tax-Eff</div>
                    <div className="text-[9px] font-bold text-foreground tabular-nums">{p.atYield}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-[7px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Pickup</div>
                    <div className="text-[9px] font-bold tabular-nums" style={{ color: isNaN(pickupVal) ? "#94a3b8" : pickupVal > 0 ? "#16a34a" : "#e11d48" }}>
                      {pickupStr}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {top3.length === 0 && (
          <p className="text-xs text-muted-foreground italic mt-2">
            No products mapped
          </p>
        )}
      </div>
      <div className="px-3 pb-4 space-y-2">
        {hasPendingTransfer && !staged && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">Action Required</p>
              <p className="text-[9px] text-amber-600 mt-0.5">Select a product below for the incoming transfer before confirming.</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setStaged(true)}
          disabled={selected.size === 0 || (multiSelect && !pctValid)}
          className="w-full py-2 rounded-lg text-xs font-black uppercase tracking-widest text-white transition-opacity disabled:opacity-30"
          style={{ background: hasPendingTransfer && !staged ? "#d97706" : bgColor }}
        >
          {staged
            ? `✓ Product Change Saved`
            : multiSelect
              ? `Product Change (${selectedArr.map((i) => `${allocations[i] ?? 0}%`).join(" / ")})`
              : `Product Change`}
        </button>
      </div>
    </div>
  );
}

// ─── Money Movement View ──────────────────────────────────────────────────────
const MM_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const MM_BUCKETS = [
  { key: "op",   label: "Operating Cash", color: "#1a3a8a", accent: "#93c5fd", tag: "Checking + Savings" },
  { key: "res",  label: "Reserve",        color: "#7c5200", accent: "#fcd34d", tag: "JPMorgan 100% Treasury MMF" },
  { key: "bld",  label: "Build",          color: "#14532d", accent: "#4ade80", tag: "1yr Treasuries + 2028 Munis" },
  { key: "grw",  label: "Grow",           color: "#3b0764", accent: "#c084fc", tag: "Growth Equity ETFs" },
];

// Starting balances (Jan start)
const MM_BALANCES: Record<string, number[]> = {
  op:  [20939, 20939, 20939, 65939, 24939, 21939, 40439, 35939, 20939, 20939, 24939, 48392, 38440],
  res: [129385, 109759, 107912, 61040, 55111, 52121, 30620, 13591, 11517, 9420, 3319, 0, 129389],
  bld: [226545, 226545, 227042, 227541, 228040, 228541, 229043, 229546, 230050, 230555, 231061, 205324, 273433],
  grw: [2639681, 2655079, 2670567, 2686146, 2701815, 2717575, 2733428, 2749373, 2765411, 2781542, 2797768, 2814088, 2830504],
};

type MMLedgerRow = {
  bucket: string;
  label: string;
  values: number[];
  type: "income" | "expense" | "transfer" | "interest";
};

const MM_LEDGER: MMLedgerRow[] = [
  { bucket: "op",  label: "Income Allocation",            type: "income",   values: [18814,18814,18814,18814,18814,18814,18814,18814,18814,18814,18814,38439] },
  { bucket: "op",  label: "Expenses",                     type: "expense",  values: [-38439,-20939,-20939,-65939,-24939,-21939,-40439,-35939,-20939,-20939,-24939,-48392] },
  { bucket: "op",  label: "Transfer in from Reserve",     type: "transfer", values: [19626,2126,47126,6126,3126,21626,17126,2126,2126,6126,3334,0] },
  { bucket: "op",  label: "Transfer in from Build",       type: "transfer", values: [0,0,0,0,0,0,0,0,0,0,26245,0] },
  { bucket: "res", label: "Transfer to Operating",        type: "transfer", values: [-19626,-2126,-47126,-6126,-3126,-21626,-17126,-2126,-2126,-6126,-3334,0] },
  { bucket: "res", label: "After-Tax Interest",           type: "interest", values: [0,279,254,197,135,125,97,52,29,24,15,4] },
  { bucket: "bld", label: "After-Tax Interest",           type: "interest", values: [0,497,499,500,501,502,503,504,505,506,507,480] },
  { bucket: "bld", label: "Transfer to Operating",        type: "transfer", values: [0,0,0,0,0,0,0,0,0,0,-26245,0] },
  { bucket: "grw", label: "Market Return (est.)",         type: "income",   values: [15398,15488,15579,15669,15760,15853,15945,16038,16131,16226,16320,16416] },
];

const MM_BILLS = [
  { icon: Home,         label: "Mortgage",           institution: "Wells Fargo",     amount: 4847, cadence: "Monthly", bucket: "op",  next: "Apr 1" },
  { icon: CreditCard,   label: "Credit Cards",       institution: "AmEx / Chase",    amount: 2200, cadence: "Monthly", bucket: "op",  next: "Apr 5" },
  { icon: GraduationCap,label: "Buckley School",      institution: "The Buckley School", amount: 2500, cadence: "Monthly", bucket: "op",  next: "Apr 1" },
  { icon: ShieldCheck,  label: "Home + Auto Ins.",   institution: "Chubb",           amount: 660,  cadence: "Monthly", bucket: "op",  next: "Apr 15" },
  { icon: Bolt,         label: "Utilities",          institution: "ConEd / PSEG",    amount: 800,  cadence: "Monthly", bucket: "op",  next: "Apr 12" },
  { icon: Car,          label: "Auto Lease",         institution: "BMW Financial",   amount: 1150, cadence: "Monthly", bucket: "op",  next: "Apr 18" },
  { icon: ArrowLeftRight,label: "Reserve Top-Up",    institution: "GURU Auto",       amount: 0,    cadence: "As needed",bucket:"op",  next: "On deficit" },
  { icon: TrendingUp,   label: "401(k) Contribution",institution: "Fidelity",        amount: 3000, cadence: "Bi-weekly",bucket:"grw", next: "Apr 8" },
];

const MM_GURU_ACTIONS = [
  { month: "Jan", action: "Operating deficit $19,626 — pulled from Reserve MMF",    type: "pull",    amount: 19626 },
  { month: "Feb", action: "Operating surplus — no Reserve draw needed",              type: "balanced",amount: 0 },
  { month: "Mar", action: "Q1 tax + Buckley tuition — pulled $47,126 from Reserve",  type: "pull",    amount: 47126 },
  { month: "Apr", action: "Operating deficit $6,126 — pulled from Reserve MMF",     type: "pull",    amount: 6126 },
  { month: "May", action: "Operating deficit $3,126 — pulled from Reserve MMF",     type: "pull",    amount: 3126 },
  { month: "Jun", action: "Home repair expense — pulled $21,626 from Reserve",       type: "pull",    amount: 21626 },
  { month: "Jul", action: "Vacation draw — pulled $17,126 from Reserve",             type: "pull",    amount: 17126 },
  { month: "Aug", action: "Small operating gap $2,126 — pulled from Reserve MMF",   type: "pull",    amount: 2126 },
  { month: "Sep", action: "Small operating gap $2,126 — pulled from Reserve MMF",   type: "pull",    amount: 2126 },
  { month: "Oct", action: "Holiday prep draw $6,126 — pulled from Reserve MMF",     type: "pull",    amount: 6126 },
  { month: "Nov", action: "Reserve depleted — used Build ladder: $26,245 + $3,334", type: "pull",    amount: 29579 },
  { month: "Dec", action: "Income surplus — Reserve fully replenished to $129,389", type: "replenish",amount: 129389 },
];

function MoneyMovementView({
  assets,
  cashFlows,
  opsCashMonths,
  clientName,
  pendingTransfers = [],
  bucketProductSelections = {},
}: {
  assets: Asset[];
  cashFlows: CashFlow[];
  opsCashMonths: number;
  clientName?: string;
  pendingTransfers?: { from: string; to: string; amount: number }[];
  bucketProductSelections?: Record<string, Array<{ product: BucketProduct; alloc: number }>>;
}) {
  const BASE_MONTHLY_EXPENSE = 20940; // ~monthly recurring expenses from cash flow model
  const minOps = opsCashMonths * BASE_MONTHLY_EXPENSE;

  // ── Derive sub-accounts from assets (same classification as GURU Allocation tab) ──
  const _sn = (desc: string | null | undefined) =>
    (desc ?? "").split("(")[0].split("—")[0].split("–")[0].trim();
  const _rate = (desc: string | null | undefined) => {
    const m = (desc ?? "").match(/(\d+\.?\d+)%/);
    return m ? m[1] : null;
  };
  // Operating Cash = cash checking accounts
  const opsAccts = assets.filter(a =>
    a.type === "cash" && (a.description ?? "").toLowerCase().includes("checking")
  );
  // Reserve = non-checking, non-brokerage cash
  const rsvAccts = assets.filter(a =>
    a.type === "cash" &&
    !(a.description ?? "").toLowerCase().includes("checking") &&
    !(a.description ?? "").toLowerCase().includes("brokerage")
  );
  // Build = fixed-income treasuries
  const bldAccts = assets.filter(a =>
    a.type === "fixed_income" &&
    ((a.description ?? "").toLowerCase().includes("treasur") ||
     (a.description ?? "").toLowerCase().includes("t-bill"))
  );
  const rsvTotal = Math.max(rsvAccts.reduce((s, a) => s + Number(a.value), 0), 1);
  const bldTotal = Math.max(bldAccts.reduce((s, a) => s + Number(a.value), 0), 1);
  const primaryOpsAcct = opsAccts.find(a => !(a.description ?? "").toLowerCase().includes("excess")) ?? opsAccts[0];
  const excessOpsAccts = opsAccts.filter(a => (a.description ?? "").toLowerCase().includes("excess"));
  const primaryOpsName = primaryOpsAcct ? _sn(primaryOpsAcct.description) : "Primary Checking";

  // Inline CSS hover tooltip renderer (replaces browser-native title attribute)
  const cellTip = (lines: Array<string | null>) => {
    const filtered = lines.filter(Boolean) as string[];
    return (
      <div className="absolute top-full left-0 z-[999] hidden group-hover:block pointer-events-none min-w-[200px]">
        <div className="bg-slate-900 border border-slate-600 text-white text-[9px] rounded-lg shadow-2xl px-3 py-2.5 mt-1">
          {filtered.map((l, i) =>
            l.startsWith("─")
              ? <div key={i} className="border-t border-slate-600 my-1.5" />
              : <div key={i} className="whitespace-nowrap leading-relaxed">{l}</div>
          )}
        </div>
      </div>
    );
  };
  const [mmView, setMmView] = useState<'table'|'flow'>('flow');
  const [selectedMonth, setSelectedMonth] = useState(1); // February = T-bill maturity month

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // ── All values sourced from updated Cash Flow Model (2-month Ops Cash target) ─

  // ══════════════════════════════════════════════════════════════════════════════
  // BASELINE ACCOUNT BALANCES — Prototype_Model_v4.xlsx  (Jan–Dec)
  // AS-IS state before advisor makes any GURU Allocation changes.
  // Sub-account arrays feed both the individual rows AND the bucket totals.
  // ══════════════════════════════════════════════════════════════════════════════

  // ── OPERATING CASH sub-accounts ──────────────────────────────────────────────
  // Citizens is floored at $0; any shortfall is absorbed by Chase so the total stays identical.
  const CHASE_BAL          = [25050,18814,18814,18814,18814,18814,18814,13046,10920, 8794, 2668,38439];
  const CITIZENS_CHECK_BAL = [87374,91485,89360,42234,36109,32983,11357,    0,    0,    0,    0,11319];
  const IMM_BAL            = CHASE_BAL.map((v, i) => v + CITIZENS_CHECK_BAL[i]);
  // Jan→Dec: 112424, 110299, 108173, 61048, 54922, 51797, 30171, 13045, 10920, 8794, 2668, 49759

  // ── Ops Cash flow details (for hover tooltips) ────────────────────────────────
  const INCOME_TO_IMM  = [18814,18814,18814,18814,18814,18814,18814,18814,18814,18814,18814,38439];
  const EXPENSES       = [-38439,-20939,-20939,-65939,-24939,-21939,-40439,-35939,-20939,-20939,-24939,-48392];
  const FROM_ST_TO_IMM = [0,0,0,0,0,0,0,0,0,0,0,0]; // no auto-draw in baseline
  const IMM_INT        = [0,0,0,0,0,0,0,0,0,0,0,0];

  // ── RESERVE sub-accounts ─────────────────────────────────────────────────────
  const CITIZENS_MM_BAL = [225000,225388,225776,226165,226555,226945,227336,227728,228120,228512,228906,369271];
  const CAPONE_BAL      = [15000,15000,15000,15000,15000,15000,15000,15000,15000,15000,15000,15000];
  const ST_BAL          = CITIZENS_MM_BAL.map((v, i) => v + CAPONE_BAL[i]);
  // Jan→Dec: 240000, 240388, 240776, 241165, 241555, 241945, 242336, 242728, 243120, 243512, 243906, 384271

  // ── Reserve flow details (for hover tooltips) ──────────────────────────────
  const INCOME_TO_ST = [0,0,0,0,0,0,0,0,0,0,0,0];
  const FROM_ST_OUT  = [0,0,0,0,0,0,0,0,0,0,0,0];
  const ST_INT       = [0,388,388,389,390,390,391,392,392,392,394,394];

  // ── BUILD sub-accounts ───────────────────────────────────────────────────────
  const TREASURIES_BAL = [135000,135289,135578,135868,136159,136450,136742,137035,137328,137622,137916,138211];
  const MT_BAL         = TREASURIES_BAL;

  // ── Build flow details (for hover tooltips) ──────────────────────────────
  const INCOME_TO_MT = [0,0,0,0,0,0,0,0,0,0,0,0];
  const FROM_MT_OUT  = [0,0,0,0,0,0,0,0,0,0,0,0];
  const MT_INT       = [0,289,289,290,291,291,292,293,293,294,294,295];

  // ── GROW (Long-Term) ─────────────────────────────────────────────────────────
  const GROW_BAL = [2618683,2633959,2649323,2664778,2680322,2695958,2711684,2727502,2743413,2759416,2775512,2791703];

  // ── TOTAL NET WORTH ──────────────────────────────────────────────────────────
  const NET_WORTH = IMM_BAL.map((v, i) => v + ST_BAL[i] + MT_BAL[i] + GROW_BAL[i]);

  // ══════════════════════════════════════════════════════════════════════════════
  // GURU PENDING CHANGES — adjust baseline arrays when advisor has made changes
  // on the GURU Allocation tab (transfers between buckets + product selections).
  // ══════════════════════════════════════════════════════════════════════════════
  const _parseAT = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;

  const hasChanges =
    pendingTransfers.length > 0 ||
    Object.values(bucketProductSelections).some(s => s.length > 0);

  // ── Generic net delta per bucket (positive = net inflow TO that bucket) ───────
  const _bucketNetIn = (name: string) =>
    pendingTransfers.filter(t => t.to === name).reduce((s, t) => s + t.amount, 0) -
    pendingTransfers.filter(t => t.from === name).reduce((s, t) => s + t.amount, 0);

  const _opsNetOut  = -_bucketNetIn("Operating Cash"); // positive = leaves Ops
  const _rsvNetIn   =  _bucketNetIn("Reserve");        // positive = enters Reserve
  const _bldNetIn   =  _bucketNetIn("Build");          // positive = enters Build

  // ── Reserve yield settings ────────────────────────────────────────────────────
  const _baseRsvMonthly = 388 / 225000; // inferred from baseline: ~2.07% p.a.
  const rsvSels = bucketProductSelections["Reserve"] ?? [];
  const _rsvATYield = rsvSels.length > 0
    ? rsvSels.reduce((s, sel) => s + _parseAT(sel.product.atYield) * (sel.alloc / 100), 0)
    : null;
  const _rsvMonthly = _rsvATYield !== null ? _rsvATYield / 100 / 12 : _baseRsvMonthly;

  // ── Build yield settings ──────────────────────────────────────────────────────
  const _baseBldMonthly = 289 / 135000; // inferred from baseline: ~2.57% p.a.
  const bldSels = bucketProductSelections["Build"] ?? [];
  const _bldATYield = bldSels.length > 0
    ? bldSels.reduce((s, sel) => s + _parseAT(sel.product.atYield) * (sel.alloc / 100), 0)
    : null;
  const _bldMonthly = _bldATYield !== null ? _bldATYield / 100 / 12 : _baseBldMonthly;

  // ── Cash-flow simulation (when Ops → Reserve transfer is pending) ─────────────
  // The Kesslers' monthly net cash flow (income - expenses) is always negative,
  // so Citizens MM draws down each month to keep Operating Cash at the 2-month floor.
  const _opsToRsv = pendingTransfers
    .filter(t => t.from === "Operating Cash" && t.to === "Reserve")
    .reduce((s, t) => s + t.amount, 0);

  type SimResult = { effOps: number[]; effMM: number[]; draws: number[] };
  const _sim: SimResult | null = (() => {
    if (_opsToRsv <= 0) return null;
    const target = minOps; // 2-month floor
    let ops = 132050 - _opsToRsv;      // Ops balance after initial transfer
    let mm  = 225000 + _rsvNetIn;      // Citizens MM after receiving transfer
    const effOps: number[] = [];
    const effMM:  number[] = [];
    const draws:  number[] = [];
    for (let i = 0; i < 12; i++) {
      // Apply month's net cash flow to Ops
      const netFlow = INCOME_TO_IMM[i] + EXPENSES[i];
      ops += netFlow;
      // If Ops falls below 2-month floor, draw the difference from Citizens MM
      let draw = 0;
      if (ops < target) {
        draw = Math.round(target - ops);
        mm  -= draw;
        ops  = target;
      }
      // Citizens MM earns interest on remaining balance
      const interest = Math.round(mm * _rsvMonthly);
      mm += interest;
      effOps.push(Math.round(ops));
      effMM.push(Math.round(mm));
      draws.push(draw);
    }
    return { effOps, effMM, draws };
  })();

  // ── Effective Citizens Checking & Chase ───────────────────────────────────────
  // With simulation: checking accounts show $0 — all cash swept to CIT MM.
  // The operating floor is maintained by monthly CIT MM draws (shown in the Autopilot row).
  // Without simulation: subtract the generic transfer amount (Citizens absorbs first).
  const EFF_CITIZENS_CHECK: number[] = _sim
    ? new Array(12).fill(0)
    : (hasChanges
        ? CITIZENS_CHECK_BAL.map(v => Math.max(0, v - _opsNetOut))
        : CITIZENS_CHECK_BAL);

  const EFF_CHASE: number[] = _sim
    ? new Array(12).fill(0)
    : (hasChanges
        ? CHASE_BAL.map((v, i) => {
            const citizensAbsorbed = Math.min(CITIZENS_CHECK_BAL[i], _opsNetOut);
            const chaseNeed = Math.max(0, _opsNetOut - citizensAbsorbed);
            return Math.max(0, v - chaseNeed);
          })
        : CHASE_BAL);

  // When simulation is active: use the simulated Ops total directly for the bucket total
  // and the floor check (not the sum of zero checking accounts).
  const EFF_IMM: number[] = _sim
    ? _sim.effOps
    : EFF_CHASE.map((v, i) => v + EFF_CITIZENS_CHECK[i]);

  // ── Effective Citizens MM (Reserve) ──────────────────────────────────────────
  // With simulation: balance reflects monthly draws to cover Ops shortfalls.
  // Without simulation: simple interest compounding on the post-transfer opening.
  const _rsvOpeningBase = 225000 + _rsvNetIn;
  const EFF_CITIZENS_MM: number[] = (() => {
    if (_sim) return _sim.effMM;
    if (!hasChanges && _rsvATYield === null) return CITIZENS_MM_BAL;
    const result: number[] = [];
    let bal = _rsvOpeningBase;
    for (let i = 0; i < 12; i++) {
      const interest = Math.round(bal * _rsvMonthly);
      bal += interest;
      result.push(bal);
    }
    return result;
  })();

  const EFF_CAPONE = CAPONE_BAL;
  const EFF_ST = EFF_CITIZENS_MM.map((v, i) => v + EFF_CAPONE[i]);

  // ── Effective Treasuries (Build) ──────────────────────────────────────────────
  const _bldOpeningBase = 135000 + _bldNetIn;
  const EFF_TREASURIES: number[] = (() => {
    if (!hasChanges && _bldATYield === null) return TREASURIES_BAL;
    const result: number[] = [];
    let bal = _bldOpeningBase;
    for (let i = 0; i < 12; i++) {
      const interest = Math.round(bal * _bldMonthly);
      bal += interest;
      result.push(bal);
    }
    return result;
  })();

  const EFF_MT    = EFF_TREASURIES;
  const EFF_GROW  = GROW_BAL;
  const EFF_NET_WORTH = EFF_IMM.map((v, i) => v + EFF_ST[i] + EFF_MT[i] + EFF_GROW[i]);

  // ── Effective interest/draw arrays (for hover tooltips) ───────────────────────
  const EFF_ST_INT: number[] = EFF_CITIZENS_MM.map((v, i) =>
    i === 0 ? 0 : Math.round(_rsvOpeningBase * _rsvMonthly)
  );
  const EFF_MT_INT: number[] = EFF_TREASURIES.map((v, i) =>
    i === 0 ? 0 : Math.round(_bldOpeningBase * _bldMonthly)
  );
  // Monthly draws from Citizens MM → Operating Cash (shows in flow tooltips)
  const EFF_FROM_ST_TO_IMM: number[] = _sim ? _sim.draws : FROM_ST_TO_IMM;

  // ── Starting balances (prior month end; first month uses model opening) ──────
  const OPS_START  = [132050, ...EFF_IMM.slice(0, 11)];
  const RSV_START  = [240000, ...EFF_ST.slice(0, 11)];
  const BLD_START  = [135000, ...EFF_MT.slice(0, 11)];
  const GROW_START = [2603496,...EFF_GROW.slice(0, 11)];

  // ── Per-month special/irregular expenses (total = base $20,939 + specials) ────
  type SpecialItem = { label: string; amount: number };
  const SPECIALS: SpecialItem[][] = [
    [{ label: "NYC Property Tax",     amount: 17500 }],                                           // Jan
    [],                                                                                            // Feb
    [],                                                                                            // Mar
    [{ label: "Q1 Est. Tax",          amount: 30000 }, { label: "Buckley Tuition", amount: 15000 }], // Apr
    [{ label: "Memorial Day Travel",  amount:  4000 }],                                           // May
    [{ label: "Weekend Travel",       amount:  1000 }],                                           // Jun
    [{ label: "Buckley Tuition Q3",   amount: 15000 }, { label: "Summer Vacation", amount: 4500 }], // Jul
    [{ label: "Buckley Tuition Q3",   amount: 15000 }],                                           // Aug
    [],                                                                                            // Sep
    [],                                                                                            // Oct
    [{ label: "Year-end Expenses",    amount:  4000 }],                                           // Nov
    [{ label: "Q4 Est. Tax / Gifts",  amount: 27453 }],                                           // Dec
  ];

  const fmtN = (v: number): React.ReactNode => {
    if (v === 0) return <span className="text-slate-300">—</span>;
    const s = Math.abs(v).toLocaleString("en-US");
    if (v > 0) return <span className="text-emerald-700 font-medium">+${s}</span>;
    return <span className="text-red-600 font-medium">{`($${s})`}</span>;
  };

  const fmtBal = (v: number) => v < 0
    ? `(${Math.abs(v).toLocaleString("en-US")})`
    : `$${v.toLocaleString("en-US")}`;

  const minOpsOk = Math.min(...EFF_IMM) >= minOps;

  type SubRow = { label: string; values: number[]; linkId?: string; ticker?: boolean };

  const Section = ({
    subrows,
    bucketLabel,
    balances,
    color,
  }: {
    subrows: SubRow[];
    bucketLabel: string;
    balances: number[];
    color: string;
  }) => (
    <>
      {subrows.map((row, i) => {
        const isLess = row.label.startsWith("Less:");
        const isPlus = row.label.startsWith("Plus:");
        const linkBorder = row.linkId === 'rsv-ops' ? 'border-l-4 border-blue-400' : '';
        const hasAnyValue = row.values.some(v => v !== 0);
        return (
          <React.Fragment key={i}>
            <tr className={`border-b transition-colors border-slate-100 ${isLess ? 'bg-red-50/50 hover:bg-red-50' : isPlus ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-slate-50/60'}`}>
              <td className={`py-2 text-[11px] leading-snug w-[300px] ${linkBorder ? `pl-2 pr-4 ${linkBorder}` : 'px-4'} ${isLess ? 'text-red-600 font-semibold' : isPlus ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                {isLess && <span className="mr-1 opacity-60">↓</span>}
                {isPlus && <span className="mr-1 opacity-60">↑</span>}
                {row.label.replace(/^Less: /, '').replace(/^Plus: /, '')}
              </td>
              {row.values.map((v, mi) => (
                <td key={mi} className="px-2 py-2 text-[11px] text-center tabular-nums whitespace-nowrap">
                  {fmtN(v)}
                </td>
              ))}
            </tr>
            {row.ticker && hasAnyValue && (
              <tr className="h-5 border-b border-blue-100/60" style={{ backgroundColor: "rgba(29,78,216,0.04)" }}>
                <td colSpan={13} className="px-4 py-0 overflow-hidden">
                  <div className="relative h-4 flex items-center gap-2.5">
                    <span className="text-[7px] font-black uppercase tracking-widest text-blue-400 flex-shrink-0 z-10 whitespace-nowrap">GURU Autopilot</span>
                    <div className="flex-1 relative h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(29,78,216,0.12)" }}>
                      <motion.div
                        className="absolute top-0 h-full w-10 rounded-full"
                        style={{ backgroundColor: "#3b82f6", boxShadow: "0 0 8px #3b82f6, 0 0 16px #3b82f680" }}
                        animate={{ x: ["-40px", "120%"] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                      />
                      <motion.div
                        className="absolute top-0 h-full w-6 rounded-full"
                        style={{ backgroundColor: "#93c5fd", boxShadow: "0 0 6px #93c5fd" }}
                        animate={{ x: ["-24px", "120%"] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "linear", delay: 0.9 }}
                      />
                      <motion.div
                        className="absolute top-0 h-full w-4 rounded-full"
                        style={{ backgroundColor: "#bfdbfe" }}
                        animate={{ x: ["-16px", "120%"] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "linear", delay: 1.7 }}
                      />
                    </div>
                    <span className="text-[7px] font-black uppercase tracking-widest text-blue-400 flex-shrink-0 z-10 whitespace-nowrap">Auto-draw active</span>
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        );
      })}
      <tr className="border-y-2 border-white/20" style={{ backgroundColor: color }}>
        <td className="px-4 py-3 text-[12px] font-black uppercase tracking-wide text-white">{bucketLabel}</td>
        {balances.map((v, mi) => (
          <td key={mi} className="px-2 py-3 text-[11px] font-black text-center tabular-nums whitespace-nowrap text-white">
            {fmtBal(v)}
          </td>
        ))}
      </tr>
    </>
  );

  // ── Schematic view per-month data ────────────────────────────────────────────
  const sm = selectedMonth;
  const opsStart  = OPS_START[sm];
  const rsvStart  = RSV_START[sm];
  const bldStart  = BLD_START[sm];
  const growStart = GROW_START[sm];
  const income    = INCOME_TO_IMM[sm];
  const rsvDraw   = EFF_FROM_ST_TO_IMM[sm];
  const bldDraw   = 0; // Build no longer draws to Ops directly
  const opsEnd    = EFF_IMM[sm];
  const rsvEnd    = EFF_ST[sm];
  const bldEnd    = EFF_MT[sm];
  const growEnd   = EFF_GROW[sm];
  const rsvInt    = EFF_ST_INT[sm];
  const bldInt    = EFF_MT_INT[sm];
  const rsvSweep  = INCOME_TO_ST[sm];
  const bldSweep  = INCOME_TO_MT[sm];
  const specials  = SPECIALS[sm];
  const totalExp  = Math.abs(EXPENSES[sm]);

  // Fixed recurring expense buckets (sum = $20,939 base)
  const BASE_EXP = [
    { label: "Housing & Property",  amount: 9036,  dot: "#0284c7" },
    { label: "Childcare",           amount: 4333,  dot: "#7c3aed" },
    { label: "Credit Cards",         amount: 3500,  dot: "#ea580c" },
    { label: "Debt Service",        amount: 1187,  dot: "#dc2626" },
    { label: "Other Recurring",     amount: 2883,  dot: "#64748b" },
  ];

  // ── Treasury ladder (GURU's strategic reserve structure) — shared across both views ──
  const TBILLS = [
    { label: "Jul '26", maturesSm: 6,  face: 65000, rate: '4.95', tenor: '3-mo' },
    { label: "Oct '26", maturesSm: 9,  face: 65000, rate: '4.85', tenor: '6-mo' },
    { label: "Jan '27", maturesSm: 12, face: 65000, rate: '4.75', tenor: '9-mo' },
    { label: "Apr '27", maturesSm: 15, face: 65000, rate: '4.65', tenor: '12-mo' },
  ] as const;
  // MMF balance per month — 3-month buffer, drains on draws, refills when T-bills mature
  const MMF_DISPLAY = [62777,43151,59277,62777,59651,42525,62777,62777,62777,62777,33198,62777];
  const mmfBal = MMF_DISPLAY[sm];
  const maturingBillIdx = sm === 6 ? 0 : sm === 9 ? 1 : -1;
  const maturingBill = maturingBillIdx >= 0 ? TBILLS[maturingBillIdx as 0 | 1] : null;
  const getBillState = (i: number): 'upcoming' | 'maturing' | 'matured' => {
    const b = TBILLS[i];
    if (b.maturesSm === sm) return 'maturing';
    if (b.maturesSm < 12 && sm > b.maturesSm) return 'matured';
    return 'upcoming';
  };
  const upcomingLabels = TBILLS
    .filter((b, i) => getBillState(i) === 'upcoming' && b.maturesSm < 12)
    .map(b => b.label);

  // ── HARDCODED DEMO DATA — Prototype_Model_v4.xlsx (Jan–Dec 2026) ─────────────
  // Month-end balances for each account in the GURU-managed scenario.
  // Accounts showing $0 represent old/consolidated accounts kept for reference.
  const HC_CHASE           = new Array(12).fill(0) as number[];
  const HC_CITIZENS_CHECK  = new Array(12).fill(0) as number[];
  const HC_CIT_MM          = [41879,86879,90879,46879,62379,76379,56879,41879,45879,73332,86832,76879];
  const HC_OPS_TOTAL       = HC_CIT_MM;

  const HC_CITIZENS_MM     = new Array(12).fill(0) as number[];
  const HC_CAPONE          = new Array(12).fill(0) as number[];
  const HC_JPM_MMF         = [47126,7865,2049,41048,19660,2745,11161,9178,3191,22946,3408,179127];
  const HC_TBILL_1MO       = [7478,0,0,0,0,0,0,0,0,0,0,0];
  const HC_TBILL_3MO       = [41877,41877,41877,0,0,0,0,0,0,0,0,0];
  const HC_TBILL_6MO       = [10377,10377,10377,10377,10377,10377,0,0,0,0,0,0];
  const HC_TBILL_9MO       = [49204,49204,49204,49204,49204,49204,49204,49204,49204,0,0,0];
  const HC_RSV_TOTAL       = [156062,109323,103507,100629,79242,62326,60365,58383,52396,22946,3408,179127];

  const HC_TREAS_1YR       = new Array(12).fill(0) as number[];
  const HC_MUNI_BONDS      = [96767,96979,97192,97405,97619,97834,98049,98264,98480,98696,98913,109793];
  const HC_SP_LOW_VOL      = [96767,96979,97192,97405,97619,97834,98049,98264,98480,98696,98913,109793];
  const HC_BLD_TOTAL       = [193534,193958,194384,194810,195238,195668,196098,196528,196960,197392,197826,219586];

  const HC_GROW            = [2618683,2633959,2649323,2664778,2680322,2695958,2711684,2727502,2743413,2759416,2775512,2791703];
  const HC_NET_WORTH       = [4643945,4657911,4671890,4640899,4650988,4664141,4658841,4658112,4672471,4686915,4697412,4901134];

  const allZero = (arr: number[]) => arr.every(v => v === 0);

  return (
    <div className="rounded-xl overflow-hidden shadow-xl border border-slate-200">
      {/* ── Title bar: title + view toggle + controls ── */}
      <div className="bg-slate-800 px-6 py-4 flex items-center gap-4 flex-wrap">
        <h2 className="text-white text-[15px] leading-snug flex-1 min-w-0">
          <span className="font-black">Continuous Money Movement:</span>
          <span className="font-light ml-2">GURU's Planned Transfers  For the Next Year</span>
        </h2>

        {/* View toggle */}
        <div className="flex items-center bg-slate-700 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
          {(['table','flow'] as const).map(v => (
            <button
              key={v}
              onClick={() => setMmView(v)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${
                mmView === v ? 'bg-white text-slate-800 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {v === 'table' ? 'Account Forecast' : 'Flow Schematic'}
            </button>
          ))}
        </div>

        {/* Month selector — only relevant for flow view */}
        {mmView === 'flow' && (
          <select
            data-testid="mm-month-select"
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="bg-white border border-slate-200 text-slate-700 text-[11px] rounded-md px-3 py-1.5 focus:outline-none focus:border-blue-400 flex-shrink-0 shadow-sm"
          >
            {MONTHS.map((mo, i) => (
              <option key={mo} value={i}>{mo} 2026{i === 0 ? ' — Next Month' : i === 1 ? ' — T-Bill Maturity' : ''}</option>
            ))}
          </select>
        )}

      </div>
      {/* ══════════════════════════════════════════════════════════
          FLOW SCHEMATIC VIEW
          ══════════════════════════════════════════════════════════ */}
      {mmView === 'flow' && (() => {
        /* ── parse per-month income ── */
        const salDesc = cashFlows.find(c => c.category === 'salary')?.description ?? '';
        const p1Match = salDesc.match(/P1 \(\$([0-9,]+)\)/);
        const p2Match = salDesc.match(/P2 \(\$([0-9,]+)\)/);
        const p1Salary = p1Match ? parseInt(p1Match[1].replace(/,/g, '')) : Math.round(income * 0.71);
        const p2Salary = p2Match ? parseInt(p2Match[1].replace(/,/g, '')) : Math.round(income * 0.29);
        const rentalCf = cashFlows.find(c => c.category === 'investments' && parseFloat(c.amount ?? '0') > 0);
        const rentalAmt = rentalCf ? Math.round(parseFloat(rentalCf.amount ?? '0')) : 1722;

        /* ── GURU-scenario balances for selected month (HC_ arrays = post-restructure) ── */
        const opsBal   = HC_CIT_MM[sm];   // Citizens Private Bank Ops Money Market
        const jpmBal   = HC_JPM_MMF[sm];  // JPMorgan Treasury MMF (Reserve buffer)

        /* ── T-bill ladder state for this month ── */
        const tbillDefs = [
          { label: '1-Mo T-Bill', balances: HC_TBILL_1MO as number[], rate: '4.95%' },
          { label: '3-Mo T-Bill', balances: HC_TBILL_3MO as number[], rate: '4.85%' },
          { label: '6-Mo T-Bill', balances: HC_TBILL_6MO as number[], rate: '4.75%' },
          { label: '9-Mo T-Bill', balances: HC_TBILL_9MO as number[], rate: '4.65%' },
        ];
        const activeTbills   = tbillDefs.filter(t => t.balances[sm] > 0);
        const maturingTbills = tbillDefs.filter(t => sm > 0 && (t.balances[sm - 1] ?? 0) > 0 && t.balances[sm] === 0);
        const totalMaturing  = maturingTbills.reduce((s, t) => s + (t.balances[sm - 1] ?? 0), 0);

        /* ── Implied JPM → CIT draw: makes the JPM ledger balance by math ── */
        const jpmBegBal  = sm > 0 ? HC_JPM_MMF[sm - 1] : 0;
        const jpmRsvDraw = Math.max(0, jpmBegBal + totalMaturing - jpmBal);

        /* ── labeled connector: solid line with value label + single moving dot ── */
        const Connector = ({
          label, color, width = 72, active = true, direction = 'right',
        }: { label?: string; color: string; width?: number; active?: boolean; direction?: 'right' | 'left' }) => (
          <div className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5" style={{ width }}>
            {label && active && (
              <span className="text-[9px] font-black tabular-nums whitespace-nowrap" style={{ color }}>
                {label}
              </span>
            )}
            <div className="relative w-full overflow-hidden" style={{ height: 1.5, backgroundColor: active ? `${color}30` : '#d1d5db' }}>
              {active && (
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}`, marginTop: '-0.5px' }}
                  animate={{ left: direction === 'right' ? ['-10px', `${width + 10}px`] : [`${width + 10}px`, '-10px'] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </div>
          </div>
        );

        /* ── accounting ledger card ── */
        const LedgerCard = ({
          title, subtitle, balance, balanceColor = '#1e293b', entries, accent, width, beginningBalance, shade,
        }: {
          title: string; subtitle?: string; balance: string; balanceColor?: string;
          entries?: { label: string; amount: string; type: 'plus' | 'less' | 'neutral' }[];
          accent?: string; width?: number; beginningBalance?: string; shade?: string;
        }) => (
          <div
            className="border border-slate-200 rounded-lg overflow-hidden shadow-sm"
            style={{ width: width ?? '100%', borderTopColor: accent, borderTopWidth: accent ? 2 : 1, backgroundColor: shade ?? 'white' }}
          >
            {/* Header: account name + subtitle */}
            <div className="px-4 pt-3 pb-2 border-b border-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-slate-900 leading-tight">{title}</div>
                  {subtitle && <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{subtitle}</div>}
                </div>
                {/* Simple cards (no ledger body): show balance in header */}
                {!beginningBalance && !entries?.length && (
                  <div className="text-[13px] font-black tabular-nums flex-shrink-0" style={{ color: balanceColor }}>{balance}</div>
                )}
              </div>
            </div>
            {/* Ledger body: beginning → changes → ending */}
            {(beginningBalance || (entries && entries.length > 0)) && (
              <div className="px-4 py-2 space-y-1.5">
                {beginningBalance && (
                  <div className="flex items-center justify-between pb-1.5 border-b border-dashed border-slate-200">
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 leading-none">Beg. Balance</span>
                    <span className="text-[10px] font-semibold tabular-nums text-slate-500 leading-none">{beginningBalance}</span>
                  </div>
                )}
                {entries && entries.map((e, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 leading-none">
                      {e.type === 'plus' ? '+ ' : e.type === 'less' ? '− ' : '  '}{e.label}
                    </span>
                    <span className={`text-[10px] font-bold tabular-nums leading-none ${
                      e.type === 'plus' ? 'text-emerald-600' : e.type === 'less' ? 'text-rose-600' : 'text-slate-600'
                    }`}>{e.amount}</span>
                  </div>
                ))}
                {beginningBalance && (
                  <div className="flex items-center justify-between pt-1.5 border-t-2 border-slate-300 mt-0.5">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 leading-none">End. Balance</span>
                    <span className="text-[13px] font-black tabular-nums leading-none" style={{ color: balanceColor }}>{balance}</span>
                  </div>
                )}
                {!beginningBalance && entries && entries.length > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-0.5">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 leading-none">Balance</span>
                    <span className="text-[13px] font-black tabular-nums leading-none" style={{ color: balanceColor }}>{balance}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );

        /* ── all expense items (base + specials) ── */
        const allExpenses = [
          ...BASE_EXP,
          ...specials.map(s => ({ label: s.label, amount: s.amount, dot: '#dc2626' })),
        ];

        return (
          <div className="bg-white px-6 py-5 overflow-x-auto border-t border-slate-100" style={{ minHeight: 520 }}>
            {/* ── Header bar ── */}
            <div className="mb-6 flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Money Flow Schematic</span>
              <span className="text-[11px] font-bold text-slate-600 border border-slate-200 rounded px-2.5 py-1 bg-slate-50">
                {MONTHS[sm]} 2026
              </span>
              {rsvDraw > 0 && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1">
                  Auto-draw Active — Reserve funding Operating Cash
                </span>
              )}
            </div>
            {/* ══ 5-column grid: [LEFT 300px] [GAP-L 88px] [CENTER 400px] [GAP-R 88px] [RIGHT 260px] ══ */}
            <div style={{ display: 'grid', gridTemplateColumns: '300px 88px 400px 88px 260px', gridAutoRows: 'auto', minWidth: 1136, columnGap: 0, rowGap: 20, alignItems: 'start' }}>

              {/* ══════════ ROW 1 col 1: INFLOWS ══════════ */}
              <div className="relative" style={{ gridColumn: '1', gridRow: '1' }}>
                {/* INFLOWS — top-level section banner */}
                <div className="flex items-center px-3 py-2 rounded-lg mb-2" style={{ backgroundColor: '#dcfce7', border: '1.5px solid #bbf7d0' }}>
                  <span className="text-[14px] font-black uppercase tracking-widest" style={{ color: '#15803d' }}>Inflows</span>
                </div>
                {/* INCOME SOURCES — sub-banner above the three cards */}
                <div className="flex items-center gap-1.5 px-2 py-1 mb-2 rounded" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#16a34a' }} />
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#15803d' }}>Income Sources</span>
                </div>
                {/* Income org-chart: right-side vertical spine + branches */}
                <div className="relative flex flex-col gap-2">
                  {/* Spine at right edge */}
                  <div style={{ position: 'absolute', right: 0, top: 16, bottom: 16, width: 2, backgroundColor: 'rgba(22,163,74,0.5)' }} />
                  {/* Michael Kessler */}
                  <div className="relative" style={{ marginRight: 14 }}>
                    <LedgerCard title="Michael Kessler" subtitle="After-Tax Salary" balance={fmtBal(p1Salary)} balanceColor="#16a34a" accent="#16a34a" />
                    <div style={{ position: 'absolute', right: -14, top: '50%', width: 14, height: 2, backgroundColor: 'rgba(22,163,74,0.5)', transform: 'translateY(-50%)' }} />
                  </div>
                  {/* Sarah Kessler */}
                  <div className="relative" style={{ marginRight: 14 }}>
                    <LedgerCard title="Sarah Kessler" subtitle="After-Tax Salary" balance={fmtBal(p2Salary)} balanceColor="#16a34a" accent="#16a34a" />
                    <div style={{ position: 'absolute', right: -14, top: '50%', width: 14, height: 2, backgroundColor: 'rgba(22,163,74,0.5)', transform: 'translateY(-50%)' }} />
                  </div>
                  {/* Sarasota Property */}
                  <div className="relative" style={{ marginRight: 14 }}>
                    <LedgerCard title="Sarasota Property" subtitle="Monthly Rental Income" balance={fmtBal(rentalAmt)} balanceColor="#16a34a" accent="#16a34a" />
                    <div style={{ position: 'absolute', right: -14, top: '50%', width: 14, height: 2, backgroundColor: 'rgba(22,163,74,0.5)', transform: 'translateY(-50%)' }} />
                  </div>
                </div>
              </div>

              {/* ══════════ ROW 1 col 2: Income → CIT connector ══════════ */}
              <div style={{ gridColumn: '2', gridRow: '1', display: 'flex', alignItems: 'flex-start', paddingTop: 180 }}>
                <div className="relative w-full">
                  <span className="absolute -top-5 left-2 font-black tabular-nums whitespace-nowrap text-[11px]" style={{ color: '#16a34a' }}>{fmtBal(income + rentalAmt)}</span>
                  <div className="relative w-full overflow-hidden" style={{ height: 2, backgroundColor: 'rgba(22,163,74,0.2)' }}>
                    <motion.div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: '#16a34a', boxShadow: '0 0 6px #16a34a' }}
                      animate={{ left: ['-10px', '100px'] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                </div>
              </div>

              {/* ══════════ ROW 1+2 col 3: CIT card (spans both rows) ══════════ */}
              <div style={{ gridColumn: '3', gridRow: '1 / 3' }}>
                {/* OPERATING CASH — large prominent banner */}
                <div className="flex items-center px-4 py-3 rounded-lg mb-3" style={{ backgroundColor: '#1d4ed8', border: '2px solid #1e40af' }}>
                  <span className="text-[18px] font-black uppercase tracking-widest text-white">Operating Cash</span>
                </div>
                {/* CIT card — expanded with more spacing */}
                <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm" style={{ backgroundColor: '#eff6ff', borderTopColor: '#1d4ed8', borderTopWidth: 3, minHeight: 280 }}>
                  {/* Header */}
                  <div className="px-5 pt-4 pb-3 border-b border-blue-100">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[13px] font-bold text-slate-900 leading-tight">CIT Money Market Bank Account</div>
                        <div className="text-[11px] text-slate-500 mt-1">Primary operating account · 4.65%</div>
                      </div>
                    </div>
                  </div>
                  {/* Ledger body */}
                  <div className="px-5 py-4 space-y-3">
                    {sm > 0 && (
                      <div className="flex items-center justify-between pb-3 border-b border-dashed border-blue-200">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Beg. Balance</span>
                        <span className="text-[11px] font-semibold tabular-nums text-slate-500">{fmtBal(HC_CIT_MM[sm - 1])}</span>
                      </div>
                    )}
                    {[
                      { label: 'Michael Kessler — Salary', amount: `+${fmtBal(p1Salary)}`, type: 'plus' as const },
                      { label: 'Sarah Kessler — Salary', amount: `+${fmtBal(p2Salary)}`, type: 'plus' as const },
                      { label: 'Sarasota Property — Rental Income', amount: `+${fmtBal(rentalAmt)}`, type: 'plus' as const },
                      ...(jpmRsvDraw > 0 ? [{ label: 'JPMorgan 100% Treasuries MMF — Draw', amount: `+${fmtBal(jpmRsvDraw)}`, type: 'plus' as const }] : []),
                      { label: 'Monthly Expenses', amount: `(${fmtBal(totalExp)})`, type: 'less' as const },
                    ].map((e, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5">
                        <span className="text-[11px] text-slate-600 leading-none">
                          {e.type === 'plus' ? '+ ' : '− '}{e.label}
                        </span>
                        <span className={`text-[11px] font-bold tabular-nums leading-none ${e.type === 'plus' ? 'text-emerald-600' : 'text-rose-600'}`}>{e.amount}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-3 border-t-2 border-blue-300 mt-1">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">End. Balance</span>
                      <span className="text-[18px] font-black tabular-nums" style={{ color: opsBal < 0 ? '#dc2626' : '#1d4ed8' }}>
                        {opsBal < 0 ? `(${fmtBal(Math.abs(opsBal))})` : fmtBal(opsBal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══════════ ROW 1+2 col 4: CIT → Expenses connector (spans both rows) ══════════ */}
              <div style={{ gridColumn: '4', gridRow: '1 / 3', display: 'flex', alignItems: 'flex-start', paddingTop: 233 }}>
                <div className="relative w-full">
                  <span className="absolute -top-5 left-2 text-[9px] font-black tabular-nums whitespace-nowrap" style={{ color: '#dc2626' }}>{fmtBal(totalExp)}</span>
                  <div className="relative w-full overflow-hidden" style={{ height: 2, backgroundColor: 'rgba(220,38,38,0.2)' }}>
                    <motion.div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: '#dc2626', boxShadow: '0 0 6px #dc2626' }}
                      animate={{ left: ['-10px', '100px'] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                </div>
              </div>

              {/* ══════════ ROW 1+2 col 5: Expense bracket (spans both rows) ══════════ */}
              <div className="relative" style={{ gridColumn: '5', gridRow: '1 / 3', paddingLeft: 26 }}>
                <div className="flex items-center px-3 py-2 rounded-lg mb-3" style={{ backgroundColor: '#fee2e2', border: '1.5px solid #fecaca' }}>
                  <span className="text-[14px] font-black uppercase tracking-widest" style={{ color: '#991b1b' }}>Outflows</span>
                </div>
                {/* Vertical spine at left edge of this column */}
                <div style={{ position: 'absolute', left: 8, top: 44, bottom: 8, width: 2, backgroundColor: 'rgba(220,38,38,0.5)' }} />
                {/* Expense cards */}
                <div className="flex flex-col gap-2">
                  {allExpenses.map((exp, idx) => {
                    const isSpecial = idx >= BASE_EXP.length;
                    return (
                      <div key={exp.label} className="relative">
                        {/* Branch: spine (left:8) to card left edge (left:26 → branch width=18) */}
                        <div style={{ position: 'absolute', left: -18, top: '50%', width: 18, height: 2, backgroundColor: 'rgba(220,38,38,0.35)', transform: 'translateY(-50%)' }} />
                        <LedgerCard
                          title={exp.label}
                          subtitle={isSpecial ? 'One-time' : undefined}
                          balance={`(${fmtBal(exp.amount)})`}
                          balanceColor="#dc2626"
                          accent={isSpecial ? '#dc2626' : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ══════════ ROW 2 col 1: RESERVE (JPM + T-bills) ══════════ */}
              <div className="relative" style={{ gridColumn: '1', gridRow: '2' }}>
                <div className="flex items-center gap-1.5 px-2 py-1 mb-2 rounded" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#d97706' }} />
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#92400e' }}>Reserve</span>
                </div>
                {/* JPMorgan 100% Treasuries Money Market Fund */}
                <LedgerCard
                  title="JPMorgan 100% Treasuries Money Market Fund"
                  subtitle="Reserve buffer · ~5.00%"
                  balance={fmtBal(jpmBal)}
                  balanceColor="#d97706"
                  accent="#d97706"
                  beginningBalance={sm > 0 ? fmtBal(HC_JPM_MMF[sm - 1]) : undefined}
                  entries={[
                    ...(totalMaturing > 0 ? [{ label: '+ Inflow from T-Bill Maturity', amount: fmtBal(totalMaturing), type: 'plus' as const }] : []),
                    { label: `Outflow to CIT Money Market${jpmRsvDraw > 0 ? '' : ' (Standby)'}`, amount: jpmRsvDraw > 0 ? `(${fmtBal(jpmRsvDraw)})` : '$0', type: jpmRsvDraw > 0 ? 'less' as const : 'neutral' as const },
                  ]}
                />

                {/* Treasury Ladder — T-bills in one relative container with JPM, right-side spine */}
                {(maturingTbills.length + activeTbills.length) > 0 && (
                  <div className="mt-3">
                    {/* Inner wrapper — spine is scoped here, ends at bottom of last maturing T-bill */}
                    <div className="relative" style={{ overflow: 'visible' }}>
                      {/* Vertical spine — top: -14 reaches up to JPM, bottom: 0 stops at bottom of this wrapper */}
                      <div style={{ position: 'absolute', right: -44, top: -14, bottom: 0, width: 2, backgroundColor: 'rgba(217,119,6,0.6)' }} />
                      {/* Horizontal cap connecting spine to JPM card right edge */}
                      <div style={{ position: 'absolute', right: -44, top: -14, width: 44, height: 2, backgroundColor: 'rgba(217,119,6,0.6)' }} />
                      {/* Animated dot travelling UP: T-bills → JPM MMF */}
                      {totalMaturing > 0 && (
                        <motion.div className="absolute w-2.5 h-2.5 rounded-full"
                          style={{ right: -48, backgroundColor: '#d97706', boxShadow: '0 0 6px #d97706', zIndex: 10 }}
                          animate={{ top: ['90%', '-14px'] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                        />
                      )}
                      {/* Treasury Ladder label */}
                      <div className="text-[9px] font-bold uppercase tracking-widest text-amber-600 mb-2">
                        Treasury Ladder
                      </div>
                      {/* Maturing T-bills — each has a branch to the spine */}
                      {maturingTbills.map(t => (
                        <div key={t.label} className="relative mb-2">
                          {/* Branch from card right edge to spine — animated dot + plain label */}
                          <div style={{ position: 'absolute', right: -44, top: '50%', width: 44, transform: 'translateY(-50%)', zIndex: 10 }}>
                            <span
                              style={{ position: 'absolute', top: -16, right: 2, fontSize: 9, fontWeight: 900, color: '#d97706', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', lineHeight: 1 }}
                              className="text-[12px]">
                              {fmtBal(t.balances[sm - 1] ?? 0)}
                            </span>
                            <div style={{ position: 'relative', width: '100%', height: 2, overflow: 'hidden', backgroundColor: 'rgba(217,119,6,0.3)' }}>
                              <motion.div
                                style={{ position: 'absolute', top: '50%', marginTop: -3, width: 7, height: 7, borderRadius: '50%', backgroundColor: '#d97706', boxShadow: '0 0 5px #d97706' }}
                                animate={{ left: ['100%', '-8px'] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                              />
                            </div>
                          </div>
                          <LedgerCard
                            title={`${t.label} — Matured`}
                            subtitle={`${t.rate} · proceeds to JPMorgan MMF`}
                            balance="$0"
                            balanceColor="#94a3b8"
                            accent="#d97706"
                            shade="#fffbeb"
                            beginningBalance={fmtBal(t.balances[sm - 1] ?? 0)}
                            entries={[
                              { label: 'Maturing and Deposited into JPMorgan 100% Treasuries Money Market Fund', amount: `(${fmtBal(t.balances[sm - 1] ?? 0)})`, type: 'less' },
                            ]}
                          />
                        </div>
                      ))}
                    </div>
                    {/* Active (held) T-bills — outside spine wrapper, no connector lines */}
                    {activeTbills.map(t => (
                      <div key={t.label} className="mb-2">
                        <LedgerCard
                          title={t.label}
                          subtitle={`Held to maturity · ${t.rate}`}
                          balance={fmtBal(t.balances[sm])}
                          balanceColor="#94a3b8"
                          accent="#94a3b8"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ══════════ ROW 2 col 2: JPM → CIT connector ══════════ */}
              <div style={{ gridColumn: '2', gridRow: '2', display: 'flex', alignItems: 'flex-start', paddingTop: 90 }}>
                <div className="relative w-full">
                  <span className="absolute -top-5 left-2 font-black tabular-nums whitespace-nowrap text-[12px]" style={{ color: '#d97706' }}>
                    {jpmRsvDraw > 0 ? fmtBal(jpmRsvDraw) : '$0 Standby'}
                  </span>
                  <div className="relative w-full overflow-hidden" style={{ height: 2, backgroundColor: jpmRsvDraw > 0 ? 'rgba(217,119,6,0.25)' : '#e5e7eb' }}>
                    <motion.div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: '#d97706', boxShadow: '0 0 6px #d97706' }}
                      animate={{ left: ['-10px', '100px'] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>
        );
      })()}
      {/* ══════════════════════════════════════════════════════════
          SPREADSHEET VIEW
          ══════════════════════════════════════════════════════════ */}
      {mmView === 'table' && (
        <>
          <div className="overflow-auto bg-white" style={{ maxHeight: 620 }}>
            <table className="w-full border-collapse min-w-max">

              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-900 border-b-2 border-slate-700">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 w-[300px]">Line Item</th>
                  {MONTHS.map((mo, mi) => (
                    <th key={mo} className={`px-2 py-3 text-center text-[10px] font-black uppercase tracking-wider min-w-[76px] ${mi === 0 ? 'text-amber-400 bg-slate-800' : 'text-slate-300'}`}>
                      {mo}
                      {mi === 0 && <div className="text-[7px] font-normal text-amber-400/70 normal-case leading-none mt-0.5">upcoming</div>}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {/* ══ OPERATING CASH ══ */}
                {/* ↳ Chase Total Checking — $0 (consolidated into CIT MM) */}
                <tr className={`border-b transition-colors ${allZero(HC_CHASE) ? 'bg-slate-50/80' : 'hover:bg-blue-50/40'} border-[#1d4ed8]/10`}>
                  <td className="pl-7 pr-4 py-2 w-[300px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold ${allZero(HC_CHASE) ? 'text-slate-300' : 'text-blue-800'}`}>Chase Total Checking</span>
                      <span className={`text-[8px] font-mono ${allZero(HC_CHASE) ? 'text-slate-300' : 'text-blue-400'}`}>Checking</span>
                    </div>
                  </td>
                  {HC_CHASE.map((v, mi) => (
                    <td key={mi} className={`px-2 py-2 text-[10px] text-center tabular-nums font-semibold ${allZero(HC_CHASE) ? 'text-slate-300' : 'text-blue-700'}`}>
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>
                {/* ↳ Citizens Private Banking Checking — $0 (consolidated) */}
                <tr className={`border-b transition-colors ${allZero(HC_CITIZENS_CHECK) ? 'bg-slate-50/80' : 'hover:bg-blue-50/40'} border-[#1d4ed8]/10`}>
                  <td className="pl-7 pr-4 py-2 w-[300px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold ${allZero(HC_CITIZENS_CHECK) ? 'text-slate-300' : 'text-blue-700'}`}>Citizens Private Banking Checking</span>
                      <span className={`text-[8px] font-mono ${allZero(HC_CITIZENS_CHECK) ? 'text-slate-300' : 'text-amber-500'}`}>Checking</span>
                    </div>
                  </td>
                  {HC_CITIZENS_CHECK.map((v, mi) => (
                    <td key={mi} className={`px-2 py-2 text-[10px] text-center tabular-nums font-semibold ${allZero(HC_CITIZENS_CHECK) ? 'text-slate-300' : 'text-blue-600'}`}>
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>
                {/* ↳ CIT Money Market Bank Account — active operating account */}
                <tr className="border-b border-[#1d4ed8]/10 hover:bg-blue-50/40 transition-colors"
                  style={{ backgroundColor: "rgba(29,78,216,0.04)" }}>
                  <td className="pl-7 pr-4 py-2 w-[300px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-blue-800">CIT Money Market Bank Account</span>
                      <span className="text-[8px] text-blue-500 font-mono">4.65%</span>
                      <span style={{ backgroundColor: '#059669', color: 'white', fontSize: 7, fontWeight: 900, letterSpacing: '0.08em', padding: '2px 5px', borderRadius: 3, textTransform: 'uppercase', flexShrink: 0 }}>NEW</span>
                    </div>
                  </td>
                  {HC_CIT_MM.map((v, mi) => (
                    <td key={mi} className="px-2 py-2 text-[10px] text-center tabular-nums font-semibold text-blue-700">
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>
                {/* Operating Cash TOTAL */}
                <tr className="border-y-2 border-white/20" style={{ backgroundColor: "#1d4ed8" }}>
                  <td className="px-4 py-3 text-[12px] font-black uppercase tracking-wide text-white">Operating Cash</td>
                  {HC_OPS_TOTAL.map((v, mi) => (
                    <td key={mi} className="px-2 py-3 text-[11px] font-black text-center tabular-nums whitespace-nowrap text-white relative">
                      <div className="group relative inline-block cursor-help">
                        {fmtBal(v)}
                        {cellTip([
                          `Operating Cash — ${MONTHS[mi]} 2026`,
                          "─",
                          mi > 0 ? `Prior month: ${fmtBal(HC_OPS_TOTAL[mi - 1])}` : null,
                          `+ After-tax income: ${fmtBal(INCOME_TO_IMM[mi])}`,
                          `- Monthly expenses: ${fmtBal(Math.abs(EXPENSES[mi]))}`,
                          FROM_ST_TO_IMM[mi] > 0 ? `+ Draw from Reserve: ${fmtBal(FROM_ST_TO_IMM[mi])}` : null,
                          IMM_INT[mi] > 0 ? `+ Interest earned: ${fmtBal(IMM_INT[mi])}` : null,
                          "─",
                          `= Month-end balance: ${fmtBal(v)}`,
                        ])}
                      </div>
                    </td>
                  ))}
                </tr>
                {/* Min ops floor check */}
                <tr style={{ backgroundColor: "rgba(29,78,216,0.08)" }} className="border-b border-[#1d4ed8]/20">
                  <td className="px-4 py-1.5 w-[300px]">
                    <div className="flex items-center gap-1 text-[10px] font-semibold italic" style={{ color: "#1d4ed8" }}>
                      <span style={{ color: "#1d4ed8" }}>⤷</span> Holds ≥ {opsCashMonths} month{opsCashMonths !== 1 ? "s" : ""} of expenses
                    </div>
                  </td>
                  {HC_OPS_TOTAL.map((bal, mi) => (
                    <td key={mi} className={`px-2 py-1.5 text-[10px] text-center font-black tabular-nums ${bal >= minOps ? 'text-emerald-600' : 'text-red-600'}`}>
                      {bal >= minOps ? '✓' : '⚠'}
                    </td>
                  ))}
                </tr>
                <tr className="h-2 bg-slate-50"><td colSpan={13} /></tr>

                {/* ══ RESERVE ══ */}
                {/* ↳ Citizens Private Bank Money Market — $0 (consolidated into JPMorgan MMF) */}
                <tr className={`border-b transition-colors ${allZero(HC_CITIZENS_MM) ? 'bg-slate-50/80' : 'hover:bg-amber-50/30'} border-amber-100/40`}>
                  <td className="pl-7 pr-4 py-2 w-[300px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold ${allZero(HC_CITIZENS_MM) ? 'text-slate-300' : 'text-amber-800'}`}>Citizens Private Bank Money Market</span>
                      <span className={`text-[8px] font-mono ${allZero(HC_CITIZENS_MM) ? 'text-slate-300' : 'text-amber-500'}`}>4.85%</span>
                    </div>
                  </td>
                  {HC_CITIZENS_MM.map((v, mi) => (
                    <td key={mi} className={`px-2 py-2 text-[10px] text-center tabular-nums font-semibold ${allZero(HC_CITIZENS_MM) ? 'text-slate-300' : 'text-amber-700'}`}>
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>
                {/* ↳ CapitalOne 360 Performance Savings — $0 (consolidated) */}
                <tr className={`border-b transition-colors ${allZero(HC_CAPONE) ? 'bg-slate-50/80' : 'hover:bg-amber-50/20'} border-amber-100/30`}>
                  <td className="pl-7 pr-4 py-2 w-[300px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] ${allZero(HC_CAPONE) ? 'text-slate-300' : 'text-slate-600'}`}>CapitalOne 360 Performance Savings</span>
                      <span className={`text-[8px] font-mono ${allZero(HC_CAPONE) ? 'text-slate-300' : 'text-amber-500'}`}>3.78%</span>
                    </div>
                  </td>
                  {HC_CAPONE.map((v, mi) => (
                    <td key={mi} className={`px-2 py-2 text-[10px] text-center tabular-nums ${allZero(HC_CAPONE) ? 'text-slate-300' : 'text-amber-600'}`}>
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>
                {/* ↳ JPMorgan 100% Treasuries Money Market Fund — primary reserve vehicle */}
                <tr className="border-b border-amber-100/40 hover:bg-amber-50/30 transition-colors"
                  style={{ backgroundColor: "rgba(217,119,6,0.04)" }}>
                  <td className="pl-7 pr-4 py-2 w-[300px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-amber-800">JPMorgan 100% Treasuries Money Market Fund</span>
                      <span className="text-[8px] text-amber-500 font-mono">4.72%</span>
                      <span style={{ backgroundColor: '#059669', color: 'white', fontSize: 7, fontWeight: 900, letterSpacing: '0.08em', padding: '2px 5px', borderRadius: 3, textTransform: 'uppercase', flexShrink: 0 }}>NEW</span>
                    </div>
                  </td>
                  {HC_JPM_MMF.map((v, mi) => (
                    <td key={mi} className="px-2 py-2 text-[10px] text-center tabular-nums font-semibold text-amber-700">
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>
                {/* ↳ US T-Bill 1 month */}
                <tr className="border-b border-amber-100/30 hover:bg-amber-50/20 transition-colors"
                  style={{ backgroundColor: "rgba(217,119,6,0.03)" }}>
                  <td className="pl-7 pr-4 py-2 w-[300px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-amber-800">US T-Bill 1 month</span>
                      <span className="text-[8px] text-amber-500 font-mono">5.08%</span>
                      <span style={{ backgroundColor: '#059669', color: 'white', fontSize: 7, fontWeight: 900, letterSpacing: '0.08em', padding: '2px 5px', borderRadius: 3, textTransform: 'uppercase', flexShrink: 0 }}>NEW</span>
                    </div>
                  </td>
                  {HC_TBILL_1MO.map((v, mi) => (
                    <td key={mi} className={`px-2 py-2 text-[10px] text-center tabular-nums ${v === 0 ? 'text-slate-300' : 'text-amber-600 font-semibold'}`}>
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>
                {/* ↳ US T-Bill 3 months */}
                <tr className="border-b border-amber-100/30 hover:bg-amber-50/20 transition-colors"
                  style={{ backgroundColor: "rgba(217,119,6,0.03)" }}>
                  <td className="pl-7 pr-4 py-2 w-[300px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-amber-800">US T-Bill 3 months</span>
                      <span className="text-[8px] text-amber-500 font-mono">5.01%</span>
                      <span style={{ backgroundColor: '#059669', color: 'white', fontSize: 7, fontWeight: 900, letterSpacing: '0.08em', padding: '2px 5px', borderRadius: 3, textTransform: 'uppercase', flexShrink: 0 }}>NEW</span>
                    </div>
                  </td>
                  {HC_TBILL_3MO.map((v, mi) => (
                    <td key={mi} className={`px-2 py-2 text-[10px] text-center tabular-nums ${v === 0 ? 'text-slate-300' : 'text-amber-600 font-semibold'}`}>
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>
                {/* ↳ US T-Bill 6 months */}
                <tr className="border-b border-amber-100/30 hover:bg-amber-50/20 transition-colors"
                  style={{ backgroundColor: "rgba(217,119,6,0.03)" }}>
                  <td className="pl-7 pr-4 py-2 w-[300px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-amber-800">US T-Bill 6 months</span>
                      <span className="text-[8px] text-amber-500 font-mono">4.95%</span>
                      <span style={{ backgroundColor: '#059669', color: 'white', fontSize: 7, fontWeight: 900, letterSpacing: '0.08em', padding: '2px 5px', borderRadius: 3, textTransform: 'uppercase', flexShrink: 0 }}>NEW</span>
                    </div>
                  </td>
                  {HC_TBILL_6MO.map((v, mi) => (
                    <td key={mi} className={`px-2 py-2 text-[10px] text-center tabular-nums ${v === 0 ? 'text-slate-300' : 'text-amber-600 font-semibold'}`}>
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>
                {/* ↳ US T-Bill 9 months */}
                <tr className="border-b border-amber-100/30 hover:bg-amber-50/20 transition-colors"
                  style={{ backgroundColor: "rgba(217,119,6,0.03)" }}>
                  <td className="pl-7 pr-4 py-2 w-[300px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-amber-800">US T-Bill 9 months</span>
                      <span className="text-[8px] text-amber-500 font-mono">4.85%</span>
                      <span style={{ backgroundColor: '#059669', color: 'white', fontSize: 7, fontWeight: 900, letterSpacing: '0.08em', padding: '2px 5px', borderRadius: 3, textTransform: 'uppercase', flexShrink: 0 }}>NEW</span>
                    </div>
                  </td>
                  {HC_TBILL_9MO.map((v, mi) => (
                    <td key={mi} className={`px-2 py-2 text-[10px] text-center tabular-nums ${v === 0 ? 'text-slate-300' : 'text-amber-600 font-semibold'}`}>
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>
                {/* Reserve TOTAL */}
                <tr className="border-y-2 border-white/20" style={{ backgroundColor: "#d97706" }}>
                  <td className="px-4 py-3 text-[12px] font-black uppercase tracking-wide text-white">Reserve</td>
                  {HC_RSV_TOTAL.map((v, mi) => (
                    <td key={mi} className="px-2 py-3 text-[11px] font-black text-center tabular-nums whitespace-nowrap text-white relative">
                      <div className="group relative inline-block cursor-help">
                        {fmtBal(v)}
                        {cellTip([
                          `Reserve — ${MONTHS[mi]} 2026`,
                          "─",
                          mi > 0 ? `Prior month: ${fmtBal(HC_RSV_TOTAL[mi - 1])}` : null,
                          INCOME_TO_ST[mi] > 0 ? `+ Inflow: ${fmtBal(INCOME_TO_ST[mi])}` : null,
                          FROM_ST_OUT[mi] > 0 ? `- Draw to Ops Cash: ${fmtBal(FROM_ST_OUT[mi])}` : null,
                          ST_INT[mi] > 0 ? `+ Interest earned: ${fmtBal(ST_INT[mi])}` : null,
                          "─",
                          `= Month-end balance: ${fmtBal(v)}`,
                        ])}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr className="h-2 bg-slate-50"><td colSpan={13} /></tr>

                {/* ══ BUILD ══ */}
                {/* ↳ Treasuries 1 year — $0 (replaced by Munis + S&P Low Vol) */}
                <tr className={`border-b transition-colors ${allZero(HC_TREAS_1YR) ? 'bg-slate-50/80' : 'hover:bg-green-50/30'} border-green-100/40`}>
                  <td className="pl-7 pr-4 py-2 w-[300px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold ${allZero(HC_TREAS_1YR) ? 'text-slate-300' : 'text-green-800'}`}>Treasuries 1 year</span>
                      <span className={`text-[8px] font-mono ${allZero(HC_TREAS_1YR) ? 'text-slate-300' : 'text-green-600'}`}>4.50%</span>
                    </div>
                  </td>
                  {HC_TREAS_1YR.map((v, mi) => (
                    <td key={mi} className={`px-2 py-2 text-[10px] text-center tabular-nums font-semibold ${allZero(HC_TREAS_1YR) ? 'text-slate-300' : 'text-green-700'}`}>
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>
                {/* ↳ The City of New York Muni Bonds Due 02/2028 */}
                <tr className="border-b border-green-100/40 hover:bg-green-50/30 transition-colors"
                  style={{ backgroundColor: "rgba(22,163,74,0.04)" }}>
                  <td className="pl-7 pr-4 py-2 w-[300px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-green-800">The City of New York Muni Bonds Due 02/2028</span>
                      <span className="text-[8px] text-green-600 font-mono">3.85%</span>
                      <span style={{ backgroundColor: '#059669', color: 'white', fontSize: 7, fontWeight: 900, letterSpacing: '0.08em', padding: '2px 5px', borderRadius: 3, textTransform: 'uppercase', flexShrink: 0 }}>NEW</span>
                    </div>
                  </td>
                  {HC_MUNI_BONDS.map((v, mi) => (
                    <td key={mi} className="px-2 py-2 text-[10px] text-center tabular-nums font-semibold text-green-700">
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>
                {/* ↳ S&P Low Volatility Index */}
                <tr className="border-b border-green-100/40 hover:bg-green-50/30 transition-colors"
                  style={{ backgroundColor: "rgba(22,163,74,0.03)" }}>
                  <td className="pl-7 pr-4 py-2 w-[300px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-green-800">S&amp;P Low Volatility Index</span>
                      <span className="text-[8px] text-green-600 font-mono">ETF</span>
                      <span style={{ backgroundColor: '#059669', color: 'white', fontSize: 7, fontWeight: 900, letterSpacing: '0.08em', padding: '2px 5px', borderRadius: 3, textTransform: 'uppercase', flexShrink: 0 }}>NEW</span>
                    </div>
                  </td>
                  {HC_SP_LOW_VOL.map((v, mi) => (
                    <td key={mi} className="px-2 py-2 text-[10px] text-center tabular-nums font-semibold text-green-700">
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>
                {/* Build TOTAL */}
                <tr className="border-y-2 border-white/20" style={{ backgroundColor: "#16a34a" }}>
                  <td className="px-4 py-3 text-[12px] font-black uppercase tracking-wide text-white">Build</td>
                  {HC_BLD_TOTAL.map((v, mi) => (
                    <td key={mi} className="px-2 py-3 text-[11px] font-black text-center tabular-nums whitespace-nowrap text-white relative">
                      <div className="group relative inline-block cursor-help">
                        {fmtBal(v)}
                        {cellTip([
                          `Build — ${MONTHS[mi]} 2026`,
                          "─",
                          mi > 0 ? `Prior month: ${fmtBal(HC_BLD_TOTAL[mi - 1])}` : null,
                          INCOME_TO_MT[mi] > 0 ? `+ Inflow: ${fmtBal(INCOME_TO_MT[mi])}` : null,
                          FROM_MT_OUT[mi] > 0 ? `- Outflow: ${fmtBal(FROM_MT_OUT[mi])}` : null,
                          MT_INT[mi] > 0 ? `+ Interest earned: ${fmtBal(MT_INT[mi])}` : null,
                          "─",
                          `= Month-end balance: ${fmtBal(v)}`,
                        ])}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr className="h-2 bg-slate-50"><td colSpan={13} /></tr>

                <tr className="border-y-2 border-white/20" style={{ backgroundColor: "#5b21b6" }}>
                  <td className="px-4 py-3 text-[12px] font-black uppercase tracking-wide text-white">
                    Grow
                    <span className="ml-1.5 text-[9px] font-normal text-white/60 normal-case">(Brokerage &amp; Retirement)</span>
                  </td>
                  {HC_GROW.map((v, mi) => (
                    <td key={mi} className="px-2 py-3 text-[11px] font-black text-center tabular-nums whitespace-nowrap text-white">
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>

                <tr className="h-3 bg-slate-100"><td colSpan={13} /></tr>

                <tr className="bg-slate-700">
                  <td className="px-4 py-3 text-[12px] font-black uppercase tracking-wide text-white">Total Net Worth</td>
                  {HC_NET_WORTH.map((v, mi) => (
                    <td key={mi} className="px-2 py-3 text-[12px] font-black text-center tabular-nums whitespace-nowrap text-white">
                      {fmtBal(v)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 border-t border-slate-200 px-5 py-2.5 flex items-center gap-5 flex-wrap">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">GURU Autopilot</span>
            {[
              { color: "#1d4ed8", label: "Operating Cash" },
              { color: "#d97706", label: "Reserve (Short-Term)" },
              { color: "#16a34a", label: "Build (Medium-Term)" },
              { color: "#5b21b6", label: "Grow (Long-Term)" },
              { color: "#374151", label: "Total Net Worth" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[9px] text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── GURU Asset Allocation View ───────────────────────────────────────────────
const GURU_BUCKETS_DEF = [
  {
    name: "Operating Cash",
    tagline: "Cash for upcoming expenditures",
    rule: "2-3 months of cash",
    bg: "#1d4ed8",
    dark: "#1e40af",
    accent: "#93c5fd",
  },
  {
    name: "Reserve",
    tagline: "Active cash management for what's next",
    rule: "12 months of cash for anticipated outflow",
    bg: "#d97706",
    dark: "#b45309",
    accent: "#fcd34d",
  },
  {
    name: "Build",
    tagline: "Disciplined saving for big goals on the horizon",
    rule: "Large expenditure in next 3 years",
    bg: "#16a34a",
    dark: "#15803d",
    accent: "#4ade80",
  },
  {
    name: "Grow",
    tagline: "Long-term compounded investing",
    rule: "5 years + aggressive investment portfolio",
    bg: "#5b21b6",
    dark: "#4c1d95",
    accent: "#c084fc",
  },
] as const;

type BucketProduct = {
  name: string;
  institution: string;
  type: string;
  grossYield: string;
  atYield: string;
  pickup: string;
  isGuru: boolean;
};
const BUCKET_PRODUCTS: Record<string, BucketProduct[]> = {
  // Operating Cash: bank checking/MM = ordinary income (fed 35% + state 8% + city 4% = 47%) → keep 53%
  "Operating Cash": [
    {
      name: "Citizens Private Checking",
      institution: "Citizens Bank",
      type: "Checking",
      grossYield: "0.01%",
      atYield: "0.01%",
      pickup: "—",
      isGuru: false,
    },
    {
      name: "SoFi Checking",
      institution: "SoFi",
      type: "High-Yield Checking",
      grossYield: "0.50%",
      atYield: "0.27%",
      pickup: "+0.49%",
      isGuru: false,
    },
    {
      name: "CIT Money Market Bank Account",
      institution: "CIT Bank",
      type: "Money Market",
      grossYield: "4.30%",
      atYield: "2.28%",
      pickup: "+4.29%",
      isGuru: true,
    },
  ],
  // Reserve: gov't treasury MMFs are state/city exempt (federal 35% only) → keep 65%
  Reserve: [
    {
      name: "JPMorgan 100% Treasuries Money Market Fund",
      institution: "J.P. Morgan",
      type: "Money Market Fund",
      grossYield: "4.30%",
      atYield: "2.80%",
      pickup: "+0.65%",
      isGuru: true,
    },
    {
      name: "Marcus by Goldman Sachs — 3 Month Time Deposit",
      institution: "Goldman Sachs",
      type: "Time Deposit",
      grossYield: "4.50%",
      atYield: "2.39%",
      pickup: "+0.45%",
      isGuru: false,
    },
    {
      name: "US Treasury Ladder - 1, 3, 6 and 9 month",
      institution: "US Treasury",
      type: "T-Bill Ladder",
      grossYield: "4.20%",
      atYield: "2.73%",
      pickup: "+0.58%",
      isGuru: false,
    },
    {
      name: "Vanguard Federal Money Market Fund (VMFXX)",
      institution: "Vanguard",
      type: "Money Market Fund",
      grossYield: "4.22%",
      atYield: "2.74%",
      pickup: "+0.57%",
      isGuru: false,
    },
    {
      name: "Schwab Value Advantage Money Market Fund",
      institution: "Schwab",
      type: "Money Market Fund",
      grossYield: "4.18%",
      atYield: "2.72%",
      pickup: "+0.53%",
      isGuru: false,
    },
  ],
  // Build: JPMorgan Treasuries MMF is GURU pick (federal-only exempt → ×0.65); munis triple-exempt (×1.00); equities cap gains (×0.68)
  Build: [
    {
      name: "US Treasury Ladder — 1, 2 & 3-Year Notes",
      institution: "US Treasury",
      type: "Treasury Ladder",
      grossYield: "4.01%",
      atYield: "2.61%",
      pickup: "+0.22%",
      isGuru: true,
    },
    {
      name: "The City of New York Muni Bonds Due 02/2028",
      institution: "NYC",
      type: "Municipal Bond",
      grossYield: "2.67%",
      atYield: "2.67%",
      pickup: "TEY 5.04%",
      isGuru: false,
    },
    {
      name: "S&P Low Volatility Index",
      institution: "SPLV / USMV",
      type: "Index ETF",
      grossYield: "6.50%",
      atYield: "4.42%",
      pickup: "+1.62% AT",
      isGuru: false,
    },
  ],
  // Grow: equities/PE use 20% cap gains tax only → keep 80%
  // 10% gross for S&P 500 / MSCI World → 8.0% AT
  // 15% gross for PE Co-Invest → 12.0% AT
  Grow: [
    {
      name: "S&P 500 / Total Market ETF (VOO/VTI)",
      institution: "Vanguard",
      type: "Index ETF",
      grossYield: "10.0%",
      atYield: "8.0%",
      pickup: "20% cap gains tax",
      isGuru: true,
    },
    {
      name: "MSCI World ETF (VT)",
      institution: "Vanguard",
      type: "Index ETF",
      grossYield: "10.0%",
      atYield: "8.0%",
      pickup: "Global diversification",
      isGuru: false,
    },
    {
      name: "PE Co-Investment",
      institution: "Advisor Sourced",
      type: "Private Equity",
      grossYield: "15.0%",
      atYield: "12.0%",
      pickup: "Illiquidity premium",
      isGuru: false,
    },
    {
      name: "Private Credit Fund",
      institution: "Advisor Sourced",
      type: "Private Credit",
      grossYield: "[9.5%]",
      atYield: "[5.0%]",
      pickup: "+2–3% vs. liquid",
      isGuru: false,
    },
    {
      name: "Real Assets / Infrastructure",
      institution: "Advisor Sourced",
      type: "Real Assets",
      grossYield: "[8.5%]",
      atYield: "[6.8%]",
      pickup: "Inflation protection",
      isGuru: false,
    },
  ],
};

function GuruAllocationView({
  assets,
  cashFlows,
  opsCashMonths,
  setOpsCashMonths,
  pendingTransfers,
  setPendingTransfers,
  bucketProductSelections,
  setBucketProductSelections,
}: {
  assets: Asset[];
  cashFlows: CashFlow[];
  opsCashMonths: number;
  setOpsCashMonths: (n: number) => void;
  pendingTransfers: { from: string; to: string; amount: number }[];
  setPendingTransfers: React.Dispatch<React.SetStateAction<{ from: string; to: string; amount: number }[]>>;
  bucketProductSelections: Record<string, Array<{ product: BucketProduct; alloc: number }>>;
  setBucketProductSelections: React.Dispatch<React.SetStateAction<Record<string, Array<{ product: BucketProduct; alloc: number }>>>>;
}) {

  const [dragItem, setDragItem] = useState<string | null>(null);

  function handleExecute(from: string, to: string, amount: number) {
    setPendingTransfers((prev) => {
      const filtered = prev.filter((t) => !(t.from === from && t.to === to));
      return [...filtered, { from, to, amount }];
    });
  }
  function handleUndo(from: string, to: string) {
    setPendingTransfers((prev) =>
      prev.filter((t) => !(t.from === from && t.to === to)),
    );
  }

  const { reserve, yieldBucket, tactical, totalLiquid } = cashBuckets(assets);
  const forecastData = buildForecast(cashFlows);
  const cashTrough = computeTrough(forecastData);
  const cashExcess = totalLiquid - cashTrough;
  const brokerageCash = assets
    .filter(
      (a) =>
        a.type === "cash" &&
        (a.description ?? "").toLowerCase().includes("brokerage"),
    )
    .reduce((s, a) => s + Number(a.value), 0);
  const totalToInvest = Math.round(brokerageCash + Math.max(0, cashExcess));

  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const growth = assets
    .filter(
      (a) =>
        a.type === "equity" ||
        (a.type === "cash" &&
          (a.description ?? "").toLowerCase().includes("brokerage")),
    )
    .reduce((s, a) => s + Number(a.value), 0);
  const alts = assets
    .filter((a) => a.type === "alternative" || a.type === "real_estate")
    .reduce((s, a) => s + Number(a.value), 0);

  const buckets = [
    {
      label: "Operating Cash",
      sublabel: "Checking — transaction accounts",
      value: reserve,
      color: GURU_BUCKETS_DEF[0].bg,
      pct: (reserve / totalAssets) * 100,
    },
    {
      label: "Reserve",
      sublabel: "Savings, MM & Treasuries",
      value: yieldBucket + tactical,
      color: GURU_BUCKETS_DEF[1].bg,
      pct: ((yieldBucket + tactical) / totalAssets) * 100,
    },
    {
      label: "Build",
      sublabel: "Equities & brokerage investments",
      value: growth,
      color: GURU_BUCKETS_DEF[2].bg,
      pct: (growth / totalAssets) * 100,
    },
    {
      label: "Grow",
      sublabel: "Real estate, PE, carry, RSUs",
      value: alts,
      color: GURU_BUCKETS_DEF[3].bg,
      pct: (alts / totalAssets) * 100,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Rebalancing Recommendation ───────────────────────────────────── */}
      {(() => {
        const reserveCurrent = reserve;
        const flowCurrent = yieldBucket; // brokerageCash now classified in Grow
        const buildCurrent = tactical;
        const equityValEarly = assets
          .filter(
            (a) =>
              a.type === "equity" &&
              !(a.description ?? "").toLowerCase().includes("ira"),
          )
          .reduce((s, a) => s + Number(a.value), 0);
        const retireValEarly =
          assets
            .filter(
              (a) =>
                a.type === "equity" &&
                (a.description ?? "").toLowerCase().includes("ira"),
            )
            .reduce((s, a) => s + Number(a.value), 0) +
          assets
            .filter(
              (a) =>
                a.type === "fixed_income" &&
                ((a.description ?? "").toLowerCase().includes("ira") ||
                  (a.description ?? "").toLowerCase().includes("401")),
            )
            .reduce((s, a) => s + Number(a.value), 0);
        const altValEarly = assets
          .filter((a) => a.type === "alternative")
          .reduce((s, a) => s + Number(a.value), 0);
        const reValEarly = assets
          .filter((a) => a.type === "real_estate")
          .reduce((s, a) => s + Number(a.value), 0);
        const plan529 = 35600;
        const otherCurrent = altValEarly + reValEarly + plan529;
        // Sum of prototype Grow breakdown: Cash+Intl+US Mkt+LgCap+SmCap+Div+Stock+Bonds+Crypto
        const growCurrent = 222965 + 244685 + 779878 + 535000 + 323582 + 94369 + 238311 + 61210 + 9500; // = 2,509,500

        const moMap: Record<string, number> = {};
        cashFlows
          .filter((c) => c.type === "outflow")
          .forEach((c) => {
            const d = new Date(c.date as string);
            const k = `${d.getFullYear()}-${d.getMonth()}`;
            moMap[k] = (moMap[k] ?? 0) + Number(c.amount);
          });
        const moVals = Object.values(moMap);
        const minMonthly = moVals.length ? Math.min(...moVals) : 18056;
        const annualOut = cashFlows
          .filter((c) => c.type === "outflow")
          .reduce((s, c) => s + Number(c.amount), 0);
        const annualSalIn = cashFlows
          .filter((c) => c.type === "inflow" && c.category === "salary")
          .reduce((s, c) => s + Number(c.amount), 0);

        const reserveTarget = Math.round(minMonthly * opsCashMonths);
        const flowTarget = cashTrough; // target the 12-month cumulative cash flow trough
        const buildTarget = buildCurrent;
        // Use prototype model total ($5,996,550) so growTarget is consistent with
        // hardcoded growCurrent ($2,509,500) — both reflect the prototype asset values
        const PROTO_TOTAL_ASSETS = 5996550;
        const growTarget =
          PROTO_TOTAL_ASSETS - reserveTarget - flowTarget - buildTarget - otherCurrent;

        const reserveDelta = reserveTarget - reserveCurrent;
        const flowDelta = flowTarget - flowCurrent;
        const growDelta = growTarget - growCurrent;

        const excessCash =
          Math.abs(Math.min(reserveDelta, 0)) +
          Math.abs(Math.min(flowDelta, 0));
        const addlIncome = Math.round(
          Math.abs(Math.min(reserveDelta, 0)) * (0.07 * 0.63 - 0.001) +
            Math.abs(Math.min(flowDelta, 0)) * (0.07 * 0.63 - 0.043 * 0.63),
        );
        const pctIncrease =
          annualSalIn > 0 ? ((addlIncome / annualSalIn) * 100).toFixed(1) : "0";

        // ── Sub-accounts per bucket (computed from assets) ──────────────
        type Acct = {
          name: string;
          value: number;
          yield_: string;
          yieldAT: string;
          incomeAT?: string; // AT yield used for income impact calc (separate from display yieldAT)
          acctNum?: string;
        };
        const acctHash = (s: string) =>
          String(Math.abs(s.split("").reduce((a, c) => ((a * 31 + c.charCodeAt(0)) | 0), 0)) % 9000 + 1000);
        const shortName = (desc: string | null | undefined) =>
          (desc ?? "").split("(")[0].split("—")[0].split("–")[0].trim();
        const parseYieldNum = (y: string): number => {
          const m = y.replace(/[~\[\]<>+%]/g, "").match(/(\d+\.?\d*)/);
          return m ? parseFloat(m[1]) : 0;
        };
        // Tax rates: Federal 35% | State 8% | City 4% | Cap Gains 20%
        // Bank accounts: all taxes = 47% → keep 53%
        const toATFull = (gross: string) => { const n = parseYieldNum(gross); return n > 0 ? `${(n * 0.53).toFixed(2)}%` : "—"; };
        // Treasuries / T-bills / MM funds in govts: federal only = 35% → keep 65%
        const toATFed  = (gross: string) => { const n = parseYieldNum(gross); return n > 0 ? `${(n * 0.65).toFixed(2)}%` : "—"; };
        // Muni bonds: triple exempt → keep 100%
        const toATMuni = (gross: string) => { const n = parseYieldNum(gross); return n > 0 ? `${n.toFixed(2)}%` : "—"; };
        // Equities / cap gains: 20% fed + 8% state + 4% city = 32% → keep 68%
        const toATCapG = (gross: string) => { const n = parseYieldNum(gross); return n > 0 ? `${(n * 0.68).toFixed(2)}%` : "—"; };
        // Detect gov't treasury MMFs / sweeps (state+city exempt → federal only at 35%)
        // Bank money market accounts (Citizens, BofA, etc.) are ordinary interest — fully taxed
        const isTreasuryMM = (desc: string | null) => {
          const d = (desc ?? "").toLowerCase();
          // Explicit treasury/sweep keywords — but exclude bank deposit money markets
          if (d.includes("private bank") || d.includes("citizens") || d.includes("bank of america")) return false;
          return d.includes("sweep") || d.includes("treasur") || d.includes("t-bill") ||
            (d.includes("money market") && (d.includes("government") || d.includes("fidelity") || d.includes("vanguard") || d.includes("schwab") || d.includes("jpmorgan") || d.includes("blackrock")));
        };

        const reserveAccts: Acct[] = assets
          .filter(
            (a) =>
              a.type === "cash" &&
              (a.description ?? "").toLowerCase().includes("checking"),
          )
          .map((a) => {
            const y = extractRate(a.description)
              ? extractRate(a.description) + "%"
              : "0.01%";
            const n = shortName(a.description);
            return {
              name: n,
              value: Number(a.value),
              yield_: y,
              yieldAT: toATFull(y),
              acctNum: acctHash(n),
            };
          });

        const flowAccts: Acct[] = assets
          .filter(
            (a) =>
              a.type === "cash" &&
              !(a.description ?? "").toLowerCase().includes("checking") &&
              !(a.description ?? "").toLowerCase().includes("brokerage") &&
              !(a.description ?? "").toLowerCase().includes("fidelity") &&
              !(a.description ?? "").toLowerCase().includes("sweep"),
          )
          .map((a) => {
            const y = extractRate(a.description)
              ? extractRate(a.description) + "%"
              : "0.01%";
            const n = shortName(a.description);
            return {
              name: n,
              value: Number(a.value),
              yield_: y,
              yieldAT: isTreasuryMM(a.description) ? toATFed(y) : toATFull(y),
              acctNum: acctHash(n),
            };
          });

        const buildAccts: Acct[] = assets
          .filter(
            (a) =>
              a.type === "fixed_income" &&
              ((a.description ?? "").toLowerCase().includes("treasur") ||
                (a.description ?? "").toLowerCase().includes("t-bill")),
          )
          .map((a) => {
            const y = extractRate(a.description)
              ? extractRate(a.description) + "%"
              : "—";
            const n = shortName(a.description);
            return {
              name: n,
              value: Number(a.value),
              yield_: y,
              yieldAT: toATFed(y),
              acctNum: acctHash(n),
            };
          });

        const altVal = altValEarly;
        const reVal = reValEarly;
        // Grow sub-accounts: detailed breakdown per prototype model
        // yieldAT = 5yr historical return for display in the "5yr Return" column
        // incomeAT = after-tax yield used for income impact calculations:
        //   Equities (S&P 500 / MSCI World basis): 10% gross × (1 − 20% cap gains) = 8.0% AT
        //   PE Co-Invest: 15% gross × 80% = 12.0% AT
        const growAccts: Acct[] = [
          { name: "Cash — Brokerage Sweep",  value: 222965, yield_: "—", yieldAT: "2.5%",  incomeAT: "2.5%",  acctNum: acctHash("Cash — Brokerage Sweep") },
          { name: "International",            value: 244685, yield_: "—", yieldAT: "7.9%",  incomeAT: "8.0%",  acctNum: acctHash("International") },
          { name: "US Total Market",          value: 779878, yield_: "—", yieldAT: "14.1%", incomeAT: "8.0%",  acctNum: acctHash("US Total Market") },
          { name: "US Large Cap",             value: 535000, yield_: "—", yieldAT: "15.2%", incomeAT: "8.0%",  acctNum: acctHash("US Large Cap") },
          { name: "US Small Cap",             value: 323582, yield_: "—", yieldAT: "9.1%",  incomeAT: "8.0%",  acctNum: acctHash("US Small Cap") },
          { name: "US Dividend / Value",      value: 94369,  yield_: "—", yieldAT: "10.3%", incomeAT: "8.0%",  acctNum: acctHash("US Dividend / Value") },
          { name: "Single Stock",             value: 238311, yield_: "—", yieldAT: "~20%+", incomeAT: "8.0%",  acctNum: acctHash("Single Stock") },
          { name: "Bonds",                    value: 61210,  yield_: "—", yieldAT: "0.2%",  incomeAT: "0.2%",  acctNum: acctHash("Bonds") },
          { name: "Crypto",                   value: 9500,   yield_: "—", yieldAT: "~30%+", incomeAT: "8.0%",  acctNum: acctHash("Crypto") },
        ];
        const otherAccts: Acct[] = [
          ...(altVal > 0
            ? [
                {
                  name: "Private Equity & Alternatives",
                  value: altVal,
                  yield_: "[15%]",
                  yieldAT: toATCapG("15%"), // cap gains rate → 10.20%
                  incomeAT: "12.0%", // 15% gross × (1 − 20% cap gains) = 12% AT
                },
              ]
            : []),
          ...(reVal > 0
            ? [
                {
                  name: "Real Estate",
                  value: reVal,
                  yield_: "~5%",
                  yieldAT: toATCapG("5%"), // cap gains rate → 3.40%
                },
              ]
            : []),
        ];
        const weightedGrossYield = (accts: Acct[], total: number): number => {
          if (total === 0 || accts.length === 0) return 0;
          return (
            accts.reduce((s, a) => s + parseYieldNum(a.yield_) * a.value, 0) /
            total
          );
        };
        // Weights AT yields for income impact calculations.
        // Uses incomeAT when present (Grow bucket equities/PE), otherwise falls back to yieldAT.
        // Excludes "Tax-def." and "—" display-only entries.
        const weightedATYield = (accts: Acct[], total: number): number => {
          if (total === 0 || accts.length === 0) return 0;
          let weightedSum = 0, weightedTotal = 0;
          for (const a of accts) {
            const n = parseYieldNum(a.incomeAT ?? a.yieldAT);
            if (n > 0) { weightedSum += n * a.value; weightedTotal += a.value; }
          }
          return weightedTotal > 0 ? weightedSum / weightedTotal : 0;
        };

        type GBRow = {
          def: (typeof GURU_BUCKETS_DEF)[number];
          current: number;
          target: number;
          delta: number;
          calc: string;
          subAccounts: Acct[];
          guruAtPct: number;
          bpPickup: number;
        };
        const mkRow = (
          def: (typeof GURU_BUCKETS_DEF)[number],
          current: number,
          target: number,
          delta: number,
          calc: string,
          subAccounts: Acct[],
          guruAtPct: number,
        ): GBRow => ({
          def,
          current,
          target,
          delta,
          calc,
          subAccounts,
          guruAtPct,
          bpPickup: Math.round(
            (guruAtPct - weightedATYield(subAccounts, current)) * 100,
          ),
        });
        const rows: GBRow[] = [
          mkRow(
            GURU_BUCKETS_DEF[0],
            reserveCurrent,
            reserveTarget,
            reserveDelta,
            "2 months of core recurring expenses",
            reserveAccts,
            2.28, // CIT Money Market Fund: 4.30% × 53% (bank MM, ordinary income)
          ),
          mkRow(
            GURU_BUCKETS_DEF[1],
            flowAccts.reduce((s, a) => s + a.value, 0),
            flowTarget,
            flowTarget - flowAccts.reduce((s, a) => s + a.value, 0),
            "12 months of total anticipated outflows",
            flowAccts,
            2.80, // JPMorgan 100% Treasuries MMF: 4.30% × 65% (federal only)
          ),
          mkRow(
            GURU_BUCKETS_DEF[2],
            buildCurrent,
            buildTarget,
            0,
            "Maintain short-term reserve position",
            buildAccts,
            2.74, // US Treasuries 3–6 Month Ladder: 4.22% × 65% (federal only)
          ),
          mkRow(
            GURU_BUCKETS_DEF[3],
            growCurrent,
            growTarget,
            growDelta,
            "Remaining assets — long-term compounding",
            growAccts,
            8.00, // S&P 500 / Total Market ETF: 10% gross × (1 − 20% cap gains) = 8% AT
          ),
        ];

        const deltaIcon = (d: number) => (d > 0 ? "▲" : d < 0 ? "▼" : "—");
        const deltaCls = (d: number) =>
          d > 0
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : d < 0
              ? "bg-rose-50 text-rose-600 border-rose-200"
              : "bg-secondary/30 text-muted-foreground border-border";

        return (
          <div className="space-y-5">
            {/* ── Portfolio Overview Hero ── */}
            {(() => {
              const heroCardTotal = assets.reduce((s, a) => s + Number(a.value), 0);
              return (
                <div className="rounded-xl border bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 px-6 py-5">
                  <div className="flex flex-col sm:flex-row gap-6 items-center">
                    {/* Total Assets headline */}
                    <div className="flex-shrink-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="rounded-lg p-1.5 bg-emerald-100">
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                          Total Assets
                        </p>
                      </div>
                      <p className="text-4xl font-extrabold leading-tight tabular-nums text-emerald-700">
                        {fmt(heroCardTotal)}
                      </p>
                      <p className="text-[10px] text-emerald-600/70 mt-1">
                        GURU Allocation View · {assets.length} accounts
                      </p>
                    </div>

                    {/* DIVIDER */}
                    <div className="hidden sm:block w-px self-stretch bg-emerald-200" />

                    {/* Potential Excess Cash — static metric */}
                    <div className="flex-shrink-0">
                      <p className="text-[9px] uppercase tracking-widest text-emerald-700/70 font-bold mb-0.5">Potential Excess Cash</p>
                      <p className="text-2xl font-black tabular-nums text-emerald-700">{fmt(excessCash)}</p>
                      <p className="text-[9px] text-emerald-600/60 mt-0.5">available to redeploy</p>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Amber impact box — only when changes are pending */}
                    {(() => {
                      const anyChanges = pendingTransfers.length > 0 || Object.values(bucketProductSelections).some(sels => sels.length > 0);
                      if (!anyChanges) return null;
                      const parseAT = (s: string) => parseFloat(s.replace(/[^0-9.\[\]]/g, "").replace(/[\[\]]/g, "")) || 0;
                      const impacts = rows.map((r) => {
                        const inAmt = pendingTransfers.filter(t => t.to === r.def.name).reduce((s, t) => s + t.amount, 0);
                        const outAmt = pendingTransfers.filter(t => t.from === r.def.name).reduce((s, t) => s + t.amount, 0);
                        const newBalance = r.current + inAmt - outAmt;
                        const curATYield = weightedATYield(r.subAccounts, r.current);
                        const sels = bucketProductSelections[r.def.name] ?? [];

                        if (sels.length > 0) {
                          // Product selected: full impact — yield change on the whole new balance
                          const newATYield = sels.reduce((s, sel) => s + parseAT(sel.product.atYield) * (sel.alloc / 100), 0);
                          return {
                            pickup: (newBalance * newATYield / 100) - (r.current * curATYield / 100),
                            curIncome: r.current * curATYield / 100,
                          };
                        } else {
                          // No product selected: only count income loss from outbound transfers.
                          // Inbound cash earns $0 additional income until a product is chosen.
                          return {
                            pickup: -(outAmt * curATYield / 100),
                            curIncome: r.current * curATYield / 100,
                          };
                        }
                      });
                      const totalPickup = impacts.reduce((s, i) => s + i.pickup, 0);
                      const totalCurIncome = impacts.reduce((s, i) => s + i.curIncome, 0);
                      const pctChange = totalCurIncome > 0 ? (totalPickup / totalCurIncome) * 100 : 0;
                      const isGain = totalPickup >= 0;
                      const valCol = isGain ? "#15803d" : "#dc2626";
                      /* Box ~360px wide × 100px tall — rotating border effect */
                      const BW = 360; const BH = 100;
                      const diag = Math.ceil(Math.sqrt(BW * BW + BH * BH)) + 20;
                      return (
                        <div className="relative flex-shrink-0 rounded-xl overflow-hidden flex-shrink-0" style={{ width: BW, height: BH }}>
                          {/* Rotating conic gradient — sweeping border */}
                          <motion.div
                            style={{
                              position: "absolute",
                              width: diag,
                              height: diag,
                              top: "50%",
                              left: "50%",
                              marginTop: -diag / 2,
                              marginLeft: -diag / 2,
                              background: "conic-gradient(from 0deg at 50% 50%, #f59e0b 0deg, #fcd34d 40deg, #fef3c7 80deg, transparent 140deg, transparent 300deg, #f59e0b 360deg)",
                            }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                          />
                          {/* Amber panel — 2px inset exposes the rotating border */}
                          <div className="absolute rounded-[10px] bg-amber-50 px-4 py-3 flex flex-col justify-between" style={{ inset: "2px" }}>
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                              <p className="uppercase tracking-widest font-black text-amber-700 text-[11px]">Impact from Selection</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-1">
                              <div>
                                <p className="text-[8px] uppercase tracking-widest text-amber-700/60 font-bold mb-0.5">After Tax Income / Year</p>
                                <p className="text-xl font-black tabular-nums leading-none" style={{ color: valCol }}>
                                  {isGain ? "+" : "−"}{fmt(Math.abs(Math.round(totalPickup)))}
                                </p>
                              </div>
                              <div>
                                <p className="text-[8px] uppercase tracking-widest text-amber-700/60 font-bold mb-0.5">Income Δ</p>
                                <p className="text-xl font-black tabular-nums leading-none" style={{ color: valCol }}>
                                  {isGain ? "+" : "−"}{Math.abs(pctChange).toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  {/* 5 bucket mini-cards — single row normally, two-row pro forma when transfers pending */}
                  {(() => {
                    const hasPending = pendingTransfers.length > 0;
                    const fmtK = (v: number) => `$${Math.round(v).toLocaleString()}`;

                    const renderBucketCard = (r: GBRow, proforma: boolean) => {
                      const hc = HERO_COLORS[r.def.name] ?? { bg: r.def.bg, accent: r.def.accent };
                      const inAmt = pendingTransfers.filter(t => t.to === r.def.name).reduce((s, t) => s + t.amount, 0);
                      const outAmt = pendingTransfers.filter(t => t.from === r.def.name).reduce((s, t) => s + t.amount, 0);
                      const proBalance = r.current + inAmt - outAmt;
                      const balance = proforma ? proBalance : r.current;
                      const deltaAmt = proBalance - r.current;
                      const avgYieldV = weightedGrossYield(r.subAccounts, r.current);
                      const isOverfund = r.delta < -5000;
                      const isDragTarget = dragItem && dragItem !== r.def.name;

                      const isGrowCard = r.def.name === "Grow";

                      /* ── Product-change yield preview ── */
                      const parseGross = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
                      const productSels = bucketProductSelections[r.def.name] ?? [];
                      const hasProductChange = !isGrowCard && productSels.length > 0;
                      const newGrossYield = hasProductChange
                        ? productSels.reduce((s, sel) => s + parseGross(sel.product.grossYield) * (sel.alloc / 100), 0)
                        : avgYieldV;
                      const yieldChanged = hasProductChange && Math.abs(newGrossYield - avgYieldV) > 0.001;

                      /* ── Option B inline before/after — all buckets with a delta ── */
                      if (hasPending && deltaAmt !== 0 && !proforma) {
                        return (
                          <div key={`${r.def.name}-optB`} className="flex flex-col">
                            <div className="mb-1 h-5" />
                            <div className="rounded-xl p-4 flex-1" style={{ background: hc.bg }}>
                              <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: hc.dot ?? hc.accent }} />
                                <span className="text-[11px] font-black uppercase text-white leading-tight truncate">{r.def.name}</span>
                              </div>
                              <p className="text-[9px] italic text-white/50 leading-snug h-8 line-clamp-2">{r.def.rule}</p>
                              {/* Before row — balance + yield crossed out */}
                              <div className="flex items-baseline justify-between gap-1 mt-1 opacity-40 line-through">
                                <p className="text-sm font-bold text-white tabular-nums leading-none">{fmtK(r.current)}</p>
                                {!isGrowCard && <p className="text-white tabular-nums flex-shrink-0 text-[10px]">{avgYieldV.toFixed(2)}%</p>}
                              </div>
                              {/* Dotted divider */}
                              <div className="border-t border-dashed border-white/25 my-1.5" />
                              {/* After row — new balance + yield (updated if product changed) */}
                              <div className="flex items-baseline justify-between gap-1">
                                <p className="font-black text-white tabular-nums text-[16px]">
                                  {fmtK(proBalance)}
                                </p>
                                {!isGrowCard && (
                                  yieldChanged ? (
                                    <span className="flex items-baseline gap-1 flex-shrink-0">
                                      <span className="text-white/40 tabular-nums text-[10px]">{avgYieldV.toFixed(2)}% yield</span>
                                      <span className="text-white tabular-nums text-[11px] font-black">{newGrossYield.toFixed(2)}% yield</span>
                                    </span>
                                  ) : (
                                    <p className="text-white/70 tabular-nums flex-shrink-0 text-[10px] font-semibold">{avgYieldV.toFixed(2)}% yield</p>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={`${r.def.name}-${proforma ? "pro" : "cur"}`} className="flex flex-col">
                          <div className="mb-1 h-5 flex items-center justify-center">
                            {!proforma && yieldChanged && (
                              <span className="text-[8px] font-black px-2 py-0.5 rounded-full border bg-violet-50 border-violet-300 text-violet-700">
                                ~ yield change
                              </span>
                            )}
                          </div>
                          <div
                            className={`rounded-xl p-4 flex-1 transition-all duration-150 ${!proforma && isDragTarget ? "ring-2 ring-amber-400 ring-offset-1 scale-[1.02]" : ""}`}
                            style={{ background: hc.bg }}
                            onDragOver={!proforma && isDragTarget ? (e) => e.preventDefault() : undefined}
                            onDrop={!proforma && isDragTarget ? (e) => {
                              e.preventDefault();
                              setDragItem(null);
                              document.getElementById(`guru-bucket-${r.def.name.toLowerCase().replace(/\s+/g, "-")}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                            } : undefined}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: hc.dot }} />
                              <span className="text-[11px] font-black uppercase text-white leading-tight truncate">{r.def.name}</span>
                            </div>
                            <p className="text-[9px] italic text-white/50 leading-snug h-8 line-clamp-2">{r.def.rule}</p>
                            {yieldChanged && !proforma ? (
                              <>
                                {/* Before row — faded + crossed out */}
                                <div className="flex items-baseline justify-between gap-1 mt-1 opacity-40 line-through">
                                  <p className="text-sm font-bold text-white tabular-nums leading-none">{fmtK(balance)}</p>
                                  {!isGrowCard && <p className="text-white tabular-nums flex-shrink-0 text-[10px]">{avgYieldV.toFixed(2)}% yield</p>}
                                </div>
                                {/* Dotted divider */}
                                <div className="border-t border-dashed border-white/25 my-1.5" />
                                {/* After row */}
                                <div className="flex items-baseline justify-between gap-1">
                                  <p className="font-black text-white tabular-nums text-[16px] leading-none">{fmtK(balance)}</p>
                                  {!isGrowCard && <p className="text-white tabular-nums flex-shrink-0 text-[11px] font-black">{newGrossYield.toFixed(2)}% yield</p>}
                                </div>
                              </>
                            ) : (
                              <div className="flex items-baseline justify-between mt-1 gap-1">
                                <p className={`${fmtK(balance).length > 9 ? "text-sm" : fmtK(balance).length > 7 ? "text-base" : "text-xl"} font-black text-white leading-none tabular-nums`}>
                                  {fmtK(balance)}
                                </p>
                                {!isGrowCard && <p className="text-white/60 tabular-nums flex-shrink-0 text-[12px]">{avgYieldV.toFixed(2)}% yield</p>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    };

                    const renderSubCats = () => {
                      const totalOther = reVal + altVal + plan529;
                      return (
                        <div className="flex flex-col">
                          <div className="h-5 mb-1" />
                          <div className="rounded-xl p-4 flex-1 bg-slate-500">
                            <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
                              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-slate-300" />
                              <span className="text-[11px] font-black uppercase text-white leading-tight truncate">Grow (Other)</span>
                            </div>
                            <p className="text-[9px] italic text-white/50 leading-snug h-8 line-clamp-2">Real estate · alternatives · 529 plans</p>
                            <p className={`${fmtK(totalOther).length > 9 ? "text-sm" : fmtK(totalOther).length > 7 ? "text-base" : "text-xl"} font-black text-white leading-none tabular-nums mt-1`}>
                              {fmtK(totalOther)}
                            </p>
                          </div>
                        </div>
                      );
                    };

                    /* ── Single-row layout — Option B cards are self-contained ── */
                    return (
                      <div className="grid grid-cols-5 gap-3 mt-5">
                        {rows.map((r) => renderBucketCard(r, false))}
                        {renderSubCats()}
                      </div>
                    );
                  })()}
                  {/* ── Org-chart flow lines — appear only when transfers are pending ── */}
                  {(() => {
                    if (pendingTransfers.length === 0) return null;
                    const H = 72;
                    const dropY = 36;
                    const BUCKET_ORDER = ["Operating Cash", "Reserve", "Build", "Grow"] as const;
                    const bucketPct = (name: string) => {
                      const idx = BUCKET_ORDER.indexOf(name as typeof BUCKET_ORDER[number]);
                      if (idx === -1) return null;
                      return ((idx + 0.5) / 5) * 100;
                    };
                    return (
                      <div className="relative mt-1 mb-1" style={{ height: H }}>
                        {pendingTransfers.map((pt, di) => {
                          const srcPct = bucketPct(pt.from);
                          const tgtPct = bucketPct(pt.to);
                          if (srcPct === null || tgtPct === null) return null;
                          const srcRow = rows.find((r) => r.def.name === pt.from);
                          const tgtRow = rows.find((r) => r.def.name === pt.to);
                          const srcColor = srcRow?.def.bg ?? "#64748b";
                          const tgtColor = tgtRow?.def.bg ?? "#64748b";
                          const leftPct = Math.min(srcPct, tgtPct);
                          const wPct = Math.abs(srcPct - tgtPct);
                          const fmtAmt = `$${Math.round(pt.amount).toLocaleString()}`;
                          return (
                            <div key={`${pt.from}->${pt.to}`}>
                              {/* Vertical drop from source */}
                              <div className="absolute rounded-full" style={{
                                left: `${srcPct}%`, top: 0,
                                width: 2, height: dropY,
                                background: srcColor,
                                transform: "translateX(-50%)",
                                opacity: 0.6,
                              }} />
                              {/* Amount label beside drop line */}
                              <div className="absolute text-[9px] font-black tabular-nums bg-white/90 rounded px-1 leading-tight whitespace-nowrap" style={{
                                left: `calc(${srcPct}% + 6px)`,
                                top: Math.floor(dropY / 2) - 6,
                                color: "#dc2626",
                              }}>
                                {fmtAmt} out
                              </div>
                              {/* Horizontal connector */}
                              <div className="absolute" style={{
                                left: `${leftPct}%`, top: dropY,
                                width: `${wPct}%`, height: 2,
                                background: `linear-gradient(to ${srcPct < tgtPct ? "right" : "left"}, ${srcColor}80, ${tgtColor}80)`,
                              }} />
                              {/* Vertical rise to target */}
                              <div className="absolute rounded-full" style={{
                                left: `${tgtPct}%`, top: dropY - 28,
                                width: 2, height: 28,
                                background: tgtColor,
                                transform: "translateX(-50%)",
                                opacity: 0.6,
                              }} />
                              {/* "in" label beside rise line */}
                              <div className="absolute text-[9px] font-black tabular-nums bg-white/90 rounded px-1 leading-tight whitespace-nowrap" style={{
                                left: `calc(${tgtPct}% + 6px)`,
                                top: dropY - 22,
                                color: "#16a34a",
                              }}>
                                {fmtAmt} in
                              </div>
                              {/* Animated dot traveling from → to */}
                              <motion.div
                                className="absolute rounded-full z-10 shadow"
                                style={{
                                  width: 9, height: 9,
                                  background: srcColor,
                                  marginLeft: -4, marginTop: -4,
                                }}
                                animate={{
                                  left: [`${srcPct}%`, `${srcPct}%`, `${tgtPct}%`, `${tgtPct}%`],
                                  top: [0, dropY, dropY, dropY - 28],
                                }}
                                transition={{
                                  duration: 2.8,
                                  delay: di * 0.8,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                  times: [0, 0.35, 0.65, 1],
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
            {/* 4 bucket cards — 2×2 grid */}
            <div className="space-y-3">
              {rows.map((r) => {
                const prods = BUCKET_PRODUCTS[r.def.name] ?? [];
                return (
                  <div
                    key={r.def.name}
                    id={`guru-bucket-${r.def.name.toLowerCase().replace(/\s+/g, '-')}`}
                    className="rounded-xl overflow-hidden flex shadow-sm border border-border"
                  >
                    {/* ── LEFT: Header + Accounts ── */}
                    <div className="w-[540px] flex-shrink-0 flex flex-col border-r border-border">
                      <div
                        className="px-4 py-3 flex items-center gap-2.5"
                        style={{ background: HERO_COLORS[r.def.name]?.bg ?? r.def.bg }}
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: r.def.accent }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-bold text-white leading-none">
                            {r.def.name}
                          </p>
                          <p
                            className="text-[10px] italic mt-0.5 truncate"
                            style={{ color: r.def.accent, opacity: 0.85 }}
                          >
                            {r.def.tagline}
                          </p>
                        </div>
                        <p className="text-[10px] text-white/50 text-right leading-snug max-w-[90px] flex-shrink-0">
                          {r.def.rule}
                        </p>
                      </div>
                      <div className="bg-card px-4 pt-3 pb-3 flex-1 flex flex-col">
                        {/* Column headers */}
                        {(() => {
                          const isG = r.def.name === "Grow";
                          return (
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Account</span>
                              <div className="flex items-center gap-4">
                                <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground w-20 text-right">Balance</span>
                                {!isG && <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground w-10 text-right">Yield</span>}
                                <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground w-24 text-right">{isG ? "5yr Return" : "Tax-Eff. Yield"}</span>
                              </div>
                            </div>
                          );
                        })()}
                        {(() => {
                          const activeSels = bucketProductSelections[r.def.name] ?? [];
                          const hasNewAlloc = activeSels.length > 0;
                          const isGrow = r.def.name === "Grow";
                          const strikeCls = hasNewAlloc ? "opacity-35 line-through decoration-slate-400" : "";

                          const equityNames = ["International", "US Total Market", "US Large Cap", "US Small Cap", "US Dividend / Value", "Single Stock"];
                          const growGroups = isGrow ? [
                            { label: "Equities", items: r.subAccounts.filter(a => equityNames.includes(a.name)) },
                            { label: "Fixed Income", items: r.subAccounts.filter(a => a.name === "Bonds") },
                            { label: "Cash", items: r.subAccounts.filter(a => a.name.startsWith("Cash")) },
                            { label: "Alternatives", items: r.subAccounts.filter(a => a.name === "Crypto") },
                          ].filter(g => g.items.length > 0) : [];

                          const AcctRow = ({ dot, name, acctNum, bal, yld, at, showYld, dotColor }: {
                            dot?: boolean; name: React.ReactNode; acctNum?: string;
                            bal: React.ReactNode; yld?: React.ReactNode; at: React.ReactNode;
                            showYld: boolean; dotColor?: string;
                          }) => (
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                {dot !== false && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />}
                                <span className="text-[11px] text-muted-foreground leading-tight truncate">{name}</span>
                                {acctNum && <span className="flex-shrink-0 text-[9px] tabular-nums text-muted-foreground/60">···{acctNum}</span>}
                              </div>
                              <div className="flex items-center gap-4 flex-shrink-0">
                                <span className="text-[10px] font-semibold tabular-nums text-foreground w-20 text-right">{bal}</span>
                                {showYld && <span className="text-[10px] font-semibold tabular-nums text-foreground w-10 text-right">{yld ?? "—"}</span>}
                                <span className="text-[10px] tabular-nums text-muted-foreground w-24 text-right">{at}</span>
                              </div>
                            </div>
                          );

                          return (
                        <div className="space-y-1.5 flex-1">
                          {isGrow ? (
                            growGroups.map((group) => {
                              const groupTotal = group.items.reduce((s, a) => s + a.value, 0);
                              return (
                                <div key={group.label} className={`space-y-1 ${strikeCls}`}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{group.label}</span>
                                    <span className="text-[10px] font-black tabular-nums text-foreground">{fmt(groupTotal)}</span>
                                  </div>
                                  {group.items.map((acct) => (
                                    <div key={acct.name} className="pl-2">
                                      <AcctRow
                                        dotColor={hasNewAlloc ? "#94a3b8" : r.def.accent}
                                        name={acct.name}
                                        acctNum={acct.acctNum}
                                        bal={fmt(acct.value)}
                                        at={acct.yieldAT}
                                        showYld={false}
                                      />
                                    </div>
                                  ))}
                                </div>
                              );
                            })
                          ) : r.subAccounts.map((acct) => (
                            <div key={acct.name} className={strikeCls}>
                              <AcctRow
                                dotColor={hasNewAlloc ? "#94a3b8" : r.def.accent}
                                name={acct.name}
                                acctNum={acct.acctNum}
                                bal={fmt(acct.value)}
                                yld={acct.yield_}
                                at={acct.yieldAT}
                                showYld={true}
                              />
                            </div>
                          ))}
                          {/* New amber rows for selected products */}
                          {activeSels.map((sel) => {
                            const _inAmt = pendingTransfers.filter((t) => t.to === r.def.name).reduce((s, t) => s + t.amount, 0);
                            const _outAmt = pendingTransfers.filter((t) => t.from === r.def.name).reduce((s, t) => s + t.amount, 0);
                            const allocBal = (r.current + _inAmt - _outAmt) * (sel.alloc / 100);
                            return (
                              <div key={sel.product.name} className="rounded-md px-2 py-1.5 border border-amber-300 bg-amber-50 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-500" />
                                  <span className="text-[11px] font-semibold text-amber-800 leading-tight truncate">{sel.product.name}</span>
                                </div>
                                <div className="flex items-center gap-4 flex-shrink-0">
                                  <span className="text-[10px] font-bold text-amber-700 tabular-nums w-20 text-right">{fmt(allocBal)}</span>
                                  {!isGrow && <span className="text-[10px] font-semibold text-amber-600 tabular-nums w-10 text-right">{sel.product.grossYield}</span>}
                                  <span className="text-[10px] text-amber-600 tabular-nums w-24 text-right">{sel.product.atYield}</span>
                                </div>
                              </div>
                            );
                          })}
                          {r.subAccounts.length === 0 && (
                            <p className="text-xs text-muted-foreground italic">No accounts mapped</p>
                          )}
                          {/* Pending outbound transfers */}
                          {pendingTransfers.filter((t) => t.from === r.def.name).map((pt) => (
                            <div key={`outbound-${pt.to}`} className="rounded-md px-2 py-1.5 border border-amber-300 bg-amber-50 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-500 animate-pulse" />
                                <span className="text-[11px] font-semibold text-amber-800 leading-tight">Transfer out → {pt.to}</span>
                              </div>
                              <span className="text-[10px] font-bold text-red-600 tabular-nums flex-shrink-0">−{fmt(pt.amount)}</span>
                            </div>
                          ))}
                          {/* Pending inbound transfers */}
                          {pendingTransfers.filter((t) => t.to === r.def.name).map((pt) => (
                            <div key={`inbound-${pt.from}`} className="rounded-md px-2 py-1.5 border border-amber-300 bg-amber-50 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-500 animate-pulse" />
                                <span className="text-[11px] font-semibold text-amber-800 leading-tight">Transfer from {pt.from}</span>
                              </div>
                              <span className="text-[10px] font-bold text-amber-700 tabular-nums flex-shrink-0">+{fmt(pt.amount)}</span>
                            </div>
                          ))}
                          {pendingTransfers.filter((t) => t.to === r.def.name).length > 0 && (
                            <div className="flex items-center gap-1 mt-1 text-[9px] font-black uppercase tracking-wider text-amber-600">
                              <AlertCircle className="w-3 h-3 flex-shrink-0" />
                              Select a product for incoming funds →
                            </div>
                          )}
                        </div>
                          );
                        })()}
                        {/* Totals footer */}
                        {(() => {
                          const outAmt = pendingTransfers.filter((t) => t.from === r.def.name).reduce((s, t) => s + t.amount, 0);
                          const inAmt = pendingTransfers.filter((t) => t.to === r.def.name).reduce((s, t) => s + t.amount, 0);
                          const netDelta = inAmt - outAmt;
                          const hasPending = netDelta !== 0;
                          const adjTotal = r.current + netDelta;
                          const ftIsGrow = r.def.name === "Grow";
                          const ftSels = bucketProductSelections[r.def.name] ?? [];
                          const _parseAT = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
                          const _parseGross = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
                          const curATYield = weightedATYield(r.subAccounts, r.current);
                          const curGrossYield = weightedGrossYield(r.subAccounts, r.current);
                          const newATYield = ftSels.length > 0
                            ? ftSels.reduce((s, sel) => s + _parseAT(sel.product.atYield) * (sel.alloc / 100), 0)
                            : null;
                          const newGrossYield = ftSels.length > 0
                            ? ftSels.reduce((s, sel) => s + _parseGross(sel.product.grossYield) * (sel.alloc / 100), 0)
                            : null;
                          const hasYieldChange = newATYield !== null && Math.abs(newATYield - curATYield) > 0.001;
                          const hasGrossChange = newGrossYield !== null && !ftIsGrow && Math.abs(newGrossYield - curGrossYield) > 0.001;
                          return (
                            <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between">
                              <span className="text-[9px] text-muted-foreground italic">
                                {r.subAccounts.length} position{r.subAccounts.length !== 1 ? "s" : ""}
                              </span>
                              <div className="flex items-center gap-4">
                                {hasPending ? (
                                  <span className="text-xs font-bold tabular-nums flex flex-col items-end leading-tight w-20">
                                    <span className="text-muted-foreground line-through text-[10px]">{fmt(r.current)}</span>
                                    <span className="text-amber-600">{fmt(adjTotal)}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs font-bold tabular-nums text-foreground w-20 text-right">{fmt(r.current)}</span>
                                )}
                                {!ftIsGrow && (
                                  hasGrossChange ? (
                                    <span className="flex flex-col items-end leading-tight w-10">
                                      <span className="text-[9px] tabular-nums text-muted-foreground line-through">{curGrossYield.toFixed(2)}%</span>
                                      <span className="text-[9px] font-bold tabular-nums" style={{ color: r.def.bg }}>{newGrossYield!.toFixed(2)}%</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold tabular-nums w-10 text-right" style={{ color: r.def.bg }}>
                                      {r.current > 0 ? `${curGrossYield.toFixed(2)}%` : "—"}
                                    </span>
                                  )
                                )}
                                {hasYieldChange ? (
                                  <span className="flex flex-col items-end leading-tight w-24">
                                    <span className="text-[9px] tabular-nums text-muted-foreground line-through">{curATYield.toFixed(2)}%</span>
                                    <span className="text-[9px] font-bold tabular-nums text-violet-600">{newATYield!.toFixed(2)}%</span>
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-muted-foreground tabular-nums w-24 text-right">
                                    {r.current > 0 ? `${curATYield.toFixed(2)}%` : "—"}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    {/* ── EXECUTION: Transfer panel ── */}
                    <BucketExecutionPanel
                      bucketName={r.def.name}
                      current={r.current}
                      target={r.target}
                      delta={r.target - r.current}
                      accentColor={r.def.accent}
                      bgColor={r.def.bg}
                      avgYield={weightedGrossYield(r.subAccounts, r.current)}
                      avgYieldAT={weightedATYield(r.subAccounts, r.current)}
                      bpPickup={r.bpPickup}
                      totalAssets={totalAssets}
                      onExecute={handleExecute}
                      onUndo={handleUndo}
                      monthsInputConfig={
                        r.def.name === "Operating Cash"
                          ? { defaultMonths: opsCashMonths, monthlyUnit: 20940, label: "mos. of expenses" }
                          : r.def.name === "Reserve"
                            ? {
                                defaultMonths: 12,
                                forecastCumulatives: forecastData.map(d => d.cumulative),
                                nextMonthExpenses: 3 * minMonthly,
                                label: "mos. of cumulative net cashflow",
                              }
                            : undefined
                      }
                    />
                    {/* ── RIGHT: Products panel ── */}
                    <BucketProductPanel
                      bgColor={r.def.bg}
                      accentColor={r.def.accent}
                      products={prods}
                      currentAvgYieldAT={weightedATYield(r.subAccounts, r.current)}
                      bucketName={r.def.name}
                      hasPendingTransfer={pendingTransfers.some(t => t.to === r.def.name)}
                      onSelectionChange={(sels) =>
                        setBucketProductSelections(prev => ({ ...prev, [r.def.name]: sels }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Balance Sheet View (renamed from Details View) ───────────────────────────
function DetailsView({
  assets,
  liabilities,
  cashFlows,
  clientId,
}: {
  assets: Asset[];
  liabilities: Liability[];
  cashFlows: CashFlow[];
  clientId: number;
}) {
  const [tab] = useState<"bs">("bs");
  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalLiab = liabilities.reduce((s, l) => s + Number(l.value), 0);
  const netWorth = totalAssets - totalLiab;

  const assetGroups = buildAssetGroups(assets);
  const liabGroups = buildLiabilityGroups(liabilities);

  const totalAssetRate = (() => {
    const cashAssets = assets.filter((a) => a.type === "cash");
    const weighted = cashAssets.reduce((s, a) => {
      const r = extractRate(a.description);
      return s + (r ? parseFloat(r) * Number(a.value) : 0);
    }, 0);
    return weighted > 0 ? ((weighted / totalAssets) * 100).toFixed(2) : null;
  })();

  const totalLiabRate = (() => {
    const weighted = liabilities.reduce(
      (s, l) => s + parseFloat(l.interestRate) * Number(l.value),
      0,
    );
    return weighted > 0 ? (weighted / totalLiab).toFixed(2) : null;
  })();

  return (
    <div>

      {tab === "bs" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <AddAssetModal clientId={clientId} />
            <AddLiabilityModal clientId={clientId} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <BsTable
              sections={assetGroups}
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
              <div className="border border-border rounded-xl overflow-hidden">
                <div
                  className="grid bg-emerald-50 border-b-0"
                  style={{ gridTemplateColumns: "1fr 90px 56px 90px" }}
                >
                  <div className="px-3 py-3 text-[11px] font-black uppercase tracking-widest text-emerald-800">Net Worth</div>
                  <div className="px-2 py-3 text-right tabular-nums text-[13px] font-black text-emerald-700">
                    {fmt(netWorth)}
                  </div>
                  <div className="px-2 py-3" />
                  <div className="px-2 py-3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Advisor Brief View ───────────────────────────────────────────────────────
function AdvisorBriefView({
  assets,
  cashFlows,
  liabilities,
  onNavigate,
}: {
  assets: Asset[];
  liabilities: Liability[];
  cashFlows: CashFlow[];
  onNavigate: (v: string) => void;
}) {
  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);

  // ── Liquidity calcs — mirrors GURU hero bar exactly ──
  const { totalLiquid: _abvTotalLiquid } = cashBuckets(assets);
  const _abvForecast = buildForecast(cashFlows);
  const cashTroughBuffer = computeTrough(_abvForecast);
  const guruReserveTarget = cashTroughBuffer;
  // cashExcess uses the same formula as the GURU hero bar: totalLiquid − trough
  const cashExcess = Math.max(0, _abvTotalLiquid - cashTroughBuffer);
  // reserveItems = idle bank cash (checking + savings + MM), excluding Fidelity brokerage sweep
  const reserveItems = assets.filter(
    (a) => a.type === "cash" && (a.description ?? "").toLowerCase().match(/checking|savings|money market|mm|sweep/) && !(a.description ?? "").toLowerCase().includes("fidelity"),
  );
  // Non-treasury cash = used for the yield/Fed-cut card only (non-Fidelity bank accounts)
  const _seenDescs = new Set<string>();
  const _nonTreasuryCash = reserveItems.filter((a) => {
    const key = (a.description ?? "").slice(0, 30).toLowerCase();
    if (_seenDescs.has(key)) return false;
    _seenDescs.add(key);
    return true;
  }).reduce((s, a) => s + Number(a.value), 0);
  const brokerageCashItems = assets.filter(
    (a) => a.type === "cash" && (a.description ?? "").toLowerCase().includes("brokerage"),
  );
  const brokerageCashTotal = brokerageCashItems.reduce((s, a) => s + Number(a.value), 0);
  const totalToDeploy = Math.round(brokerageCashTotal + cashExcess);

  // ── Yield calcs ──
  const _currentLiquidYield = 1.4;
  const _guruLiquidYield = 2.7;
  const liquidHero = _abvTotalLiquid + brokerageCashTotal;
  const _yieldPickupAnnual = Math.round(liquidHero * ((_guruLiquidYield - _currentLiquidYield) / 100));
  const bpsPickup = Math.round((_guruLiquidYield - _currentLiquidYield) * 100);

  // ── Fed rate cut lock-in scenario ──
  // non-treasury exposure = idle bank cash minus the reserve buffer
  const _fedCutBps = 50;
  const _excessNotTreasuries = Math.max(0, _nonTreasuryCash - cashTroughBuffer);
  const _fedLockInSavings = Math.round(_excessNotTreasuries * (_fedCutBps / 10000));

  // ── Single-stock risk ──
  const singleStockVal = assets
    .filter((a) => (a.description ?? "").toLowerCase().match(/meta|bank of america|bofA|single/i))
    .reduce((s, a) => s + Number(a.value), 0);
  const singleStockPct = totalAssets > 0 ? ((singleStockVal / totalAssets) * 100).toFixed(1) : "0";

  // ── Workflow state ──
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showEmail, setShowEmail] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [wireModalId, setWireModalId] = useState<string | null>(null);
  const [wireFromAccount, setWireFromAccount] = useState<Record<string, string>>({});
  const [wireScheduleDate, setWireScheduleDate] = useState<Record<string, string>>({});
  const [wireMemo, setWireMemo] = useState<Record<string, string>>({});
  const [scheduled, setScheduled] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  // ── Upcoming Obligations (wire-worthy large payments) ──
  const OBLIGATIONS = [
    {
      id: "prop-tax-jan",
      label: "NYC Property Tax — 1st Installment",
      amount: 17500,
      due: new Date(2026, 0, 15),
      payee: "NYC Dept. of Finance",
      acct: "Acct #4821",
      method: "Wire",
      from: "Citizens Private Banking",
      category: "tax",
      routing: "026013673",
    },
    {
      id: "est-tax-q1",
      label: "Federal Estimated Income Tax — Q1 2026",
      amount: 30000,
      due: new Date(2026, 3, 15),
      payee: "Internal Revenue Service",
      acct: "EFTPS",
      method: "ACH",
      from: "Citizens Private Banking",
      category: "tax",
      routing: "061036010",
    },
    {
      id: "tuition-spring",
      label: "Private School Tuition — Spring Installment",
      amount: 15000,
      due: new Date(2026, 3, 1),
      payee: "Dalton School",
      acct: "Acct #8840",
      method: "Wire",
      from: "Chase Total Checking",
      category: "education",
      routing: "021000021",
    },
    {
      id: "prop-tax-jul",
      label: "NYC Property Tax — 2nd Installment",
      amount: 17500,
      due: new Date(2026, 6, 15),
      payee: "NYC Dept. of Finance",
      acct: "Acct #4821",
      method: "Wire",
      from: "Citizens Private Banking",
      category: "tax",
      routing: "026013673",
    },
    {
      id: "est-tax-q3",
      label: "Federal Estimated Income Tax — Q3 2026",
      amount: 30000,
      due: new Date(2026, 8, 15),
      payee: "Internal Revenue Service",
      acct: "EFTPS",
      method: "ACH",
      from: "Citizens Private Banking",
      category: "tax",
      routing: "061036010",
    },
  ];

  const oblCatStyle = (cat: string) =>
    cat === "tax"
      ? "text-rose-700 bg-rose-50 border-rose-200"
      : cat === "education"
      ? "text-violet-700 bg-violet-50 border-violet-200"
      : "text-slate-700 bg-slate-50 border-slate-200";

  // ── Email composer ──
  const buildEmail = () => {
    const paras: string[] = [];
    if (checked.has("liquidity"))
      paras.push(
        `As we approach the new year, your December bonus has created a meaningful liquidity surplus — roughly ${fmt(totalToDeploy)} above your 3-month reserve target. Rather than letting that sit idle, we'd like to put it to work for you across the Build and Grow allocations we've modeled. The opportunity cost of leaving it in cash is real, and we think the timing is right to act.`,
      );
    if (checked.has("rebalance"))
      paras.push(
        `We've also been monitoring your single-stock concentration. Your E*Trade positions in Meta and Bank of America now represent about ${singleStockPct}% of your total portfolio — above the 5% threshold we'd generally feel comfortable with. We'd like to walk you through a gradual trim strategy that reduces that risk without triggering a large tax event all at once.`,
      );
    if (checked.has("yield"))
      paras.push(
        `On the fixed-income side, the Fed is expected to cut rates by another 50 bps. We have ${fmt(_excessNotTreasuries)} of excess cash sitting outside of treasuries that we can lock in at today's rates before that cut happens. Acting now preserves roughly ${fmt(_fedLockInSavings)} per year in yield — at no added risk. We think this window is time-sensitive.`,
      );
    if (checked.has("cashflow"))
      paras.push(
        `I also wanted to give you a heads-up on some account movements we will be making on your behalf over the next month:\n\nOPERATING CASH\n• In March, $47,126 will move from your Reserve Money Market into your Operating Checking Account to cover the Q1 tax payment and spring tuition — this rebuilds your two-month expense buffer.\n\nRESERVE\n• Your 3-Month Treasury Bill matures on March 31st — those $41,877 in proceeds will stay in your Reserve Money Market as a liquidity buffer, keeping it ready to fund operations through the spring.\n\nBUILD\n• Your Build Account is holding flat at approximately $194,000, earning around 4.75% passively. No changes are planned — this account remains earmarked as long-term savings toward the home upgrade when you are ready to move forward.`,
      );
    if (paras.length === 0)
      paras.push("We wanted to check in and share a few items we've been working through on your behalf.");
    return [
      "Hi Sarah and Michael,",
      "",
      "Hope you're both doing well. I wanted to reach out with a few things on our end that I think are worth a conversation.",
      "",
      ...paras.flatMap((p) => [p, ""]),
      "None of this requires any immediate action on your part — I just want to make sure you have the full picture so we can decide together what makes the most sense. Happy to set up a quick call whenever works for you.",
      "",
      "As always, please don't hesitate to reach out with any questions.",
      "",
      "Best,",
      "Your Advisor",
    ].join("\n");
  };

  const buildEmailJSX = () => {
    const BucketHeader = ({ color, label }: { color: string; label: string }) => (
      <div className="flex items-center gap-2 mt-4 mb-1">
        <div className="h-3.5 w-1 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>{label}</span>
        <div className="flex-1 h-px" style={{ background: color + "33" }} />
      </div>
    );
    const blocks: React.ReactNode[] = [];
    blocks.push(
      <p key="greeting" className="font-serif">Hi Sarah and Michael,</p>,
      <p key="opener" className="font-serif">Hope you're both doing well. I wanted to reach out with a few things on our end that I think are worth a conversation.</p>,
    );
    if (checked.has("liquidity"))
      blocks.push(
        <p key="liq" className="font-serif">As we approach the new year, your December bonus has created a meaningful liquidity surplus — roughly {fmt(totalToDeploy)} above your 3-month reserve target. Rather than letting that sit idle, we'd like to put it to work for you across the Build and Grow allocations we've modeled. The opportunity cost of leaving it in cash is real, and we think the timing is right to act.</p>
      );
    if (checked.has("rebalance"))
      blocks.push(
        <p key="reb" className="font-serif">We've also been monitoring your single-stock concentration. Your E*Trade positions in Meta and Bank of America now represent about {singleStockPct}% of your total portfolio — above the 5% threshold we'd generally feel comfortable with. We'd like to walk you through a gradual trim strategy that reduces that risk without triggering a large tax event all at once.</p>
      );
    if (checked.has("yield"))
      blocks.push(
        <p key="yld" className="font-serif">On the fixed-income side, the Fed is expected to cut rates by another 50 bps. We have {fmt(_excessNotTreasuries)} of excess cash sitting outside of treasuries that we can lock in at today's rates before that cut happens. Acting now preserves roughly {fmt(_fedLockInSavings)} per year in yield — at no added risk. We think this window is time-sensitive.</p>
      );
    if (checked.has("cashflow"))
      blocks.push(
        <div key="cf">
          <p className="font-serif">I also wanted to give you a heads-up on some account movements we will be making on your behalf over the next month:</p>
          <BucketHeader color="#1d4ed8" label="Operating Cash" />
          <ul className="list-none pl-3 space-y-0.5">
            <li className="font-serif text-[12px]">• In March, $47,126 will move from your Reserve Money Market into your Operating Checking Account to cover the Q1 tax payment and spring tuition — this rebuilds your two-month expense buffer.</li>
          </ul>
          <BucketHeader color="#d97706" label="Reserve" />
          <ul className="list-none pl-3 space-y-0.5">
            <li className="font-serif text-[12px]">• Your 3-Month Treasury Bill matures on March 31st — those $41,877 in proceeds will stay in your Reserve Money Market as a liquidity buffer, keeping it ready to fund operations through the spring.</li>
          </ul>
          <BucketHeader color="#16a34a" label="Build" />
          <ul className="list-none pl-3 space-y-0.5">
            <li className="font-serif text-[12px]">• Your Build Account is holding flat at approximately $194,000, earning around 4.75% passively. No changes are planned — this account remains earmarked as long-term savings toward the home upgrade when you are ready to move forward.</li>
          </ul>
        </div>
      );
    if (blocks.length === 2)
      blocks.push(<p key="fallback" className="font-serif">We wanted to check in and share a few items we've been working through on your behalf.</p>);
    blocks.push(
      <p key="close1" className="font-serif">None of this requires any immediate action on your part — I just want to make sure you have the full picture so we can decide together what makes the most sense. Happy to set up a quick call whenever works for you.</p>,
      <p key="close2" className="font-serif">As always, please don't hesitate to reach out with any questions.</p>,
      <p key="sig1" className="font-serif">Best,</p>,
      <p key="sig2" className="font-serif">Your Advisor</p>,
    );
    return <div className="space-y-3 leading-7">{blocks}</div>;
  };

  // ── Card checkbox header helper ──
  const CardCheckHeader = ({
    cardKey,
    color,
    icon: Icon,
    badge,
    priority,
    title,
    subtitle,
  }: {
    cardKey: string;
    color: string;
    icon: React.ElementType;
    badge: string;
    priority: string;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
  }) => {
    const isChecked = checked.has(cardKey);
    return (
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggle(cardKey)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              isChecked ? `border-current bg-current` : "border-slate-300 bg-white"
            }`}
            style={{ color: isChecked ? color : undefined }}
          >
            {isChecked && <Check className="w-3 h-3 text-white" />}
          </button>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}20` }}
          >
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <div>
            <span
              className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border"
              style={{ color, background: `${color}10`, borderColor: `${color}40` }}
            >
              {badge}
            </span>
            <p className="text-base font-black text-foreground mt-1.5 leading-snug">{title}</p>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug font-normal">{subtitle}</p>
            )}
          </div>
        </div>
        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 border ${
          priority === "Time Sensitive" || priority === "High Priority"
            ? "text-rose-600 bg-rose-50 border-rose-200"
            : "text-slate-500 bg-slate-50 border-slate-200"
        }`}>
          {priority}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 border border-slate-800 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-lg font-black text-white tracking-tight">Advisor Brief</p>
            <p className="text-[11px] text-slate-400 font-medium">Sarah & Michael Kessler · {format(DEMO_NOW, "MMMM d, yyyy")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-700/60 border border-slate-600 rounded-full px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span className="text-[10px] text-slate-400">Check items to include in email</span>
          </div>
          <button
            onClick={() => setShowEmail(true)}
            disabled={checked.size === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold transition-all ${
              checked.size > 0
                ? "bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-900/40"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            Compose Email {checked.size > 0 && `(${checked.size})`}
          </button>
        </div>
      </div>
      {/* ── Priority cards ── */}
      <div className="grid grid-cols-2 gap-5">

        {/* ── Section Header: Investments & Liquidity ── */}
        <div className="col-span-2 flex items-center gap-4 py-2">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-7 rounded-full bg-emerald-500 flex-shrink-0" />
            <p className="text-sm font-black uppercase tracking-widest text-foreground">Investments &amp; Liquidity Positioning</p>
          </div>
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-muted-foreground font-semibold flex-shrink-0">3 items</span>
        </div>

        {/* ── Card 1: Deploy Excess Liquidity ── */}
        <div
          className={`rounded-2xl border bg-card shadow-sm overflow-hidden flex flex-col transition-all ${checked.has("liquidity") ? "border-emerald-400 shadow-emerald-100" : "border-border"}`}
          style={{ borderTop: `4px solid #10b981` }}
        >
          <div className="px-6 pt-6 pb-5 flex flex-col gap-4 flex-1">
            <CardCheckHeader
              cardKey="liquidity"
              color="#10b981"
              icon={Wallet}
              badge="Liquidity"
              priority="High Priority"
              title="Harvest Excess Liquidity From Bonus"
              subtitle="Opportunity to increase investment portfolio"
            />
            <div>
              <p className="text-3xl font-black tabular-nums text-emerald-600 leading-none">{fmt(totalToDeploy, true)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">available to deploy based on GURU estimates</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Where it's sitting</p>
              {[...reserveItems, ...brokerageCashItems.filter(a => !(a.description ?? "").toLowerCase().includes("fidelity"))].slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="text-[11px] text-muted-foreground truncate">
                      {(a.description ?? "").split("—")[0].split("(")[0].trim()}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold tabular-nums text-foreground flex-shrink-0">{fmt(Number(a.value))}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 border-t border-border pt-1.5 mt-1.5">
                <span className="text-[10px] font-black text-muted-foreground">GURU Reserve Target (3 mo.)</span>
                <span className="text-[11px] font-black tabular-nums text-emerald-700">{fmt(guruReserveTarget)}</span>
              </div>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb className="w-3 h-3 text-emerald-600" />
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Talking Point</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed italic">
                "The year-end bonus has created a meaningful surplus above the 3-month reserve target. Deploying the excess into Build and Grow puts it to work — GURU shows exactly how."
              </p>
            </div>
          </div>
          <div
            className="px-6 py-3.5 border-t border-border flex items-center justify-between bg-emerald-50/40 cursor-pointer hover:bg-emerald-50 transition-colors"
            onClick={() => onNavigate("guru")}
          >
            <span className="text-[10px] text-muted-foreground">Open GURU Allocation</span>
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">View now <ArrowUpRight className="w-3.5 h-3.5" /></span>
          </div>
        </div>

        {/* ── Card 2: Portfolio Rebalancing ── */}
        <div
          className={`rounded-2xl border bg-card shadow-sm overflow-hidden flex flex-col transition-all ${checked.has("rebalance") ? "border-blue-400 shadow-blue-100" : "border-border"}`}
          style={{ borderTop: `4px solid #3b82f6` }}
        >
          <div className="px-6 pt-6 pb-5 flex flex-col gap-4 flex-1">
            <CardCheckHeader
              cardKey="rebalance"
              color="#3b82f6"
              icon={RefreshCw}
              badge="Investments"
              priority="Medium Priority"
              title="Rebalance Portfolio with Excess Cash"
              subtitle="Ideas to discuss with Sarah and Michael after liquidity conversation"
            />
            {singleStockVal > 0 && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 flex items-start gap-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black text-rose-700 uppercase tracking-wide">Concentration Risk</p>
                  <p className="text-[11px] text-rose-700 mt-0.5">Single-stock positions ({singleStockPct}% of portfolio) exceed the 5% threshold.</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Action Items</p>
              {[
                { label: "Add Sector Rotation Fund to Grow bucket", detail: "Reduces correlation to broad market" },
                { label: "Add Commodities / Inflation Hedge", detail: "Provides protection in rising-rate scenarios" },
                { label: "Trim concentrated single-stock positions", detail: `${singleStockPct}% of portfolio — target under 5%` },
                { label: "Review international allocation", detail: "Currently under-weight vs target model" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5">
                  <div className="w-4 h-4 rounded flex-shrink-0 mt-0.5 border-2 border-slate-200 bg-background" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-foreground">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb className="w-3 h-3 text-blue-600" />
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-700">Talking Point</span>
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed italic">
                "With liquidity identified, we can selectively deploy into under-represented segments — sector funds and commodities give diversification within the moderate risk profile."
              </p>
            </div>
          </div>
          <div
            className="px-6 py-3.5 border-t border-border flex items-center justify-between bg-blue-50/40 cursor-pointer hover:bg-blue-50 transition-colors"
            onClick={() => onNavigate("guru")}
          >
            <span className="text-[10px] text-muted-foreground">Open GURU Allocation</span>
            <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1">View now <ArrowUpRight className="w-3.5 h-3.5" /></span>
          </div>
        </div>

        {/* ── Card 3: Yield Pickup ── */}
        <div
          className={`rounded-2xl border bg-card shadow-sm overflow-hidden flex flex-col transition-all ${checked.has("yield") ? "border-amber-400 shadow-amber-100" : "border-border"}`}
          style={{ borderTop: `4px solid #d97706` }}
        >
          <div className="px-6 pt-6 pb-5 flex flex-col gap-4 flex-1">
            <CardCheckHeader
              cardKey="yield"
              color="#d97706"
              icon={SlidersHorizontal}
              badge="Fixed Income"
              priority="Time Sensitive"
              title="Lock In Rates Before Fed Cuts"
              subtitle={<>Lock in T-bill yields on <em>{fmt(_excessNotTreasuries)}</em> of cash before the next Fed rate cut</>}
            />
            {/* Headline stats */}
            <div className="flex items-center gap-5 py-1">
              <div>
                <p className="text-2xl font-black tabular-nums text-amber-600 leading-none">+{_fedCutBps} bps</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">saved by locking in now</p>
              </div>
              <div className="w-px h-8 bg-border flex-shrink-0" />
              <div>
                <p className="text-xl font-black tabular-nums text-amber-700 leading-none">{fmt(_fedLockInSavings)}<span className="text-sm font-semibold">/yr</span></p>
                <p className="text-[10px] text-muted-foreground mt-0.5">saved vs. waiting for cut</p>
              </div>
            </div>
            {/* Rate cut scenario */}
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Rate Cut Exposure</p>
              <div className="rounded-lg border border-border bg-background px-3 py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">Cash exposed to rate changes</p>
                  <p className="text-base font-black tabular-nums text-foreground">{fmt(_excessNotTreasuries)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">Not in treasuries · ex-Fidelity</p>
                  <p className="text-[10px] font-semibold text-amber-700">idle bank + money market</p>
                </div>
              </div>
              {/* Fed rate path strip */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] uppercase tracking-wider font-bold text-amber-700">Fed Funds Path · 2026</p>
                  <span className="text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-1.5 py-0.5">−{_fedCutBps} bps expected</span>
                </div>
                <div className="flex items-center gap-1">
                  {[
                    { q: "Now", range: "3.50–3.75%", rate: "3.625%", current: true },
                    { q: "Q2 '26", range: "3.50–3.75%", rate: "Hold", current: false },
                    { q: "Q3 '26", range: "3.25–3.50%", rate: "−25 bps", cut: true },
                    { q: "Q4 '26", range: "3.00–3.25%", rate: "−25 bps", cut: true, last: true },
                  ].map((step, i, arr) => (
                    <div key={i} className="flex items-center gap-1 flex-1 min-w-0">
                      <div className={`flex-1 min-w-0 rounded-md px-2 py-1.5 text-center border ${
                        step.current
                          ? "bg-amber-100 border-amber-300"
                          : step.cut
                          ? "bg-rose-50 border-rose-200"
                          : "bg-white border-amber-200"
                      }`}>
                        <p className={`text-[8px] font-black uppercase tracking-wider ${step.current ? "text-amber-700" : step.cut ? "text-rose-600" : "text-amber-600"}`}>{step.q}</p>
                        <p className={`text-[10px] font-black tabular-nums leading-tight mt-0.5 ${step.current ? "text-amber-800" : step.cut ? "text-rose-700" : "text-amber-700"}`}>{step.range}</p>
                        <p className={`text-[8px] font-semibold mt-0.5 ${step.cut ? "text-rose-500" : "text-amber-500"}`}>{step.rate}</p>
                      </div>
                      {i < arr.length - 1 && (
                        <span className="text-amber-400 text-[10px] flex-shrink-0">›</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb className="w-3 h-3 text-amber-600" />
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">Talking Point</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed italic">
                "The Fed is expected to cut rates by another 50 bps. On the {fmt(_excessNotTreasuries)} of excess cash not yet in treasuries, locking in today's T-bill rate before that cut is worth roughly {fmt(_fedLockInSavings)}/year — at no added risk. The window is now."
              </p>
            </div>
          </div>
          <div
            className="px-6 py-3.5 border-t border-border flex items-center justify-between bg-amber-50/40 cursor-pointer hover:bg-amber-50 transition-colors"
            onClick={() => onNavigate("guru")}
          >
            <span className="text-[10px] text-muted-foreground">Open Reserve bucket in GURU Allocation</span>
            <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">View now <ArrowUpRight className="w-3.5 h-3.5" /></span>
          </div>
        </div>

        {/* ── Section Header: Money Movement ── */}
        <div className="col-span-2 flex items-center gap-4 py-2 pt-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-7 rounded-full bg-violet-500 flex-shrink-0" />
            <p className="text-sm font-black uppercase tracking-widest text-foreground">Money Movement</p>
          </div>
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-muted-foreground font-semibold flex-shrink-0">2 items</span>
        </div>

        {/* ── Card 4: Account Cash Movements ── */}
        {(() => {
          return (
            <div
              className={`rounded-2xl border bg-card shadow-sm transition-all flex flex-col ${checked.has("cashflow") ? "border-sky-400 shadow-sky-100" : "border-border"}`}
              style={{ borderTop: "4px solid #0ea5e9" }}
              data-testid="advisor-brief-money-flow-card"
            >
              {/* Checkbox header */}
              <div className="px-6 pt-5 pb-4 border-b border-border">
                <CardCheckHeader
                  cardKey="cashflow"
                  color="#0ea5e9"
                  icon={CalendarClock}
                  badge="Cash Management"
                  priority="January"
                  title="Scheduled Cash Movements Next Month (January)"
                  subtitle="What moves between accounts over the next 60 days"
                />
              </div>
              {/* ── Bucket tables ── */}
              <div className="px-6 py-5 bg-slate-50/40">
                <div className="flex flex-col gap-0">

                  {/* ── Operating Cash row ── */}
                  <div className="flex items-stretch gap-3" data-testid="flow-col-ops">
                    <div className="w-36 flex-shrink-0 rounded-lg flex flex-col items-center justify-center gap-1.5 py-4" style={{ background: "#1d4ed8" }}>
                      <Wallet className="w-3.5 h-3.5 text-white/80" />
                      <span className="font-black uppercase tracking-widest text-white text-center px-2 text-[11px]">Operating Cash</span>
                      <span className="font-black tabular-nums text-white/90 mt-0.5 text-[10px]">$90,879</span>
                    </div>
                    <div className="border border-blue-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-4 bg-blue-50/60" data-testid="flow-row-ops-jan">
                        <div className="min-w-0 mr-2">
                          <p className="text-[11px] font-semibold text-blue-900 leading-tight">CIT Money Market Bank Account</p>
                          <p className="text-[9px] text-blue-600 mt-0.5">Primary operating · Jan ending</p>
                        </div>
                        <span className="text-[11px] font-black text-blue-700 tabular-nums flex-shrink-0">$90,879</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Flow connector 2: JPMorgan → CIT ($46,739) ── */}
                  <div className="flex items-center" style={{ minHeight: 44, paddingLeft: 'calc(9rem + 0.75rem)' }}>
                    <div className="group relative flex items-center gap-2.5 cursor-default" style={{ marginLeft: 28 + 12 }}>
                      <svg width="14" height="44" className="flex-shrink-0 overflow-visible">
                        <path d="M 7,42 L 7,2" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4,2.5" fill="none" />
                        <polygon points="0,-5 4.5,3 -4.5,3" fill="#2563eb" opacity="0.95">
                          <animateMotion dur="1.9s" repeatCount="indefinite" calcMode="linear" path="M 7,42 L 7,2" />
                        </polygon>
                      </svg>
                      <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-300 px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm">
                        ↑ $46,739 · JPMorgan → CIT
                      </span>
                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col z-50 pointer-events-none">
                        <div className="bg-slate-900 text-white text-[9px] font-medium rounded-lg px-3 py-2 shadow-2xl leading-relaxed max-w-[260px]">
                          Autodraw from JPMorgan 100% Treasuries MMF into CIT operating account — building 2 months of forward cash expenses
                        </div>
                        <div className="w-2 h-2 bg-slate-900 rotate-45 ml-4 -mt-1 flex-shrink-0" />
                      </div>
                    </div>
                  </div>

                  {/* ── Reserve row ── */}
                  <div className="flex items-stretch gap-3" data-testid="flow-col-reserve">
                    <div className="w-36 flex-shrink-0 rounded-lg flex flex-col items-center justify-center gap-1.5 py-4" style={{ background: "#d97706" }}>
                      <ShieldCheck className="w-3.5 h-3.5 text-white/80" />
                      <span className="font-black uppercase tracking-widest text-white text-center px-2 text-[11px]">Reserve</span>
                      <span className="font-black tabular-nums text-white/90 mt-0.5 text-[10px]">$129,385</span>
                    </div>
                    {/* Branch connector from pill to both stacked cards */}
                    <div className="flex-shrink-0 relative" style={{ width: 28, alignSelf: 'stretch' }}>
                      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 28 100" preserveAspectRatio="none">
                        <line x1="0" y1="50" x2="14" y2="50" stroke="rgba(217,119,6,0.45)" strokeWidth="1.5" />
                        <line x1="14" y1="25" x2="14" y2="75" stroke="rgba(217,119,6,0.45)" strokeWidth="1.5" />
                        <line x1="14" y1="25" x2="28" y2="25" stroke="rgba(217,119,6,0.45)" strokeWidth="1.5" />
                        <line x1="14" y1="75" x2="28" y2="75" stroke="rgba(217,119,6,0.45)" strokeWidth="1.5" />
                      </svg>
                    </div>
                    {/* Stacked sub-account cards with flow connector between them */}
                    <div className="flex-1 flex flex-col gap-0">
                      <div className="border border-amber-200 rounded-lg overflow-hidden" data-testid="flow-row-reserve-jpm">
                        <div className="flex items-center justify-between px-4 py-4 bg-amber-50/60">
                          <div className="min-w-0 mr-2">
                            <p className="text-[11px] font-semibold text-amber-900 leading-tight">JPMorgan 100% Treasuries Money Market Fund</p>
                            <p className="text-[9px] text-amber-600 mt-0.5">Autodraw to Operating</p>
                          </div>
                          <span className="text-[11px] font-black text-amber-700 tabular-nums flex-shrink-0">$27,927</span>
                        </div>
                      </div>

                      {/* ── Flow connector 1: T-Bill → JPMorgan ($7,478) ── */}
                      <div className="group relative flex items-center gap-2.5 cursor-default py-1 px-3">
                        <svg width="14" height="32" className="flex-shrink-0 overflow-visible">
                          <path d="M 7,30 L 7,2" stroke="#d97706" strokeWidth="1.5" strokeDasharray="4,2.5" fill="none" />
                          <polygon points="0,-4 4,3 -4,3" fill="#f59e0b" opacity="0.95">
                            <animateMotion dur="1.5s" repeatCount="indefinite" calcMode="linear" path="M 7,30 L 7,2" />
                          </polygon>
                        </svg>
                        <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm">
                          ↑ $7,478 · T-Bill → JPMorgan
                        </span>
                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col z-50 pointer-events-none">
                          <div className="bg-slate-900 text-white text-[9px] font-medium rounded-lg px-3 py-2 shadow-2xl leading-relaxed max-w-[260px]">
                            1-month T-Bill maturing in January — proceeds roll directly into JPMorgan 100% Treasuries MMF
                          </div>
                          <div className="w-2 h-2 bg-slate-900 rotate-45 ml-4 -mt-1 flex-shrink-0" />
                        </div>
                      </div>

                      <div className="border border-amber-200 rounded-lg overflow-hidden" data-testid="flow-row-reserve-tbill">
                        <div className="flex items-center justify-between px-4 py-4 bg-amber-50/60">
                          <div className="min-w-0 mr-2">
                            <p className="text-[11px] font-semibold text-amber-900 leading-tight">T-Bill Ladder</p>
                            <p className="text-[9px] text-amber-600 mt-0.5">3-Mo / 6-Mo / 9-Mo · +$7,478 Maturing</p>
                          </div>
                          <span className="text-[11px] font-black text-amber-700 tabular-nums flex-shrink-0">$101,458</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Gap ── */}
                  <div className="h-3" />

                  {/* ── Build row ── */}
                  <div className="flex items-stretch gap-3" data-testid="flow-col-build">
                    <div className="w-36 flex-shrink-0 rounded-lg flex flex-col items-center justify-center gap-1.5 py-4" style={{ background: "#16a34a" }}>
                      <Home className="w-3.5 h-3.5 text-white/80" />
                      <span className="font-black uppercase tracking-widest text-white text-center px-2 text-[12px]">Build</span>
                      <span className="font-black tabular-nums text-white/90 mt-0.5 text-[10px]">$226,545</span>
                    </div>
                    {/* Branch connector from pill to both stacked cards */}
                    <div className="flex-shrink-0 relative" style={{ width: 28, alignSelf: 'stretch' }}>
                      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 28 100" preserveAspectRatio="none">
                        <line x1="0" y1="50" x2="14" y2="50" stroke="rgba(22,163,74,0.45)" strokeWidth="1.5" />
                        <line x1="14" y1="25" x2="14" y2="75" stroke="rgba(22,163,74,0.45)" strokeWidth="1.5" />
                        <line x1="14" y1="25" x2="28" y2="25" stroke="rgba(22,163,74,0.45)" strokeWidth="1.5" />
                        <line x1="14" y1="75" x2="28" y2="75" stroke="rgba(22,163,74,0.45)" strokeWidth="1.5" />
                      </svg>
                    </div>
                    {/* Stacked sub-account cards */}
                    <div className="flex-1 flex flex-col gap-3">
                      <div className="border border-emerald-200 rounded-lg overflow-hidden" data-testid="flow-row-build-munis">
                        <div className="flex items-center justify-between px-4 py-4 bg-emerald-50/60">
                          <div className="min-w-0 mr-2">
                            <p className="text-[11px] font-semibold text-emerald-900 leading-tight">2028 Municipal Bonds</p>
                            <p className="text-[9px] text-emerald-600 mt-0.5">Tax-advantaged income</p>
                          </div>
                          <span className="text-[11px] font-black text-emerald-700 tabular-nums flex-shrink-0">$32,161</span>
                        </div>
                      </div>
                      <div className="border border-emerald-200 rounded-lg overflow-hidden" data-testid="flow-row-build-tbill">
                        <div className="flex items-center justify-between px-4 py-4 bg-emerald-50/60">
                          <div className="min-w-0 mr-2">
                            <p className="text-[11px] font-semibold text-emerald-900 leading-tight">S&amp;P Low Volatility Index</p>
                            <p className="text-[9px] text-emerald-600 mt-0.5">Short-duration ladder</p>
                          </div>
                          <span className="text-[11px] font-black text-emerald-700 tabular-nums flex-shrink-0">$194,384</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
              {/* Footer */}
              <div
                className="px-6 py-3.5 border-t border-border flex items-center justify-between bg-slate-50/60 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => onNavigate("moneymovement")}
              >
                <span className="text-[10px] text-muted-foreground">View full money movement detail</span>
                <span className="text-[11px] font-bold text-sky-700 flex items-center gap-1">Open Money Movement <ArrowUpRight className="w-3.5 h-3.5" /></span>
              </div>
            </div>
          );
        })()}

        {/* ── Approve Autobill Pay ── */}
        {(() => {
          const upcoming = OBLIGATIONS
            .filter((o) => o.due >= DEMO_NOW)
            .sort((a, b) => a.due.getTime() - b.due.getTime());
          const totalPending = upcoming.filter((o) => !scheduled.has(o.id)).reduce((s, o) => s + o.amount, 0);
          const urgentCount = upcoming.filter((o) => Math.ceil((o.due.getTime() - DEMO_NOW.getTime()) / 86400000) <= 45).length;
          const scheduledCount = upcoming.filter((o) => scheduled.has(o.id)).length;
          const activeObl = OBLIGATIONS.find((o) => o.id === wireModalId);

          return (
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between" style={{ borderTop: "4px solid #7c3aed" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Send className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-base font-black text-foreground leading-none">Approve Autobill Pay</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Schedule payments directly from your connected accounts</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs font-black tabular-nums text-violet-700">{fmt(totalPending)}</p>
                  <p className="text-[9px] text-muted-foreground">total pending</p>
                </div>
                <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1">
                  <Lock className="w-3 h-3 text-indigo-600" />
                  <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider">GURU Payments Active</span>
                </div>
              </div>
            </div>

            {/* Summary stat pills */}
            <div className="px-6 py-3 border-b border-border bg-slate-50/60 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-[11px] text-muted-foreground font-medium">{upcoming.length} total upcoming</span>
              </div>
              {urgentCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[11px] text-rose-700 font-semibold">{urgentCount} due within 45 days</span>
                </div>
              )}
              {scheduledCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] text-emerald-700 font-semibold">{scheduledCount} scheduled</span>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-slate-800 text-slate-300">
                    <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-[9px] w-32">Due Date</th>
                    <th className="px-2 py-2.5 text-left font-black uppercase tracking-widest text-[9px] w-20">Category</th>
                    <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-[9px]">Description</th>
                    <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-[9px]">Payee</th>
                    <th className="px-4 py-2.5 text-right font-black uppercase tracking-widest text-[9px]">Amount</th>
                    <th className="px-4 py-2.5 text-center font-black uppercase tracking-widest text-[9px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {upcoming.map((obl) => {
                    const daysUntil = Math.ceil((obl.due.getTime() - DEMO_NOW.getTime()) / 86400000);
                    const isUrgent = daysUntil <= 45;
                    const isScheduled = scheduled.has(obl.id);
                    return (
                      <tr key={obl.id} className={`hover:bg-secondary/30 transition-colors ${isScheduled ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-foreground">{format(obl.due, "MMM d, yyyy")}</span>
                            <span className={`text-[10px] font-bold ${isUrgent ? "text-rose-600" : "text-muted-foreground"}`}>
                              {isUrgent ? `${daysUntil}d — urgent` : `in ${daysUntil}d`}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${oblCatStyle(obl.category)}`}>
                            {obl.category === "tax" ? "Tax" : "Education"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground leading-tight">{obl.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">From: {obl.from}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{obl.payee}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-black text-rose-700 whitespace-nowrap">{fmt(obl.amount)}</td>
                        <td className="px-4 py-3 text-center">
                          {isScheduled ? (
                            <div className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                              <CheckSquare className="w-3 h-3 text-emerald-600" />
                              <span className="text-[9px] font-black text-emerald-700">Scheduled</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setWireFromAccount((s) => ({ ...s, [obl.id]: s[obl.id] ?? obl.from }));
                                const processDate = new Date(obl.due);
                                processDate.setDate(processDate.getDate() - 2);
                                setWireScheduleDate((s) => ({
                                  ...s,
                                  [obl.id]: s[obl.id] ?? processDate.toISOString().slice(0, 10),
                                }));
                                setWireMemo((s) => ({ ...s, [obl.id]: s[obl.id] ?? obl.label }));
                                setWireModalId(obl.id);
                              }}
                              className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-3 py-1.5 text-[10px] font-bold transition-colors whitespace-nowrap"
                            >
                              <Send className="w-3 h-3" />
                              Setup {obl.method}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Wire Setup Modal */}
            <Dialog open={wireModalId !== null} onOpenChange={(open) => { if (!open) setWireModalId(null); }}>
              <DialogContent className="max-w-md">
                {activeObl && (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-base">
                        <Send className="w-4 h-4 text-rose-600" />
                        Setup {activeObl.method} Payment
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-1">
                      {/* Payment summary */}
                      <div className="rounded-xl border border-border bg-slate-50 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-black text-foreground leading-tight">{activeObl.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{activeObl.payee} · Due {format(activeObl.due, "MMM d, yyyy")}</p>
                        </div>
                        <p className="text-lg font-black tabular-nums text-rose-700">{fmt(activeObl.amount)}</p>
                      </div>

                      {/* From account */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">From Account</label>
                        <select
                          value={wireFromAccount[activeObl.id] ?? activeObl.from}
                          onChange={(e) => setWireFromAccount((s) => ({ ...s, [activeObl.id]: e.target.value }))}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option>Citizens Private Banking Checking</option>
                          <option>Chase Total Checking</option>
                          <option>Citizens Private Bank Money Market</option>
                          <option>CapitalOne 360 Savings</option>
                        </select>
                      </div>

                      {/* Schedule date */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Process Date</label>
                        <input
                          type="date"
                          value={wireScheduleDate[activeObl.id] ?? ""}
                          onChange={(e) => setWireScheduleDate((s) => ({ ...s, [activeObl.id]: e.target.value }))}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <p className="text-[10px] text-muted-foreground">GURU defaults to 2 business days before due date</p>
                      </div>

                      {/* Memo */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Memo / Reference</label>
                        <input
                          type="text"
                          value={wireMemo[activeObl.id] ?? activeObl.label}
                          onChange={(e) => setWireMemo((s) => ({ ...s, [activeObl.id]: e.target.value }))}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>

                      {/* Routing info (read-only) */}
                      <div className="rounded-lg border border-border bg-slate-50 px-4 py-3 space-y-1.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Payment Details</p>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Routing Number</span>
                          <span className="font-mono font-semibold text-foreground">{activeObl.routing}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Account / Ref</span>
                          <span className="font-mono font-semibold text-foreground">{activeObl.acct}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Payment Method</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${activeObl.method === "Wire" ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-sky-50 text-sky-700 border-sky-200"}`}>{activeObl.method}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setWireModalId(null)}
                          className="flex-1 rounded-lg border border-border bg-background hover:bg-secondary text-foreground px-4 py-2.5 text-[11px] font-semibold transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            setScheduled((s) => new Set([...s, activeObl.id]));
                            setWireModalId(null);
                          }}
                          className="flex-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-white px-4 py-2.5 text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          Schedule Payment
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
          );
        })()}

      </div>
      {/* ── Email Modal ── */}
      <Dialog open={showEmail} onOpenChange={setShowEmail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-indigo-600" />
              Client Email — Sarah &amp; Michael Kessler
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground border border-border rounded-lg px-4 py-2.5 bg-muted/30">
              <div><span className="font-semibold">To:</span> Sarah &amp; Michael Kessler &lt;kessler.family@privatebank.com&gt;</div>
              <div className="ml-auto"><span className="font-semibold">Subject:</span> A few things worth discussing — your portfolio update</div>
            </div>
            <div className="rounded-xl border border-border bg-background px-5 py-4 text-[12px] text-foreground min-h-[280px]">
              {buildEmailJSX()}
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(buildEmail());
                  setEmailCopied(true);
                  setTimeout(() => setEmailCopied(false), 2000);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-[11px] font-semibold transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {emailCopied ? "Copied!" : "Copy to clipboard"}
              </button>
              <button
                onClick={() => setShowEmail(false)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                Done
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Book of Business View ─────────────────────────────────────────────────────
export function BookOfBusinessView() {
  const [search, setSearch] = useState("");
  const [activeFlag, setActiveFlag] = useState<FlagKey | "all">("all");
  const [doneActions, setDoneActions] = useState<Set<string>>(new Set());
  const markDone = (id: number, act: string) => setDoneActions(s => new Set([...s, `${id}-${act}`]));
  const isDone = (id: number, act: string) => doneActions.has(`${id}-${act}`);

  const filtered = BOB_CLIENTS.filter(c => {
    const ms = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.advisor.toLowerCase().includes(search.toLowerCase());
    const mf = activeFlag === "all" || c.flags.includes(activeFlag);
    return ms && mf;
  });

  const totalAUM = BOB_CLIENTS.reduce((s, c) => s + c.aum, 0);
  const flagCounts = (Object.keys(FLAG_META) as FlagKey[]).reduce((acc, k) => {
    acc[k] = BOB_CLIENTS.filter(c => c.flags.includes(k)).length;
    return acc;
  }, {} as Record<FlagKey, number>);
  const healthyCount = BOB_CLIENTS.filter(c => c.flags.length === 0).length;
  const needsActionCount = BOB_CLIENTS.filter(c => c.flags.length > 0).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground leading-none">Book of Business</h2>
          <p className="text-[11px] text-muted-foreground mt-1">{BOB_CLIENTS.length} accounts · {fmt(totalAUM, true)} total AUM · <span className="text-rose-600 font-semibold">{needsActionCount} need action</span> · <span className="text-emerald-600 font-semibold">{healthyCount} healthy</span></p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
            data-testid="button-send-all-emails"
          >
            <Mail className="w-3 h-3" /> Send Bulk Emails
          </button>
        </div>
      </div>

      {/* Flag stats strip */}
      <div className="grid grid-cols-7 gap-2.5">
        <button
          onClick={() => setActiveFlag("all")}
          className={`rounded-xl border p-3 text-center transition-all hover:shadow-sm ${activeFlag === "all" ? "bg-slate-800 border-slate-700" : "bg-card border-border"}`}
        >
          <p className={`text-xl font-black ${activeFlag === "all" ? "text-white" : "text-foreground"}`}>{BOB_CLIENTS.length}</p>
          <p className={`text-[9px] uppercase tracking-widest mt-0.5 ${activeFlag === "all" ? "text-white/70" : "text-muted-foreground"}`}>All</p>
        </button>
        {(Object.entries(FLAG_META) as [FlagKey, typeof FLAG_META[FlagKey]][]).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setActiveFlag(f => f === key ? "all" : key)}
            className={`rounded-xl border p-3 text-center transition-all hover:shadow-sm ${activeFlag === key ? `${meta.bg} border ${meta.border}` : "bg-card border-border"}`}
            data-testid={`flag-filter-${key}`}
          >
            <p className={`text-xl font-black ${activeFlag === key ? meta.text : "text-foreground"}`}>{flagCounts[key]}</p>
            <p className={`text-[9px] uppercase tracking-widest mt-0.5 ${activeFlag === key ? meta.text : "text-muted-foreground"}`}>{meta.short}</p>
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by client name or advisor…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-[13px] border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="input-bob-search"
          />
        </div>
        <span className="text-[11px] text-muted-foreground">{filtered.length} {filtered.length === 1 ? "client" : "clients"} shown</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        {/* Header */}
        <div
          className="grid px-4 py-2.5 border-b bg-muted/30 text-[9px] font-black uppercase tracking-widest text-muted-foreground"
          style={{ gridTemplateColumns: "2fr 130px 130px 110px 1fr 120px 185px" }}
        >
          <span>Client</span>
          <span className="text-right leading-tight">Assets Under<br/>Management</span>
          <span className="text-right leading-tight">Total<br/>Assets</span>
          <span className="text-right">Liquid Cash</span>
          <span>Flags</span>
          <span>Advisor</span>
          <span>Actions</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/50">
          {filtered.map(client => {
            const cashCls = client.cashPct > 10 ? "text-amber-600" : client.cashPct < 2 ? "text-rose-600" : "text-emerald-600";
            const allActsDone =
              (!client.flags.includes("excess_cash") || isDone(client.id, "review")) &&
              (!client.flags.includes("autobill_approval") || isDone(client.id, "autobill")) &&
              (!(client.flags.includes("money_movement") || client.flags.includes("cash_deficit") || client.flags.includes("follow_up")) || isDone(client.id, "email")) &&
              (!client.flags.includes("product_needed") || isDone(client.id, "product"));
            return (
              <div
                key={client.id}
                className={`grid px-4 py-2.5 items-center transition-colors hover:bg-muted/20 ${allActsDone && client.flags.length > 0 ? "opacity-50" : ""}`}
                style={{ gridTemplateColumns: "2fr 130px 130px 110px 1fr 120px 185px" }}
                data-testid={`bob-row-${client.id}`}
              >
                {/* Client */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-black text-slate-600 flex-shrink-0">{client.initials}</div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-foreground leading-none truncate">{client.name}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{client.lastContact}</p>
                  </div>
                </div>
                {/* Assets Under Management */}
                <span className="text-[12px] font-semibold tabular-nums text-right">{fmt(client.aum)}</span>
                {/* Total Assets */}
                <span className="text-[12px] font-semibold tabular-nums text-right text-slate-500">{fmt(client.totalAssets)}</span>
                {/* Liquid Cash */}
                <span className={`text-[12px] font-black tabular-nums text-right ${cashCls}`}>{fmt(client.liquidCash)}</span>
                {/* Flags */}
                <div className="flex flex-wrap gap-1 min-w-0">
                  {client.flags.map(f => (
                    <span
                      key={f}
                      className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full border whitespace-nowrap ${FLAG_META[f].bg} ${FLAG_META[f].text} ${FLAG_META[f].border}`}
                    >
                      {FLAG_META[f].short}
                    </span>
                  ))}
                  {client.flags.length === 0 && (
                    <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Healthy
                    </span>
                  )}
                </div>
                {/* Advisor */}
                <span className="text-[11px] text-muted-foreground truncate">{client.advisor}</span>
                {/* Actions */}
                <div className="flex items-center gap-1 flex-wrap">
                  {client.flags.includes("excess_cash") && (
                    isDone(client.id, "review")
                      ? <span className="text-[8px] text-emerald-600 font-bold flex items-center gap-0.5"><Check className="w-2.5 h-2.5" />Reviewed</span>
                      : <button onClick={() => markDone(client.id, "review")} className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 whitespace-nowrap transition-colors" data-testid={`action-review-${client.id}`}>
                          <Lightbulb className="w-2.5 h-2.5" /> Review
                        </button>
                  )}
                  {client.flags.includes("product_needed") && (
                    isDone(client.id, "product")
                      ? <span className="text-[8px] text-emerald-600 font-bold flex items-center gap-0.5"><Check className="w-2.5 h-2.5" />Assigned</span>
                      : <button onClick={() => markDone(client.id, "product")} className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 whitespace-nowrap transition-colors" data-testid={`action-product-${client.id}`}>
                          <Target className="w-2.5 h-2.5" /> Assign
                        </button>
                  )}
                  {client.flags.includes("autobill_approval") && (
                    isDone(client.id, "autobill")
                      ? <span className="text-[8px] text-emerald-600 font-bold flex items-center gap-0.5"><Check className="w-2.5 h-2.5" />Approved</span>
                      : <button onClick={() => markDone(client.id, "autobill")} className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg bg-pink-50 text-pink-700 border border-pink-200 hover:bg-pink-100 whitespace-nowrap transition-colors" data-testid={`action-autobill-${client.id}`}>
                          <CheckSquare className="w-2.5 h-2.5" /> Approve
                        </button>
                  )}
                  {(client.flags.includes("money_movement") || client.flags.includes("cash_deficit") || client.flags.includes("follow_up")) && (
                    isDone(client.id, "email")
                      ? <span className="text-[8px] text-emerald-600 font-bold flex items-center gap-0.5"><Check className="w-2.5 h-2.5" />Sent</span>
                      : <button onClick={() => markDone(client.id, "email")} className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 whitespace-nowrap transition-colors" data-testid={`action-email-${client.id}`}>
                          <Mail className="w-2.5 h-2.5" /> Email
                        </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type ActiveView =
  | "dashboard"
  | "advisorbrief"
  | "financials"
  | "guru"
  | "moneymovement";

export default function ClientDashboard() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [financialsTab, setFinancialsTab] = useState<"balancesheet" | "cashflow">("balancesheet");
  const [opsCashMonths, setOpsCashMonths] = useState(2);
  const [pendingTransfers, setPendingTransfers] = useState<
    { from: string; to: string; amount: number }[]
  >([]);
  const [bucketProductSelections, setBucketProductSelections] = useState<
    Record<string, Array<{ product: BucketProduct; alloc: number }>>
  >({});

  const { data, isLoading, isError } = useClientDashboard(clientId);

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
          <p className="text-muted-foreground mb-4">
            Client not found or failed to load.
          </p>
          <Link href="/">
            <Button variant="outline">Back to Clients</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const { client, assets, liabilities, cashFlows } = data;

  // ── Top-level cash metrics (shared across banner + panels) ──────────────────
  const _forecastData = buildForecast(cashFlows);
  const {
    reserve: reserveTop,
    yieldBucket: yieldTop,
    tactical: tacticalTop,
    totalLiquid: totalLiquidTop,
    reserveItems: reserveItemsTop,
    yieldItems: yieldItemsTop,
  } = cashBuckets(assets);
  const cashTroughTop = computeTrough(_forecastData);
  const cashExcessTop = totalLiquidTop - cashTroughTop; // liquid surplus / deficit
  const isPositiveTop = cashExcessTop >= 0;
  const minCumTop = Math.min(..._forecastData.map((d) => d.cumulative));
  const troughMonthTop =
    _forecastData.find((d) => d.cumulative === minCumTop)?.month ?? "";

  // GURU Optimizer "Total Cash to Invest" = A (idle acct cash) + B (liquid surplus) — mirrors G29
  const brokerageCashTop = assets
    .filter(
      (a) =>
        a.type === "cash" &&
        (a.description ?? "").toLowerCase().includes("brokerage"),
    )
    .reduce((s, a) => s + Number(a.value), 0);
  const totalToInvestTop = Math.round(
    brokerageCashTop + Math.max(0, cashExcessTop),
  );

  // Cash where it sits — for hero card 1 line items
  const _brokerageCashItems = assets
    .filter((a) => a.type === "cash" && (a.description ?? "").toLowerCase().includes("brokerage"))
    .map((a) => ({
      label: (a.description ?? "").split("—")[0].split("(")[0].trim(),
      value: Number(a.value),
      tag: "Brokerage" as const,
    }));
  const _checkingItems = reserveItemsTop.map((i) => ({ ...i, tag: "Operating Cash" as const }));
  const _savingsItems = yieldItemsTop.map((i) => ({ ...i, tag: "Savings / MM" as const }));
  const _cashWhereItSits = [..._checkingItems, ..._savingsItems, ..._brokerageCashItems];

  // Next month's net cash flow
  const _nextMonthDate = addMonths(DEMO_NOW, 1);
  const _nextMonthFlows = cashFlows.filter((cf) => {
    const d = new Date(cf.date);
    return (
      d.getFullYear() === _nextMonthDate.getFullYear() &&
      d.getMonth() === _nextMonthDate.getMonth()
    );
  });
  const nextMonthNet = _nextMonthFlows.reduce(
    (s, c) => s + (c.type === "inflow" ? 1 : -1) * Number(c.amount),
    0,
  );

  // ── Hero bar: advisor discussion point metrics ───────────────────────────────

  // Portfolio blended AT yield (weighted by rough bucket sizes)
  const _totalAssetsHero = assets.reduce((s, a) => s + Number(a.value), 0);
  const _liquidHero = reserveTop + yieldTop + tacticalTop;
  const _growHero = Math.max(0, _totalAssetsHero - _liquidHero);
  const _blendedATYield = _totalAssetsHero > 0
    ? (_liquidHero * 2.6 + _growHero * 5.8) / _totalAssetsHero
    : 0;
  const _annualPortfolioReturn = Math.round(_totalAssetsHero * (_blendedATYield / 100));

  // Rebalance: how much the liquid buckets are over/under vs their GURU target
  const _liquidTarget = cashTroughTop; // GURU liquidity need
  const _liquidDelta = _liquidHero - _liquidTarget; // positive = over-allocated to liquid

  // Cash management: estimated AT yield pickup if moved to GURU-recommended products
  // Avg current liquid yield ~1.4% AT (idle bank accounts) → GURU ~2.7% AT
  const _currentLiquidYield = 1.4;
  const _guruLiquidYield = 2.7;
  const _yieldPickupAnnual = Math.round(_liquidHero * ((_guruLiquidYield - _currentLiquidYield) / 100));

  // Upcoming payments — search next 6 months of outflows for these 3 named items
  const _now = DEMO_NOW;
  const _sixMonthsOut = addMonths(_now, 6);
  const _upcomingAll = cashFlows
    .filter((cf) => {
      const d = new Date(cf.date);
      return cf.type === "outflow" && d >= _now && d <= _sixMonthsOut;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const _findPayment = (keywords: string[]) => {
    const hit = _upcomingAll.find((cf) =>
      keywords.some((kw) => (cf.description ?? "").toLowerCase().includes(kw.toLowerCase()))
    );
    return hit ? { amount: Number(hit.amount), date: new Date(hit.date), desc: hit.description } : null;
  };

  const _buckleyPayment  = _findPayment(["buckley", "tuition", "school"]);
  const _lakewoodPayment = _findPayment(["sarasota property", "hoa"]);
  const _warrenPayment   = _findPayment(["nyc property", "tribeca", "property tax"]);

  const riskColor: Record<string, string> = {
    conservative: "bg-blue-100 text-blue-700",
    moderate: "bg-amber-100 text-amber-700",
    aggressive: "bg-rose-100 text-rose-700",
  };

  const navItems: {
    key: ActiveView;
    label: string;
    icon: React.ElementType;
    activeCls?: string;
    inactiveCls?: string;
  }[] = [
    { key: "advisorbrief", label: "Advisor Brief", icon: ClipboardList, activeCls: "bg-rose-600 text-white shadow-sm", inactiveCls: "text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200" },
    { key: "dashboard", label: "Kessler Dashboard", icon: LayoutDashboard },
    { key: "financials", label: "Kessler Financials & Forecast", icon: FileText },
    { key: "guru", label: "GURU Allocation", icon: PieChartIcon },
    { key: "moneymovement", label: "Money Movement", icon: ArrowLeftRight },
  ];

  return (
    <Layout>
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="mb-5">
        {/* Client identity bar */}
        <div className="bg-card rounded-xl border border-border shadow-sm px-5 py-4 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/">
              <button
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                data-testid="link-back-clients"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </Link>
            <div className="h-8 w-px bg-border flex-shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1
                  className="text-xl font-display font-bold text-foreground leading-none"
                  data-testid="text-client-name"
                >
                  {client.name}
                </h1>
                <Badge
                  className={`${riskColor[client.riskTolerance] || "bg-secondary text-secondary-foreground"} capitalize text-[11px] font-semibold border-0 leading-none`}
                >
                  {client.riskTolerance} Risk
                </Badge>
                <Badge variant="outline" className="text-[11px] leading-none">
                  Age {client.age}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                AI-driven wealth decisioning system
              </p>
            </div>
          </div>
        </div>

        {/* ── Tab Navigation — pill style ─────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl px-1.5 py-1.5 shadow-sm">
          {navItems.map(({ key, label, icon: Icon, activeCls, inactiveCls }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              data-testid={`nav-${key}`}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium rounded-lg transition-all ${
                activeView === key
                  ? (activeCls ?? "bg-[hsl(222,47%,12%)] text-white shadow-sm")
                  : (inactiveCls ?? "text-muted-foreground hover:text-foreground hover:bg-secondary/60")
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* ── Dashboard View ─────────────────────────────────────────────────────── */}
      {activeView === "dashboard" && (
        <div className="space-y-4">
          {/* ── Advisor Brief compact strip ───────────────────────────────────── */}
          <div
            className="rounded-xl bg-card border border-border shadow-sm px-5 py-3.5 flex items-center justify-between gap-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setActiveView("advisorbrief")}
            data-testid="advisor-brief-strip"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground leading-none">Advisor Brief</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">4 priorities prepared for today's meeting</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {[
                { label: "Liquidity", color: "#10b981", sub: fmt(totalToInvestTop, true) },
                { label: "Investments", color: "#3b82f6", sub: "Rebalance" },
                { label: "Yield", color: "#d97706", sub: `+${Math.round((_guruLiquidYield - _currentLiquidYield) * 100)} bps` },
                { label: "Planning", color: "#f43f5e", sub: "6-mo view" },
              ].map((p) => (
                <div key={p.label} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <div>
                    <p className="text-[10px] font-bold text-foreground leading-none">{p.label}</p>
                    <p className="text-[9px] text-muted-foreground leading-none mt-0.5">{p.sub}</p>
                  </div>
                </div>
              ))}
              <span className="text-[10px] font-bold text-primary flex items-center gap-0.5 ml-2">
                View Brief <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <NetWorthPanel
              assets={assets}
              liabilities={liabilities}
              cashFlows={cashFlows}
            />
            <CashManagementPanel assets={assets} cashFlows={cashFlows} />
          </div>

          <div className="grid grid-cols-2 gap-4 items-start">
            <CashFlowForecastPanel cashFlows={cashFlows} onNavigateToCashflow={() => setActiveView("cashflow")} />
            <CashFlowTicker cashFlows={cashFlows} />
          </div>

          <div className="grid grid-cols-2 gap-4 items-start">
            <BrokeragePanel assets={assets} />
            <LiabilitiesPanel liabilities={liabilities} />
          </div>

          {/* ── Account Cash Movements — animated water-flow widget ─────────── */}
          <DashboardFlowWidget onNavigate={() => setActiveView("moneymovement")} />

        </div>
      )}
      {/* ── Advisor Brief View ───────────────────────────────────────────────── */}
      {activeView === "advisorbrief" && (
        <div className="space-y-4">
          <AdvisorBriefView
            assets={assets}
            cashFlows={cashFlows}
            liabilities={liabilities}
            onNavigate={(v) => setActiveView(v as ActiveView)}
          />
        </div>
      )}
      {/* ── Client Financials & Forecast ───────────────────────────────────────── */}
      {activeView === "financials" && (
        <div className="space-y-5">
          {/* Sub-tab switcher */}
          <div className="flex items-center gap-1 border-b border-border pb-0">
            {(["balancesheet", "cashflow"] as const).map((tab) => {
              const label = tab === "balancesheet" ? "Balance Sheet" : "Cash Flow Forecast";
              const isActive = financialsTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setFinancialsTab(tab)}
                  className={`px-6 py-2.5 text-sm font-bold tracking-wide rounded-lg transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-transparent text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {financialsTab === "balancesheet" && (
            <DetailsView
              assets={assets}
              liabilities={liabilities}
              cashFlows={cashFlows}
              clientId={clientId}
            />
          )}
          {financialsTab === "cashflow" && (
            <CashFlowForecastView assets={assets} cashFlows={cashFlows} clientId={clientId} />
          )}
        </div>
      )}
      {/* ── GURU Asset Allocation View ─────────────────────────────────────────── */}
      {activeView === "guru" && (
        <div className="space-y-4">
          <GuruAllocationView
          assets={assets}
          cashFlows={cashFlows}
          opsCashMonths={opsCashMonths}
          setOpsCashMonths={setOpsCashMonths}
          pendingTransfers={pendingTransfers}
          setPendingTransfers={setPendingTransfers}
          bucketProductSelections={bucketProductSelections}
          setBucketProductSelections={setBucketProductSelections}
        />
        </div>
      )}
      {/* ── Money Movement View ─────────────────────────────────────────────────── */}
      {activeView === "moneymovement" && (
        <div className="space-y-4">
          <MoneyMovementView
            assets={assets}
            cashFlows={cashFlows}
            opsCashMonths={opsCashMonths}
            clientName={client.name}
            pendingTransfers={pendingTransfers}
            bucketProductSelections={bucketProductSelections}
          />
        </div>
      )}
    </Layout>
  );
}
