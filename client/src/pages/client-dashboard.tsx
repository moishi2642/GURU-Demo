import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  ReferenceArea,
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
    <span className="font-mono font-bold tracking-tight text-foreground inline-flex items-center">
      {formatted}
      <span className="animate-blink ml-px text-[10px] opacity-20">.</span>
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
  const rowH = 28; // px per row
  const visRows = 7;
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
        <div className="px-4 py-1.5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-0.5">
            12-Mo Inflows
          </p>
          <p className="font-bold text-emerald-400 tabular-nums">
            +{fmtAmt(totalIn)}
          </p>
        </div>
        <div className="px-4 py-1.5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-0.5">
            12-Mo Outflows
          </p>
          <p className="font-bold text-rose-400 tabular-nums">
            −{fmtAmt(totalOut)}
          </p>
        </div>
        <div className="px-4 py-1.5">
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

// ─── Institutional color palette — private wealth / Goldman aesthetic ─────────
// Deep, desaturated. Navy, warm gold, forest, slate. No orange, no purple.
const HERO_COLORS: Record<string, { bg: string; accent: string; dot: string }> = {
  "Operating Cash": { bg: "#162843", accent: "#7aa7d4", dot: "#5a85b8" }, // deep navy
  Reserve:          { bg: "#3a2710", accent: "#c9a84c", dot: "#b8943f" }, // deep warm gold
  Build:            { bg: "#0e3320", accent: "#5ab88a", dot: "#3da870" }, // deep forest
  Grow:             { bg: "#1e2d40", accent: "#7da3c8", dot: "#5585ae" }, // deep slate
  "Real Estate":        { bg: "#2a2a2a", accent: "#a3a3a3", dot: "#888888" },
  "Alternative Assets": { bg: "#2a2a2a", accent: "#a3a3a3", dot: "#888888" },
  "529 Plans":          { bg: "#2a2a2a", accent: "#a3a3a3", dot: "#888888" },
};

// ─── Book of Business — flag metadata & client data ───────────────────────────
type FlagKey = "excess_cash" | "cash_deficit" | "product_needed" | "follow_up" | "autobill_approval" | "money_movement";
// ─── Institutional flag colors — border-only badges, no filled backgrounds ─────
const FLAG_META: Record<FlagKey, { label: string; short: string; color: string; bg: string; text: string; border: string }> = {
  excess_cash:       { label: "Excess Cash",      short: "Excess Cash",  color: "#b45309", bg: "bg-transparent", text: "text-[#92400e]",  border: "border-[#b45309]/40" },
  cash_deficit:      { label: "Cash Deficit",      short: "Deficit",      color: "#b91c1c", bg: "bg-transparent", text: "text-[#991b1b]",  border: "border-[#b91c1c]/40" },
  product_needed:    { label: "Product Selection", short: "Product",      color: "#1a4f9c", bg: "bg-transparent", text: "text-[#1a4f9c]",  border: "border-[#1a4f9c]/40" },
  follow_up:         { label: "Follow Up",         short: "Follow Up",    color: "#1a5c35", bg: "bg-transparent", text: "text-[#1a5c35]",  border: "border-[#1a5c35]/40" },
  autobill_approval: { label: "Autobill Approval", short: "Autobill",     color: "#1a5f52", bg: "bg-transparent", text: "text-[#1a5f52]",  border: "border-[#1a5f52]/40" },
  money_movement:    { label: "Money Movement",    short: "Movement",     color: "#233554", bg: "bg-transparent", text: "text-[#233554]",  border: "border-[#233554]/40" },
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
  "border border-border shadow-sm bg-card rounded-xl overflow-hidden";

// Intelligence-layer panels — dark forest green analytical canvas
const INTEL_PANEL_CLS =
  "guru-intelligence border shadow-sm rounded-xl overflow-hidden";

// ─── Color constants (updated to institutional palette) ────────────────────────
const GREEN = "hsl(160, 60%, 38%)";
const RED   = "hsl(0, 72%, 50%)";
const BLUE  = "hsl(216, 82%, 43%)";
// Intelligence-layer chart colors
const INTEL_GREEN      = "hsl(152, 52%, 44%)";   // positive / growth line
const INTEL_GREEN_DIM  = "hsl(152, 40%, 32%)";   // area fill
const INTEL_GRID       = "hsl(152, 22%, 18%)";   // chart grid lines

// ─── GURU Method: 5 Strategic Bucket Definitions ─────────────────────────────
const GURU_BUCKETS = {
  reserve: {
    label: "Operating Cash",
    short: "Checking — instantly available transaction accounts",
    color: "#5a85b8",
    tagCls: "bg-transparent border border-[#162843]/35 text-[#162843]",
  },
  yield: {
    label: "Reserve",
    short: "Savings & money market — penalty-free, higher-yielding",
    color: "#b8943f",
    tagCls: "bg-transparent border border-[#3a2710]/35 text-[#3a2710]",
  },
  tactical: {
    label: "Build",
    short: "Treasuries & fixed income — 1–3 year horizon",
    color: "#3da870",
    tagCls: "bg-transparent border border-[#0e3320]/35 text-[#0e3320]",
  },
  growth: {
    label: "Grow",
    short: "Long-horizon investments — equities, compounding wealth",
    color: "#5585ae",
    tagCls: "bg-transparent border border-[#1e2d40]/35 text-[#1e2d40]",
  },
  alternatives: {
    label: "Alternatives",
    short: "Real estate, private equity, RSUs — strategic illiquid assets",
    color: "#888888",
    tagCls: "bg-transparent border border-slate-400/40 text-slate-600",
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
      {/* ── Panel header ── */}
      <div className="panel-hd">
        <span className="panel-hd-label">Net Worth</span>
        <span className="panel-hd-value">5yr&nbsp;<span className="text-emerald-600">{fmt(projYear5, true)}</span></span>
      </div>
      {/* ── KPI row ── */}
      <div className="px-4 pt-3 pb-2 border-b border-border/60">
        <p className="serif-hero text-[2rem] font-normal tabular-nums text-foreground leading-tight" data-testid="kpi-net-worth">{fmt(netWorth)}</p>
        <p className="text-[10px] text-muted-foreground mt-1">Total assets less liabilities</p>
      </div>
      <div className="h-28 px-1 mt-1">
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
      <div className="px-4 pb-3">
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
        <div className="space-y-0.5 max-h-28 overflow-y-auto">
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
      {/* ── Panel header ── */}
      <div className="panel-hd">
        <span className="panel-hd-label">12-Month Cashflow</span>
        <span className={`flex items-center gap-1 text-[10px] font-semibold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isPositive ? "Surplus" : "Deficit"}
        </span>
      </div>
      {/* ── KPI row ── */}
      <div className="px-4 pt-3 pb-1 border-b border-border/60">
        <p className={`serif-hero text-[2rem] font-normal tabular-nums leading-tight ${isPositive ? "text-emerald-700" : "text-rose-600"}`} data-testid="kpi-annual-net">
          {isPositive ? "+" : ""}{fmt(annualNet)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">{isPositive ? "Net surplus · 12-month forecast" : "Net deficit · 12-month forecast"}</p>
      </div>
      {/* ── Chart 2: Cumulative area chart ── */}
      <div className="px-3 pb-2">
        <div style={{ height: 240 }}>
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

      {/* ── Dark chrome header ── */}
      <div className="panel-hd">
        <span className="panel-hd-label">Liquidity Position</span>
        <span className={`flex items-center gap-1 text-[10px] font-semibold ${trendUp ? "text-emerald-600" : "text-rose-600"}`}>
          {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trendUp ? "Building" : "Depleting"}
        </span>
      </div>
      {/* ── KPI row ── */}
      <div className="px-4 pt-3 pb-2 border-b border-border/60">
        <p className="serif-hero text-[2rem] font-normal tabular-nums text-foreground leading-tight">{fmt(totalLiquid)}</p>
        <p className="text-[10px] text-muted-foreground mt-1">Total liquid across all accounts</p>
      </div>

      {/* ── 3 KPI tiles ── */}
      <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60">
        {/* Months Runway */}
        <div className="px-3 py-2 flex flex-col gap-0.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Cash Runway</p>
          <p className={`text-xl font-extrabold tabular-nums leading-none ${monthsRunway >= 12 ? "text-emerald-600" : monthsRunway >= 6 ? "text-amber-600" : "text-rose-600"}`}>
            {monthsRunway.toFixed(1)}
          </p>
          <p className="text-[9px] text-muted-foreground">months of expenses</p>
        </div>
        {/* Monthly Burn */}
        <div className="px-3 py-2 flex flex-col gap-0.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Monthly Burn</p>
          <p className="text-xl font-extrabold tabular-nums leading-none text-foreground">
            {fmt(monthlyBurn, true)}
          </p>
          <p className="text-[9px] text-muted-foreground">avg outflows / mo</p>
        </div>
        {/* Annual Coverage */}
        <div className="px-3 py-2 flex flex-col gap-0.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Coverage</p>
          <p className={`text-xl font-extrabold tabular-nums leading-none ${coverageOk ? "text-emerald-600" : "text-rose-600"}`}>
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
      <div className="px-4 py-3">
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
      {/* ── Panel header ── */}
      <div className="panel-hd">
        <span className="panel-hd-label">Investment Portfolio</span>
        {spyQuote ? (
          <span className={`flex items-center gap-1 text-[10px] font-semibold ${spyUp ? "text-emerald-600" : "text-rose-600"}`}>
            {spyUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            S&P {spyUp ? "+" : ""}{spyQuote.changePercent?.toFixed(2)}%
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
            <ArrowUpRight className="w-3 h-3" />4.32% YTD
          </span>
        )}
      </div>
      {/* ── KPI row ── */}
      <div className="px-4 pt-3 pb-2 border-b border-border/60">
        <p className="serif-hero text-[2rem] font-normal tabular-nums text-foreground leading-tight" data-testid="kpi-brokerage">{fmt(total)}</p>
        <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
          <span>Brokerage&nbsp;<span className="font-semibold text-foreground">{fmt(totalBrok, true)}</span></span>
          <span>Retirement&nbsp;<span className="font-semibold text-foreground">{fmt(totalRet, true)}</span></span>
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
      {/* ── Panel header ── */}
      <div className="panel-hd">
        <span className="panel-hd-label">Liabilities</span>
        <span className="panel-hd-value">Avg Rate&nbsp;<span className="text-foreground font-bold">{wtdRate.toFixed(2)}%</span></span>
      </div>
      {/* ── KPI row ── */}
      <div className="px-4 pt-3 pb-3 border-b border-border/60">
        <p className="serif-hero text-[2rem] font-normal tabular-nums text-rose-600 leading-tight">{fmt(totalDebt)}</p>
        <p className="text-[10px] text-muted-foreground mt-1">Total outstanding debt</p>
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
  const checking      = assets.filter((a) => a.type === "cash" && (a.description ?? "").toLowerCase().includes("checking"));
  const savingsMM     = assets.filter((a) => a.type === "cash" && !(a.description ?? "").toLowerCase().includes("checking") && !isBrokerageCash(a));
  const brokerageCash = assets.filter((a) => isBrokerageCash(a));
  const brokerage     = assets.filter((a) => isBrokerage(a));

  const mkBrokerageCashGroup = (): BsGroup => ({
    category: "Brokerage Cash",
    items: brokerageCash.map((a) => {
      const desc = a.description ?? "";
      const isFidelity = desc.toLowerCase().includes("fidelity");
      return {
        label: isFidelity ? "Fidelity (Cash)" : desc.split("(")[0].split("—")[0].split("–")[0].trim(),
        subtitle: lookupBsSubtitle(desc, BS_ASSET_SUBTITLES),
        value: Number(a.value),
        rate: extractRate(desc),
        ret: lookupReturn(desc),
        comment: assetComment(a),
      };
    }),
    subtotal: brokerageCash.reduce((s, a) => s + Number(a.value), 0),
    avgRate: wavgRate(brokerageCash),
  });

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
  if (brokerageCash.length) cashGroups.push(mkBrokerageCashGroup());
  if (cashGroups.length) sections.push({ label: "Cash", groups: cashGroups, total: subtot([...checking, ...savingsMM, ...brokerageCash]) });

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
    if (r.startsWith("+")) return "text-emerald-400 font-semibold";
    if (r.toLowerCase().includes("irr") || r.toLowerCase().includes("est")) return "text-amber-400 font-semibold";
    return "text-muted-foreground";
  };

  const MONO = "'JetBrains Mono', monospace";
  const BS_BG_BASE    = "#0f1e33";
  const BS_BG_ALT     = "#122038";
  const BS_BG_GRPHDR  = "#162843";
  const BS_BG_SECTOT  = "#1a2d47";
  const BS_BG_GRANDTOT= "#0d1b2e";
  const BS_BORDER     = "#1e3352";
  const BS_BORDER_SEC = "#2a4a6e";
  const BS_GREEN_DIM  = "hsl(152,45%,42%)";
  const BS_GREEN_MED  = "hsl(152,52%,55%)";
  const BS_TEXT       = "hsl(0,0%,88%)";
  const BS_TEXT_MUTED = "hsl(210,15%,52%)";

  const retColor = (r: string | null) => {
    if (!r) return BS_TEXT_MUTED;
    if (r.startsWith("+")) return "hsl(152,55%,55%)";
    if (r.toLowerCase().includes("irr") || r.toLowerCase().includes("est")) return "hsl(45,80%,56%)";
    return BS_TEXT_MUTED;
  };

  const cellBase: React.CSSProperties = {
    fontFamily: MONO, fontSize: 10.5, padding: "5px 8px",
    borderBottom: `1px solid ${BS_BORDER}`,
  };

  const renderItems = (items: BsGroup["items"], indent = "pl-8") =>
    items.map((item, ii) => {
      const rowBg = ii % 2 === 0 ? BS_BG_BASE : BS_BG_ALT;
      const rateVal = item.ret ?? (item.rate ? `${item.rate}%` : null);
      return (
        <div key={ii} className="grid" style={{ gridTemplateColumns: COLS, background: rowBg }}>
          <div style={{ ...cellBase, paddingLeft: 28 }}>
            <div style={{ color: BS_TEXT_MUTED, lineHeight: 1.3 }}>{item.label}</div>
            {item.subtitle && (
              <div style={{ fontFamily: MONO, fontSize: 9, color: "hsl(210,15%,40%)", lineHeight: 1.3, marginTop: 1 }}>{item.subtitle}</div>
            )}
          </div>
          <div style={{ ...cellBase, textAlign: "right", color: item.value > 0 ? BS_TEXT : BS_TEXT_MUTED, fontWeight: 500 }}>
            {item.value > 0 ? fmt(item.value) : "—"}
          </div>
          <div style={{ ...cellBase, textAlign: "right", color: retColor(rateVal) }}>
            {!isLiability
              ? (item.ret ?? (item.rate ? `${item.rate}%` : <span style={{ color: "hsl(210,10%,30%)" }}>—</span>))
              : (item.rate ? `${item.rate}%` : <span style={{ color: "hsl(210,10%,30%)" }}>—</span>)
            }
          </div>
          <div style={{ ...cellBase }}>
            {item.comment && (
              <span style={{ fontSize: 9.5, color: item.comment.color === "red" ? "hsl(0,65%,55%)" : item.comment.color === "orange" ? "hsl(38,78%,52%)" : BS_TEXT_MUTED }}>
                {item.comment.text}
              </span>
            )}
          </div>
        </div>
      );
    });

  const renderGroup = (group: BsGroup, showSubtotal: boolean) => (
    <div key={group.category}>
      {renderItems(group.items)}
      {showSubtotal && (
        <div className="grid" style={{ gridTemplateColumns: COLS, background: BS_BG_GRPHDR, borderTop: `1px solid ${BS_BORDER_SEC}`, borderBottom: `1px solid ${BS_BORDER_SEC}` }}>
          <div style={{ ...cellBase, paddingLeft: 14, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: BS_GREEN_DIM, borderBottom: "none" }}>{group.category}</div>
          <div style={{ ...cellBase, textAlign: "right", fontWeight: 700, color: BS_TEXT, borderBottom: "none" }}>{fmt(group.subtotal)}</div>
          <div style={{ ...cellBase, textAlign: "right", color: BS_TEXT_MUTED, borderBottom: "none" }}>
            {group.avgRate ? `${group.avgRate}%` : ""}
          </div>
          <div style={{ ...cellBase, borderBottom: "none" }} />
        </div>
      )}
    </div>
  );

  const hdrCell: React.CSSProperties = {
    fontFamily: MONO, fontSize: 10.5, fontWeight: 800,
    letterSpacing: "0.10em", textTransform: "uppercase",
    color: "hsl(210,35%,65%)", padding: "7px 8px",
    borderBottom: `1px solid ${BS_BORDER_SEC}`,
  };

  return (
    <div style={{ border: `1px solid ${BS_BORDER}`, borderRadius: 10, overflow: "hidden", fontFamily: MONO }}>
      {/* Header */}
      <div className="grid" style={{ gridTemplateColumns: COLS, background: BS_BG_GRANDTOT }}>
        <div style={{ ...hdrCell, paddingLeft: 12 }}>{isLiability ? "Liability Category" : "Asset Category"}</div>
        <div style={{ ...hdrCell, textAlign: "right" }}>Balance</div>
        <div style={{ ...hdrCell, textAlign: "right" }}>{isLiability ? "Cost" : "Yield / Return"}</div>
        <div style={{ ...hdrCell }}>Notes</div>
      </div>
      {/* Sectioned asset rows */}
      {sections && sections.map((sec) => (
        <div key={sec.label}>
          {sec.groups.map((group) => renderGroup(group, sec.groups.length > 1 || group.items.length > 1))}
          {/* Section total */}
          <div className="grid" style={{ gridTemplateColumns: COLS, background: BS_BG_SECTOT, borderTop: `2px solid ${BS_BORDER_SEC}`, borderBottom: `2px solid ${BS_BORDER_SEC}` }}>
            <div style={{ ...cellBase, paddingLeft: 12, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: BS_GREEN_MED, borderLeft: `3px solid ${BS_GREEN_DIM}`, borderBottom: "none" }}>{sec.label}</div>
            <div style={{ ...cellBase, textAlign: "right", fontWeight: 800, color: BS_TEXT, borderBottom: "none" }}>{fmt(sec.total)}</div>
            <div style={{ ...cellBase, borderBottom: "none" }} />
            <div style={{ ...cellBase, borderBottom: "none" }} />
          </div>
        </div>
      ))}
      {/* Flat liability rows (no sections) */}
      {groups && groups.map((group) => (
        <div key={group.category}>
          {renderItems(group.items)}
          <div className="grid" style={{ gridTemplateColumns: COLS, background: BS_BG_SECTOT, borderTop: `2px solid ${BS_BORDER_SEC}`, borderBottom: `2px solid ${BS_BORDER_SEC}` }}>
            <div style={{ ...cellBase, paddingLeft: 12, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: BS_GREEN_MED, borderLeft: `3px solid ${BS_GREEN_DIM}`, borderBottom: "none" }}>{group.category}</div>
            <div style={{ ...cellBase, textAlign: "right", fontWeight: 800, color: BS_TEXT, borderBottom: "none" }}>{fmt(group.subtotal)}</div>
            <div style={{ ...cellBase, textAlign: "right", color: BS_TEXT_MUTED, borderBottom: "none" }}>
              {group.avgRate ? `${group.avgRate}%` : ""}
            </div>
            <div style={{ ...cellBase, borderBottom: "none" }} />
          </div>
        </div>
      ))}
      {/* Grand total */}
      <div className="grid" style={{ gridTemplateColumns: COLS, background: BS_BG_GRANDTOT, borderTop: `2px solid ${BS_BORDER_SEC}` }}>
        <div style={{ ...cellBase, paddingLeft: 12, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: BS_TEXT, borderBottom: "none", borderLeft: `3px solid hsl(210,55%,50%)` }}>{totalLabel}</div>
        <div style={{ ...cellBase, textAlign: "right", fontWeight: 900, color: BS_TEXT, borderBottom: "none" }}>{fmt(totalValue)}</div>
        <div style={{ ...cellBase, textAlign: "right", color: BS_TEXT_MUTED, borderBottom: "none" }}>
          {totalRate ? `${totalRate}%` : ""}
        </div>
        <div style={{ ...cellBase, borderBottom: "none" }} />
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
  | { key: string; kind: "group";    label: string }
  | { key: string; kind: "item";     label: string; descs: string[]; renderAs?: "subtotal" }
  | { key: string; kind: "subtotal"; label: string; sumOf?: string[]; descs?: string[] }
  | { key: string; kind: "total";    label: string; sumOf?: string[]; compute?: "outflow" | "net" | "cumulative"; accent: "green" | "amber" };

const CF_PL_ROWS: PLRowDef[] = [
  { key: "g_income", kind: "group", label: "EARNED INCOME" },
  {
    key: "michael_salary",
    kind: "item",
    label: "Michael — Net Monthly Salary",
    descs: ["Michael — Net Monthly", "Monthly Net Salaries"],
  },
  {
    key: "sarah_salary",
    kind: "item",
    label: "Sarah — Net Monthly Salary",
    descs: ["Sarah — Net Monthly"],
  },
  {
    key: "bonus_p1",
    kind: "item",
    label: "Michael — Year-End Bonus",
    descs: ["Partner 1 Year-End"],
  },
  {
    key: "bonus_p2",
    kind: "item",
    label: "Sarah — Year-End Bonus",
    descs: ["Partner 2 Year-End"],
  },
  {
    key: "sub_income",
    kind: "subtotal",
    label: "Cash Compensation",
    sumOf: ["michael_salary", "sarah_salary", "bonus_p1", "bonus_p2"],
  },
  {
    key: "reserve_int",
    kind: "item",
    label: "Interest From Bank Accounts",
    descs: ["Reserve MMF"],
  },
  {
    key: "sub_total_income",
    kind: "total",
    label: "TOTAL CASH INCOME",
    sumOf: ["sub_income", "reserve_int"],
    accent: "green",
  },
  { key: "g_tribeca", kind: "group", label: "TRIBECA — PRIMARY RESIDENCE" },
  { key: "trib_mortgage", kind: "item", label: "Mortgage",          descs: ["Tribeca — Mortgage"] },
  { key: "trib_hoa",      kind: "item", label: "HOA & Maintenance", descs: ["Tribeca — HOA"] },
  { key: "trib_ins",      kind: "item", label: "Home Insurance",    descs: ["Tribeca — Home Insurance"] },
  { key: "trib_util",     kind: "item", label: "Cable & Utilities", descs: ["Tribeca — Cable"] },
  { key: "nyc_tax",       kind: "item", label: "NYC Property Taxes", descs: ["NYC Property Taxes"] },
  { key: "sub_trib", kind: "subtotal", label: "12 Warren NYC — Primary Residence", sumOf: ["trib_mortgage", "trib_hoa", "trib_ins", "trib_util", "nyc_tax"] },
  { key: "g_sara", kind: "group", label: "SARASOTA — INVESTMENT PROPERTY" },
  { key: "sara_in",    kind: "item", label: "Rental Income",              descs: ["Investment Property Rental Income"] },
  { key: "sara_mgmt",  kind: "item", label: "Property Management",        descs: ["Investment Property — Property Management"] },
  { key: "sara_mtg",   kind: "item", label: "Mortgage",                   descs: ["Investment Property — Mortgage"] },
  { key: "sara_maint", kind: "item", label: "Maintenance / HOA",          descs: ["Investment Property — Maintenance"] },
  { key: "sara_golf",  kind: "item", label: "Golf Club Dues",             descs: ["Sarasota — Golf Club"] },
  { key: "fl_tax",     kind: "item", label: "Property Taxes (FL annual)", descs: ["Investment Property Taxes"] },
  { key: "sub_sara", kind: "subtotal", label: "Sarasota Investment Property", sumOf: ["sara_in", "sara_mgmt", "sara_mtg", "sara_maint", "sara_golf", "fl_tax"] },
  { key: "g_living", kind: "group", label: "DEPENDENT CARE & EDUCATION" },
  {
    key: "childcare",
    kind: "item",
    label: "Nanny",
    descs: ["Childcare"],
  },
  {
    key: "tuition",
    kind: "item",
    label: "Private School Tuition",
    descs: ["Private School Tuition"],
  },
  {
    key: "sub_living",
    kind: "subtotal",
    label: "Dependent Care & Education",
    sumOf: ["childcare", "tuition"],
  },
  { key: "g_credit", kind: "group", label: "CREDIT CARD" },
  {
    key: "cc_pay",
    kind: "item",
    label: "Credit Card Payments",
    descs: ["Credit Card Payments"],
    renderAs: "subtotal",
  },
  { key: "g_lifestyle", kind: "group", label: "LIFESTYLE" },
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
    descs: ["NYC — Golf Club"],
  },
  {
    key: "insurance",
    kind: "item",
    label: "Annual Insurance Premiums",
    descs: ["Annual Insurance"],
  },
  {
    key: "phone_util",
    kind: "item",
    label: "Phone / Utilities",
    descs: ["Phone, Cable"],
  },
  {
    key: "sub_lifestyle",
    kind: "subtotal",
    label: "Lifestyle",
    sumOf: ["memberships", "golf", "insurance", "phone_util"],
  },
  { key: "g_debt", kind: "group", label: "DEBT SERVICE" },
  {
    key: "pe_loan",
    kind: "item",
    label: "Professional Loan (Private Equity)",
    descs: ["PE Fund II Professional"],
  },
  {
    key: "student",
    kind: "item",
    label: "Student Debt (Undergrad + Graduate)",
    descs: ["Student Loan Payments"],
  },
  {
    key: "sub_debt",
    kind: "subtotal",
    label: "Debt Service",
    sumOf: ["pe_loan", "student"],
  },
  { key: "g_tax", kind: "group", label: "TAXES" },
  {
    key: "fed_tax",
    kind: "item",
    label: "Federal Estimated Tax",
    descs: ["Federal Estimated Income Tax"],
  },
  { key: "g_travel", kind: "group", label: "TRAVEL" },
  { key: "trav_all", kind: "item", label: "Travel", descs: ["Memorial Day Travel", "Weekend Travel", "Summer Travel", "Thanksgiving Travel", "Holiday Travel"] },
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
  // ── Headline totals — computed, not hardcoded ──────────────────────────────
  { key: "total_expenses", kind: "total", label: "TOTAL CASH EXPENSES",    compute: "outflow",     accent: "green" },
  { key: "total_net",      kind: "total", label: "TOTAL NET CASH FLOW",    compute: "net",         accent: "amber" },
  { key: "total_cum",      kind: "total", label: "CUMULATIVE NET CASH FLOW", compute: "cumulative", accent: "amber" },
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
  autoFullScreen = false,
  onCloseFullScreen,
}: {
  assets: Asset[];
  cashFlows: CashFlow[];
  clientId: number;
  autoFullScreen?: boolean;
  onCloseFullScreen?: () => void;
}) {
  const { reserve, yieldBucket, tactical, totalLiquid, reserveItems, yieldItems, tacticalItems } = cashBuckets(assets);
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
  const [hoveredCfIdx, setHoveredCfIdx] = React.useState<number | null>(null);
  const [showCfPanel, setShowCfPanel] = React.useState(true);
  const [cfTotalStyle, setCfTotalStyle] = React.useState<"A" | "B">("A");
  const [tableExpanded, setTableExpanded] = React.useState(false);
  const [tableView, setTableView] = React.useState<"mo" | "qtr">("qtr");
  const [alertHighlight, setAlertHighlight] = React.useState<"cf" | "liq" | null>(null);
  const [modelFullScreen, setModelFullScreen] = React.useState(autoFullScreen);

  // When parent toggles autoFullScreen on, open the portal
  React.useEffect(() => {
    if (autoFullScreen) setModelFullScreen(true);
  }, [autoFullScreen]);

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
  // Pass 1: items and subtotals (totals with compute= are deferred to pass 2)
  for (const row of CF_PL_ROWS) {
    if (row.kind === "item") {
      vals[row.key] = CF_MONTHS.map((m) => monthVal(row.descs, m.year, m.month));
    } else if (row.kind === "subtotal") {
      if (row.sumOf) {
        vals[row.key] = CF_MONTHS.map((_, mi) => row.sumOf!.reduce((s, k) => s + (vals[k]?.[mi] ?? 0), 0));
      } else if (row.descs) {
        vals[row.key] = CF_MONTHS.map((m) => monthVal(row.descs!, m.year, m.month));
      } else {
        vals[row.key] = CF_MONTHS.map(() => 0);
      }
    } else if (row.kind === "total" && row.sumOf) {
      vals[row.key] = CF_MONTHS.map((_, mi) => row.sumOf!.reduce((s, k) => s + (vals[k]?.[mi] ?? 0), 0));
    } else {
      vals[row.key] = CF_MONTHS.map(() => 0); // placeholder; filled in pass 2 for compute= rows
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
  const CORE_EXPENSE_KEYS = ["trib_mortgage", "trib_hoa", "trib_ins", "trib_util", "nyc_tax", "sara_mgmt", "sara_mtg", "sara_maint", "sara_golf", "fl_tax", "childcare", "phone_util", "cc_pay", "memberships", "golf", "insurance", "pe_loan", "student"];
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

  // ── Quarterly card data (component scope) ─────────────────────────────────
  const CF_Q_DEFS = [
    { key: "Q1", label: "Q1", months: [0,1,2] },
    { key: "Q2", label: "Q2", months: [3,4,5] },
    { key: "Q3", label: "Q3", months: [6,7,8] },
    { key: "Q4", label: "Q4", months: [9,10,11] },
  ];
  let qRunning2 = totalLiquid;
  const qCardData = CF_Q_DEFS.map((q) => {
    const qIn  = q.months.reduce((s, mi) => s + (inflowByMonth[mi] ?? 0), 0);
    const qOut = q.months.reduce((s, mi) => s + Math.abs(outflowByMonth[mi] ?? 0), 0);
    const qStart = qRunning2;
    const qEnd   = qStart + qIn - qOut;
    qRunning2 = qEnd;
    return { key: q.key, label: q.label, start: qStart, inflow: qIn, outflow: qOut, end: qEnd };
  });
  const troughQIdx = qCardData.reduce((mi, row, i, arr) => row.end < arr[mi].end ? i : mi, 0);

  // Quarterly Cash Balance Walk — core vs one-time split
  let qWalkRunning = totalLiquid;
  const qWalkData = CF_Q_DEFS.map((q) => {
    const qStart = qWalkRunning;
    const qFlows = cashFlows.filter((cf) => {
      const d = new Date(cf.date);
      return d.getFullYear() === 2026 && q.months.includes(d.getMonth());
    });
    const inflow    = qFlows.filter(cf => cf.type === "inflow").reduce((s,cf) => s + Number(cf.amount), 0);
    const coreOut   = qFlows.filter(cf => cf.type === "outflow" && ["housing","living_expenses"].includes(cf.category ?? "")).reduce((s,cf) => s + Number(cf.amount), 0);
    const oneTimeOut= qFlows.filter(cf => cf.type === "outflow" && !["housing","living_expenses"].includes(cf.category ?? "")).reduce((s,cf) => s + Number(cf.amount), 0);
    const qEnd = qStart + inflow - coreOut - oneTimeOut;
    qWalkRunning = qEnd;
    return { key: q.key, label: q.label, start: qStart, inflow, coreOut, oneTimeOut, end: qEnd };
  });

  const RESERVE_FLOOR = 194196;
  const fmtQK = (v: number) => `$${Math.round(Math.abs(v)).toLocaleString()}`;

  // ── Balance forecast for Chart B ─────────────────────────────────────────
  const balanceForecastData = CF_MONTHS.map((m, i) => ({
    label: m.label,
    balance: Math.round(totalLiquid + cumulativeByMonth[i]),
    floor: RESERVE_FLOOR,
  }));

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

  // ── Cumulative chart data: split into surplus / deficit areas ─────────────
  const cumulMin = Math.min(...cumulativeByMonth, 0);
  const cumulMax = Math.max(...cumulativeByMonth, 0);
  const cumulChartData = CF_MONTHS.map((m, i) => ({
    label: m.label,
    surplus: Math.max(0, cumulativeByMonth[i]),
    deficit: Math.min(0, cumulativeByMonth[i]),
    value:   cumulativeByMonth[i],
  }));
  // Y-axis ceiling: cap at $75K so the trough has visual breathing room
  // without wasting vertical space above the final positive reading.
  const cumulDomainMax = Math.max(cumulMax, 75000);

  // Gradient stop fraction — uses ACTUAL data bounds, NOT the display domain.
  // Proof: the SVG bounding-box of the rendered Area path spans [cumulMax → cumulMin]
  // in data space; the display domain cancels out algebraically.
  //   stop = (box_top_data − 0) / (box_top_data − box_bottom_data)
  //        = cumulMax / (cumulMax − cumulMin)
  const cumulZeroFrac = (cumulMax - cumulMin) === 0 ? 0.5
    : cumulMax / (cumulMax - cumulMin);

  // Investment properties cross-section subtotal

  // Compact column definitions: Jan/Feb/Mar | Q2/Q3/Q4 | Annual
  const tcolDefs = [
    { l: "Jan",  isMo: true,  isQ: false, isFirstQ: false, isAnn: false, isFirst: true,  getV: (v: number[]) => v[0] ?? 0 },
    { l: "Feb",  isMo: true,  isQ: false, isFirstQ: false, isAnn: false, isFirst: false, getV: (v: number[]) => v[1] ?? 0 },
    { l: "Mar",  isMo: true,  isQ: false, isFirstQ: false, isAnn: false, isFirst: false, getV: (v: number[]) => v[2] ?? 0 },
    { l: "Q2",   isMo: false, isQ: true,  isFirstQ: true,  isAnn: false, isFirst: false, getV: (v: number[]) => (v[3]??0)+(v[4]??0)+(v[5]??0) },
    { l: "Q3",   isMo: false, isQ: true,  isFirstQ: false, isAnn: false, isFirst: false, getV: (v: number[]) => (v[6]??0)+(v[7]??0)+(v[8]??0) },
    { l: "Q4",   isMo: false, isQ: true,  isFirstQ: false, isAnn: false, isFirst: false, getV: (v: number[]) => (v[9]??0)+(v[10]??0)+(v[11]??0) },
    { l: "2026", isMo: false, isQ: false, isFirstQ: false, isAnn: true,  isFirst: false, getV: (v: number[]) => v.reduce((s, x) => s + x, 0) },
  ];

  // Cumulative snapshots at end of each compact period
  const cumSnap = [
    cumulativeByMonth[0],   // Jan
    cumulativeByMonth[1],   // Feb
    cumulativeByMonth[2],   // Mar
    cumulativeByMonth[5],   // Q2 end (Jun)
    cumulativeByMonth[8],   // Q3 end (Sep)
    cumulativeByMonth[11],  // Q4 end (Dec)
    cumulativeByMonth[11],  // Annual (same as Q4)
  ];
  const troughSnap = Math.min(...cumSnap);

  // Pass 2: fill in total rows that depend on derived arrays
  vals["total_expenses"] = outflowByMonth;
  vals["total_net"]      = netByMonth;
  // cumulative uses cumSnap (end-of-period snapshots, not sums) — stored separately
  // vals["total_cum"] is intentionally left as placeholder; renderer reads cumSnap directly


  // Table cell formatters
  const cfFi = (v: number): React.ReactNode => {
    if (v === 0) return <span style={{ color: "hsl(152,8%,28%)" }}>—</span>;
    return v < 0
      ? `(${Math.round(Math.abs(v)).toLocaleString()})`
      : `${Math.round(v).toLocaleString()}`;
  };
  const cfFs = (v: number): React.ReactNode => {
    if (v === 0) return <span style={{ color: "hsl(152,8%,28%)" }}>—</span>;
    const abs = Math.round(Math.abs(v)).toLocaleString();
    const col = v > 0 ? "var(--intel-positive)" : "var(--intel-negative)";
    return <strong><span style={{ color: col }}>{v < 0 ? `($${abs})` : `$${abs}`}</span></strong>;
  };
  const cfFc = (v: number): React.ReactNode => {
    if (v === 0) return <span style={{ color: "hsl(152,8%,28%)" }}>—</span>;
    return v < 0
      ? `(${Math.round(Math.abs(v)).toLocaleString()})`
      : `${Math.round(v).toLocaleString()}`;
  };
  const cfNetFmt = (v: number): React.ReactNode => {
    if (v === 0) return "—";
    const abs = Math.round(Math.abs(v)).toLocaleString();
    const col = v > 0 ? "var(--intel-positive)" : "var(--intel-negative)";
    return <strong><span style={{ color: col }}>{v < 0 ? `($${abs})` : `+$${abs}`}</span></strong>;
  };

  // Column background by group
  const colBg = (col: typeof tcolDefs[number], altRow: boolean): string => {
    if (col.isAnn) return "#162843";
    if (col.isQ)   return altRow ? "#122038" : "#0f1e33";
    return altRow ? "#122038" : "#0f1e33";
  };
  const colBorderL = (col: typeof tcolDefs[number]): string => {
    if (col.isFirst)  return "2px solid #1e3352";
    if (col.isFirstQ) return "3px solid #2a4a6e";   // thick blue: Mar → Q2
    if (col.isQ)      return "1px solid #1e3352";   // lighter for Q3/Q4
    if (col.isAnn)    return "3px solid #2a5a70";   // thick teal-navy: Q4 → 2026
    return "none";
  };
  const subColBg = (col: typeof tcolDefs[number]): string => {
    if (col.isAnn) return "#1a2d47";
    if (col.isQ)   return "#1a2d47";
    return "#162843";
  };

  // ── Design tokens ─────────────────────────────────────────────────────────
  const CF2 = {
    bg:       "#141c2b",
    card:     "#1e2838",
    elevated: "#1a2433",
    border:   "rgba(255,255,255,0.08)",
    divider:  "rgba(255,255,255,0.06)",
    txt:      "rgba(255,255,255,0.9)",
    txt2:     "rgba(255,255,255,0.85)",
    txtMuted: "rgba(255,255,255,0.6)",
    txtDim:   "rgba(255,255,255,0.5)",
    green:    "#5ecc8a",
    amber:    "#ffc83c",
    red:      "#ff6464",
    gold:     "#ffc83c",
    INTER:    "Inter, system-ui, sans-serif",
    SERIF:    "'Instrument Serif', Georgia, serif",
  };

  // ── Anomaly cell detection ─────────────────────────────────────────────────
  const anomalyCell = (rowVals: number[], colIdx: number): boolean => {
    const v = rowVals[colIdx] ?? 0;
    if (Math.abs(v) < 12000) return false;
    const nonZeroCount = rowVals.filter(x => Math.abs(x) >= 1000).length;
    return nonZeroCount <= 4;
  };

  return (
    <div style={{ overflow:"hidden", background:CF2.bg, display:"flex", flexDirection:"column" as const, height:"100vh", minHeight:0 }}>

      {/* ── CSS ─────────────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes guruBreathe  { 0%,100%{opacity:1}    50%{opacity:0.4} }
        @keyframes livePulse    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.25;transform:scale(0.5)} }
        @keyframes glowPulse    { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes alertDot     { 0%,100%{box-shadow:0 0 8px rgba(94,204,138,0.4)} 50%{box-shadow:0 0 14px rgba(94,204,138,0.7)} }
        @keyframes tickerItem   { 0%{opacity:0;transform:translateY(4px)} 6%,28%{opacity:1;transform:translateY(0)} 33%,100%{opacity:0;transform:translateY(-5px)} }
        @keyframes scanLine     { 0%{left:-60%} 100%{left:130%} }
        @keyframes borderRunGreen { 0%,100%{box-shadow:3px 0 10px rgba(94,204,138,0.55),0 0 0 1px rgba(94,204,138,0.28)} 25%{box-shadow:0 3px 10px rgba(94,204,138,0.55),0 0 0 1px rgba(94,204,138,0.28)} 50%{box-shadow:-3px 0 10px rgba(94,204,138,0.55),0 0 0 1px rgba(94,204,138,0.28)} 75%{box-shadow:0 -3px 10px rgba(94,204,138,0.55),0 0 0 1px rgba(94,204,138,0.28)} }
        @keyframes borderRunAmber { 0%,100%{box-shadow:3px 0 10px rgba(255,200,60,0.55),0 0 0 1px rgba(255,200,60,0.28)} 25%{box-shadow:0 3px 10px rgba(255,200,60,0.55),0 0 0 1px rgba(255,200,60,0.28)} 50%{box-shadow:-3px 0 10px rgba(255,200,60,0.55),0 0 0 1px rgba(255,200,60,0.28)} 75%{box-shadow:0 -3px 10px rgba(255,200,60,0.55),0 0 0 1px rgba(255,200,60,0.28)} }
        @keyframes borderRunBlue  { 0%,100%{box-shadow:3px 0 10px rgba(91,143,204,0.65),0 0 0 1px rgba(91,143,204,0.35)} 25%{box-shadow:0 3px 10px rgba(91,143,204,0.65),0 0 0 1px rgba(91,143,204,0.35)} 50%{box-shadow:-3px 0 10px rgba(91,143,204,0.65),0 0 0 1px rgba(91,143,204,0.35)} 75%{box-shadow:0 -3px 10px rgba(91,143,204,0.65),0 0 0 1px rgba(91,143,204,0.35)} }
        .cf-chart-wrap { transition: box-shadow 0.3s ease, border-color 0.3s ease; border-radius:8px; }
        .cf-chart-wrap.glow-cf  { box-shadow:0 0 28px rgba(255,100,100,0.12); border-color:rgba(255,100,100,0.25) !important; }
        .cf-chart-wrap.glow-liq { box-shadow:0 0 28px rgba(255,200,60,0.12);  border-color:rgba(255,200,60,0.25)  !important; }
        .model-bar { cursor:pointer; transition: background 0.15s, border-color 0.15s; }
        .model-bar:hover { background: #243040 !important; border-color: rgba(255,255,255,0.12) !important; }
      `}</style>

      {/* ── 1. PAGE HEADER ───────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 20px", borderBottom:"1px solid rgba(42,74,110,0.4)", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <span style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:20, fontWeight:500, letterSpacing:"0.06em", color:"rgba(255,255,255,0.9)" }}>Cashflow</span>
          <span style={{ width:1, height:12, background:"rgba(42,74,110,0.6)", display:"inline-block" }} />
          <span style={{ fontFamily:CF2.INTER, fontSize:11, color:"rgba(255,255,255,0.65)" }}>Sarah &amp; Michael Kessler · Jan–Dec 2026</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ width:5, height:5, borderRadius:"50%", background:"hsl(152,40%,48%)", display:"inline-block", animation:"livePulse 2s ease-in-out infinite" }} />
          <span style={{ fontFamily:CF2.INTER, fontSize:9, fontWeight:500, color:"rgba(90,154,126,0.5)", letterSpacing:"0.04em" }}>Live</span>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ──────────────────────────────────────────────────────── */}
      <div style={{ flex:1, overflowY:"auto" as const, overflowX:"hidden" as const }}>
        <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column" as const, gap:12 }}>

          {/* ── 2. GURU DETECTIONS BANNER ─────────────────────────────────────────── */}
          {(()=>{
            const detections = [
              {
                id:      "sync",
                category:"DATA SYNC COMPLETE",
                title:   "DATA SYNC COMPLETE",
                lines:   ["Balances refreshed Dec 29", "Bonus inflow detected"],
                timestamp:"2 days ago",
                badge:   "LIVE",
                badgeColor:"#5ecc8a",
                badgeBorder:"rgba(94,204,138,0.35)",
                badgeBg:"rgba(94,204,138,0.08)",
                glowColor:"rgba(94,204,138,0.06)",
                borderAnim:"borderRunGreen 4s ease-in-out infinite",
                borderDelay:"0s",
                chart:   null as ("liq"|"cf"|null),
                pulseDot: true,
              },
              // "liq" is rendered separately as the hero card — not in this array

              {
                id:      "april",
                category:"CASH OUTFLOW · APRIL",
                title:   "APRIL UPCOMING · HIGH EXPENSES",
                lines:   ["$57K commitment cluster", "Tuition, federal taxes, property tax"],
                timestamp:"4 days ago",
                badge:   "ACTION",
                badgeColor:"#ffc83c",
                badgeBorder:"rgba(255,200,60,0.35)",
                badgeBg:"rgba(255,200,60,0.08)",
                glowColor:"rgba(255,200,60,0.05)",
                borderAnim:"borderRunAmber 4s ease-in-out infinite",
                borderDelay:"2s",
                chart:   "cf" as ("liq"|"cf"|null),
                scrollTarget: "chart-cf",
                arrowLabel: "Monthly Cash Flow →",
                pulseDot: false,
              },
              {
                id:      "nov",
                category:"CASH OUTFLOW · THROUGH NOV",
                title:   "CASH OUTFLOW POSITION THROUGH NOVEMBER",
                lines:   ["Ample liquidity to cover outflows"],
                timestamp:"12 hours ago",
                badge:   "WATCH",
                badgeColor:"#5b8fcc",
                badgeBorder:"rgba(91,143,204,0.35)",
                badgeBg:"rgba(91,143,204,0.08)",
                glowColor:"rgba(91,143,204,0.05)",
                borderAnim:"borderRunBlue 4s ease-in-out infinite",
                borderDelay:"3s",
                chart:   "cf" as ("liq"|"cf"|null),
                scrollTarget: "chart-cf",
                arrowLabel: "Cumulative Cash Flow →",
                pulseDot: false,
              },
            ];
            return (
              <div style={{ position:"relative", background:"#3a5580", borderRadius:8, overflow:"hidden" }}>
                {/* Ambient glow */}
                <div style={{ position:"absolute", top:-40, left:-40, width:300, height:200, background:"radial-gradient(ellipse at center, rgba(100,160,240,0.15) 0%, rgba(80,140,220,0.06) 40%, transparent 70%)", pointerEvents:"none", animation:"glowPulse 4s ease-in-out infinite" }} />
                {/* Top accent line */}
                <div style={{ position:"absolute", top:0, left:0, width:"100%", height:1, background:"linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)", pointerEvents:"none" }} />
                {/* ── Thin ticker row ── */}
                <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 18px 4px", borderBottom:"1px solid rgba(255,255,255,0.08)", overflow:"hidden", minHeight:22 }}>
                  {/* Moving scan line */}
                  <div style={{ position:"absolute", top:0, left:0, width:"35%", height:"100%", background:"linear-gradient(90deg, transparent 0%, rgba(180,210,255,0.07) 50%, transparent 100%)", pointerEvents:"none", animation:"scanLine 3.5s linear infinite" }} />
                  {/* Ticker text — 3 items, each absolutely positioned, cycling via CSS */}
                  <div style={{ position:"relative", height:13, flex:1, overflow:"hidden" }}>
                    {([
                      { text:"▶  System scan active", delay:"0s" },
                      { text:"◈  4 alerts detected",  delay:"3s" },
                      { text:"◷  Last scan 4s ago",   delay:"6s" },
                    ] as {text:string; delay:string}[]).map((item) => (
                      <span
                        key={item.text}
                        style={{
                          position:"absolute", top:0, left:0,
                          fontFamily:CF2.INTER, fontSize:9, fontWeight:600,
                          textTransform:"uppercase" as const, letterSpacing:"0.12em",
                          color:"rgba(180,210,255,0.85)",
                          whiteSpace:"nowrap" as const,
                          lineHeight:"13px",
                          animation:`tickerItem 9s ease-in-out infinite`,
                          animationDelay: item.delay,
                          animationFillMode:"both" as const,
                        }}
                      >{item.text}</span>
                    ))}
                  </div>
                  <div style={{ fontFamily:CF2.INTER, fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:"0.06em", textTransform:"uppercase" as const, flexShrink:0 }}>GURU AI</div>
                </div>
                {/* ── Main header row ── */}
                <div style={{ position:"relative", display:"flex", alignItems:"center", padding:"8px 18px 7px" }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"#5ecc8a", display:"inline-block", flexShrink:0, animation:"alertDot 2s ease-in-out infinite", marginRight:8 }} />
                  <span style={{ fontFamily:CF2.INTER, fontSize:12, fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.1em", color:"rgba(180,215,255,0.95)", lineHeight:1 }}>GURU DETECTION SYSTEM</span>
                  <span style={{ fontFamily:CF2.INTER, fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:"0.04em", marginLeft:"auto" }}>4 active · last scan 4s ago</span>
                </div>
                {/* ── HERO: Excess Liquidity (full-width, big numbers) ─────────── */}
                {(()=>{
                  const excessLiqAmt  = Math.max(0, totalLiquid + heroTroughValue);
                  const deployableAmt = Math.round(excessLiqAmt * 0.623);
                  const potentialInc  = Math.round(deployableAmt * 0.0696);
                  const liqIsActive   = alertHighlight === "liq";
                  return (
                    <div
                      onClick={()=>{
                        setAlertHighlight(h => h === "liq" ? null : "liq");
                        const el = document.getElementById("chart-liq");
                        if(el) setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),80);
                      }}
                      style={{
                        position:"relative",
                        margin:"0 14px 8px",
                        padding:"14px 18px 14px",
                        background: liqIsActive ? "rgba(0,0,0,0.38)" : "rgba(0,0,0,0.22)",
                        borderRadius:7,
                        cursor:"pointer",
                        overflow:"hidden",
                        transition:"background 0.15s",
                        animation:"borderRunGreen 4s ease-in-out infinite",
                        animationDelay:"1s",
                        borderLeft:"2.5px solid rgba(94,204,138,0.5)",
                      }}
                    >
                      {/* Ambient glow */}
                      <div style={{ position:"absolute", top:-20, right:-20, width:200, height:140, background:"radial-gradient(ellipse at center, rgba(94,204,138,0.08) 0%, transparent 70%)", pointerEvents:"none" }} />
                      {/* Top row: category label + timestamp */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                          <span style={{ width:6, height:6, borderRadius:"50%", background:"#5ecc8a", display:"inline-block", flexShrink:0, animation:"alertDot 2s ease-in-out infinite" }} />
                          <span style={{ fontFamily:CF2.INTER, fontSize:10, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.12em", color:"rgba(94,204,138,0.9)" }}>LIQUIDITY SIGNAL</span>
                        </div>
                        <span style={{ fontFamily:CF2.INTER, fontSize:9, color:"rgba(255,255,255,0.28)", letterSpacing:"0.02em" }}>6 hours ago</span>
                      </div>
                      {/* Title */}
                      <div style={{ fontFamily:CF2.INTER, fontSize:13, fontWeight:700, color:"rgba(180,215,255,0.95)", letterSpacing:"0.01em", marginBottom:14 }}>
                        EXCESS LIQUIDITY DETECTED
                      </div>
                      {/* Hero numbers row */}
                      <div style={{ display:"flex", alignItems:"flex-end", gap:0, marginBottom:12 }}>
                        {/* Left: Excess Liquidity */}
                        <div style={{ flex:1, paddingRight:20, borderRight:"1px solid rgba(255,255,255,0.08)" }}>
                          <div style={{ fontFamily:CF2.INTER, fontSize:10, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.09em", color:"rgba(255,255,255,0.38)", marginBottom:4 }}>Excess Liquidity</div>
                          <div style={{ fontFamily:CF2.INTER, fontSize:36, fontWeight:300, lineHeight:1, color:CF2.green, fontVariantNumeric:"tabular-nums" as const, letterSpacing:"-0.01em" }}>
                            {`$${excessLiqAmt >= 1000000 ? (excessLiqAmt/1000000).toFixed(2)+"M" : Math.round(excessLiqAmt/1000)+"K"}`}
                          </div>
                          <div style={{ fontFamily:CF2.INTER, fontSize:10, color:"rgba(255,255,255,0.45)", marginTop:5, lineHeight:1.4 }}>
                            Above reserve floor &nbsp;·&nbsp; <span style={{ color:"rgba(94,204,138,0.7)" }}>{`$${Math.round(deployableAmt/1000)}K deployable`}</span>
                          </div>
                        </div>
                        {/* Right: Potential Income Pickup */}
                        <div style={{ flex:1, paddingLeft:20 }}>
                          <div style={{ fontFamily:CF2.INTER, fontSize:10, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.09em", color:"rgba(255,255,255,0.38)", marginBottom:4 }}>Potential Income Pickup</div>
                          <div style={{ fontFamily:CF2.INTER, fontSize:36, fontWeight:300, lineHeight:1, color:CF2.green, fontVariantNumeric:"tabular-nums" as const, letterSpacing:"-0.01em" }}>
                            {`+$${potentialInc >= 10000 ? (potentialInc/1000).toFixed(1)+"K" : potentialInc.toLocaleString()}`}
                            <span style={{ fontSize:14, fontWeight:400, color:"rgba(94,204,138,0.7)", marginLeft:3 }}>/yr</span>
                          </div>
                          <div style={{ fontFamily:CF2.INTER, fontSize:10, color:"rgba(255,255,255,0.45)", marginTop:5, lineHeight:1.4 }}>
                            If deployed at current AT yields &nbsp;·&nbsp; <span style={{ color:"rgba(94,204,138,0.7)" }}>~7% after-tax</span>
                          </div>
                        </div>
                      </div>
                      {/* Footer: badge + arrow */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:6 }}>
                        <div style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:4, border:"1px solid rgba(94,204,138,0.35)", background:"rgba(94,204,138,0.08)" }}>
                          <span style={{ fontFamily:CF2.INTER, fontSize:9.5, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.06em", color:"#5ecc8a" }}>OPPORTUNITY</span>
                        </div>
                        <div style={{ fontFamily:CF2.INTER, fontSize:9.5, fontWeight:600, color:"rgba(180,215,255,0.5)", letterSpacing:"0.03em", display:"flex", alignItems:"center", gap:2 }}>
                          <span>Liquidity Runway →</span>
                          <span style={{ fontSize:9, opacity:0.75 }}>↗</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {/* Detection cards grid — 3 smaller cards below the hero */}
                <div style={{ position:"relative", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, padding:"0 14px 14px" }}>
                  {detections.map((d) => {
                    const isActive = alertHighlight === d.chart && d.chart !== null;
                    return (
                      <div
                        key={d.id}
                        onClick={()=>{
                          if(d.chart) setAlertHighlight(h => h === d.chart ? null : d.chart);
                          const st = (d as any).scrollTarget;
                          if(st){ const el = document.getElementById(st); if(el) setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),80); }
                        }}
                        style={{
                          position:"relative",
                          padding:"8px 12px 8px",
                          background: isActive ? "rgba(0,0,0,0.32)" : "rgba(0,0,0,0.18)",
                          borderRadius:6,
                          cursor: d.chart ? "pointer" : "default",
                          display:"flex",
                          flexDirection:"column" as const,
                          transition:"background 0.15s",
                          overflow:"hidden",
                          animation: d.borderAnim,
                          animationDelay: d.borderDelay,
                        }}
                      >
                        {/* Timestamp */}
                        <div style={{ fontFamily:CF2.INTER, fontSize:9, color:"rgba(255,255,255,0.28)", letterSpacing:"0.02em", marginBottom:4, textAlign:"right" as const }}>{d.timestamp}</div>
                        {/* Detection title — bright blue */}
                        <div style={{ fontFamily:CF2.INTER, fontSize:11, fontWeight:700, color:"rgba(180,215,255,0.95)", lineHeight:1.25, marginBottom:5, letterSpacing:"0.01em" }}>{d.title}</div>
                        {/* Detail lines */}
                        <div style={{ display:"flex", flexDirection:"column" as const, gap:2, flex:1, marginBottom:7 }}>
                          {d.lines.map((line, i) => (
                            <div key={i} style={{ fontFamily:CF2.INTER, fontSize:10.5, color:"rgba(255,255,255,0.6)", lineHeight:1.3, display:"flex", alignItems:"flex-start", gap:5 }}>
                              <span style={{ color:"rgba(255,255,255,0.25)", flexShrink:0, marginTop:1 }}>·</span>
                              <span>{line}</span>
                            </div>
                          ))}
                        </div>
                        {/* Badge + Arrow in same row */}
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:6 }}>
                          <div style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:4, border:`1px solid ${d.badgeBorder}`, background:d.badgeBg, flexShrink:0 }}>
                            {d.pulseDot && (
                              <span style={{ width:5, height:5, borderRadius:"50%", background:d.badgeColor, display:"inline-block", flexShrink:0, animation:"alertDot 2s ease-in-out infinite" }} />
                            )}
                            <span style={{ fontFamily:CF2.INTER, fontSize:9.5, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.06em", color:d.badgeColor }}>{d.badge}</span>
                          </div>
                          {(d as any).arrowLabel && (
                            <div style={{ fontFamily:CF2.INTER, fontSize:9.5, fontWeight:600, color:"rgba(180,215,255,0.5)", letterSpacing:"0.03em", display:"flex", alignItems:"center", gap:2, flexShrink:0 }}>
                              <span>{(d as any).arrowLabel}</span>
                              <span style={{ fontSize:9, opacity:0.75 }}>↗</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── 3. KPI TABLE ─────────────────────────────────────────────────────────── */}
          {(()=>{
            const isPos = annualNet >= 0;
            const sortedNet = [...netByMonth].sort((a,b)=>a-b);
            const medianNet = netByMonth.length % 2 === 1
              ? sortedNet[Math.floor(netByMonth.length/2)]
              : (sortedNet[netByMonth.length/2-1] + sortedNet[netByMonth.length/2]) / 2;
            const medianIsPos = medianNet >= 0;
            const surplusMonths = netByMonth.filter(v => v > 0).length;
            const paren = (n:number) => n < 0
              ? `($${Math.round(Math.abs(n)).toLocaleString()})`
              : `$${Math.round(n).toLocaleString()}`;
            const signedParen = (n:number) => n < 0
              ? `($${Math.round(Math.abs(n)).toLocaleString()})`
              : `+$${Math.round(n).toLocaleString()}`;
            const TABLE_KPIS: { label:string; value:string; valueColor:string; note:string; valueSub?:string }[] = [
              { label:"Monthly Burn",              value:paren(heroMonthlyBurn),                                          valueColor:"rgba(255,255,255,0.82)", note:"Avg monthly outflows" },
              { label:"Median Monthly Cash Flow",  value:signedParen(medianNet),                                          valueColor:medianIsPos?"rgba(255,255,255,0.82)":CF2.red,            note:"Median monthly net" },
              { label:"Income Coverage",           value:heroCoveragePct>999?"—":`${Math.round(heroCoveragePct)}%`,       valueColor:heroCoverageOk?CF2.green:CF2.red,                        note:"Income / expenses" },
              { label:"Months in Surplus",         value:`${surplusMonths} of 12`,                                        valueColor:surplusMonths>=8?CF2.green:surplusMonths>=5?CF2.amber:CF2.red, note:"Months with positive net CF" },
              { label:"Cash Flow Trough",          value:paren(heroTroughValue),                                          valueColor:CF2.amber,               note:"Cumulative low point",    valueSub:heroTroughLabel },
              { label:"Liquid Runway",             value:`${heroRunway.toFixed(1)} months`,                               valueColor:"rgba(255,255,255,0.82)", note:"Total liquid / burn rate" },
            ];
            return (
              <div style={{ display:"flex", gap:6, alignItems:"stretch" }}>
                {/* Left: Hero card — Annual Net Cash Flow */}
                <div style={{ background:CF2.card, border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"16px 20px", flexShrink:0, display:"flex", flexDirection:"column" as const, justifyContent:"center", gap:8, minWidth:200 }}>
                  <div style={{ fontFamily:CF2.INTER, fontSize:12, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.08em", color:"rgba(255,255,255,0.82)" }}>Annual Net Cash Flow</div>
                  <div style={{ fontFamily:CF2.INTER, fontSize:34, fontWeight:300, lineHeight:1, color:isPos?CF2.green:CF2.red, fontVariantNumeric:"tabular-nums" }}>{signedParen(annualNet)}</div>
                  <span style={{ fontFamily:CF2.INTER, fontSize:9, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.06em", padding:"3px 8px", borderRadius:4, alignSelf:"flex-start", background:isPos?"rgba(94,204,138,0.08)":"rgba(255,100,100,0.08)", border:`1px solid ${isPos?"rgba(94,204,138,0.2)":"rgba(255,100,100,0.2)"}`, color:isPos?CF2.green:CF2.red }}>
                    {isPos?"▲ Cash positive":"▼ Cash deficit"}
                  </span>
                </div>
                {/* Right: label+note | value | DIV | label+note | value */}
                <div style={{ flex:1, background:CF2.card, border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, overflow:"hidden" }}>
                  <table style={{ width:"100%", height:"100%", borderCollapse:"collapse" as const }}>
                    <tbody>
                      {[0,2,4].map(i=>(
                        <tr key={i} style={{ borderBottom: i<4 ? `1px solid ${CF2.divider}` : "none" }}>
                          {[TABLE_KPIS[i], TABLE_KPIS[i+1]].map((kpi, col)=>(
                            <React.Fragment key={kpi.label}>
                              {col===1 && <td style={{ width:1, borderLeft:`1px solid ${CF2.divider}` }}/>}
                              {/* Label + note cell */}
                              <td style={{ padding:"9px 6px 8px 14px", verticalAlign:"middle" }}>
                                <div style={{ fontFamily:CF2.INTER, fontSize:12, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.07em", color:"rgba(255,255,255,0.82)", marginBottom:3, whiteSpace:"nowrap" as const }}>{kpi.label}</div>
                                <div style={{ fontFamily:CF2.INTER, fontSize:10, color:"rgba(255,255,255,0.35)", lineHeight:1.3, whiteSpace:"nowrap" as const }}>{kpi.note}</div>
                              </td>
                              {/* Value cell — right-aligned, bigger number + optional sub-label */}
                              <td style={{ padding:"9px 16px 8px 4px", verticalAlign:"middle", textAlign:"right" as const, whiteSpace:"nowrap" as const }}>
                                <div style={{ fontFamily:CF2.INTER, fontSize:18, fontWeight:300, color:kpi.valueColor, fontVariantNumeric:"tabular-nums", lineHeight:1 }}>{kpi.value}</div>
                                {kpi.valueSub && <div style={{ fontFamily:CF2.INTER, fontSize:10, fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.12em", color:kpi.valueColor, opacity:0.7, marginTop:4 }}>{kpi.valueSub}</div>}
                              </td>
                            </React.Fragment>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ── 4b. MAIN LAYOUT: left charts column + right data column ─────────────── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1.15fr", gap:10, alignItems:"start" }}>
          {/* LEFT COLUMN: model button + Cumulative CF + Liquidity Runway */}
          <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>

            {/* ── 12-MONTH MODEL CARD ─────────────── */}
            <div
              onClick={() => setModelFullScreen(true)}
              className="model-bar"
              style={{ background:"linear-gradient(135deg,#1a3a6b 0%,#163060 60%,#0f2248 100%)", border:"1px solid rgba(91,143,204,0.28)", borderRadius:8, cursor:"pointer", userSelect:"none" as const, position:"relative", overflow:"hidden" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor="rgba(91,143,204,0.55)";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor="rgba(91,143,204,0.28)";}}
            >
              <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg,rgba(91,143,204,0.6),rgba(91,143,204,0.1) 60%,transparent)", pointerEvents:"none" }} />
              {/* Top row: icon + title + view cta */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px 8px 16px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:24, height:24, borderRadius:5, background:"rgba(91,143,204,0.15)", border:"1px solid rgba(91,143,204,0.25)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:13 }}>⊞</div>
                  <div style={{ fontFamily:CF2.INTER, fontSize:11, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.1em", color:"rgba(255,255,255,0.92)" }}>12-Month Cash Flow Model</div>
                </div>
                <span style={{ fontFamily:CF2.INTER, fontSize:10, fontWeight:600, color:"rgba(91,143,204,0.85)", textTransform:"uppercase" as const, letterSpacing:"0.06em", flexShrink:0 }}>Open →</span>
              </div>
              {/* Bottom row: 3 live stats */}
              <div style={{ display:"flex", gap:0, padding:"0 16px 10px 16px" }}>
                {[
                  { label:"Annual Income",   value:`$${Math.round(totalIn).toLocaleString()}`,  color:"rgba(94,204,138,0.9)" },
                  { label:"Annual Expenses",  value:`$${Math.round(totalOut).toLocaleString()}`, color:"rgba(255,255,255,0.5)" },
                  { label:"Net Cash Flow",    value:(annualNet>=0?"+":"")+`$${Math.round(Math.abs(annualNet)).toLocaleString()}`, color:annualNet>=0?CF2.green:CF2.red },
                ].map((s,i)=>(
                  <div key={i} style={{ flex:1, borderLeft: i>0 ? "1px solid rgba(91,143,204,0.2)" : "none", paddingLeft: i>0 ? 12 : 0 }}>
                    <div style={{ fontFamily:CF2.INTER, fontSize:8, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.08em", color:"rgba(180,210,255,0.4)", marginBottom:2 }}>{s.label}</div>
                    <div style={{ fontFamily:CF2.INTER, fontSize:13, fontWeight:300, color:s.color, fontVariantNumeric:"tabular-nums" }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart A: Cumulative Cash Flow */}
            <div id="chart-cf" className={`cf-chart-wrap${alertHighlight==="cf" ? " glow-cf" : ""}`} style={{ background:CF2.card, border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                <span style={{ fontFamily:CF2.INTER, fontSize:12, fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.1em", color:"rgba(255,255,255,0.88)" }}>Cumulative Cash Flow Forecast</span>
                <span style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:5, fontFamily:CF2.INTER, fontSize:10, color:CF2.txtMuted }}>
                  <span style={{ display:"inline-block", width:16, height:2, background:CF2.amber, borderRadius:1, verticalAlign:"middle" }} />
                  {heroTroughLabel} trough
                </span>
              </div>
              <div style={{ height:300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cumulChartData} margin={{ top:72, right:12, left:0, bottom:0 }}>
                    <defs>
                      {(()=>{
                        const zp = Math.round(cumulZeroFrac * 100);
                        // Horizontal stroke: green → red at trough → amber → green (recovery)
                        const firstNegIdx = cumulativeByMonth.findIndex(v => v < 0);
                        const negStartPct = firstNegIdx < 0 ? 100 : Math.round((firstNegIdx / (cumulChartData.length - 1)) * 100);
                        const troughXPct  = Math.round((troughIdx / (cumulChartData.length - 1)) * 100);
                        const midRecovPct = Math.round(troughXPct + (100 - troughXPct) * 0.45);
                        return (
                          <>
                            {/* Horizontal stroke: green start → red at trough → amber mid-recovery → green end */}
                            <linearGradient id="cfStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%"                  stopColor={CF2.green} stopOpacity={1} />
                              <stop offset={`${negStartPct}%`}   stopColor={CF2.green} stopOpacity={1} />
                              <stop offset={`${negStartPct+3}%`} stopColor={CF2.red}   stopOpacity={1} />
                              <stop offset={`${troughXPct}%`}    stopColor={CF2.red}   stopOpacity={1} />
                              <stop offset={`${midRecovPct}%`}   stopColor={CF2.amber} stopOpacity={1} />
                              <stop offset="100%"                stopColor={CF2.green} stopOpacity={1} />
                            </linearGradient>
                            {/* Vertical fill: vivid green above zero → deep rich red below */}
                            <linearGradient id="cfFillGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"                          stopColor={CF2.green} stopOpacity={0.28} />
                              <stop offset={`${Math.max(0,zp-5)}%`}      stopColor={CF2.green} stopOpacity={0.06} />
                              <stop offset={`${zp}%`}                    stopColor={CF2.red}   stopOpacity={0.08} />
                              <stop offset={`${Math.min(zp+30,100)}%`}   stopColor="#c0282a"   stopOpacity={0.45} />
                              <stop offset="100%"                        stopColor="#8b1a1c"   stopOpacity={0.70} />
                            </linearGradient>
                          </>
                        );
                      })()}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" tick={{ fontSize:10, fill:CF2.txtMuted, fontFamily:"Inter, system-ui, sans-serif", fontWeight:600 }} axisLine={{ stroke:"rgba(255,255,255,0.12)", strokeWidth:1 }} tickLine={false} />
                    <YAxis
                      domain={[cumulMin, cumulDomainMax]}
                      ticks={(() => {
                        const step = 25000;
                        const lo = Math.floor(cumulMin / step) * step;
                        const hi = Math.ceil(cumulDomainMax / step) * step;
                        const t: number[] = [];
                        for (let v = lo; v <= hi; v += step) t.push(v);
                        return t;
                      })()}
                      tick={{ fontSize:10, fill:CF2.txtDim, fontFamily:"Inter, system-ui, sans-serif" }}
                      tickFormatter={(v:number) => v === 0 ? "$0" : v < 0 ? `(${fmt(Math.abs(v))})` : fmt(v)}
                      axisLine={false} tickLine={false} width={72}
                    />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="value"
                      fill="url(#cfFillGrad)" fillOpacity={1}
                      stroke="url(#cfStrokeGrad)" strokeWidth={3}
                      dot={(p:any)=>{
                        const {cx,cy,index}=p;
                        const decIdx = cumulChartData.length - 1;
                        const decVal = cumulChartData[decIdx]?.value ?? 0;
                        if(index===troughIdx){
                          const lbl=`($${Math.round(Math.abs(heroTroughValue)).toLocaleString()})`;
                          const tw=Math.max(lbl.length*9+20, 110);
                          // clamp horizontally
                          const bx = Math.max(4, cx-tw/2);
                          // always draw annotation ABOVE the dot
                          return (
                            <g key="troughDot">
                              <circle cx={cx} cy={cy} r={6} fill={CF2.amber} stroke={CF2.bg} strokeWidth={2}/>
                              <line x1={cx} y1={cy-8} x2={cx} y2={cy-38} stroke="rgba(255,200,60,0.5)" strokeWidth={1.5} strokeDasharray="3 2"/>
                              <rect x={bx} y={cy-80} width={tw} height={40} rx={4} fill="rgba(8,18,34,0.97)" stroke="rgba(255,200,60,0.5)" strokeWidth={1.5}/>
                              <text x={bx+tw/2} y={cy-56} textAnchor="middle" fill={CF2.amber} fontSize={18} fontWeight="700" fontFamily="Inter, system-ui, sans-serif">{lbl}</text>
                              <text x={bx+tw/2} y={cy-43} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize={9} fontWeight="700" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.1em">NOV TROUGH</text>
                            </g>
                          );
                        }
                        return <g key={`e${index}`}/>;
                      }}
                      activeDot={{ r:5, fill:CF2.red, stroke:"white", strokeWidth:2 }}
                      isAnimationActive={false}
                    />
                    <RechartsTooltip
                      contentStyle={{ background:CF2.card, border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:12, fontFamily:CF2.INTER, padding:"8px 12px" }}
                      labelStyle={{ color:"rgba(255,255,255,0.88)", fontSize:12, fontWeight:600, marginBottom:4 }}
                      itemStyle={{ color:CF2.txtMuted, fontSize:11 }}
                      labelFormatter={(label:string) => label}
                      formatter={(v:number)=>[v<0?`($${Math.round(Math.abs(v)).toLocaleString()})`:`+$${Math.round(v).toLocaleString()}`,"Cumulative net cash flow"]}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart B: Liquidity Runway — stacked bar */}
            <div id="chart-liq" className={`cf-chart-wrap${alertHighlight==="liq" ? " glow-liq" : ""}`} style={{ background:CF2.card, border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                <span style={{ fontFamily:CF2.INTER, fontSize:12, fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.1em", color:"rgba(255,255,255,0.88)" }}>Liquidity Runway Forecast</span>
                <div style={{ marginLeft:"auto", display:"flex", gap:12 }}>
                  {([{c:"#5b8fcc",l:"Cash and treasuries balance"},{c:"rgba(94,204,138,0.5)",l:"Reserve floor"}] as const).map(({c,l})=>(
                    <span key={l} style={{ display:"flex", alignItems:"center", gap:4, fontFamily:CF2.INTER, fontSize:10, color:CF2.txtMuted }}>
                      <span style={{ width:8, height:8, borderRadius:2, background:c, display:"inline-block" }}/>
                      {l}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ height:220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {(()=>{
                    const liqData = balanceForecastData.map((d:any)=>({
                      label: d.label,
                      floor: RESERVE_FLOOR,
                      excess: Math.max(0, d.balance - RESERVE_FLOOR),
                      balance: d.balance,
                    }));
                    return (
                      <BarChart data={liqData} margin={{ top:44, right:10, left:0, bottom:0 }} barCategoryGap="8%">
                        <defs>
                          <linearGradient id="liqExcessGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="#5b8fcc" stopOpacity={0.85} />
                            <stop offset="100%" stopColor="#3a6090" stopOpacity={0.45} />
                          </linearGradient>
                          <linearGradient id="liqFloorGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="#5ecc8a" stopOpacity={0.32} />
                            <stop offset="100%" stopColor="#3a9e6a" stopOpacity={0.14} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="label" tick={{ fontSize:10, fill:CF2.txtMuted, fontFamily:"Inter, system-ui, sans-serif", fontWeight:600 }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize:10, fill:CF2.txtDim, fontFamily:"Inter, system-ui, sans-serif" }}
                          tickFormatter={(v:number)=>fmt(v)}
                          axisLine={false} tickLine={false} width={72}
                        />
                        <ReferenceLine y={RESERVE_FLOOR} stroke="rgba(94,204,138,0.45)" strokeDasharray="5 4" strokeWidth={1.5}
                          label={{ value:"$194,000 reserve floor", position:"insideTopRight", fill:"rgba(94,204,138,0.6)", fontSize:9, fontFamily:"Inter, system-ui, sans-serif", fontWeight:600 }}
                        />
                        <Bar dataKey="floor" stackId="liq" fill="url(#liqFloorGrad)" radius={[0,0,3,3]} isAnimationActive={false} activeBar={{ fill:"rgba(94,204,138,0.55)", stroke:"rgba(94,204,138,0.4)", strokeWidth:1 }} />
                        <Bar dataKey="excess" stackId="liq" fill="url(#liqExcessGrad)" radius={[3,3,0,0]} isAnimationActive={false} activeBar={{ fill:"#7aabdf", stroke:"rgba(122,171,223,0.4)", strokeWidth:1 }}>
                          <LabelList content={(props:any)=>{
                            const { x, y, width, index } = props;
                            const d = liqData[index];
                            if(!d) return null;
                            const minBal = Math.min(...liqData.map((r:any)=>r.balance));
                            if(d.balance !== minBal) return null;
                            const lbl = `$${Math.round(d.balance).toLocaleString()}`;
                            const tw2 = Math.max(lbl.length*9+16, 100);
                            const cx2 = x + width/2;
                            const bx2 = Math.max(4, cx2 - tw2/2);
                            return (
                              <g key="novLiq">
                                <line x1={cx2} y1={y-4} x2={cx2} y2={y-30} stroke="rgba(255,200,60,0.4)" strokeWidth={1.5} strokeDasharray="2 2"/>
                                <rect x={bx2} y={y-68} width={tw2} height={36} rx={4} fill="rgba(8,18,34,0.97)" stroke="rgba(255,200,60,0.45)" strokeWidth={1.5}/>
                                <text x={cx2} y={y-48} textAnchor="middle" fill="#ffc83c" fontSize={17} fontWeight="700" fontFamily="Inter, system-ui, sans-serif">{lbl}</text>
                                <text x={cx2} y={y-36} textAnchor="middle" fill="rgba(255,200,60,0.65)" fontSize={9} fontWeight="700" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.1em">NOV LOW</text>
                              </g>
                            );
                          }} />
                        </Bar>
                        <RechartsTooltip
                          cursor={false}
                          contentStyle={{ background:"#141c2b", border:"1px solid rgba(91,143,204,0.25)", borderRadius:6, fontSize:11, fontFamily:CF2.INTER, padding:"8px 12px", boxShadow:"0 4px 16px rgba(0,0,0,0.5)" }}
                          labelStyle={{ color:"rgba(255,255,255,0.55)", fontSize:9, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.08em" }}
                          itemStyle={{ color:"rgba(255,255,255,0.85)", fontSize:11, padding:"1px 0" }}
                          formatter={(v:number, name:string)=>{
                            if(name==="floor") return [`$${Math.round(v).toLocaleString()}`, "Reserve floor"];
                            if(name==="excess") return [`$${Math.round(v).toLocaleString()}`, "Cash & treasuries"];
                            return [v, name];
                          }}
                        />
                      </BarChart>
                    );
                  })()}
                </ResponsiveContainer>
              </div>
              {/* Reserve floor note */}
              <div style={{ padding:"8px 16px 10px", borderTop:"1px solid rgba(255,255,255,0.05)", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ display:"inline-block", width:16, height:1.5, background:"rgba(94,204,138,0.5)", borderRadius:1, flexShrink:0, borderTop:"1.5px dashed rgba(94,204,138,0.5)" }} />
                <span style={{ fontFamily:CF2.INTER, fontSize:10, color:CF2.txtDim, lineHeight:1.4 }}>
                  <strong style={{ color:"rgba(94,204,138,0.7)", fontWeight:600 }}>Reserve floor $194K</strong> — minimum liquidity target (3 months core expenses). Balance above this line is available for deployment.
                </span>
              </div>
            </div>

          {/* ── 5. CASH BALANCE WALK TABLE (below Liquidity Runway) ───────────────── */}
          {(()=>{
            const QROWS = [
              { key:"start",    label:"Start Balance",     fmt:(q:typeof qWalkData[0])=> fmtQK(q.start),      isTotal:false, isSep:false },
              { key:"inflow",   label:"Cash Inflow",       fmt:(q:typeof qWalkData[0])=>`+${fmtQK(q.inflow)}`, isTotal:false, isSep:false },
              { key:"core",     label:"Core Expenses",     fmt:(q:typeof qWalkData[0])=>`(${fmtQK(q.coreOut)})`, isTotal:false, isSep:false },
              { key:"onetime",  label:"One-Time Expenses", fmt:(q:typeof qWalkData[0])=>`(${fmtQK(q.oneTimeOut)})`, isTotal:false, isSep:true },
              { key:"end",      label:"End Balance",       fmt:(q:typeof qWalkData[0])=> fmtQK(q.end),        isTotal:true,  isSep:false },
            ];
            const TH:React.CSSProperties = { fontFamily:CF2.INTER, fontSize:11, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.08em", padding:"8px 14px", textAlign:"right" as const, color:"rgba(255,255,255,0.88)", borderLeft:"1px solid rgba(255,255,255,0.07)" };
            const TD:React.CSSProperties = { fontFamily:CF2.INTER, fontSize:12, fontVariantNumeric:"tabular-nums", padding:"7px 14px", textAlign:"right" as const, borderLeft:"1px solid rgba(255,255,255,0.07)", color:"rgba(255,255,255,0.82)" };
            const LBL:React.CSSProperties = { fontFamily:CF2.INTER, fontSize:12, padding:"7px 16px", color:CF2.txtMuted, whiteSpace:"nowrap" as const };
            return (
              <div style={{ background:CF2.card, border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, overflow:"hidden" }}>
                <div style={{ padding:"10px 16px 8px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                  <span style={{ fontFamily:CF2.INTER, fontSize:12, fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.1em", color:"rgba(255,255,255,0.88)" }}>Cash Balance Walk</span>
                </div>
                <table style={{ width:"100%", borderCollapse:"collapse" as const }}>
                  <thead>
                    <tr style={{ background:CF2.elevated }}>
                      <th style={{ fontFamily:CF2.INTER, fontSize:11, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.08em", padding:"8px 16px", textAlign:"left" as const, color:"rgba(255,255,255,0.4)", width:"160px" }}></th>
                      {qWalkData.map((q, qi) => (
                        <th key={q.key} style={{ ...TH, color: qi === troughQIdx ? CF2.amber : "rgba(255,255,255,0.88)" }}>
                          {q.label}{qi === troughQIdx ? " ⚠" : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {QROWS.map((row) => (
                      <tr key={row.key} style={{ borderTop: row.isSep ? "1px solid rgba(255,255,255,0.06)" : row.isTotal ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.04)", background: row.isTotal ? "rgba(255,255,255,0.03)" : "transparent" }}>
                        <td style={{ ...LBL, fontWeight: row.isTotal ? 700 : 400, color: row.isTotal ? "rgba(255,255,255,0.88)" : CF2.txtMuted }}>{row.label}</td>
                        {qWalkData.map((q, qi) => (
                          <td key={q.key} style={{ ...TD, fontWeight: row.isTotal ? 700 : 400, color: row.isTotal ? "rgba(255,255,255,0.92)" : qi === troughQIdx && row.key === "end" ? CF2.amber : "rgba(255,255,255,0.82)" }}>
                            {row.fmt(q)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          </div>{/* end left column */}

          {/* RIGHT COLUMN: Liquidity Position Card */}
          <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>

          {/* ── LIQUIDITY POSITION CARD ─────────────────────────────────────────────── */}
          {(()=>{
            const LIQ_TAX = 0.37;
            const liqYield = (lbl:string):number => {
              const d = lbl.toLowerCase();
              if (d.includes("treasury")||d.includes("t-bill")) return 4.85;
              if (d.includes("fidelity")&&d.includes("cd")) return 5.15;
              if (d.includes("fidelity")) return 5.10;
              if (d.includes("goldman")) return 4.65;
              if (d.includes("citizens")&&(d.includes("money market")||d.includes("mm"))) return 4.45;
              if (d.includes("citizens")&&d.includes("checking")) return 0.05;
              if (d.includes("chase")) return 0.01;
              if (d.includes("checking")) return 0.05;
              if (d.includes("savings")||d.includes("money market")) return 4.50;
              return 0.01;
            };
            const liqAT = (lbl:string):number => liqYield(lbl)*(1-LIQ_TAX);
            const liqSfx = (lbl:string):string => {
              const d = lbl.toLowerCase();
              if (d.includes("chase")) return "2680";
              if (d.includes("citizens")&&d.includes("checking")) return "3858";
              if (d.includes("citizens")&&(d.includes("money market")||d.includes("mm"))) return "4421";
              if (d.includes("goldman")) return "7710";
              if (d.includes("fidelity")&&d.includes("cd")) return "9031";
              if (d.includes("fidelity")) return "9031";
              if (d.includes("treasury")||d.includes("t-bill")) return "1142";
              return "····";
            };
            const wtd = (items:{label:string;value:number}[], fn:(s:string)=>number):number => {
              const tot = items.reduce((s,a)=>s+a.value,0);
              return tot ? items.reduce((s,a)=>s+a.value*fn(a.label),0)/tot : 0;
            };
            const allItems = [...reserveItems,...yieldItems,...tacticalItems];
            const blendY  = wtd(allItems,liqYield);
            const blendAT = wtd(allItems,liqAT);
            const BUCKETS = [
              { key:"op",    label:"Operating Cash", color:"#4a90d9", items:reserveItems,  total:reserve },
              { key:"res",   label:"Reserve",        color:"#e8a830", items:yieldItems,    total:yieldBucket },
              { key:"build", label:"Build",          color:"#2a9a5a", items:tacticalItems, total:tactical },
            ];
            // SVG donut — 2× size
            const CX=120,CY=120,R=92,SW=26, CIRC=2*Math.PI*R, GAP=3;
            let cumPct=0;
            return (
              <div style={{ background:CF2.card, border:`1px solid ${CF2.border}`, borderRadius:4, overflow:"hidden" }}>
                {/* Header */}
                <div style={{ padding:"10px 14px 8px", borderBottom:`1px solid ${CF2.divider}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontFamily:CF2.INTER, fontSize:13, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.08em", color:"rgba(255,255,255,0.88)" }}>Liquidity Position</span>
                  <span style={{ fontFamily:CF2.INTER, fontSize:11, color:CF2.txtDim }}>
                    ${totalLiquid.toLocaleString()} · {allItems.length} accounts
                  </span>
                </div>
                {/* Donut section — centered on top */}
                <div style={{ padding:"16px 14px 14px", borderBottom:`1px solid ${CF2.divider}`, display:"flex", alignItems:"center", justifyContent:"center", gap:24 }}>
                  <svg viewBox="0 0 240 240" width="240" height="240">
                    <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={SW}/>
                    {BUCKETS.map(seg=>{
                      const pct = totalLiquid>0?seg.total/totalLiquid:0;
                      const arcLen=Math.max(0,pct*CIRC-GAP);
                      const off=-(CIRC/4+cumPct*CIRC);
                      cumPct+=pct;
                      return <circle key={seg.key} cx={CX} cy={CY} r={R} fill="none" stroke={seg.color} strokeWidth={SW} strokeDasharray={`${arcLen} ${CIRC-arcLen}`} strokeDashoffset={off}/>;
                    })}
                    <text x={CX} y={CY-4} textAnchor="middle" fill="rgba(255,255,255,0.88)" fontSize={22} fontWeight={300} fontFamily="Inter,system-ui,sans-serif">${Math.round(totalLiquid).toLocaleString()}</text>
                    <text x={CX} y={CY+16} textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize={12} fontFamily="Inter,system-ui,sans-serif">Total liquid</text>
                  </svg>
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
                    {/* Bucket legend */}
                    {BUCKETS.filter(b=>b.total>0).map(b=>(
                      <div key={b.key} style={{ display:"flex", alignItems:"center", gap:7 }}>
                        <div style={{ width:8, height:8, borderRadius:2, background:b.color, flexShrink:0 }}/>
                        <span style={{ fontFamily:CF2.INTER, fontSize:10, color:CF2.txtDim, minWidth:85 }}>{b.label}</span>
                        <span style={{ fontFamily:CF2.INTER, fontSize:10, color:"rgba(255,255,255,0.65)", fontVariantNumeric:"tabular-nums" }}>${Math.round(b.total).toLocaleString()}</span>
                        <span style={{ fontFamily:CF2.INTER, fontSize:9, color:CF2.txtDim, marginLeft:2 }}>{totalLiquid>0?Math.round(b.total/totalLiquid*100):0}%</span>
                      </div>
                    ))}
                    {/* Blended yields */}
                    <div style={{ display:"flex", gap:16, marginTop:4 }}>
                      {[{label:"Blended Yield",val:blendY},{label:"After-Tax",val:blendAT}].map(({label,val})=>(
                        <div key={label}>
                          <div style={{ fontFamily:CF2.INTER, fontSize:8, fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.06em", color:CF2.txtDim, marginBottom:2 }}>{label}</div>
                          <div style={{ fontFamily:CF2.INTER, fontSize:13, fontWeight:500, color:"rgba(255,255,255,0.75)" }}>{val.toFixed(2)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Account table — compact, bucket-shaded rows, no subtotals */}
                <table style={{ width:"100%", borderCollapse:"collapse" as const, borderTop:`1px solid ${CF2.divider}` }}>
                  <thead>
                    <tr style={{ background:CF2.elevated }}>
                      {(["Account","Balance","Yield","AT Yield"] as const).map((h,i)=>(
                        <th key={h} style={{ fontFamily:CF2.INTER, fontSize:10, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.07em", padding:"5px 10px 5px"+(i===0?" 14px":" 10px"), textAlign:(i===0?"left":"right") as "left"|"right", color:"rgba(255,255,255,0.82)", borderLeft:i>0?`1px solid ${CF2.divider}`:"none" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {BUCKETS.map((bucket)=>{
                      if(!bucket.items.length) return null;
                      const rowBg  = `${bucket.color}0b`; // light tint for account rows
                      const subBg  = `${bucket.color}22`; // deeper tint for subtotal row
                      const bY = wtd(bucket.items, liqYield);
                      const bAT = wtd(bucket.items, liqAT);
                      return (
                        <React.Fragment key={bucket.key}>
                          {/* Account rows — light bucket tint, no header above */}
                          {bucket.items.map((acct,ai)=>(
                            <tr key={acct.label+ai} style={{ background:rowBg, borderTop:`1px solid rgba(255,255,255,0.035)` }}>
                              <td style={{ padding:"5px 10px 5px 18px", fontFamily:CF2.INTER, fontSize:11, color:"rgba(255,255,255,0.68)", whiteSpace:"nowrap" as const }}>
                                {acct.label}<span style={{ color:"rgba(255,255,255,0.22)", marginLeft:3 }}>···{liqSfx(acct.label)}</span>
                              </td>
                              <td style={{ padding:"5px 10px", fontFamily:CF2.INTER, fontSize:12, textAlign:"right" as const, color:"rgba(255,255,255,0.78)", fontVariantNumeric:"tabular-nums", borderLeft:`1px solid ${CF2.divider}` }}>${Math.round(acct.value).toLocaleString()}</td>
                              <td style={{ padding:"5px 10px", fontFamily:CF2.INTER, fontSize:11, textAlign:"right" as const, color:CF2.txtDim, borderLeft:`1px solid ${CF2.divider}` }}>{liqYield(acct.label).toFixed(2)}%</td>
                              <td style={{ padding:"5px 10px", fontFamily:CF2.INTER, fontSize:11, textAlign:"right" as const, color:CF2.txtDim, borderLeft:`1px solid ${CF2.divider}` }}>{liqAT(acct.label).toFixed(2)}%</td>
                            </tr>
                          ))}
                          {/* Subtotal row — deeper bucket shade, bucket label + total */}
                          <tr style={{ background:subBg, borderTop:`1px solid ${bucket.color}33` }}>
                            <td style={{ padding:"5px 10px 5px 14px", fontFamily:CF2.INTER, fontSize:10, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.09em", color:bucket.color, whiteSpace:"nowrap" as const }}>
                              <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
                                <span style={{ width:5, height:5, borderRadius:"50%", background:bucket.color, display:"inline-block", flexShrink:0 }}/>
                                {bucket.label}
                              </span>
                            </td>
                            <td style={{ padding:"5px 10px", fontFamily:CF2.INTER, fontSize:12, fontWeight:600, textAlign:"right" as const, color:bucket.color, fontVariantNumeric:"tabular-nums", borderLeft:`1px solid ${CF2.divider}` }}>${Math.round(bucket.total).toLocaleString()}</td>
                            <td style={{ padding:"5px 10px", fontFamily:CF2.INTER, fontSize:11, fontWeight:600, textAlign:"right" as const, color:bucket.color, opacity:0.75, borderLeft:`1px solid ${CF2.divider}` }}>{bY.toFixed(2)}%</td>
                            <td style={{ padding:"5px 10px", fontFamily:CF2.INTER, fontSize:11, fontWeight:600, textAlign:"right" as const, color:bucket.color, opacity:0.75, borderLeft:`1px solid ${CF2.divider}` }}>{bAT.toFixed(2)}%</td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                    {/* Grand total */}
                    <tr style={{ borderTop:`2px solid rgba(255,255,255,0.14)`, background:"rgba(255,255,255,0.04)" }}>
                      <td style={{ padding:"7px 10px 7px 14px", fontFamily:CF2.INTER, fontSize:11, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.08em", color:"rgba(255,255,255,0.88)" }}>Total Liquidity</td>
                      <td style={{ padding:"7px 10px", fontFamily:CF2.INTER, fontSize:12, fontWeight:700, textAlign:"right" as const, color:"rgba(255,255,255,0.92)", fontVariantNumeric:"tabular-nums", borderLeft:`1px solid ${CF2.divider}` }}>${Math.round(totalLiquid).toLocaleString()}</td>
                      <td style={{ padding:"7px 10px", fontFamily:CF2.INTER, fontSize:11, fontWeight:700, textAlign:"right" as const, color:CF2.txtMuted, borderLeft:`1px solid ${CF2.divider}` }}>{blendY.toFixed(2)}%</td>
                      <td style={{ padding:"7px 10px", fontFamily:CF2.INTER, fontSize:11, fontWeight:700, textAlign:"right" as const, color:CF2.txtMuted, borderLeft:`1px solid ${CF2.divider}` }}>{blendAT.toFixed(2)}%</td>
                    </tr>
                  </tbody>
                </table>
                {/* Footer */}
                <div style={{ padding:"7px 12px", borderTop:`1px solid ${CF2.divider}`, textAlign:"right" as const }}>
                  <span style={{ fontFamily:CF2.INTER, fontSize:11, color:"rgba(91,143,204,0.8)", cursor:"pointer" }} onClick={()=>setAlertHighlight("liq")}>Optimize in Allocation Tool →</span>
                </div>
              </div>
            );
          })()}

          {/* ── FULL-SCREEN MODEL PORTAL (renders to document.body) ──────────────── */}
          <div style={{ display:"none" }}>

            {modelFullScreen && (()=>{
              const moColDefs = CF_MONTHS.map((m,i)=>({ label:m.label, isAnn:false, isTrough:i===troughIdx, getV:(rv:number[])=>rv[i]??0, mi:i }));
              const qtrColDefs = [
                { label:"Q1",   isAnn:false, isTrough:false,          getV:(rv:number[])=>[0,1,2].reduce((s,j)=>s+(rv[j]??0),0), mi:-1 },
                { label:"Q2",   isAnn:false, isTrough:false,          getV:(rv:number[])=>[3,4,5].reduce((s,j)=>s+(rv[j]??0),0), mi:-1 },
                { label:"Q3",   isAnn:false, isTrough:troughQIdx===2, getV:(rv:number[])=>[6,7,8].reduce((s,j)=>s+(rv[j]??0),0), mi:-1 },
                { label:"Q4",   isAnn:false, isTrough:false,          getV:(rv:number[])=>[9,10,11].reduce((s,j)=>s+(rv[j]??0),0), mi:-1 },
                { label:"2026", isAnn:true,  isTrough:false,          getV:(rv:number[])=>rv.reduce((s,v)=>s+v,0), mi:-1 },
              ];
              const aCols = tableView==="mo" ? moColDefs : qtrColDefs;
              const nCols = aCols.length;
              const gridTpl = `200px repeat(${nCols}, minmax(72px, 1fr))`;

              const LBASE:React.CSSProperties = { fontFamily:CF2.INTER, fontSize:11, padding:"5px 8px 5px 18px", color:"rgba(255,255,255,0.65)", whiteSpace:"nowrap" as const, borderBottom:"1px solid rgba(42,74,110,0.25)", background:CF2.card, position:"sticky" as const, left:0, zIndex:2 };
              const VBASE:React.CSSProperties = { fontFamily:CF2.INTER, fontSize:11, padding:"5px 10px", textAlign:"right" as const, fontVariantNumeric:"tabular-nums", borderBottom:"1px solid rgba(42,74,110,0.25)", color:"rgba(255,255,255,0.72)", borderLeft:"1px solid rgba(42,74,110,0.12)", background:"transparent" };

              return createPortal(
                <div style={{ position:"fixed", inset:0, zIndex:9999, background:"#0d1520", display:"flex", flexDirection:"column" as const }}>
                  {/* Overlay close button and header */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.08)", flexShrink:0 }}>
                    <div style={{ fontFamily:CF2.INTER, fontSize:12, fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.1em", color:"rgba(255,255,255,0.9)" }}>12-Month Cash Flow Model</div>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ display:"flex", border:"1px solid rgba(42,74,110,0.5)", borderRadius:4, overflow:"hidden" }} onClick={(e)=>e.stopPropagation()}>
                        {(["mo","qtr"] as const).map(v=>(
                          <button key={v} onClick={()=>setTableView(v)} style={{ fontFamily:CF2.INTER, fontSize:9, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase" as const, padding:"4px 11px", border:"none", cursor:"pointer", background:tableView===v?"rgba(90,154,126,0.12)":"transparent", color:tableView===v?"hsl(152,45%,42%)":"rgba(255,255,255,0.72)", borderRight:v==="mo"?"1px solid rgba(42,74,110,0.4)":"none" }}>
                            {v==="mo"?"Monthly":"Quarterly"}
                          </button>
                        ))}
                      </div>
                      <button onClick={()=>{ setModelFullScreen(false); onCloseFullScreen?.(); }} style={{ fontFamily:CF2.INTER, fontSize:18, color:"rgba(255,255,255,0.6)", background:"none", border:"none", cursor:"pointer", padding:"0", width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                    </div>
                  </div>
                  {/* Scrollable table content */}
                  <div style={{ flex:1, overflowY:"auto" as const }}>
                    <div style={{ overflowX:"auto" as const }}>
                    <div style={{ display:"grid", gridTemplateColumns:gridTpl, position:"sticky", top:0, zIndex:4, background:CF2.elevated, borderBottom:"1px solid #2a4a6e", minWidth: tableView==="mo" ? 1000 : "auto" }}>
                      <div style={{ fontFamily:CF2.INTER, fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.75)", padding:"6px 8px 6px 14px", background:CF2.elevated, position:"sticky" as const, left:0, zIndex:5 }}>&nbsp;</div>
                      {aCols.map(col=>(
                        <div key={col.label} style={{ fontFamily:CF2.INTER, fontSize:10, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.08em", color:col.isAnn?CF2.gold:col.isTrough?"rgba(251,191,36,0.6)":"rgba(255,255,255,0.72)", padding:"6px 10px", textAlign:"right" as const, borderLeft:"1px solid rgba(42,74,110,0.3)" }}>{col.label}</div>
                      ))}
                    </div>
                    <div style={{ minWidth: tableView==="mo" ? 1000 : "auto" }}>
                      {CF_PL_ROWS.map((row) => {
                        if(row.kind==="group") return (
                          <div key={row.key} style={{ display:"grid", gridTemplateColumns:gridTpl }}>
                            <div style={{ gridColumn:`1 / ${nCols+2}`, padding:"10px 0 0", borderBottom:"none" }} />
                          </div>
                        );
                        const rowVals = vals[row.key] ?? [];
                        if(rowVals.every((v:number)=>v===0) && row.kind!=="total") return null;

                        if(row.kind==="subtotal" || (row.kind==="item" && row.renderAs==="subtotal")) {
                          return (
                            <div key={row.key} style={{ display:"grid", gridTemplateColumns:gridTpl, borderTop:"1px solid rgba(42,74,110,0.4)" }}>
                              <div style={{ ...LBASE, paddingLeft:14, fontSize:11, fontWeight:700, color:"hsl(152,45%,42%)", borderBottom:"none" }}>{row.label}</div>
                              {aCols.map((col,ci)=>(
                                <div key={ci} style={{ ...VBASE, fontWeight:600, color:"rgba(255,255,255,0.75)", borderBottom:"none" }}>
                                  {Math.abs(col.getV(rowVals))<1?"—":col.getV(rowVals)<0?`(${Math.round(Math.abs(col.getV(rowVals))).toLocaleString()})`:Math.round(col.getV(rowVals)).toLocaleString()}
                                </div>
                              ))}
                            </div>
                          );
                        }

                        if(row.kind==="item") {
                          return (
                            <div key={row.key} style={{ display:"grid", gridTemplateColumns:gridTpl }}>
                              <div style={LBASE}>{row.label}</div>
                              {aCols.map((col,ci)=>{
                                const v = col.getV(rowVals);
                                const spike = tableView==="mo" && col.mi>=0 && anomalyCell(rowVals, col.mi);
                                return (
                                  <div key={ci} style={{ ...VBASE, color:spike?"hsl(152,52%,55%)":Math.abs(v)<1?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.72)", background:spike?"rgba(90,154,126,0.04)":"transparent" }}>
                                    {spike && <span style={{ marginRight:4, fontSize:7 }}>●</span>}
                                    {Math.abs(v)<1?"—":v<0?`(${Math.round(Math.abs(v)).toLocaleString()})`:Math.round(v).toLocaleString()}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }

                        if(row.kind==="total") {
                          // Cumulative row — uses end-of-period snapshots, not sums
                          if(row.compute==="cumulative") {
                            const qEndSnaps = [
                              cumulativeByMonth[2],   // Q1 end
                              cumulativeByMonth[5],   // Q2 end
                              cumulativeByMonth[8],   // Q3 end
                              cumulativeByMonth[11],  // Q4 end
                              cumulativeByMonth[11],  // Annual = Q4 end
                            ];
                            return (
                              <React.Fragment key={row.key}>
                                <div style={{ display:"grid", gridTemplateColumns:gridTpl, background:"rgba(42,74,110,0.22)", borderTop:"1px solid rgba(58,100,160,0.45)" }}>
                                  <div style={{ fontFamily:CF2.INTER, fontSize:11, fontWeight:700, padding:"8px 8px 8px 14px", color:"rgba(180,215,255,0.95)", whiteSpace:"nowrap" as const, background:"rgba(42,74,110,0.22)", position:"sticky" as const, left:0, zIndex:2 }}>{row.label}</div>
                                  {aCols.map((col,ci)=>{
                                    const v = tableView==="mo"
                                      ? (cumulativeByMonth[col.mi] ?? 0)
                                      : (qEndSnaps[ci] ?? 0);
                                    const color = v < -1 ? CF2.red : v > 1 ? "rgba(160,200,255,0.85)" : "rgba(160,200,255,0.3)";
                                    return (
                                      <div key={ci} style={{ fontFamily:CF2.INTER, fontSize:11, fontWeight:700, padding:"8px 10px", textAlign:"right" as const, fontVariantNumeric:"tabular-nums", color, borderLeft:"1px solid rgba(58,100,160,0.18)" }}>
                                        {Math.abs(v)<1?"—":v<0?`($${Math.round(Math.abs(v)).toLocaleString()})`:`$${Math.round(v).toLocaleString()}`}
                                      </div>
                                    );
                                  })}
                                </div>
                              </React.Fragment>
                            );
                          }
                          {
                            const isAmberRow = row.accent === "amber";
                            const rowBg = isAmberRow ? "rgba(42,74,110,0.22)" : "rgba(90,154,126,0.08)";
                            const rowBorderT = isAmberRow ? "1px solid rgba(58,100,160,0.45)" : "1px solid rgba(90,154,126,0.2)";
                            const rowBorderB = isAmberRow ? "1px solid rgba(58,100,160,0.25)" : "1px solid rgba(90,154,126,0.1)";
                            const lbl = isAmberRow ? "rgba(180,215,255,0.95)" : "hsl(152,52%,55%)";
                            const val = isAmberRow ? "rgba(160,200,255,0.85)" : "hsl(152,52%,55%)";
                            const cellBorder = isAmberRow ? "1px solid rgba(58,100,160,0.18)" : "1px solid rgba(90,154,126,0.1)";
                            return (
                            <React.Fragment key={row.key}>
                              <div style={{ display:"grid", gridTemplateColumns:gridTpl, background:rowBg, borderTop:rowBorderT, borderBottom:rowBorderB }}>
                                <div style={{ fontFamily:CF2.INTER, fontSize:11, fontWeight:700, padding:"10px 8px 10px 14px", color:lbl, whiteSpace:"nowrap" as const, background:rowBg, position:"sticky" as const, left:0, zIndex:2 }}>{row.label}</div>
                                {aCols.map((col,ci)=>{
                                  const v = col.getV(rowVals);
                                  return (
                                    <div key={ci} style={{ fontFamily:CF2.INTER, fontSize:11, fontWeight:700, padding:"10px 10px", textAlign:"right" as const, fontVariantNumeric:"tabular-nums", color:val, borderLeft:cellBorder }}>
                                      {Math.abs(v)<1?"—":v<0?`($${Math.round(Math.abs(v)).toLocaleString()})`:`+$${Math.round(v).toLocaleString()}`}
                                    </div>
                                  );
                                })}
                              </div>
                            </React.Fragment>
                          );}
                        }
                        return null;
                      })}
                    </div>
                      <div style={{ padding:"10px 16px 14px", borderTop:"1px solid rgba(42,74,110,0.25)", display:"flex", alignItems:"flex-start", gap:8 }}>
                        <span style={{ width:5, height:5, borderRadius:"50%", background:CF2.gold, display:"inline-block", flexShrink:0, marginTop:4 }} />
                        <span style={{ fontFamily:CF2.SERIF, fontSize:12.5, color:"rgba(255,255,255,0.75)", lineHeight:1.5 }}>
                          Apr spike — <span style={{ color:CF2.gold }}>$57K</span> tuition + federal taxes concentrated in one month. Reserve draw recommended by March.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>,
                document.body
              );
            })()}

          </div>{/* end hidden portal wrapper */}

          </div>{/* end right column */}
          </div>{/* end main two-column grid */}

          <div style={{ height:24 }} />
        </div>
      </div>

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

  const AMBER = "#9a7b3c";

  const SVG_CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

  return (
    <div className="w-[16rem] flex-shrink-0 border-l border-r border-border bg-card flex flex-col">
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
                  <span className="serif-hero text-3xl font-normal tabular-nums leading-none text-foreground">
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
          <div className="rounded-lg px-3 py-2.5 flex items-start gap-2" style={{ background: "rgba(46,122,82,0.06)", border: "1px solid rgba(46,122,82,0.25)" }}>
            <span className="text-base leading-none mt-0.5" style={{ color: "#2e7a52" }}>✓</span>
            <div>
              <p className="text-[10px] font-semibold" style={{ color: "#2e7a52" }}>Transfer Executed</p>
              <p className="text-[9px] tabular-nums mt-0.5" style={{ color: "#2e7a52" }}>
                {fmtD(parsedAmt)} moved{" "}
                <span className="font-semibold">{fromAccount} → {toAccount}</span>
              </p>
              <p className="text-[9px] tabular-nums mt-0.5 font-semibold" style={{ color: AMBER }}>
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
              <div className="flex-1 rounded-lg px-3 py-2.5" style={{ border: "1px solid rgba(154,123,60,0.35)", background: "rgba(154,123,60,0.05)" }}>
                <p className="text-[8px] uppercase tracking-widest font-bold mb-1" style={{ color: AMBER }}>Target</p>
                <p className="font-black tabular-nums text-[13px]" style={{ color: AMBER }}>{fmtD(effTarget)}</p>
              </div>
            </div>
            <div className="rounded-lg px-3 py-2.5" style={{ border: "1px solid rgba(154,123,60,0.35)", background: "rgba(154,123,60,0.05)" }}>
              <p className="text-[8px] uppercase tracking-widest font-bold mb-1" style={{ color: AMBER }}>
                Transfer Amount
              </p>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[13px] font-black tabular-nums" style={{ color: AMBER }}>$</span>
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

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [allocations, setAllocations] = useState<Record<number, number>>({});
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
    <div className="w-[23rem] flex-shrink-0 flex flex-col border-l border-border bg-card">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
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
      <div className="flex-1 px-3 py-3 flex flex-col gap-2">
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
              <div className="w-full p-3 pb-2 text-left">
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border-2 transition-colors"
                    style={{
                      background: checked ? bgColor : "transparent",
                      borderColor: checked ? bgColor : "#94a3b8",
                    }}
                  >
                    {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {highestYieldIdx === i && (
                      <span className="inline-block text-[7px] font-semibold px-1.5 py-px rounded leading-none mb-1" style={{ background: "rgba(46,122,82,0.1)", color: "#2e7a52", border: "1px solid rgba(46,122,82,0.25)" }}>
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
                        className="w-14 text-right text-[12px] font-black tabular-nums rounded border px-1.5 py-1 focus:outline-none focus:ring-1 bg-background"
                        style={{ color: bgColor, borderColor: bgColor + "80" }}
                      />
                      <span className="text-[11px] font-bold" style={{ color: bgColor }}>%</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Yield metrics row — hidden for Grow bucket */}
              {bucketName !== "Grow" && (
                <div className="px-3 pb-2.5 flex items-center gap-3 ml-6">
                  <div>
                    <div className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Yield</div>
                    <div className="text-[10px] font-bold text-foreground tabular-nums">{p.grossYield}</div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Tax-Eff</div>
                    <div className="text-[10px] font-bold text-foreground tabular-nums">{p.atYield}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Pickup</div>
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
          <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ border: "1px solid rgba(154,123,60,0.35)", background: "rgba(154,123,60,0.06)" }}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#9a7b3c" }} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#9a7b3c" }}>Action Required</p>
              <p className="text-[9px] mt-0.5" style={{ color: "rgba(154,123,60,0.8)" }}>Select a product for the incoming transfer before confirming.</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setStaged(true)}
          disabled={selected.size === 0 || (multiSelect && !pctValid)}
          className="w-full py-2 rounded-lg text-xs font-black uppercase tracking-widest text-white transition-opacity disabled:opacity-30"
          style={{ background: hasPendingTransfer && !staged ? "#9a7b3c" : bgColor }}
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
  { key: "op",   label: "Operating Cash", color: "#2e5c8a", accent: "#a8c4e0", tag: "Checking + Savings" },
  { key: "res",  label: "Reserve",        color: "#8a6e2e", accent: "#d4b87a", tag: "JPMorgan 100% Treasury MMF" },
  { key: "bld",  label: "Build",          color: "#2e7a52", accent: "#7ac4a0", tag: "1yr Treasuries + 2028 Munis" },
  { key: "grw",  label: "Grow",           color: "#2e4e7a", accent: "#8aace0", tag: "Growth Equity ETFs" },
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
    bg: "#162843",    // deep institutional navy
    dark: "#0f1e33",
    accent: "#7aa7d4",
  },
  {
    name: "Reserve",
    tagline: "Active cash management for what's next",
    rule: "12 months of cash for anticipated outflow",
    bg: "#3a2710",    // deep warm gold — not orange
    dark: "#2a1c09",
    accent: "#c9a84c",
  },
  {
    name: "Build",
    tagline: "Disciplined saving for big goals on the horizon",
    rule: "Large expenditure in next 3 years",
    bg: "#0e3320",    // deep forest green
    dark: "#082516",
    accent: "#5ab88a",
  },
  {
    name: "Grow",
    tagline: "Long-term compounded investing",
    rule: "5 years + aggressive investment portfolio",
    bg: "#1e2d40",    // deep slate — not purple
    dark: "#151f2d",
    accent: "#7da3c8",
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
  // Grow: equities/PE use federal cap gains only (20%) → keep 80%
  // Private credit is interest income (ordinary) → keep 53%
  Grow: [
    {
      name: "S&P 500 / Total Market ETF (VOO/VTI)",
      institution: "Vanguard",
      type: "Index ETF",
      grossYield: "[7.5%]",
      atYield: "[6.0%]",
      pickup: "20% fed cap gains",
      isGuru: true,
    },
    {
      name: "MSCI World ETF (VT)",
      institution: "Vanguard",
      type: "Index ETF",
      grossYield: "[7.0%]",
      atYield: "[5.6%]",
      pickup: "Global diversification",
      isGuru: false,
    },
    {
      name: "PE Co-Investment",
      institution: "Advisor Sourced",
      type: "Private Equity",
      grossYield: "[15%+]",
      atYield: "[12.0%+]",
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
  liabilities,
  cashFlows,
  opsCashMonths,
  setOpsCashMonths,
  pendingTransfers,
  setPendingTransfers,
  bucketProductSelections,
  setBucketProductSelections,
}: {
  assets: Asset[];
  liabilities: Liability[];
  cashFlows: CashFlow[];
  opsCashMonths: number;
  setOpsCashMonths: (n: number) => void;
  pendingTransfers: { from: string; to: string; amount: number }[];
  setPendingTransfers: React.Dispatch<React.SetStateAction<{ from: string; to: string; amount: number }[]>>;
  bucketProductSelections: Record<string, Array<{ product: BucketProduct; alloc: number }>>;
  setBucketProductSelections: React.Dispatch<React.SetStateAction<Record<string, Array<{ product: BucketProduct; alloc: number }>>>>;
}) {

  // ── Three-step workflow state ──────────────────────────────────────────────
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [step3Analyzing, setStep3Analyzing] = useState(false);
  const [step3Visible, setStep3Visible] = useState(false);
  const [opMonthsLocal, setOpMonthsLocal] = useState(opsCashMonths);
  const [resMonthsLocal, setResMonthsLocal] = useState(12);
  const [selProd, setSelProd] = useState<Record<string, number>>({ excess: 0 });
  const [bucketDests, setBucketDests] = useState<Record<string, string>>({ "Operating Cash": "Grow", "Reserve": "Grow" });
  useEffect(() => {
    if (step2Done && !step3Analyzing && !step3Visible) {
      setStep3Analyzing(true);
      const t = setTimeout(() => { setStep3Analyzing(false); setStep3Visible(true); }, 1600);
      return () => clearTimeout(t);
    }
  }, [step2Done]);

  const { reserve, yieldBucket, tactical } = cashBuckets(assets);
  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);

  const moMapT: Record<string, number> = {};
  cashFlows.filter((c) => c.type === "outflow").forEach((c) => {
    const d = new Date(c.date as string);
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    moMapT[k] = (moMapT[k] ?? 0) + Number(c.amount);
  });
  const moValsT = Object.values(moMapT);
  const monthlyBurnT = moValsT.length ? Math.min(...moValsT) : 18056;
  const opCurrentT = reserve;
  const flowCurrentT = yieldBucket + tactical;
  const opCurrentMonthsT = monthlyBurnT > 0 ? opCurrentT / monthlyBurnT : 0;
  const resCurrentMonthsT = monthlyBurnT > 0 ? flowCurrentT / monthlyBurnT : 0;
  const opTargetAmtT = opMonthsLocal * monthlyBurnT;
  const resTargetAmtT = resMonthsLocal * monthlyBurnT;
  const opExcessT = Math.max(0, opCurrentT - opTargetAmtT);
  const resExcessT = Math.max(0, flowCurrentT - resTargetAmtT);
  const totalExcessT = opExcessT + resExcessT;
  const liquidCoverageT = opCurrentMonthsT + resCurrentMonthsT;
  const returnPickupT = Math.round(totalExcessT * 0.054);
  const excessProdsT = [
    { name: "Cresset Short Duration", risk: "Low risk", grossYield: "6.10%", atYield: "5.40%", annualIncome: Math.round(totalExcessT * 0.054), liquidity: "Daily liquidity · small NAV movement", rec: true },
    { name: "JPMorgan 100% Treasuries MMF", risk: "Zero risk", grossYield: "4.30%", atYield: "2.80%", annualIncome: Math.round(totalExcessT * 0.028), liquidity: "Same-day liquidity · stable NAV", rec: false },
    { name: "US Treasury Ladder 1–6 Month", risk: "Zero risk", grossYield: "4.22%", atYield: "2.74%", annualIncome: Math.round(totalExcessT * 0.0274), liquidity: "Holds to maturity · full capital return", rec: false },
  ];

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight">Allocation Tool</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Set coverage targets · GURU generates the recommended transfer schedule</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 border border-[rgba(94,204,138,0.35)] rounded-full px-3 py-1.5" style={{ background: "rgba(94,204,138,0.08)" }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#5ecc8a" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#5ecc8a" }} />
            </span>
            <span className="text-[10px] font-semibold tracking-wide" style={{ color: "#5ecc8a" }}>LIVE · 8S AGO</span>
          </div>
          <button className="px-4 py-1.5 rounded-full border border-[rgba(255,255,255,0.12)] text-[10px] font-semibold transition-colors" style={{ color: "rgba(255,255,255,0.75)", background: "#1e2838" }}>Present to Client</button>
          <button className="px-4 py-1.5 rounded-full text-[10px] font-bold text-white transition-colors hover:opacity-90" style={{ background: "#1a2433" }}>Execute All →</button>
        </div>
      </div>

      {/* ── GURU Insight Banner ── */}
      <div className="rounded-xl overflow-hidden border border-[rgba(255,255,255,0.08)]" style={{ background: "#1e2838" }}>
        <div className="flex">
          <div className="flex-1 px-7 py-6 min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#9a7b3c" }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#9a7b3c" }} />
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: "rgba(154,123,60,0.85)" }}>GURU Insight · Kessler Family</span>
            </div>
            <p className="font-display italic text-[1.35rem] text-white leading-snug mb-3" style={{ fontWeight: 400 }}>Compounding favors capital that stays invested.</p>
            <p className="text-[11.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              The Kessler Family had a strong year-end — bonuses landed in January. Their balance sheet is in excellent shape, but they're holding more liquidity than they need. At {liquidCoverageT.toFixed(1)} months of coverage against a {opMonthsLocal + resMonthsLocal}-month target, there's roughly <span style={{ color: "rgba(154,123,60,0.85)" }}>{fmt(totalExcessT)}</span> sitting above the threshold. <span className="italic">Now is the time to speak with them about right-sizing liquidity and putting that capital to work in Cresset's strategies.</span>
            </p>
          </div>
          <div className="w-px my-5 flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="flex flex-col justify-between py-6 px-7 flex-shrink-0 gap-4" style={{ minWidth: 210 }}>
            {[
              { label: "Total Assets", val: fmt(totalAssets), sub: "Full balance sheet", color: "rgba(255,255,255,0.9)" },
              { label: "Liquid Coverage", val: `${liquidCoverageT.toFixed(1)} months`, sub: `Target: ${opMonthsLocal + resMonthsLocal} months`, color: "#9a7b3c" },
              { label: "Excess Liquidity", val: fmt(totalExcessT), sub: "Above coverage threshold", color: "#9a7b3c" },
              { label: "Return Pickup / Year", val: `+${fmt(returnPickupT)}`, sub: "If deployed today", color: "#2e7a52" },
            ].map((m) => (
              <div key={m.label}>
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>{m.label}</p>
                <p className="text-[18px] font-bold tabular-nums leading-none" style={{ color: m.color }}>{m.val}</p>
                <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── STEP 1: Liquidity Policy ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 text-white" style={{ background: step1Done ? "#2e7a52" : "rgba(255,255,255,0.08)" }}>
              {step1Done ? "✓" : "1"}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground">Liquidity Policy</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground">Set coverage months for each bucket · GURU calculates excess</span>
            {step1Done && (
              <button onClick={() => { setStep1Done(false); setStep2Done(false); setStep3Analyzing(false); setStep3Visible(false); }} className="text-[10px] font-semibold px-3 py-1 rounded border border-border hover:bg-secondary transition-colors text-muted-foreground">Edit</button>
            )}
          </div>
        </div>

        {step1Done ? (
          <div className="flex items-start gap-3 px-5 py-4 rounded-xl" style={{ borderLeft: "3px solid #2e7a52", background: "rgba(46,122,82,0.04)", border: "1px solid hsl(220,16%,90%)", borderLeftColor: "#2e7a52", borderLeftWidth: 3 }}>
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#2e7a52" }} />
            <div>
              <p className="text-[11px] font-semibold text-foreground">Liquidity targets set</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Op Cash: {opMonthsLocal} mos · Reserve: {resMonthsLocal} mos · <span className="font-semibold" style={{ color: "#9a7b3c" }}>{fmt(totalExcessT)} excess capital identified</span></p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {([
                {
                  label: "Operating Cash",
                  tagline: "Cash for upcoming expenditures",
                  currentMonths: opCurrentMonthsT,
                  targetMonths: opMonthsLocal,
                  setTarget: setOpMonthsLocal,
                  current: opCurrentT,
                  targetAmt: opTargetAmtT,
                  excess: opExcessT,
                  accentColor: "#2e5c8a",
                  borderColor: "rgba(255,255,255,0.1)",
                  bg: "#1e2838",
                },
                {
                  label: "Reserve",
                  tagline: "Active cash management for what's next",
                  currentMonths: resCurrentMonthsT,
                  targetMonths: resMonthsLocal,
                  setTarget: setResMonthsLocal,
                  current: flowCurrentT,
                  targetAmt: resTargetAmtT,
                  excess: resExcessT,
                  accentColor: "#8a6e2e",
                  borderColor: "rgba(255,255,255,0.1)",
                  bg: "#1e2838",
                },
              ] as const).map((b) => {
                // Bar: current fills 100%, target line shows where target falls
                const isOver = b.currentMonths > b.targetMonths;
                const tgtLinePct = b.currentMonths > 0
                  ? Math.min((b.targetMonths / b.currentMonths) * 100, 100)
                  : 100;
                return (
                  <div key={b.label} className="rounded-xl border border-border p-5 space-y-4" style={{ background: "#1e2838", borderTop: `2px solid ${b.accentColor}` }}>
                    {/* Header */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: b.accentColor }}>{b.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 italic">{b.tagline}</p>
                    </div>

                    {/* Coverage bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Current: <span className="font-semibold text-foreground">{b.currentMonths.toFixed(1)} mos</span></span>
                        <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Target: <span className="font-semibold text-foreground">{b.targetMonths} mos</span></span>
                      </div>
                      <div className="relative rounded-full overflow-hidden" style={{ height: 6, background: isOver ? "rgba(154,123,60,0.18)" : "rgba(255,255,255,0.06)" }}>
                        <div className="absolute left-0 top-0 h-full" style={{ width: `${isOver ? tgtLinePct : 100}%`, background: b.accentColor, opacity: 0.85, borderRadius: isOver ? "3px 0 0 3px" : "3px" }} />
                        {isOver && (
                          <div className="absolute top-0 h-full w-[2px]" style={{ left: `${tgtLinePct}%`, background: "rgba(255,255,255,0.85)" }} />
                        )}
                      </div>
                      {/* Excess / deficit badge — single location, styled to pop */}
                      {isOver ? (
                        <div className="px-3 py-2 rounded-md" style={{ background: "rgba(154,123,60,0.12)", border: "1px solid rgba(154,123,60,0.3)" }}>
                          <div className="flex items-baseline gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: "rgba(154,123,60,0.7)" }}>Excess to Release</span>
                            <span className="text-[9px]" style={{ color: "rgba(154,123,60,0.5)" }}>{(b.currentMonths - b.targetMonths).toFixed(1)} mos above target</span>
                          </div>
                          <span className="text-[18px] font-bold tabular-nums leading-tight block mt-0.5" style={{ color: "#9a7b3c" }}>{fmt(b.excess)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md" style={{ background: "rgba(46,92,138,0.08)", border: "1px solid rgba(46,92,138,0.2)" }}>
                          <span className="text-[10px] font-bold tabular-nums" style={{ color: b.accentColor }}>{fmt(b.targetAmt - b.current)}</span>
                          <span className="text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: b.accentColor }}>to reach target · {(b.targetMonths - b.currentMonths).toFixed(1)} mos short</span>
                        </div>
                      )}
                    </div>

                    {/* Stepper — fit-content width, number field is directly editable */}
                    <div className="flex items-center rounded-lg border border-border overflow-hidden bg-white" style={{ width: "fit-content" }}>
                      <button onClick={() => b.setTarget(Math.max(1, b.targetMonths - 1))} className="flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors border-r border-border flex-shrink-0 text-[16px]" style={{ width: 34, height: 34 }}>−</button>
                      <div className="flex flex-col items-center justify-center" style={{ minWidth: 90, padding: "0 18px" }}>
                        <input
                          type="number"
                          min={1}
                          value={b.targetMonths}
                          onChange={(e) => b.setTarget(Math.max(1, parseInt(e.target.value) || 1))}
                          className="font-serif leading-none text-foreground text-center bg-transparent border-none outline-none appearance-none"
                          style={{ fontSize: 20, width: 54 }}
                        />
                        <span className="text-[10px] text-muted-foreground">mo target</span>
                      </div>
                      <button onClick={() => b.setTarget(b.targetMonths + 1)} className="flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors border-l border-border flex-shrink-0 text-[16px]" style={{ width: 34, height: 34 }}>+</button>
                    </div>

                    {/* Balances */}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1">Target Balance</p>
                        <p className="text-[17px] font-bold tabular-nums font-mono" style={{ color: b.accentColor }}>{fmt(b.targetAmt)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1">Current Balance</p>
                        <p className="text-[13px] font-semibold tabular-nums font-mono" style={{ color: isOver ? b.accentColor : "hsl(30,60%,42%)" }}>{fmt(b.current)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Step 1 footer */}
            <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl" style={{ background: "rgba(154,123,60,0.08)", border: "1px solid rgba(154,123,60,0.25)" }}>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: "#9a7b3c" }}>Total Excess Identified</p>
                  <p className="font-serif text-[22px] leading-none mt-0.5" style={{ color: "#9a7b3c" }}>{fmt(totalExcessT)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Ready to release into investment pool</p>
                </div>
              </div>
              <button onClick={() => setStep1Done(true)} className="flex-shrink-0 px-5 py-2.5 rounded-lg text-[11px] font-bold text-white transition-colors hover:opacity-90" style={{ background: "hsl(222,45%,14%)" }}>Set Liquidity Targets →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── STEP 2 & 3 ── */}
      {(() => {
        const totalExcess = totalExcessT;
        const opExcess = opExcessT;
        const resExcess = resExcessT;
        const opCurrentMonths = opCurrentMonthsT;
        const resCurrentMonths = resCurrentMonthsT;
        const excessProds = excessProdsT;
        return (
          <>

      {/* ── GURU Analysis: Step 1 → 2 ── */}
      {step1Done && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg" style={{ background: "rgba(154,123,60,0.05)", border: "1px solid rgba(154,123,60,0.18)" }}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#9a7b3c", opacity: 0.75 }} />
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] flex-shrink-0" style={{ color: "#9a7b3c" }}>GURU</span>
          <span className="text-muted-foreground/40 select-none px-0.5">·</span>
          <span className="text-[10px] italic text-muted-foreground">Liquidity targets established · <span className="font-semibold not-italic" style={{ color: "#9a7b3c" }}>{fmt(totalExcess)}</span> excess capital identified · {(opCurrentMonths + resCurrentMonths).toFixed(1)} mos total liquid coverage secured.</span>
        </div>
      )}

      {/* ── STEP 2: Capital Release ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid hsl(220,16%,90%)" }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 text-white" style={{ background: step2Done ? "#2e7a52" : step1Done ? "rgba(255,255,255,0.08)" : "hsl(220,14%,78%)" }}>{step2Done ? "✓" : "2"}</div>
          <span className={`text-[12px] font-semibold flex-1 ${step1Done ? "text-foreground" : "text-muted-foreground"}`}>Capital Release</span>
          {step2Done && (
            <button onClick={() => { setStep2Done(false); setStep3Analyzing(false); setStep3Visible(false); }} className="text-[10px] font-semibold px-3 py-1 rounded border border-border hover:bg-secondary transition-colors text-muted-foreground">Edit</button>
          )}
        </div>
        {!step1Done ? (
          <div className="px-5 py-3.5 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
            <span className="text-[11px] text-muted-foreground/60">Capital release plan generates after liquidity targets are set.</span>
          </div>
        ) : step2Done ? (
          <div className="flex items-start gap-3 px-5 py-3.5" style={{ borderLeft: "3px solid #2e7a52", background: "rgba(46,122,82,0.04)" }}>
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#2e7a52" }} />
            <div>
              <p className="text-[11px] font-semibold text-foreground">Capital release confirmed</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(totalExcess)} routing to {[...new Set(Object.values(bucketDests))].join(" & ")}</p>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid px-4 py-2 bg-secondary/40 border-b border-border text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground" style={{ gridTemplateColumns: "1fr 32px 160px 1fr" }}>
                <span>Source</span><span></span><span>Amount to Release</span><span>Destination</span>
              </div>
              {([
                { source: "Operating Cash", desc: opExcess > 0 ? `Chase Checking ·4821 · ${opCurrentMonths.toFixed(1)} mos coverage` : "At target — no release needed", amount: opExcess },
                { source: "Reserve", desc: resExcess > 0 ? `Citizens Bank ·7204 · ${resCurrentMonths.toFixed(1)} mos coverage` : "At target — no release needed", amount: resExcess },
              ] as const).map((row) => (
                <div key={row.source} className="grid items-center px-4 py-3 border-b border-border last:border-0" style={{ gridTemplateColumns: "1fr 32px 160px 1fr" }}>
                  <div>
                    <p className="text-[11px] font-semibold text-foreground">{row.source}</p>
                    <p className="text-[10px] text-muted-foreground">{row.desc}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                  <p className="text-[12px] font-bold tabular-nums" style={{ color: row.amount > 100 ? "#9a7b3c" : "hsl(220,14%,72%)" }}>{row.amount > 100 ? fmt(row.amount) : "—"}</p>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1.5">Route to</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(["Build", "Grow"] as const).map((dest) => {
                        const isSelected = bucketDests[row.source] === dest;
                        const destColor = dest === "Build" ? "#2a9a5a" : "#4a6fa5";
                        return (
                          <button
                            key={dest}
                            onClick={() => setBucketDests((prev) => ({ ...prev, [row.source]: dest }))}
                            className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all"
                            style={isSelected
                              ? { background: destColor, color: "#fff", border: `1px solid ${destColor}` }
                              : { background: "transparent", color: "hsl(220,14%,55%)", border: "1px solid hsl(220,16%,82%)" }
                            }
                          >
                            {dest}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/30 border-t border-border">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Total Capital to Deploy</span>
                <span className="text-[13px] font-bold tabular-nums" style={{ color: "#9a7b3c" }}>{fmt(totalExcess)}</span>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setStep2Done(true)} className="px-5 py-2.5 rounded-lg text-[11px] font-bold text-white transition-colors hover:opacity-90" style={{ background: "hsl(222,45%,14%)" }}>Find Best Allocation →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── GURU Analysis: Step 2 → 3 ── */}
      {step2Done && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg" style={{ background: "rgba(154,123,60,0.05)", border: "1px solid rgba(154,123,60,0.18)" }}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#9a7b3c", opacity: 0.75 }} />
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] flex-shrink-0" style={{ color: "#9a7b3c" }}>GURU</span>
          <span className="text-muted-foreground/40 select-none px-0.5">·</span>
          <span className="text-[10px] italic text-muted-foreground">Capital routing plan confirmed · <span className="font-semibold not-italic" style={{ color: "#9a7b3c" }}>{fmt(totalExcess)}</span> moving from {opExcess > 100 && resExcess > 100 ? "Operating Cash and Reserve" : opExcess > 100 ? "Operating Cash" : "Reserve"} into Investment Pool.</span>
        </div>
      )}

      {/* ── STEP 3: Product Allocation ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid hsl(220,16%,90%)" }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 text-white" style={{ background: step3Visible ? "#2e7a52" : step2Done ? "rgba(255,255,255,0.08)" : "hsl(220,14%,78%)" }}>{step3Visible ? "✓" : "3"}</div>
          <span className={`text-[12px] font-semibold flex-1 ${step2Done ? "text-foreground" : "text-muted-foreground"}`}>Product Allocation</span>
        </div>
        {!step2Done ? (
          <div className="px-5 py-3.5 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
            <span className="text-[11px] text-muted-foreground/60">GURU will identify optimal products once the capital release plan is confirmed.</span>
          </div>
        ) : step3Analyzing ? (
          <div className="px-5 py-4 flex items-center gap-3">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#9a7b3c", animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground italic">GURU is analyzing best products for tax-optimized yield…</span>
          </div>
        ) : step3Visible ? (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-[11px] font-semibold text-foreground">Best options for {fmt(totalExcess)} in excess capital</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Ranked by after-tax yield · optimized for 37% bracket</p>
            </div>

            {/* GURU Analysis: before product selection */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg" style={{ background: "rgba(154,123,60,0.05)", border: "1px solid rgba(154,123,60,0.18)" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#9a7b3c", opacity: 0.75 }} />
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] flex-shrink-0" style={{ color: "#9a7b3c" }}>GURU</span>
              <span className="text-muted-foreground/40 select-none px-0.5">·</span>
              <span className="text-[10px] italic text-muted-foreground">Based on market yields and your {opMonthsLocal + resMonthsLocal}-month liquidity policy, GURU recommends short-duration income strategies · <span className="font-semibold not-italic" style={{ color: "#9a7b3c" }}>{fmt(returnPickupT)}/yr</span> return pickup at optimal after-tax yield.</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {excessProds.map((p, i) => {
                const isSel = (selProd["excess"] ?? 0) === i;
                return (
                  <div key={p.name} onClick={() => setSelProd((s) => ({ ...s, excess: i }))} className="rounded-lg border cursor-pointer transition-all p-4 space-y-2.5" style={{ borderColor: isSel ? "#9a7b3c" : "rgba(255,255,255,0.08)", background: isSel ? "rgba(154,123,60,0.05)" : "#1a2433", boxShadow: isSel ? "0 0 0 1px rgba(154,123,60,0.25)" : undefined }}>
                    {p.rec && (
                      <div className="text-[8px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full w-fit" style={{ background: "rgba(154,123,60,0.12)", color: "#9a7b3c" }}>Recommended</div>
                    )}
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-[11px] font-semibold text-foreground leading-tight">{p.name}</p>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: p.risk === "Zero risk" ? "rgba(46,122,82,0.08)" : "rgba(46,92,138,0.08)", color: p.risk === "Zero risk" ? "#2e7a52" : "#2e5c8a" }}>{p.risk}</span>
                    </div>
                    <div>
                      <p className="text-[20px] font-bold tabular-nums leading-none" style={{ color: "#9a7b3c" }}>{p.atYield}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{p.grossYield} gross · AT yield</p>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <span className="text-[9px] text-muted-foreground">Annual Income</span>
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: "#2e7a52" }}>+{fmt(p.annualIncome)}/yr</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground">{p.liquidity}</p>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <button className="px-5 py-2.5 rounded-lg text-[11px] font-bold text-white transition-colors hover:opacity-90" style={{ background: "#2e7a52" }}>Confirm Allocation →</button>
            </div>
          </div>
        ) : null}
      </div>
          </>
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

  // CF2 design tokens (from CashFlowForecastView)
  const CF2 = {
    bg:       "#141c2b",
    card:     "#1e2838",
    elevated: "#1a2433",
    border:   "rgba(255,255,255,0.08)",
    divider:  "rgba(255,255,255,0.06)",
    txt:      "rgba(255,255,255,0.9)",
    txt2:     "rgba(255,255,255,0.85)",
    txtMuted: "rgba(255,255,255,0.6)",
    txtDim:   "rgba(255,255,255,0.5)",
    green:    "#5ecc8a",
    red:      "#ff6464",
    gold:     "#ffc83c",
    INTER:    "Inter, system-ui, sans-serif",
  };

  return (
    <div style={{ background: CF2.bg, borderRadius: 8, overflow: "hidden" }}>

      {tab === "bs" && (
        <div className="space-y-4" style={{ padding: "0" }}>
          {/* ── Page header — matches allocation/cashflow style ── */}
          <div style={{ padding: "18px 32px 0", display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 300, color: "rgba(255,255,255,0.88)", letterSpacing: "-0.01em", margin: 0, fontFamily: "Inter, system-ui, sans-serif" }}>Net Worth</h1>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", letterSpacing: "0.04em", fontFamily: "Inter, system-ui, sans-serif" }}>Kessler Family · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
          </div>
          {/* GURU DETECTIONS banner */}
          <div style={{ background: "#3a5580", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5ecc8a", display: "inline-block", flexShrink: 0, animation: "pulse 2s ease-in-out infinite" }} />
              <span style={{ fontFamily: CF2.INTER, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.9)" }}>GURU Detections</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
              <div>
                <p style={{ fontFamily: CF2.INTER, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Total Assets</p>
                <p style={{ fontFamily: "system-ui", fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.95)", fontVariantNumeric: "tabular-nums" as const }}>{fmt(totalAssets)}</p>
              </div>
              <div>
                <p style={{ fontFamily: CF2.INTER, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Total Liabilities</p>
                <p style={{ fontFamily: "system-ui", fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>{fmt(totalLiab)}</p>
              </div>
              <div>
                <p style={{ fontFamily: CF2.INTER, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Net Worth</p>
                <p style={{ fontFamily: "system-ui", fontSize: 18, fontWeight: 700, color: CF2.green }}>{fmt(netWorth)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4" style={{ padding: "0 20px 20px" }}>
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
              <div style={{ border: `1px solid ${CF2.border}`, borderRadius: "10px", overflow: "hidden", background: CF2.card }}>
                <div
                  className="grid"
                  style={{ gridTemplateColumns: "1fr 90px 56px 90px", background: CF2.elevated }}
                >
                  <div style={{ padding: "12px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: CF2.green }}>Net Worth</div>
                  <div style={{ padding: "12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "13px", fontWeight: 900, color: CF2.green }}>
                    {fmt(netWorth)}
                  </div>
                  <div style={{ padding: "12px" }} />
                  <div style={{ padding: "12px" }} />
                </div>
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
  const { totalLiquid: _abvTotalLiquid, yieldItems: _abvYieldItems } = cashBuckets(assets);
  const _abvForecast = buildForecast(cashFlows);
  const cashTroughBuffer = computeTrough(_abvForecast);
  const guruReserveTarget = cashTroughBuffer;
  // cashExcess uses the same formula as the GURU hero bar: totalLiquid − trough
  const cashExcess = Math.max(0, _abvTotalLiquid - cashTroughBuffer);
  // reserveItems = all non-checking cash (savings, MM, Fidelity Cash)
  const reserveItems = assets.filter(
    (a) => a.type === "cash" && !(a.description ?? "").toLowerCase().includes("checking"),
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
  const totalToDeploy = Math.round(cashExcess);

  // ── Yield calcs ──
  const _currentLiquidYield = 1.4;
  const _guruLiquidYield = 2.7;
  const liquidHero = _abvTotalLiquid;
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
        <p key="liq" className="font-serif">Congrats on a great end of year! Your December bonus has come in and created a meaningful liquidity surplus. We calculate you are holding up to {fmt(Math.max(0, _abvTotalLiquid - 194196))} in excess liquidity given your cash flow forecast for the next 12 months. The opportunity cost of leaving it in cash is real and could be up to $10,000 or more of after tax annual returns.</p>
      );
    if (checked.has("rebalance"))
      blocks.push(
        <div key="reb" className="space-y-1">
          <p className="font-serif font-semibold">Deploying liquidity:</p>
          <p className="font-serif">We suggest deploying this liquidity in the following ways to continue to rebalance your investment portfolio:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li className="font-serif">Increase large cap exposure by adding $310,000 into our CIO's flagship sector rotation fund which has beat the S&P 500 by 3% the last 10 years.</li>
            <li className="font-serif">Increase small cap exposure by adding $190,000 into a small cap mutual fund which has returned 8% the last 10 years.</li>
          </ol>
        </div>
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
      <p key="close1" className="font-serif">Happy to set up a quick call whenever works for you.</p>,
      <p key="close2" className="font-serif">As always, please don't hesitate to reach out with any questions.</p>,
      <p key="sig1" className="font-serif">Best,</p>,
      <p key="sig2" className="font-serif">Your Advisor</p>,
    );
    return <div className="space-y-3 leading-7">{blocks}</div>;
  };

  // ── Card header helper ──
  const CardCheckHeader = ({
    badge,
    badgeBg,
    badgeText,
    badgeBorder,
    priority,
    priorityBg,
    priorityText,
    priorityBorder,
    title,
    body,
  }: {
    badge: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    priority: string;
    priorityBg: string;
    priorityText: string;
    priorityBorder: string;
    title: React.ReactNode;
    body?: React.ReactNode;
  }) => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 4, textTransform: "uppercase" as const, letterSpacing: "0.07em", background: badgeBg, color: badgeText, border: `1px solid ${badgeBorder}` }}>
          {badge}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 4, textTransform: "uppercase" as const, letterSpacing: "0.07em", background: priorityBg, color: priorityText, border: `1px solid ${priorityBorder}`, whiteSpace: "nowrap" as const }}>
          {priority}
        </span>
      </div>
      <div style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif', fontSize: 20, fontWeight: 400, color: "#181816", lineHeight: 1.2, letterSpacing: "-0.01em", marginBottom: body ? 12 : 0 }}>
        {title}
      </div>
      {body && (
        <div style={{ fontSize: 14, fontWeight: 400, color: "#3a3a35", lineHeight: 1.7, marginTop: 8 }}>
          {body}
        </div>
      )}
    </div>
  );

  // ── Decision strip ──
  const DStrip = ({
    cardKey,
    approveLabel = "Approve",
    approveColor = "#1e4d30",
    onApprove,
  }: {
    cardKey: string;
    approveLabel?: string;
    approveColor?: string;
    onApprove?: () => void;
  }) => (
    <div style={{ borderTop: "1px solid #e6e5e0", padding: "14px 24px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={checked.has(cardKey)}
          onChange={() => toggle(cardKey)}
          style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#181816", flexShrink: 0 }}
        />
        <span style={{ fontSize: 13, fontWeight: 500, color: "#3a3a35", userSelect: "none" as const }}>
          Include in client email
        </span>
      </label>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "9px 20px", borderRadius: 8, border: "1px solid #d4d4cf", background: "#fff", color: "#3a3a35", cursor: "pointer" }}>
          Defer
        </button>
        <button
          style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "9px 24px", borderRadius: 8, border: "none", color: "#fff", cursor: "pointer", background: approveColor, letterSpacing: "0.02em" }}
          onClick={onApprove}
        >
          {approveLabel}
        </button>
      </div>
    </div>
  );

  // ── GURU Recommended Action strip (inside card body) ──
  const ActionStrip = ({
    action,
    urgencyText,
    urgencyColor,
    nowLabel,
    nowSubtext,
    nowSublabel,
    afterLabel,
    afterSubtext,
    afterSublabel,
    accentColor,
  }: {
    action: string;
    urgencyText: string;
    urgencyColor: string;
    nowLabel: string;
    nowSubtext?: string;
    nowSublabel?: string;
    afterLabel: string;
    afterSubtext?: string;
    afterSublabel?: string;
    accentColor: string;
  }) => (
    <div style={{ borderRadius: 8, border: "1px solid #e6e5e0", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", background: "#f8f8f6", borderBottom: "1px solid #e6e5e0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#9c9c93", marginBottom: 4 }}>GURU Recommended Action</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#181816", lineHeight: 1.3 }}>{action}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, paddingTop: 2 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: urgencyColor, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: urgencyColor, whiteSpace: "nowrap" as const }}>{urgencyText}</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 32px 1fr", alignItems: "center", background: "#fff" }}>
        <div style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#9c9c93", marginBottom: 5 }}>{nowSublabel ?? "NOW"}</div>
          <div style={{ fontSize: 17, fontWeight: 300, fontVariantNumeric: "tabular-nums", color: "#3a3a35", lineHeight: 1 }}>{nowLabel}</div>
          {nowSubtext && <div style={{ fontSize: 10, color: "#9c9c93", marginTop: 4 }}>{nowSubtext}</div>}
        </div>
        <div style={{ textAlign: "center" as const, fontSize: 16, color: "#9c9c93" }}>→</div>
        <div style={{ padding: "14px 16px", borderLeft: `1px solid ${accentColor}25`, background: `${accentColor}06` }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: accentColor, marginBottom: 5 }}>{afterSublabel ?? "AFTER GURU"}</div>
          <div style={{ fontSize: 17, fontWeight: 300, fontVariantNumeric: "tabular-nums", color: accentColor, lineHeight: 1 }}>{afterLabel}</div>
          {afterSubtext && <div style={{ fontSize: 10, color: "#9c9c93", marginTop: 4 }}>{afterSubtext}</div>}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#f5f4f0", minHeight: "100vh", padding: "36px 40px 72px" }}>
      {/* ── Page header — matches allocation tab style ── */}
      <div style={{ marginBottom: 28 }}>
        {/* Title row: big light font + subtitle + compose button */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 300, color: "#1a2e4a", letterSpacing: "-0.01em", margin: 0, lineHeight: 1 }}>Advisor Brief</h1>
            <span style={{ fontSize: 11, color: "rgba(0,0,0,0.40)", letterSpacing: "0.04em" }}>Kessler Family · {format(DEMO_NOW, "MMMM d, yyyy")}</span>
          </div>
          {/* Compose email button */}
          <button
            onClick={() => setShowEmail(true)}
            disabled={checked.size === 0}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: checked.size > 0 ? "pointer" : "not-allowed", background: checked.size > 0 ? "#181816" : "#d4d4cf", color: "#fff", letterSpacing: "0.02em", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            <Mail className="w-3.5 h-3.5" />
            Compose Email{checked.size > 0 ? ` (${checked.size})` : ""}
          </button>
        </div>
        {/* Status pills row */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 11px", borderRadius: 20, background: "#fdecea", color: "#be2a2c", border: "1px solid #f5a8a8" }}>1 urgent</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 11px", borderRadius: 20, background: "#e5f3ee", color: "#0d6b50", border: "1px solid #b4d9ce" }}>2 deploy</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 11px", borderRadius: 20, background: "#edf1fb", color: "#1b3f8a", border: "1px solid #b4c5f5" }}>1 cash update</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 11px", borderRadius: 20, background: "#fcf1e6", color: "#a55b00", border: "1px solid #f0ce97" }}>1 act before May 7</span>
          <span style={{ fontSize: 11, color: "#9c9c93", marginLeft: 4 }}>· <span style={{ fontFamily: "monospace" }}>{fmt(totalAssets, true)}</span> net worth</span>
        </div>
      </div>
      {/* ── Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>

        {/* ── Card 1: Year-End Bonus / Deployable Surplus ── */}
        {(() => {
          const demoAccts = [
            { name: "Citizens Private Banking Checking", num: "3438", balance: 107000, floor: 80000 },
            { name: "Citizens Private Bank Money Market", num: "1482", balance: 225000, floor: 51000 },
            { name: "Fidelity Cash Sweep / Money Market", num: "4976", balance: 368440, floor: 70000 },
          ];
          const totalHarvest = demoAccts.reduce((s, a) => s + (a.balance - a.floor), 0);
          const monthlyLoss = Math.round(totalHarvest * 0.0096 / 12 * 10) * 10; // ~$4,800/mo at blended loss
          return (
          <div style={{ background: "#ffffff", border: "1px solid #e6e5e0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ height: 3, background: "#1e4d30" }} />
            <div style={{ padding: "16px 20px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
              <CardCheckHeader
                badge="Liquidity"
                badgeBg="#e8f4f0"
                badgeText="#1e4d30"
                badgeBorder="#b4d9ce"
                priority="High Priority"
                priorityBg="#fdecea"
                priorityText="#be2a2c"
                priorityBorder="#f5a8a8"
                title="Year-End Bonus Has Created Deployable Surplus"
                body={`The January bonus pushed balances above the 3-month reserve floor on all three accounts. ${fmt(totalHarvest, true)} is sitting idle at a blended yield of 0.8% — earning ${fmt(Math.round(totalHarvest * 0.008))} a year when it should be earning ${fmt(Math.round(totalHarvest * 0.051))}.`}
              />

              {/* Large amount */}
              <div>
                <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 32, fontWeight: 400, fontVariantNumeric: "tabular-nums", color: "#1e4d30", lineHeight: 1, letterSpacing: "-0.02em" }}>{fmt(totalHarvest, true)}</div>
                <div style={{ fontSize: 13, color: "#9c9c93", marginTop: 4 }}>excess identified</div>
              </div>

              {/* Account table */}
              <div style={{ borderTop: "1px solid #e6e5e0", paddingTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#9c9c93", marginBottom: 10 }}>Where the excess cash is sitting</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {demoAccts.map((a) => (
                      <tr key={a.num} style={{ borderBottom: "1px solid #f0ede8" }}>
                        <td style={{ padding: "10px 0", fontSize: 13, color: "#181816" }}>
                          {a.name} <span style={{ color: "#9c9c93" }}>·· {a.num}</span>
                        </td>
                        <td style={{ padding: "10px 8px", fontSize: 11, color: "#9c9c93", textAlign: "right" as const, whiteSpace: "nowrap" as const }}>
                          balance {fmt(a.balance)} · floor {fmt(a.floor)}
                        </td>
                        <td style={{ padding: "10px 0", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#1e4d30", textAlign: "right" as const, whiteSpace: "nowrap" as const }}>
                          {fmt(a.balance - a.floor)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={2} style={{ padding: "10px 0", fontSize: 13, fontWeight: 700, color: "#181816", borderTop: "1px solid #d4d4cf" }}>Total excess</td>
                      <td style={{ padding: "10px 0", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#1e4d30", textAlign: "right" as const, borderTop: "1px solid #d4d4cf" }}>{fmt(totalHarvest)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Cash efficiency note */}
              <div style={{ fontSize: 12, color: "#2e6b47", background: "#f0f9f4", border: "1px solid #c3e0d0", borderRadius: 8, padding: "10px 14px", lineHeight: 1.6 }}>
                This is about cash efficiency — not taking on more risk. Reserves stay intact across all three accounts.
              </div>

              {/* Quote */}
              <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 14, fontStyle: "italic", color: "#68685f", lineHeight: 1.8, borderTop: "1px solid #e6e5e0", paddingTop: 16 }}>
                "Sweeping the excess into the Build and Grow allocation captures an additional {fmt(Math.round(totalHarvest * 0.051) - Math.round(totalHarvest * 0.008))} per year. Reserves remain intact across all three accounts — this is pure yield pickup with no liquidity cost."
              </div>

              {/* Action strip */}
              <ActionStrip
                action={`Sweep ${fmt(totalHarvest, true)} excess into GURU allocation`}
                urgencyText={`Urgent · ${fmt(monthlyLoss)}/mo cost of inaction`}
                urgencyColor="#be2a2c"
                nowLabel={fmt(totalHarvest)}
                nowSubtext="3 bank accounts · idle"
                afterLabel={fmt(totalHarvest)}
                afterSubtext="Build & Grow buckets"
                afterSublabel="AFTER GURU"
                accentColor="#1e4d30"
              />
            </div>
            <DStrip cardKey="liquidity" approveLabel="Approve" approveColor="#1e4d30" onApprove={() => onNavigate("guru")} />
          </div>
          );
        })()}

        {/* ── Card 2: Rebalance Portfolio ── */}
        {(() => {
          const totalDeploy = 499440;
          const positions = [
            { name: "CIO Flagship Sector Rotation Fund", amount: 199440, detail: "Reduces correlation to broad market · target yield 6.2% · underrepresented in current sleeve" },
            { name: "Small Cap Mutual Fund", amount: 150000, detail: "Increases exposure to high-growth segment · target yield 8.4% · consistent with moderate-aggressive profile" },
            { name: "Cresset Short Duration Bond Fund", amount: 150000, detail: "Anchors fixed income sleeve · target yield 5.4% · low duration risk ahead of potential Fed cut" },
          ];
          return (
          <div style={{ background: "#ffffff", border: "1px solid #e6e5e0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ height: 3, background: "#1a3a6b" }} />
            <div style={{ padding: "16px 20px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
              <CardCheckHeader
                badge="Investments"
                badgeBg="#e8eef8"
                badgeText="#1a3a6b"
                badgeBorder="#b4c5e8"
                priority="Medium Priority"
                priorityBg="#e8eef8"
                priorityText="#1a3a6b"
                priorityBorder="#b4c5e8"
                title={`Rebalance Portfolio — ${fmt(totalDeploy).replace('$', '')} to Deploy`}
                body={`With ${fmt(totalDeploy, true)} harvested, three positions put it to work within the moderate risk profile: the CIO Sector Rotation Fund, a Small Cap Mutual Fund, and the Cresset Short Duration Bond Fund.`}
              />

              {/* Large amount */}
              <div>
                <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 32, fontWeight: 400, fontVariantNumeric: "tabular-nums", color: "#1a3a6b", lineHeight: 1, letterSpacing: "-0.02em" }}>{fmt(totalDeploy, true)}</div>
                <div style={{ fontSize: 13, color: "#9c9c93", marginTop: 4 }}>to deploy across three positions</div>
              </div>

              {/* Ideas checklist */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#9c9c93", marginBottom: 12 }}>Ideas to Explore</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {positions.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 0", borderBottom: i < positions.length - 1 ? "1px solid #f0ede8" : "none" }}>
                      <div style={{ width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 2, border: "1.5px solid #d4d4cf", background: "#fff" }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#181816", lineHeight: 1.3 }}>{p.name} <span style={{ fontVariantNumeric: "tabular-nums" }}>— {fmt(p.amount)}</span></div>
                        <div style={{ fontSize: 12, color: "#9c9c93", marginTop: 3, lineHeight: 1.5 }}>{p.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quote */}
              <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 14, fontStyle: "italic", color: "#68685f", lineHeight: 1.8, borderTop: "1px solid #e6e5e0", paddingTop: 16 }}>
                "The sector rotation fund reduces correlation to the broad market, the small cap sleeve adds high-growth exposure, and short-duration fixed income anchors the position ahead of any rate movement. Each fills a gap in the current allocation."
              </div>
            </div>
            <DStrip cardKey="rebalance" approveLabel="Open GURU Allocation →" approveColor="#1a3a6b" onApprove={() => onNavigate("guru")} />
          </div>
          );
        })()}

        {/* ── Card 3: Lock In Rates / Fed Cut ── */}
        {(() => {
          const floatingAccts = [
            { name: "Citizens Private Bank Money Market", num: "1482", amount: 225000 },
            { name: "Fidelity Government MMF", num: "4976", amount: 875000 },
          ];
          const totalExposed = floatingAccts.reduce((s, a) => s + a.amount, 0);
          const daysToMay7 = Math.ceil((new Date(2026, 4, 7).getTime() - DEMO_NOW.getTime()) / 86400000);
          return (
          <div style={{ background: "#ffffff", border: "1px solid #e6e5e0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ height: 3, background: "#a07820" }} />
            <div style={{ padding: "16px 20px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
              <CardCheckHeader
                badge="Interest Rates"
                badgeBg="#fdf4e3"
                badgeText="#a07820"
                badgeBorder="#e8cc88"
                priority="Act Before May 7"
                priorityBg="#fdf4e3"
                priorityText="#a07820"
                priorityBorder="#e8cc88"
                title="Lock In Rates Before the Fed Cuts — Money Markets Will Float Down"
                body={`The Fed is expected to cut on May 7. Money market funds reprice immediately — the Kesslers hold ${fmt(totalExposed)} across two floating MM positions. A 25bp cut costs ${fmt(Math.round(totalExposed * 0.0025))} per year. The window to lock in 5.2% closes when the cut lands.`}
              />

              {/* Large amount */}
              <div>
                <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 32, fontWeight: 400, fontVariantNumeric: "tabular-nums", color: "#a07820", lineHeight: 1, letterSpacing: "-0.02em" }}>{fmt(totalExposed)}</div>
                <div style={{ fontSize: 13, color: "#9c9c93", marginTop: 4 }}>exposed to rate cut repricing</div>
              </div>

              {/* Account table */}
              <div style={{ borderTop: "1px solid #e6e5e0", paddingTop: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {floatingAccts.map((a) => (
                      <tr key={a.num} style={{ borderBottom: "1px solid #f0ede8" }}>
                        <td style={{ padding: "10px 0", fontSize: 13, color: "#181816" }}>
                          {a.name} <span style={{ color: "#9c9c93" }}>·· {a.num}</span>
                        </td>
                        <td style={{ padding: "10px 8px", fontSize: 11, color: "#9c9c93", textAlign: "right" as const }}>floating · reprices at cut</td>
                        <td style={{ padding: "10px 0", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#a07820", textAlign: "right" as const }}>{fmt(a.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Quote */}
              <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 14, fontStyle: "italic", color: "#68685f", lineHeight: 1.8, borderTop: "1px solid #e6e5e0", paddingTop: 16 }}>
                "Rotating into 6-month T-bills before May 7 locks in 5.2% through October — regardless of what the Fed does. The position remains semi-liquid and rolls back into the MM or extends further depending on the rate path in Q4."
              </div>

              {/* Action strip */}
              <ActionStrip
                action={`Rotate ${fmt(totalExposed)} from money market → 6-mo T-bills before May 7`}
                urgencyText={`Act before May 7 · ${daysToMay7} days`}
                urgencyColor="#a07820"
                nowLabel={fmt(totalExposed)}
                nowSubtext="Money market funds"
                nowSublabel="NOW · FLOATING"
                afterLabel={fmt(totalExposed)}
                afterSubtext="6-mo T-bills · matures Oct"
                afterSublabel="AFTER GURU · LOCKED"
                accentColor="#a07820"
              />
            </div>
            <DStrip cardKey="yield" approveLabel="Approve" approveColor="#a07820" onApprove={() => onNavigate("guru")} />
          </div>
          );
        })()}

        {/* ── Card 4: Account Cash Movements ── */}
        {(() => {
          return (
            <div
              style={{ background: "#ffffff", border: "1px solid #e6e5e0", borderRadius: 12, overflow: "hidden" }}
              data-testid="advisor-brief-money-flow-card"
            >
              <div style={{ height: 3, background: "#1d4ed8" }} />
              {/* Card header */}
              <div style={{ padding: "16px 20px 14px" }}>
                <CardCheckHeader
                  badge="Cash Movement"
                  badgeBg="#e8eef8"
                  badgeText="#1d4ed8"
                  badgeBorder="#b4c5e8"
                  priority="Monthly Update"
                  priorityBg="#f0f0eb"
                  priorityText="#68685f"
                  priorityBorder="#d4d4cf"
                  title="March Money Movement — Where Every Dollar Sits"
                  body="March ran net positive — $42,500 in, $24,260 out, $18,240 surplus routed to Reserve. The cash architecture is working as modelled. One item is open: a $85,000 wire to Fidelity due March 20."
                />
              </div>
              {/* ── Bucket tables ── */}
              <div style={{ padding: "20px 24px", background: "#fafaf8" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

                  {/* ── Operating Cash row ── */}
                  <div style={{ display: "flex", alignItems: "stretch", gap: 12 }} data-testid="flow-col-ops">
                    <div style={{ width: 144, flexShrink: 0, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "16px 8px", background: "#1d4ed8" }}>
                      <Wallet style={{ width: 14, height: 14, color: "rgba(255,255,255,0.8)" }} />
                      <span style={{ fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#fff", textAlign: "center", fontSize: 11 }}>Operating Cash</span>
                      <span style={{ fontWeight: 900, fontVariantNumeric: "tabular-nums", color: "rgba(255,255,255,0.9)", fontSize: 10 }}>$90,879</span>
                    </div>
                    <div style={{ border: "1px solid #bfcfef", borderRadius: 8, overflow: "hidden", flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "rgba(29,78,216,0.04)" }} data-testid="flow-row-ops-jan">
                        <div style={{ minWidth: 0, marginRight: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#1d4ed8", lineHeight: 1.3 }}>CIT Money Market Bank Account</div>
                          <div style={{ fontSize: 9, color: "#4a6aaa", marginTop: 2 }}>Primary operating · Jan ending</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 900, color: "#1d4ed8", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>$90,879</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Flow connector 2: JPMorgan → CIT ($46,739) ── */}
                  <div style={{ display: "flex", alignItems: "center", minHeight: 44, paddingLeft: "calc(144px + 12px)" }}>
                    <div className="group" style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, cursor: "default", marginLeft: 40 }}>
                      <svg width="14" height="44" style={{ flexShrink: 0, overflow: "visible" }}>
                        <path d="M 7,42 L 7,2" stroke="#1d4ed8" strokeWidth="1.5" strokeDasharray="4,2.5" fill="none" />
                        <polygon points="0,-5 4.5,3 -4.5,3" fill="#1d4ed8" opacity="0.95">
                          <animateMotion dur="1.9s" repeatCount="indefinite" calcMode="linear" path="M 7,42 L 7,2" />
                        </polygon>
                      </svg>
                      <span style={{ fontSize: 10, fontWeight: 900, color: "#1d4ed8", background: "#eef2fd", border: "1px solid #bfcfef", padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                        ↑ $46,739 · JPMorgan → CIT
                      </span>
                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col z-50 pointer-events-none">
                        <div style={{ background: "#1a1a18", color: "#fff", fontSize: 9, fontWeight: 500, borderRadius: 8, padding: "8px 12px", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", lineHeight: 1.6, maxWidth: 260 }}>
                          Autodraw from JPMorgan 100% Treasuries MMF into CIT operating account — building 2 months of forward cash expenses
                        </div>
                        <div style={{ width: 8, height: 8, background: "#1a1a18", transform: "rotate(45deg)", marginLeft: 16, marginTop: -4, flexShrink: 0 }} />
                      </div>
                    </div>
                  </div>

                  {/* ── Reserve row ── */}
                  <div style={{ display: "flex", alignItems: "stretch", gap: 12 }} data-testid="flow-col-reserve">
                    <div style={{ width: 144, flexShrink: 0, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "16px 8px", background: "#d97706" }}>
                      <ShieldCheck style={{ width: 14, height: 14, color: "rgba(255,255,255,0.8)" }} />
                      <span style={{ fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#fff", textAlign: "center", fontSize: 11 }}>Reserve</span>
                      <span style={{ fontWeight: 900, fontVariantNumeric: "tabular-nums", color: "rgba(255,255,255,0.9)", fontSize: 10 }}>$129,385</span>
                    </div>
                    {/* Branch connector */}
                    <div style={{ flexShrink: 0, position: "relative", width: 28, alignSelf: "stretch" }}>
                      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} viewBox="0 0 28 100" preserveAspectRatio="none">
                        <line x1="0" y1="50" x2="14" y2="50" stroke="rgba(217,119,6,0.45)" strokeWidth="1.5" />
                        <line x1="14" y1="25" x2="14" y2="75" stroke="rgba(217,119,6,0.45)" strokeWidth="1.5" />
                        <line x1="14" y1="25" x2="28" y2="25" stroke="rgba(217,119,6,0.45)" strokeWidth="1.5" />
                        <line x1="14" y1="75" x2="28" y2="75" stroke="rgba(217,119,6,0.45)" strokeWidth="1.5" />
                      </svg>
                    </div>
                    {/* Stacked sub-account cards */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
                      <div style={{ border: "1px solid #fde68a", borderRadius: 8, overflow: "hidden" }} data-testid="flow-row-reserve-jpm">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "rgba(255,251,235,0.6)" }}>
                          <div style={{ minWidth: 0, marginRight: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#78350f", lineHeight: 1.3 }}>JPMorgan 100% Treasuries Money Market Fund</div>
                            <div style={{ fontSize: 9, color: "#d97706", marginTop: 2 }}>Autodraw to Operating</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 900, color: "#b45309", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>$27,927</span>
                        </div>
                      </div>

                      {/* Flow connector: T-Bill → JPMorgan */}
                      <div className="group" style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, cursor: "default", padding: "4px 12px" }}>
                        <svg width="14" height="32" style={{ flexShrink: 0, overflow: "visible" }}>
                          <path d="M 7,30 L 7,2" stroke="#d97706" strokeWidth="1.5" strokeDasharray="4,2.5" fill="none" />
                          <polygon points="0,-4 4,3 -4,3" fill="#f59e0b" opacity="0.95">
                            <animateMotion dur="1.5s" repeatCount="indefinite" calcMode="linear" path="M 7,30 L 7,2" />
                          </polygon>
                        </svg>
                        <span style={{ fontSize: 10, fontWeight: 900, color: "#b45309", background: "#fffbeb", border: "1px solid #fcd34d", padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                          ↑ $7,478 · T-Bill → JPMorgan
                        </span>
                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col z-50 pointer-events-none">
                          <div style={{ background: "#1a1a18", color: "#fff", fontSize: 9, fontWeight: 500, borderRadius: 8, padding: "8px 12px", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", lineHeight: 1.6, maxWidth: 260 }}>
                            1-month T-Bill maturing in January — proceeds roll directly into JPMorgan 100% Treasuries MMF
                          </div>
                          <div style={{ width: 8, height: 8, background: "#1a1a18", transform: "rotate(45deg)", marginLeft: 16, marginTop: -4, flexShrink: 0 }} />
                        </div>
                      </div>

                      <div style={{ border: "1px solid #fde68a", borderRadius: 8, overflow: "hidden" }} data-testid="flow-row-reserve-tbill">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "rgba(255,251,235,0.6)" }}>
                          <div style={{ minWidth: 0, marginRight: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#78350f", lineHeight: 1.3 }}>T-Bill Ladder</div>
                            <div style={{ fontSize: 9, color: "#d97706", marginTop: 2 }}>3-Mo / 6-Mo / 9-Mo · +$7,478 Maturing</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 900, color: "#b45309", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>$101,458</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Gap ── */}
                  <div style={{ height: 12 }} />

                  {/* ── Build row ── */}
                  <div style={{ display: "flex", alignItems: "stretch", gap: 12 }} data-testid="flow-col-build">
                    <div style={{ width: 144, flexShrink: 0, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "16px 8px", background: "#16a34a" }}>
                      <Home style={{ width: 14, height: 14, color: "rgba(255,255,255,0.8)" }} />
                      <span style={{ fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#fff", textAlign: "center", fontSize: 12 }}>Build</span>
                      <span style={{ fontWeight: 900, fontVariantNumeric: "tabular-nums", color: "rgba(255,255,255,0.9)", fontSize: 10 }}>$226,545</span>
                    </div>
                    {/* Branch connector */}
                    <div style={{ flexShrink: 0, position: "relative", width: 28, alignSelf: "stretch" }}>
                      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} viewBox="0 0 28 100" preserveAspectRatio="none">
                        <line x1="0" y1="50" x2="14" y2="50" stroke="rgba(22,163,74,0.45)" strokeWidth="1.5" />
                        <line x1="14" y1="25" x2="14" y2="75" stroke="rgba(22,163,74,0.45)" strokeWidth="1.5" />
                        <line x1="14" y1="25" x2="28" y2="25" stroke="rgba(22,163,74,0.45)" strokeWidth="1.5" />
                        <line x1="14" y1="75" x2="28" y2="75" stroke="rgba(22,163,74,0.45)" strokeWidth="1.5" />
                      </svg>
                    </div>
                    {/* Stacked sub-account cards */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ border: "1px solid #bbf7d0", borderRadius: 8, overflow: "hidden" }} data-testid="flow-row-build-munis">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "rgba(240,253,244,0.6)" }}>
                          <div style={{ minWidth: 0, marginRight: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#14532d", lineHeight: 1.3 }}>2028 Municipal Bonds</div>
                            <div style={{ fontSize: 9, color: "#16a34a", marginTop: 2 }}>Tax-advantaged income</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 900, color: "#15803d", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>$32,161</span>
                        </div>
                      </div>
                      <div style={{ border: "1px solid #bbf7d0", borderRadius: 8, overflow: "hidden" }} data-testid="flow-row-build-tbill">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "rgba(240,253,244,0.6)" }}>
                          <div style={{ minWidth: 0, marginRight: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#14532d", lineHeight: 1.3 }}>S&amp;P Low Volatility Index</div>
                            <div style={{ fontSize: 9, color: "#16a34a", marginTop: 2 }}>Short-duration ladder</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 900, color: "#15803d", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>$194,384</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
              {/* Quote */}
              <div style={{ padding: "0 24px 20px", fontFamily: '"Playfair Display", Georgia, serif', fontSize: 14, fontStyle: "italic", color: "#68685f", lineHeight: 1.8 }}>
                "The Fidelity wire is routine margin settlement — it does not affect the liquidity harvest or deployment plan above. Once initiated, March is closed and the household is on track with the 12-month cash flow forecast."
              </div>
              <DStrip cardKey="cashflow" approveLabel="Initiate Wire" approveColor="#1d4ed8" onApprove={() => onNavigate("moneymovement")} />
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

          const fieldStyle: React.CSSProperties = { width: "100%", borderRadius: 8, border: "1px solid #e6e5e0", background: "#fff", padding: "9px 12px", fontSize: 12, color: "#181816", outline: "none", fontFamily: "inherit" };
          const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#9c9c93", display: "block", marginBottom: 5 };

          return (
          <div style={{ background: "#ffffff", border: "1px solid #e6e5e0", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ height: 4, background: "#7c3aed" }} />

            {/* Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e6e5e0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.05em", background: "#7c3aed1a", color: "#7c3aed", border: "1px solid #7c3aed40" }}>Payments</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.05em", background: "#fdecea", color: "#be2a2c", border: "1px solid #f5a8a8" }}>Urgent</span>
                </div>
                <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 22, fontWeight: 400, color: "#181816", marginBottom: 2 }}>Approve Autobill Pay</div>
                <div style={{ fontSize: 13, fontWeight: 300, color: "#68685f" }}>Schedule payments directly from your connected accounts</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#7c3aed", lineHeight: 1 }}>{fmt(totalPending)}</div>
                  <div style={{ fontSize: 9, color: "#9c9c93", marginTop: 2 }}>total pending</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 20, padding: "4px 10px" }}>
                  <Lock style={{ width: 11, height: 11, color: "#4f46e5" }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#4338ca", textTransform: "uppercase", letterSpacing: "0.06em" }}>GURU Payments Active</span>
                </div>
              </div>
            </div>

            {/* Summary stat strip */}
            <div style={{ padding: "8px 24px", borderBottom: "1px solid #e6e5e0", background: "#fafaf8", display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#9c9c93" }} />
                <span style={{ fontSize: 11, color: "#68685f", fontWeight: 500 }}>{upcoming.length} total upcoming</span>
              </div>
              {urgentCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#e53e3e" }} />
                  <span style={{ fontSize: 11, color: "#be2a2c", fontWeight: 600 }}>{urgentCount} due within 45 days</span>
                </div>
              )}
              {scheduledCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#0d6b50" }} />
                  <span style={{ fontSize: 11, color: "#0d6b50", fontWeight: 600 }}>{scheduledCount} scheduled</span>
                </div>
              )}
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto" as const }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#181816" }}>
                    {["Due Date","Description","Payee","Amount","Action"].map((h, i) => (
                      <th key={h} style={{ padding: "9px 14px", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", textAlign: i >= 3 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((obl, rowIdx) => {
                    const daysUntil = Math.ceil((obl.due.getTime() - DEMO_NOW.getTime()) / 86400000);
                    const isUrgent = daysUntil <= 45;
                    const isScheduled = scheduled.has(obl.id);
                    const rowBg = isScheduled ? "#fafaf8" : "#fff";
                    return (
                      <tr key={obl.id} style={{ background: rowBg, borderBottom: "1px solid #f0ede8", opacity: isScheduled ? 0.65 : 1 }}>
                        <td style={{ padding: "11px 14px", whiteSpace: "nowrap" as const }}>
                          <div style={{ fontWeight: 600, color: "#181816", fontSize: 12 }}>{format(obl.due, "MMM d, yyyy")}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: isUrgent ? "#be2a2c" : "#9c9c93", marginTop: 1 }}>
                            {isUrgent ? `${daysUntil}d — urgent` : `in ${daysUntil}d`}
                          </div>
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          <div style={{ fontWeight: 600, color: "#181816", lineHeight: 1.3 }}>{obl.label}</div>
                          <div style={{ fontSize: 10, color: "#9c9c93", marginTop: 2 }}>From: {obl.from}</div>
                        </td>
                        <td style={{ padding: "11px 14px", color: "#68685f", fontSize: 12 }}>{obl.payee}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#be2a2c", whiteSpace: "nowrap" as const }}>{fmt(obl.amount)}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right" }}>
                          {isScheduled ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#e5f3ee", border: "1px solid #b4d9ce", borderRadius: 20, padding: "4px 10px", fontSize: 9, fontWeight: 700, color: "#0d6b50" }}>
                              <CheckSquare style={{ width: 11, height: 11 }} /> Scheduled
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setWireFromAccount((s) => ({ ...s, [obl.id]: s[obl.id] ?? obl.from }));
                                const pd = new Date(obl.due); pd.setDate(pd.getDate() - 2);
                                setWireScheduleDate((s) => ({ ...s, [obl.id]: s[obl.id] ?? pd.toISOString().slice(0, 10) }));
                                setWireMemo((s) => ({ ...s, [obl.id]: s[obl.id] ?? obl.label }));
                                setWireModalId(obl.id);
                              }}
                              style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}
                            >
                              <Send style={{ width: 11, height: 11 }} /> Setup {obl.method}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* DStrip footer */}
            <DStrip cardKey="payments" color="#7c3aed" approveLabel="Approve All Payments →" onApprove={() => { upcoming.filter(o => !scheduled.has(o.id)).forEach(o => setScheduled(s => new Set([...s, o.id]))); }} />

            {/* Wire / ACH Setup Modal */}
            <Dialog open={wireModalId !== null} onOpenChange={(open) => { if (!open) setWireModalId(null); }}>
              <DialogContent style={{ maxWidth: 460, background: "#fff", border: "1px solid #e6e5e0", borderRadius: 14, padding: 0, overflow: "hidden" }}>
                {activeObl && (
                  <>
                    {/* Modal header bar */}
                    <div style={{ height: 3, background: "#7c3aed" }} />
                    <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e6e5e0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                        <Send style={{ width: 14, height: 14, color: "#7c3aed" }} />
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7c3aed" }}>Setup {activeObl.method} Payment</span>
                      </div>
                      <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 20, fontWeight: 400, color: "#181816" }}>{activeObl.label}</div>
                    </div>

                    <div style={{ padding: "16px 24px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                      {/* Payment summary card */}
                      <div style={{ background: "#fafaf8", border: "1px solid #e6e5e0", borderRadius: 9, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#181816", lineHeight: 1.3 }}>{activeObl.payee}</div>
                          <div style={{ fontSize: 10, color: "#9c9c93", marginTop: 2 }}>Due {format(activeObl.due, "MMM d, yyyy")}</div>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 300, fontVariantNumeric: "tabular-nums", color: "#be2a2c" }}>{fmt(activeObl.amount)}</div>
                      </div>

                      {/* From account */}
                      <div>
                        <label style={labelStyle}>From Account</label>
                        <select value={wireFromAccount[activeObl.id] ?? activeObl.from} onChange={(e) => setWireFromAccount((s) => ({ ...s, [activeObl.id]: e.target.value }))} style={fieldStyle}>
                          <option>Citizens Private Banking Checking</option>
                          <option>Chase Total Checking</option>
                          <option>Citizens Private Bank Money Market</option>
                          <option>CapitalOne 360 Savings</option>
                        </select>
                      </div>

                      {/* Process date */}
                      <div>
                        <label style={labelStyle}>Process Date</label>
                        <input type="date" value={wireScheduleDate[activeObl.id] ?? ""} onChange={(e) => setWireScheduleDate((s) => ({ ...s, [activeObl.id]: e.target.value }))} style={fieldStyle} />
                        <div style={{ fontSize: 10, color: "#9c9c93", marginTop: 4 }}>Defaults to 2 business days before due date</div>
                      </div>

                      {/* Memo */}
                      <div>
                        <label style={labelStyle}>Memo / Reference</label>
                        <input type="text" value={wireMemo[activeObl.id] ?? activeObl.label} onChange={(e) => setWireMemo((s) => ({ ...s, [activeObl.id]: e.target.value }))} style={fieldStyle} />
                      </div>

                      {/* Payment details block */}
                      <div style={{ background: "#fafaf8", border: "1px solid #e6e5e0", borderRadius: 9, padding: "12px 16px" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9c9c93", marginBottom: 8 }}>Payment Details</div>
                        {[
                          { label: "Routing Number", val: activeObl.routing, mono: true },
                          { label: "Account / Ref",  val: activeObl.acct,    mono: true },
                          { label: "Method",         val: activeObl.method,  mono: false },
                        ].map(({ label, val, mono }) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, marginBottom: 5 }}>
                            <span style={{ color: "#9c9c93" }}>{label}</span>
                            <span style={{ fontWeight: 600, color: "#181816", fontFamily: mono ? "monospace" : "inherit" }}>{val}</span>
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 8, paddingTop: 2 }}>
                        <button onClick={() => setWireModalId(null)} style={{ flex: 1, borderRadius: 8, border: "1px solid #e6e5e0", background: "#fff", color: "#3a3a35", padding: "10px 16px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                          Cancel
                        </button>
                        <button onClick={() => { setScheduled((s) => new Set([...s, activeObl.id])); setWireModalId(null); }} style={{ flex: 1, borderRadius: 8, border: "none", background: "#181816", color: "#fff", padding: "10px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <CheckSquare style={{ width: 13, height: 13 }} /> Schedule Payment
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

      {/* ── Page footer ── */}
      <div style={{ marginTop: 32, padding: "14px 24px", background: "#fff", border: "1px solid #e6e5e0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "#9c9c93" }}>
          Prepared by GURU · Updated {format(DEMO_NOW, "h:mm aa")} · 2 items resolved this week
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setShowEmail(true)}
            style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "8px 18px", borderRadius: 8, border: "1px solid #d4d4cf", background: "#fff", color: "#3a3a35", cursor: "pointer" }}
          >
            Draft client email
          </button>
          <button
            style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 22px", borderRadius: 8, border: "none", background: "#181816", color: "#fff", cursor: "pointer" }}
          >
            Approve all urgent →
          </button>
        </div>
      </div>

      {/* ── Email Modal ── */}
      <Dialog open={showEmail} onOpenChange={setShowEmail}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-indigo-600" />
              Client Email — Sarah &amp; Michael Kessler
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 min-h-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground border border-border rounded-lg px-4 py-2.5 bg-muted/30 flex-shrink-0">
              <div><span className="font-semibold">To:</span> Sarah &amp; Michael Kessler &lt;kessler.family@privatebank.com&gt;</div>
              <div className="ml-auto"><span className="font-semibold">Subject:</span> A few things worth discussing — your portfolio update</div>
            </div>
            <div className="rounded-xl border border-border bg-background px-5 py-4 text-[12px] text-foreground overflow-y-auto flex-1">
              {buildEmailJSX()}
            </div>
            <div className="flex items-center gap-3 justify-end flex-shrink-0 pt-1">
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
                className="flex items-center gap-2 px-4 py-2 rounded text-white text-[11px] font-semibold transition-colors" style={{ background: "hsl(222,45%,14%)" }}
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
          <p className="text-[11px] text-muted-foreground mt-1">{BOB_CLIENTS.length} accounts · {fmt(totalAUM, true)} total AUM · <span className="font-semibold" style={{ color: "#b04040" }}>{needsActionCount} need action</span> · <span className="font-semibold" style={{ color: "#2e7a52" }}>{healthyCount} healthy</span></p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded border transition-colors" style={{ background: "hsl(222,45%,12%)", color: "rgba(255,255,255,0.85)", borderColor: "rgba(255,255,255,0.08)" }}
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
          className={`rounded-xl border p-3 text-center transition-all hover:shadow-sm ${activeFlag === "all" ? "border-border" : "bg-card border-border"}`}
          style={activeFlag === "all" ? { background: "hsl(222,45%,12%)" } : undefined}
        >
          <p className={`text-xl font-semibold tabular-nums ${activeFlag === "all" ? "text-white" : "text-foreground"}`}>{BOB_CLIENTS.length}</p>
          <p className={`text-[9px] uppercase tracking-[0.1em] mt-0.5 ${activeFlag === "all" ? "text-white/50" : "text-muted-foreground"}`}>All</p>
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
                      ? <span className="text-[8px] font-semibold flex items-center gap-0.5" style={{ color: "#2e7a52" }}><Check className="w-2.5 h-2.5" />Reviewed</span>
                      : <button onClick={() => markDone(client.id, "review")} className="flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded border whitespace-nowrap transition-colors hover:brightness-95" style={{ background: "rgba(154,123,60,0.07)", color: "#7a6030", borderColor: "rgba(154,123,60,0.25)" }} data-testid={`action-review-${client.id}`}>
                          <Lightbulb className="w-2.5 h-2.5" /> Review
                        </button>
                  )}
                  {client.flags.includes("product_needed") && (
                    isDone(client.id, "product")
                      ? <span className="text-[8px] font-semibold flex items-center gap-0.5" style={{ color: "#2e7a52" }}><Check className="w-2.5 h-2.5" />Assigned</span>
                      : <button onClick={() => markDone(client.id, "product")} className="flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded border whitespace-nowrap transition-colors hover:brightness-95" style={{ background: "rgba(46,92,138,0.07)", color: "#2e5c8a", borderColor: "rgba(46,92,138,0.25)" }} data-testid={`action-product-${client.id}`}>
                          <Target className="w-2.5 h-2.5" /> Assign
                        </button>
                  )}
                  {client.flags.includes("autobill_approval") && (
                    isDone(client.id, "autobill")
                      ? <span className="text-[8px] font-semibold flex items-center gap-0.5" style={{ color: "#2e7a52" }}><Check className="w-2.5 h-2.5" />Approved</span>
                      : <button onClick={() => markDone(client.id, "autobill")} className="flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded border whitespace-nowrap transition-colors hover:brightness-95" style={{ background: "rgba(110,78,122,0.07)", color: "#6e4e7a", borderColor: "rgba(110,78,122,0.25)" }} data-testid={`action-autobill-${client.id}`}>
                          <CheckSquare className="w-2.5 h-2.5" /> Approve
                        </button>
                  )}
                  {(client.flags.includes("money_movement") || client.flags.includes("cash_deficit") || client.flags.includes("follow_up")) && (
                    isDone(client.id, "email")
                      ? <span className="text-[8px] font-semibold flex items-center gap-0.5" style={{ color: "#2e7a52" }}><Check className="w-2.5 h-2.5" />Sent</span>
                      : <button onClick={() => markDone(client.id, "email")} className="flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded border whitespace-nowrap transition-colors hover:brightness-95" style={{ background: "rgba(46,122,82,0.07)", color: "#2e7a52", borderColor: "rgba(46,122,82,0.25)" }} data-testid={`action-email-${client.id}`}>
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

// ─── GURU Allocation Landing View ─────────────────────────────────────────────
function GuruLandingView({
  assets,
  cashFlows,
  onStartReview,
}: {
  assets: Asset[];
  cashFlows: CashFlow[];
  onStartReview: () => void;
}) {
  const [calcMode, setCalcMode] = useState(false);
  const [workflowStarted, setWorkflowStarted] = useState(false);
  const [bucketOverrides, setBucketOverrides] = useState<Record<string, { newBal: number; origBal: number } | null>>({});
  const [incomeImpact, setIncomeImpact] = useState<{ atIncome: string; atIncomeSub: string; yieldDelta: string; yieldDeltaSub: string; aumIncrease: string } | null>(null);
  useEffect(() => {
    function handleMsg(e: MessageEvent) {
      if (e.data?.type === 'GURU_BUCKET_UPDATE') {
        setBucketOverrides(prev => ({ ...prev, [e.data.key]: { newBal: e.data.newBal, origBal: e.data.origBal } }));
      } else if (e.data?.type === 'GURU_BUCKET_RESTORE') {
        setBucketOverrides(prev => { const next = { ...prev }; delete next[e.data.key]; return next; });
      } else if (e.data?.type === 'GURU_INCOME_IMPACT') {
        setIncomeImpact({ atIncome: e.data.atIncome, atIncomeSub: e.data.atIncomeSub, yieldDelta: e.data.yieldDelta, yieldDeltaSub: e.data.yieldDeltaSub, aumIncrease: e.data.aumIncrease });
      }
    }
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);
  const monthlyExpenses = (() => {
    const moMap: Record<string, number> = {};
    cashFlows.filter((c) => c.type === "outflow").forEach((c) => {
      const d = new Date(c.date as string);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      moMap[k] = (moMap[k] ?? 0) + Number(c.amount);
    });
    const vals = Object.values(moMap);
    return vals.length ? Math.min(...vals) : 24939;
  })();
  const monthlyIncome = (() => {
    const moMap: Record<string, number> = {};
    cashFlows.filter((c) => c.type === "inflow").forEach((c) => {
      const d = new Date(c.date as string);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      moMap[k] = (moMap[k] ?? 0) + Number(c.amount);
    });
    const vals = Object.values(moMap);
    return vals.length ? Math.min(...vals) : 30467;
  })();
  const [coverage, setCoverage] = useState(12);
  const [incomeInput, setIncomeInput] = useState(monthlyIncome);
  const [expensesInput, setExpensesInput] = useState(monthlyExpenses);

  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const { reserve, yieldBucket, tactical, growth, alts } = cashBuckets(assets);
  const totalLiquid = reserve + yieldBucket + tactical;
  const deployable = Math.max(0, totalLiquid - expensesInput * coverage);
  const pickup = Math.round(deployable * 0.0432);

  const bucketList = [
    { key: "op", label: "Operating Cash", yield: "0.01%", bal: reserve, accent: "#1d4ed8", desc: `${(reserve / monthlyExpenses).toFixed(1)} mo · cash for upcoming expenditures` },
    { key: "res", label: "Reserve Cash", yield: "4.60%", bal: yieldBucket, accent: "#8a6920", desc: "Active cash management" },
    { key: "bld", label: "Capital Build", yield: "4.85%", bal: tactical, accent: "#1e4d30", desc: "Goal-directed saving · short-duration ladder" },
    { key: "grow", label: "Investments", yield: "3.95%", bal: growth, accent: "#3d1a6e", desc: "Long-term compounded growth" },
    { key: "oth", label: "Other Assets", yield: "", bal: alts, accent: "rgba(0,0,0,0.14)", desc: "Real estate & alternatives" },
  ];
  const maxBal = Math.max(...bucketList.map((b) => b.bal));

  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "#f0ece5", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @keyframes guruBorderRun {
          0%   { background-position: 0% 0,   100% 0,   100% 100%, 0% 100%; }
          100% { background-position: 200% 0, 100% 200%, -100% 100%, 0% -100%; }
        }
        @keyframes guruPulse { 0%,100%{opacity:1} 50%{opacity:0.30} }
        @keyframes guruIPulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        .guru-landing-intel::before {
          content:''; position:absolute; inset:0; pointer-events:none; z-index:1; border-radius:11px;
          background:
            linear-gradient(90deg, transparent 0%, rgba(91,143,204,0.60) 50%, transparent 100%) top / 200% 1.5px no-repeat,
            linear-gradient(180deg, transparent 0%, rgba(91,143,204,0.30) 50%, transparent 100%) right / 1.5px 200% no-repeat,
            linear-gradient(90deg, transparent 0%, rgba(91,143,204,0.40) 50%, transparent 100%) bottom / 200% 1.5px no-repeat,
            linear-gradient(180deg, transparent 0%, rgba(91,143,204,0.30) 50%, transparent 100%) left / 1.5px 200% no-repeat;
          animation: guruBorderRun 7s linear infinite;
        }
        .guru-landing-bucket:hover { box-shadow: 0 2px 10px rgba(0,0,0,0.07); }
      `}</style>

      {/* Slim header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 28px", height:46, background:"rgba(240,236,229,0.97)", borderBottom:"1px solid rgba(0,0,0,0.08)", position:"sticky", top:0, zIndex:100, backdropFilter:"blur(4px)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <span style={{ fontSize:13, fontWeight:500, color:"#1a1a1a" }}>Kessler Family</span>
          <span style={{ color:"rgba(0,0,0,0.18)" }}>·</span>
          <span style={{ fontSize:13, color:"rgba(0,0,0,0.55)" }}>Asset Allocation</span>
        </div>
        <span style={{ fontSize:10, color:"rgba(0,0,0,0.38)" }}>GURU flagged 2 items · last checked 4 hours ago</span>
      </div>

      {/* Main 2-column layout */}
      <div style={{ display:"grid", gridTemplateColumns:`1fr ${workflowStarted ? "230px" : "354px"}`, height:"calc(100vh - 46px)", overflow:"hidden", transition:"grid-template-columns 0.3s ease" }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ borderRight:"1px solid rgba(0,0,0,0.09)", display:"flex", flexDirection:"column" }}>

          {/* ── GURU INSIGHT CARD — hidden when workflow active ── */}
          {!workflowStarted && (
            <div
              className="guru-landing-intel"
              style={{ margin:"12px 16px 0", position:"relative", overflow:"hidden", background:"linear-gradient(160deg,#1a3a6b 0%,#163060 55%,#0f2248 100%)", border:"1px solid rgba(91,143,204,0.20)", borderRadius:12 }}
            >
              {/* Header row */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 18px", borderBottom:"1px solid rgba(255,255,255,0.05)", position:"relative", zIndex:2 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"#5ecc8a", boxShadow:"0 0 6px rgba(94,204,138,0.7)", display:"inline-block", animation:"guruPulse 2.2s infinite", flexShrink:0 }} />
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase" as const, color:"rgba(94,204,138,0.85)" }}>GURU Intelligence</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:5, padding:"2px 8px", border:"1px solid rgba(91,143,204,0.20)", borderRadius:2, background:"rgba(91,143,204,0.05)" }}>
                  <span style={{ width:4, height:4, borderRadius:"50%", background:"rgba(94,204,138,0.70)", display:"inline-block", animation:"guruPulse 2.6s infinite" }} />
                  <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" as const, color:"rgba(255,255,255,0.40)" }}>Editorial · AI</span>
                </div>
              </div>
              {/* Insight body */}
              <div style={{ padding:"12px 18px 14px", position:"relative", zIndex:2 }}>
                <div style={{ fontFamily:'"Playfair Display", Georgia, serif', fontSize:20, fontWeight:400, color:"rgba(255,255,255,0.90)", lineHeight:1.2, letterSpacing:"-0.01em", marginBottom:8 }}>
                  Strong Liquidity. Time to Generate More Alpha.
                </div>
                <div style={{ fontSize:11, lineHeight:1.65, color:"rgba(255,255,255,0.50)" }}>
                  The Kesslers had a great end of year and are now sitting on excess liquidity for 47 days after a $753,000 cash bonus. GURU has analyzed their cash flow forecast and identified{" "}
                  <span style={{ color:"rgba(212,168,67,0.95)", fontWeight:500 }}>{fmt(deployable > 0 ? deployable : 499440)} in excess liquidity</span>.
                  {" "}We can generate better returns by optimizing fixed income products and putting cash to work in their investment strategy.
                </div>
              </div>
            </div>
          )}

          {/* ── GURU MODEL CALCULATOR CARD ── */}
          <div
            className="guru-landing-intel"
            style={{ margin: workflowStarted ? "12px 16px 0" : "6px 16px 0", position:"relative", overflow:"hidden", background:"linear-gradient(160deg,#1a3a6b 0%,#163060 55%,#0f2248 100%)", border:"1px solid rgba(91,143,204,0.20)", borderRadius:12 }}
          >
            {/* Header row */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 18px", borderBottom:"1px solid rgba(255,255,255,0.05)", position:"relative", zIndex:2 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:"#5ecc8a", boxShadow:"0 0 6px rgba(94,204,138,0.7)", display:"inline-block", animation:"guruPulse 2.2s infinite", flexShrink:0 }} />
                <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase" as const, color:"rgba(94,204,138,0.85)" }}>GURU Model Calculator</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:5, padding:"2px 8px", border:"1px solid rgba(91,143,204,0.20)", borderRadius:2, background:"rgba(91,143,204,0.05)" }}>
                <span style={{ width:4, height:4, borderRadius:"50%", background:"rgba(91,143,204,0.85)", display:"inline-block", animation:"guruPulse 1.8s infinite" }} />
                <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" as const, color:"rgba(255,255,255,0.40)" }}>{calcMode ? "Calculating" : "Live · Now"}</span>
              </div>
            </div>

            {/* When workflow active: Playfair headline sits above the KPIs */}
            {workflowStarted && (
              <div style={{ padding:"12px 18px 0", position:"relative", zIndex:2, borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontFamily:'"Playfair Display", Georgia, serif', fontSize:20, fontWeight:400, color:"rgba(255,255,255,0.90)", lineHeight:1.25, letterSpacing:"-0.01em", paddingBottom:12 }}>
                  Strong Liquidity. Time to Generate More Alpha.
                </div>
              </div>
            )}

            {/* KPI view — pre-launch */}
            {!calcMode && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", position:"relative", zIndex:2 }}>
                {[
                  { lbl:"Deployable Excess", val:fmt(deployable > 0 ? deployable : 499440), color:"rgba(212,168,67,0.95)" },
                  { lbl:"After-Tax Pickup", val:`+${fmt(pickup > 0 ? pickup : 21600)}/yr`, color:"rgba(94,204,138,0.92)" },
                  { lbl:"Annual Expenses", val:fmt(monthlyExpenses * 12), color:"rgba(255,255,255,0.88)" },
                  { lbl:"Net Cash Flow", val:`+${fmt(Math.max(0,(monthlyIncome-monthlyExpenses)*12))}`, color:"rgba(91,143,204,0.95)" },
                ].map((kpi) => (
                  <div key={kpi.lbl} style={{ display:"flex", flexDirection:"column", gap:3, padding:"10px 16px", borderRight:"1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize:8, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" as const, color:"rgba(255,255,255,0.38)" }}>{kpi.lbl}</span>
                    <span style={{ fontSize:16, fontWeight:300, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em", color:kpi.color, lineHeight:1 }}>{kpi.val}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Calculator view — live income impact KPIs */}
            {calcMode && (
              <div style={{ padding:"10px 18px 12px", position:"relative", zIndex:2, display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, alignItems:"stretch" }}>
                {/* AUM Increase — left */}
                <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(212,168,67,0.18)", borderRadius:4, padding:"8px 14px", display:"flex", flexDirection:"column", gap:3 }}>
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase" as const, color:"rgba(255,195,80,0.60)" }}>AUM Increase</span>
                  <span style={{ fontSize:20, fontWeight:600, fontVariantNumeric:"tabular-nums", color:"rgba(212,168,67,0.95)", letterSpacing:"-0.01em", lineHeight:1 }}>
                    {incomeImpact ? incomeImpact.aumIncrease : "—"}
                  </span>
                </div>
                {/* After-Tax Income — center */}
                <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(212,168,67,0.18)", borderRadius:4, padding:"8px 14px", display:"flex", flexDirection:"column", gap:3 }}>
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase" as const, color:"rgba(255,195,80,0.60)" }}>After-Tax Income</span>
                  <span style={{ fontSize:20, fontWeight:600, fontVariantNumeric:"tabular-nums", color:"rgba(212,168,67,0.95)", letterSpacing:"-0.01em", lineHeight:1 }}>
                    {incomeImpact ? incomeImpact.atIncome : "—"}
                  </span>
                </div>
                {/* % AT Return Increase — right */}
                <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(212,168,67,0.18)", borderRadius:4, padding:"8px 14px", display:"flex", flexDirection:"column", gap:3 }}>
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase" as const, color:"rgba(255,195,80,0.60)" }}>% Increase · AT Annual Returns</span>
                  <span style={{ fontSize:20, fontWeight:600, fontVariantNumeric:"tabular-nums", color:"rgba(212,168,67,0.95)", letterSpacing:"-0.01em", lineHeight:1 }}>
                    {incomeImpact ? incomeImpact.yieldDelta : "—"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── CENTER: pre-launch or live workflow ── */}
          {!workflowStarted ? (
            <div style={{ flex:1, padding:"32px 48px 40px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.18em", textTransform:"uppercase" as const, color:"rgba(0,0,0,0.38)", marginBottom:16, textAlign:"center" }}>GURU Flagged 2 Items · Ready When You Are</div>
              <div style={{ fontFamily:'"Playfair Display", Georgia, serif', fontSize:24, fontWeight:400, color:"#1a1a1a", lineHeight:1.25, marginBottom:12, textAlign:"center", maxWidth:480, letterSpacing:"-0.01em" }}>Rebalance and Maximize Wealth Now</div>
              <div style={{ fontSize:13, color:"rgba(0,0,0,0.50)", lineHeight:1.75, marginBottom:32, maxWidth:480, textAlign:"center" }}>
                GURU monitors continuously and flags when the portfolio can do more. Walk through the review at your own pace — or activate auto-execution for next time.
              </div>

              {/* Step cards */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 22px 1fr 22px 1fr", alignItems:"stretch", width:"100%", marginBottom:24 }}>
                {[
                  { n:1, name:"Asset Allocation Rebalancing", desc:"Review suggested coverage targets and confirm transfer amounts across your liquidity buckets.", tag:"~3 min · GURU pre-filled" },
                  null,
                  { n:2, name:"Product Selection", desc:"Choose instruments — T-bills, money markets, short bonds — ranked by after-tax yield for your profile.", tag:"~2 min · ranked for you" },
                  null,
                  { n:3, name:"Confirm & Execute", desc:"Review the full before/after and send for execution. Activate auto-execute for future events.", tag:"~1 min · auto-execute available" },
                ].map((item, idx) =>
                  item === null ? (
                    <div key={idx} style={{ display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"rgba(0,0,0,0.18)" }}>→</div>
                  ) : (
                    <div key={item.n} style={{ background:"#fff", border:"1px solid rgba(0,0,0,0.09)", borderRadius:8, padding:"18px 16px", textAlign:"left" as const, display:"flex", flexDirection:"column" }}>
                      <div style={{ width:26, height:26, borderRadius:"50%", background:"#1a2e4a", color:"rgba(255,255,255,0.9)", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:11, flexShrink:0 }}>{item.n}</div>
                      <div style={{ fontFamily:'"Playfair Display", Georgia, serif', fontSize:15, fontWeight:400, color:"#1a1a1a", marginBottom:6, lineHeight:1.3 }}>{item.name}</div>
                      <div style={{ fontSize:12, color:"rgba(0,0,0,0.55)", lineHeight:1.6, flex:1 }}>{item.desc}</div>
                      <span style={{ display:"inline-block", marginTop:12, fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, padding:"3px 8px", borderRadius:2, background:"rgba(26,46,74,0.07)", color:"#1a2e4a", border:"1px solid rgba(26,46,74,0.14)" }}>{item.tag}</span>
                    </div>
                  )
                )}
              </div>

              {/* CTA */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:9 }}>
                <button
                  style={{ fontFamily:"inherit", fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase" as const, background:"#1a2e4a", color:"rgba(255,255,255,0.92)", border:"none", cursor:"pointer", padding:"13px 48px", borderRadius:2 }}
                  onClick={() => { setCalcMode(true); setWorkflowStarted(true); }}
                >
                  Start the Review →
                </button>
                <span style={{ fontSize:10, color:"rgba(0,0,0,0.38)" }}>~6 minutes · reversible at every step</span>
              </div>
            </div>
          ) : (
            <div style={{ flex:1, minHeight:0, overflow:"hidden", display:"flex", flexDirection:"column" }}>
              <iframe
                src="/allocation-tab-mockup.html?embedded=1"
                style={{ flex:1, width:"100%", border:"none", display:"block", minHeight:0 }}
                title="Allocation Workflow"
              />
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN — Bucket cards ── */}
        <div style={{ background:"#f5f1ec", display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"14px 18px 12px", borderBottom:"1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize:8, fontWeight:700, letterSpacing:"0.16em", textTransform:"uppercase" as const, color:"rgba(0,0,0,0.38)", marginBottom:2 }}>Total Assets</div>
            <div style={{ fontSize:22, fontWeight:300, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em", color:"#1a1a1a" }}>{fmt(totalAssets)}</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:7, padding:"10px 10px 0" }}>
            {bucketList.map((b) => {
              const ov = bucketOverrides[b.key];
              const displayBal = ov ? ov.newBal : b.bal;
              const barPct = maxBal > 0 ? Math.round((displayBal / maxBal) * 100) : 0;
              return (
              <div
                key={b.key}
                className="guru-landing-bucket"
                style={{ background:"#fff", borderTop:"1px solid rgba(0,0,0,0.09)", borderRight:"1px solid rgba(0,0,0,0.09)", borderBottom:"1px solid rgba(0,0,0,0.09)", borderLeft:`3px solid ${b.accent}`, borderRadius:6, padding:"11px 13px", display:"flex", flexDirection:"column", gap:6, transition:"box-shadow 0.15s", cursor:"default" }}
              >
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                  <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.11em", textTransform:"uppercase" as const, color:"rgba(0,0,0,0.55)" }}>{b.label}</span>
                  <span style={{ fontSize:10, color:"rgba(0,0,0,0.38)", fontVariantNumeric:"tabular-nums" }}>{b.yield}</span>
                </div>
                <div style={{ fontSize:19, fontWeight:300, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em", color:"#1a1a1a", lineHeight:1, display:"flex", alignItems:"baseline", gap:6 }}>
                  {ov && <span style={{ fontSize:13, textDecoration:"line-through", color:"rgba(0,0,0,0.28)", fontWeight:400 }}>{fmt(ov.origBal)}</span>}
                  <span style={{ color:"#1a1a1a" }}>{fmt(displayBal)}</span>
                </div>
                <div style={{ height:2, background:"rgba(0,0,0,0.06)", borderRadius:1, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${barPct}%`, background:b.accent, borderRadius:1, transition:"width 0.4s ease" }} />
                </div>
                <div style={{ fontSize:9, color:"rgba(0,0,0,0.38)", lineHeight:1.4 }}>{b.desc}</div>
              </div>
              );
            })}
          </div>
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
  const [activeView, setActiveView] = useState<ActiveView>("advisorbrief");
  const [guruLanding, setGuruLanding] = useState(true);
  const [financialsTab, setFinancialsTab] = useState<"balancesheet" | "cashflow">("balancesheet");
  const [opsCashMonths, setOpsCashMonths] = useState(2);
  const [cfModalOpen, setCfModalOpen] = useState(false);

  // Reset guru landing when switching away
  useEffect(() => {
    if (activeView !== "guru") setGuruLanding(true);
  }, [activeView]);

  // Listen for postMessage from cashflow iframe → open full-screen model
  useEffect(() => {
    function handleCfMessage(e: MessageEvent) {
      if (e.data?.type === 'OPEN_CF_MODAL') setCfModalOpen(true);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setCfModalOpen(false);  // CashFlowForecastView also listens for Esc internally
    }
    window.addEventListener('message', handleCfMessage);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('message', handleCfMessage);
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

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
  const totalToInvestTop = Math.round(Math.max(0, cashExcessTop));

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
    conservative: "bg-secondary text-secondary-foreground",
    moderate: "bg-secondary text-secondary-foreground",
    aggressive: "bg-secondary text-secondary-foreground",
  };

  const navActive = (key: ActiveView, subTab?: "balancesheet" | "cashflow") => {
    if (subTab) return activeView === key && financialsTab === subTab;
    return activeView === key;
  };

  const NAV_ITEM: React.CSSProperties = {
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 11,
    fontWeight: 500,
    color: "rgba(255,255,255,0.4)",
    padding: "5px 8px",
    borderRadius: 5,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 7,
    marginBottom: 1,
    transition: "background 0.1s, color 0.1s",
    userSelect: "none" as const,
    whiteSpace: "nowrap" as const,
  };

  const NAV_ITEM_ACTIVE: React.CSSProperties = {
    ...NAV_ITEM,
    fontWeight: 600,
    color: "#ffffff",
    background: "rgba(255,255,255,0.06)",
  };

  const SectionLabel = ({ children, first }: { children: string; first?: boolean }) => (
    <p style={{
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 8,
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "0.14em",
      color: "rgba(255,255,255,0.2)",
      padding: "0 8px",
      marginTop: first ? 4 : 8,
      marginBottom: 4,
      whiteSpace: "nowrap" as const,
    }}>
      {children}
    </p>
  );

  const clientSidebarNav = (
    <nav style={{ padding: "0 6px", flex: 1, overflowY: "auto" as const }}>
      {/* Back link */}
      <Link href="/">
        <div style={{ ...NAV_ITEM, color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>
          <ChevronLeft style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span className="sb-hide">All Clients</span>
        </div>
      </Link>

      <SectionLabel first>Advisor</SectionLabel>

      <div
        style={navActive("dashboard") ? NAV_ITEM_ACTIVE : NAV_ITEM}
        onClick={() => setActiveView("dashboard")}
        onMouseEnter={e => { if (!navActive("dashboard")) { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.55)"; }}}
        onMouseLeave={e => { if (!navActive("dashboard")) { (e.currentTarget as HTMLDivElement).style.background = ""; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.4)"; }}}
        data-testid="nav-dashboard"
      >
        <LayoutDashboard style={{ width: 12, height: 12, flexShrink: 0 }} />
        <span className="sb-hide">Dashboard</span>
      </div>

      <div
        style={navActive("guru") ? NAV_ITEM_ACTIVE : NAV_ITEM}
        onClick={() => setActiveView("guru")}
        onMouseEnter={e => { if (!navActive("guru")) { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.55)"; }}}
        onMouseLeave={e => { if (!navActive("guru")) { (e.currentTarget as HTMLDivElement).style.background = ""; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.4)"; }}}
        data-testid="nav-guru"
      >
        <PieChartIcon style={{ width: 12, height: 12, flexShrink: 0 }} />
        <span className="sb-hide">Allocation</span>
      </div>

      <div
        style={navActive("advisorbrief") ? NAV_ITEM_ACTIVE : NAV_ITEM}
        onClick={() => setActiveView("advisorbrief")}
        onMouseEnter={e => { if (!navActive("advisorbrief")) { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.55)"; }}}
        onMouseLeave={e => { if (!navActive("advisorbrief")) { (e.currentTarget as HTMLDivElement).style.background = ""; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.4)"; }}}
        data-testid="nav-advisorbrief"
      >
        <ClipboardList style={{ width: 12, height: 12, flexShrink: 0 }} />
        <span className="sb-hide">Advisor Brief</span>
      </div>

      <SectionLabel>Intelligence</SectionLabel>

      <div
        style={navActive("financials", "cashflow") ? NAV_ITEM_ACTIVE : NAV_ITEM}
        onClick={() => { setActiveView("financials"); setFinancialsTab("cashflow"); }}
        onMouseEnter={e => { if (!navActive("financials", "cashflow")) { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.55)"; }}}
        onMouseLeave={e => { if (!navActive("financials", "cashflow")) { (e.currentTarget as HTMLDivElement).style.background = ""; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.4)"; }}}
        data-testid="nav-cashflow"
      >
        <ArrowLeftRight style={{ width: 12, height: 12, flexShrink: 0 }} />
        <span className="sb-hide">Cashflow</span>
      </div>

      <div
        style={navActive("financials", "balancesheet") ? NAV_ITEM_ACTIVE : NAV_ITEM}
        onClick={() => { setActiveView("financials"); setFinancialsTab("balancesheet"); }}
        onMouseEnter={e => { if (!navActive("financials", "balancesheet")) { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.55)"; }}}
        onMouseLeave={e => { if (!navActive("financials", "balancesheet")) { (e.currentTarget as HTMLDivElement).style.background = ""; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.4)"; }}}
        data-testid="nav-networth"
      >
        <FileText style={{ width: 12, height: 12, flexShrink: 0 }} />
        <span className="sb-hide">Net Worth</span>
      </div>

      <div
        style={navActive("moneymovement") ? NAV_ITEM_ACTIVE : NAV_ITEM}
        onClick={() => setActiveView("moneymovement")}
        onMouseEnter={e => { if (!navActive("moneymovement")) { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.55)"; }}}
        onMouseLeave={e => { if (!navActive("moneymovement")) { (e.currentTarget as HTMLDivElement).style.background = ""; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.4)"; }}}
        data-testid="nav-moneymovement"
      >
        <ArrowLeftRight style={{ width: 12, height: 12, flexShrink: 0 }} />
        <span className="sb-hide">Money Movement</span>
      </div>
    </nav>
  );

  return (
    <Layout sidebarNav={clientSidebarNav}>
      {/* ── Dashboard View ─────────────────────────────────────────────────────── */}
      {activeView === "dashboard" && (
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "#f5f4f0" }}>
          {/* ── Page header — matches allocation tab style ── */}
          <div style={{ padding: "18px 24px 10px", display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 300, color: "#1a2e4a", letterSpacing: "-0.01em", margin: 0, lineHeight: 1 }}>Dashboard</h1>
            <span style={{ fontSize: 11, color: "rgba(0,0,0,0.40)", letterSpacing: "0.04em" }}>Kessler Family · {format(DEMO_NOW, "MMMM d, yyyy")}</span>
          </div>
          <div style={{ padding: "0 24px 48px", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* ── Advisor Brief compact strip ───────────────────────────────────── */}
          <div
            className="rounded-xl bg-card border border-border shadow-sm px-5 py-3.5 flex items-center justify-between gap-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setActiveView("advisorbrief")}
            data-testid="advisor-brief-strip"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "hsl(222,45%,12%)" }}>
                <ClipboardList className="w-4 h-4" style={{ color: "#9a7b3c" }} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground leading-none tracking-tight">Advisor Brief</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">4 priorities prepared for today's meeting</p>
              </div>
            </div>
            <div className="flex items-center gap-5">
              {[
                { label: "Liquidity", color: "#2e7a52", sub: fmt(totalToInvestTop, true) },
                { label: "Investments", color: "#2e5c8a", sub: "Rebalance" },
                { label: "Yield", color: "#9a7b3c", sub: `+${Math.round((_guruLiquidYield - _currentLiquidYield) * 100)} bps` },
                { label: "Planning", color: "#6e4e7a", sub: "6-mo view" },
              ].map((p) => (
                <div key={p.label} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <div>
                    <p className="text-[10px] font-semibold text-foreground leading-none">{p.label}</p>
                    <p className="text-[9px] text-muted-foreground leading-none mt-0.5">{p.sub}</p>
                  </div>
                </div>
              ))}
              <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-0.5 ml-1 hover:text-foreground transition-colors">
                View <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <NetWorthPanel
              assets={assets}
              liabilities={liabilities}
              cashFlows={cashFlows}
            />
            <CashManagementPanel assets={assets} cashFlows={cashFlows} />
          </div>

          <div className="grid grid-cols-2 gap-2 items-start">
            <CashFlowForecastPanel cashFlows={cashFlows} onNavigateToCashflow={() => { setActiveView("financials"); setFinancialsTab("cashflow"); }} />
            <CashFlowTicker cashFlows={cashFlows} />
          </div>

          <div className="grid grid-cols-2 gap-4 items-start">
            <BrokeragePanel assets={assets} />
            <LiabilitiesPanel liabilities={liabilities} />
          </div>

          {/* ── Account Cash Movements — animated water-flow widget ─────────── */}
          <DashboardFlowWidget onNavigate={() => setActiveView("moneymovement")} />

          </div>{/* end padding wrapper */}
        </div>
      )}
      {/* ── Advisor Brief View ───────────────────────────────────────────────── */}
      {activeView === "advisorbrief" && (
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
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
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          {financialsTab === "balancesheet" && (
            <DetailsView
              assets={assets}
              liabilities={liabilities}
              cashFlows={cashFlows}
              clientId={clientId}
            />
          )}
          {financialsTab === "cashflow" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", height: "calc(100vh - 56px)", marginTop: "-20px" }}>
              <iframe
                src="/cashflow-layout-mockup.html"
                style={{ flex: 1, width: "100%", height: "100%", border: "none", display: "block" }}
                title="Cashflow Layout"
              />
            </div>
          )}
        </div>
      )}
      {/* ── GURU Asset Allocation View ─────────────────────────────────────────── */}
      {activeView === "guru" && (
        <GuruLandingView
          assets={assets}
          cashFlows={cashFlows}
          onStartReview={() => {}}
        />
      )}
      {/* ── Money Movement View ─────────────────────────────────────────────────── */}
      {activeView === "moneymovement" && (
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "#f5f4f0" }}>
          {/* ── Page header — matches allocation tab style ── */}
          <div style={{ padding: "18px 24px 14px", display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 300, color: "#1a2e4a", letterSpacing: "-0.01em", margin: 0, lineHeight: 1 }}>Money Movement</h1>
            <span style={{ fontSize: 11, color: "rgba(0,0,0,0.40)", letterSpacing: "0.04em" }}>Kessler Family · {format(DEMO_NOW, "MMMM d, yyyy")}</span>
          </div>
          <div style={{ padding: "0 24px 48px" }}>
          <MoneyMovementView
            assets={assets}
            cashFlows={cashFlows}
            opsCashMonths={opsCashMonths}
            clientName={client.name}
            pendingTransfers={pendingTransfers}
            bucketProductSelections={bucketProductSelections}
          />
          </div>{/* end padding wrapper */}
        </div>
      )}

      {/* ── Full-Screen 12-Month Cash Flow Model (real data via CashFlowForecastView portal) */}
      {cfModalOpen && (
        <div style={{ display: 'none' }}>
          <CashFlowForecastView
            assets={assets}
            cashFlows={cashFlows}
            clientId={clientId}
            autoFullScreen={true}
            onCloseFullScreen={() => setCfModalOpen(false)}
          />
        </div>
      )}
    </Layout>
  );
}
