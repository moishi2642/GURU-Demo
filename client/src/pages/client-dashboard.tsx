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

// ─── Demo date: simulate "today = December 31, 2025" ──────────────────────────
// SINGLE SOURCE OF TRUTH for all tab date displays.
// This constant is visible / referenced from the GURU Intelligence tab header.
// All other tabs derive their "today" from this value.
const DEMO_NOW = new Date(2025, 11, 31); // December 31, 2025

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
  "bg-white overflow-hidden [border:0.5px_solid_rgba(0,0,0,0.07)]";

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
    color: "#1E4F9C",
    tagCls: "bg-transparent border border-[#1E4F9C]/35 text-[#1E4F9C]",
  },
  yield: {
    label: "Liquidity Reserve",
    short: "Savings & money market — penalty-free, higher-yielding",
    color: "#835800",
    tagCls: "bg-transparent border border-[#835800]/35 text-[#835800]",
  },
  tactical: {
    label: "Capital Build",
    short: "Treasuries & fixed income — 1–3 year horizon",
    color: "#195830",
    tagCls: "bg-transparent border border-[#195830]/35 text-[#195830]",
  },
  growth: {
    label: "Investments",
    short: "Long-horizon investments — equities, compounding wealth",
    color: "#4A3FA0",
    tagCls: "bg-transparent border border-[#4A3FA0]/35 text-[#4A3FA0]",
  },
  alternatives: {
    label: "Alternatives",
    short: "Real estate, private equity, RSUs — strategic illiquid assets",
    color: "#5C5C6E",
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
      // Capital Build: all non-retirement fixed income
      // Matches computeLiquidityTargets() capitalBuild filter exactly
      if (!/401|ira|roth/i.test(a.description ?? "")) {
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

// ─── Shared cumulative NCF computation ───────────────────────────────────────
// Exact mirror of the logic inside CashFlowForecastView that powers the
// cumulative-cash-flow chart.  Extracted here so every panel that needs the
// trough reads from ONE source of truth — not a separately-maintained formula.
//
// CF_PL_ROWS and CF_MONTHS are file-level constants; monthVal logic is replicated
// faithfully (1-indexed months matching CF_MONTHS, same description matching).
//
// Returns
//  • cumulativeByMonth — 12-element array (index 0 = Jan 2026 … 11 = Dec 2026)
//  • troughIdx         — 0-based index of the minimum cumulative value (Nov → 10)
//  • troughDepth       — absolute cash deficit at the trough (e.g. $125,096 for Kesslers)
//  • netByMonth        — 12-element array of monthly NCF
function computeCumulativeNCF(cashFlows: CashFlow[]): {
  cumulativeByMonth: number[];
  troughIdx:   number;
  troughDepth: number;
  netByMonth:  number[];
} {
  // 1-indexed month helper (matches CF_MONTHS where month: 1 = January)
  const mvCF = (descs: string[], year: number, month: number): number =>
    cashFlows
      .filter((cf) => {
        const d = new Date(cf.date as string);
        return (
          d.getUTCFullYear() === year &&
          d.getUTCMonth() + 1 === month &&
          descs.some((dm) => cf.description.toLowerCase().includes(dm.toLowerCase()))
        );
      })
      .reduce((s, cf) => s + (cf.type === "inflow" ? Number(cf.amount) : -Number(cf.amount)), 0);

  const vals: Record<string, number[]> = {};
  for (const row of CF_PL_ROWS) {
    if (row.kind === "item") {
      vals[row.key] = CF_MONTHS.map((m) => mvCF(row.descs, m.year, m.month));
    } else if (row.kind === "subtotal") {
      if (row.sumOf) {
        vals[row.key] = CF_MONTHS.map((_, mi) => row.sumOf!.reduce((s, k) => s + (vals[k]?.[mi] ?? 0), 0));
      } else if (row.descs) {
        vals[row.key] = CF_MONTHS.map((m) => mvCF(row.descs!, m.year, m.month));
      } else {
        vals[row.key] = CF_MONTHS.map(() => 0);
      }
    } else if (row.kind === "total" && row.sumOf) {
      vals[row.key] = CF_MONTHS.map((_, mi) => row.sumOf!.reduce((s, k) => s + (vals[k]?.[mi] ?? 0), 0));
    } else {
      vals[row.key] = CF_MONTHS.map(() => 0);
    }
  }

  const netByMonth = CF_MONTHS.map((_, mi) =>
    CF_PL_ROWS.filter((r) => r.kind === "item").reduce((s, r) => s + (vals[r.key]?.[mi] ?? 0), 0)
  );

  const cumulativeByMonth = netByMonth.reduce<number[]>((acc, v, i) => {
    acc.push((acc[i - 1] ?? 0) + v);
    return acc;
  }, []);

  const troughIdx = cumulativeByMonth.reduce(
    (minI, v, i) => (v < cumulativeByMonth[minI] ? i : minI),
    0,
  );

  // troughDepth: cash needed at the low point.
  // The cumulative NCF starts at 0 (post-bonus) and dips negative through the year
  // before December bonus recovery — so the minimum is typically negative.
  // troughDepth = |min| = how much cash you must hold from day-1 to stay solvent.
  const troughMin  = cumulativeByMonth[troughIdx];
  const troughDepth = troughMin < 0 ? Math.abs(troughMin) : troughMin;

  return { cumulativeByMonth, troughIdx, troughDepth, netByMonth };
}

// ─── Shared liquidity target calculation ─────────────────────────────────────
// Canonical source-of-truth for all liquidity metrics.
// Both AdvisorBriefView and GuruLandingView call this.
//
// ── Terminology ──────────────────────────────────────────────────────────────
//
//  RESERVE TARGET
//    12-month liquidity required across the two bank-deposit buckets:
//    Operating Cash + Liquidity Reserve. Capital Build (goalSavings) is separate.
//    reserveTarget + goalSavings = Total Liquidity Requirement (all 3 buckets).
//    = troughDepth + operatingFloorAtTrough
//    NOTE: this is the combined target for both bank buckets, not either one alone.
//    See LIQUIDITY RESERVE TARGET below for the Liquidity Reserve bucket's portion.
//
//  LIQUIDITY RESERVE TARGET
//    The target balance for the Liquidity Reserve bucket specifically.
//    The Operating Cash bucket already covers the 2-month operatingTarget,
//    so the reserve bucket covers the remaining shortfall.
//    = reserveTarget − operatingTarget
//
//  OPERATING FLOOR AT TROUGH
//    The client's operating account requirement as it stands AT the trough,
//    not today. Same 2-month-forward methodology as today's operating target,
//    but anchored to the trough month instead of the bonus date.
//    = outflows(troughMonth+1) + outflows(troughMonth+2)
//    When trough = November: December outflows + January outflows.
//
//  OPERATING TARGET (today)
//    The 2-month forward outflow baseline from the bonus landing date.
//    Sizes the operating account right now — not part of the reserve target.
//    = outflows(bonusMonth+1) + outflows(bonusMonth+2)
//
//  GOAL SAVINGS
//    Capital earmarked for a defined near-term expenditure (home purchase etc.).
//    Calculation to be built; hardcoded at 0 until then.
//
//  TOTAL LIQUIDITY REQUIREMENT
//    Everything the client needs to hold for liquidity purposes.
//    = Reserve Target + Goal Savings
//
//  EXCESS LIQUIDITY
//    = totalLiquid − Total Liquidity Requirement
//    totalLiquid = operatingCash + liquidityReserve + capitalBuild
//
// BONUS_DATE is set to Dec 31 2025 — the day the year-end bonus landed.
function computeLiquidityTargets(
  assets: Asset[],
  cashFlows: CashFlow[],
  bonusDate: Date = new Date(2025, 11, 31), // Dec 31, 2025
): {
  operatingCash:           number;
  operatingTarget:         number;
  operatingExcess:         number;
  liquidityReserve:        number;
  reserveTarget:           number;          // full 12-month liquidity requirement (NOT the Liquidity Reserve bucket target)
  liquidityReserveTarget:  number;          // Liquidity Reserve bucket target = reserveTarget − operatingTarget
  reserveExcess:           number;          // liquidityReserve above its own bucket target
  capitalBuild:            number;
  totalLiquid:             number;
  goalSavings:             number;
  totalLiquidityReq:       number;
  operatingFloorAtTrough:  number;
  troughDepth:             number;
  excessLiquidity:         number;
  monthlyRate:             number;
  coverageMonths:          number;
} {
  // ── Account groupings ──────────────────────────────────────────────────────
  // Operating Cash: checking accounts — instant same-day liquidity, no yield
  const operatingCash = assets
    .filter(a => a.type === "cash" && (a.description ?? "").toLowerCase().includes("checking"))
    .reduce((s, a) => s + Number(a.value), 0);

  // Liquidity Reserve: bank deposit products (savings, money market accounts,
  // high-yield savings) — same-day to T+1, FDIC-insured, yield-optimized
  const liquidityReserve = assets
    .filter(a => a.type === "cash" && !(a.description ?? "").toLowerCase().includes("checking"))
    .reduce((s, a) => s + Number(a.value), 0);

  // Capital Build: investment-grade short-duration market instruments —
  // Treasuries, T-bills, money market funds, CDs, munis, short-duration fixed income.
  // Excludes retirement accounts (401k, IRA, Roth) which are long-horizon, illiquid.
  const capitalBuild = assets
    .filter(a => a.type === "fixed_income" && !/401|ira|roth/i.test(a.description ?? ""))
    .reduce((s, a) => s + Number(a.value), 0);

  const totalLiquid = operatingCash + liquidityReserve + capitalBuild;

  // ── Helper: sum outflows for a given year/month (1-indexed month) ─────────
  const monthOutflows = (year: number, month: number): number =>
    cashFlows
      .filter(cf => cf.type === "outflow")
      .filter(cf => {
        const d = new Date(cf.date as string);
        return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
      })
      .reduce((s, cf) => s + Number(cf.amount), 0);

  // ── Trough — single source of truth from CF tab computation ──────────────
  const { troughIdx, troughDepth } = computeCumulativeNCF(cashFlows);

  // ── Operating floor AT the trough ────────────────────────────────────────
  // 2 months forward from the trough month (not from today).
  // troughIdx is 0-based into CF_MONTHS (Nov trough → idx 10).
  // Wraps correctly: Nov+1 = Dec (idx 11), Nov+2 = Jan (idx 0).
  const fwd1 = CF_MONTHS[(troughIdx + 1) % CF_MONTHS.length];
  const fwd2 = CF_MONTHS[(troughIdx + 2) % CF_MONTHS.length];
  const operatingFloorAtTrough = monthOutflows(fwd1.year, fwd1.month)
                               + monthOutflows(fwd2.year, fwd2.month);

  // ── Reserve Target = total 12-month liquidity needed ─────────────────────
  const reserveTarget = troughDepth + operatingFloorAtTrough;

  // ── Operating target (today) ──────────────────────────────────────────────
  // 2 months forward from the bonus landing date. Sizes the operating account now.
  const bm  = bonusDate.getMonth();                                        // 0-indexed
  const bm1 = (bm + 1) % 12;
  const by1 = bm === 11 ? bonusDate.getFullYear() + 1 : bonusDate.getFullYear();
  const bm2 = (bm1 + 1) % 12;
  const by2 = bm1 === 11 ? by1 + 1 : by1;
  const operatingTarget = monthOutflows(by1, bm1 + 1) + monthOutflows(by2, bm2 + 1) || 63574;

  // ── Goal Savings ──────────────────────────────────────────────────────────
  // Capital earmarked for a near-term goal (home purchase, etc.).
  // For now: equals the Capital Build balance (Treasuries already earmarked).
  // For a new client with no Treasuries this is 0 automatically.
  // TODO: derive properly as max(0, eventAmount − projectedNCFtoEventDate)
  const goalSavings = capitalBuild;

  // ── Total Liquidity Requirement & Excess ─────────────────────────────────
  const totalLiquidityReq = reserveTarget + goalSavings;
  const excessLiquidity   = Math.max(0, totalLiquid - totalLiquidityReq);

  const operatingExcess = Math.max(0, operatingCash - operatingTarget);

  // ── Per-bucket targets ────────────────────────────────────────────────────
  // The Liquidity Reserve bucket does NOT need to cover the full reserveTarget —
  // the Operating Cash bucket already covers the 2-month operatingTarget.
  // Liquidity Reserve target = the remainder of the 12-month requirement.
  const liquidityReserveTarget = Math.max(0, reserveTarget - operatingTarget);
  const reserveExcess          = Math.max(0, liquidityReserve - liquidityReserveTarget);

  const monthlyRate    = operatingTarget / 2;
  const coverageMonths = monthlyRate > 0 ? totalLiquid / monthlyRate : 0;

  return {
    operatingCash,    operatingTarget,         operatingExcess,
    liquidityReserve, reserveTarget,           liquidityReserveTarget,  reserveExcess,
    capitalBuild,     totalLiquid,
    goalSavings,      totalLiquidityReq,
    operatingFloorAtTrough, troughDepth,
    excessLiquidity, monthlyRate, coverageMonths,
  };
}

// ─── Return Optimization Calculator ──────────────────────────────────────────
// Computes current vs. pro-forma after-tax annual income across all liquid,
// non-retirement accounts. "Pro-forma" uses the highest AT yield from
// BUCKET_PRODUCTS for each GURU bucket.
//
// Tax rates (Kessler — NYC resident):
//   Bank deposits (checking, savings, MM): 47% = federal 35% + NY state 8% + NYC 4%
//   Treasuries / treasury-only MMFs:       35% = federal only (state/city exempt)
//   Equity / LTCG:                         20%
//
// Best-product AT yields per bucket (highest atYield in BUCKET_PRODUCTS):
//   Checking → CIT Money Market Bank Account:   4.30% gross / 2.28% AT (BANK_TAX)
//   Reserve  → JPMorgan 100% Treasuries MMF:    4.30% gross / 2.80% AT (TREAS_TAX)
//   Capital  → S&P Low Volatility Index ETF:    6.50% gross / 4.42% AT (highest Build)
//   Equity   → investment portfolio (unchanged):10.00% gross / 8.00% AT (LTCG_TAX)
//
// Excluded: real_estate, alternatives (PE/crypto), unvested RSUs, retirement accts
const BANK_TAX       = 0.47;    // 47% — NYC combined: federal (35%) + state (8%) + city (4%)
const TREAS_TAX      = 0.35;    // 35% — federal only; treasury securities state/city exempt
const LTCG_TAX       = 0.20;    // 20% — long-term capital gains
const INVEST_GROSS   = 0.10;    // 10% — assumed gross investment portfolio return
const CHECKING_GROSS = 0.0001;  // 0.01% — actual checking yield (from ASSET_RETURNS data)

const PROFORMA_AT = {
  checking: 0.0228, // CIT Money Market: 4.30% gross × (1 − 47%) = 2.28% AT
  reserve:  0.0280, // JPMorgan 100% Treasuries MMF: 4.30% × (1 − 35%) = 2.80% AT
  capital:  0.0520, // S&P Low Volatility Index: 6.50% × (1 − 20% LTCG) = 5.20% AT (highest Build)
  equity:   INVEST_GROSS * (1 - LTCG_TAX), // 8.00% AT — unchanged, already invested
} as const;

interface ReturnAccountDetail {
  description:      string;
  balance:          number;
  grossYield:       number;
  currentATYield:   number;
  currentATIncome:  number;
  proformaATYield:  number;
  proformaATIncome: number;
  bucket:           keyof typeof PROFORMA_AT;
}

function parseYieldFromDesc(description: string): number | null {
  const m = (description ?? "").match(/(\d+\.?\d*)%/);
  return m ? parseFloat(m[1]) / 100 : null;
}

function computeReturnOptimization(assets: Asset[], cashFlows?: CashFlow[]): {
  accounts:             ReturnAccountDetail[];
  currentAnnualIncome:  number;
  proformaAnnualIncome: number;
  annualPickup:         number;
} {
  const accounts: ReturnAccountDetail[] = [];

  for (const a of assets) {
    const rawDesc = a.description ?? "";
    const desc    = rawDesc.toLowerCase();
    const balance = Number(a.value ?? 0);
    if (balance <= 0) continue;

    // Exclusions
    if (a.type === "real_estate")         continue;
    if (a.type === "alternative")         continue;
    if (/401|ira|roth/i.test(rawDesc))    continue;  // retirement accounts
    if (/rsu|unvested|carry/i.test(desc)) continue;  // illiquid / unvested equity

    let bucket: ReturnAccountDetail["bucket"];
    let grossYield: number;
    let taxRate: number;

    if (a.type === "cash") {
      if (desc.includes("checking")) {
        bucket     = "checking";
        grossYield = CHECKING_GROSS; // 0.01% — actual checking yield (ASSET_RETURNS)
        taxRate    = BANK_TAX;       // 47% — NYC combined rate for bank deposit interest
      } else {
        bucket     = "reserve";
        grossYield = parseYieldFromDesc(rawDesc) ?? CHECKING_GROSS;
        // Treasuries-only MMFs (e.g. Fidelity SPAXX govt variant) → 35%; bank deposits → 47%
        // Fidelity Cash Sweep is a general purpose MMF → BANK_TAX
        taxRate    = BANK_TAX;
      }
    } else if (a.type === "fixed_income") {
      bucket     = "capital";
      grossYield = parseYieldFromDesc(rawDesc) ?? 0.035;
      taxRate    = TREAS_TAX; // Treasuries: federal only (35%), state/city exempt
    } else if (a.type === "equity") {
      bucket     = "equity";
      grossYield = INVEST_GROSS;
      taxRate    = LTCG_TAX;
    } else {
      continue;
    }

    const currentATYield  = grossYield * (1 - taxRate);
    const proformaATYield = PROFORMA_AT[bucket];

    accounts.push({
      description:      rawDesc,
      balance,
      grossYield,
      currentATYield,
      currentATIncome:  Math.round(balance * currentATYield),
      proformaATYield,
      proformaATIncome: Math.round(balance * proformaATYield),
      bucket,
    });
  }

  const currentAnnualIncome = accounts.reduce((s, a) => s + a.currentATIncome, 0);

  let proformaAnnualIncome: number;

  if (cashFlows) {
    // Target-based pro-forma: matches income optimization table exactly.
    // Each bucket is sized to its target; excess cash is deployed to new investments at equity rate.
    const {
      operatingTarget,
      liquidityReserveTarget,
      capitalBuild: capitalBuildBal,
      excessLiquidity,
    } = computeLiquidityTargets(assets, cashFlows);

    // Equity bucket: existing accounts, pro-forma rate already at PROFORMA_AT.equity
    const equityProforma = accounts
      .filter(a => a.bucket === "equity")
      .reduce((s, a) => s + a.proformaATIncome, 0);

    proformaAnnualIncome = Math.round(
      operatingTarget   * PROFORMA_AT.checking +  // Operating at CIT MM rate
      liquidityReserveTarget * PROFORMA_AT.reserve + // Reserve at JPMorgan Treasuries MMF rate
      capitalBuildBal   * PROFORMA_AT.capital +   // Capital Build at S&P Low Vol rate
      equityProforma +                             // Existing equity unchanged
      excessLiquidity   * PROFORMA_AT.equity       // New investments: excess deployed at 8% AT
    );
  } else {
    // Legacy: apply best rate to full current balance per bucket (no redistribution)
    proformaAnnualIncome = accounts.reduce((s, a) => s + a.proformaATIncome, 0);
  }

  const annualPickup = proformaAnnualIncome - currentAnnualIncome;

  return { accounts, currentAnnualIncome, proformaAnnualIncome, annualPickup };
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

  // ── Detection center calcs ───────────────────────────────────────────────
  // Local CF2 palette for detection center (mirrors cashflow panel definition)
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
    blue:     "#5b9cf6",
    INTER:    "Inter, system-ui, sans-serif",
    SERIF:    "'Instrument Serif', Georgia, serif",
  };

  // Excess liquidity — single source of truth via computeLiquidityTargets()
  const { totalLiquid: nwLiquid } = cashBuckets(assets);
  const {
    excessLiquidity: nwExcess,
  } = computeLiquidityTargets(assets, cashFlows);
  // Income pickup: full portfolio current AT income vs. pro-forma (target-based redistribution).
  // annualPickup = proformaAnnualIncome − currentAnnualIncome (true delta, not total optimized).
  const {
    currentAnnualIncome:  nwCurrentIncome,
    proformaAnnualIncome: nwProformaIncome,
    annualPickup:         nwPickup,
  } = computeReturnOptimization(assets, cashFlows);

  // Home equity & HELOC
  const reAssets   = assets.filter(a => a.type === "real_estate");
  const primaryRE  = reAssets.find(a => (a.description ?? "").toLowerCase().includes("primary") || (a.description ?? "").toLowerCase().includes("tribeca")) ?? reAssets[0];
  const primaryVal = primaryRE ? Number(primaryRE.value) : 0;
  const mortgages  = liabilities.filter(l => l.type === "mortgage");
  const primaryMortgage = mortgages.find(l => (l.description ?? "").toLowerCase().includes("tribeca") || (l.description ?? "").toLowerCase().includes("primary")) ?? mortgages[0];
  const mortgageBalance = primaryMortgage ? Number(primaryMortgage.value) : 0;
  const homeEquity  = primaryVal - mortgageBalance;
  const helocAvail  = Math.max(0, Math.round(primaryVal * 0.80 - mortgageBalance));
  const homeLTV     = primaryVal > 0 ? Math.round((mortgageBalance / primaryVal) * 100) : 0;

  // Investable equity for margin loan (liquid public equities only)
  const equityPortfolio = assets
    .filter(a => a.type === "equity" && !(a.description ?? "").toLowerCase().match(/rsu|unvested|carry/))
    .reduce((s, a) => s + Number(a.value), 0);
  const marginAvail = Math.round(equityPortfolio * 0.50);

  // High-rate liabilities (credit card, personal loans)
  const highRateLiab = liabilities
    .filter(l => Number(l.interestRate ?? 0) > 10)
    .reduce((s, l) => s + Number(l.value), 0);
  const highRateInt  = liabilities
    .filter(l => Number(l.interestRate ?? 0) > 10)
    .reduce((s, l) => s + Number(l.value) * Number(l.interestRate ?? 0) / 100, 0);

  // Debt-to-asset ratio
  const debtToAsset = totalAssets > 0 ? ((totalLiab / totalAssets) * 100).toFixed(1) : "0";
  const availCredit = helocAvail + marginAvail;

  return (
    <div className={PANEL_CLS}>
      {/* ── Panel header ── */}
      <div className="panel-hd">
        <span className="panel-hd-label">Net Worth</span>
        <span className="panel-hd-value">5yr&nbsp;<span className="text-emerald-600">{fmt(projYear5, true)}</span></span>
      </div>

      {/* ── GURU Detection Banner ─────────────────────────────────────────────── */}
      <div style={{ margin:"0 0 0", position:"relative", background:"#3a5580", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-40, left:-40, width:260, height:180, background:"radial-gradient(ellipse at center,rgba(100,160,240,0.15) 0%,transparent 70%)", pointerEvents:"none", animation:"glowPulse 4s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:0, left:0, width:"100%", height:1, background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)", pointerEvents:"none" }} />
        {/* Ticker row */}
        <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 16px 4px", borderBottom:"1px solid rgba(255,255,255,0.08)", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, left:0, width:"35%", height:"100%", background:"linear-gradient(90deg,transparent,rgba(180,210,255,0.07),transparent)", pointerEvents:"none", animation:"scanLine 3.5s linear infinite" }} />
          <span style={{ fontFamily:CF2.INTER, fontSize:9, fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.12em", color:"rgba(180,210,255,0.85)", position:"relative" }}>▶ Balance Sheet Scan Active</span>
          <span style={{ fontFamily:CF2.INTER, fontSize:9, color:"rgba(255,255,255,0.3)", textTransform:"uppercase" as const, letterSpacing:"0.05em" }}>GURU AI</span>
        </div>
        {/* Header row */}
        <div style={{ display:"flex", alignItems:"center", padding:"7px 16px 6px" }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:"#5ecc8a", display:"inline-block", flexShrink:0, animation:"alertDot 2s ease-in-out infinite", marginRight:8 }} />
          <span style={{ fontFamily:CF2.INTER, fontSize:11, fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.09em", color:"rgba(180,215,255,0.95)" }}>Detection System</span>
          <span style={{ fontFamily:CF2.INTER, fontSize:9, color:"rgba(255,255,255,0.3)", marginLeft:"auto", letterSpacing:"0.04em" }}>4 active</span>
        </div>
        {/* ── HERO: Excess Liquidity ── */}
        <div style={{ margin:"0 12px 8px", padding:"12px 16px", background:"rgba(0,0,0,0.22)", borderRadius:6, borderLeft:"2.5px solid rgba(94,204,138,0.55)", position:"relative", overflow:"hidden", animation:"borderRunGreen 4s ease-in-out infinite", animationDelay:"1s" }}>
          <div style={{ position:"absolute", top:-16, right:-16, width:160, height:110, background:"radial-gradient(ellipse at center,rgba(94,204,138,0.08) 0%,transparent 70%)", pointerEvents:"none" }} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#5ecc8a", display:"inline-block", animation:"alertDot 2s ease-in-out infinite" }} />
              <span style={{ fontFamily:CF2.INTER, fontSize:9.5, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.12em", color:"rgba(94,204,138,0.9)" }}>Liquidity Signal</span>
            </div>
            <span style={{ fontFamily:CF2.INTER, fontSize:9, color:"rgba(255,255,255,0.28)" }}>6h ago</span>
          </div>
          <div style={{ fontFamily:CF2.INTER, fontSize:12, fontWeight:700, color:"rgba(180,215,255,0.95)", letterSpacing:"0.01em", marginBottom:10 }}>EXCESS LIQUIDITY DETECTED</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:0, marginBottom:10 }}>
            <div style={{ flex:1, paddingRight:16, borderRight:"1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontFamily:CF2.INTER, fontSize:9, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.09em", color:"rgba(255,255,255,0.38)", marginBottom:3 }}>Excess Liquidity</div>
              <div style={{ fontFamily:CF2.INTER, fontSize:30, fontWeight:300, lineHeight:1, color:CF2.green, fontVariantNumeric:"tabular-nums" as const }}>{`$${Math.round(nwExcess).toLocaleString()}`}</div>
              <div style={{ fontFamily:CF2.INTER, fontSize:9.5, color:"rgba(255,255,255,0.45)", marginTop:4 }}>Above total liquidity requirement · <span style={{ color:"rgba(94,204,138,0.7)" }}>deployable now</span></div>
            </div>
            <div style={{ flex:1, paddingLeft:16 }}>
              <div style={{ fontFamily:CF2.INTER, fontSize:9, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.09em", color:"rgba(255,255,255,0.38)", marginBottom:3 }}>Income Pickup</div>
              <div style={{ fontFamily:CF2.INTER, fontSize:30, fontWeight:300, lineHeight:1, color:CF2.green, fontVariantNumeric:"tabular-nums" as const }}>{`+$${Math.round(nwPickup).toLocaleString()}`}<span style={{ fontSize:12, color:"rgba(94,204,138,0.7)", marginLeft:2 }}>/yr</span></div>
              <div style={{ fontFamily:CF2.INTER, fontSize:9.5, color:"rgba(255,255,255,0.45)", marginTop:4 }}>Pro-forma vs. current · <span style={{ color:"rgba(94,204,138,0.7)" }}>${Math.round(nwCurrentIncome).toLocaleString()} → ${Math.round(nwProformaIncome).toLocaleString()}/yr</span></div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"2px 8px", borderRadius:4, border:"1px solid rgba(94,204,138,0.35)", background:"rgba(94,204,138,0.08)" }}>
              <span style={{ fontFamily:CF2.INTER, fontSize:9, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.06em", color:"#5ecc8a" }}>Opportunity</span>
            </div>
            <span style={{ fontFamily:CF2.INTER, fontSize:9, fontWeight:600, color:"rgba(180,215,255,0.5)" }}>→ Allocation ↗</span>
          </div>
        </div>
        {/* ── 3 small detection cards ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, padding:"0 12px 12px" }}>
          {/* Card: High-Rate Liability */}
          <div style={{ padding:"9px 11px", background:"rgba(0,0,0,0.18)", borderRadius:6, display:"flex", flexDirection:"column" as const, gap:0, animation:"borderRunAmber 4s ease-in-out infinite", animationDelay:"0.5s" }}>
            <div style={{ fontFamily:CF2.INTER, fontSize:9, color:"rgba(255,255,255,0.28)", textAlign:"right" as const, marginBottom:3 }}>active</div>
            <div style={{ fontFamily:CF2.INTER, fontSize:10.5, fontWeight:700, color:"rgba(180,215,255,0.95)", lineHeight:1.2, marginBottom:5 }}>HIGH-RATE LIABILITY</div>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:2, flex:1, marginBottom:6 }}>
              <div style={{ fontFamily:CF2.INTER, fontSize:10, color:"rgba(255,255,255,0.6)", lineHeight:1.3, display:"flex", gap:4 }}><span style={{ color:"rgba(255,255,255,0.25)" }}>·</span><span>CC + loans at ~{liabilities.filter(l=>Number(l.interestRate??0)>10).map(l=>`${Number(l.interestRate).toFixed(0)}%`).join(", ")}</span></div>
              <div style={{ fontFamily:CF2.INTER, fontSize:10, color:"rgba(255,255,255,0.6)", lineHeight:1.3, display:"flex", gap:4 }}><span style={{ color:"rgba(255,255,255,0.25)" }}>·</span><span>{fmt(Math.round(highRateInt))}/yr interest · margin loan saves {fmt(Math.round(highRateInt * 0.65))}</span></div>
            </div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 7px", borderRadius:4, border:"1px solid rgba(255,200,60,0.35)", background:"rgba(255,200,60,0.08)", alignSelf:"flex-start" as const }}>
              <span style={{ fontFamily:CF2.INTER, fontSize:9, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.06em", color:"#ffc83c" }}>Action</span>
            </div>
          </div>
          {/* Card: HELOC Opportunity */}
          <div style={{ padding:"9px 11px", background:"rgba(0,0,0,0.18)", borderRadius:6, display:"flex", flexDirection:"column" as const, gap:0, animation:"borderRunBlue 4s ease-in-out infinite", animationDelay:"1.5s" }}>
            <div style={{ fontFamily:CF2.INTER, fontSize:9, color:"rgba(255,255,255,0.28)", textAlign:"right" as const, marginBottom:3 }}>unused</div>
            <div style={{ fontFamily:CF2.INTER, fontSize:10.5, fontWeight:700, color:"rgba(180,215,255,0.95)", lineHeight:1.2, marginBottom:5 }}>HELOC AVAILABLE</div>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:2, flex:1, marginBottom:6 }}>
              <div style={{ fontFamily:CF2.INTER, fontSize:10, color:"rgba(255,255,255,0.6)", lineHeight:1.3, display:"flex", gap:4 }}><span style={{ color:"rgba(255,255,255,0.25)" }}>·</span><span>{homeLTV}% LTV on {fmt(primaryVal, true)} home</span></div>
              <div style={{ fontFamily:CF2.INTER, fontSize:10, color:"rgba(255,255,255,0.6)", lineHeight:1.3, display:"flex", gap:4 }}><span style={{ color:"rgba(255,255,255,0.25)" }}>·</span><span>Up to {fmt(helocAvail, true)} at 80% LTV · prime +0.5%</span></div>
            </div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 7px", borderRadius:4, border:"1px solid rgba(91,143,204,0.35)", background:"rgba(91,143,204,0.08)", alignSelf:"flex-start" as const }}>
              <span style={{ fontFamily:CF2.INTER, fontSize:9, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.06em", color:"#5b8fcc" }}>Opportunity</span>
            </div>
          </div>
          {/* Card: Margin Loan */}
          <div style={{ padding:"9px 11px", background:"rgba(0,0,0,0.18)", borderRadius:6, display:"flex", flexDirection:"column" as const, gap:0, animation:"borderRunBlue 4s ease-in-out infinite", animationDelay:"2.5s" }}>
            <div style={{ fontFamily:CF2.INTER, fontSize:9, color:"rgba(255,255,255,0.28)", textAlign:"right" as const, marginBottom:3 }}>unused</div>
            <div style={{ fontFamily:CF2.INTER, fontSize:10.5, fontWeight:700, color:"rgba(180,215,255,0.95)", lineHeight:1.2, marginBottom:5 }}>MARGIN LOAN</div>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:2, flex:1, marginBottom:6 }}>
              <div style={{ fontFamily:CF2.INTER, fontSize:10, color:"rgba(255,255,255,0.6)", lineHeight:1.3, display:"flex", gap:4 }}><span style={{ color:"rgba(255,255,255,0.25)" }}>·</span><span>{fmt(equityPortfolio, true)} eligible equity portfolio</span></div>
              <div style={{ fontFamily:CF2.INTER, fontSize:10, color:"rgba(255,255,255,0.6)", lineHeight:1.3, display:"flex", gap:4 }}><span style={{ color:"rgba(255,255,255,0.25)" }}>·</span><span>Up to {fmt(marginAvail, true)} at ~7.5% · no approval needed</span></div>
            </div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 7px", borderRadius:4, border:"1px solid rgba(91,143,204,0.35)", background:"rgba(91,143,204,0.08)", alignSelf:"flex-start" as const }}>
              <span style={{ fontFamily:CF2.INTER, fontSize:9, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.06em", color:"#5b8fcc" }}>Opportunity</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Table ─────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:6, padding:"10px 10px 4px", alignItems:"stretch" }}>
        {/* Hero: Net Worth */}
        <div style={{ background:CF2.card, border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"14px 16px", flexShrink:0, display:"flex", flexDirection:"column" as const, justifyContent:"center", gap:7, minWidth:160 }}>
          <div style={{ fontFamily:CF2.INTER, fontSize:10, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.08em", color:"rgba(255,255,255,0.55)" }}>Net Worth</div>
          <div style={{ fontFamily:CF2.INTER, fontSize:28, fontWeight:300, lineHeight:1, color:CF2.green, fontVariantNumeric:"tabular-nums" as const }}>{fmt(netWorth, true)}</div>
          <span style={{ fontFamily:CF2.INTER, fontSize:9, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.06em", padding:"2px 7px", borderRadius:4, alignSelf:"flex-start" as const, background:"rgba(94,204,138,0.08)", border:"1px solid rgba(94,204,138,0.2)", color:CF2.green }}>
            {fmt(projYear5, true)} projected 5yr
          </span>
        </div>
        {/* KPI grid */}
        <div style={{ flex:1, background:CF2.card, border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, overflow:"hidden" }}>
          <table style={{ width:"100%", height:"100%", borderCollapse:"collapse" as const }}>
            <tbody>
              {([
                [
                  { label:"Total Assets",     value:fmt(totalAssets, true),              note:"All asset classes"         },
                  { label:"Total Liabilities",value:fmt(totalLiab, true),                note:"Debt obligations",         valueColor:CF2.red },
                ],
                [
                  { label:"Debt-to-Asset",    value:`${debtToAsset}%`,                   note:"Total liab / total assets" },
                  { label:"Home LTV",         value:`${homeLTV}%`,                        note:`${fmt(mortgageBalance, true)} / ${fmt(primaryVal, true)}` },
                ],
                [
                  { label:"Available Credit", value:fmt(availCredit, true),              note:"HELOC + margin combined",  valueColor:CF2.blue },
                  { label:"Idle Capital",     value:fmt(Math.round(nwExcess), true),     note:"Above reserve floor",      valueColor:CF2.amber },
                ],
              ] as { label:string; value:string; note:string; valueColor?:string }[][]).map((row, ri) => (
                <tr key={ri} style={{ borderBottom: ri < 2 ? `1px solid ${CF2.divider}` : "none" }}>
                  {row.map((kpi, ci) => (
                    <React.Fragment key={kpi.label}>
                      {ci === 1 && <td style={{ width:1, borderLeft:`1px solid ${CF2.divider}` }} />}
                      <td style={{ padding:"8px 5px 7px 12px", verticalAlign:"middle" }}>
                        <div style={{ fontFamily:CF2.INTER, fontSize:10, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.07em", color:"rgba(255,255,255,0.82)", marginBottom:2, whiteSpace:"nowrap" as const }}>{kpi.label}</div>
                        <div style={{ fontFamily:CF2.INTER, fontSize:9, color:"rgba(255,255,255,0.35)", lineHeight:1.3, whiteSpace:"nowrap" as const }}>{kpi.note}</div>
                      </td>
                      <td style={{ padding:"8px 12px 7px 4px", verticalAlign:"middle", textAlign:"right" as const, whiteSpace:"nowrap" as const }}>
                        <div style={{ fontFamily:CF2.INTER, fontSize:16, fontWeight:300, color:kpi.valueColor ?? "rgba(255,255,255,0.82)", fontVariantNumeric:"tabular-nums" as const, lineHeight:1 }}>{kpi.value}</div>
                      </td>
                    </React.Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            { label: "Reserve Cash",   value: yieldBucket, items: yieldItems    ?? [], color: "#d97706", border: "border-amber-200",   rowBg: "bg-amber-50/60",   rowBorder: "border-amber-100",   textCls: "text-amber-900",   amtCls: "text-amber-700"   },
            { label: "Capital Build", value: tactical, items: tacticalItems ?? [], color: "#16a34a", border: "border-emerald-200", rowBg: "bg-emerald-50/60", rowBorder: "border-emerald-100", textCls: "text-emerald-900", amtCls: "text-emerald-700" },
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

function DashboardFlowWidget({
  onNavigate,
  assets,
  cashFlows,
}: {
  onNavigate: () => void;
  assets: Asset[];
  cashFlows: CashFlow[];
}) {
  const { operatingCash, liquidityReserve, capitalBuild } = computeLiquidityTargets(assets, cashFlows);
  const [scheduled, setScheduled] = useState<Set<string>>(new Set(["prop-tax-jan"]));

  const OBLIGATIONS = [
    { id: "prop-tax-jan", label: "NYC Property Tax — 1st Installment", amount: 17500, due: new Date(2026, 0, 15), method: "Wire", category: "tax" },
    { id: "est-tax-q1",   label: "Federal Estimated Tax — Q1 2026",    amount: 30000, due: new Date(2026, 3, 15), method: "ACH",  category: "tax" },
    { id: "tuition-spring", label: "Dalton — Spring Tuition",   amount: 15000, due: new Date(2026, 3, 1),  method: "Wire", category: "education" },
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
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3">Scheduled Cash Movements · {format(addMonths(DEMO_NOW, 1), "MMMM")}</p>
          <div className="flex flex-col gap-0">

            {/* Operating Cash bucket row */}
            <div className="flex items-stretch gap-2" data-testid="mini-flow-ops">
              <div className="w-[78px] flex-shrink-0 rounded-lg flex flex-col items-center justify-center gap-1 py-3" style={{ background: "#1d4ed8" }}>
                <Wallet className="w-3 h-3 text-white/80" />
                <span className="font-black uppercase tracking-widest text-white text-center px-1 text-[8px] leading-tight">Operating Cash</span>
                <span className="font-black tabular-nums text-white/90 text-[9px]">{fmt(operatingCash)}</span>
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
                <span className="font-black uppercase tracking-widest text-white text-center px-1 text-[8px] leading-tight">Reserve Cash</span>
                <span className="font-black tabular-nums text-white/90 text-[9px]">{fmt(liquidityReserve)}</span>
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

type LiquidBucket = "operating" | "reserve" | "capital" | null;

interface BsGroup {
  category: string;
  items: {
    label: string;
    subtitle?: string | null;
    value: number;
    rate: string | null;
    ret: string | null;
    atYield: string | null;
    comment: AssetComment | null;
    bucket?: LiquidBucket;
  }[];
  subtotal: number;
  avgRate: string | null;
  avgAtYield: string | null;
}

interface BsSection {
  label: string;
  groups: BsGroup[];
  total: number;
}

// Weighted average after-tax yield from already-computed items (used by buildAssetGroups + BsTable).
function wavgAtYieldFromItems(items: Array<{ value: number; atYield: string | null }>): string | null {
  let wsum = 0, covered = 0;
  for (const it of items) {
    if (!it.atYield) continue;
    const isPlus = it.atYield.startsWith("+");
    const pct = parseFloat(isPlus ? it.atYield.slice(1).replace("%", "") : it.atYield.replace("%", ""));
    if (!isNaN(pct)) { wsum += pct * it.value; covered += it.value; }
  }
  if (!covered) return null;
  const avg = wsum / covered;
  if (avg <= 0.005) return null;
  const equityVal = items.filter(i => i.atYield?.startsWith("+")).reduce((s, i) => s + i.value, 0);
  return equityVal > covered / 2 ? `+${avg.toFixed(1)}%` : `${avg.toFixed(2)}%`;
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

  const mkBrokerageCashGroup = (): BsGroup => {
    const items = brokerageCash.map((a) => {
      const desc = a.description ?? "";
      const isFidelity = desc.toLowerCase().includes("fidelity");
      const grossRet = lookupReturn(desc);
      return {
        label: isFidelity ? "Fidelity (Cash)" : desc.split("(")[0].split("—")[0].split("–")[0].trim(),
        subtitle: lookupBsSubtitle(desc, BS_ASSET_SUBTITLES),
        value: Number(a.value),
        rate: extractRate(desc),
        ret: grossRet,
        atYield: atYieldStr(grossRet, a.type),
        comment: assetComment(a),
        bucket: getBucket(a),
      };
    });
    return {
      category: "Brokerage Cash",
      items,
      subtotal: brokerageCash.reduce((s, a) => s + Number(a.value), 0),
      avgRate: wavgRate(brokerageCash),
      avgAtYield: wavgAtYieldFromItems(items),
    };
  };

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
    const map: Record<string, { value: number; descs: string[]; primaryType: string }> = {};
    for (const a of arr) {
      const inst = extractInstitution(a.description ?? "");
      if (!map[inst]) map[inst] = { value: 0, descs: [], primaryType: a.type };
      map[inst].value += Number(a.value);
      map[inst].descs.push(a.description ?? "");
      // If any holding is equity, the group uses equity (LTCG) tax treatment
      if (a.type === "equity") map[inst].primaryType = "equity";
    }
    const items = Object.entries(map).map(([inst, data]) => {
      const grossRet = lookupReturn(data.descs.length === 1 ? data.descs[0] : inst);
      // Capital Build: fixed_income, non-retirement assets earn the "capital" bucket badge
      const bucket: LiquidBucket = data.primaryType === "fixed_income" ? "capital" : null;
      return {
        label: inst,
        subtitle: lookupBsSubtitle(inst, BS_ASSET_SUBTITLES) ??
                  lookupBsSubtitle(data.descs[0] ?? "", BS_ASSET_SUBTITLES),
        value: data.value,
        rate: null as string | null,
        ret: grossRet,
        atYield: atYieldStr(grossRet, data.primaryType),
        comment: null as AssetComment | null,
        bucket,
      };
    });
    return {
      category: "Taxable Brokerage",
      items,
      subtotal: arr.reduce((s, a) => s + Number(a.value), 0),
      avgRate: null,
      avgAtYield: wavgAtYieldFromItems(items),
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

  // Compute after-tax yield string from a gross return string and asset type.
  // - "+ prefix" = total equity return → LTCG tax rate (20%)
  // - plain "X.XX%" = income yield → TREAS_TAX (35%) for fixed_income, BANK_TAX (47%) for cash
  // - IRR / est. / negligible (≤0.01%) → null (too complex or immaterial)
  const atYieldStr = (grossRet: string | null, assetType: string): string | null => {
    if (!grossRet) return null;
    if (grossRet.includes("IRR") || grossRet.includes("est.")) return null;
    if (grossRet.startsWith("+")) {
      const pct = parseFloat(grossRet.slice(1).replace("%", ""));
      if (isNaN(pct)) return null;
      return `+${(pct * (1 - LTCG_TAX)).toFixed(1)}%`;
    }
    const pct = parseFloat(grossRet.replace("%", ""));
    if (isNaN(pct) || pct <= 0.01) return null;
    const taxRate = assetType === "fixed_income" ? TREAS_TAX : BANK_TAX;
    return `${(pct * (1 - taxRate)).toFixed(2)}%`;
  };

  const getBucket = (a: Asset): LiquidBucket => {
    const d = (a.description ?? "").toLowerCase();
    if (a.type === "cash" && d.includes("checking")) return "operating";
    if (a.type === "cash") return "reserve";
    if (a.type === "fixed_income" && !isRetirement(a)) return "capital";
    return null;
  };

  const toItem = (a: Asset) => {
    const grossRet = lookupReturn(a.description);
    return {
      label: a.description.split("(")[0].split("—")[0].split("–")[0].trim(),
      subtitle: lookupBsSubtitle(a.description, BS_ASSET_SUBTITLES),
      value: Number(a.value),
      rate: extractRate(a.description),
      ret: grossRet,
      atYield: atYieldStr(grossRet, a.type),
      comment: assetComment(a),
      bucket: getBucket(a),
    };
  };

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
  const mkGroup = (category: string, arr: Asset[]): BsGroup => {
    const items = arr.map(toItem);
    return { category, items, subtotal: subtot(arr), avgRate: wavgRate(arr), avgAtYield: wavgAtYieldFromItems(items) };
  };

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
    atYield: null as string | null,
    comment: liabComment(l),
  });

  const groups: BsGroup[] = [];
  if (cc.length)
    groups.push({
      category: "Credit Cards / Lines of Credit",
      items: cc.map(toItem),
      subtotal: subtot(cc),
      avgRate: wavgRate(cc),
      avgAtYield: null,
    });
  if (student.length)
    groups.push({
      category: "Student Loans",
      items: student.map(toItem),
      subtotal: subtot(student),
      avgRate: wavgRate(student),
      avgAtYield: null,
    });
  if (mortg.length)
    groups.push({
      category: "Mortgages",
      items: mortg.map(toItem),
      subtotal: subtot(mortg),
      avgRate: wavgRate(mortg),
      avgAtYield: null,
    });
  if (profLoan.length)
    groups.push({
      category: "Professional Loans (Private Equity)",
      items: profLoan.map(toItem),
      subtotal: subtot(profLoan),
      avgRate: wavgRate(profLoan),
      avgAtYield: null,
    });
  if (capComm.length)
    groups.push({
      category: "Remaining Capital Commitment",
      items: capComm.map(toItem),
      subtotal: subtot(capComm),
      avgRate: null,
      avgAtYield: null,
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
  const COLS = isLiability ? "1fr 90px 72px 90px" : "minmax(100px,220px) 76px 90px 62px 62px 80px";
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

  const BUCKET_PILL: Record<NonNullable<LiquidBucket>, { label: string; bg: string; color: string }> = {
    operating: { label: "Operating",  bg: "rgba(91,143,204,0.15)", color: "hsl(215,65%,65%)" },
    reserve:   { label: "Reserve",    bg: "rgba(255,200,60,0.12)",  color: "hsl(42,80%,60%)"  },
    capital:   { label: "Capital",    bg: "rgba(180,140,80,0.15)", color: "hsl(35,65%,58%)"  },
  };

  const renderItems = (items: BsGroup["items"], indent = "pl-8") =>
    items.map((item, ii) => {
      const rowBg = ii % 2 === 0 ? BS_BG_BASE : BS_BG_ALT;
      const rateVal = item.ret ?? (item.rate ? `${item.rate}%` : null);
      const pill = item.bucket ? BUCKET_PILL[item.bucket] : null;
      return (
        <div key={ii} className="grid" style={{ gridTemplateColumns: COLS, background: rowBg }}>
          <div style={{ ...cellBase, paddingLeft: 28 }}>
            <div style={{ color: BS_TEXT_MUTED, lineHeight: 1.3 }}>{item.label}</div>
            {item.subtitle && (
              <div style={{ fontFamily: MONO, fontSize: 9, color: "hsl(210,15%,40%)", lineHeight: 1.3, marginTop: 1 }}>{item.subtitle}</div>
            )}
          </div>
          {!isLiability && (
            <div style={{ ...cellBase, textAlign: "center", padding: "4px 6px" }}>
              {pill ? (
                <span style={{ display: "inline-block", fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "1px 5px", borderRadius: 10, background: pill.bg, color: pill.color, whiteSpace: "nowrap" }}>
                  {pill.label}
                </span>
              ) : null}
            </div>
          )}
          <div style={{ ...cellBase, textAlign: "right", color: item.value > 0 ? BS_TEXT : BS_TEXT_MUTED, fontWeight: 500 }}>
            {item.value > 0 ? fmt(item.value) : "—"}
          </div>
          <div style={{ ...cellBase, textAlign: "right", color: retColor(rateVal) }}>
            {!isLiability
              ? (item.ret ?? (item.rate ? `${item.rate}%` : <span style={{ color: "hsl(210,10%,30%)" }}>—</span>))
              : (item.rate ? `${item.rate}%` : <span style={{ color: "hsl(210,10%,30%)" }}>—</span>)
            }
          </div>
          {!isLiability && (
            <div style={{ ...cellBase, textAlign: "right", color: item.atYield ? (item.atYield.startsWith("+") ? "hsl(152,55%,55%)" : "hsl(152,40%,48%)") : "hsl(210,10%,30%)" }}>
              {item.atYield ?? <span style={{ color: "hsl(210,10%,30%)" }}>—</span>}
            </div>
          )}
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
          {!isLiability && <div style={{ ...cellBase, borderBottom: "none" }} />}
          <div style={{ ...cellBase, textAlign: "right", fontWeight: 700, color: BS_TEXT, borderBottom: "none" }}>{fmt(group.subtotal)}</div>
          <div style={{ ...cellBase, textAlign: "right", color: BS_TEXT_MUTED, borderBottom: "none" }}>
            {group.avgRate ? `${group.avgRate}%` : ""}
          </div>
          {!isLiability && (
            <div style={{ ...cellBase, textAlign: "right", color: group.avgAtYield ? (group.avgAtYield.startsWith("+") ? "hsl(152,52%,52%)" : "hsl(152,38%,45%)") : "", borderBottom: "none" }}>
              {group.avgAtYield ?? ""}
            </div>
          )}
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
      {/* Parent "Yield / Return" label spanning Pre-Tax + After-Tax columns */}
      {!isLiability && (
        <div className="grid" style={{ gridTemplateColumns: COLS, background: BS_BG_GRANDTOT, borderBottom: `1px solid ${BS_BORDER_SEC}`, minHeight: 20 }}>
          <div style={{ gridColumn: "1 / 4" }} />
          <div style={{ gridColumn: "4 / 6", textAlign: "center", fontSize: 8, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "hsl(210,35%,55%)", padding: "3px 8px 2px" }}>
            Yield / Return
          </div>
          <div />
        </div>
      )}
      {/* Header */}
      <div className="grid" style={{ gridTemplateColumns: COLS, background: BS_BG_GRANDTOT }}>
        <div style={{ ...hdrCell, paddingLeft: 12 }}>{isLiability ? "Liability Category" : "Asset Category"}</div>
        {!isLiability && <div style={{ ...hdrCell, textAlign: "center" }}>Bucket</div>}
        <div style={{ ...hdrCell, textAlign: "right" }}>Balance</div>
        <div style={{ ...hdrCell, textAlign: "right" }}>{isLiability ? "Cost" : "Pre-Tax"}</div>
        {!isLiability && <div style={{ ...hdrCell, textAlign: "right" }}>After-Tax</div>}
        <div style={{ ...hdrCell }}>Notes</div>
      </div>
      {/* Sectioned asset rows */}
      {sections && sections.map((sec) => (
        <div key={sec.label}>
          {sec.groups.map((group) => renderGroup(group, sec.groups.length > 1 || group.items.length > 1))}
          {/* Section total */}
          {(() => {
            const secItems = sec.groups.flatMap(g => g.items);
            const secAtYield = wavgAtYieldFromItems(secItems);
            return (
              <div className="grid" style={{ gridTemplateColumns: COLS, background: BS_BG_SECTOT, borderTop: `2px solid ${BS_BORDER_SEC}`, borderBottom: `2px solid ${BS_BORDER_SEC}` }}>
                <div style={{ ...cellBase, paddingLeft: 12, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: BS_GREEN_MED, borderLeft: `3px solid ${BS_GREEN_DIM}`, borderBottom: "none" }}>{sec.label}</div>
                {!isLiability && <div style={{ ...cellBase, borderBottom: "none" }} />}
                <div style={{ ...cellBase, textAlign: "right", fontWeight: 800, color: BS_TEXT, borderBottom: "none" }}>{fmt(sec.total)}</div>
                <div style={{ ...cellBase, borderBottom: "none" }} />
                {!isLiability && (
                  <div style={{ ...cellBase, textAlign: "right", color: secAtYield ? (secAtYield.startsWith("+") ? "hsl(152,52%,52%)" : "hsl(152,38%,45%)") : "", borderBottom: "none" }}>
                    {secAtYield ?? ""}
                  </div>
                )}
                <div style={{ ...cellBase, borderBottom: "none" }} />
              </div>
            );
          })()}
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
        {!isLiability && <div style={{ ...cellBase, borderBottom: "none" }} />}
        <div style={{ ...cellBase, textAlign: "right", fontWeight: 900, color: BS_TEXT, borderBottom: "none" }}>{fmt(totalValue)}</div>
        <div style={{ ...cellBase, textAlign: "right", color: BS_TEXT_MUTED, borderBottom: "none" }}>
          {totalRate ? `${totalRate}%` : ""}
        </div>
        {!isLiability && <div style={{ ...cellBase, borderBottom: "none" }} />}
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
    label: "Dalton Tuition",
    descs: ["Dalton Tuition"],
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
  // ── Canonical liquidity values — single source of truth for all KPIs ────────
  const {
    operatingCash:          cfOperatingCash,
    liquidityReserve:       cfLiquidityReserve,
    capitalBuild:           cfCapitalBuild,
    totalLiquid,
    reserveTarget,
    liquidityReserveTarget,
    totalLiquidityReq,
    excessLiquidity,
    operatingTarget:        cfOperatingTarget,
    troughDepth:            cfTroughDepth,
  } = computeLiquidityTargets(assets, cashFlows);

  // cashBuckets() used only for bucket item lists (drill-down display rows)
  const { reserveItems, yieldItems, tacticalItems } = cashBuckets(assets);
  const startBalance = cfOperatingCash;

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

  // Reserve floor for Liquidity Runway chart = Reserve Target from computeLiquidityTargets()
  // This is the minimum liquid balance the client must maintain at all times.
  const RESERVE_FLOOR = reserveTarget;
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
                  // excessLiquidity from computeLiquidityTargets() at component top.
                  // Income pickup: full portfolio current AT vs pro-forma (best product per bucket).
                  // annualPickup = proformaAnnualIncome − currentAnnualIncome (true delta).
                  const excessLiqAmt = excessLiquidity;
                  const {
                    currentAnnualIncome:  cfCurrentIncome,
                    proformaAnnualIncome: cfProformaIncome,
                    annualPickup:         potentialInc,
                  } = computeReturnOptimization(assets, cashFlows);
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
                            {`$${Math.round(excessLiqAmt).toLocaleString()}`}
                          </div>
                          <div style={{ fontFamily:CF2.INTER, fontSize:10, color:"rgba(255,255,255,0.45)", marginTop:5, lineHeight:1.4 }}>
                            Above total liquidity requirement &nbsp;·&nbsp; <span style={{ color:"rgba(94,204,138,0.7)" }}>fully deployable</span>
                          </div>
                        </div>
                        {/* Right: Potential Income Pickup */}
                        <div style={{ flex:1, paddingLeft:20 }}>
                          <div style={{ fontFamily:CF2.INTER, fontSize:10, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.09em", color:"rgba(255,255,255,0.38)", marginBottom:4 }}>Potential Income Pickup</div>
                          <div style={{ fontFamily:CF2.INTER, fontSize:36, fontWeight:300, lineHeight:1, color:CF2.green, fontVariantNumeric:"tabular-nums" as const, letterSpacing:"-0.01em" }}>
                            {`+$${Math.round(potentialInc).toLocaleString()}`}
                            <span style={{ fontSize:14, fontWeight:400, color:"rgba(94,204,138,0.7)", marginLeft:3 }}>/yr</span>
                          </div>
                          <div style={{ fontFamily:CF2.INTER, fontSize:10, color:"rgba(255,255,255,0.45)", marginTop:5, lineHeight:1.4 }}>
                            Pro-forma vs. current &nbsp;·&nbsp; <span style={{ color:"rgba(94,204,138,0.7)" }}>${Math.round(cfCurrentIncome).toLocaleString()} → ${Math.round(cfProformaIncome).toLocaleString()}/yr</span>
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
                          label={{ value:`${fmt(RESERVE_FLOOR)} reserve floor`, position:"insideTopRight", fill:"rgba(94,204,138,0.6)", fontSize:9, fontFamily:"Inter, system-ui, sans-serif", fontWeight:600 }}
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
              { key:"res",   label:"Reserve Cash",   color:"#e8a830", items:yieldItems,    total:yieldBucket },
              { key:"build", label:"Capital Build", color:"#2a9a5a", items:tacticalItems, total:tactical },
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
  { key: "res",  label: "Reserve Cash",   color: "#8a6e2e", accent: "#d4b87a", tag: "JPMorgan 100% Treasury MMF" },
  { key: "bld",  label: "Capital Build",  color: "#2e7a52", accent: "#7ac4a0", tag: "1yr Treasuries + 2028 Munis" },
  { key: "grw",  label: "Investments",    color: "#2e4e7a", accent: "#8aace0", tag: "Growth Equity ETFs" },
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
  { icon: GraduationCap,label: "Dalton School",       institution: "The Dalton School",  amount: 2500, cadence: "Monthly", bucket: "op",  next: "Apr 1" },
  { icon: ShieldCheck,  label: "Home + Auto Ins.",   institution: "Chubb",           amount: 660,  cadence: "Monthly", bucket: "op",  next: "Apr 15" },
  { icon: Bolt,         label: "Utilities",          institution: "ConEd / PSEG",    amount: 800,  cadence: "Monthly", bucket: "op",  next: "Apr 12" },
  { icon: Car,          label: "Auto Lease",         institution: "BMW Financial",   amount: 1150, cadence: "Monthly", bucket: "op",  next: "Apr 18" },
  { icon: ArrowLeftRight,label: "Reserve Top-Up",    institution: "GURU Auto",       amount: 0,    cadence: "As needed",bucket:"op",  next: "On deficit" },
  { icon: TrendingUp,   label: "401(k) Contribution",institution: "Fidelity",        amount: 3000, cadence: "Bi-weekly",bucket:"grw", next: "Apr 8" },
];

const MM_GURU_ACTIONS = [
  { month: "Jan", action: "Operating deficit $19,626 — pulled from Reserve MMF",    type: "pull",    amount: 19626 },
  { month: "Feb", action: "Operating surplus — no Reserve draw needed",              type: "balanced",amount: 0 },
  { month: "Mar", action: "Q1 tax + Dalton tuition — pulled $47,126 from Reserve",  type: "pull",    amount: 47126 },
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

// ─────────────────────────────────────────────────────────────────────────────
// LiquidityWaterfallView — GURU Intelligence · Liquidity Model tab
// Full row-by-row asset waterfall: Operating Cash → Liquidity Reserve → Capital Build
// Mirrors Excel Cash Flow tab rows 75–107. Financial model formatting.
// ─────────────────────────────────────────────────────────────────────────────
function LiquidityWaterfallView({ assets, cashFlows }: { assets: Asset[]; cashFlows: CashFlow[] }) {
  const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // ── Opening balances from single source of truth ───────────────────────────
  const { operatingCash, liquidityReserve, capitalBuild } = computeLiquidityTargets(assets, cashFlows);

  // ── Yields from current account balances (weighted average, not GURU optimizer picks) ──
  const opsBucketAssets = assets.filter(a => assetBucketKey(a) === "reserve");
  const rsvBucketAssets = assets.filter(a => assetBucketKey(a) === "yield_");
  const bldBucketAssets = assets.filter(a => assetBucketKey(a) === "tactical");
  const opsYields = liquidAssetYields(opsBucketAssets);
  const rsvYields = liquidAssetYields(rsvBucketAssets);
  const bldYields = liquidAssetYields(bldBucketAssets);
  const OPS_PRETAX = opsYields.pretax;  const OPS_AT = opsYields.at;
  const RSV_PRETAX = rsvYields.pretax;  const RSV_AT = rsvYields.at;
  const BLD_PRETAX = bldYields.pretax;  const BLD_AT = bldYields.at;

  // ── Income breakdown — matching CF Forecast categories ────────────────────
  // Compute income items using the same description-matching logic as CashFlowForecastWaterfallView.
  // This ensures "Total Income" here ties exactly to "Total Cash Income" in the CF Forecast tab.
  const CF_YEAR = 2026;
  const cashItems = (descs: string[], mo: number): number =>
    cashFlows
      .filter(cf => {
        const d = new Date(cf.date);
        return d.getUTCFullYear() === CF_YEAR &&
               (d.getUTCMonth() + 1) === mo &&
               cf.type === "inflow" &&
               descs.some(desc => (cf.description ?? "").includes(desc));
      })
      .reduce((s, cf) => s + Number(cf.amount), 0);

  const COMP_DESCS   = ["Michael — Net Monthly", "Monthly Net Salaries", "Sarah — Net Monthly", "Partner 1 Year-End", "Partner 2 Year-End"];
  const INT_DESCS    = ["Reserve MMF"];
  const RENTAL_DESCS = ["Investment Property Rental Income"];

  const forecast = buildForecast(cashFlows);

  // ── Month-by-month waterfall simulation ────────────────────────────────────
  // Operating Cash: all inflows land here; all expenses drawn from here.
  // Liquidity Reserve + Capital Build: static balances in this base scenario (no optimizer transfers).
  let opsBal = operatingCash;
  const rsvBal = liquidityReserve;
  const bldBal = capitalBuild;

  const data = MO.map((_mo, i) => {
    const moNum  = i + 1;
    const { outflow } = forecast[i];

    // Income — broken out to match CF Forecast structure
    const opsComp      = cashItems(COMP_DESCS,   moNum);  // compensation matches CF "Cash Compensation" subtotal
    const opsIntIncome = cashItems(INT_DESCS,     moNum);  // bank interest matches CF "Interest From Bank Accounts"
    const opsRental    = cashItems(RENTAL_DESCS,  moNum);  // rental income (netted into expenses per property view)
    const opsIncome    = opsComp + opsIntIncome;

    // Operating Cash flows — expenses are net (rental income offsets property costs)
    const opsBegin = opsBal;
    const opsExp   = outflow - opsRental;
    const opsEnd   = opsBal + opsIncome - opsExp;
    const opsAtInt = Math.max(0, opsEnd) * (OPS_AT / 12);
    opsBal = opsEnd;

    // Reserve — static balance, interest earned but not reinvested
    const rsvAtInt = rsvBal * (RSV_AT / 12);

    // Capital Build — static balance, interest earned but not reinvested
    const bldAtInt = bldBal * (BLD_AT / 12);

    return {
      mo: _mo,
      ops:  { begin: opsBegin, comp: opsComp, intIncome: opsIntIncome, income: opsIncome, expenses: opsExp, end: opsEnd, atInt: opsAtInt },
      rsv:  { begin: rsvBal, end: rsvBal, atInt: rsvAtInt },
      bld:  { begin: bldBal, end: bldBal, atInt: bldAtInt },
      totalEnd:   opsEnd + rsvBal + bldBal,
      totalAtInt: opsAtInt + rsvAtInt + bldAtInt,
    };
  });

  // ── Annual totals ──────────────────────────────────────────────────────────
  const ann = {
    opsComp:     data.reduce((s, d) => s + d.ops.comp,       0),
    opsIntIncome:data.reduce((s, d) => s + d.ops.intIncome,  0),
    opsIncome:   data.reduce((s, d) => s + d.ops.income,     0),
    opsExpenses: data.reduce((s, d) => s + d.ops.expenses,   0),
    opsAtInt:    data.reduce((s, d) => s + d.ops.atInt,      0),
    rsvAtInt:    data.reduce((s, d) => s + d.rsv.atInt,      0),
    bldAtInt:    data.reduce((s, d) => s + d.bld.atInt,      0),
    totalAtInt:  data.reduce((s, d) => s + d.totalAtInt,     0),
  };

  // ── Number formatters ──────────────────────────────────────────────────────
  const fmt = (v: number): string => {
    if (Math.round(v) === 0) return "—";
    const abs = Math.abs(Math.round(v));
    const s = abs.toLocaleString("en-US");
    return v < 0 ? `(${s})` : s;
  };
  const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

  // ── Design tokens ──────────────────────────────────────────────────────────
  const MONO  = "'JetBrains Mono', 'Courier New', monospace";
  const UI    = "Inter, system-ui, sans-serif";
  const DS_BG = "#0c1828";
  const GREEN = "#44e08a";
  const OPS_C = "#4a7fd4";
  const RSV_C = "#c49a30";
  const BLD_C = "#3aad61";
  const SEP_C = "rgba(255,255,255,0.08)";
  const COL_W = 76;
  const LBL_W = 240;
  const ANN_W = 96;

  // ── Shared cell style helpers ──────────────────────────────────────────────
  const cellBase: React.CSSProperties = {
    fontFamily: MONO, fontSize: 11, textAlign: "right" as const,
    padding: "3px 10px 3px 4px", whiteSpace: "nowrap" as const,
    color: "rgba(255,255,255,0.82)", borderLeft: `0.5px solid ${SEP_C}`,
    minWidth: COL_W, width: COL_W,
  };
  const labelBase: React.CSSProperties = {
    fontFamily: UI, fontSize: 11, padding: "3px 12px 3px 16px",
    color: "rgba(255,255,255,0.70)", whiteSpace: "nowrap" as const,
    position: "sticky" as const, left: 0, background: DS_BG, zIndex: 2,
    borderRight: `1px solid rgba(255,255,255,0.12)`,
    minWidth: LBL_W, width: LBL_W,
  };
  const annBase: React.CSSProperties = {
    ...cellBase, minWidth: ANN_W, width: ANN_W, fontWeight: 500,
    borderLeft: `1px solid rgba(255,255,255,0.18)`,
  };

  // ── Row builder helpers ────────────────────────────────────────────────────
  const rowBg = (shade: "normal"|"subtotal"|"ending"|"total"|"section"): React.CSSProperties => {
    switch (shade) {
      case "section":  return { background: "rgba(255,255,255,0.04)" };
      case "subtotal": return { background: "rgba(255,255,255,0.04)" };
      case "ending":   return { background: "rgba(255,255,255,0.07)" };
      case "total":    return { background: "rgba(255,255,255,0.11)" };
      default:         return { background: "transparent" };
    }
  };

  const sectionHeader = (label: string, color: string, product: string, pretax: string, at: string) => (
    <tr style={{ ...rowBg("section") }}>
      <td colSpan={14} style={{
        fontFamily: UI, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase" as const, color,
        padding: "6px 16px",
        position: "sticky" as const, left: 0,
        borderTop: `1px solid ${color}33`, borderBottom: `0.5px solid ${color}33`,
      }}>
        {label}
        <span style={{ marginLeft: 10, opacity: 0.55, fontWeight: 400, letterSpacing: "0.06em", fontSize: 9 }}>{product}</span>
        <span style={{ marginLeft: 14, opacity: 0.50, fontWeight: 400, letterSpacing: 0, fontSize: 9, textTransform: "none" as const }}>
          Pre-Tax: {pretax}&nbsp;&nbsp;·&nbsp;&nbsp;After-Tax: {at}
        </span>
      </td>
    </tr>
  );

  const dataRow = (
    label: string,
    values: number[],
    annVal: number | null,
    shade: "normal"|"subtotal"|"ending"|"total",
    opts: {
      indent?: number; color?: string; paren?: boolean; isGreen?: boolean;
      dim?: boolean; labelBold?: boolean;
    } = {}
  ) => {
    const { indent = 0, paren = false, isGreen = false, dim = false, labelBold = false } = opts;
    const bg = rowBg(shade);
    const txtColor = isGreen ? GREEN : dim ? "rgba(255,255,255,0.35)" : opts.color ?? "rgba(255,255,255,0.82)";
    const lBg = { ...bg, position: "sticky" as const, left: 0, zIndex: 2, borderRight: `1px solid rgba(255,255,255,0.12)` };
    return (
      <tr style={bg}>
        <td style={{ ...labelBase, ...lBg, paddingLeft: 16 + indent * 16, fontWeight: labelBold ? 600 : 400, color: isGreen ? GREEN : "rgba(255,255,255,0.75)" }}>
          {label}
        </td>
        {values.map((v, i) => {
          const display = paren ? (v !== 0 ? `(${Math.abs(Math.round(v)).toLocaleString("en-US")})` : "—") : fmt(v);
          return (
            <td key={i} style={{ ...cellBase, color: txtColor, fontWeight: shade === "total" || shade === "ending" ? 500 : 400 }}>
              {display}
            </td>
          );
        })}
        <td style={{ ...annBase, color: isGreen ? GREEN : txtColor, fontWeight: shade === "total" || shade === "ending" ? 600 : 400 }}>
          {annVal !== null ? (paren ? (annVal !== 0 ? `(${Math.abs(Math.round(annVal)).toLocaleString("en-US")})` : "—") : fmt(annVal)) : ""}
        </td>
      </tr>
    );
  };

  // Yield rate row — displays annual rate in every column (market standard)
  const yieldRow = (label: string, annualRate: number, color?: string) => (
    <tr style={{ background: "transparent" }}>
      <td style={{ ...labelBase, background: DS_BG, paddingLeft: 32, fontSize: 10, color: color ?? "rgba(255,255,255,0.32)", fontStyle: "italic" as const }}>
        {label}
      </td>
      {MO.map((_, i) => (
        <td key={i} style={{ ...cellBase, fontSize: 10, color: color ?? "rgba(255,255,255,0.32)", fontStyle: "italic" as const }}>
          {fmtPct(annualRate)}
        </td>
      ))}
      <td style={{ ...annBase, fontSize: 10, color: color ?? "rgba(255,255,255,0.32)", fontStyle: "italic" as const }}>
        {fmtPct(annualRate)}
      </td>
    </tr>
  );

  const sepRow = (color?: string) => (
    <tr style={{ height: 10 }}>
      <td colSpan={14} style={{ borderTop: color ? `1px solid ${color}33` : "none", background: DS_BG, position: "sticky" as const, left: 0 }} />
    </tr>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "0 40px 80px" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
          <div style={{ fontFamily: UI, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: GREEN }}>
            GURU INTELLIGENCE · LQ-7
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: "0.06em" }}>
            ASSET WATERFALL MODEL · FY 2026 · STATUS QUO (OPTIMIZER OFF)
          </div>
        </div>
        <div style={{ fontFamily: UI, fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.50)", lineHeight: 1.6 }}>
          Month-by-month balance ledger for each liquidity bucket.
          Opening balances from live account data · Income &amp; expenses from 2026 cash flow schedule · After-Tax yields applied from GURU-recommended instruments.
        </div>
      </div>

      {/* ── Opening Balance Summary Strip ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Operating Cash",    value: operatingCash,    color: OPS_C, pretax: `${(OPS_PRETAX * 100).toFixed(2)}%`, at: `${(OPS_AT * 100).toFixed(2)}%` },
          { label: "Liquidity Reserve", value: liquidityReserve, color: RSV_C, pretax: `${(RSV_PRETAX * 100).toFixed(2)}%`, at: `${(RSV_AT * 100).toFixed(2)}%` },
          { label: "Capital Build",     value: capitalBuild,     color: BLD_C, pretax: `${(BLD_PRETAX * 100).toFixed(2)}%`, at: `${(BLD_AT * 100).toFixed(2)}%` },
        ].map(({ label, value, color, pretax, at }) => (
          <div key={label} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `0.5px solid rgba(255,255,255,0.08)`, borderTop: `2px solid ${color}`, padding: "10px 14px" }}>
            <div style={{ fontFamily: UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.38)", marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 400, color: "rgba(255,255,255,0.92)", marginBottom: 6 }}>
              {value.toLocaleString("en-US")}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.40)", marginBottom: 1 }}>Pre-Tax: {pretax} annual</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: GREEN, fontWeight: 500 }}>After-Tax: {at} annual</div>
          </div>
        ))}
        <div style={{ flex: 1, background: "rgba(68,224,138,0.06)", border: `0.5px solid rgba(68,224,138,0.18)`, padding: "10px 14px" }}>
          <div style={{ fontFamily: UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.38)", marginBottom: 4 }}>Annual After-Tax Interest</div>
          <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 400, color: GREEN, marginBottom: 4 }}>
            {Math.round(ann.totalAtInt).toLocaleString("en-US")}
          </div>
          <div style={{ fontFamily: UI, fontSize: 10, color: "rgba(255,255,255,0.38)", marginBottom: 2 }}>All three buckets combined</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.38)" }}>
            Blended rate: {fmtPct(ann.totalAtInt / (operatingCash + liquidityReserve + capitalBuild))} After-Tax
          </div>
        </div>
      </div>

      {/* ── Waterfall Table ── */}
      <div style={{ overflowX: "auto", border: `0.5px solid rgba(255,255,255,0.10)` }}>
        <table style={{ borderCollapse: "collapse" as const, width: "100%", minWidth: LBL_W + COL_W * 12 + ANN_W, background: DS_BG }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.06)", borderBottom: `1px solid rgba(255,255,255,0.12)` }}>
              <th style={{ ...labelBase, background: "rgba(255,255,255,0.06)", zIndex: 3, fontFamily: UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.40)", textAlign: "left" as const, padding: "6px 12px 6px 16px" }}>
                ACCOUNT / LINE ITEM
              </th>
              {MO.map(m => (
                <th key={m} style={{ ...cellBase, fontFamily: UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.40)", padding: "6px 10px 6px 4px" }}>{m}</th>
              ))}
              <th style={{ ...annBase, fontFamily: UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.40)", padding: "6px 10px 6px 4px" }}>ANNUAL</th>
            </tr>
          </thead>
          <tbody>

            {/* ═══ SECTION 1: OPERATING CASH ═══ */}
            {sectionHeader("Operating Cash", OPS_C, "Weighted average — current holdings", `${(OPS_PRETAX*100).toFixed(2)}%`, `${(OPS_AT*100).toFixed(2)}%`)}
            {dataRow("Beginning Balance",
              data.map(d => d.ops.begin), operatingCash, "normal", {})}
            {dataRow("+ Cash Compensation",
              data.map(d => d.ops.comp), ann.opsComp, "normal", { indent: 1 })}
            {dataRow("+ Bank Interest Income",
              data.map(d => d.ops.intIncome), ann.opsIntIncome, "normal", { indent: 1 })}
            {dataRow("Total Income",
              data.map(d => d.ops.income), ann.opsIncome, "subtotal", { labelBold: true })}
            {dataRow("− Expenses",
              data.map(d => d.ops.expenses), ann.opsExpenses, "normal", { indent: 1, paren: true })}
            {dataRow("Ending Balance",
              data.map(d => d.ops.end), data[11].ops.end, "ending", { labelBold: true })}
            {yieldRow("Pre-Tax Yield (annual)",  OPS_PRETAX)}
            {yieldRow("After-Tax Yield (annual)", OPS_AT, GREEN)}
            {dataRow("+ After-Tax Interest Income",
              data.map(d => d.ops.atInt), ann.opsAtInt, "normal", { indent: 1, isGreen: true })}

            {sepRow(OPS_C)}

            {/* ═══ SECTION 2: LIQUIDITY RESERVE ═══ */}
            {sectionHeader("Liquidity Reserve", RSV_C, "Weighted average — current holdings", `${(RSV_PRETAX*100).toFixed(2)}%`, `${(RSV_AT*100).toFixed(2)}%`)}
            {dataRow("Beginning Balance",
              data.map(d => d.rsv.begin), liquidityReserve, "normal", {})}
            {dataRow("+ Income Allocation",
              data.map(() => 0), 0, "normal", { indent: 1 })}
            {dataRow("− Expenses",
              data.map(() => 0), 0, "normal", { indent: 1, paren: false })}
            {dataRow("Ending Balance",
              data.map(d => d.rsv.end), data[11].rsv.end, "ending", { labelBold: true })}
            {yieldRow("Pre-Tax Yield (annual)",  RSV_PRETAX)}
            {yieldRow("After-Tax Yield (annual)", RSV_AT, GREEN)}
            {dataRow("+ After-Tax Interest Income",
              data.map(d => d.rsv.atInt), ann.rsvAtInt, "normal", { indent: 1, isGreen: true })}

            {sepRow(RSV_C)}

            {/* ═══ SECTION 3: CAPITAL BUILD ═══ */}
            {sectionHeader("Capital Build", BLD_C, "Weighted average — current holdings", `${(BLD_PRETAX*100).toFixed(2)}%`, `${(BLD_AT*100).toFixed(2)}%`)}
            {dataRow("Beginning Balance",
              data.map(d => d.bld.begin), capitalBuild, "normal", {})}
            {dataRow("+ Income Allocation",
              data.map(() => 0), 0, "normal", { indent: 1 })}
            {dataRow("− Expenses",
              data.map(() => 0), 0, "normal", { indent: 1, paren: false })}
            {dataRow("Ending Balance",
              data.map(d => d.bld.end), data[11].bld.end, "ending", { labelBold: true })}
            {yieldRow("Pre-Tax Yield (annual)",  BLD_PRETAX)}
            {yieldRow("After-Tax Yield (annual)", BLD_AT, GREEN)}
            {dataRow("+ After-Tax Interest Income",
              data.map(d => d.bld.atInt), ann.bldAtInt, "normal", { indent: 1, isGreen: true })}

            {sepRow()}

            {/* ═══ TOTALS ═══ */}
            <tr style={{ height: 2, background: "rgba(255,255,255,0.14)" }}>
              <td colSpan={14} />
            </tr>
            {dataRow("Total Liquid Ending Balance",
              data.map(d => d.totalEnd), data[11].totalEnd, "total", { labelBold: true })}
            {dataRow("Total After-Tax Interest Income",
              data.map(d => d.totalAtInt), ann.totalAtInt, "total", { labelBold: true, isGreen: true })}

          </tbody>
        </table>
      </div>

      {/* ── Footnote ── */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontFamily: UI, fontSize: 10, color: "rgba(255,255,255,0.25)", lineHeight: 1.7 }}>
          <span style={{ color: "rgba(255,255,255,0.40)", fontWeight: 600 }}>Assumptions</span>
          {" "}· Income &amp; expense flows from live 2026 cash flow schedule · Opening balances from account data as of Dec 29, 2025
          · Liquidity Reserve &amp; Capital Build balances static — inter-bucket GURU optimizer transfers not applied in this scenario
          · After-Tax yields applied monthly on ending balance (Operating Cash) or beginning balance (Reserve, Capital Build)
          · Negative Operating Cash balance indicates a temporary intra-month shortfall — covered by Reserve sweep in the GURU optimized scenario
          · Expenses shown net of rental income — investment property cash flows reported on a net basis consistent with Cash Flow Forecast
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CashFlowForecastWaterfallView — GURU Intelligence · Cash flow forecast tab
// Full P&L ledger: CF_PL_ROWS × CF_MONTHS — same financial model style as
// LiquidityWaterfallView. Every line item auditable against live cashflow data.
// ─────────────────────────────────────────────────────────────────────────────
function CashFlowForecastWaterfallView({ assets, cashFlows }: { assets: Asset[]; cashFlows: CashFlow[] }) {
  const MO = CF_MONTHS.map(m => m.label);

  // ── Interest income from Asset Forecast model ──────────────────────────────
  // The "Interest From Bank Accounts" row is driven by the same After-Tax yield model
  // used in the Asset Forecast tab, so both tabs tie to the same numbers.
  const monthlyBucketInt = computeMonthlyBucketInterest(assets, cashFlows);

  // ── Compute all row values (mirrors computeCumulativeNCF logic) ────────────
  const mvCF = (descs: string[], year: number, month: number): number =>
    cashFlows
      .filter(cf => {
        const d = new Date(cf.date as string);
        return (
          d.getUTCFullYear() === year &&
          d.getUTCMonth() + 1 === month &&
          descs.some(dm => cf.description.toLowerCase().includes(dm.toLowerCase()))
        );
      })
      .reduce((s, cf) => s + (cf.type === "inflow" ? Number(cf.amount) : -Number(cf.amount)), 0);

  const vals: Record<string, number[]> = {};

  for (const row of CF_PL_ROWS) {
    if (row.kind === "item") {
      // Reserve interest row is overridden with model-computed bucket After-Tax interest
      if (row.key === "reserve_int") {
        vals[row.key] = monthlyBucketInt;
      } else {
        vals[row.key] = CF_MONTHS.map(m => mvCF(row.descs, m.year, m.month));
      }
    } else if (row.kind === "subtotal") {
      if (row.sumOf) {
        vals[row.key] = CF_MONTHS.map((_, mi) =>
          (row.sumOf as string[]).reduce((s, k) => s + (vals[k]?.[mi] ?? 0), 0));
      } else if (row.descs) {
        vals[row.key] = CF_MONTHS.map(m => mvCF(row.descs as string[], m.year, m.month));
      } else {
        vals[row.key] = CF_MONTHS.map(() => 0);
      }
    } else if (row.kind === "total" && row.sumOf) {
      vals[row.key] = CF_MONTHS.map((_, mi) =>
        (row.sumOf as string[]).reduce((s, k) => s + (vals[k]?.[mi] ?? 0), 0));
    } else {
      vals[row.key] = CF_MONTHS.map(() => 0);
    }
  }

  // Compute special derived totals
  const itemRows = CF_PL_ROWS.filter(r => r.kind === "item");
  const netByMonth     = CF_MONTHS.map((_, mi) =>
    itemRows.reduce((s, r) => s + (vals[r.key]?.[mi] ?? 0), 0));
  const outflowByMonth = CF_MONTHS.map((_, mi) =>
    itemRows.reduce((s, r) => { const v = vals[r.key]?.[mi] ?? 0; return s + Math.min(0, v); }, 0));
  const cumByMonth     = netByMonth.reduce<number[]>((acc, v, i) => {
    acc.push((acc[i - 1] ?? 0) + v); return acc; }, []);

  for (const row of CF_PL_ROWS) {
    if (row.kind === "total" && row.compute) {
      if      (row.compute === "outflow")    vals[row.key] = outflowByMonth;
      else if (row.compute === "net")        vals[row.key] = netByMonth;
      else if (row.compute === "cumulative") vals[row.key] = cumByMonth;
    }
  }

  // Annual summary values
  const annualIncome   = itemRows.reduce((s, r) => {
    const sum = (vals[r.key] ?? []).reduce((a, v) => a + Math.max(0, v), 0);
    return s + sum;
  }, 0);
  const annualExpenses = itemRows.reduce((s, r) => {
    const sum = (vals[r.key] ?? []).reduce((a, v) => a + Math.min(0, v), 0);
    return s + sum;
  }, 0);
  const annualNet      = netByMonth.reduce((s, v) => s + v, 0);
  const troughDepth    = Math.min(...cumByMonth);

  // ── Number formatters ──────────────────────────────────────────────────────
  const fmt = (v: number): string => {
    if (Math.round(v) === 0) return "—";
    const abs = Math.abs(Math.round(v));
    const s = abs.toLocaleString("en-US");
    return v < 0 ? `(${s})` : s;
  };

  // ── Design tokens (matching LiquidityWaterfallView) ───────────────────────
  const MONO  = "'JetBrains Mono', 'Courier New', monospace";
  const UI    = "Inter, system-ui, sans-serif";
  const DS_BG = "#0c1828";
  const GREEN = "#44e08a";
  const AMBER = "#d4950a";
  const SEP_C = "rgba(255,255,255,0.07)";
  const COL_W = 76;
  const LBL_W = 220;
  const ANN_W = 92;

  const cellBase: React.CSSProperties = {
    fontFamily: MONO, fontSize: 11, textAlign: "right" as const,
    padding: "3px 9px 3px 3px", whiteSpace: "nowrap" as const,
    color: "rgba(255,255,255,0.75)", borderLeft: `0.5px solid ${SEP_C}`,
    minWidth: COL_W, width: COL_W,
  };
  const labelBase: React.CSSProperties = {
    fontFamily: UI, fontSize: 11, padding: "3px 12px 3px 14px",
    color: "rgba(255,255,255,0.68)", whiteSpace: "nowrap" as const,
    position: "sticky" as const, left: 0, background: DS_BG, zIndex: 2,
    borderRight: "1px solid rgba(255,255,255,0.12)",
    minWidth: LBL_W, width: LBL_W,
  };
  const annBase: React.CSSProperties = {
    ...cellBase, minWidth: ANN_W, width: ANN_W, fontWeight: 500,
    borderLeft: "1px solid rgba(255,255,255,0.16)",
  };

  const rowBgs: Record<string, string> = {
    normal:   "transparent",
    subtotal: "rgba(255,255,255,0.04)",
    total:    "rgba(255,255,255,0.10)",
    group:    "rgba(255,255,255,0.03)",
  };

  // ── Group → accent color mapping ───────────────────────────────────────────
  const groupColors: Record<string, string> = {
    "EARNED INCOME": "#4a7fd4",
    "TRIBECA — PRIMARY RESIDENCE": "#835800",
    "SARASOTA — INVESTMENT PROPERTY": "#856100",
    "DEPENDENT CARE & EDUCATION": "#6b5db5",
    "CREDIT CARD": "#8b4040",
    "LIFESTYLE": "#5a7a6a",
    "DEBT SERVICE": "#8b5540",
    "TAXES": "#9a4030",
    "TRAVEL": "#4a6080",
    "YEAR-END & MISC": "#506070",
  };
  let currentGroupColor = "rgba(255,255,255,0.40)";

  // ── Row renderer ───────────────────────────────────────────────────────────
  const renderRow = (row: PLRowDef): React.ReactNode => {
    if (row.kind === "group") {
      currentGroupColor = groupColors[row.label] ?? "rgba(255,255,255,0.35)";
      return (
        <tr key={row.key} style={{ background: rowBgs.group, borderTop: `0.5px solid ${currentGroupColor}40` }}>
          <td colSpan={14} style={{
            fontFamily: UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.13em",
            textTransform: "uppercase" as const, color: currentGroupColor,
            padding: "5px 14px 5px 14px", position: "sticky" as const, left: 0,
            borderBottom: `0.5px solid ${currentGroupColor}40`,
          }}>
            {row.label}
          </td>
        </tr>
      );
    }

    const rowVals = vals[row.key] ?? CF_MONTHS.map(() => 0);
    const isSubtotal  = row.kind === "subtotal" || ("renderAs" in row && row.renderAs === "subtotal");
    const isTotal     = row.kind === "total";
    const bg          = isTotal ? rowBgs.total : isSubtotal ? rowBgs.subtotal : rowBgs.normal;
    const indent      = !isSubtotal && !isTotal ? 14 : 0;
    const lBgColor    = isTotal ? "rgba(255,255,255,0.06)" : isSubtotal ? "rgba(255,255,255,0.03)" : DS_BG;

    // Annual value: sum for most rows; Dec ending for cumulative
    let annVal: number;
    if (isTotal && "compute" in row && row.compute === "cumulative") {
      annVal = cumByMonth[11] ?? 0;  // year-end cumulative
    } else if (isTotal && "compute" in row && row.compute === "outflow") {
      annVal = annualExpenses;
    } else if (isTotal && "compute" in row && row.compute === "net") {
      annVal = annualNet;
    } else {
      annVal = rowVals.reduce((s, v) => s + v, 0);
    }

    // Text color for total rows
    const totalAccent = isTotal && "accent" in row
      ? (row.accent === "green" ? GREEN : AMBER)
      : null;

    const labelColor  = totalAccent ?? (isSubtotal ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.65)");
    const labelWeight = isTotal ? 700 : isSubtotal ? 600 : 400;

    return (
      <tr key={row.key} style={{ background: bg }}>
        <td style={{
          ...labelBase, background: lBgColor, paddingLeft: 14 + indent,
          fontWeight: labelWeight, color: labelColor,
          fontSize: isTotal ? 11 : 11,
          letterSpacing: isTotal ? "0.03em" : "normal",
        }}>
          {row.label}
        </td>
        {rowVals.map((v, i) => {
          let color = totalAccent ?? "rgba(255,255,255,0.75)";
          // For net/cumulative rows: green positive, amber negative
          if (isTotal && "compute" in row && (row.compute === "net" || row.compute === "cumulative")) {
            color = v >= 0 ? GREEN : AMBER;
          }
          return (
            <td key={i} style={{
              ...cellBase,
              color,
              fontWeight: isTotal ? 600 : isSubtotal ? 500 : 400,
              fontSize: isTotal ? 11 : 11,
            }}>
              {fmt(v)}
            </td>
          );
        })}
        <td style={{
          ...annBase,
          color: totalAccent ?? (isTotal && "compute" in row && (row.compute === "net" || row.compute === "cumulative")
            ? (annVal >= 0 ? GREEN : AMBER)
            : "rgba(255,255,255,0.80)"),
          fontWeight: isTotal ? 700 : isSubtotal ? 600 : 500,
          fontStyle: (isTotal && "compute" in row && row.compute === "cumulative") ? "italic" as const : "normal" as const,
        }}>
          {(isTotal && "compute" in row && row.compute === "cumulative") ? `Dec: ${fmt(annVal)}` : fmt(annVal)}
        </td>
      </tr>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "0 40px 80px" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
          <div style={{ fontFamily: UI, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: GREEN }}>
            GURU INTELLIGENCE · CF-12
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: "0.06em" }}>
            CASH FLOW FORECAST · FY 2026 · KESSLER FAMILY
          </div>
        </div>
        <div style={{ fontFamily: UI, fontSize: 13, color: "rgba(255,255,255,0.50)", lineHeight: 1.6 }}>
          Full P&amp;L ledger — every line item sourced from live cash flow schedule. All figures auditable.
        </div>
      </div>

      {/* ── Summary KPI strip ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        {[
          { label: "Total Cash Income",    val: annualIncome,   color: GREEN },
          { label: "Total Cash Expenses",  val: annualExpenses, color: AMBER },
          { label: "Net Cash Flow (FY)",   val: annualNet,      color: annualNet >= 0 ? GREEN : AMBER },
          { label: "Trough (Nov)",         val: troughDepth,    color: troughDepth < 0 ? AMBER : GREEN, note: "lowest cumulative NCF — sizes reserve" },
        ].map(({ label, val, color, note }) => (
          <div key={label} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `0.5px solid rgba(255,255,255,0.08)`, padding: "10px 14px" }}>
            <div style={{ fontFamily: UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)", marginBottom: 5 }}>{label}</div>
            <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 400, color }}>{fmt(val)}</div>
            {note && <div style={{ fontFamily: UI, fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 3 }}>{note}</div>}
          </div>
        ))}
      </div>

      {/* ── P&L Table ── */}
      <div style={{ overflowX: "auto", border: `0.5px solid rgba(255,255,255,0.10)` }}>
        <table style={{ borderCollapse: "collapse" as const, minWidth: LBL_W + COL_W * 12 + ANN_W, background: DS_BG }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              <th style={{ ...labelBase, background: "rgba(255,255,255,0.06)", zIndex: 3,
                fontFamily: UI, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
                textTransform: "uppercase" as const, color: "rgba(255,255,255,0.38)",
                textAlign: "left" as const, padding: "6px 12px 6px 14px" }}>
                LINE ITEM
              </th>
              {MO.map(m => (
                <th key={m} style={{ ...cellBase, fontFamily: UI, fontSize: 9, fontWeight: 700,
                  letterSpacing: "0.08em", textTransform: "uppercase" as const,
                  color: "rgba(255,255,255,0.38)", padding: "6px 9px 6px 3px" }}>{m}</th>
              ))}
              <th style={{ ...annBase, fontFamily: UI, fontSize: 9, fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase" as const,
                color: "rgba(255,255,255,0.38)", padding: "6px 9px 6px 3px" }}>ANNUAL</th>
            </tr>
          </thead>
          <tbody>
            {CF_PL_ROWS.map(row => renderRow(row))}
          </tbody>
        </table>
      </div>

      {/* ── Footnote ── */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontFamily: UI, fontSize: 10, color: "rgba(255,255,255,0.25)", lineHeight: 1.7 }}>
          <span style={{ color: "rgba(255,255,255,0.40)", fontWeight: 600 }}>Data source</span>
          {" "}· All figures sourced from live cash flow schedule · Inflows positive, outflows in parentheses · Annual column sums Jan–Dec except Cumulative (shows Dec year-end balance)
          · Trough depth feeds directly into reserve target calculation in Asset Forecast
        </div>
      </div>
    </div>
  );
}

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
    [{ label: "Q1 Est. Tax",          amount: 30000 }, { label: "Dalton Tuition", amount: 15000 }], // Apr
    [{ label: "Memorial Day Travel",  amount:  4000 }],                                           // May
    [{ label: "Weekend Travel",       amount:  1000 }],                                           // Jun
    [{ label: "Dalton Tuition Q3",   amount: 15000 }, { label: "Summer Vacation", amount: 4500 }], // Jul
    [{ label: "Dalton Tuition Q3",   amount: 15000 }],                                           // Aug
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

        /* ── accounting ledger card — styled to match BSBucketCard ── */
        const LedgerCard = ({
          title, subtitle, balance, balanceColor = '#1e293b', entries, accent, width, beginningBalance, shade,
        }: {
          title: string; subtitle?: string; balance: string; balanceColor?: string;
          entries?: { label: string; amount: string; type: 'plus' | 'less' | 'neutral' }[];
          accent?: string; width?: number; beginningBalance?: string; shade?: string;
        }) => (
          <div style={{
            width: width ?? '100%', borderRadius: 8, overflow: 'hidden', background: shade ?? '#fff',
            border: `1px solid ${accent ? `${accent}28` : 'rgba(0,0,0,0.09)'}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            {/* Colored top stripe */}
            {accent && <div style={{ height: 3, background: accent, opacity: 0.9 }} />}
            {/* Header */}
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: shade ?? '#fff' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' as const, color: accent ?? '#334155', lineHeight: 1.2 }}>{title}</div>
              {subtitle && <div style={{ fontSize: 9.5, color: 'rgba(0,0,0,0.40)', marginTop: 3, lineHeight: 1.35 }}>{subtitle}</div>}
              {/* Simple cards (no ledger body): balance in header */}
              {!beginningBalance && !entries?.length && (
                <div style={{ fontSize: 17, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em', color: balanceColor, lineHeight: 1, marginTop: 7 }}>{balance}</div>
              )}
            </div>
            {/* Ledger body */}
            {(beginningBalance || (entries && entries.length > 0)) && (
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {beginningBalance && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 7, borderBottom: '1px dashed rgba(0,0,0,0.10)', marginBottom: 2 }}>
                    <span style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(0,0,0,0.33)' }}>Beg. Balance</span>
                    <span style={{ fontSize: 11, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: 'rgba(0,0,0,0.48)' }}>{beginningBalance}</span>
                  </div>
                )}
                {entries && entries.map((e, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.50)', lineHeight: 1.3 }}>
                      {e.type === 'plus' ? '+ ' : e.type === 'less' ? '− ' : '\u00a0\u00a0'}{e.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 400, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em', color: e.type === 'plus' ? '#1A6640' : e.type === 'less' ? '#9b2020' : 'rgba(0,0,0,0.50)' }}>{e.amount}</span>
                  </div>
                ))}
                {beginningBalance && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8, borderTop: '2px solid rgba(0,0,0,0.10)', marginTop: 2 }}>
                    <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(0,0,0,0.38)' }}>End. Balance</span>
                    <span style={{ fontSize: 17, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em', color: balanceColor, lineHeight: 1 }}>{balance}</span>
                  </div>
                )}
                {!beginningBalance && entries && entries.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 7, borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: 2 }}>
                    <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(0,0,0,0.38)' }}>Balance</span>
                    <span style={{ fontSize: 17, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em', color: balanceColor, lineHeight: 1 }}>{balance}</span>
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
                  <span style={{ position: 'absolute', top: -20, left: 8, fontSize: 11, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', whiteSpace: 'nowrap', color: '#16a34a' }}>{fmtBal(income + rentalAmt)}</span>
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
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderRadius: 8, marginBottom: 10, backgroundColor: '#1d4ed8', border: '2px solid #1e40af' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: '#fff' }}>Operating Cash</span>
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
                  <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {sm > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px dashed rgba(29,78,216,0.20)', marginBottom: 2 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(0,0,0,0.35)' }}>Beg. Balance</span>
                        <span style={{ fontSize: 12, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: 'rgba(0,0,0,0.48)' }}>{fmtBal(HC_CIT_MM[sm - 1])}</span>
                      </div>
                    )}
                    {[
                      { label: 'Michael Kessler — Salary', amount: `+${fmtBal(p1Salary)}`, type: 'plus' as const },
                      { label: 'Sarah Kessler — Salary', amount: `+${fmtBal(p2Salary)}`, type: 'plus' as const },
                      { label: 'Sarasota Property — Rental Income', amount: `+${fmtBal(rentalAmt)}`, type: 'plus' as const },
                      ...(jpmRsvDraw > 0 ? [{ label: 'JPMorgan 100% Treasuries MMF — Draw', amount: `+${fmtBal(jpmRsvDraw)}`, type: 'plus' as const }] : []),
                      { label: 'Monthly Expenses', amount: `(${fmtBal(totalExp)})`, type: 'less' as const },
                    ].map((e, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.52)', lineHeight: 1.3 }}>
                          {e.type === 'plus' ? '+ ' : '− '}{e.label}
                        </span>
                        <span style={{ fontSize: 11.5, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em', color: e.type === 'plus' ? '#1A6640' : '#9b2020' }}>{e.amount}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, borderTop: '2px solid rgba(29,78,216,0.25)', marginTop: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(0,0,0,0.38)' }}>End. Balance</span>
                      <span style={{ fontSize: 22, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em', color: opsBal < 0 ? '#9b2020' : '#1d4ed8', lineHeight: 1 }}>
                        {opsBal < 0 ? `(${fmtBal(Math.abs(opsBal))})` : fmtBal(opsBal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══════════ ROW 1+2 col 4: CIT → Expenses connector (spans both rows) ══════════ */}
              <div style={{ gridColumn: '4', gridRow: '1 / 3', display: 'flex', alignItems: 'flex-start', paddingTop: 233 }}>
                <div className="relative w-full">
                  <span style={{ position: 'absolute', top: -18, left: 8, fontSize: 11, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', whiteSpace: 'nowrap', color: '#9b2020' }}>{fmtBal(totalExp)}</span>
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
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#92400e' }}>Reserve Cash</span>
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
                  <span style={{ position: 'absolute', top: -20, left: 8, fontSize: 11, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', whiteSpace: 'nowrap', color: '#d97706' }}>
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
                  <td className="px-4 py-3 text-[12px] font-black uppercase tracking-wide text-white">Reserve Cash</td>
                  {HC_RSV_TOTAL.map((v, mi) => (
                    <td key={mi} className="px-2 py-3 text-[11px] font-black text-center tabular-nums whitespace-nowrap text-white relative">
                      <div className="group relative inline-block cursor-help">
                        {fmtBal(v)}
                        {cellTip([
                          `Reserve Cash — ${MONTHS[mi]} 2026`,
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
                  <td className="px-4 py-3 text-[12px] font-black uppercase tracking-wide text-white">Capital Build</td>
                  {HC_BLD_TOTAL.map((v, mi) => (
                    <td key={mi} className="px-2 py-3 text-[11px] font-black text-center tabular-nums whitespace-nowrap text-white relative">
                      <div className="group relative inline-block cursor-help">
                        {fmtBal(v)}
                        {cellTip([
                          `Capital Build — ${MONTHS[mi]} 2026`,
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
    name: "Reserve Cash",
    tagline: "Active cash management for what's next",
    rule: "12 months of cash for anticipated outflow",
    bg: "#3a2710",    // deep warm gold — not orange
    dark: "#2a1c09",
    accent: "#c9a84c",
  },
  {
    name: "Capital Build",
    tagline: "Disciplined saving for big goals on the horizon",
    rule: "Large expenditure in next 3 years",
    bg: "#0e3320",    // deep forest green
    dark: "#082516",
    accent: "#5ab88a",
  },
  {
    name: "Investments",
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
  // Income pickup: full portfolio current AT income vs. pro-forma (target-based redistribution).
  // True delta — pro-forma minus current, not just the product yield × excess.
  const {
    currentAnnualIncome:  atCurrentT,
    proformaAnnualIncome: atProformaT,
    annualPickup:         returnPickupT,
  } = computeReturnOptimization(assets, cashFlows);
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
              { label: "Income Pickup / Year", val: `+${fmt(returnPickupT)}`, sub: `${fmt(atCurrentT)} → ${fmt(atProformaT)} AT`, color: "#2e7a52" },
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
                  label: "Reserve Cash",
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
          <span className="text-[10px] italic text-muted-foreground">Capital routing plan confirmed · <span className="font-semibold not-italic" style={{ color: "#9a7b3c" }}>{fmt(totalExcess)}</span> moving from {opExcess > 100 && resExcess > 100 ? "Operating Cash and Reserve Cash" : opExcess > 100 ? "Operating Cash" : "Reserve Cash"} into Capital Build & Investments.</span>
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
              <span className="text-[10px] italic text-muted-foreground">Based on market yields and your {opMonthsLocal + resMonthsLocal}-month liquidity policy, GURU recommends short-duration income strategies · <span className="font-semibold not-italic" style={{ color: "#9a7b3c" }}>+{fmt(returnPickupT)}/yr</span> income pickup vs. current portfolio ({fmt(atCurrentT)} → {fmt(atProformaT)} AT).</span>
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

  // Liquid bucket totals for Total Liquid Assets card
  const dvOpCash   = assets.filter(a => assetBucketKey(a) === "reserve").reduce((s, a) => s + Number(a.value), 0);
  const dvResCash  = assets.filter(a => assetBucketKey(a) === "yield_").reduce((s, a) => s + Number(a.value), 0);
  const dvCapBuild = assets.filter(a => assetBucketKey(a) === "tactical").reduce((s, a) => s + Number(a.value), 0);
  const dvTotalLiquid = dvOpCash + dvResCash + dvCapBuild;

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
    <div style={{ background: CF2.bg, borderRadius: 0 }}>

      {tab === "bs" && (
        <div className="space-y-4" style={{ padding: "0" }}>
          {/* ── GURU Detection Cards ── */}
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 0 }}>
            {/* Detection System header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 7px", borderBottom: "1px solid rgba(91,143,204,0.18)" }}>
              <div style={{ width: 3, height: 16, background: "#5ecc8a", borderRadius: 1.5, flexShrink: 0 }} />
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5ecc8a", display: "inline-block", flexShrink: 0, animation: "pulse 2s ease-in-out infinite" }} />
              <span style={{ fontFamily: CF2.INTER, fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "rgba(180,215,255,0.88)" }}>Detection System</span>
              <span style={{ fontFamily: CF2.INTER, fontSize: 9, color: "rgba(255,255,255,0.28)", marginLeft: "auto", letterSpacing: "0.05em", textTransform: "uppercase" as const }}>3 Active</span>
            </div>
            {/* Detection cards row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: "7px 10px 9px" }}>
              {/* Card 1: Total Assets */}
              <div style={{ background: "rgba(0,0,0,0.22)", borderRadius: 5, border: "1px solid rgba(91,143,204,0.18)", borderLeft: "2.5px solid rgba(91,143,204,0.55)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: CF2.INTER, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(180,215,255,0.88)" }}>Total Assets</span>
                  <span style={{ fontFamily: CF2.INTER, fontSize: 8, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>Dec 29, 2025</span>
                </div>
                <div style={{ fontFamily: CF2.INTER, fontSize: 22, fontWeight: 300, color: "rgba(180,215,255,0.95)", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums" as const, lineHeight: 1 }}>{fmt(totalAssets)}</div>
                <div style={{ fontFamily: CF2.INTER, fontSize: 9, color: "rgba(255,255,255,0.45)", lineHeight: 1.3 }}>Across all accounts &amp; holdings · synced live</div>
              </div>
              {/* Card 2: Total Liabilities */}
              <div style={{ background: "rgba(0,0,0,0.22)", borderRadius: 5, border: "1px solid rgba(155,32,32,0.22)", borderLeft: "2.5px solid rgba(155,32,32,0.55)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: CF2.INTER, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(255,180,180,0.82)" }}>Total Liabilities</span>
                  <span style={{ fontFamily: CF2.INTER, fontSize: 8, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>Dec 29, 2025</span>
                </div>
                <div style={{ fontFamily: CF2.INTER, fontSize: 22, fontWeight: 300, color: "rgba(255,180,180,0.90)", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums" as const, lineHeight: 1 }}>{fmt(totalLiab)}</div>
                <div style={{ fontFamily: CF2.INTER, fontSize: 9, color: "rgba(255,255,255,0.45)", lineHeight: 1.3 }}>Mortgage + consumer debt · leverage ratio tracked</div>
              </div>
              {/* Card 3: Net Worth — hero green */}
              <div style={{ background: "rgba(0,0,0,0.26)", borderRadius: 5, border: "1px solid rgba(94,204,138,0.28)", borderLeft: "2.5px solid rgba(94,204,138,0.55)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: CF2.INTER, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(94,204,138,0.88)" }}>Net Worth</span>
                  <span style={{ fontFamily: CF2.INTER, fontSize: 8, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: CF2.green, border: `1px solid rgba(94,204,138,0.35)`, borderRadius: 2, padding: "1px 6px" }}>LIVE</span>
                </div>
                <div style={{ fontFamily: CF2.INTER, fontSize: 22, fontWeight: 300, color: CF2.green, letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums" as const, lineHeight: 1 }}>{fmt(netWorth)}</div>
                <div style={{ fontFamily: CF2.INTER, fontSize: 9, color: "rgba(255,255,255,0.45)", lineHeight: 1.3 }}>Assets minus liabilities · continuously updated</div>
              </div>
            </div>
          </div>

          {/* ── Total Liquid Assets card ── */}
          <div style={{ padding: "7px 10px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <div style={{ width: 3, height: 14, background: "#44e08a", borderRadius: 1.5, flexShrink: 0 }} />
              <span style={{ fontFamily: CF2.INTER, fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.10em", color: "rgba(180,215,255,0.75)" }}>Total Liquid Assets</span>
              <span style={{ fontFamily: CF2.INTER, fontSize: 18, fontWeight: 300, color: "#5ecc8a", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums" as const, marginLeft: "auto" }}>{fmt(dvTotalLiquid)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {([
                { label: "Operating Cash",     val: dvOpCash,   color: "#1E4F9C", pill: "Checking" },
                { label: "Liquidity Reserve",  val: dvResCash,  color: "#835800", pill: "Reserve" },
                { label: "Capital Build",       val: dvCapBuild, color: "#195830", pill: "Capital" },
              ] as const).map(b => (
                <div key={b.label} style={{ background: "rgba(0,0,0,0.20)", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", borderLeft: `2.5px solid ${b.color}`, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontFamily: CF2.INTER, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.45)" }}>{b.label}</span>
                  <span style={{ fontFamily: CF2.INTER, fontSize: 16, fontWeight: 300, color: "rgba(255,255,255,0.88)", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" as const }}>{fmt(b.val)}</span>
                </div>
              ))}
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
                  style={{ gridTemplateColumns: "1fr 90px 62px 62px 80px", background: CF2.elevated }}
                >
                  <div style={{ padding: "12px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: CF2.green }}>Net Worth</div>
                  <div style={{ padding: "12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "13px", fontWeight: 900, color: CF2.green }}>
                    {fmt(netWorth)}
                  </div>
                  <div style={{ padding: "12px" }} />
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

// ─── Cash Flow Advisor View ───────────────────────────────────────────────────
function CashFlowAdvisorView({ assets, cashFlows }: { assets: Asset[]; cashFlows: CashFlow[] }) {
  const FONT  = "'Inter', system-ui, sans-serif";
  const SERIF = "'Playfair Display', Georgia, serif";
  const BG    = "hsl(220,5%,93%)";
  const BORDER = "rgba(0,0,0,0.07)";
  const NAVY  = "hsl(222,45%,12%)";
  const MUTED = "rgba(0,0,0,0.38)";

  // ── Compute vals — same logic as CashFlowForecastView (single source of truth) ──
  function monthVal(descs: string[], year: number, month: number): number {
    return cashFlows
      .filter(cf => {
        const d = new Date(cf.date as string);
        return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month &&
          descs.some(dm => cf.description.toLowerCase().includes(dm.toLowerCase()));
      })
      .reduce((s, cf) => s + (cf.type === "inflow" ? Number(cf.amount) : -Number(cf.amount)), 0);
  }

  const vals: Record<string, number[]> = {};
  for (const row of CF_PL_ROWS) {
    if (row.kind === "item") {
      vals[row.key] = CF_MONTHS.map(m => monthVal(row.descs as string[], m.year, m.month));
    } else if (row.kind === "subtotal") {
      if (row.sumOf) vals[row.key] = CF_MONTHS.map((_, mi) => row.sumOf!.reduce((s, k) => s + (vals[k]?.[mi] ?? 0), 0));
      else if (row.descs) vals[row.key] = CF_MONTHS.map(m => monthVal(row.descs!, m.year, m.month));
      else vals[row.key] = CF_MONTHS.map(() => 0);
    } else if (row.kind === "total" && row.sumOf) {
      vals[row.key] = CF_MONTHS.map((_, mi) => row.sumOf!.reduce((s, k) => s + (vals[k]?.[mi] ?? 0), 0));
    } else {
      vals[row.key] = CF_MONTHS.map(() => 0);
    }
  }

  const inflowByMonth  = CF_MONTHS.map((_, mi) => CF_PL_ROWS.filter(r => r.kind === "item").reduce((s, r) => s + Math.max(0, vals[r.key]?.[mi] ?? 0), 0));
  const outflowByMonth = CF_MONTHS.map((_, mi) => CF_PL_ROWS.filter(r => r.kind === "item").reduce((s, r) => s + Math.min(0, vals[r.key]?.[mi] ?? 0), 0));
  const netByMonth     = CF_MONTHS.map((_, mi) => CF_PL_ROWS.filter(r => r.kind === "item").reduce((s, r) => s + (vals[r.key]?.[mi] ?? 0), 0));
  const cumulativeByMonth = netByMonth.reduce<number[]>((acc, v, i) => { acc.push((acc[i - 1] ?? 0) + v); return acc; }, []);

  // Fill compute= total rows
  vals["total_expenses"] = outflowByMonth;
  vals["total_net"]      = netByMonth;
  vals["total_cum"]      = cumulativeByMonth;

  const annualInflows  = inflowByMonth.reduce((s, v) => s + v, 0);
  const annualOutflows = Math.abs(outflowByMonth.reduce((s, v) => s + v, 0));
  const annualNet      = netByMonth.reduce((s, v) => s + v, 0);
  const troughIdx      = cumulativeByMonth.reduce((mi, v, i) => v < cumulativeByMonth[mi] ? i : mi, 0);

  const { excessLiquidity, coverageMonths, troughDepth } = computeLiquidityTargets(assets, cashFlows);

  // ── Chart data ──
  const chartData = CF_MONTHS.map((m, i) => ({ label: m.label, value: cumulativeByMonth[i] }));
  const cumMin = Math.min(...cumulativeByMonth, 0);
  const cumMax = Math.max(...cumulativeByMonth, 0);
  const cumRange = cumMax - cumMin || 1;
  const zeroTopPct = Math.round((cumMax / cumRange) * 100);

  const fmtCell = (v: number): string => {
    if (v === 0) return "—";
    const abs = Math.abs(Math.round(v));
    return v < 0 ? `(${fmt(abs)})` : fmt(abs);
  };

  // ── Liquid Account Balance Forecast — hardcoded from Prototype Model v4.xlsx ──
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // ── Bucket colors (from GURU_BUCKETS canonical) ─────────────────────────────
  // ── Bucket colors ────────────────────────────────────────────────────────────
  const OPS_COLOR = "#1E4F9C";   // Operating Cash
  const RSV_COLOR = "#835800";   // Liquidity Reserve
  const BLD_COLOR = "#195830";   // Capital Build

  // ── GURU Optimized balance forecast (Prototype Model v4.xlsx — Money Movement) ─
  // Values from Prototype Model v4.xlsx — Money Movement sheet, GURU rows (rounded)
  const FC_OPS = [41879,86879,90879,46879,62379,76379,56879,41879,45879,73332,86832,76879];
  const FC_RSV = [156062,109323,103507,100629,79242,62326,60365,58383,52396,22946,3408,179127];
  const FC_BLD = [193533,193958,194384,194811,195239,195667,196097,196528,196959,197392,197825,219586];

  const rsvTroughIdx = FC_RSV.reduce((mi, v, i) => v < FC_RSV[mi] ? i : mi, 0);

  const fcChartData = MONTHS_SHORT.map((mo, i) => ({
    month: mo,
    ops: FC_OPS[i],
    rsv: FC_RSV[i],
    bld: FC_BLD[i],
  }));

  const fmtBal = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

  return (
    <div style={{ background: BG, minHeight: "100%", fontFamily: FONT, overflowY: "auto" }}>
      <div style={{ padding: "32px 48px 80px" }}>

        {/* ── KPI Strip ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 16 }}>
          {([
            { label: "Annual Inflows",    value: fmt(annualInflows),                                                    color: "#195830", sub: "Earned income · 2026" },
            { label: "Annual Outflows",   value: fmt(annualOutflows),                                                   color: "#8B2020", sub: "Total expenditure · 2026" },
            { label: "Annual Net",        value: (annualNet >= 0 ? "+" : "") + fmt(Math.abs(annualNet)),                color: annualNet >= 0 ? "#195830" : "#8B2020", sub: "Net surplus · 2026" },
            { label: "Coverage",          value: `${coverageMonths.toFixed(1)} mo`,                                    color: NAVY, sub: "vs. 12-mo target" },
            { label: "Trough",            value: fmt(troughDepth),                                                     color: "#835800", sub: `${CF_MONTHS[troughIdx]?.label ?? "Nov"} · max drawdown` },
            { label: "Excess Deployable", value: fmt(excessLiquidity),                                                 color: "#4A3FA0", sub: "Above reserve target" },
          ] as const).map((kpi, i) => (
            <div key={i} style={{ background: "#FFFFFF", border: `0.5px solid ${BORDER}`, padding: "14px 18px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: MUTED, marginBottom: 8 }}>{kpi.label}</div>
              <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" as const, color: kpi.color, lineHeight: 1, marginBottom: 5 }}>{kpi.value}</div>
              <div style={{ fontSize: 10, color: MUTED }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Net Cumulative Cash Flow Chart ── */}
        <div style={{ background: "#FFFFFF", border: `0.5px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ padding: "14px 18px 12px", borderBottom: `0.5px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: MUTED, marginBottom: 3 }}>Net Cumulative Cash Flow · Jan–Dec 2026</div>
              <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 400, color: NAVY, letterSpacing: "-0.01em" }}>
                12-Month Forward Cash Position
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", background: "rgba(131,88,0,0.05)", border: "0.5px solid rgba(131,88,0,0.18)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#835800", flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: "#835800" }}>
                {CF_MONTHS[troughIdx]?.label ?? "Nov"} trough
              </span>
              <span style={{ fontSize: 10, color: "#835800", fontVariantNumeric: "tabular-nums" as const }}>
                ({fmt(troughDepth)})
              </span>
            </div>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 16, right: 32, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="cfAdvisorFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={`${zeroTopPct}%`} stopColor="#195830" stopOpacity={0.12} />
                    <stop offset={`${zeroTopPct}%`} stopColor="#8B2020" stopOpacity={0.10} />
                    <stop offset="100%"             stopColor="#8B2020" stopOpacity={0.20} />
                  </linearGradient>
                  <linearGradient id="cfAdvisorStroke" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={`${zeroTopPct}%`} stopColor="#195830" />
                    <stop offset={`${zeroTopPct}%`} stopColor="#8B2020" />
                    <stop offset="100%"             stopColor="#8B2020" />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "rgba(0,0,0,0.38)", fontFamily: FONT }}
                  axisLine={{ stroke: "rgba(0,0,0,0.08)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "rgba(0,0,0,0.32)", fontFamily: FONT }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v === 0 ? "$0" : `${v < 0 ? "-" : "+"}$${Math.round(Math.abs(v) / 1000)}K`}
                  width={56}
                  domain={["auto", "auto"]}
                />
                <ReferenceLine
                  y={0}
                  stroke="rgba(0,0,0,0.28)"
                  strokeWidth={1}
                  strokeDasharray="5 4"
                  label={{ value: "break-even", position: "insideTopRight", fontSize: 9, fill: "rgba(0,0,0,0.30)", fontFamily: FONT, dy: -6 }}
                />
                <RechartsTooltip
                  contentStyle={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.10)", borderRadius: 0, fontSize: 11, fontFamily: FONT, boxShadow: "0 2px 16px rgba(0,0,0,0.08)", padding: "8px 12px" }}
                  formatter={(v: number) => [fmt(Math.abs(v)), v < 0 ? "Cumulative Deficit" : "Cumulative Surplus"]}
                  labelStyle={{ fontSize: 10, fontWeight: 700, color: NAVY, marginBottom: 3 }}
                  cursor={{ stroke: "rgba(0,0,0,0.10)", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="url(#cfAdvisorStroke)"
                  strokeWidth={2}
                  fill="url(#cfAdvisorFill)"
                  dot={(props: any) => {
                    if (props.index === troughIdx) {
                      return <circle key="trough-dot" cx={props.cx} cy={props.cy} r={5} fill="#835800" stroke="#fff" strokeWidth={2} />;
                    }
                    return <g key={props.index} />;
                  }}
                  activeDot={{ r: 4, fill: NAVY, stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Full Monthly Cash Flow Statement ── */}
        <div style={{ background: "#FFFFFF", border: `0.5px solid ${BORDER}`, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "14px 18px 12px", borderBottom: `0.5px solid ${BORDER}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: MUTED, marginBottom: 3 }}>Cash Flow Statement</div>
            <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 400, color: NAVY }}>Monthly Detail · {format(addMonths(DEMO_NOW, 1), "MMMM")} – {format(addMonths(DEMO_NOW, 12), "MMMM yyyy")}</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT }}>
              <thead>
                <tr style={{ background: "hsl(220,5%,97%)", borderBottom: `0.5px solid ${BORDER}` }}>
                  <th style={{ position: "sticky" as const, left: 0, zIndex: 2, background: "hsl(220,5%,97%)", padding: "8px 18px", textAlign: "left" as const, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: MUTED, minWidth: 218, borderRight: `0.5px solid ${BORDER}` }}>
                    Line Item
                  </th>
                  {CF_MONTHS.map((m, mi) => (
                    <th key={m.label} style={{ padding: "8px 9px", textAlign: "right" as const, fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: mi === troughIdx ? "#835800" : MUTED, minWidth: 70, background: mi === troughIdx ? "rgba(131,88,0,0.04)" : "transparent", whiteSpace: "nowrap" as const }}>
                      {m.label}{mi === troughIdx ? " ▾" : ""}
                    </th>
                  ))}
                  <th style={{ padding: "8px 18px", textAlign: "right" as const, fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: MUTED, minWidth: 86, borderLeft: `0.5px solid ${BORDER}` }}>
                    2026
                  </th>
                </tr>
              </thead>
              <tbody>
                {CF_PL_ROWS.map((row, ri) => {
                  const rowVals = vals[row.key] ?? CF_MONTHS.map(() => 0);
                  const annual  = rowVals.reduce((s, v) => s + v, 0);

                  if (row.kind === "group") {
                    return (
                      <tr key={row.key}>
                        <td colSpan={14} style={{ padding: "9px 18px 7px", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.35)", background: "hsl(220,5%,97%)", borderTop: ri > 0 ? `0.5px solid ${BORDER}` : "none", borderBottom: `0.5px solid ${BORDER}` }}>
                          {row.label}
                        </td>
                      </tr>
                    );
                  }

                  const isTotal    = row.kind === "total";
                  const isSubtotal = row.kind === "subtotal" || (row as any).renderAs === "subtotal";
                  const rowBg      = isTotal ? "hsl(220,5%,97%)" : "#FFFFFF";
                  const labelWt    = isTotal ? 700 : isSubtotal ? 600 : 400;
                  const labelColor = isTotal ? NAVY : isSubtotal ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.60)";
                  const indent     = (!isTotal && !isSubtotal) ? "28px" : "18px";
                  const rowBorderT = (isTotal || isSubtotal) ? `0.5px solid ${BORDER}` : "none";
                  const rowBorderB = `0.5px solid rgba(0,0,0,0.04)`;

                  return (
                    <tr key={row.key} style={{ background: rowBg, borderTop: rowBorderT }}>
                      <td style={{ position: "sticky" as const, left: 0, zIndex: 1, background: rowBg, padding: `5px 18px 5px ${indent}`, fontWeight: labelWt, color: labelColor, fontSize: isTotal ? 11 : 10.5, borderRight: `0.5px solid ${BORDER}`, borderBottom: rowBorderB }}>
                        {row.label}
                      </td>
                      {rowVals.map((v, mi) => {
                        const cc = isTotal
                          ? (v >= 0 ? "#195830" : "#8B2020")
                          : isSubtotal
                          ? (v >= 0 ? "#1a4d2e" : "#5a1a1a")
                          : v < 0 ? "#7a2a2a" : v > 0 ? "#1a4d2e" : "rgba(0,0,0,0.22)";
                        return (
                          <td key={mi} style={{ padding: "5px 9px", textAlign: "right" as const, fontWeight: isTotal ? 600 : isSubtotal ? 500 : 400, color: cc, fontSize: isTotal ? 11 : 10.5, fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const, borderBottom: rowBorderB, background: mi === troughIdx ? "rgba(131,88,0,0.03)" : "transparent" }}>
                            {fmtCell(v)}
                          </td>
                        );
                      })}
                      <td style={{ padding: "5px 18px", textAlign: "right" as const, fontWeight: isTotal ? 700 : isSubtotal ? 600 : 400, color: isTotal ? (annual >= 0 ? "#195830" : "#8B2020") : isSubtotal ? (annual >= 0 ? "#1a4d2e" : "#5a1a1a") : annual < 0 ? "#7a2a2a" : annual > 0 ? "#1a4d2e" : "rgba(0,0,0,0.22)", fontSize: isTotal ? 11 : 10.5, fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const, borderLeft: `0.5px solid ${BORDER}`, borderBottom: rowBorderB, background: isTotal ? "hsl(220,5%,97%)" : "transparent" }}>
                        {fmtCell(annual)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            LIQUID ACCOUNT BALANCE FORECAST
            Prototype Model v4.xlsx — Money Movement sheet (GURU scenario)
            Operating Cash · Liquidity Reserve · Capital Build
            ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ background: "#FFFFFF", border: `0.5px solid ${BORDER}`, overflow: "hidden", marginBottom: 16 }}>
          {/* Section header */}
          <div style={{ padding: "14px 18px 12px", borderBottom: `0.5px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: MUTED, marginBottom: 3 }}>Liquid Account Balance Forecast · GURU Optimized</div>
              <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 400, color: NAVY, letterSpacing: "-0.01em" }}>
                Operating Cash · Liquidity Reserve · Capital Build
              </div>
            </div>
            {/* Legend */}
            <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
              {([
                { label: "Operating Cash",    color: OPS_COLOR },
                { label: "Liquidity Reserve", color: RSV_COLOR },
                { label: "Capital Build",     color: BLD_COLOR },
              ]).map((l, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 18, height: 3, background: l.color, borderRadius: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: MUTED }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Area chart */}
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={fcChartData} margin={{ top: 16, right: 32, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="fv_opsG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={OPS_COLOR} stopOpacity={0.14} />
                    <stop offset="95%" stopColor={OPS_COLOR} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fv_rsvG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={RSV_COLOR} stopOpacity={0.14} />
                    <stop offset="95%" stopColor={RSV_COLOR} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fv_bldG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={BLD_COLOR} stopOpacity={0.14} />
                    <stop offset="95%" stopColor={BLD_COLOR} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: MUTED, fontFamily: FONT }} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 9, fill: MUTED, fontFamily: FONT }}
                  axisLine={false} tickLine={false} width={64}
                  tickFormatter={(v: number) => `$${Math.round(v / 1000)}K`}
                  domain={[0, "auto"]}
                />
                <RechartsTooltip
                  contentStyle={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.10)", borderRadius: 0, fontSize: 11, fontFamily: FONT, boxShadow: "0 2px 16px rgba(0,0,0,0.08)", padding: "8px 12px" }}
                  formatter={(v: number, name: string) => [fmtBal(v), name === "ops" ? "Operating Cash" : name === "rsv" ? "Liquidity Reserve" : "Capital Build"]}
                  labelStyle={{ fontSize: 10, fontWeight: 700, color: NAVY, marginBottom: 3 }}
                  cursor={{ stroke: "rgba(0,0,0,0.08)", strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="ops" stroke={OPS_COLOR} strokeWidth={2} fill="url(#fv_opsG)" dot={false} activeDot={{ r: 3, fill: OPS_COLOR, stroke: "#fff", strokeWidth: 2 }} name="ops" />
                <Area type="monotone" dataKey="rsv" stroke={RSV_COLOR} strokeWidth={2} fill="url(#fv_rsvG)"
                  dot={(props: any) => {
                    if (props.index === rsvTroughIdx) {
                      return <circle key="rsv-trough" cx={props.cx} cy={props.cy} r={5} fill={RSV_COLOR} stroke="#fff" strokeWidth={2} />;
                    }
                    return <g key={props.index} />;
                  }}
                  activeDot={{ r: 3, fill: RSV_COLOR, stroke: "#fff", strokeWidth: 2 }} name="rsv"
                />
                <Area type="monotone" dataKey="bld" stroke={BLD_COLOR} strokeWidth={2} fill="url(#fv_bldG)" dot={false} activeDot={{ r: 3, fill: BLD_COLOR, stroke: "#fff", strokeWidth: 2 }} name="bld" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Monthly balance table ── */}
        <div style={{ background: "#FFFFFF", border: `0.5px solid ${BORDER}`, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px 12px", borderBottom: `0.5px solid ${BORDER}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: MUTED, marginBottom: 3 }}>Month-End Balance · Kessler Family · 2026</div>
            <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 400, color: NAVY }}>Liquid Account Forecast — GURU Optimized</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT }}>
              <thead>
                <tr style={{ background: "hsl(220,5%,97%)", borderBottom: `0.5px solid ${BORDER}` }}>
                  <th style={{ position: "sticky" as const, left: 0, zIndex: 2, background: "hsl(220,5%,97%)", padding: "8px 18px", textAlign: "left" as const, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: MUTED, minWidth: 220, borderRight: `0.5px solid ${BORDER}` }}>Bucket</th>
                  {MONTHS_SHORT.map((mo, mi) => (
                    <th key={mo} style={{ padding: "8px 10px", textAlign: "right" as const, fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: mi === rsvTroughIdx ? RSV_COLOR : MUTED, minWidth: 78, background: mi === rsvTroughIdx ? "rgba(131,88,0,0.04)" : "transparent", whiteSpace: "nowrap" as const }}>
                      {mo}{mi === rsvTroughIdx ? " ▾" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
                  { label: "Operating Cash",    color: OPS_COLOR, values: FC_OPS, desc: "Checking · daily float" },
                  { label: "Liquidity Reserve", color: RSV_COLOR, values: FC_RSV, desc: "MMF · T-bills (short)" },
                  { label: "Capital Build",     color: BLD_COLOR, values: FC_BLD, desc: "Treasuries · goal savings" },
                ] as const).map((bucket, bi) => (
                  <tr key={bi} style={{ background: "#FFFFFF", borderTop: bi > 0 ? `0.5px solid ${BORDER}` : "none" }}>
                    <td style={{ position: "sticky" as const, left: 0, zIndex: 1, background: "#FFFFFF", padding: "10px 18px", borderRight: `0.5px solid ${BORDER}`, borderBottom: `0.5px solid rgba(0,0,0,0.04)` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 3, height: 32, background: bucket.color, flexShrink: 0, borderRadius: 1 }} />
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: NAVY }}>{bucket.label}</div>
                          <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{bucket.desc}</div>
                        </div>
                      </div>
                    </td>
                    {(bucket.values as number[]).map((v, mi) => {
                      const prev = mi > 0 ? (bucket.values as number[])[mi - 1] : v;
                      const delta = v - prev;
                      const isTrough = bucket.color === RSV_COLOR && mi === rsvTroughIdx;
                      return (
                        <td key={mi} style={{ padding: "10px 10px", textAlign: "right" as const, fontSize: 11, fontVariantNumeric: "tabular-nums" as const, color: isTrough ? RSV_COLOR : NAVY, background: isTrough ? "rgba(131,88,0,0.04)" : "transparent", whiteSpace: "nowrap" as const, verticalAlign: "top" as const, borderBottom: `0.5px solid rgba(0,0,0,0.04)` }}>
                          {fmtBal(v)}
                          {mi > 0 && (
                            <div style={{ fontSize: 9, color: delta >= 0 ? "#195830" : "#8B2020", marginTop: 2 }}>
                              {delta >= 0 ? "+" : ""}{fmtBal(Math.abs(delta))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Total row */}
                <tr style={{ background: "hsl(220,5%,97%)", borderTop: `0.5px solid ${BORDER}` }}>
                  <td style={{ position: "sticky" as const, left: 0, zIndex: 1, background: "hsl(220,5%,97%)", padding: "10px 18px", fontSize: 11, fontWeight: 700, color: NAVY, borderRight: `0.5px solid ${BORDER}` }}>Total Liquid Assets</td>
                  {MONTHS_SHORT.map((_, mi) => {
                    const total = FC_OPS[mi] + FC_RSV[mi] + FC_BLD[mi];
                    const prevT = mi > 0 ? FC_OPS[mi-1] + FC_RSV[mi-1] + FC_BLD[mi-1] : total;
                    const delta = total - prevT;
                    return (
                      <td key={mi} style={{ padding: "10px 10px", textAlign: "right" as const, fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums" as const, color: NAVY, background: mi === rsvTroughIdx ? "rgba(131,88,0,0.03)" : "transparent", whiteSpace: "nowrap" as const, verticalAlign: "top" as const }}>
                        {fmtBal(total)}
                        {mi > 0 && (
                          <div style={{ fontSize: 9, fontWeight: 400, color: delta >= 0 ? "#195830" : "#8B2020", marginTop: 2 }}>
                            {delta >= 0 ? "+" : ""}{fmtBal(Math.abs(delta))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
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
  // ── Live calculations — single source of truth via computeLiquidityTargets() ──
  // All liquidity metrics flow from the shared function that also drives the
  // GURU Intelligence detection panel. Changing the bonus date cascades everywhere.
  const av = (desc: string, type?: string) =>
    Number(assets.find(a => (type ? a.type === type : true) && (a.description ?? "").includes(desc))?.value ?? 0);

  const fidelity401k   = av("401", "fixed_income");

  const {
    operatingCash,
    operatingTarget,
    operatingExcess,
    liquidityReserve,
    reserveTarget,
    reserveExcess,
    capitalBuild,
    totalLiquid,
    troughDepth,
    goalSavings,
    totalLiquidityReq,
    excessLiquidity,
    monthlyRate,
    coverageMonths,
  } = computeLiquidityTargets(assets, cashFlows);
  // Table liquidity needed = trough + 2-month operating floor + capital preservation goal
  const liquidityNeededTable = troughDepth + operatingTarget + goalSavings;
  const deployableExcess = Math.max(0, totalLiquid - liquidityNeededTable);

  // Full portfolio return optimization — current AT income vs. pro-forma (target-based redistribution).
  // annualPickup = proformaAnnualIncome − currentAnnualIncome (true delta, not total optimized).
  const {
    currentAnnualIncome:  annualReturnCurrent,
    proformaAnnualIncome: annualReturnOptimized,
    annualPickup:         annualReturnPickup,
  } = computeReturnOptimization(assets, cashFlows);
  const monthlyOpportunityCost = Math.round(annualReturnPickup / 12);

  // Days idle since bonus landed — hardcoded for demo
  // Bonus lands Dec 31, 2025 (same as DEMO_NOW). 47 days represents the urgency scenario.
  const daysIdle = 47;

  // Individual account lookups for display labels in Card 1 data rows
  const chaseChecking    = av("Chase Total Checking");
  const citizensChecking = av("Citizens Private Banking Checking");

  // Rate-vulnerable cash (all floating-rate: MM + savings + 401k/IRA in MMF)
  // Re-derive from assets for rate card (includes 401k MMF)
  const citizensMM   = av("Citizens Private Bank Money Market");
  const capitalOne   = av("CapitalOne");
  const fidelityMMF  = av("Fidelity", "cash");
  const rateVulnerableCash = citizensMM + capitalOne + fidelityMMF; // 401k excluded — retirement accounts not rate-vulnerable for purposes of this card

  // Days until Fed meeting — hardcoded for demo urgency
  // May 7, 2026 Fed decision is 127 days from Dec 31, 2025
  const daysUntilFed = 127;

  // Income at risk from 50bps cut (pre-tax for display, matches client intuition)
  const incomeAtRisk = Math.round(rateVulnerableCash * 0.005);

  // Net worth for action strip
  const netWorthTotal = assets.reduce((s, a) => s + Number(a.value ?? 0), 0)
                      - liabilities.reduce((s, l) => s + Number(l.amount ?? 0), 0);

  // Diversification % = excessLiquidity / (investPortfolio + excessLiquidity)
  // investPortfolio = all equity + fixed_income + alternative, excluding carry and unvested RSUs
  const investPortfolioTotal = assets
    .filter(a => ["equity", "fixed_income", "alternative"].includes(a.type) &&
      !(a.description ?? "").toLowerCase().includes("carry") &&
      !/(rsu|unvested)/i.test(a.description ?? ""))
    .reduce((s, a) => s + Number(a.value ?? 0), 0);
  const diversificationPct = investPortfolioTotal > 0
    ? Math.round(excessLiquidity / (investPortfolioTotal + excessLiquidity) * 100)
    : 11;

  // ── UI state ────────────────────────────────────────────────────────────────
  const [checked,      setChecked]      = useState<Set<string>>(new Set());
  const [fundChecked,  setFundChecked]  = useState<Set<string>>(new Set(["dfa", "cresset", "pimco"]));
  const [showEmail,    setShowEmail]    = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [tpOpen,       setTpOpen]       = useState<Set<string>>(new Set());

  const toggle       = (k: string) => setChecked(p     => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleFund   = (k: string) => setFundChecked(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleTp     = (k: string) => setTpOpen(p      => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // ── Shared style atoms ───────────────────────────────────────────────────────
  const FONT   = "'DM Sans', sans-serif";
  const SERIF  = "'Playfair Display', serif";
  const BG     = "hsl(220,5%,93%)";
  const BORDER = "rgba(0,0,0,0.07)";

  const accentColor: Record<string, string> = {
    liquidity: "#2e7a52",
    invest:    "#1E4F9C",
    rates:     "#c47c2b",
    cashflow:  "#1d4ed8",
  };

  // Card shell — #FFFFFF, 1px border, no border-radius, no shadow; top stripe applied per card
  const cardStyle: React.CSSProperties = {
    background: "#FFFFFF", border: `1px solid rgba(0,0,0,0.08)`,
    display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden",
  };

  // Card head — padding per spec §7
  const headStyle: React.CSSProperties = {
    padding: "14px 16px 12px", borderBottom: `1px solid rgba(0,0,0,0.08)`,
    display: "flex", flexDirection: "column",
  };

  // KPI grid — 1.5fr 1fr 1fr; first cell is dominant (colored), rest are supporting (navy)
  // Spec §8: padding 0 16px on container, cells have their own padding
  const statStrip = (cols: Array<{ label: string; value: React.ReactNode; sub?: string }>) => (
    <div style={{
      display: "grid",
      gridTemplateColumns: cols.length === 2 ? "1.5fr 1fr" : "1.5fr 1fr 1fr",
      borderBottom: `1px solid rgba(0,0,0,0.08)`,
      padding: "0 16px",
    }}>
      {cols.map((col, i) => (
        <div key={i} style={{
          padding: i === 0 ? "12px 14px 12px 0" : "12px 0 12px 14px",
          borderRight: i < cols.length - 1 ? `1px solid rgba(0,0,0,0.08)` : "none",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", marginBottom: 5 }}>{col.label}</div>
          <div>{col.value}</div>
          {col.sub && <div style={{ fontSize: 11, color: "rgba(0,0,0,0.38)", marginTop: 3, lineHeight: 1.4 }}>{col.sub}</div>}
        </div>
      ))}
    </div>
  );

  // KPI dominant number — 22px weight 300, colored (one per card only)
  const bigNum = (val: string | number, color: string, unit?: string) => (
    <div style={{ fontFamily: FONT, fontWeight: 300, fontSize: 22, letterSpacing: "-0.03em", color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
      {val}{unit && <span style={{ fontSize: 13, letterSpacing: 0, fontWeight: 400 }}>{unit}</span>}
    </div>
  );

  // KPI supporting number — 14px weight 300, always plain navy (spec §8)
  const suppNum = (val: string | number, unit?: string) => (
    <div style={{ fontFamily: FONT, fontWeight: 300, fontSize: 14, letterSpacing: "-0.02em", color: "#1a2a4a", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
      {val}{unit && <span style={{ fontSize: 11, letterSpacing: 0, fontWeight: 400 }}>{unit}</span>}
    </div>
  );

  // Data row — name 12px 500, subtext 10px, value 13px weight 300
  const dataRow = (name: React.ReactNode, sub: React.ReactNode, amount: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #ECEAE5" }}>
      <div style={{ minWidth: 0, marginRight: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1915", lineHeight: 1.3 }}>{name}</div>
        {sub && <div style={{ fontSize: 11, color: "#9A9890", marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 300, color: "#1A1915", flexShrink: 0, textAlign: "right", marginLeft: 8, fontVariantNumeric: "tabular-nums" }}>{amount}</div>
    </div>
  );

  // Section label
  const sectionLabel = (text: string) => (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#9A9890", marginBottom: 8 }}>{text}</div>
  );

  // Card footer (checkbox + CTA)
  const cardFooter = (cardKey: string, accent: string, ctaLabel: string, urgencyText?: string, onCta?: () => void) => (
    <div style={{ padding: "10px 18px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: "auto" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={checked.has(cardKey)}
          onChange={() => toggle(cardKey)}
          style={{ width: 15, height: 15, accentColor: accent, cursor: "pointer" }}
        />
        <span style={{ fontSize: 11, fontWeight: 600, color: accent }}>Include in email</span>
      </label>
      {urgencyText && (
        <span style={{ fontSize: 9, fontWeight: 600, color: "#8B2020", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#8B2020", display: "inline-block" }} />
          {urgencyText}
        </span>
      )}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button style={{ fontFamily: FONT, fontSize: 11, fontWeight: 500, padding: "6px 14px", borderRadius: 6, border: `1px solid ${accent}30`, background: "rgba(255,255,255,0.7)", color: accent, cursor: "pointer" }}>
          Defer
        </button>
        <button
          onClick={onCta}
          style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, padding: "6px 18px", borderRadius: 6, border: "none", background: accent, color: "#fff", cursor: "pointer", letterSpacing: "0.02em" }}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );

  // Talking points — summary always visible, bullets toggle on "Full talking points"
  const talkingPoints = (cardKey: string, summary: string, bullets: string[]) => (
    <div style={{ borderTop: `0.5px solid rgba(0,0,0,0.07)`, background: "hsl(220,5%,97%)" }}>
      {/* Header label + rule */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 18px 0" }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9A9890", whiteSpace: "nowrap", marginRight: 12 }}>Talking points</span>
        <div style={{ flex: 1, height: 1, background: "#E2DFD9" }} />
      </div>
      {/* Summary — always visible */}
      <div style={{ padding: "8px 18px 0" }}>
        <p style={{ fontSize: 12, color: "#56544C", lineHeight: 1.7 }}>{summary}</p>
      </div>
      {/* Bullets — toggled */}
      {tpOpen.has(cardKey) && (
        <ul style={{ margin: 0, padding: "8px 18px 0", listStyle: "none", display: "flex", flexDirection: "column" }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderBottom: i < bullets.length - 1 ? "1px solid #E2DFD9" : "none", fontSize: 12, color: "#56544C", lineHeight: 1.7 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C8C5BE", flexShrink: 0, marginTop: 8 }} />
              <span dangerouslySetInnerHTML={{ __html: b }} />
            </li>
          ))}
        </ul>
      )}
      {/* Toggle button */}
      <button
        onClick={() => toggleTp(cardKey)}
        style={{ display: "block", margin: "8px 18px 12px", fontSize: 10, fontWeight: 500, color: tpOpen.has(cardKey) ? "#183B6E" : "#9A9890", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: FONT }}
      >
        {tpOpen.has(cardKey) ? "Hide talking points ▲" : "Full talking points ▼"}
      </button>
    </div>
  );

  // ── Email builder ────────────────────────────────────────────────────────────
  const buildEmailText = () => {
    const paras: string[] = [];
    if (checked.has("liquidity"))
      paras.push(`Your December bonus has created a meaningful liquidity surplus of ${fmt(excessLiquidity)} above what you need for the next 12 months. This cash has been sitting at 0.8% for ${daysIdle} days — earning ${fmt(annualReturnCurrent)}/yr when it should be generating closer to ${fmt(annualReturnOptimized)}/yr after tax. We'd like to put this to work in the investment portfolio. Everything is modeled and ready — just needs your go-ahead.`);
    if (checked.has("invest"))
      paras.push(`Your portfolio currently has no fixed income, is overweight in two single names, and lacks diversified growth exposure. We've mapped out three sleeves — small cap, tactical growth, and commodities — that would be funded entirely from the excess cash. Combined, they add an estimated $20,625/yr in return and bring the portfolio to a more balanced construction.`);
    if (checked.has("rates"))
      paras.push(`The Fed is expected to cut rates on May 7. You have ${fmt(rateVulnerableCash)} sitting in money markets and savings accounts that will reprice immediately when that happens. Moving into a 6-month T-bill now locks in 5.200% through October — that window closes May 5. We recommend acting before then.`);
    if (checked.has("cashflow"))
      paras.push(`I wanted to flag an upcoming movement in your accounts: a $135,000 Treasury bill matures March 31 and lands in your Citizens Money Market. From there, $47,126 moves to operating to rebuild your 2-month expense coverage. No action needed from you — everything is on track.`);
    if (paras.length === 0)
      paras.push("We wanted to check in and share a few items we've been monitoring on your behalf.");
    return ["Hi Sarah and Michael,", "", "Hope you're both doing well.", "", ...paras.flatMap(p => [p, ""]), "Happy to find time for a quick call. Nothing urgent, but worth a conversation.", "", "Best,", "Your Advisor"].join("\n");
  };

  const buildEmailJSX = () => {
    const SectionHead = ({ color, label }: { color: string; label: string }) => (
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 6px" }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.12em", color }}>{label}</span>
        <div style={{ flex: 1, height: 1, background: `${color}33` }} />
      </div>
    );
    return (
      <div style={{ fontSize: 12, lineHeight: 1.75, fontFamily: FONT }}>
        <p>Hi Sarah and Michael,</p>
        <p style={{ marginTop: 10 }}>Hope you're both doing well.</p>
        {checked.has("liquidity") && (
          <>
            <SectionHead color={accentColor.liquidity} label="Idle Cash" />
            <p>Your December bonus has created a surplus of <strong>{fmt(excessLiquidity)}</strong> above what you need for the year. It's been sitting at 0.8% for <strong>{daysIdle} days</strong> — earning {fmt(annualReturnCurrent)}/yr when it could be generating closer to <strong>{fmt(annualReturnOptimized)}/yr</strong> after tax. We'd like to put this to work — everything is modeled and ready to move.</p>
          </>
        )}
        {checked.has("invest") && (
          <>
            <SectionHead color={accentColor.invest} label="Portfolio" />
            <p>The portfolio has no fixed income, is overweight in two single names, and lacks diversified growth exposure. We've mapped three sleeves — small cap, tactical growth, and commodities — funded entirely from the excess cash. Together they add an estimated <strong>$20,625/yr</strong> and bring the portfolio to a more balanced construction.</p>
          </>
        )}
        {checked.has("rates") && (
          <>
            <SectionHead color={accentColor.rates} label="Rate Lock" />
            <p>The Fed is expected to cut on <strong>May 7</strong>. You have <strong>{fmt(rateVulnerableCash)}</strong> in floating-rate accounts that will reprice immediately. Moving to a 6-month T-bill now locks 5.200% through October. <strong>Window closes May 5.</strong></p>
          </>
        )}
        {checked.has("cashflow") && (
          <>
            <SectionHead color={accentColor.cashflow} label="Cash Movements" />
            <p>A <strong>$135,000 Treasury bill</strong> matures March 31 and lands in your Citizens Money Market. From there, <strong>$47,126 moves to operating</strong> to rebuild two months of expense coverage. Nothing needed from you — all on track.</p>
          </>
        )}
        <p style={{ marginTop: 16 }}>Happy to find time for a quick call. Nothing urgent, but worth a conversation.</p>
        <p style={{ marginTop: 10 }}>Best,<br />Your Advisor</p>
      </div>
    );
  };

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: FONT, background: BG, minHeight: "100vh", paddingBottom: 100 }}>
      <style>{`
        @keyframes alertDot { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes phBlink { 0%,100%{opacity:1} 50%{opacity:0.15} }
      `}</style>

      {/* Page header */}
      <div style={{ padding: "28px 32px 0", background: BG }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>

          {/* Left — editorial */}
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: "rgba(0,0,0,0.38)", letterSpacing: "-0.01em", lineHeight: 1.2, marginBottom: 6, whiteSpace: "nowrap" }}>
              Good morning, Tara
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 400, letterSpacing: "-0.025em", color: "hsl(222,45%,12%)", lineHeight: 1.1, whiteSpace: "nowrap" }}>
              Three capital allocation decisions for the Kesslers
            </div>
          </div>

          {/* Right — system status */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0, paddingTop: 4 }}>
            {/* Line 1 — with blink dot */}
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3a9e6a", display: "inline-block", flexShrink: 0, animation: "phBlink 1.8s ease infinite" }} />
              <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#3a9e6a", whiteSpace: "nowrap" }}>GURU analysis complete</span>
            </div>
            {/* Line 2 */}
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#3a9e6a", whiteSpace: "nowrap", paddingLeft: 13 }}>Ready to execute</div>
            {/* Line 3 — timestamp */}
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, fontWeight: 400, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "#3a9e6a", whiteSpace: "nowrap", paddingLeft: 13, marginTop: 1 }}>Updated 2026-03-06 · 09:42:17</div>
          </div>

        </div>
      </div>

      {/* ── Situation Overview ── */}
      <div style={{ margin: "0 32px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", display: "grid", gridTemplateColumns: "120px 1fr" }}>
        <div style={{ padding: 16, borderRight: "1px solid rgba(0,0,0,0.08)", fontSize: 10, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)" }}>
          Situation overview
        </div>
        <div style={{ padding: "14px 18px", fontSize: 13, fontWeight: 400, color: "rgba(0,0,0,0.55)", lineHeight: 1.7 }}>
          The Kesslers' liquidity profile has increased significantly since year-end — and the window to get in front of it is closing.{" "}
          <strong style={{ color: "#1a1917", fontWeight: 600 }}>{fmt(excessLiquidity)}</strong> in bonus cash has been sitting at 0.8% for{" "}
          <strong style={{ color: "#1a1917", fontWeight: 600 }}>{daysIdle} days</strong>, the portfolio remains poorly diversified and that cash could be deployed to build the right exposures, and{" "}
          <strong style={{ color: "#1a1917", fontWeight: 600 }}>{fmt(rateVulnerableCash)}</strong> in floating-rate cash reprices the moment the Fed acts on{" "}
          <strong style={{ color: "#1a1917", fontWeight: 600 }}>May 7</strong>. We've modeled the three moves that close these gaps — together they add an estimated{" "}
          <strong style={{ color: accentColor.liquidity, fontWeight: 600 }}>+{fmt(annualReturnPickup)}/yr</strong> in additional after-tax income. Capital that's already here, just not working. Rate lock deadline:{" "}
          <strong style={{ color: accentColor.rates, fontWeight: 600 }}>May 5</strong>.
        </div>
      </div>

      {/* ── Stats strip — flush below situation overview ── */}
      <div style={{ margin: "0 32px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderTop: "none", display: "flex", alignItems: "stretch", padding: "0 16px" }}>
        {/* NET WORTH — first */}
        <div style={{ padding: "14px 20px 14px 0", marginTop: 10, marginBottom: 10, borderRight: "1px solid rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", marginBottom: 4 }}>Net Worth</div>
          <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 18, letterSpacing: "-0.02em", color: "#1a2a4a", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmt(netWorthTotal)}</div>
        </div>
        {/* BONUS CASH SITTING IDLE */}
        <div style={{ padding: "14px 20px 14px 20px", marginTop: 10, marginBottom: 10, borderRight: "1px solid rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", marginBottom: 4 }}>Bonus Cash Sitting Idle</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 18, letterSpacing: "-0.02em", color: "#c47c2b", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmt(excessLiquidity)}</div>
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.38)" }}>for {daysIdle} days</div>
          </div>
        </div>
        {/* POTENTIAL AFTER-TAX INCOME INCREASE FROM OPTIMIZATION */}
        <div style={{ padding: "14px 20px 14px 20px", marginTop: 10, marginBottom: 10, borderRight: "1px solid rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", marginBottom: 4 }}>Potential After-Tax Income Increase</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 18, letterSpacing: "-0.02em", color: "#2e7a52", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>+{fmt(annualReturnPickup)}</div>
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.38)" }}>per year after tax</div>
          </div>
        </div>
        {/* RATE LOCK WINDOW CLOSES */}
        <div style={{ padding: "14px 20px 14px 20px", marginTop: 10, marginBottom: 10, borderRight: "1px solid rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", marginBottom: 4 }}>Rate Lock Window Closes</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 18, letterSpacing: "-0.02em", color: "#9b2020", lineHeight: 1 }}>May 5</div>
            <div style={{ fontSize: 12, color: "#9b2020", fontWeight: 500 }}>{daysUntilFed} days</div>
          </div>
        </div>
        {/* APRIL CASH FLOWS */}
        <div style={{ padding: "14px 20px 14px 20px", marginTop: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", marginBottom: 4 }}>April Cash Flows</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 18, letterSpacing: "-0.02em", color: "#1a2a4a", lineHeight: 1 }}>On track</div>
            <div style={{ fontSize: 12, color: "#2e7a52", fontWeight: 600 }}>✓</div>
          </div>
        </div>
      </div>

      {/* ── Card Grid ── */}
      <div style={{ padding: "12px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>

          {/* ─────────────── CARD 1: Excess Liquidity ─────────────── */}
          <div style={cardStyle}>
            {/* Top stripe — 3px horizontal, spec §7 */}
            <div style={{ height: 3, background: accentColor.liquidity, flexShrink: 0 }} />
            {/* Header band */}
            <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid rgba(0,0,0,0.08)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: accentColor.liquidity }}>Liquidity</span>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#9B2020", padding: "3px 10px", border: "1px solid rgba(155,32,32,0.3)" }}>High priority</span>
            </div>
            {/* Headline section */}
            <div style={headStyle}>
              <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 400, color: "#1a2a4a", lineHeight: 1.3, letterSpacing: "-0.01em", minHeight: 52 }}>
                Bonus cash has been sitting idle for {daysIdle} days — time to put it to work
              </div>
              <div style={{ fontSize: 13, fontWeight: 400, color: "rgba(0,0,0,0.55)", lineHeight: 1.55, marginTop: 8 }}>
                Since the January bonus landed, coverage went from 6 to{" "}
                <span style={{ color: "#1E4F9C", textDecoration: "underline", cursor: "pointer" }}>{coverageMonths.toFixed(1)} months</span>.{" "}
                The excess is yielding{" "}
                <span style={{ color: "#1E4F9C", textDecoration: "underline", cursor: "pointer" }}>0.8%</span>{" "}
                — well below what it could be earning deployed elsewhere.
              </div>
            </div>
            {/* KPI strip — dominant first, supporting navy */}
            {statStrip([
              { label: "Excess Liquidity",  value: bigNum(fmt(excessLiquidity), accentColor.liquidity),    sub: `${daysIdle} days idle · 0.8% avg yield` },
              { label: "Potential After-Tax Income Increase", value: bigNum(`+${fmt(annualReturnPickup)}`, accentColor.liquidity, "/yr"), sub: "if deployed today" },
              { label: "Cash Coverage",     value: suppNum(coverageMonths.toFixed(1), " months"),           sub: "of monthly expenses" },
            ])}
            {/* Body */}
            <div style={{ padding: "0 16px 14px", flex: 1 }}>
              {/* Section header */}
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", padding: "10px 0 5px", borderBottom: `1px solid rgba(0,0,0,0.04)`, marginBottom: 0 }}>
                GURU's Estimate of Kesslers 12 Month Cash Liquidity Need
              </div>
              {/* Row 1: Cash for next 12 months of net outflows */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 0 9px 14px", borderBottom: `1px solid rgba(0,0,0,0.04)` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1a2a4a", lineHeight: 1.3 }}>Cash for next 12 months of net outflows</div>
                  <div style={{ fontSize: 11, color: "rgba(0,0,0,0.38)", marginTop: 2, lineHeight: 1.4 }}>Cumulative outflow through November</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 300, color: "#1a2a4a", flexShrink: 0, marginLeft: 16, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(troughDepth)}</div>
              </div>
              {/* Row 2: Operating cash on hand */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 0 9px 14px", borderBottom: `1px solid rgba(0,0,0,0.04)` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1a2a4a", lineHeight: 1.3 }}>Operating cash on hand — 2 months</div>
                  <div style={{ fontSize: 11, color: "rgba(0,0,0,0.38)", marginTop: 2, lineHeight: 1.4 }}>Always 2 months of forward expenses</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 300, color: "#1a2a4a", flexShrink: 0, marginLeft: 16, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(operatingTarget)}</div>
              </div>
              {/* Row 3: Capital preservation */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 0 9px 14px", borderBottom: `1px solid rgba(0,0,0,0.04)` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1a2a4a", lineHeight: 1.3 }}>Capital preservation — home purchase</div>
                  <div style={{ fontSize: 11, color: "rgba(0,0,0,0.38)", marginTop: 2, lineHeight: 1.4 }}>Down payment reserve — June 2027</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 300, color: "#1a2a4a", flexShrink: 0, marginLeft: 16, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(goalSavings)}</div>
              </div>
              {/* Subtotal: Total liquidity needed */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: `1px solid rgba(0,0,0,0.08)`, borderBottom: `1px solid rgba(0,0,0,0.04)` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a4a" }}>Total liquidity needed</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a4a", flexShrink: 0, marginLeft: 16, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(liquidityNeededTable)}</div>
              </div>
              {/* Total liquid assets (indented) */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0 9px 14px", borderBottom: `1px solid rgba(0,0,0,0.04)` }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(0,0,0,0.55)" }}>Total liquid assets</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(0,0,0,0.55)", flexShrink: 0, marginLeft: 16, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(totalLiquid)}</div>
              </div>
              {/* Total row: Deployable excess */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0 4px", borderTop: `1px solid rgba(0,0,0,0.08)` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: accentColor.liquidity }}>Deployable excess</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: accentColor.liquidity, flexShrink: 0, marginLeft: 16, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(deployableExcess)}</div>
              </div>
            </div>
            {talkingPoints("liquidity",
              `The Kesslers now have ${coverageMonths.toFixed(1)} months of cash expense coverage — more than double what they need. The full liquid portfolio currently generates ${fmt(annualReturnCurrent)}/yr after tax. Optimized across all accounts, it generates ${fmt(annualReturnOptimized)}/yr — a pickup of ${fmt(annualReturnPickup)}/yr.`,
              [
                `<strong>Coverage floor is 6 months</strong> — the Kesslers are well above it. Everything above that floor is investable.`,
                `The liquid portfolio earns <strong>${fmt(annualReturnCurrent)}/yr</strong> today. At best-product yields for each bucket, it earns <strong>${fmt(annualReturnOptimized)}/yr</strong> — a <strong>+${fmt(annualReturnPickup)}/yr</strong> pickup.`,
                `The ${fmt(excessLiquidity)} in excess has been idle for <strong>${daysIdle} days</strong>. Every month it stays in cash costs them roughly ${fmt(monthlyOpportunityCost)}.`,
                `No new money needed — this is capital that's already here, just not working.`,
              ]
            )}
            {cardFooter("liquidity", accentColor.liquidity, "Deploy →", "May 5 deadline", () => onNavigate("allocation"))}
          </div>

          {/* ─────────────── CARD 2: Portfolio / Rebalance ─────────────── */}
          <div style={cardStyle}>
            {/* Top stripe */}
            <div style={{ height: 3, background: accentColor.invest, flexShrink: 0 }} />
            {/* Header band */}
            <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid rgba(0,0,0,0.08)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: accentColor.invest }}>Investments</span>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: accentColor.invest, padding: "3px 10px", border: `1px solid ${accentColor.invest}50` }}>Portfolio action</span>
            </div>
            {/* Headline section */}
            <div style={headStyle}>
              <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 400, color: "#1a2a4a", lineHeight: 1.3, letterSpacing: "-0.01em", minHeight: 52 }}>
                Excess liquidity can fund three new sleeves to address underweight exposures
              </div>
              <div style={{ fontSize: 13, fontWeight: 400, color: "rgba(0,0,0,0.55)", lineHeight: 1.55, marginTop: 8 }}>
                The Kesslers' portfolio has no commodities or inflation hedge and is underweight diversified growth and small cap. We can build all three positions through harvested excess cash.
              </div>
            </div>
            {/* KPI strip */}
            {statStrip([
              { label: "Diversification Added",       value: bigNum(`~${diversificationPct}%`, accentColor.invest), sub: "broader exposure across 3 sleeves" },
              { label: "Cash Deployed",               value: suppNum(fmt(excessLiquidity)),                         sub: "from liquidity excess" },
              { label: "5-Year Weighted Avg Return",  value: suppNum("6.9%"),                                       sub: "across the three sleeves" },
            ])}
            {/* Body */}
            <div style={{ padding: "14px 16px", flex: 1 }}>
              {sectionLabel("Sleeves added — funded by redeployed cash")}
              <div>
                {/* DFA US Small Cap Value */}
                <div style={{ padding: "10px 0", borderBottom: `1px solid ${BORDER}`, opacity: fundChecked.has("dfa") ? 1 : 0.45, transition: "opacity 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1, minWidth: 0 }}>
                      <input type="checkbox" checked={fundChecked.has("dfa")} onChange={() => toggleFund("dfa")} style={{ marginTop: 2, width: 13, height: 13, accentColor: accentColor.invest, cursor: "pointer", flexShrink: 0 }} />
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1915" }}>DFA US Small Cap Value</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 400, color: "#1A1915", flexShrink: 0, marginLeft: 8 }}>$95,000</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#9A9890", marginTop: 2, paddingLeft: 21 }}>5-yr historical <strong style={{ color: "#4a6e3a" }}>8.4%</strong> · Added exposure <strong style={{ color: "#4a6e3a" }}>~4.3%</strong></div>
                  <div style={{ fontSize: 12, color: "#7a7870", marginTop: 3, lineHeight: 1.55, paddingLeft: 21 }}>Rules-based small-cap strategy — 800+ holdings, value-tilted, low turnover. Captures the small-cap premium across full market cycles.</div>
                </div>
                {/* Cresset Tactical Allocation */}
                <div style={{ padding: "10px 0", borderBottom: `1px solid ${BORDER}`, opacity: fundChecked.has("cresset") ? 1 : 0.45, transition: "opacity 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1, minWidth: 0 }}>
                      <input type="checkbox" checked={fundChecked.has("cresset")} onChange={() => toggleFund("cresset")} style={{ marginTop: 2, width: 13, height: 13, accentColor: accentColor.invest, cursor: "pointer", flexShrink: 0 }} />
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1915" }}>Cresset Tactical Allocation</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 400, color: "#1A1915", flexShrink: 0, marginLeft: 8 }}>$145,000</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#9A9890", marginTop: 2, paddingLeft: 21 }}>5-yr historical <strong style={{ color: "#4a6e3a" }}>6.2%</strong> · Added exposure <strong style={{ color: "#4a6e3a" }}>~4.4%</strong></div>
                  <div style={{ fontSize: 12, color: "#7a7870", marginTop: 3, lineHeight: 1.55, paddingLeft: 21 }}>Actively managed, rotating across sectors based on macro signals and earnings trends. Track record across multiple rate environments.</div>
                </div>
                {/* PIMCO Commodity Real Return */}
                <div style={{ padding: "10px 0", opacity: fundChecked.has("pimco") ? 1 : 0.45, transition: "opacity 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1, minWidth: 0 }}>
                      <input type="checkbox" checked={fundChecked.has("pimco")} onChange={() => toggleFund("pimco")} style={{ marginTop: 2, width: 13, height: 13, accentColor: accentColor.invest, cursor: "pointer", flexShrink: 0 }} />
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1915" }}>PIMCO Commodity Real Return</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 400, color: "#1A1915", flexShrink: 0, marginLeft: 8 }}>{fmt(excessLiquidity - 240000)}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#9A9890", marginTop: 2, paddingLeft: 21 }}>5-yr historical <strong style={{ color: "#4a6e3a" }}>5.0%</strong> · Added exposure <strong style={{ color: "#4a6e3a" }}>~2.3%</strong></div>
                  <div style={{ fontSize: 12, color: "#7a7870", marginTop: 3, lineHeight: 1.55, paddingLeft: 21 }}>Commodity futures and inflation-linked instruments managed by PIMCO for positive real returns above rising price environments.</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0 0", borderTop: `1px solid rgba(0,0,0,0.08)`, marginTop: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: accentColor.invest }}>Total invested from redeployed cash</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: accentColor.invest, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(excessLiquidity)}</span>
              </div>
            </div>
            {talkingPoints("invest",
              "The portfolio has three structural gaps that the excess cash closes cleanly: no fixed income, concentrated single-name risk, and no diversified growth exposure.",
              [
                `<strong>No fixed income</strong> — adding PIMCO and DFA creates yield and ballast without adding duration risk.`,
                `<strong>Concentrated single names</strong> — Meta and Bank of America represent meaningful concentration. New sleeves dilute that without requiring a tax event.`,
                `<strong>Diversified growth</strong> — Cresset Tactical brings systematic exposure to small cap and international factors the portfolio currently lacks.`,
                `All three sleeves are funded entirely from the excess cash. No liquidations required.`,
              ]
            )}
            {cardFooter("invest", accentColor.invest, "Approve allocation →", undefined, () => onNavigate("investments"))}
          </div>

          {/* ─────────────── CARD 3: Fed / T-Bills ─────────────── */}
          <div style={cardStyle}>
            {/* Top stripe */}
            <div style={{ height: 3, background: accentColor.rates, flexShrink: 0 }} />
            {/* Header band */}
            <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid rgba(0,0,0,0.08)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: accentColor.rates }}>Interest rates</span>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: accentColor.rates, padding: "3px 10px", border: `1px solid ${accentColor.rates}50` }}>Act before May 5</span>
            </div>
            {/* Headline section */}
            <div style={headStyle}>
              <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 400, color: "#1a2a4a", lineHeight: 1.3, letterSpacing: "-0.01em", minHeight: 52 }}>
                Move to T-bills to lock in rate before Fed cuts — {daysUntilFed} days before Fed meeting
              </div>
              <div style={{ fontSize: 13, fontWeight: 400, color: "rgba(0,0,0,0.55)", lineHeight: 1.55, marginTop: 8 }}>
                The Fed is expected to cut on May 7. Money market funds will reprice immediately. Moving into short-term government bonds locks the current yield for six months.
              </div>
            </div>
            {/* KPI strip — rate-vulnerable cash dominant, rest navy */}
            {statStrip([
              { label: "Rate-Vulnerable Cash",      value: bigNum(fmt(rateVulnerableCash), accentColor.rates),    sub: `${daysUntilFed} days until Fed` },
              { label: "After-Tax Income at Risk",  value: suppNum(`${fmt(incomeAtRisk)}/yr`),                    sub: "lost if nothing moves" },
              { label: "T-Bill Rate Available",     value: suppNum("5.200%"),                                     sub: "6-month · locked through Oct '26" },
            ])}
            {/* Body — three-column positions table, spec §9 */}
            <div style={{ flex: 1 }}>
              {/* Column header row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 80px", background: "rgba(0,0,0,0.02)", borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
                <div style={{ padding: "7px 16px", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)" }}>Position</div>
                <div style={{ padding: "7px 0", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", textAlign: "right" }}>Current yield</div>
                <div style={{ padding: "7px 16px 7px 0", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", textAlign: "right" }}>Balance</div>
              </div>
              {/* Position rows */}
              {([
                { name: "Citizens Private Bank Money Market",  sub: "Floating rate · reprices at Fed decision", yield: "3.65%", bal: fmt(citizensMM) },
                { name: "CapitalOne 360 Performance Savings",  sub: "Floating rate · reprices at Fed decision", yield: "3.78%", bal: fmt(capitalOne) },
                { name: "Fidelity Cash Sweep / SPAXX",         sub: "Brokerage money market · daily repricing", yield: "2.50%", bal: fmt(fidelityMMF) },
              ] as const).map((row, i, arr) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 80px", padding: "10px 0 10px 22px", borderBottom: i < arr.length - 1 ? `1px solid rgba(0,0,0,0.04)` : "none", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 400, color: "#1a2a4a", lineHeight: 1.3 }}>{row.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(0,0,0,0.38)", marginTop: 2 }}>{row.sub}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 400, color: "#c47c2b", textAlign: "right", paddingTop: 1, fontVariantNumeric: "tabular-nums" }}>{row.yield}</div>
                  <div style={{ fontSize: 13, fontWeight: 300, color: "#1a2a4a", textAlign: "right", paddingRight: 16, paddingTop: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{row.bal}</div>
                </div>
              ))}
              {/* Total row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 16px 10px 16px", borderTop: `1px solid rgba(0,0,0,0.08)` }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: accentColor.rates }}>Total rate-vulnerable cash</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: accentColor.rates, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(citizensMM + capitalOne + fidelityMMF)}</span>
              </div>
            </div>
            {talkingPoints("rates",
              `The Fed is widely expected to cut 50bps in the next year. ${fmt(rateVulnerableCash)} in floating-rate accounts will reprice the day the decision is announced. A 6-month T-bill at 5.200% locks today's yield through October and protects against that drop.`,
              [
                `<strong>Floating-rate exposure</strong> — all money markets and savings accounts reprice immediately at the Fed decision. No delay.`,
                `At 50bps cut, the Kesslers lose <strong>${fmt(incomeAtRisk)}/yr</strong> pre-tax in income on this cash — avoidable if they move before May 5.`,
                `A 6-month T-bill at <strong>5.200%</strong> locks the current rate through October '26. After that, they can reassess the rate environment.`,
                `This is a low-risk, time-sensitive move. The only cost is acting before the deadline.`,
              ]
            )}
            {cardFooter("rates", accentColor.rates, "Lock rate →", "Window closes May 5", () => onNavigate("guru"))}
          </div>

          {/* ─────────────── CARD 4: Money Movement (spans 2 cols) ─────────────── */}
          <div style={{ ...cardStyle, gridColumn: "1 / span 2" }}>
            {/* Top stripe */}
            <div style={{ height: 3, background: accentColor.cashflow, flexShrink: 0 }} />
            {/* Header band */}
            <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: accentColor.cashflow }}>Money movement</span>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", padding: "3px 10px", border: `1px solid rgba(0,0,0,0.12)` }}>April 2026</span>
            </div>
            {/* Head */}
            <div style={headStyle}>
              <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 400, color: "#1a2a4a", lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                {format(addMonths(DEMO_NOW, 1), "MMMM")} Money Movement — Where Every Dollar Goes
              </div>
              <div style={{ fontSize: 13, fontWeight: 400, color: "rgba(0,0,0,0.55)", lineHeight: 1.55, marginTop: 8 }}>
                The three-bucket structure is flowing as designed. $46,739 autodrew from Reserve into Operating this month to maintain 2-month expense coverage. Two tax payments and a tuition installment are due in the next 40 days.
              </div>
            </div>
            {/* Two-column body */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1 }}>
              {/* LEFT: Automatic transfers / flow diagram */}
              <div style={{ padding: "16px 20px 20px", background: "#fafaf8", borderRight: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", marginBottom: 14 }}>Automatic transfers — {format(addMonths(DEMO_NOW, 1), "MMMM")}</div>
                <style>{`
                  @keyframes flowUp{0%{transform:translateY(6px);opacity:0}60%{opacity:1}100%{transform:translateY(-6px);opacity:0}}
                  .cf-arrow-dot{animation:flowUp 1.8s linear infinite;}
                  .cf-arrow-dot-slow{animation:flowUp 2.4s linear infinite 0.4s;}
                `}</style>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

                  {/* OPERATING row */}
                  <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
                    <div style={{ width: 100, flexShrink: 0, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: "16px 8px", background: "#1e3a5f" }}>
                      <span style={{ fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "rgba(255,255,255,0.65)", fontSize: 8, fontFamily: FONT }}>OPERATING</span>
                      <span style={{ fontWeight: 300, color: "#ffffff", fontSize: 18, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums", lineHeight: 1, fontFamily: FONT }}>$90,879</span>
                    </div>
                    <div style={{ flex: 1, border: "1px solid rgba(30,58,95,0.18)", borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(30,58,95,0.03)" }}>
                        <div style={{ minWidth: 0, marginRight: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#1e3a5f", lineHeight: 1.3, fontFamily: FONT }}>CIT Money Market Bank Account</div>
                          <div style={{ fontSize: 11, color: "#4a6a9a", marginTop: 2, fontFamily: FONT }}>Primary operating · Apr ending</div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", fontVariantNumeric: "tabular-nums", flexShrink: 0, fontFamily: FONT }}>$90,879</span>
                      </div>
                    </div>
                  </div>

                  {/* Arrow: JPMorgan → CIT */}
                  <div style={{ display: "flex", alignItems: "center", minHeight: 36, paddingLeft: 112 }}>
                    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, cursor: "default", marginLeft: 18 }}>
                      <svg width="12" height="36" style={{ flexShrink: 0, overflow: "visible" }}>
                        <path d="M 6,34 L 6,2" stroke="#1e3a5f" strokeWidth="1.5" strokeDasharray="4,2.5" fill="none" />
                        <polygon points="0,-4 4,3 -4,3" fill="#1e3a5f" opacity="0.85">
                          <animateMotion dur="1.9s" repeatCount="indefinite" calcMode="linear" path="M 6,34 L 6,2" />
                        </polygon>
                      </svg>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#1e3a5f", background: "#eef2f8", border: "1px solid #c5d4e8", padding: "3px 10px", borderRadius: 20, fontFamily: FONT, whiteSpace: "nowrap" }}>
                        ↑ $46,739 · JPMorgan → CIT
                      </span>
                    </div>
                  </div>

                  {/* RESERVE row */}
                  <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
                    <div style={{ width: 100, flexShrink: 0, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: "16px 8px", background: "#7c4a0a" }}>
                      <span style={{ fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "rgba(255,255,255,0.65)", fontSize: 8, fontFamily: FONT }}>RESERVE</span>
                      <span style={{ fontWeight: 300, color: "#ffffff", fontSize: 18, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums", lineHeight: 1, fontFamily: FONT }}>{fmt(capitalBuild)}</span>
                    </div>
                    <div style={{ flex: 1, border: "1px solid rgba(124,74,10,0.2)", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(124,74,10,0.03)", borderBottom: "1px solid rgba(124,74,10,0.1)" }}>
                        <div style={{ minWidth: 0, marginRight: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#7c4a0a", lineHeight: 1.3, fontFamily: FONT }}>JPMorgan 100% Treasuries MMF</div>
                          <div style={{ fontSize: 11, color: "#a06020", marginTop: 2, fontFamily: FONT }}>Autodraw to Operating</div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#7c4a0a", fontVariantNumeric: "tabular-nums", flexShrink: 0, fontFamily: FONT }}>$27,927</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 14px" }}>
                        <svg width="12" height="26" style={{ flexShrink: 0, overflow: "visible" }}>
                          <path d="M 6,24 L 6,2" stroke="#7c4a0a" strokeWidth="1.5" strokeDasharray="4,2.5" fill="none" />
                          <polygon points="0,-4 4,3 -4,3" fill="#a06020" opacity="0.85">
                            <animateMotion dur="1.5s" repeatCount="indefinite" calcMode="linear" path="M 6,24 L 6,2" />
                          </polygon>
                        </svg>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#7c4a0a", background: "#fdf5e6", border: "1px solid #e8c87a", padding: "2px 8px", borderRadius: 20, fontFamily: FONT, whiteSpace: "nowrap" }}>
                          ↑ $7,478 · T-Bill → JPMorgan
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(124,74,10,0.03)", borderTop: "1px solid rgba(124,74,10,0.1)" }}>
                        <div style={{ minWidth: 0, marginRight: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#7c4a0a", lineHeight: 1.3, fontFamily: FONT }}>T-Bill Ladder</div>
                          <div style={{ fontSize: 11, color: "#a06020", marginTop: 2, fontFamily: FONT }}>3-Mo / 6-Mo / 9-Mo · +$7,478 Maturing</div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#7c4a0a", fontVariantNumeric: "tabular-nums", flexShrink: 0, fontFamily: FONT }}>$101,458</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 8 }} />

                  {/* BUILD row */}
                  <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
                    <div style={{ width: 100, flexShrink: 0, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: "16px 8px", background: "#155234" }}>
                      <span style={{ fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "rgba(255,255,255,0.65)", fontSize: 8, fontFamily: FONT }}>BUILD</span>
                      <span style={{ fontWeight: 300, color: "#ffffff", fontSize: 18, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums", lineHeight: 1, fontFamily: FONT }}>$226,545</span>
                    </div>
                    <div style={{ flex: 1, border: "1px solid rgba(21,82,52,0.18)", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(21,82,52,0.03)", borderBottom: "1px solid rgba(21,82,52,0.1)" }}>
                        <div style={{ minWidth: 0, marginRight: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#155234", lineHeight: 1.3, fontFamily: FONT }}>2028 Municipal Bonds</div>
                          <div style={{ fontSize: 11, color: "#2a7a52", marginTop: 2, fontFamily: FONT }}>Tax-advantaged income</div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#155234", fontVariantNumeric: "tabular-nums", flexShrink: 0, fontFamily: FONT }}>$32,161</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(21,82,52,0.03)" }}>
                        <div style={{ minWidth: 0, marginRight: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#155234", lineHeight: 1.3, fontFamily: FONT }}>S&amp;P Low Volatility Index</div>
                          <div style={{ fontSize: 11, color: "#2a7a52", marginTop: 2, fontFamily: FONT }}>Short-duration ladder</div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#155234", fontVariantNumeric: "tabular-nums", flexShrink: 0, fontFamily: FONT }}>$194,384</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* RIGHT: Scheduled payments */}
              <div style={{ padding: "16px 20px 20px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", marginBottom: 14 }}>Scheduled payments</div>
                {([
                  {
                    label: "Dalton — Spring Tuition",
                    amount: 15000, dueDate: "Apr 1", daysOut: 21, method: "Wire" as const, category: "education" as const, urgent: true,
                    from: { name: "CIT Bank Operating", last4: "7842" },
                    to:   { name: "The Dalton School", bank: "JPMorgan Chase", last4: "3391" },
                  },
                  {
                    label: "Federal Estimated Tax — Q1 2026",
                    amount: 30000, dueDate: "Apr 15", daysOut: 35, method: "ACH" as const, category: "tax" as const, urgent: true,
                    from: { name: "CIT Bank Operating", last4: "7842" },
                    to:   { name: "IRS / EFTPS", bank: "IRS ACH Debit", last4: null },
                  },
                  {
                    label: "NYC Property Tax — 2nd Installment",
                    amount: 17500, dueDate: "Jul 15", daysOut: 95, method: "Wire" as const, category: "tax" as const, urgent: false,
                    from: { name: "CIT Bank Operating", last4: "7842" },
                    to:   { name: "NYC Dept of Finance", bank: "Citibank N.A.", last4: "2280" },
                  },
                  {
                    label: "Federal Estimated Tax — Q3 2026",
                    amount: 30000, dueDate: "Sep 15", daysOut: 157, method: "ACH" as const, category: "tax" as const, urgent: false,
                    from: { name: "CIT Bank Operating", last4: "7842" },
                    to:   { name: "IRS / EFTPS", bank: "IRS ACH Debit", last4: null },
                  },
                ] as const).map((pmt, i) => (
                  <div key={i} style={{ padding: "12px 0", borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
                    {/* Top row: category + due date + amount */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 5 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: pmt.category === "tax" ? "#7c4a0a" : accentColor.invest, background: pmt.category === "tax" ? "rgba(124,74,10,0.08)" : "rgba(30,79,156,0.07)", padding: "2px 7px", borderRadius: 3 }}>{pmt.category}</span>
                          {pmt.urgent
                            ? <span style={{ fontSize: 10, fontWeight: 600, color: "#9b2020" }}>Due {pmt.dueDate} · {pmt.daysOut} days</span>
                            : <span style={{ fontSize: 10, color: "rgba(0,0,0,0.38)" }}>Due {pmt.dueDate}</span>}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#1a2a4a", lineHeight: 1.3 }}>{pmt.label}</div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right", paddingLeft: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 300, color: "#1a2a4a", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(pmt.amount)}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: pmt.method === "Wire" ? "#1E4F9C" : "#2e7a52", marginTop: 2, letterSpacing: "0.04em" }}>{pmt.method}</div>
                      </div>
                    </div>
                    {/* Account routing detail */}
                    <div style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: "3px 8px", alignItems: "start", marginTop: 6 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.30)", letterSpacing: "0.06em", paddingTop: 1 }}>FR</span>
                      <span style={{ fontSize: 11, color: "rgba(0,0,0,0.50)" }}>{pmt.from.name}<span style={{ color: "rgba(0,0,0,0.30)" }}> ····{pmt.from.last4}</span></span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.30)", letterSpacing: "0.06em", paddingTop: 1 }}>TO</span>
                      <span style={{ fontSize: 11, color: "rgba(0,0,0,0.50)" }}>
                        {pmt.to.name}
                        {pmt.to.last4 ? <span style={{ color: "rgba(0,0,0,0.30)" }}> · {pmt.to.bank} ····{pmt.to.last4}</span>
                                       : <span style={{ color: "rgba(0,0,0,0.30)" }}> · {pmt.to.bank}</span>}
                      </span>
                    </div>
                  </div>
                ))}
                {/* Total upcoming */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 0 0", borderTop: `1px solid rgba(0,0,0,0.08)`, marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1a2a4a" }}>Total upcoming obligations</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1a2a4a", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(15000 + 30000 + 17500 + 30000)}</span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(0,0,0,0.38)", marginTop: 4 }}>All covered by current liquid assets · no action needed</div>
              </div>

            </div>{/* end two-column body */}
            {cardFooter("cashflow", accentColor.cashflow, "View detail →", undefined, () => onNavigate("cashflow"))}
            {talkingPoints("cashflow",
              "The three-bucket structure is running automatically. Two tax payments and a tuition installment total $75,000 over the next 35 days — all covered by existing operating cash.",
              [
                `<strong>$46,739</strong> autodrew from JPMorgan Treasuries MMF into the CIT bank account this month — keeping 2 months of forward cash expense coverage.`,
                `<strong>$15,000 tuition</strong> wires Apr 1 and <strong>$30,000 federal estimated tax</strong> ACHs Apr 15 — both covered by current operating cash of $90,879.`,
                `<strong>$7,478</strong> in a maturing T-Bill rolled directly into JPMorgan MMF — keeps the Reserve layer funded without any action from the Kesslers.`,
                `Every transfer is pre-authorized. You'll receive a confirmation as each movement settles.`,
              ]
            )}
          </div>
        </div>{/* end 3-col grid */}
      </div>{/* end card grid padding container */}

      {/* ── FAB Compose Button ── */}
      <div style={{ position: "fixed", bottom: 28, right: 32, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        {checked.size === 0 && (
          <div style={{ background: "#1A1915", color: "#9A9890", fontSize: 10, fontWeight: 500, padding: "5px 12px", borderRadius: 20, letterSpacing: "0.04em" }}>
            Check cards above to include in email
          </div>
        )}
        <button
          onClick={() => setShowEmail(true)}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: checked.size > 0 ? "14px 28px" : "14px 24px",
            borderRadius: 50, border: "none", cursor: "pointer", fontFamily: FONT,
            background: checked.size > 0 ? "#1a2e4a" : "#3a3830",
            color: "#ffffff", fontSize: 14, fontWeight: 700, letterSpacing: "0.02em",
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          }}
        >
          <Mail style={{ width: 17, height: 17 }} />
          Compose email
          {checked.size > 0 && (
            <span style={{ background: "#e85d5d", color: "#fff", fontSize: 10, fontWeight: 800, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {checked.size}
            </span>
          )}
        </button>
      </div>

      {/* ── Email Modal ── */}
      <Dialog open={showEmail} onOpenChange={setShowEmail}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4" style={{ color: "#1a2e4a" }} />
              Client Email — Sarah &amp; Michael Kessler
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 min-h-0 flex-1 overflow-hidden">
            <div style={{ fontSize: 11, color: "#6b6860", border: "1px solid #e6e5e0", borderRadius: 8, padding: "10px 14px", background: "#fafaf8", flexShrink: 0, display: "flex", gap: 16 }}>
              <span><strong>To:</strong> Sarah &amp; Michael Kessler &lt;kessler.family@privatebank.com&gt;</span>
              <span style={{ marginLeft: "auto" }}><strong>Subject:</strong> A few items worth a conversation — your portfolio update</span>
            </div>
            <div style={{ borderRadius: 10, border: "1px solid #e6e5e0", background: "#fff", padding: "20px 22px", overflowY: "auto", flex: 1 }}>
              {buildEmailJSX()}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4, flexShrink: 0 }}>
              <button
                onClick={() => { navigator.clipboard.writeText(buildEmailText()); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 8, border: "1px solid #e6e5e0", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#3a3830", fontFamily: FONT }}
              >
                <Copy style={{ width: 13, height: 13 }} />
                {copied ? "Copied!" : "Copy to clipboard"}
              </button>
              <button
                onClick={() => setShowEmail(false)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 20px", borderRadius: 8, border: "none", background: "#1a2e4a", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}
              >
                <Check style={{ width: 13, height: 13 }} /> Done
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
  skipLanding = false,
}: {
  assets: Asset[];
  cashFlows: CashFlow[];
  onStartReview: () => void;
  skipLanding?: boolean;
}) {
  const [showLanding, setShowLanding] = useState(!skipLanding);
  const [showBucketBriefing, setShowBucketBriefing] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  // calcMode merged into workflowStarted — removed
  const [workflowStarted, setWorkflowStarted] = useState(false);
  const [showActionTable, setShowActionTable] = useState(false);
  const [isThinking, setIsThinking] = useState(true);
  const [moveThinking, setMoveThinking] = useState(false);
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
  useEffect(() => {
    const t = setTimeout(() => setIsThinking(false), 1800);
    return () => clearTimeout(t);
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

  // ── GURU targets — live via computeLiquidityTargets(), anchored to Dec 31 2025 ──
  // operatingTarget = rolling 2-month cash expenses (Jan+Feb 2026)
  // reserveTarget   = monthlyRate × 6
  const {
    operatingExcess: opExcess,
    reserveExcess:   resExcess,
    operatingTarget: opTarget,
    reserveTarget:   resTarget,
    excessLiquidity,
    coverageMonths: liquidityCoverageMonths,
  } = computeLiquidityTargets(assets, cashFlows);
  const bldExcess = 0; // Capital Build is fully deployed — no excess
  const bldTarget = tactical; // Capital Build target = full tactical bucket
  // Single source of truth — same computation as AdvisorBriefView
  const { annualPickup } = computeReturnOptimization(assets, cashFlows);
  const capitalBuild    = Math.round(excessLiquidity * 0.40);
  const investments     = Math.round(excessLiquidity * 0.60);

  const landingMeta: Record<string, { tagline: string; accounts: { name: string; ref: string; amount: number; excess?: boolean }[] }> = {
      op: {
        tagline: "Cash for upcoming expenditures and daily operations.",
        accounts: [
          { name: "Citizens Private Checking", ref: "·· 2847", amount: 82050 },
          { name: "SoFi High-Yield Checking",  ref: "·· 3391", amount: 50000 },
        ],
      },
      res: {
        tagline: "Actively managed reserve optimized for yield with full liquidity.",
        accounts: [
          { name: "Citizens Bank Money Market", ref: "·· 7204", amount: 225000, excess: true },
          { name: "Citizens High Yield Savings", ref: "·· 1482", amount: 100440, excess: true },
          { name: "JPMorgan 100% Tsy MMF",      ref: "·· 4976", amount: 101146 },
        ],
      },
      bld: {
        tagline: "Disciplined saving for near-term goals via short-duration ladder.",
        accounts: [
          { name: "Fidelity Cash Sweep",  ref: "·· 8821 · idle",           amount: 174000, excess: true },
          { name: "3-Mo T-Bill Ladder",   ref: "·· 1142 · matures Mar 31", amount: 135000 },
        ],
      },
      grow: {
        tagline: "Long-term compounded growth through CIO-managed strategies.",
        accounts: [
          { name: "CIO Sector Rotation Fund", ref: "Fidelity · Growth equity", amount: 1250000 },
          { name: "Small Cap Sleeve",          ref: "Fidelity · High growth",   amount: 875000 },
          { name: "Cresset Short Duration",    ref: "Fixed income anchor",       amount: 384500 },
        ],
      },
      oth: {
        tagline: "Real estate and alternatives outside active management.",
        accounts: [
          { name: "Primary Residence",   ref: "Westchester, NY",      amount: 1800000 },
          { name: "Investment Property", ref: "Palm Beach, FL",        amount: 750000 },
          { name: "Unvested RSUs",       ref: "Vesting 2025–2027",     amount: 395100 },
        ],
      },
  };

  // ── LANDING PAGE ──────────────────────────────────────────────────────────
  if (showLanding) {
    // ── Bar chart computed values ────────────────────────────────────────────
    const maxLiquid = Math.max(reserve, yieldBucket, tactical);

    // All bars on a single scale so widths convey true relative balance
    const resWidth       = maxBal > 0 ? (yieldBucket / maxBal) * 100 : 0;
    const bldWidth       = maxBal > 0 ? (tactical    / maxBal) * 100 : 0;
    const opWidth        = maxBal > 0 ? (reserve     / maxBal) * 100 : 0;
    const growWidth      = maxBal > 0 ? (growth      / maxBal) * 100 : 0;
    const altsWidth      = maxBal > 0 ? (alts        / maxBal) * 100 : 0;
    // "After GURU" target widths (same scale)
    const resTargetWidth = maxBal > 0 ? (resTarget   / maxBal) * 100 : 0;
    const bldTargetWidth = maxBal > 0 ? (bldTarget   / maxBal) * 100 : 0;

    // Liquid-relative bar widths for the landing table (scaled to largest liquid bucket so bars fill properly)
    const maxLiqBal  = Math.max(reserve, yieldBucket, tactical, 1);
    const opBarLiq   = (reserve     / maxLiqBal) * 100;
    const resBarLiq  = (yieldBucket / maxLiqBal) * 100;
    const bldBarLiq  = (tactical    / maxLiqBal) * 100;
    const resTargLiq = (resTarget   / maxLiqBal) * 100;
    const bldTargLiq = (bldTarget   / maxLiqBal) * 100;

    // ── Shared sub-component for a bar row ───────────────────────────────────
    const BarRow = ({
      name, nameColor, desc, width, fillColor,
      amount, yieldLabel, isLongTerm = false,
    }: {
      name: string; nameColor: string; desc: string; width: number;
      fillColor: string; amount: number; yieldLabel?: string; isLongTerm?: boolean;
    }) => (
      <div style={{ display:"grid", gridTemplateColumns:"1fr 128px", alignItems:"start", gap:16, padding:"16px 0", borderBottom:"1px solid rgba(0,0,0,0.06)" }}>
        {/* Left: name + desc + bar */}
        <div>
          <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.10em", textTransform:"uppercase" as const, color: nameColor, lineHeight:1.25, marginBottom:4 }}>{name}</div>
          <div style={{ fontSize:10, fontStyle:"italic", color:"rgba(0,0,0,0.38)", lineHeight:1.50, marginBottom:9 }}>{desc}</div>
          <div style={{ height:4, background:"#ede7dc", borderRadius:3, overflow:"hidden", maxWidth:"65%" }}>
            <div style={{ height:"100%", borderRadius:3, width:`${width / 2}%`, background: fillColor }} />
          </div>
        </div>
        {/* Right: amount + yield */}
        <div style={{ textAlign:"right", paddingTop:2 }}>
          <div style={{ fontSize: isLongTerm ? 18 : 21, fontWeight:300, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.025em", color:"#1a1a1a", lineHeight:1.1 }}>{fmt(amount)}</div>
          <div style={{ fontSize:10, color:"rgba(0,0,0,0.32)", marginTop:4, fontStyle: isLongTerm ? "italic" : "normal" }}>{yieldLabel}</div>
        </div>
      </div>
    );

    // ── Shared inline bucket row for before/after cards ─────────────────────
    const BucketRow = ({
      name, nameColor, barWidth, barColor, amount, yieldLabel, pill, delta,
    }: {
      name: string; nameColor: string; barWidth: number; barColor: string;
      amount: number; yieldLabel: string; pill?: "flag" | "ok"; delta?: string;
    }) => (
      <div style={{ display:"grid", gridTemplateColumns:"1fr 88px", alignItems:"center", padding:"18px 14px", borderBottom:"1px solid rgba(0,0,0,0.05)", gap:8 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:3, height:14, borderRadius:2, background:barColor, flexShrink:0, opacity:0.9 }} />
            <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.01em", color:nameColor, lineHeight:1 }}>{name}</span>
            {pill === "flag" && <span style={{ fontSize:7, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase" as const, background:"rgba(184,92,0,0.09)", color:"rgba(184,92,0,0.80)", border:"1px solid rgba(184,92,0,0.22)", borderRadius:3, padding:"1px 5px" }}>excess</span>}
            {pill === "ok"   && <span style={{ fontSize:7, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase" as const, background:"rgba(94,204,138,0.10)", color:"rgba(30,100,60,0.70)", border:"1px solid rgba(94,204,138,0.24)", borderRadius:3, padding:"1px 5px" }}>target</span>}
          </div>
          <div style={{ height:5, background:"#e0d9cf", borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:3, width:`${barWidth}%`, background:barColor }} />
          </div>
        </div>
        <div style={{ textAlign:"right" as const }}>
          <div style={{ fontSize:17, fontWeight:300, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.025em", color:"#1a1a1a", lineHeight:1 }}>{fmt(amount)}</div>
          <div style={{ fontSize:9, color:"rgba(0,0,0,0.34)", marginTop:3 }}>{yieldLabel}</div>
          {delta && <div style={{ fontSize:9, fontWeight:500, color:"rgba(50,150,90,0.90)", marginTop:2 }}>{delta}</div>}
        </div>
      </div>
    );

    // ── Bucket defs (shared between landing split-pane and standalone bucket briefing) ──
    const LANDING_BUCKET_DEFS = [
      { key:"op",   name:"Operating Cash",  color:"#1d4ed8", border:"rgba(29,78,216,0.18)",   bal:reserve,      target:`${(reserve/monthlyExpenses).toFixed(1)} mo covered`,  philosophy:"Covers 2–3 months of core expenses. Instantly accessible. No rate optimization — pure safety net." },
      { key:"res",  name:"Reserve Cash",    color:"#8a6920", border:"rgba(138,105,32,0.18)",  bal:yieldBucket,  target:"12-month reserve target",                              philosophy:"Targets 12 months of anticipated outflows. Deployed in high-yield products that can be liquidated same-day." },
      { key:"bld",  name:"Capital Build",   color:"#1e4d30", border:"rgba(30,77,48,0.18)",    bal:tactical,     target:"Goal-directed · 1–3 yr horizon",                       philosophy:"Holds capital earmarked for goals 1–3 years out. Deployed in short-duration ladders to protect principal while earning yield." },
      { key:"grow", name:"Investments",     color:"#3d1a6e", border:"rgba(61,26,110,0.18)",   bal:growth,       target:"5+ year horizon",                                      philosophy:"Capital with a 5+ year horizon managed through CIO-led strategies. Not touched for liquidity needs." },
      { key:"oth",  name:"Other Assets",    color:"#4a4a4a", border:"rgba(74,74,74,0.18)",    bal:alts,         target:"Tracked · not actively managed",                       philosophy:"Illiquid or hard-to-rebalance holdings. Tracked for net worth context but excluded from liquidity planning." },
    ];

    return (
      <div style={{ flex:1, display:"flex", flexDirection:"row", minHeight:0, fontFamily:"'Inter', system-ui, sans-serif" }}>
        <style>{`
          @keyframes glrPulse   { 0%,100%{opacity:1} 50%{opacity:0.28} }
          @keyframes glrFadeIn  { from { opacity:0; } to { opacity:1; } }
          @keyframes glrSlideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
          @keyframes glrDot     { 0%,80%,100%{transform:scale(0.5);opacity:0.25} 40%{transform:scale(1);opacity:0.80} }
          @keyframes glrSlideIn { from { opacity:0; transform:translateX(18px); } to { opacity:1; transform:translateX(0); } }
          @keyframes bbFadeIn   { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
          .glr-stat-card { transition: border-color 0.15s, box-shadow 0.15s; }
          .glr-stat-card:hover { border-color: rgba(94,204,138,0.25) !important; box-shadow: 0 2px 20px rgba(0,0,0,0.25) !important; }
          .glr-recs-btn { transition: background 0.15s, border-color 0.15s; }
          .glr-recs-btn:hover { background: rgba(94,204,138,0.13) !important; border-color: rgba(94,204,138,0.55) !important; }
          .glr-review-btn { transition: background 0.15s, transform 0.12s; }
          .glr-review-btn:hover { background: rgba(255,255,255,0.96) !important; transform: translateY(-1px); }
          .glr-review-btn:active { transform: translateY(0px); }
          .bb-card-mini { animation: bbFadeIn 0.3s ease both; transition: box-shadow 0.15s; }
          .bb-card-mini:hover { box-shadow: 0 3px 12px rgba(0,0,0,0.07) !important; }
          .bb-continue:hover { background: hsl(222,45%,16%) !important; }
        `}</style>

        {/* ══════════════════════ LEFT: Dark Navy Pane ══════════════════════ */}
        <div style={{
          flex: workflowStarted ? "0 0 500px" : 1,
          display:"flex", flexDirection:"column",
          background:"linear-gradient(160deg,#0d2044 0%,#081630 60%,#04101f 100%)",
          position:"relative",
          transition:"flex 0.45s cubic-bezier(0.22,1,0.36,1)",
          minHeight:0,
        }}>
          {/* Dot grid */}
          <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(rgba(255,255,255,0.018) 1px,transparent 1px)", backgroundSize:"22px 22px", pointerEvents:"none", zIndex:0 }} />

          {/* Scrollable content area */}
          <div style={{ flex:1, overflowY:"auto", position:"relative", zIndex:1 }}>
          <div style={{ padding: workflowStarted ? "28px 28px 36px" : "48px 48px 60px", margin: workflowStarted ? 0 : "0 auto", width:"100%", maxWidth: workflowStarted ? "none" : 900, display:"flex", flexDirection:"column" }}>

            {/* Eyebrow removed */}

            {/* ── Thinking state ── */}
            {isThinking && !workflowStarted ? (
              <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"flex-start", justifyContent:"center", gap:20, minHeight:300, animation:"glrFadeIn 0.4s ease" }}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width:10, height:10, borderRadius:"50%", background:"rgba(94,204,138,0.70)", animation:`glrDot 1.3s ${i*0.22}s ease-in-out infinite` }} />
                  ))}
                  <span style={{ fontSize:13, fontWeight:600, letterSpacing:"0.10em", textTransform:"uppercase" as const, color:"rgba(255,255,255,0.28)", marginLeft:6 }}>GURU Analyzing Portfolio…</span>
                </div>
              </div>
            ) : (
              <>
                {/* ── Headline ── */}
                <div style={{ animation:"glrFadeIn 0.6s ease", marginBottom: workflowStarted ? 12 : 0, marginTop: workflowStarted ? 0 : 8 }}>
                  {workflowStarted ? (
                    <>
                      <div style={{ fontFamily:'"Playfair Display", Georgia, serif', fontSize:34, fontWeight:400, color:"rgba(255,255,255,0.93)", lineHeight:1.18, letterSpacing:"-0.02em", marginBottom:10 }}>
                        Idle capital,<br/><span style={{ color:"rgba(94,204,138,0.90)" }}>ready to work.</span>
                      </div>
                      <div style={{ fontSize:12, lineHeight:1.65, color:"rgba(255,255,255,0.44)", marginBottom:14 }}>
                        A year-end bonus pushed coverage to {liquidityCoverageMonths.toFixed(0)} months.{" "}
                        <span style={{ color:"rgba(94,204,138,0.85)", fontWeight:500 }}>{fmt(excessLiquidity)} is deployable</span>{" "}
                        with no liquidity risk.
                      </div>
                    </>
                  ) : showActionTable ? (
                    /* Compressed header once table is revealed */
                    <div style={{ fontFamily:'"Playfair Display", Georgia, serif', fontSize:36, fontWeight:400, color:"rgba(255,255,255,0.93)", lineHeight:1.08, letterSpacing:"-0.02em", marginBottom:20 }}>
                      Idle capital,{" "}<span style={{ color:"rgba(94,204,138,0.90)" }}>ready to work.</span>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontFamily:'"Playfair Display", Georgia, serif', fontSize:68, fontWeight:400, color:"rgba(255,255,255,0.93)", lineHeight:1.05, letterSpacing:"-0.03em", marginBottom:22 }}>
                        Idle capital,<br/><span style={{ color:"rgba(94,204,138,0.90)" }}>ready to work.</span>
                      </div>
                      <div style={{ fontSize:15, lineHeight:1.75, color:"rgba(255,255,255,0.42)", maxWidth:620, marginBottom:52 }}>
                        A year-end bonus pushed coverage to {liquidityCoverageMonths.toFixed(0)} months — {Math.max(0, Math.round(liquidityCoverageMonths - 12))} months above target.{" "}
                        <span style={{ color:"rgba(94,204,138,0.85)", fontWeight:500 }}>{fmt(excessLiquidity)} is fully deployable</span>{" "}
                        with no liquidity risk. Every day it sits idle costs the Kesslers ${Math.round(annualPickup / 365)}.
                      </div>
                    </>
                  )}
                </div>

                {/* ── Stat cards ── */}
                {workflowStarted ? (
                  /* 2×2 compact grid matching mockup sidebar */
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", marginBottom:14, border:"1px solid rgba(255,255,255,0.08)", animation:"glrFadeIn 0.7s ease" }}>
                    {[
                      { lbl:"Excess Liquidity", num:fmt(excessLiquidity), sub:"idle · 0.30%", green:true,  br:true,  bb:true  },
                      { lbl:"Annual Pickup",    num:`+${fmt(annualPickup)}`, sub:"after-tax / yr", green:true,  br:false, bb:true  },
                      { lbl:"Days Idle",        num:"47 days",            sub:"since bonus",   green:false, br:true,  bb:false },
                      { lbl:"Cash Runway",      num:`${liquidityCoverageMonths.toFixed(1)} mo`, sub:"vs. 12-mo target", green:false, br:false, bb:false },
                    ].map(cell => (
                      <div key={cell.lbl} style={{ padding:"8px 9px", borderRight: cell.br ? "1px solid rgba(255,255,255,0.10)" : "none", borderBottom: cell.bb ? "1px solid rgba(255,255,255,0.10)" : "none" }}>
                        <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.10em", textTransform:"uppercase" as const, color:"rgba(255,255,255,0.30)", marginBottom:4, lineHeight:1.4 }}>{cell.lbl}</div>
                        <div style={{ fontSize:19, fontWeight:300, fontVariantNumeric:"tabular-nums" as const, letterSpacing:"-0.02em", lineHeight:1, color: cell.green ? "#5ecc8a" : "rgba(255,255,255,0.82)", marginBottom:3 }}>{cell.num}</div>
                        <div style={{ fontSize:9, color:"rgba(255,255,255,0.26)" }}>{cell.sub}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* 4-column horizontal grid for full-screen landing */
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom: showActionTable ? 20 : 48, animation:"glrFadeIn 0.7s ease" }}>
                    {[
                      { lbl:"Potential Excess Liquidity",        num:fmt(excessLiquidity),    unit:"",     sub:"idle · 0.30% today",    green:true  },
                      { lbl:"Potential After-Tax Annual Return", num:`+${fmt(annualPickup)}`, unit:"/yr",  sub:"estimated · after-tax",  green:true  },
                      { lbl:"Days Sitting Idle",                 num:"47",                    unit:"days", sub:"since bonus landed",     green:false },
                      { lbl:"Cash Runway",                       num:liquidityCoverageMonths.toFixed(1), unit:"mo", sub:"vs. 12-month target", green:false },
                    ].map(cell => (
                      <div key={cell.lbl} className="glr-stat-card" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding: showActionTable ? "14px 16px" : "22px 20px" }}>
                        <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase" as const, color:"rgba(255,255,255,0.28)", marginBottom: showActionTable ? 8 : 12, lineHeight:1.4 }}>{cell.lbl}</div>
                        <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom: showActionTable ? 4 : 8 }}>
                          <span style={{ fontSize: showActionTable ? 22 : 30, fontWeight:300, fontVariantNumeric:"tabular-nums" as const, letterSpacing:"-0.03em", lineHeight:1, color: cell.green ? "#5ecc8a" : "rgba(255,255,255,0.88)" }}>{cell.num}</span>
                          {cell.unit && <span style={{ fontSize: showActionTable ? 11 : 13, fontWeight:400, color: cell.green ? "rgba(94,204,138,0.55)" : "rgba(255,255,255,0.35)" }}>{cell.unit}</span>}
                        </div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,0.24)" }}>{cell.sub}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Compact Bloomberg table (workflow only) ── */}
                {workflowStarted && (
                  <div style={{ animation: workflowStarted ? "none" : "glrSlideUp 0.40s cubic-bezier(0.22,1,0.36,1)" }}>
                    {/* Compact label in workflow sidebar */}
                    {workflowStarted && (
                      <div style={{ fontSize:8, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" as const, color:"rgba(94,204,138,0.55)", marginBottom:8 }}>Recommended Transfers</div>
                    )}

                    {/* ── Bloomberg-terminal action table ── */}
                    <div style={{ border:"1.5px solid rgba(94,204,138,0.45)", background:"rgba(4,16,31,0.60)", overflow:"hidden", fontVariantNumeric:"tabular-nums" as const }}>

                      {/* Column header row */}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 110px 110px 100px", padding:"5px 14px", background:"rgba(94,204,138,0.08)", borderBottom:"1px solid rgba(94,204,138,0.18)" }}>
                        {["ACCOUNT","CURRENT","TARGET","DELTA"].map((h,i) => (
                          <div key={h} style={{ fontSize:8, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" as const, color:"rgba(94,204,138,0.55)", textAlign: i > 0 ? "right" as const : "left" as const }}>{h}</div>
                        ))}
                      </div>

                      {/* OUT section label */}
                      <div style={{ padding:"4px 14px 3px", background:"rgba(192,57,43,0.08)", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ fontSize:8, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" as const, color:"rgba(220,100,80,0.70)" }}>↓ Transfers Out</span>
                      </div>

                      {/* Out rows */}
                      {[
                        { name:"Reserve Cash",   current:fmt(yieldBucket), target:fmt(resTarget), delta:`−${fmt(resExcess)}`, sub:"12-mo floor · overnight liquidity" },
                        { name:"Operating Cash", current:fmt(reserve),     target:fmt(opTarget),  delta:`−${fmt(opExcess)}`,  sub:"2-mo floor · daily operating" },
                      ].map((row, i) => (
                        <div key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 110px 110px 100px", padding:"7px 14px 4px", alignItems:"baseline" }}>
                            <div style={{ fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.80)", letterSpacing:"0.01em" }}>{row.name}</div>
                            <div style={{ fontSize:12, fontWeight:400, color:"rgba(255,255,255,0.45)", textAlign:"right" as const }}>{row.current}</div>
                            <div style={{ fontSize:12, fontWeight:400, color:"rgba(255,255,255,0.65)", textAlign:"right" as const }}>{row.target}</div>
                            <div style={{ fontSize:12, fontWeight:700, color:"#e07070", textAlign:"right" as const }}>{row.delta}</div>
                          </div>
                          <div style={{ padding:"0 14px 6px" }}>
                            <span style={{ fontSize:9, color:"rgba(255,255,255,0.22)", letterSpacing:"0.02em" }}>{row.sub}</span>
                          </div>
                        </div>
                      ))}

                      {/* IN section label */}
                      <div style={{ padding:"4px 14px 3px", background:"rgba(46,122,82,0.08)", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ fontSize:8, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" as const, color:"rgba(94,204,138,0.70)" }}>↑ Transfers In</span>
                      </div>

                      {/* In row */}
                      <div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 110px 110px 100px", padding:"7px 14px 4px", alignItems:"baseline" }}>
                          <div style={{ fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.80)" }}>Cresset Short Duration</div>
                          <div style={{ fontSize:12, color:"rgba(255,255,255,0.25)", textAlign:"right" as const }}>—</div>
                          <div style={{ fontSize:12, fontWeight:400, color:"rgba(255,255,255,0.65)", textAlign:"right" as const }}>{fmt(excessLiquidity)}</div>
                          <div style={{ fontSize:12, fontWeight:700, color:"#5ecc8a", textAlign:"right" as const }}>+{fmt(excessLiquidity)}</div>
                        </div>
                        <div style={{ padding:"0 14px 6px" }}>
                          <span style={{ fontSize:9, color:"rgba(255,255,255,0.22)", letterSpacing:"0.02em" }}>5.40% after-tax yield · daily liquidity · FDIC-equivalent</span>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* ── Stage 0 CTA ── */}
                {!workflowStarted && (
                  <div style={{ animation:"glrFadeIn 0.8s ease" }}>
                    <button
                      className="glr-recs-btn"
                      onClick={() => setWorkflowStarted(true)}
                      style={{ display:"inline-flex", alignItems:"center", gap:10, padding:"14px 28px", border:"1px solid rgba(94,204,138,0.40)", background:"rgba(94,204,138,0.08)", cursor:"pointer", fontFamily:"inherit" }}
                    >
                      <span style={{ width:7, height:7, borderRadius:"50%", background:"#5ecc8a", boxShadow:"0 0 6px rgba(94,204,138,0.8)", display:"inline-block", flexShrink:0, animation:"glrPulse 2.5s infinite" }} />
                      <span style={{ fontSize:12, fontWeight:700, letterSpacing:"0.10em", textTransform:"uppercase" as const, color:"rgba(94,204,138,0.92)" }}>View GURU's Recommendations</span>
                      <span style={{ fontSize:16, color:"rgba(94,204,138,0.55)", lineHeight:1 }}>›</span>
                    </button>
                    <div style={{ marginTop:14, fontSize:12, color:"rgba(255,255,255,0.22)" }}>GURU has flagged 2 optimization opportunities · no action required yet</div>
                  </div>
                )}
              </>
            )}
          </div>{/* end padding wrapper */}
          </div>{/* end scrollable content area */}

          {/* Sticky bottom CTA removed — CTA goes directly to workflow */}
        </div>

        {/* ══════════════════════ RIGHT: Process Overview ══════════════════════ */}
        {workflowStarted && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", background:"#f0ece5", borderLeft:"1px solid rgba(0,0,0,0.07)", animation:"glrSlideIn 0.45s cubic-bezier(0.22,1,0.36,1)", overflow:"hidden" }}>

            {/* Body: flex column — headline is fixed, steps section scrolls */}
            <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>

              {/* Hero headline area */}
              <div style={{ padding:"28px 44px 20px", borderBottom:"1px solid rgba(0,0,0,0.09)", flexShrink:0 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.16em", textTransform:"uppercase" as const, color:"rgba(154,123,60,0.72)", marginBottom:10 }}>
                  GURU has already done the analysis — here's the plan
                </div>
                <div style={{ fontFamily:'"Playfair Display", Georgia, serif', fontSize:34, fontWeight:400, color:"hsl(222,45%,12%)", lineHeight:1.14, letterSpacing:"-0.02em", marginBottom:8 }}>
                  Walk through it.<br/>Confirm what you agree with.
                </div>
                <div style={{ fontSize:13, color:"rgba(0,0,0,0.44)", lineHeight:1.6 }}>
                  Three pre-built steps. GURU prepared the work — you review and approve each one.
                </div>
              </div>

              {/* Steps — scrollable */}
              <div style={{ flex:1, overflowY:"auto", padding:"20px 44px 0" }}>
                <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.16em", textTransform:"uppercase" as const, color:"rgba(0,0,0,0.30)", marginBottom:14 }}>
                  Your review · 3 steps · ~6 minutes
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {[
                      {
                        n:1, title:"Asset Allocation Rebalancing",
                        badge:"GURU Pre-Filled",
                        badgeBg:"rgba(27,61,110,0.08)", badgeBorder:"rgba(27,61,110,0.20)", badgeText:"rgba(27,61,110,0.75)",
                        leftBorder:"hsl(222,45%,12%)",
                        desc:"Review how GURU has split your liquid assets across buckets and confirm the coverage targets before anything moves.",
                        time:"~3 minutes to review and adjust",
                      },
                      {
                        n:2, title:"Product Selection",
                        badge:"Ranked for You",
                        badgeBg:"rgba(154,123,60,0.10)", badgeBorder:"rgba(154,123,60,0.25)", badgeText:"rgba(154,123,60,0.85)",
                        leftBorder:"#9a7b3c",
                        desc:"Choose from GURU's ranked shortlist of products — filtered for your tax profile, liquidity needs, and risk tolerance.",
                        time:"~2 minutes to review and choose",
                      },
                      {
                        n:3, title:"Confirm & Execute",
                        badge:"Auto-Execute Available",
                        badgeBg:"rgba(46,122,82,0.10)", badgeBorder:"rgba(46,122,82,0.25)", badgeText:"rgba(46,122,82,0.85)",
                        leftBorder:"#2e7a52",
                        desc:"See the complete before/after in one view, then approve. Optionally enable auto-execute for future events.",
                        time:"~1 minute to approve and submit",
                      },
                    ].map((step, idx) => (
                      <div key={step.n} style={{ display:"flex", gap:0, alignItems:"stretch", animation:`bbFadeIn 0.35s ${idx*0.08}s ease both` }}>
                        {/* Number circle + connector line */}
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:52, flexShrink:0 }}>
                          <div style={{ width:38, height:38, borderRadius:"50%", border:"2px solid hsl(222,45%,12%)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:"hsl(222,45%,12%)", background:"#f0ece5", flexShrink:0, position:"relative", zIndex:1 }}>{step.n}</div>
                          {idx < 2 && <div style={{ width:2, flex:1, minHeight:14, background:"rgba(27,61,110,0.15)", margin:"2px auto" }} />}
                        </div>
                        {/* Card with colored left accent */}
                        <div style={{ flex:1, background:"#fff", borderRadius:10, border:"1px solid rgba(0,0,0,0.07)", boxShadow:"0 1px 4px rgba(0,0,0,0.05)", padding:"16px 20px", position:"relative", overflow:"hidden", marginBottom: idx < 2 ? 0 : 0 }}>
                          {/* Left color accent */}
                          <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, borderRadius:"2px 0 0 2px", background:step.leftBorder }} />
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:6 }}>
                            <div style={{ fontSize:14, fontWeight:700, color:"hsl(222,45%,12%)" }}>{step.title}</div>
                            <div style={{ fontSize:8, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase" as const, padding:"3px 8px", borderRadius:20, background:step.badgeBg, border:`1px solid ${step.badgeBorder}`, color:step.badgeText, whiteSpace:"nowrap" as const, flexShrink:0 }}>{step.badge}</div>
                          </div>
                          <div style={{ fontSize:12, color:"rgba(0,0,0,0.50)", lineHeight:1.55, marginBottom:10 }}>{step.desc}</div>
                          <div style={{ height:1, background:"rgba(0,0,0,0.06)", marginBottom:9 }} />
                          <div style={{ fontSize:10, fontWeight:500, color:"rgba(0,0,0,0.28)" }}>{step.time}</div>
                        </div>
                      </div>
                    ))}
                </div>
                <div style={{ height:16 }} />
              </div>
            </div>

            <div style={{ borderTop:"1px solid rgba(0,0,0,0.08)", background:"rgba(240,236,229,0.97)", padding:"16px 44px", flexShrink:0, display:"flex", alignItems:"center", gap:18 }}>
              <button
                onClick={() => { setShowLanding(false); setShowBucketBriefing(true); }}
                style={{ background:"hsl(222,45%,12%)", color:"rgba(255,255,255,0.92)", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700, letterSpacing:"0.10em", textTransform:"uppercase" as const, padding:"15px 36px", transition:"background 0.15s, transform 0.12s", flexShrink:0, boxShadow:"0 2px 12px rgba(0,0,0,0.20)", borderRadius:7 }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background="hsl(222,45%,16%)"; (e.target as HTMLElement).style.transform="translateY(-1px)"; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background="hsl(222,45%,12%)"; (e.target as HTMLElement).style.transform="translateY(0)"; }}
              >
                Begin Step 1 →
              </button>
              <div style={{ fontSize:12, color:"rgba(0,0,0,0.38)", lineHeight:1.6 }}>
                <strong style={{ fontWeight:600, color:"rgba(0,0,0,0.55)" }}>Nothing moves until Step 3.</strong><br/>
                Every step is reversible. You stay in control.
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  // ── END LANDING PAGE ───────────────────────────────────────────────────────

  // ── BUCKET BRIEFING PAGE ───────────────────────────────────────────────────
  if (showBucketBriefing) {
    const BUCKET_DEFS = [
      {
        key: "op",
        name: "Operating Cash",
        tagline: "Daily liquidity & upcoming expenditures",
        philosophy: "Covers 2–3 months of core expenses. Instantly accessible. No rate optimization — pure safety net.",
        color: "#1d4ed8",
        lightBg: "rgba(29,78,216,0.06)",
        border: "rgba(29,78,216,0.18)",
        accounts: landingMeta.op.accounts,
        bal: reserve,
        target: `${(reserve / monthlyExpenses).toFixed(1)} mo covered`,
      },
      {
        key: "res",
        name: "Reserve Cash",
        tagline: "Active cash management with full liquidity",
        philosophy: "Targets 12 months of anticipated outflows. Deployed in high-yield products — money market, T-bills — that can be liquidated same-day.",
        color: "#8a6920",
        lightBg: "rgba(138,105,32,0.06)",
        border: "rgba(138,105,32,0.18)",
        accounts: landingMeta.res.accounts,
        bal: yieldBucket,
        target: "12-month reserve target",
      },
      {
        key: "bld",
        name: "Capital Build",
        tagline: "Disciplined saving for near-term goals",
        philosophy: "Holds capital earmarked for goals 1–3 years out: property, business, major expenditure. Deployed in short-duration ladders to protect principal while earning yield.",
        color: "#1e4d30",
        lightBg: "rgba(30,77,48,0.06)",
        border: "rgba(30,77,48,0.18)",
        accounts: landingMeta.bld.accounts,
        bal: tactical,
        target: "Goal-directed · 1–3 yr horizon",
      },
      {
        key: "grow",
        name: "Investments",
        tagline: "Long-term compounded growth",
        philosophy: "Capital with a 5+ year horizon managed through CIO-led strategies. Not touched for liquidity needs — this bucket compounds.",
        color: "#3d1a6e",
        lightBg: "rgba(61,26,110,0.06)",
        border: "rgba(61,26,110,0.18)",
        accounts: landingMeta.grow.accounts,
        bal: growth,
        target: "5+ year horizon",
      },
      {
        key: "oth",
        name: "Other Assets",
        tagline: "Real estate, private equity & alternatives",
        philosophy: "Illiquid or hard-to-rebalance holdings. Tracked for net worth context but excluded from liquidity planning.",
        color: "#4a4a4a",
        lightBg: "rgba(74,74,74,0.06)",
        border: "rgba(74,74,74,0.18)",
        accounts: landingMeta.oth.accounts,
        bal: alts,
        target: "Tracked · not actively managed",
      },
    ];

    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0, background:"#f0ece5", fontFamily:"'Inter', system-ui, sans-serif", overflow:"hidden" }}>
        <style>{`
          @keyframes bbFadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
          .bb-card { animation: bbFadeIn 0.3s ease both; }
          .bb-card:hover { box-shadow: 0 4px 18px rgba(0,0,0,0.08) !important; }
          .bb-continue:hover { background: hsl(222,45%,16%) !important; }
        `}</style>

        {/* Header bar */}
        <div style={{ background:"rgba(240,236,229,0.97)", borderBottom:"1px solid rgba(0,0,0,0.08)", padding:"0 48px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, backdropFilter:"blur(4px)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={() => { setShowBucketBriefing(false); setShowLanding(true); }} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:5, color:"rgba(0,0,0,0.40)", fontSize:11, fontWeight:600, letterSpacing:"0.06em", padding:0, fontFamily:"inherit" }}>
              <span style={{ fontSize:15, lineHeight:1 }}>‹</span> Back
            </button>
            <span style={{ width:1, height:14, background:"rgba(0,0,0,0.15)", display:"inline-block", margin:"0 8px" }} />
            <span style={{ fontSize:13, fontWeight:500, color:"#1a1a1a" }}>Kessler Family</span>
            <span style={{ color:"rgba(0,0,0,0.20)", fontSize:13 }}>·</span>
            <span style={{ fontSize:13, color:"rgba(0,0,0,0.50)" }}>Asset Allocation</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:"#5ecc8a", display:"inline-block" }} />
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.10em", textTransform:"uppercase" as const, color:"rgba(0,0,0,0.35)" }}>Step 1 of 3</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:"36px 48px 48px" }}>

          {/* Page headline */}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.16em", textTransform:"uppercase" as const, color:"rgba(154,123,60,0.75)", marginBottom:10 }}>Before we begin</div>
            <div style={{ fontFamily:'"Playfair Display", Georgia, serif', fontSize:30, fontWeight:400, color:"hsl(222,45%,12%)", lineHeight:1.20, letterSpacing:"-0.02em", marginBottom:8 }}>
              How GURU organizes your money
            </div>
            <div style={{ fontSize:13, color:"rgba(0,0,0,0.45)", lineHeight:1.65, maxWidth:560 }}>
              Every dollar belongs to a bucket. Each bucket has a job — a yield target, a liquidity profile, and a horizon. Review what's in each one before we make any changes.
            </div>
          </div>

          {/* Bucket cards grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))", gap:14 }}>
            {BUCKET_DEFS.map((b, idx) => (
              <div
                key={b.key}
                className="bb-card"
                style={{ background:"#fff", borderRadius:10, border:`1px solid ${b.border}`, boxShadow:"0 1px 4px rgba(0,0,0,0.05)", overflow:"hidden", animationDelay:`${idx * 0.05}s`, transition:"box-shadow 0.15s" }}
              >
                {/* Card top bar */}
                <div style={{ height:3, background:b.color, opacity:0.85 }} />

                <div style={{ padding:"18px 20px 16px" }}>
                  {/* Bucket name + balance */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.10em", textTransform:"uppercase" as const, color:b.color, marginBottom:4, opacity:0.85 }}>{b.name}</div>
                      <div style={{ fontSize:13, color:"rgba(0,0,0,0.55)", lineHeight:1.45 }}>{b.tagline}</div>
                    </div>
                    <div style={{ textAlign:"right" as const, flexShrink:0, marginLeft:12 }}>
                      <div style={{ fontSize:22, fontWeight:300, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.025em", color:"#1a1a1a", lineHeight:1 }}>{fmt(b.bal)}</div>
                      <div style={{ fontSize:9, color:"rgba(0,0,0,0.32)", marginTop:3 }}>{b.target}</div>
                    </div>
                  </div>

                  {/* Philosophy */}
                  <div style={{ background:b.lightBg, borderRadius:6, padding:"10px 12px", marginBottom:14 }}>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.10em", textTransform:"uppercase" as const, color:b.color, marginBottom:4, opacity:0.75 }}>GURU's approach</div>
                    <div style={{ fontSize:11, color:"rgba(0,0,0,0.55)", lineHeight:1.60 }}>{b.philosophy}</div>
                  </div>

                  {/* Accounts in bucket */}
                  <div>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.10em", textTransform:"uppercase" as const, color:"rgba(0,0,0,0.30)", marginBottom:8 }}>Accounts in this bucket</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {b.accounts.map((acct, ai) => (
                        <div key={ai} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 10px", background:"rgba(0,0,0,0.025)", borderRadius:5 }}>
                          <div>
                            <div style={{ fontSize:12, fontWeight:500, color:"#1a1a1a", lineHeight:1.2 }}>{acct.name}</div>
                            <div style={{ fontSize:10, color:"rgba(0,0,0,0.38)", marginTop:2 }}>{acct.ref}</div>
                          </div>
                          <div style={{ textAlign:"right" as const, flexShrink:0, marginLeft:8 }}>
                            <div style={{ fontSize:13, fontWeight:400, fontVariantNumeric:"tabular-nums", color:"rgba(0,0,0,0.65)" }}>{fmt(acct.amount)}</div>
                            {"excess" in acct && acct.excess && (
                              <div style={{ fontSize:8, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase" as const, color:"rgba(184,92,0,0.75)", marginTop:2 }}>excess</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA footer */}
        <div style={{ borderTop:"1px solid rgba(0,0,0,0.08)", padding:"20px 48px", background:"rgba(240,236,229,0.60)", display:"flex", alignItems:"center", gap:20, flexShrink:0 }}>
          <button
            className="bb-continue"
            onClick={() => { setShowBucketBriefing(false); setWorkflowStarted(true); }}
            style={{ background:"hsl(222,45%,12%)", border:"none", cursor:"pointer", borderRadius:7, padding:"14px 32px", fontSize:11, fontWeight:700, letterSpacing:"0.10em", textTransform:"uppercase" as const, color:"rgba(255,255,255,0.92)", transition:"background 0.15s", fontFamily:"inherit", flexShrink:0 }}
          >
            Continue to Step 1 →
          </button>
          <div style={{ fontSize:12, color:"rgba(0,0,0,0.38)", lineHeight:1.6 }}>
            <strong style={{ fontWeight:600, color:"rgba(0,0,0,0.55)" }}>Nothing moves yet.</strong>{" "}
            You're reviewing how your money is currently organized. Changes happen in Step 3.
          </div>
        </div>
      </div>
    );
  }
  // ── END BUCKET BRIEFING PAGE ───────────────────────────────────────────────

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

      {/* Main layout — full-width before Step 1, 2-col after */}
      <div style={{ display:"grid", gridTemplateColumns: workflowStarted ? "1fr 230px" : "1fr", height:"calc(100vh - 46px)", overflow:"hidden", transition:"grid-template-columns 0.3s ease" }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ borderRight: workflowStarted ? "1px solid rgba(0,0,0,0.09)" : "none", display:"flex", flexDirection:"column" }}>

          {/* ── GURU INSIGHT CARD — removed from overview, kept only when workflow active ── */}
          {false && (
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
                  <span style={{ color:"rgba(212,168,67,0.95)", fontWeight:500 }}>{fmt(deployable > 0 ? deployable : 299966)} in excess liquidity</span>.
                  {" "}We can generate better returns by optimizing fixed income products and putting cash to work in their investment strategy.
                </div>
              </div>
            </div>
          )}

          {/* ── GURU MODEL CALCULATOR CARD — Step 1 only: live AUM & after-tax stats ── */}
          {workflowStarted && (
            <div
              className="guru-landing-intel"
              style={{ margin:"12px 16px 0", position:"relative", overflow:"hidden", background:"linear-gradient(160deg,#1a3a6b 0%,#163060 55%,#0f2248 100%)", border:"1px solid rgba(91,143,204,0.20)", borderRadius:12, flexShrink:0 }}
            >
              {/* Header row */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 18px", borderBottom:"1px solid rgba(255,255,255,0.05)", position:"relative", zIndex:2 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"#5ecc8a", boxShadow:"0 0 6px rgba(94,204,138,0.7)", display:"inline-block", animation:"guruPulse 2.2s infinite", flexShrink:0 }} />
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase" as const, color:"rgba(94,204,138,0.85)" }}>GURU Model Calculator</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:5, padding:"2px 8px", border:"1px solid rgba(91,143,204,0.20)", borderRadius:2, background:"rgba(91,143,204,0.05)" }}>
                  <span style={{ width:4, height:4, borderRadius:"50%", background:"rgba(94,204,138,0.70)", display:"inline-block", animation:"guruPulse 1.8s infinite" }} />
                  <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" as const, color:"rgba(255,255,255,0.40)" }}>Live · Step 1</span>
                </div>
              </div>

              {/* Live calculator stats — update as advisor makes selections in Step 1 */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1px 1fr 1px 1fr", position:"relative", zIndex:2 }}>
                {/* AUM Increase */}
                <div style={{ padding:"12px 18px 14px", display:"flex", flexDirection:"column", gap:4 }}>
                  <span style={{ fontSize:8, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" as const, color:"rgba(255,255,255,0.32)" }}>AUM Increase</span>
                  <span style={{ fontSize:22, fontWeight:300, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.03em", color: incomeImpact?.aumIncrease && incomeImpact.aumIncrease !== "—" ? "rgba(212,168,67,0.95)" : "rgba(255,255,255,0.22)", lineHeight:1 }}>
                    {incomeImpact?.aumIncrease ?? "—"}
                  </span>
                  <span style={{ fontSize:9, color:"rgba(255,255,255,0.22)" }}>assets deployed</span>
                </div>
                <div style={{ background:"rgba(255,255,255,0.06)" }} />
                {/* After-Tax Annual Income */}
                <div style={{ padding:"12px 18px 14px", display:"flex", flexDirection:"column", gap:4 }}>
                  <span style={{ fontSize:8, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" as const, color:"rgba(255,255,255,0.32)" }}>After-Tax Annual Income</span>
                  <span style={{ fontSize:22, fontWeight:300, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.03em", color: incomeImpact?.atIncome && incomeImpact.atIncome !== "—" ? "#5ecc8a" : "rgba(255,255,255,0.22)", lineHeight:1 }}>
                    {incomeImpact?.atIncome ?? "—"}
                  </span>
                  <span style={{ fontSize:9, color:"rgba(255,255,255,0.22)" }}>{incomeImpact?.atIncomeSub ?? "per year · after-tax"}</span>
                </div>
                <div style={{ background:"rgba(255,255,255,0.06)" }} />
                {/* % AT Return Increase */}
                <div style={{ padding:"12px 18px 14px", display:"flex", flexDirection:"column", gap:4 }}>
                  <span style={{ fontSize:8, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" as const, color:"rgba(255,255,255,0.32)" }}>% AT Return Increase</span>
                  <span style={{ fontSize:22, fontWeight:300, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.03em", color: incomeImpact?.yieldDelta && incomeImpact.yieldDelta !== "—" ? "#5ecc8a" : "rgba(255,255,255,0.22)", lineHeight:1 }}>
                    {incomeImpact?.yieldDelta ?? "—"}
                  </span>
                  <span style={{ fontSize:9, color:"rgba(255,255,255,0.22)" }}>{incomeImpact?.yieldDeltaSub ?? "make selections below to calculate"}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── CENTER: allocation overview → then live workflow ── */}
          {!workflowStarted ? (
            <div style={{ flex:1, overflowY:"auto" as const, padding:"24px 32px 36px", fontFamily:"'Inter', system-ui, sans-serif" }}>

              {/* GURU flags strip */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(14,28,52,0.90)", borderRadius:7, padding:"10px 16px", marginBottom:20 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:5, height:5, borderRadius:"50%", background:"#5ecc8a", boxShadow:"0 0 6px rgba(94,204,138,0.7)", display:"inline-block" }} />
                  <span style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.13em", textTransform:"uppercase" as const, color:"rgba(94,204,138,0.82)" }}>GURU Flagged 2 Items</span>
                </div>
                <span style={{ fontSize:10.5, color:"rgba(255,255,255,0.35)" }}>Excess liquidity · Rebalancing opportunity</span>
              </div>

              {/* Title */}
              <div style={{ fontFamily:'"Playfair Display", Georgia, serif', fontSize:22, fontWeight:400, color:"#1a1a1a", lineHeight:1.25, letterSpacing:"-0.01em", marginBottom:14 }}>
                Kessler Household Balance Sheet
              </div>
              <div style={{ fontSize:11, color:"rgba(0,0,0,0.42)", marginBottom:18, lineHeight:1.5 }}>
                All accounts organized by GURU liquidity bucket. Review balances before proceeding to rebalancing.
              </div>

              {/* Summary KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:20 }}>
                {[
                  { label:"Total Assets", value:"$5,912,862", color:"#1a1a1a" },
                  { label:"Liquid Assets", value:"$693,636", color:"rgba(212,168,67,0.95)", sub:"Operating Cash + Reserve + Build" },
                  { label:"Excess Liquidity", value:"$299,966", color:"rgba(94,204,138,0.95)", sub:"Above coverage threshold" },
                ].map(kpi => (
                  <div key={kpi.label} style={{ background:"#fff", border:"1px solid rgba(0,0,0,0.09)", borderRadius:6, padding:"11px 14px" }}>
                    <div style={{ fontSize:8, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" as const, color:"rgba(0,0,0,0.35)", marginBottom:5 }}>{kpi.label}</div>
                    <div style={{ fontFamily:'"Instrument Serif", Georgia, serif', fontSize:20, color:kpi.color, lineHeight:1, marginBottom:kpi.sub ? 4 : 0 }}>{kpi.value}</div>
                    {kpi.sub && <div style={{ fontSize:9, color:"rgba(0,0,0,0.35)", marginTop:2 }}>{kpi.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Bucket table */}
              <div style={{ background:"#fff", border:"1px solid rgba(0,0,0,0.09)", borderRadius:8, overflow:"hidden", marginBottom:22 }}>
                {/* Table header */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 90px 70px", gap:0, padding:"8px 18px", background:"#f8f6f3", borderBottom:"1px solid rgba(0,0,0,0.07)" }}>
                  {[["Account","left"],["Yield","right"],["Balance","right"],["% Total","right"]].map(([h,a]) => (
                    <div key={h} style={{ fontSize:8.5, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase" as const, color:"rgba(0,0,0,0.35)", textAlign:a as any }}>{h}</div>
                  ))}
                </div>

                {/* Buckets */}
                {[
                  { key:"op",  label:"Operating Cash", color:"#4f9cf9", desc:"Checking · daily liquidity", accounts:[
                    { name:"Chase Total Checking (Main)",          ref:"··2680", yield:"0.01%", bal:25050,  pct:"0.4%" },
                    { name:"Citizens Private Banking Checking",    ref:"··3858", yield:"0.01%", bal:107000, pct:"1.8%", note:"overflow / excess" },
                  ], subtotal:132050, subPct:"2.2%", excess:90172 },
                  { key:"res", label:"Reserve", color:"#d4a843", desc:"Savings · money market · near-term buffer", accounts:[
                    { name:"Citizens Private Bank Money Market",  ref:"··4421", yield:"3.65%", bal:225000, pct:"3.8%", note:"active yield" },
                    { name:"Goldman Savings",                     ref:"··7710", yield:"4.65%", bal:116586, pct:"2.0%" },
                    { name:"Fidelity CD",                         ref:"··9031", yield:"5.15%", bal:85000,  pct:"1.4%" },
                  ], subtotal:426586, subPct:"7.2%", excess:209794 },
                  { key:"bld", label:"Build", color:"#2e7a52", desc:"Short-duration fixed income · CDs and T-bills", accounts:[
                    { name:"US Treasuries (3.95% yield)",         ref:"··1142", yield:"3.95%", bal:135000, pct:"2.3%", note:"rolling maturities" },
                  ], subtotal:135000, subPct:"2.3%" },
                  { key:"grw", label:"Grow", color:"#a855f7", desc:"Long-term wealth accumulation · investments, RE, retirement", accounts:[
                    { name:"Fidelity Brokerage",                  ref:"··9031", yield:"4.85%", bal:135000, pct:"2.3%", note:"brokerage cash" },
                    { name:"Investments & Retirement",            ref:"various", yield:"—",    bal:1094726, pct:"18.5%" },
                  ], subtotal:1229726, subPct:"20.8%" },
                ].flatMap((bucket) => [
                  /* Bucket header row */
                  <div key={`bh-${bucket.key}`} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 18px 7px", borderBottom:"1px solid rgba(0,0,0,0.05)", background:"rgba(0,0,0,0.012)" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:bucket.color, flexShrink:0 }} />
                    <span style={{ fontSize:11, fontWeight:600, color:"#1a1a1a" }}>{bucket.label}</span>
                    <span style={{ fontSize:10.5, color:"rgba(0,0,0,0.38)" }}>·</span>
                    <span style={{ fontSize:10.5, color:"rgba(0,0,0,0.42)" }}>{bucket.desc}</span>
                    {bucket.excess && <span style={{ marginLeft:"auto", fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:"rgba(212,168,67,0.90)", background:"rgba(212,168,67,0.08)", border:"1px solid rgba(212,168,67,0.22)", borderRadius:3, padding:"2px 7px" }}>−{fmt(bucket.excess)} excess</span>}
                  </div>,
                  /* Account rows */
                  ...bucket.accounts.map((acct, ai) => (
                    <div key={`${bucket.key}-${ai}`} style={{ display:"grid", gridTemplateColumns:"1fr 70px 90px 70px", gap:0, padding:"7px 18px 7px 34px", borderBottom:"1px solid rgba(0,0,0,0.04)", alignItems:"center" }}>
                      <div>
                        <span style={{ fontSize:11, color:"#1a1a1a" }}>{acct.name}</span>
                        <span style={{ fontSize:10, color:"rgba(0,0,0,0.35)", marginLeft:6 }}>{acct.ref}</span>
                        {acct.note && <span style={{ fontSize:9.5, color:"rgba(0,0,0,0.30)", marginLeft:6 }}>· {acct.note}</span>}
                      </div>
                      <div style={{ textAlign:"right", fontSize:11, color:"rgba(0,0,0,0.55)", fontVariantNumeric:"tabular-nums" }}>{acct.yield}</div>
                      <div style={{ textAlign:"right", fontFamily:'"Instrument Serif", Georgia, serif', fontSize:13, color:"#1a1a1a", fontVariantNumeric:"tabular-nums" }}>{fmt(acct.bal)}</div>
                      <div style={{ textAlign:"right", fontSize:10.5, color:"rgba(0,0,0,0.38)", fontVariantNumeric:"tabular-nums" }}>{acct.pct}</div>
                    </div>
                  )),
                  /* Subtotal row */
                  <div key={`${bucket.key}-sub`} style={{ display:"grid", gridTemplateColumns:"1fr 70px 90px 70px", gap:0, padding:"7px 18px", background:"rgba(0,0,0,0.018)", borderBottom:"1px solid rgba(0,0,0,0.07)", alignItems:"center" }}>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.10em", textTransform:"uppercase" as const, color:"rgba(0,0,0,0.38)" }}>{bucket.label} Subtotal</div>
                    <div />
                    <div style={{ textAlign:"right", fontFamily:'"Instrument Serif", Georgia, serif', fontSize:14, fontWeight:400, color:"#1a1a1a", fontVariantNumeric:"tabular-nums" }}>{fmt(bucket.subtotal)}</div>
                    <div style={{ textAlign:"right", fontSize:10.5, color:"rgba(0,0,0,0.50)", fontVariantNumeric:"tabular-nums" }}>{bucket.subPct}</div>
                  </div>,
                ])}
              </div>

              {/* Step 1 CTA */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, paddingTop:4 }}>
                <button
                  style={{ fontFamily:"'Inter', system-ui, sans-serif", fontSize:11, fontWeight:700, letterSpacing:"0.10em", textTransform:"uppercase" as const, background:"hsl(222,45%,12%)", color:"rgba(255,255,255,0.92)", border:"none", cursor:"pointer", padding:"14px 48px", borderRadius:5 }}
                  onClick={() => { setWorkflowStarted(true); }}
                >
                  Begin Step 1: Allocation Rebalancing →
                </button>
                <span style={{ fontSize:10, color:"rgba(0,0,0,0.35)" }}>~6 minutes · reversible at every step</span>
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

        {/* ── RIGHT COLUMN — Bucket cards — only once Step 1 starts ── */}
        {workflowStarted && <div style={{ background:"#f5f1ec", display:"flex", flexDirection:"column" }}>
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
        </div>}

      </div>
    </div>
  );
}

// ─── Onboarding View — shown when client has no data yet ──────────────────────
function OnboardingView({ clientName, clientId }: { clientName: string; clientId: number }) {
  const firstName = clientName.split(" ")[0];
  const [dragOver, setDragOver]     = useState(false);
  const [uploaded, setUploaded]     = useState<{ name: string; status: "uploading"|"done"|"error" }[]>([]);
  const [uploading, setUploading]   = useState(false);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploaded(prev => [...prev, { name: file.name, status: "uploading" }]);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload  = () => res((r.result as string).split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const resp = await fetch(`/api/clients/${clientId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, data: base64 }),
      });
      const status = resp.ok ? "done" : "error";
      setUploaded(prev => prev.map(u => u.name === file.name ? { ...u, status } : u));
    } catch {
      setUploaded(prev => prev.map(u => u.name === file.name ? { ...u, status: "error" } : u));
    }
  }

  async function handleFiles(files: FileList | File[]) {
    setUploading(true);
    await Promise.all(Array.from(files).map(uploadFile));
    setUploading(false);
  }

  const DOC_TYPES = [
    { icon: FileText,    label: "Bank Statements",      sub: "Last 3–6 months",            color: "#2563eb" },
    { icon: BarChart2,   label: "Brokerage Statements", sub: "All investment accounts",     color: "#7c3aed" },
    { icon: BookOpen,    label: "Tax Returns",           sub: "Most recent 1–2 years",      color: "#9a7b3c" },
    { icon: Home,        label: "Real Estate Docs",      sub: "Deeds, mortgage, HELOC",     color: "#2e7a52" },
    { icon: Building2,   label: "Business Interests",   sub: "K-1s, operating agreements", color: "#1b3d6e" },
    { icon: ShieldCheck, label: "Insurance Policies",   sub: "Life, disability, umbrella",  color: "#b45309" },
  ];

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#f0ede8", fontFamily:"'Inter', system-ui, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth:820, margin:"0 auto", padding:"40px 48px 60px" }}>

        {/* ── Eyebrow ── */}
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" as const, color:"rgba(154,123,60,0.75)", marginBottom:10 }}>
          Client Onboarding
        </div>

        {/* ── Headline ── */}
        <div style={{ fontFamily:'"Playfair Display", Georgia, serif', fontSize:34, fontWeight:400, color:"hsl(222,45%,12%)", lineHeight:1.15, letterSpacing:"-0.02em", marginBottom:10 }}>
          Welcome, {firstName}.<br/>Let's build your profile.
        </div>
        <div style={{ fontSize:13, color:"rgba(0,0,0,0.44)", marginBottom:36, lineHeight:1.70, maxWidth:520 }}>
          Upload your financial documents below. GURU will analyze your complete picture and prepare your first review — typically within a few minutes.
        </div>

        {/* ── Section label ── */}
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase" as const, color:"rgba(0,0,0,0.35)", marginBottom:14 }}>
          Documents to upload
        </div>

        {/* ── Document type cards — reference grid ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:24 }}>
          {DOC_TYPES.map(({ icon: Icon, label, sub, color }) => (
            <div key={label} style={{
              background:"#ffffff", borderRadius:10, border:"1px solid rgba(0,0,0,0.07)",
              padding:"16px 16px 14px", boxShadow:"0 1px 3px rgba(0,0,0,0.04)",
              display:"flex", flexDirection:"column", gap:8,
            }}>
              <div style={{ width:32, height:32, borderRadius:8, background:`${color}14`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Icon style={{ width:16, height:16, color }} />
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:"hsl(222,45%,12%)", marginBottom:2 }}>{label}</div>
                <div style={{ fontSize:11, color:"rgba(0,0,0,0.40)", lineHeight:1.4 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Drop zone ── */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg"
          style={{ display:"none" }}
          onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault(); setDragOver(false);
            if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
          }}
          style={{
            border:`2px dashed ${dragOver ? "hsl(222,45%,12%)" : "rgba(0,0,0,0.15)"}`,
            borderRadius:12, padding:"36px 32px", display:"flex", flexDirection:"column" as const, alignItems:"center",
            justifyContent:"center", gap:12, background: dragOver ? "rgba(27,61,110,0.04)" : "rgba(255,255,255,0.55)",
            transition:"all 0.15s", cursor:"pointer", textAlign:"center" as const, marginBottom:16,
          }}
        >
          <div style={{ width:48, height:48, borderRadius:"50%", background:"rgba(27,61,110,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <ArrowUpRight style={{ width:22, height:22, color:"hsl(222,45%,12%)" }} />
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:"hsl(222,45%,12%)", marginBottom:4 }}>
              {dragOver ? "Release to upload" : uploading ? "Uploading…" : "Click or drop files here"}
            </div>
            <div style={{ fontSize:12, color:"rgba(0,0,0,0.40)" }}>
              PDF, CSV, XLSX, images accepted
            </div>
          </div>
        </div>

        {/* ── Uploaded file list ── */}
        {uploaded.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column" as const, gap:6, marginBottom:20 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.10em", textTransform:"uppercase" as const, color:"rgba(0,0,0,0.32)", marginBottom:4 }}>
              {uploaded.filter(u=>u.status==="done").length} of {uploaded.length} file{uploaded.length !== 1 ? "s" : ""} uploaded
            </div>
            {uploaded.map((f, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, background:"#fff",
                border:`1px solid ${f.status==="error" ? "rgba(220,38,38,0.22)" : "rgba(46,122,82,0.22)"}`,
                borderRadius:7, padding:"9px 14px" }}>
                {f.status === "uploading"
                  ? <div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid #2e7a52", borderTopColor:"transparent", animation:"spin 0.7s linear infinite", flexShrink:0 }} />
                  : f.status === "done"
                  ? <CheckCircle2 style={{ width:14, height:14, color:"#2e7a52", flexShrink:0 }} />
                  : <span style={{ fontSize:13, color:"#dc2626" }}>✕</span>
                }
                <span style={{ fontSize:12, color:"hsl(222,45%,12%)", flex:1 }}>{f.name}</span>
                <span style={{ fontSize:10, fontWeight:600,
                  color: f.status==="error" ? "#dc2626" : f.status==="uploading" ? "rgba(0,0,0,0.35)" : "rgba(46,122,82,0.70)" }}>
                  {f.status === "uploading" ? "Uploading…" : f.status === "done" ? "Uploaded" : "Failed"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Security note ── */}
        <div style={{ background:"rgba(27,61,110,0.04)", border:"1px solid rgba(27,61,110,0.09)", borderRadius:8, padding:"12px 16px", display:"flex", gap:10, alignItems:"flex-start", marginBottom:28 }}>
          <Lock style={{ width:13, height:13, color:"hsl(222,45%,12%)", flexShrink:0, marginTop:1 }} />
          <div style={{ fontSize:11, color:"rgba(0,0,0,0.48)", lineHeight:1.6 }}>
            Bank-grade 256-bit encryption. GURU uses read-only access and never moves funds without your explicit approval.
          </div>
        </div>

        {/* ── CTA ── */}
        <div style={{ display:"flex", alignItems:"center", gap:20 }}>
          <button style={{
            background:"hsl(222,45%,12%)", border:"none", borderRadius:8,
            padding:"14px 32px", fontSize:12, fontWeight:700, letterSpacing:"0.10em",
            textTransform:"uppercase" as const, color:"rgba(255,255,255,0.92)", cursor:"pointer", flexShrink:0,
          }}>
            {uploaded.filter(u=>u.status==="done").length > 0
              ? `Continue with ${uploaded.filter(u=>u.status==="done").length} Document${uploaded.filter(u=>u.status==="done").length !== 1 ? "s" : ""} →`
              : "Upload Documents to Continue"}
          </button>
          <div style={{ fontSize:11, color:"rgba(0,0,0,0.35)", lineHeight:1.5 }}>
            Your advisor will be notified to review<br/>and schedule your first session.
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Asset Overview View ───────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function parseAssetYield(desc: string): string | null {
  const m = (desc ?? "").match(/(\d+\.?\d*)\s*%/);
  return m ? m[1] + "%" : null;
}
function assetShortName(desc: string): string {
  return (desc ?? "").split("(")[0].split("—")[0].split("–")[0].split("@")[0].trim();
}
function assetBucketKey(a: Asset): "reserve" | "yield_" | "tactical" | "growth" | "alts" {
  const d = (a.description ?? "").toLowerCase();
  if (a.type === "cash") return d.includes("checking") ? "reserve" : "yield_";
  if (a.type === "fixed_income")
    return d.includes("treasur") || d.includes("t-bill") || d.includes("short") ? "tactical" : "growth";
  if (a.type === "equity")
    return d.includes("rsu") || d.includes("unvested") || d.includes("carry") ? "alts" : "growth";
  return "alts"; // alternative, real_estate
}
// ─── Liquidity bucket yield lookup (current holdings, pre-tax + after-tax) ────
// Used by both LiquidityWaterfallView and CashFlowForecastWaterfallView so interest
// income ties between tabs. Tax rates: bank deposits 47% (fed 35% + NY 8% + NYC 4%),
// Treasuries & government-only MMFs 35% federal only (state/city exempt).
const LIQUID_YIELD_MAP: Array<{ test: (d: string) => boolean; pretax: number; keepRate: number }> = [
  { test: d => d.includes("capital one") || d.includes("360 performance"),                       pretax: 3.78, keepRate: 0.53 },
  { test: d => d.includes("citizens") && d.includes("money market"),                             pretax: 3.65, keepRate: 0.53 },
  { test: d => d.includes("fidelity") && (d.includes("money market") || d.includes("spaxx") || d.includes("cash sweep")), pretax: 2.50, keepRate: 0.65 },
  { test: d => d.includes("treasur") || d.includes("t-bill"),                                    pretax: 3.95, keepRate: 0.65 },
  { test: d => d.includes("checking"),                                                            pretax: 0.01, keepRate: 0.53 },
];
function liquidAssetYields(bucketAssets: Asset[]): { pretax: number; at: number } {
  let wPre = 0, wAt = 0, vSum = 0;
  for (const a of bucketAssets) {
    const d = (a.description ?? "").toLowerCase();
    const v = Number(a.value);
    if (v <= 0) continue;
    const match = LIQUID_YIELD_MAP.find(m => m.test(d));
    if (match) { wPre += v * match.pretax; wAt += v * match.pretax * match.keepRate; vSum += v; }
  }
  if (vSum === 0) return { pretax: 0, at: 0 };
  return { pretax: wPre / vSum / 100, at: wAt / vSum / 100 };
}
// Compute 12 monthly After-Tax interest amounts for all three liquid buckets combined.
// Returns array of length 12 (Jan–Dec). Used to feed both Asset Forecast and CF Forecast tabs.
function computeMonthlyBucketInterest(assets: Asset[], cashFlows: CashFlow[]): number[] {
  const { operatingCash, liquidityReserve, capitalBuild } = computeLiquidityTargets(assets, cashFlows);
  const opYields  = liquidAssetYields(assets.filter(a => assetBucketKey(a) === "reserve"));
  const rsvYields = liquidAssetYields(assets.filter(a => assetBucketKey(a) === "yield_"));
  const bldYields = liquidAssetYields(assets.filter(a => assetBucketKey(a) === "tactical"));

  const forecast = buildForecast(cashFlows);
  let opsBal = operatingCash;
  return Array.from({ length: 12 }, (_, i) => {
    const { inflow, outflow } = forecast[i];
    const opsEnd = opsBal + inflow - outflow;
    const opsAtInt = Math.max(0, opsEnd) * (opYields.at / 12);
    opsBal = opsEnd;
    const rsvAtInt = liquidityReserve * (rsvYields.at / 12);
    const bldAtInt = i === 11 ? capitalBuild * bldYields.at : 0; // 1-year T-bill pays at maturity (December only)
    return opsAtInt + rsvAtInt + bldAtInt;
  });
}

function isRetirementAsset(a: Asset): boolean {
  const d = (a.description ?? "").toLowerCase();
  return d.includes("401") || d.includes("roth") || d.includes(" ira") || d.includes("retirement");
}
function isIdleAsset(a: Asset): boolean {
  const d = (a.description ?? "").toLowerCase();
  return d.includes("idle") || d.includes("sweep");
}

function AssetOvBucketCard({
  color, border, name, tagline, approach, balance, isNeg, items, header4, subSections,
}: {
  color: string; border: string; name: string; tagline: string; approach: string;
  balance: number; isNeg?: boolean;
  items?: Asset[];
  header4?: string;
  subSections?: { label: string; items: Asset[] }[];
}) {
  const COL3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 92px 58px", padding: "0 20px" };
  const thStyle = (right?: boolean): React.CSSProperties => ({
    fontSize: 7.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
    color: "rgba(0,0,0,0.30)", textAlign: right ? "right" : "left",
  });

  function renderRow(a: Asset, key: string | number) {
    const yld = parseAssetYield(a.description ?? "");
    const desc = a.description ?? "";
    const d = desc.toLowerCase();
    const isRental = d.includes("rented") || d.includes("rental") || d.includes("investment, fl");
    const isPrimary = d.includes("primary") || d.includes("tribeca");
    const isIlliquid = a.type === "alternative" || a.type === "real_estate";
    const isUnvested = d.includes("rsu") || d.includes("unvested");
    const isCarry = d.includes("carry");
    const isIdle = isIdleAsset(a);
    const negBal = false;

    let yieldEl: React.ReactNode;
    if (isRental) yieldEl = <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(100,60,20,0.80)" }}>rental</span>;
    else if (isPrimary && a.type === "real_estate") yieldEl = <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(26,26,74,0.55)" }}>primary</span>;
    else if (isCarry) yieldEl = <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(30,77,140,0.75)" }}>carry</span>;
    else if (isIlliquid && !isCarry) yieldEl = <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(80,40,120,0.80)" }}>illiquid</span>;
    else if (isUnvested) yieldEl = <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(80,40,120,0.80)" }}>unvested</span>;
    else if (isIdle && yld) yieldEl = <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(184,92,0,0.85)" }}>{yld} idle</span>;
    else if (d.includes("checking") && !yld) yieldEl = <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(184,92,0,0.85)" }}>excess</span>;
    else if (yld) yieldEl = <span style={{ fontSize: 10.5, fontWeight: 400, fontVariantNumeric: "tabular-nums", color: "rgba(0,0,0,0.42)" }}>{yld}</span>;
    else yieldEl = <span style={{ color: "rgba(0,0,0,0.25)" }}>—</span>;

    // Subtext: institution hint from description
    const afterParen = desc.match(/\(([^)]+)\)/)?.[1];
    const afterDash = desc.match(/—\s*(.+)$/)?.[1]?.replace(/\d+\.\d+%\s*yield/i, "").trim();
    const subtext = (afterParen ?? afterDash ?? "").replace(/\d+\.\d+%\s*yield/i, "").trim();

    return (
      <div key={key} style={{ ...COL3, paddingTop: 6, paddingBottom: 6, borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span title={assetShortName(desc)} style={{ fontSize: 11, fontWeight: 500, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{assetShortName(desc)}</span>
          {subtext && <span title={subtext} style={{ fontSize: 8.5, color: "rgba(0,0,0,0.38)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtext}</span>}
        </div>
        <div style={{ fontSize: 11, fontWeight: 400, fontVariantNumeric: "tabular-nums", color: "rgba(0,0,0,0.70)", textAlign: "right" }}>{fmt(Number(a.value))}</div>
        <div style={{ textAlign: "right" }}>{yieldEl}</div>
      </div>
    );
  }

  function renderLiabRow(l: Liability, key: string | number) {
    const rate = Number(l.interestRate);
    const d = (l.description ?? "").toLowerCase();
    const isCard = l.type === "credit_card";
    const isCommitment = d.includes("commitment") || d.includes("unfunded");
    const rateEl = isCommitment
      ? <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(80,40,120,0.80)" }}>unfunded</span>
      : <span style={{ fontSize: 10.5, fontVariantNumeric: "tabular-nums", fontWeight: 400, color: isCard ? "#9b2020" : "rgba(0,0,0,0.42)" }}>{rate % 1 === 0 ? rate.toFixed(0) : rate.toFixed(2)}%</span>;
    const subtext = (l.description ?? "").match(/\(([^)]+)\)/)?.[1] ?? "";
    return (
      <div key={key} style={{ ...COL3, paddingTop: 6, paddingBottom: 6, borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span title={assetShortName(l.description ?? "")} style={{ fontSize: 11, fontWeight: 500, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{assetShortName(l.description ?? "")}</span>
          {subtext && <span title={subtext} style={{ fontSize: 8.5, color: "rgba(0,0,0,0.38)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtext}</span>}
        </div>
        <div style={{ fontSize: 11, fontWeight: 400, fontVariantNumeric: "tabular-nums", color: "#9b2020", textAlign: "right" }}>−{fmt(Number(l.value))}</div>
        <div style={{ textAlign: "right" }}>{rateEl}</div>
      </div>
    );
  }

  const hasSubSections = subSections && subSections.length > 0;

  return (
    <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
      <div style={{ height: 3, background: color, opacity: 0.85 }} />
      <div style={{ padding: "18px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color, opacity: 0.85, marginBottom: 4 }}>{name}</div>
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", lineHeight: 1.45 }}>{tagline}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 300, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em", color: isNeg ? "#9b2020" : "#1a1a1a", lineHeight: 1 }}>
              {isNeg ? "−" : ""}{fmt(Math.abs(balance))}
            </div>
          </div>
        </div>
        <div style={{ borderRadius: 6, padding: "9px 12px", marginBottom: 14, background: hexToRgba(color, 0.06) }}>
          <div style={{ fontSize: 10.5, color: "rgba(0,0,0,0.55)", lineHeight: 1.55 }}>{approach}</div>
        </div>
      </div>
      {/* Table */}
      <div style={{ marginLeft: -20, marginRight: -20, marginLeft: 0, marginRight: 0, borderTop: "1px solid rgba(0,0,0,0.07)" }}>
        {/* Header */}
        <div style={{ ...COL3, paddingTop: 6, paddingBottom: 5, borderBottom: "1px solid rgba(0,0,0,0.07)", background: "rgba(0,0,0,0.018)" }}>
          <div style={thStyle()}>Subaccounts</div>
          <div style={thStyle(true)}>Balance</div>
          <div style={thStyle(true)}>{header4 ?? "Yield"}</div>
        </div>
        {/* Rows */}
        {hasSubSections ? subSections!.map((sec, si) => (
          <React.Fragment key={si}>
            {sec.label && (
              <div style={{ ...COL3, paddingTop: 7, paddingBottom: 3, gridColumn: "1/-1" }}>
                <div style={{ gridColumn: "1/-1", fontSize: 7.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(0,0,0,0.28)", borderTop: si > 0 ? "1px solid rgba(0,0,0,0.05)" : "none", paddingTop: si > 0 ? 7 : 3 }}>
                  {sec.label}
                </div>
              </div>
            )}
            {sec.items.map((a, i) => renderRow(a, `${si}-${i}`))}
          </React.Fragment>
        )) : items?.map((a, i) => renderRow(a, i))}
      </div>
    </div>
  );
}

function AssetOverviewView({ assets, liabilities }: { assets: Asset[]; liabilities: Liability[]; cashFlows?: CashFlow[] }) {
  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalLiab = liabilities.reduce((s, l) => s + Number(l.value), 0);
  const netWorth = totalAssets - totalLiab;

  // Bucket the assets
  const opCash    = assets.filter(a => assetBucketKey(a) === "reserve");
  const resCash   = assets.filter(a => assetBucketKey(a) === "yield_");
  const capBuild  = assets.filter(a => assetBucketKey(a) === "tactical");
  const growthAll = assets.filter(a => assetBucketKey(a) === "growth");
  const alts      = assets.filter(a => assetBucketKey(a) === "alts");

  const growthEquity     = growthAll.filter(a => !isRetirementAsset(a));
  const growthRetirement = growthAll.filter(a => isRetirementAsset(a));

  const opTotal    = opCash.reduce((s, a) => s + Number(a.value), 0);
  const resTotal   = resCash.reduce((s, a) => s + Number(a.value), 0);
  const capTotal   = capBuild.reduce((s, a) => s + Number(a.value), 0);
  const growTotal  = growthAll.reduce((s, a) => s + Number(a.value), 0);
  const altTotal   = alts.reduce((s, a) => s + Number(a.value), 0);

  // Liability buckets
  const mortgages     = liabilities.filter(l => l.type === "mortgage");
  const consumer      = liabilities.filter(l => l.type === "credit_card" || l.type === "student_loan");
  const investFinance = liabilities.filter(l => l.type === "personal_loan");
  const mortTotal     = mortgages.reduce((s, l) => s + Number(l.value), 0);
  const consTotal     = consumer.reduce((s, l) => s + Number(l.value), 0);
  const investTotal   = investFinance.reduce((s, l) => s + Number(l.value), 0);

  // GURU signal: largest idle/low-yield cash chunk
  const idleItems = resCash.filter(a => isIdleAsset(a));
  const idleTotal = idleItems.reduce((s, a) => s + Number(a.value), 0);

  const COL3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 92px 58px", padding: "0 20px" };
  const thStyle = (right?: boolean): React.CSSProperties => ({
    fontSize: 7.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
    color: "rgba(0,0,0,0.30)", textAlign: right ? "right" : "left",
  });

  function renderLiabRows(items: Liability[], header4 = "Rate") {
    return items.map((l, i) => {
      const rate = Number(l.interestRate);
      const d = (l.description ?? "").toLowerCase();
      const isCard = l.type === "credit_card";
      const isCommitment = d.includes("commitment") || d.includes("unfunded");
      const rateEl = isCommitment
        ? <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(80,40,120,0.80)" }}>unfunded</span>
        : <span style={{ fontSize: 10.5, fontVariantNumeric: "tabular-nums", fontWeight: 400, color: isCard ? "#9b2020" : "rgba(0,0,0,0.42)" }}>{rate % 1 === 0 ? rate.toFixed(0) : rate.toFixed(2)}%</span>;
      const subtext = (l.description ?? "").match(/\(([^)]+)\)/)?.[1] ?? (l.description ?? "").match(/—\s*(.+?)(?:\s*@|$)/)?.[1]?.trim() ?? "";
      return (
        <div key={i} style={{ ...COL3, paddingTop: 6, paddingBottom: 6, borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{assetShortName(l.description ?? "")}</span>
            {subtext && <span style={{ fontSize: 8.5, color: "rgba(0,0,0,0.38)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtext}</span>}
          </div>
          <div style={{ fontSize: 11, fontWeight: 400, fontVariantNumeric: "tabular-nums", color: "#9b2020", textAlign: "right" }}>−{fmt(Number(l.value))}</div>
          <div style={{ textAlign: "right" }}>{rateEl}</div>
        </div>
      );
    });
  }

  function LiabCard({ color, border, name, tagline, approach, total, items: ls, header4 = "Rate" }: {
    color: string; border: string; name: string; tagline: string; approach: string;
    total: number; items: Liability[]; header4?: string;
  }) {
    return (
      <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <div style={{ height: 3, background: color, opacity: 0.85 }} />
        <div style={{ padding: "18px 20px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color, opacity: 0.85, marginBottom: 4 }}>{name}</div>
              <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", lineHeight: 1.45 }}>{tagline}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 300, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em", color: "#9b2020", lineHeight: 1 }}>−{fmt(total)}</div>
            </div>
          </div>
          <div style={{ borderRadius: 6, padding: "9px 12px", marginBottom: 14, background: "rgba(155,32,32,0.05)" }}>
            <div style={{ fontSize: 10.5, color: "rgba(0,0,0,0.55)", lineHeight: 1.55 }}>{approach}</div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ ...COL3, paddingTop: 6, paddingBottom: 5, borderBottom: "1px solid rgba(0,0,0,0.07)", background: "rgba(0,0,0,0.018)" }}>
            <div style={thStyle()}>Subaccounts</div>
            <div style={thStyle(true)}>Balance</div>
            <div style={thStyle(true)}>{header4}</div>
          </div>
          {renderLiabRows(ls, header4)}
        </div>
      </div>
    );
  }

  const sectionLbl: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(0,0,0,0.30)", marginBottom: 12 };
  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14, marginBottom: 32 };

  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "#f0ece5" }}>
      {/* Sticky header */}
      <div style={{ background: "rgba(240,236,229,0.97)", borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "0 48px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(4px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Kessler Family</span>
          <span style={{ color: "rgba(0,0,0,0.20)" }}>·</span>
          <span style={{ fontSize: 13, color: "rgba(0,0,0,0.50)" }}>Asset Overview</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#5ecc8a" }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(0,0,0,0.35)" }}>Live Data</span>
        </div>
      </div>

      <div style={{ padding: "36px clamp(16px, 3.5vw, 48px) 80px" }}>
        {/* Headline */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(154,123,60,0.75)", marginBottom: 10 }}>Kessler Family · Financial Picture</div>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 30, fontWeight: 400, color: "hsl(222,45%,12%)", lineHeight: 1.20, letterSpacing: "-0.02em", marginBottom: 8 }}>Where the money lives — and how it is working.</div>
        <div style={{ fontSize: 13, color: "rgba(0,0,0,0.45)", lineHeight: 1.65, maxWidth: 560, marginBottom: 22 }}>Every position, organized by purpose. Balances and yields as of today.</div>

        {/* Net worth strip */}
        <div style={{ display: "flex", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, background: "#fff", marginBottom: 28, overflow: "hidden" }}>
          {[
            { label: "Net Worth", val: netWorth, note: null },
            { label: "Total Assets", val: totalAssets, note: `${assets.length} positions` },
            { label: "Total Liabilities", val: -totalLiab, note: `${liabilities.length} positions`, neg: true },
            { label: "Liquid Assets", val: opTotal + resTotal + capTotal, note: `${(((opTotal + resTotal + capTotal) / totalAssets) * 100).toFixed(1)}% of total assets` },
          ].map((item, i) => (
            <div key={i} style={{ flex: 1, padding: "14px 20px", borderRight: "1px solid rgba(0,0,0,0.07)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(0,0,0,0.32)", marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 19, fontWeight: 300, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em", color: item.neg ? "#9b2020" : "hsl(222,45%,12%)", lineHeight: 1 }}>
                {item.neg ? "−" : ""}{fmt(Math.abs(item.val))}
              </div>
              {item.note && <div style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", marginTop: 3 }}>{item.note}</div>}
            </div>
          ))}
          <div style={{ flex: 1, padding: "14px 20px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(0,0,0,0.32)", marginBottom: 4 }}>Annual Income</div>
            <div style={{ fontSize: 19, fontWeight: 300, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em", color: "hsl(222,45%,12%)", lineHeight: 1 }}>—</div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", marginTop: 3 }}>Yield-bearing positions</div>
          </div>
        </div>

        {/* GURU signal */}
        {idleTotal > 0 && (
          <div style={{ background: "#0c1828", borderRadius: 8, padding: "10px 16px", display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", whiteSpace: "nowrap" }}>GURU Intelligence</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "2px solid #44e08a", paddingLeft: 10 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#44e08a", flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#fff", textTransform: "uppercase" }}>LQ-7</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{fmt(idleTotal)} sitting in idle sweep — opportunity to ladder into Treasuries at current rates</span>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", border: "1px solid rgba(68,224,138,0.35)", color: "#44e08a", padding: "2px 7px", borderRadius: 2, whiteSpace: "nowrap" }}>Opportunity · Review Allocation</span>
            </div>
          </div>
        )}

        {/* Assets */}
        <div style={sectionLbl}>Assets · {fmt(totalAssets)}</div>
        <div style={grid}>
          <AssetOvBucketCard color={GURU_BUCKETS.reserve.color} border={`${GURU_BUCKETS.reserve.color}2e`} name="Operating Cash"
            tagline="2–3 months of core expenses. Instant access. No rate optimization."
            approach="Day-to-day expenses and debt payments. Always available. Priority is access, not return. Anything above the floor should be deployed."
            balance={opTotal} items={opCash} />
          <AssetOvBucketCard color={GURU_BUCKETS.yield.color} border={`${GURU_BUCKETS.yield.color}2e`} name="Liquidity Reserve"
            tagline="12–18 months of anticipated outflows plus a buffer."
            approach="Next 12–18 months of outflows, plus room for the unexpected. Priority is to preserve value and stay accessible. Intentionally larger than known needs. The buffer is the point."
            balance={resTotal} items={resCash} />
          {capTotal > 0 && (
            <AssetOvBucketCard color={GURU_BUCKETS.tactical.color} border={`${GURU_BUCKETS.tactical.color}2e`} name="Capital Build"
              tagline="Saving for a specific goal with a known target and deadline."
              approach="Set aside for a large planned expenditure with a fixed timeline. Priority is to grow while protecting principal. One purpose — do not touch for anything else."
              balance={capTotal} items={capBuild} />
          )}
          <AssetOvBucketCard color={GURU_BUCKETS.growth.color} border={`${GURU_BUCKETS.growth.color}2e`} name="Investments"
            tagline="Long-term growth across brokerage and retirement accounts."
            approach="Long-term wealth growth. Return is the only objective. Priority is after-tax growth over decades. Volatility is accepted."
            balance={growTotal} header4="5yr Ret."
            subSections={[
              ...(growthEquity.length > 0 ? [{ label: "Equities", items: growthEquity }] : []),
              ...(growthRetirement.length > 0 ? [{ label: "Retirement", items: growthRetirement }] : []),
            ]} />
          {altTotal > 0 && (
            <AssetOvBucketCard color={GURU_BUCKETS.alternatives.color} border={`${GURU_BUCKETS.alternatives.color}2e`} name="Other Assets"
              tagline="Real estate, private equity, and stock compensation. Not liquid."
              approach="Assets that contribute to net worth but cannot quickly be accessed. Priority is accurate tracking for a complete financial picture. Not managed for deployment. Values are estimates."
              balance={altTotal} items={alts} />
          )}
        </div>

        {/* Liabilities */}
        <div style={{ ...sectionLbl, marginTop: 8 }}>Liabilities · −{fmt(totalLiab)}</div>
        <div style={grid}>
          {mortgages.length > 0 && (
            <LiabCard color="#9b2020" border="rgba(155,32,32,0.18)" name="Mortgages" tagline="Real estate debt obligations"
              approach="Fixed-rate mortgages locked at advantaged rates. Cost of debt is below current market — no action recommended."
              total={mortTotal} items={mortgages} />
          )}
          {consumer.length > 0 && (
            <LiabCard color="#9b2020" border="rgba(155,32,32,0.18)" name="Consumer Liabilities" tagline="Credit cards &amp; student loans"
              approach="Credit card balances assumed paid monthly — cost of carry is negligible. Student loan rate is below refi threshold; monitored annually."
              total={consTotal} items={consumer} />
          )}
          {investFinance.length > 0 && (
            <LiabCard color="#50287a" border="rgba(80,40,120,0.18)" name="Investment Financing" tagline="Private equity capital obligations"
              approach="Professional loan used to fund capital calls into PE Fund II. Remaining unfunded commitment tracked separately. Rate review recommended at next meeting."
              total={investTotal} items={investFinance} />
          )}
        </div>
      </div>

      {/* Fixed footer */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0c1828", borderTop: "1px solid rgba(255,255,255,0.05)", height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>Net Worth</span>
          <span style={{ fontSize: 22, fontWeight: 300, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em", color: "#fff" }}>{fmt(netWorth)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {[
            { label: "Total Assets", val: fmt(totalAssets) },
            { label: "Total Liabilities", val: `−${fmt(totalLiab)}` },
            { label: "Liquid Cash", val: fmt(opTotal + resTotal + capTotal), green: true },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 300, fontVariantNumeric: "tabular-nums", color: item.green ? "#44e08a" : "rgba(255,255,255,0.55)" }}>{item.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Balance Sheet bucket card ─────────────────────────────────────────────────
// 4–5 key stats always visible in a compact table; additional context in ▼ MORE.
function BSBucketCard({ color, border, name, tagline, bullets, balance, nextBalance, nextMonth, stats, secondaryStats, flag }: {
  color: string; border: string; name: string; tagline: string;
  bullets?: string[];
  balance: number;
  nextBalance?: number;
  nextMonth?: string;
  stats: { label: string; value: string; note?: string }[];
  secondaryStats?: { label: string; value: string; note?: string }[];
  flag?: { label: string; type: "ok" | "warn" | "alert" };
}) {
  const [expanded, setExpanded] = React.useState(true);
  // label | value (fixed 95px, right-aligned) | note (flex, right-aligned)
  const cols = "1fr 95px minmax(0, 1fr)";
  const rowSt: React.CSSProperties = {
    display: "grid", gridTemplateColumns: cols, gap: "0 6px",
    padding: "5px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.06)", alignItems: "center", minHeight: 28,
  };
  const flagColors: Record<string, string> = {
    ok:    "#1A6640",
    warn:  "#7A5C2A",
    alert: "#9b2020",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
      {/* Flag label — floats above the card */}
      {flag ? (
        <div style={{ display: "flex", alignItems: "center", gap: 5, paddingLeft: 2, minHeight: 14 }}>
          <div style={{ width: 5, height: 5, background: flagColors[flag.type], opacity: 0.85, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: flagColors[flag.type] }}>{flag.label}</span>
        </div>
      ) : (
        <div style={{ minHeight: 14 }} />
      )}
      <div style={{ background: "#FFFFFF", border: "0.5px solid rgba(0,0,0,0.07)", overflow: "hidden", display: "flex", flexDirection: "column" as const, flex: 1 }}>
      <div style={{ height: 4, background: color }} />
      {/* Card header — label + balance + description, separated from stats */}
      <div style={{ padding: "16px 18px 12px", borderBottom: "0.5px solid rgba(0,0,0,0.07)" }}>
        {/* Bucket label */}
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase" as const, color, marginBottom: 8 }}>{name}</div>
        {/* Balance row — current balance left, forecast right */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 300, fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.025em", color: "hsl(222,45%,12%)", lineHeight: 1 }}>{fmt(balance)}</div>
          {nextBalance !== undefined && nextMonth && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.28)" }}>{nextMonth}</span>
              <span style={{ fontSize: 13, fontWeight: 300, fontVariantNumeric: "tabular-nums" as const, color: nextBalance >= balance ? "#195830" : "#9b2020", lineHeight: 1 }}>{fmt(nextBalance)}</span>
              <span style={{ fontSize: 10, color: nextBalance >= balance ? "#195830" : "#9b2020", lineHeight: 1 }}>{nextBalance >= balance ? "▲" : "▼"}</span>
            </div>
          )}
        </div>
        {/* Description */}
        <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", lineHeight: 1.5 }}>{tagline}</div>
      </div>
      {/* Stats table — always visible */}
      <div style={{ flex: 1 }}>
        {stats.map((s, i) => {
          const isExcess = s.label === "Excess";
          return (
            <div key={i} style={{
              ...rowSt,
              ...(isExcess ? {
                background: "rgba(154,123,60,0.06)",
                border: "1px solid rgba(154,123,60,0.22)",
                borderRadius: 4,
                margin: "3px 8px",
                padding: "5px 8px",
              } : {}),
            }}>
              <span style={{ fontSize: 11, fontWeight: isExcess ? 600 : 500, color: isExcess ? "rgba(154,123,60,0.90)" : "#2a2820", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
              <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: isExcess ? "rgba(154,123,60,0.90)" : "rgba(0,0,0,0.70)", whiteSpace: "nowrap", textAlign: "right" }}>{s.value}</span>
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", textAlign: "right", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.note ?? ""}</span>
            </div>
          );
        })}
      </div>
      {/* bc-result — GURU Insights footer */}
      {bullets && bullets.length > 0 && (
        <div style={{ borderTop: "0.5px solid rgba(0,0,0,0.07)", background: "hsl(220,5%,97%)", padding: "10px 18px", display: "flex", flexDirection: "column" as const, gap: 4 }}>
          {/* Section label */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: color, opacity: 0.55, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.35)" }}>GURU Insights</span>
          </div>
          {/* Bullets */}
          {bullets.map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.25)", flexShrink: 0, marginTop: 2 }}>—</span>
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.50)", lineHeight: 1.5 }}>{b}</span>
            </div>
          ))}
        </div>
      )}
      </div>{/* end card */}
    </div>
  );
}

function BalanceSheetView({ assets, liabilities, cashFlows = [] }: { assets: Asset[]; liabilities: Liability[]; cashFlows?: CashFlow[] }) {
  const [expandedRE, setExpandedRE] = React.useState<Set<number>>(new Set());

  // ── Account metadata lookup (full names, institutions, account sub-labels) ──
  function acctMeta(desc: string): { name: string; inst: string; last4: string; insight: string; yield_: string; comment: string; collateral: string } {
    const d = (desc ?? "").toLowerCase();
    if (d.includes("chase total checking"))                                  return { name: "Chase Total Checking",                          inst: "JPMorgan Chase Bank, N.A.",        last4: "·7842", insight: "Daily Operating",         yield_: "< 0.01%",   comment: "",                       collateral: "" };
    if (d.includes("citizens private banking checking"))                     return { name: "Citizens Private Banking Checking",              inst: "Citizens Bank, N.A.",              last4: "·2847", insight: "Overflow / Payroll",      yield_: "< 0.01%",   comment: "Excess — deployable",    collateral: "" };
    if (d.includes("citizens private bank money market"))                    return { name: "Citizens Private Bank Money Market",             inst: "Citizens Bank, N.A.",              last4: "·7204", insight: "3.65% APY",               yield_: "3.65%",     comment: "",                       collateral: "" };
    if (d.includes("capitalOne 360") || d.includes("360 performance") || d.includes("capital one 360")) return { name: "Capital One 360 Performance Savings",         inst: "Capital One, N.A.",               last4: "·1482", insight: "3.78% APY",               yield_: "3.78%",     comment: "",                       collateral: "" };
    if (d.includes("cash sweep") || (d.includes("fidelity") && d.includes("money market")))             return { name: "Fidelity Government Money Market Fund (SPAXX)", inst: "Fidelity Investments",            last4: "·4976", insight: "2.50% 7-day yield",       yield_: "2.50%",     comment: "Below potential",        collateral: "" };
    if (d.includes("us treasuries") || d.includes("t-bill") || d.includes("treasur"))                  return { name: "U.S. Treasury Bills — 3-Month",                inst: "Fidelity Investments (custodian)", last4: "·1142", insight: "Matures Apr 2026",        yield_: "3.95%",     comment: "Maturing Apr '26",       collateral: "" };
    if (d.includes("cresset"))                                               return { name: "Cresset Capital — Managed Portfolio (US)",       inst: "Cresset Asset Management, LLC",    last4: "·3391", insight: "Advisor managed",          yield_: "—",         comment: "",                       collateral: "" };
    if (d.includes("schwab"))                                                return { name: "Schwab International Index Fund (SWISX)",         inst: "Charles Schwab & Co., Inc.",       last4: "·7678", insight: "",                        yield_: "+7.9%",     comment: "",                       collateral: "" };
    if (d.includes("meta platforms") || (d.includes("meta") && d.includes("e*trade"))) return { name: "E*Trade Brokerage — Meta Platforms, Inc. (META)", inst: "Morgan Stanley (E*Trade)", last4: "·9782", insight: "Concentration", yield_: "+68.3%",  comment: "Concentration",          collateral: "" };
    if (d.includes("bank of america") && d.includes("single stock"))        return { name: "E*Trade Brokerage — Bank of America Corp. (BAC)", inst: "Morgan Stanley (E*Trade)",        last4: "·9782", insight: "Concentration", yield_: "+12.0%",  comment: "Concentration",          collateral: "" };
    if (d.includes("401"))                                                   return { name: "Fidelity Workplace 401(k) — Traditional",         inst: "Fidelity Investments · 401(k)",   last4: "·8821", insight: "Tax-deferred · pre-tax",  yield_: "+10.4%",    comment: "",                       collateral: "" };
    if (d.includes("roth ira"))                                              return { name: "Fidelity Roth IRA",                               inst: "Fidelity Investments · Roth IRA", last4: "·4412", insight: "Tax-free growth",         yield_: "+11.8%",    comment: "",                       collateral: "" };
    if (d.includes("coinbase"))                                              return { name: "Coinbase Custody — Bitcoin & Ethereum",           inst: "Coinbase, Inc.",                  last4: "",      insight: "BTC 60% / ETH 40%",       yield_: "+47.3%",    comment: "High volatility",        collateral: "" };
    if (d.includes("carlyle") && d.includes("viii") && d.includes("carry")) return { name: "Carlyle Partners VIII — Carried Interest",        inst: "The Carlyle Group",               last4: "",      insight: "Est. fair market value",  yield_: "22.6% net", comment: "Illiquid",               collateral: "" };
    if (d.includes("carlyle") && d.includes("ix") && d.includes("carry"))   return { name: "Carlyle Partners IX — Carried Interest",          inst: "The Carlyle Group",               last4: "",      insight: "Est. fair market value",  yield_: "26.1% net", comment: "Illiquid",               collateral: "" };
    if (d.includes("carlyle") && d.includes("viii"))                        return { name: "Carlyle Partners VIII — LP Interest",             inst: "The Carlyle Group",               last4: "",      insight: "PE · NAV est.",           yield_: "12.4% IRR", comment: "Illiquid · 2028",        collateral: "" };
    if (d.includes("carlyle") && d.includes("ix"))                          return { name: "Carlyle Partners IX — LP Interest",               inst: "The Carlyle Group",               last4: "",      insight: "PE · NAV est.",           yield_: "14.2% IRR", comment: "Illiquid · 2030",        collateral: "" };
    if (d.includes("goldman"))                                               return { name: "Goldman Sachs Group, Inc. — RSU Award",           inst: "Goldman Sachs & Co. LLC",         last4: "",      insight: "Unvested · 2-yr cliff",   yield_: "+18.2%",    comment: "Unvested",               collateral: "" };
    if (d.includes("tribeca") && d.includes("mortgage"))                    return { name: "Tribeca Condo Mortgage — 50 Warren St, Apt 12F",  inst: "Wells Fargo Bank, N.A.",          last4: "·4421", insight: "30-yr fixed · 3.25%",     yield_: "",          comment: "",                       collateral: "Tribeca Condo (50 Warren St)" };
    if (d.includes("sarasota") && d.includes("mortgage"))                   return { name: "Sarasota Investment Property Mortgage",           inst: "Bank of America, N.A.",           last4: "·8863", insight: "30-yr fixed · 4.10%",     yield_: "",          comment: "",                       collateral: "1847 Siesta Dr · Sarasota, FL" };
    if (d.includes("sapphire") || (d.includes("chase") && d.includes("amex"))) return { name: "Chase Sapphire Reserve & Amex Platinum",      inst: "JPMorgan Chase / Amex",           last4: "·6411 + ·3009", insight: "Paid monthly",    yield_: "",          comment: "",                       collateral: "None — unsecured" };
    if (d.includes("student loan") && d.includes("sarah"))                   return { name: "Federal Student Loan — Sarah Kessler",           inst: "U.S. Dept. of Education",         last4: "·2214", insight: "Income-driven repayment", yield_: "",          comment: "",                       collateral: "None — unsecured" };
    if (d.includes("student loan") && d.includes("michael"))                 return { name: "Private Student Loan — Michael Kessler",         inst: "Sallie Mae Bank",                 last4: "·5589", insight: "Fixed rate · private",    yield_: "",          comment: "",                       collateral: "None — unsecured" };
    if (d.includes("student loan"))                                          return { name: "Student Loan",                                   inst: "Federal / Private",               last4: "·2214", insight: "",                        yield_: "",          comment: "",                       collateral: "None — unsecured" };
    if (d.includes("professional loan") || (d.includes("pe fund") && d.includes("capital call"))) return { name: "Professional Capital Call Line of Credit", inst: "First Republic Bank",  last4: "·7731", insight: "Variable rate · SOFR+",   yield_: "", comment: "Secured by LP interest", collateral: "Carlyle Partners LP Interest" };
    if (d.includes("remaining capital") || (d.includes("commitment") && d.includes("unfunded"))) return { name: "Unfunded Capital Commitment",              inst: "The Carlyle Group",    last4: "",      insight: "Carlyle IX · Unfunded",   yield_: "", comment: "Call anticipated 2026",  collateral: "Carlyle Partners IX" };
    return { name: assetShortName(desc), inst: "", last4: "", insight: "", yield_: "", comment: "", collateral: "" };
  }

  // ── Weighted-average yield helper ──────────────────────────────────────────
  function parseYieldPct(s: string): number | null {
    if (!s || s === "—") return null;
    const neg = s.trimStart().startsWith("-");
    const m = s.match(/[\d.]+/);
    if (!m) return null;
    return (neg ? -1 : 1) * parseFloat(m[0]);
  }
  function calcWtdYield(items: Asset[]): string {
    let wSum = 0, vSum = 0;
    for (const a of items) {
      const v = Number(a.value);
      const y = parseYieldPct(acctMeta(a.description ?? "").yield_);
      if (y !== null && v > 0) { wSum += v * y; vSum += v; }
    }
    if (vSum === 0) return "";
    const avg = wSum / vSum;
    return avg.toFixed(2) + "%";
  }

  // ── After-Tax yield helpers (Panel 1 liquid table) ────────────────────────
  // Tax rates: bank deposits 47% combined (fed 35% + NY 8% + NYC 4%),
  // Treasuries / government-only MMFs 35% federal only (state/city exempt).
  function calcAtYield(a: Asset): string {
    const meta = acctMeta(a.description ?? "");
    const raw = meta.yield_;
    if (!raw || raw === "—" || raw.startsWith("+") || raw.includes("IRR") || raw.includes("net")) return "—";
    const pct = parseYieldPct(raw);
    if (pct === null || pct <= 0.001) return "—";
    const d = (a.description ?? "").toLowerCase();
    const isTreasury = d.includes("treasur") || d.includes("t-bill") ||
                       (d.includes("fidelity") && (d.includes("government") || d.includes("money market")));
    const keepRate = isTreasury ? 0.65 : 0.53;
    return `${(pct * keepRate).toFixed(2)}%`;
  }
  function calcWtdAtYield(items: Asset[]): string {
    let wSum = 0, vSum = 0;
    for (const a of items) {
      const v = Number(a.value);
      const y = parseYieldPct(calcAtYield(a));
      if (y !== null && v > 0) { wSum += v * y; vSum += v; }
    }
    if (vSum === 0) return "";
    return (wSum / vSum).toFixed(2) + "%";
  }

  // Bucket assets
  const opCash    = assets.filter(a => assetBucketKey(a) === "reserve");
  const resCash   = assets.filter(a => assetBucketKey(a) === "yield_");
  const capBuild  = assets.filter(a => assetBucketKey(a) === "tactical");
  const growth    = assets.filter(a => assetBucketKey(a) === "growth");
  const altsAll   = assets.filter(a => assetBucketKey(a) === "alts");
  const reAssets   = assets.filter(a => a.type === "real_estate");
  const otherAlts  = altsAll.filter(a => a.type !== "real_estate");
  // Tracked sub-groups: pure alts (PE/crypto investment), carry vehicles, RSU deferred comp
  const pureAlts   = otherAlts.filter(a => { const d = (a.description ?? "").toLowerCase(); return !d.includes("carry") && !d.includes("rsu") && !d.includes("goldman"); });
  const peAssets   = pureAlts.filter(a => (a.description ?? "").toLowerCase().includes("carlyle"));
  const cryptoAssets = pureAlts.filter(a => (a.description ?? "").toLowerCase().includes("coinbase"));
  // Alternative investments = pureAlts that are neither PE (carlyle) nor crypto (coinbase)
  const altInvests = pureAlts.filter(a => { const d = (a.description ?? "").toLowerCase(); return !d.includes("carlyle") && !d.includes("coinbase"); });
  const carryAlts  = otherAlts.filter(a => (a.description ?? "").toLowerCase().includes("carry"));
  const rsuAlts    = otherAlts.filter(a => { const d = (a.description ?? "").toLowerCase(); return d.includes("rsu") || d.includes("goldman"); });

  const growthEquity     = growth.filter(a => !isRetirementAsset(a));
  const growthRetirement = growth.filter(a => isRetirementAsset(a));

  // Zillow estimates (demo hardcoded)
  function zillowVal(a: Asset): number {
    const d = (a.description ?? "").toLowerCase();
    if (d.includes("tribeca")) return 1875000;
    if (d.includes("sarasota")) return 415000;
    return Number(a.value);
  }
  function reAddr(a: Asset): string {
    const d = (a.description ?? "").toLowerCase();
    if (d.includes("tribeca")) return "50 Warren St, Apt 12F · New York, NY";
    if (d.includes("sarasota")) return "1847 Siesta Drive · Sarasota, FL";
    return "";
  }

  // Totals
  const opTotal        = opCash.reduce((s, a) => s + Number(a.value), 0);
  const resTotal       = resCash.reduce((s, a) => s + Number(a.value), 0);
  const capTotal       = capBuild.reduce((s, a) => s + Number(a.value), 0);
  const growTotal      = growth.reduce((s, a) => s + Number(a.value), 0);
  const reTotalZillow   = reAssets.reduce((s, a) => s + zillowVal(a), 0);
  const pureAltsTotal      = pureAlts.reduce((s, a) => s + Number(a.value), 0);
  const peAssetsTotal      = peAssets.reduce((s, a) => s + Number(a.value), 0);
  const cryptoTotal        = cryptoAssets.reduce((s, a) => s + Number(a.value), 0);
  const altInvestsTotal    = altInvests.reduce((s, a) => s + Number(a.value), 0);
  const carryTotal         = carryAlts.reduce((s, a) => s + Number(a.value), 0);
  const rsuTotal           = rsuAlts.reduce((s, a) => s + Number(a.value), 0);
  const otherAltsTotal     = pureAltsTotal + carryTotal + rsuTotal;

  // ── Single source of truth: Investments = public equities + retirement + crypto ──
  // Crypto is not in the growth bucket key but is treated as part of the investments total
  // everywhere (bucket card, detail ledger panel 2, asset overview). Do NOT recompute inline.
  const investmentsTotal = growTotal + cryptoTotal;

  const totalAssetsZillow = opTotal + resTotal + capTotal + growTotal + reTotalZillow + otherAltsTotal;

  const mortgages = liabilities.filter(l => l.type === "mortgage");
  const consumer  = liabilities.filter(l => l.type === "credit_card" || l.type === "student_loan");
  const profLoans = liabilities.filter(l => l.type === "personal_loan");
  const mortTotal = mortgages.reduce((s, l) => s + Number(l.value), 0);
  const consTotal = consumer.reduce((s, l) => s + Number(l.value), 0);
  const profTotal = profLoans.reduce((s, l) => s + Number(l.value), 0);
  const totalLiab = liabilities.reduce((s, l) => s + Number(l.value), 0);
  const netWorth  = totalAssetsZillow - totalLiab;
  const idleAmt   = resCash.filter(a => isIdleAsset(a)).reduce((s, a) => s + Number(a.value), 0);

  const reNetEquity  = reTotalZillow - mortTotal;
  const altNetOfLoan = otherAltsTotal - profTotal;

  // ── Borrowing capacity ────────────────────────────────────────────────────
  const growthEqAmt     = growthEquity.reduce((s, a) => s + Number(a.value), 0);
  const sblCapacity     = Math.round(growthEqAmt * 0.50);          // 50% of eligible equity
  const primaryRE2      = reAssets.find(a => (a.description ?? "").toLowerCase().includes("tribeca")) ?? reAssets[0];
  const primaryVal2     = primaryRE2 ? zillowVal(primaryRE2) : 0;
  const primaryMtg2     = mortgages.find(m => (m.description ?? "").toLowerCase().includes("tribeca")) ?? mortgages[0];
  const primaryMtgBal2  = primaryMtg2 ? Number(primaryMtg2.value) : 0;
  const helocCapacity   = Math.max(0, Math.round(primaryVal2 * 0.80 - primaryMtgBal2));
  const primaryLTV2     = primaryVal2 > 0 ? Math.round((primaryMtgBal2 / primaryVal2) * 100) : 0;
  const totalBorrowCap  = sblCapacity + helocCapacity;

  function reMortgage(a: Asset): Liability | undefined {
    const d = (a.description ?? "").toLowerCase();
    return mortgages.find(m => {
      const md = (m.description ?? "").toLowerCase();
      if (d.includes("tribeca")) return md.includes("tribeca");
      if (d.includes("sarasota")) return md.includes("sarasota");
      return false;
    });
  }

  // ── GURU liquidity-spectrum bucket colors ────────────────────────────────
  const BC = { op: "#1E4F9C", res: "#835800", cap: "#195830", inv: "#4A3FA0", alts: "#5C5C6E", liab: "#9b2020", liabP: "#50287a" };

  // ── Grid columns — 5-col layout keeps account+inst on left, balance+detail on right
  // Col 3 (1fr) is a silent spacer so numbers hug the right margin regardless of screen width
  const AG = "260px 175px 1fr 115px 135px";  // account | institution | spacer | balance | detail
  const LG = "260px 175px 1fr 115px 72px";   // account | institution | spacer | balance | rate
  const thSt = (right?: boolean): React.CSSProperties => ({ fontSize: 9, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "#9B9890", textAlign: right ? "right" : "left" });

  // ── Asset group header (5-col — no tag badges, clean statement style) ──────
  function GroupHead({ color, label, total, memo }: { color: string; label: string; total: number; memo?: string }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: AG, padding: "9px 0", background: "#F5F3EF", borderTop: "1px solid #DAD8D2", borderBottom: "1px solid #E2E0DA", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 7, height: 7, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2A2820" }}>{label}</span>
          {memo && <span style={{ fontSize: 9, color: "#9B9890", fontVariantNumeric: "tabular-nums" }}>{memo}</span>}
        </div>
        <div />{/* institution col */}
        <div />{/* spacer */}
        <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1915", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</div>
        <div />{/* detail col */}
      </div>
    );
  }

  // ── Liability group header (5-col) ────────────────────────────────────────
  function LiabGroupHead({ label, total, color, note }: { label: string; total: number; color: string; note?: string }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: LG, padding: "9px 0", background: "#F5F3EF", borderTop: "1px solid #DAD8D2", borderBottom: "1px solid #E2E0DA", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 7, height: 7, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2A2820" }}>{label}</span>
          {note && <span style={{ fontSize: 9, color: "#9B9890", fontStyle: "italic" }}>{note}</span>}
        </div>
        <div />{/* institution col */}
        <div />{/* spacer */}
        <div style={{ fontSize: 12, fontWeight: 600, color: "#9b2020", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>−{fmt(total)}</div>
        <div />{/* rate col */}
      </div>
    );
  }

  // ── Asset row (5-col) ─────────────────────────────────────────────────────
  function AssetRow({ a, dotColor }: { a: Asset; dotColor?: string }) {
    const meta = acctMeta(a.description ?? "");
    return (
      <div style={{ display: "grid", gridTemplateColumns: AG, paddingTop: 9, paddingBottom: 9, borderBottom: "1px solid #EEECE7", alignItems: "baseline" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: 0, overflow: "hidden" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor ?? "#C5C3BD", flexShrink: 0, marginTop: 3, alignSelf: "flex-start" }} />
          <span style={{ fontSize: 12, color: "#1A1915", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta.name}</span>
          {meta.last4 && <span style={{ fontSize: 10, color: "#B0AEA8", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flexShrink: 0 }}>{meta.last4}</span>}
        </div>
        <div style={{ fontSize: 11, color: "#6B6860" }}>{meta.inst}</div>
        <div />{/* spacer */}
        <div style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: "#1A1915", textAlign: "right" }}>{fmt(Number(a.value))}</div>
        <div style={{ fontSize: 11, color: "#9B9890", textAlign: "right" }}>{meta.insight}</div>
      </div>
    );
  }

  // ── RE expandable row (5-col) ─────────────────────────────────────────────
  function RERow({ a }: { a: Asset }) {
    const zv       = zillowVal(a);
    const addr     = reAddr(a);
    const mtg      = reMortgage(a);
    const isOpen   = expandedRE.has(a.id);
    const d        = (a.description ?? "").toLowerCase();
    const isRental = d.includes("rented") || d.includes("rental") || d.includes("investment, fl");
    const gain     = zv - Number(a.value);
    const gainPct  = ((gain / Number(a.value)) * 100).toFixed(1);
    const propName = d.includes("tribeca") ? "Tribeca Condo" : "Sarasota Property";
    return (
      <React.Fragment>
        <div
          style={{ display: "grid", gridTemplateColumns: AG, paddingTop: 9, paddingBottom: 9, borderBottom: isOpen ? "none" : "1px solid #EEECE7", alignItems: "baseline", cursor: "pointer", background: isOpen ? "#F7F5F0" : undefined }}
          onClick={() => setExpandedRE(prev => { const s = new Set(prev); s.has(a.id) ? s.delete(a.id) : s.add(a.id); return s; })}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 10, color: "#9B9890", flexShrink: 0, userSelect: "none", alignSelf: "center" }}>{isOpen ? "▾" : "▸"}</span>
            <span style={{ fontSize: 12, color: "#1A1915", whiteSpace: "nowrap" }}>{propName}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: isRental ? "#7A5000" : "#1A3F72", letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0 }}>{isRental ? "Rental" : "Primary"}</span>
          </div>
          <div style={{ fontSize: 11, color: "#6B6860", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={addr}>{addr}</div>
          <div />{/* spacer */}
          <div style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: "#1A1915", textAlign: "right" }}>{fmt(zv)}</div>
          <div style={{ fontSize: 10, color: "#3A6FAB", textAlign: "right" }}>Zillow est.</div>
        </div>
        {isOpen && (
          <div style={{ background: "#F7F5F0", borderBottom: "1px solid #DAD8D2", padding: "10px 0 10px 22px" }}>
            <div style={{ display: "flex", gap: 28, fontSize: 11, flexWrap: "wrap" }}>
              <div><span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9B9890" }}>Purchase Price </span><span style={{ fontVariantNumeric: "tabular-nums", color: "#1A1915" }}>{fmt(Number(a.value))}</span></div>
              <div><span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9B9890" }}>Zillow Est. </span><span style={{ fontVariantNumeric: "tabular-nums", color: "#1A1915" }}>{fmt(zv)}</span></div>
              <div><span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#1A5C32" }}>Unrealized Gain </span><span style={{ fontVariantNumeric: "tabular-nums", color: "#1A5C32" }}>+{fmt(gain)} (+{gainPct}%)</span></div>
              {mtg && <div><span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9B9890" }}>Mortgage </span><span style={{ fontVariantNumeric: "tabular-nums", color: "#9b2020" }}>−{fmt(Number(mtg.value))}</span>{" @ "}{Number(mtg.interestRate).toFixed(2)}%</div>}
            </div>
          </div>
        )}
      </React.Fragment>
    );
  }

  // ── Liability row (5-col) ─────────────────────────────────────────────────
  function LiabRow({ l, dim }: { l: Liability; dim?: boolean }) {
    const rate = Number(l.interestRate);
    const d    = (l.description ?? "").toLowerCase();
    const isCommitment = d.includes("commitment") || d.includes("unfunded");
    const rateEl = isCommitment
      ? <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#50287a" }}>Unfunded</span>
      : <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: "#9B9890" }}>{rate % 1 === 0 ? rate.toFixed(0) : rate.toFixed(2)}%</span>;
    const meta = acctMeta(l.description ?? "");
    return (
      <div style={{ display: "grid", gridTemplateColumns: LG, paddingTop: 9, paddingBottom: 9, borderBottom: "1px solid #EEECE7", alignItems: "baseline", opacity: dim ? 0.55 : 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: 0, overflow: "hidden" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#9b2020", flexShrink: 0, marginTop: 3, alignSelf: "flex-start" }} />
          <span style={{ fontSize: 12, color: "#1A1915", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta.name}</span>
          {meta.last4 && <span style={{ fontSize: 10, color: "#B0AEA8", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flexShrink: 0 }}>{meta.last4}</span>}
        </div>
        <div style={{ fontSize: 11, color: "#6B6860" }}>{meta.inst}</div>
        <div />{/* spacer */}
        <div style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: "#9b2020", textAlign: "right" }}>−{fmt(Number(l.value))}</div>
        <div style={{ textAlign: "right" }}>{rateEl}</div>
      </div>
    );
  }

  // ── Section sub-label ─────────────────────────────────────────────────────
  function SectionLabel({ text }: { text: string }) {
    return <div style={{ padding: "5px 0 3px 22px", fontSize: 8, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "#AEACA6" }}>{text}</div>;
  }

  // ── Tracked section divider ───────────────────────────────────────────────
  function TrackedDivider() {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0 8px" }}>
        <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, transparent, #C8C6C0)" }} />
        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "#AEACA6", whiteSpace: "nowrap" }}>Tracked — Outside GURU Model</span>
        <div style={{ flex: 1, height: "1px", background: "linear-gradient(to left, transparent, #C8C6C0)" }} />
      </div>
    );
  }

  // ── Real estate assets with Zillow-adjusted values for card display ──────
  const reAssetsZillow = reAssets.map(a => ({ ...a, value: String(zillowVal(a)) }));

  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "hsl(220,5%,93%)" }}>
      <div style={{ padding: "36px 48px 80px" }}>

        {/* ── HERO BAR — Option C: 50% left title · 2×2 right grid ── */}
        {/* ALIGNMENT RULE: numbers in the same row share the same top baseline.
            Any cell with extra content above its number (e.g. GURU eyebrow) must
            have an invisible spacer of equal height in its paired cell. */}
        <div style={{ display: "grid", gridTemplateColumns: "50% 1fr", alignItems: "stretch", marginBottom: 32, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>

          {/* ── Left: identity strip ── */}
          <div style={{ padding: "16px 40px 16px 0", borderRight: "1px solid rgba(0,0,0,0.08)", display: "flex", flexDirection: "column" as const, justifyContent: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.35)", marginBottom: 6 }}>Financial Model</div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 34, fontWeight: 400, color: "hsl(222,45%,12%)", lineHeight: 1.18, letterSpacing: "-0.02em", marginBottom: 10 }}>Sarah &amp; Michael Kessler</div>
            <div style={{ width: 24, height: 1, background: "rgba(0,0,0,0.12)", marginBottom: 10 }} />
            <div style={{ fontSize: 9, fontWeight: 400, color: "rgba(0,0,0,0.48)", letterSpacing: "0.005em", lineHeight: 1.55 }}>
              A complete view of every account, asset, and obligation — monitored continuously by{" "}
              <span style={{ color: "rgba(71,113,174,0.78)", fontWeight: 500 }}>GURU</span>.
            </div>
          </div>

          {/* ── Right: 2×2 stat grid — target total height ≤160px ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "auto 1fr 1fr" }}>

            {/* Date bar */}
            <div style={{ gridColumn: "1 / -1", padding: "4px 18px", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
              <div style={{ fontSize: 9.5, color: "rgba(0,0,0,0.30)", letterSpacing: "0.03em" }}>As of {format(DEMO_NOW, "MMMM d, yyyy")}</div>
            </div>

            {/* TOP LEFT: Net Worth — 26px, primary stat */}
            <div style={{ padding: "10px 18px", display: "flex", flexDirection: "column" as const, justifyContent: "center", borderBottom: "1px solid rgba(0,0,0,0.07)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>
              {/* spacer matches GURU eyebrow height — keeps numbers on same horizontal line */}
              <div style={{ height: 13, marginBottom: 6 }} />
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.40)", marginBottom: 2 }}>Net Worth</div>
              <div style={{ fontSize: 20, fontWeight: 300, fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.030em", lineHeight: 1, color: "hsl(222,45%,12%)", marginBottom: 3 }}>{fmt(netWorth)}</div>
              <div style={{ fontSize: 9.5, color: "rgba(0,0,0,0.30)" }}>incl. real estate at Zillow estimates</div>
            </div>

            {/* TOP RIGHT: GURU Excess Liquidity — 20px, same tier as assets */}
            <div style={{ padding: "10px 18px", display: "flex", flexDirection: "column" as const, justifyContent: "center", borderBottom: "1px solid rgba(91,143,204,0.18)", background: "rgba(91,143,204,0.06)", borderLeft: "3px solid rgba(91,143,204,0.30)" }}>
              {/* GURU eyebrow — height 13px + mb 6px matches spacer in Net Worth cell */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, height: 13 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(91,143,204,0.75)", flexShrink: 0 }} />
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase" as const, color: "rgba(71,113,174,0.65)" }}>GURU Intelligence</div>
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase" as const, color: "rgba(71,113,174,0.55)", marginBottom: 2 }}>Excess Liquidity Identified</div>
              <div style={{ fontSize: 20, fontWeight: 300, fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.025em", lineHeight: 1, color: "rgba(30,118,68,0.90)", marginBottom: 3 }}>{fmt(idleAmt)}</div>
              <div style={{ fontSize: 9.5, color: "rgba(71,113,174,0.52)", lineHeight: 1.3 }}>Above reserve floor · deployable now</div>
            </div>

            {/* BOTTOM LEFT: Total Assets — 20px, secondary */}
            <div style={{ padding: "10px 18px", display: "flex", flexDirection: "column" as const, justifyContent: "center", borderRight: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.40)", marginBottom: 2 }}>Total Assets</div>
              <div style={{ fontSize: 20, fontWeight: 300, fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.025em", lineHeight: 1, color: "hsl(222,45%,12%)", marginBottom: 3 }}>{fmt(totalAssetsZillow)}</div>
              <div style={{ fontSize: 9.5, color: "rgba(0,0,0,0.30)" }}>{assets.length} positions across all accounts</div>
            </div>

            {/* BOTTOM RIGHT: Total Liabilities — 20px, secondary */}
            <div style={{ padding: "10px 18px", display: "flex", flexDirection: "column" as const, justifyContent: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.40)", marginBottom: 2 }}>Total Liabilities</div>
              <div style={{ fontSize: 20, fontWeight: 300, fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.025em", lineHeight: 1, color: "#9b2020", marginBottom: 3 }}>−{fmt(totalLiab)}</div>
              <div style={{ fontSize: 9.5, color: "rgba(0,0,0,0.30)" }}>{liabilities.length} obligations · {((totalLiab / totalAssetsZillow) * 100).toFixed(1)}% debt-to-asset</div>
            </div>

          </div>
        </div>

        {/* ── BUCKET CARDS — 5 buckets full width ── */}
        {(() => {
          const monthlyExp   = 20939;
          const opFloor      = monthlyExp * 2;
          const resFloor     = monthlyExp * 12;
          const opCoverage   = (opTotal / monthlyExp).toFixed(1);
          const resCoverage  = (resTotal / monthlyExp).toFixed(1);
          const capCoverage  = (capTotal / monthlyExp).toFixed(1);
          const opExcess     = Math.max(0, opTotal - opFloor);
          const resExcess    = Math.max(0, resTotal - resFloor);
          const growthEqAmt  = growthEquity.reduce((s,a)=>s+Number(a.value),0);
          const growthRetAmt = growthRetirement.reduce((s,a)=>s+Number(a.value),0);
          const growthEqPct  = growTotal > 0 ? ((growthEqAmt / growTotal)*100).toFixed(0) : "0";
          const growthRetPct = growTotal > 0 ? ((growthRetAmt / growTotal)*100).toFixed(0) : "0";
          // ── Next-month liquid projection ──
          const nmForecast = (() => {
            if (!cashFlows.length) return null;
            const nm  = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
            const key = format(nm, "MMM yy");
            const d   = buildMonthMap(cashFlows)[key];
            if (!d) return null;
            const net = d.inflow - d.outflow;
            const liquidTotal = opTotal + resTotal + capTotal;
            const label = format(nm, "MMM ''yy");
            return { label, net, opNext: opTotal + net, resNext: resTotal, capNext: capTotal };
          })();
          return (
            <div style={{ marginBottom: 32 }}>

              {/* ── Bucket Cards — all 5 on one row ── */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
                <BSBucketCard
                  color={GURU_BUCKETS.reserve.color} border={`${GURU_BUCKETS.reserve.color}40`}
                  name="Operating Cash"
                  flag={{ label: "Excess Liquidity", type: "warn" }}
                  tagline="Instant and unlimited access for daily expenses and debt payments. At least 2–3 months coverage of expenses."
                  bullets={[
                    "Excess liquidity — currently covering over 6 months of cash expenses.",
                    "Yield could be improved given current balance (see product selection).",
                    "Consider whether the floor target should be raised to reflect current spending.",
                  ]}
                  balance={opTotal}
                  nextBalance={nmForecast?.opNext} nextMonth={nmForecast?.label}
                  stats={[
                    { label: "Coverage",        value: `${opCoverage} mo`,    note: "monthly exp." },
                    { label: "Product",         value: "Checking",             note: "" },
                    { label: "Wtd. Avg. Yield", value: calcWtdYield(opCash),   note: "" },
                    { label: "Floor Target",    value: fmt(opFloor),           note: "2 months exp." },
                    { label: "Excess",          value: fmt(opExcess),          note: "" },
                  ]} />
                <BSBucketCard
                  color={GURU_BUCKETS.yield.color} border={`${GURU_BUCKETS.yield.color}40`}
                  name="Liquidity Reserve"
                  flag={{ label: "Excess Liquidity", type: "warn" }}
                  tagline="Cash on hand for upcoming periods of outflow. Usually 12–18 months of net cash deficit plus a buffer for unanticipated expenditures."
                  bullets={[
                    "Excess liquidity — currently covering over 20 months of net cash outflow.",
                    "Within 12 months a large inflow is expected from an annual bonus.",
                    "Last year unanticipated expenses totaled approximately $120K — worth factoring into the floor.",
                  ]}
                  balance={resTotal}
                  nextBalance={nmForecast?.resNext} nextMonth={nmForecast?.label}
                  stats={[
                    { label: "Coverage",        value: `${resCoverage} mo`,    note: "monthly exp." },
                    { label: "Product",         value: "Savings / T-Bills",    note: "" },
                    { label: "Wtd. Avg. Yield", value: calcWtdYield(resCash),  note: "" },
                    { label: "Floor Target",    value: fmt(resFloor),           note: "trough target" },
                    { label: "Excess",          value: fmt(resExcess),          note: "" },
                  ]} />
                <BSBucketCard
                  color={GURU_BUCKETS.tactical.color} border={`${GURU_BUCKETS.tactical.color}40`}
                  name="Capital Build"
                  flag={{ label: "On Track", type: "ok" }}
                  tagline="Near-term goal (< 5 years) earmarked for a specific large expenditure. Kesslers are targeting a larger home (+$1M) in 2–3 years."
                  bullets={[
                    "On track to have approximately $430K available for a home downpayment by January 2028.",
                    "Strategy is to protect principal while allowing measured growth within the timeline.",
                  ]}
                  balance={capTotal}
                  nextBalance={nmForecast?.capNext} nextMonth={nmForecast?.label}
                  stats={[
                    { label: "Goal",            value: "Primary Home",         note: "2–3 year horizon" },
                    { label: "Target",          value: "$430,000",             note: "downpayment" },
                    { label: "Product",         value: "US Treasuries",        note: "" },
                    { label: "Wtd. Avg. Yield", value: calcWtdYield(capBuild), note: "" },
                    { label: "Maturity",        value: "Mar 2026",             note: "" },
                    { label: "Risk Tolerance",  value: "High",                 note: "" },
                  ]} />
                <BSBucketCard
                  color={GURU_BUCKETS.growth.color} border={`${GURU_BUCKETS.growth.color}40`}
                  name="Investments"
                  flag={{ label: "Concentration Risk", type: "alert" }}
                  tagline="Given the Kesslers' age this is a 10–30 year horizon. Includes taxable brokerage accounts and retirement accounts."
                  bullets={[
                    "Significant concentration in Meta Platforms — single-stock exposure is a meaningful source of risk.",
                    "Cresset managed portfolio provides broad diversification but has not kept pace with recent equity benchmarks.",
                    "Retirement accounts are tax-advantaged but illiquid before age 59½ — factor into near-term planning.",
                  ]}
                  balance={investmentsTotal}
                  stats={[
                    { label: "Equities",        value: fmt(growthEqAmt),  note: "" },
                    { label: "Retirement",      value: fmt(growthRetAmt), note: "401k + Roth" },
                    { label: "Digital Assets",  value: fmt(cryptoTotal),  note: "BTC / ETH" },
                    { label: "Fixed Income",    value: "—",               note: "" },
                    { label: "Risk Tolerance",  value: "Very High",       note: "" },
                  ]} />
                <BSBucketCard
                  color={GURU_BUCKETS.alternatives.color} border={`${GURU_BUCKETS.alternatives.color}40`}
                  name="Other Assets"
                  tagline="Includes real estate, alternative assets, and stock compensation."
                  bullets={[
                    "The priority is accurate valuation and visibility — ensuring the financial picture is complete.",
                    "Managed separately from liquidity planning. Values are estimates based on available market data.",
                  ]}
                  balance={reTotalZillow + otherAltsTotal}
                  stats={[
                    { label: "Real Estate",    value: fmt(reTotalZillow), note: "Zillow est." },
                    { label: "Private Equity", value: fmt(pureAltsTotal), note: "" },
                    { label: "Carry",          value: fmt(carryTotal),    note: "illiquid" },
                    { label: "RSUs",           value: fmt(rsuTotal),      note: "unvested" },
                  ]} />
                {/* Additional Sources of Liquidity notation — spans the 3 liquidity bucket columns */}
                <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 0, border: "0.5px solid rgba(0,0,0,0.07)", overflow: "hidden", background: "#FFFFFF" }}>
                  <div style={{ padding: "7px 14px", borderRight: "1px solid rgba(58,111,171,0.12)", flexShrink: 0 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase" as const, color: "rgba(58,111,171,0.65)" }}>Additional Sources of Liquidity</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 0, flex: 1 }}>
                    <div style={{ padding: "7px 16px", borderRight: "1px solid rgba(58,111,171,0.10)", flex: 1 }}>
                      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.30)", marginBottom: 2 }}>Securities-Based Lending</div>
                      <div style={{ fontSize: 13, fontWeight: 300, fontVariantNumeric: "tabular-nums" as const, color: "hsl(222,45%,18%)", letterSpacing: "-0.01em" }}>{fmt(sblCapacity)} <span style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontWeight: 400 }}>avail. · 50% advance</span></div>
                    </div>
                    <div style={{ padding: "7px 16px", borderRight: "1px solid rgba(58,111,171,0.10)", flex: 1 }}>
                      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.30)", marginBottom: 2 }}>HELOC — Tribeca</div>
                      <div style={{ fontSize: 13, fontWeight: 300, fontVariantNumeric: "tabular-nums" as const, color: "hsl(222,45%,18%)", letterSpacing: "-0.01em" }}>{fmt(helocCapacity)} <span style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontWeight: 400 }}>avail. · {primaryLTV2}% LTV</span></div>
                    </div>
                    <div style={{ padding: "7px 16px", flex: "0 0 auto" }}>
                      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.30)", marginBottom: 2 }}>Combined Capacity</div>
                      <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" as const, color: "hsl(222,45%,18%)", letterSpacing: "-0.01em" }}>{fmt(totalBorrowCap)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Separator between bucket cards and detail tables ── */}
        <div style={{ margin: "20px 0 16px" }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", color: "rgba(0,0,0,0.55)" }}>Account Detail</span>
          <div style={{ marginTop: 6, height: 1, background: "rgba(0,0,0,0.08)" }} />
        </div>

        {/* ── COMBINED LEDGER: ASSETS + LIABILITIES ── */}
        {(() => {
          // Colors matching AssetOvBucketCard exactly — bg: row tint; subtotalBg: stronger tint for C3Total rows
          const TC = {
            op:    { c: GURU_BUCKETS.reserve.color,  bg: `${GURU_BUCKETS.reserve.color}0e`,  subtotalBg: `${GURU_BUCKETS.reserve.color}28`  },
            res:   { c: GURU_BUCKETS.yield.color,    bg: `${GURU_BUCKETS.yield.color}0e`,    subtotalBg: `${GURU_BUCKETS.yield.color}28`    },
            cap:   { c: GURU_BUCKETS.tactical.color, bg: `${GURU_BUCKETS.tactical.color}0e`, subtotalBg: `${GURU_BUCKETS.tactical.color}28` },
            inv:   { c: GURU_BUCKETS.growth.color,   bg: `${GURU_BUCKETS.growth.color}0e`,   subtotalBg: `${GURU_BUCKETS.growth.color}28`   },
            alts:  { c: "#5C5C6E",                   bg: "rgba(92,92,110,0.055)",             subtotalBg: "rgba(92,92,110,0.12)"             },
            liab:  { c: "#9b2020", bg: "rgba(155,32,32,0.055)",  subtotalBg: "rgba(155,32,32,0.09)"  },
            liabP: { c: "#50287a", bg: "rgba(80,40,122,0.055)",  subtotalBg: "rgba(80,40,122,0.09)"  },
          };
          // 5-col asset grid: name | institution | balance | yield/return | comments
          const AG2 = "minmax(0,1fr) 80px 110px 90px minmax(0,140px)";
          // 4-col liability grid: name | balance | rate | collateral
          const LG2 = "minmax(0,1fr) 105px 50px minmax(0,150px)";
          const th2 = (right?: boolean): React.CSSProperties => ({
            fontSize: 7.5, fontWeight: 700, letterSpacing: "0.09em",
            textTransform: "uppercase" as const, color: "rgba(0,0,0,0.28)",
            textAlign: right ? "right" : "left",
          });
          // Account row — indented, tinted, no dot
          const AR2 = ({ a, tc }: { a: Asset; tc: { c: string; bg: string } }) => {
            const meta = acctMeta(a.description ?? "");
            return (
              <div style={{ display: "grid", gridTemplateColumns: AG2, padding: "4px 0 4px 16px", background: tc.bg, borderBottom: "1px solid rgba(0,0,0,0.045)", alignItems: "baseline" }}>
                <div title={meta.name} style={{ fontSize: 11, color: "#1A1915", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {meta.name}
                  {meta.last4 && <span style={{ fontSize: 9, color: "#B0AEA8", marginLeft: 5, fontVariantNumeric: "tabular-nums" }}>{meta.last4}</span>}
                </div>
                <div title={meta.inst} style={{ fontSize: 10.5, color: "#6B6860", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta.inst}</div>
                <div style={{ fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1A1915" }}>{fmt(Number(a.value))}</div>
                <div style={{ fontSize: 10.5, textAlign: "right", color: meta.yield_ && meta.yield_ !== "—" ? "#2a6e3f" : "#9B9890", fontVariantNumeric: "tabular-nums" }}>{meta.yield_}</div>
                <div style={{ fontSize: 10, color: "#9B9890", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: 8 }}>{meta.comment}</div>
              </div>
            );
          };
          // RE row (simplified for narrower grid)
          const RE2 = ({ a }: { a: Asset }) => {
            const zv = zillowVal(a);
            const addr = reAddr(a);
            const d = (a.description ?? "").toLowerCase();
            const isRental = d.includes("rented") || d.includes("rental") || d.includes("investment, fl");
            const propName = d.includes("tribeca") ? "Tribeca Condo" : "Sarasota Property";
            const reYield = d.includes("tribeca") ? "+4.2% (1yr)" : "+6.1% (1yr)";
            return (
              <div style={{ display: "grid", gridTemplateColumns: AG2, padding: "4px 0 4px 16px", background: TC.alts.bg, borderBottom: "1px solid rgba(0,0,0,0.045)", alignItems: "baseline" }}>
                <div style={{ fontSize: 11, color: "#1A1915", display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                  <span title={propName} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{propName}</span>
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: isRental ? "#7A5000" : "#1A3F72", letterSpacing: "0.05em", textTransform: "uppercase" as const, flexShrink: 0 }}>{isRental ? "Rental" : "Primary"}</span>
                </div>
                <div style={{ fontSize: 10.5, color: "#6B6860", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={addr}>{addr}</div>
                <div style={{ fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1A1915" }}>{fmt(zv)}</div>
                <div style={{ fontSize: 10.5, textAlign: "right", color: "#2a6e3f", fontVariantNumeric: "tabular-nums" }}>{reYield}</div>
                <div style={{ fontSize: 10, color: "#3A6FAB", paddingLeft: 8 }}>Zillow est. · {isRental ? "Rental" : "Primary"}</div>
              </div>
            );
          };
          // Bucket subtotal — BELOW accounts, bigger font, colored label
          const BktTotal = ({ tc, label, total, note }: { tc: { c: string; bg: string }; label: string; total: number; note?: string }) => (
            <div style={{ display: "grid", gridTemplateColumns: AG2, padding: "5px 0 5px 0", borderTop: "1px solid #DAD8D2", borderBottom: "2px solid #E4E2DC", marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: tc.c, letterSpacing: "0.04em", textTransform: "uppercase" as const, display: "flex", alignItems: "baseline", gap: 8 }}>
                {label}
                {note && <span style={{ fontSize: 9, fontWeight: 400, color: "#9B9890", textTransform: "none" as const, letterSpacing: 0 }}>{note}</span>}
              </div>
              <div />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1915", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</div>
              <div />
              <div />
            </div>
          );
          // Liability account row
          const LR2 = ({ l, tc, dim }: { l: Liability; tc: { c: string; bg: string }; dim?: boolean }) => {
            const rate = Number(l.interestRate);
            const d = (l.description ?? "").toLowerCase();
            const isCommit = d.includes("commitment") || d.includes("unfunded");
            const meta = acctMeta(l.description ?? "");
            return (
              <div style={{ display: "grid", gridTemplateColumns: LG2, padding: "6px 0 6px 16px", background: tc.bg, borderBottom: "1px solid rgba(0,0,0,0.045)", alignItems: "baseline", opacity: dim ? 0.55 : 1 }}>
                <div style={{ fontSize: 11, color: "#1A1915", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {meta.name}
                  {meta.last4 && <span style={{ fontSize: 9, color: "#B0AEA8", marginLeft: 5, fontVariantNumeric: "tabular-nums" }}>{meta.last4}</span>}
                </div>
                <div style={{ fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#9b2020" }}>−{fmt(Number(l.value))}</div>
                <div style={{ textAlign: "right" }}>
                  {isCommit
                    ? <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "#50287a" }}>Unfunded</span>
                    : <span style={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums", color: "#9B9890" }}>{rate % 1 === 0 ? rate.toFixed(0) : rate.toFixed(2)}%</span>}
                </div>
                <div style={{ fontSize: 10, color: "#9B9890", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: 8 }}>{meta.collateral}</div>
              </div>
            );
          };
          // Liability subtotal — BELOW accounts
          const LTotal = ({ tc, label, total, note }: { tc: { c: string; bg: string }; label: string; total: number; note?: string }) => (
            <div style={{ display: "grid", gridTemplateColumns: LG2, padding: "7px 0 8px 0", borderTop: "1px solid #DAD8D2", borderBottom: "2px solid #E4E2DC", marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: tc.c, letterSpacing: "0.04em", textTransform: "uppercase" as const, display: "flex", alignItems: "baseline", gap: 8 }}>
                {label}
                {note && <span style={{ fontSize: 9, fontWeight: 400, color: "#9B9890", textTransform: "none" as const, letterSpacing: 0 }}>{note}</span>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#9b2020", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>−{fmt(total)}</div>
              <div />
              <div />
            </div>
          );
          const SubLabel = ({ text }: { text: string }) => (
            <div style={{ padding: "4px 0 2px 16px", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "#C0BEB8" }}>{text}</div>
          );

          // ── Embedded liability row — uses AG2 grid so columns align with asset rows ──
          const EmbeddedLiab = ({ l, tc }: { l: Liability; tc: { c: string; bg: string } }) => {
            const rate = Number(l.interestRate);
            const d = (l.description ?? "").toLowerCase();
            const isCommit = d.includes("commitment") || d.includes("unfunded");
            const meta = acctMeta(l.description ?? "");
            return (
              <div style={{ display: "grid", gridTemplateColumns: AG2, padding: "4px 0 4px 24px", background: "rgba(155,32,32,0.032)", borderBottom: "1px solid rgba(155,32,32,0.07)", alignItems: "baseline" }}>
                <div style={{ fontSize: 11, color: "#9b2020", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {meta.name}
                  {meta.last4 && <span style={{ fontSize: 9, color: "#B0AEA8", marginLeft: 5, fontVariantNumeric: "tabular-nums" }}>{meta.last4}</span>}
                </div>
                <div style={{ fontSize: 10.5, color: "#6B6860", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta.inst}</div>
                <div style={{ fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#9b2020" }}>−{fmt(Number(l.value))}</div>
                <div style={{ textAlign: "right" }}>
                  {isCommit
                    ? <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "#50287a" }}>Unfunded</span>
                    : <span style={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums", color: "#9B9890" }}>{rate % 1 === 0 ? rate.toFixed(0) : rate.toFixed(2)}%</span>}
                </div>
                <div style={{ fontSize: 10, color: "#9B9890", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: 8 }}>{meta.collateral}</div>
              </div>
            );
          };

          // ── Embedded liability subtotal ──
          const EmbeddedLiabTotal = ({ label, total, note }: { label: string; total: number; note?: string }) => (
            <div style={{ display: "grid", gridTemplateColumns: AG2, padding: "5px 0 5px 0", borderTop: "1px solid rgba(155,32,32,0.14)", borderBottom: "2px solid rgba(155,32,32,0.16)", marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9b2020", letterSpacing: "0.04em", textTransform: "uppercase" as const, display: "flex", alignItems: "baseline", gap: 8 }}>
                {label}
                {note && <span style={{ fontSize: 9, fontWeight: 400, color: "#9B9890", textTransform: "none" as const, letterSpacing: 0 }}>{note}</span>}
              </div>
              <div />
              <div style={{ fontSize: 13, fontWeight: 600, color: "#9b2020", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>−{fmt(total)}</div>
              <div /><div />
            </div>
          );

          // ── Shared column headers ──
          const ColHeader = () => (
            <div style={{ display: "grid", gridTemplateColumns: AG2, padding: "4px 0 4px 16px", borderBottom: "1px solid #DAD8D2", background: "rgba(0,0,0,0.012)" }}>
              <div style={th2()}>Account</div>
              <div style={th2()}>Institution</div>
              <div style={th2(true)}>Balance</div>
              <div style={th2(true)}>Yield / Return</div>
              <div style={{ ...th2(), paddingLeft: 8 }}>Comments</div>
            </div>
          );
          const ObligColHeader = () => (
            <div style={{ display: "grid", gridTemplateColumns: AG2, padding: "3px 0 3px 24px", background: "rgba(155,32,32,0.022)" }}>
              <div style={th2()}>Obligation</div>
              <div style={th2()}>Lender</div>
              <div style={th2(true)}>Balance</div>
              <div style={th2(true)}>Rate</div>
              <div style={{ ...th2(), paddingLeft: 8 }}>Collateral</div>
            </div>
          );

          // ── Obligations section divider ──
          const ObligDivider = ({ label }: { label: string }) => (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 16px", background: "rgba(155,32,32,0.04)", borderTop: "1px solid rgba(155,32,32,0.09)", borderBottom: "1px solid rgba(155,32,32,0.09)" }}>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase" as const, color: "rgba(155,32,32,0.55)" }}>↳ {label}</span>
            </div>
          );

          // ── Net position footer ──
          const NetRow = ({ label, amount }: { label: string; amount: number }) => (
            <div style={{ display: "grid", gridTemplateColumns: AG2, padding: "8px 16px", background: "#F0EEE8", borderTop: "2px solid #DAD8D2" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#1A1915" }}>{label}</div>
              <div /><div style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.025em", color: amount < 0 ? "#9b2020" : "#1A1915", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(amount)}</div>
              <div /><div />
            </div>
          );

          // ── Table header band ──
          const TableBand = ({ title, gross, netLabel, net, tc }: { title: string; gross: number; netLabel: string; net: number; tc: { c: string; bg: string } }) => (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 16px", background: tc.bg, borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: tc.c }}>{title}</span>
              <div style={{ display: "flex", gap: 28, alignItems: "baseline" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.35)", marginBottom: 2 }}>Gross</div>
                  <div style={{ fontSize: 16, fontVariantNumeric: "tabular-nums", color: "#3A3830" }}>{fmt(gross)}</div>
                </div>
                <div style={{ width: 1, height: 28, background: "rgba(0,0,0,0.12)" }} />
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: tc.c, marginBottom: 2 }}>{netLabel}</div>
                  <div style={{ fontSize: 18, fontWeight: 300, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.022em", color: net < 0 ? "#9b2020" : tc.c }}>{fmt(net)}</div>
                </div>
              </div>
            </div>
          );

          // ── Compact 3-panel row components ──
          // Panel 1 (Liquid Assets) — 6-col: Account | Balance | Next Mo. | Pre-Tax Yield | After-Tax Yield | Notes
          // Panels 2 & 3 — 4-col via g={C3B}: Account | Balance | Yield/Return | Notes
          const C3L = "minmax(200px,1fr) 82px 76px 62px 58px minmax(0,88px)"; // 6-col default (Panel 1)
          const C3B = "minmax(200px,1fr) 82px 72px minmax(0,100px)";           // 4-col (Panels 2 & 3)
          const c3th = (right?: boolean): React.CSSProperties => ({
            fontSize: 9, fontWeight: 700, letterSpacing: "0.09em",
            textTransform: "uppercase" as const, color: "rgba(0,0,0,0.30)",
            textAlign: right ? "right" : "left",
          });
          // ── Column headers
          const C3Header = ({ showNext = false, g }: { showNext?: boolean; g?: string }) => (
            <>
              {/* Parent "Yield / Return" label row — spans Pre-Tax + After-Tax cols */}
              {!g && (
                <div style={{ display: "grid", gridTemplateColumns: C3L, background: "#F3F2EF", borderBottom: "0.5px solid #E8E6E0" }}>
                  <div /><div /><div />
                  <div style={{ gridColumn: "4 / 6", textAlign: "center", fontSize: 7.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#9B9890", padding: "3px 8px" }}>Yield / Return</div>
                  <div />
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: g ?? C3L, padding: "4px 0 4px 0", minHeight: 28, alignItems: "end", borderBottom: "1px solid #E8E6E0", background: "#F7F6F4" }}>
                <div style={{ ...c3th(), paddingLeft: 12 }}>Account</div>
                <div style={c3th(true)}>Balance</div>
                {!g && <div style={{ ...c3th(true), color: showNext ? "rgba(0,0,0,0.30)" : "transparent" }}>Next Mo.</div>}
                {!g && <div style={{ ...c3th(true) }}>Pre-Tax</div>}
                <div style={{ ...c3th(true), paddingRight: 0 }}>{!g ? "After-Tax" : "Yield / Return"}</div>
                <div style={{ ...c3th(true), paddingRight: 8 }}>Notes</div>
              </div>
            </>
          );
          // ── Section divider (Equities, Retirement, etc.)
          const C3SubLabel = ({ text }: { text: string }) => (
            <div style={{ padding: "4px 0 3px 12px", fontSize: 7.5, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase" as const, color: "#B8B6B0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>{text}</div>
          );
          // ── Account row — indented name, balance stays flush with subtotals
          const C3Row = ({ a, tc, instMode, g, nextVal }: { a: Asset; tc: { c: string; bg: string }; instMode?: boolean; g?: string; nextVal?: number }) => {
            const meta = acctMeta(a.description ?? "");
            const displayName = instMode && meta.inst ? meta.inst : meta.name;
            const noteText    = instMode ? (meta.insight || meta.comment) : meta.comment;
            const isAdvisor   = instMode && meta.insight?.toLowerCase().includes("advisor");
            const isSingle    = instMode && meta.insight?.toLowerCase().includes("single");
            const hasFlag     = !!noteText;
            const atY = !g ? calcAtYield(a) : null;
            return (
              <div style={{ display: "grid", gridTemplateColumns: g ?? C3L, padding: "5px 0", minHeight: 30, background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center" }}>
                <div style={{ minWidth: 0, paddingLeft: 20 }}>
                  <div style={{ fontSize: 10.5, color: "#1A1915", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {displayName}{meta.last4 && <span style={{ fontSize: 8.5, color: "#B0AEA8", marginLeft: 4 }}>{meta.last4}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1A1915" }}>{fmt(Number(a.value))}</div>
                {!g && <div style={{ fontSize: 11.5, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "rgba(0,0,0,0.32)" }}>{nextVal !== undefined ? fmt(nextVal) : ""}</div>}
                {!g && <div style={{ fontSize: 10, textAlign: "right", color: meta.yield_ && meta.yield_ !== "—" ? "#4a7a5a" : "#9B9890", fontVariantNumeric: "tabular-nums" }}>{meta.yield_}</div>}
                <div style={{ fontSize: 10, textAlign: "right", color: atY && atY !== "—" ? "#2a6e3f" : "#9B9890", fontVariantNumeric: "tabular-nums" }}>{!g ? atY : meta.yield_}</div>
                <div style={{ paddingLeft: 6, paddingRight: 8, textAlign: "right" }}>
                  {hasFlag && <span style={{ fontSize: 9, fontWeight: 600, lineHeight: 1.3, display: "block", textAlign: "right",
                    color: isAdvisor ? "#1a5c8f"
                         : isSingle  ? "#9b2020"
                         : noteText?.includes("Excess") || noteText?.includes("deployable") || noteText?.includes("Below potential") ? "rgba(154,123,60,0.85)"
                         : noteText?.includes("risk") || noteText?.includes("volat") || noteText?.includes("Concentration") ? "#9b2020"
                         : noteText?.includes("Illiquid") || noteText?.includes("Unvested") || noteText?.includes("restriction") ? "#7A5C2A"
                         : noteText?.includes("Maturing") ? "#1a5c8f"
                         : "#6B6860" }}>{noteText}</span>}
                </div>
              </div>
            );
          };
          // ── Bucket subtotal — LARGER than account rows, full-width, prominent
          const C3Total = ({ tc, label, total, nextTotal, note, wtdYield: wty, wtdAtYield: waty, items, g }: { tc: { c: string; bg: string; subtotalBg?: string }; label: string; total: number; nextTotal?: number; note?: string; wtdYield?: string; wtdAtYield?: string; items?: Asset[]; g?: string }) => {
            const atY = !g && items ? calcWtdAtYield(items) : (waty ?? "");
            return (
              <div style={{ display: "grid", gridTemplateColumns: g ?? C3L, padding: "5px 0", borderTop: "1px solid #E8E6E0", borderBottom: "1px solid #E8E6E0", background: (tc as any).subtotalBg ?? "#F7F6F4", marginBottom: 2 }}>
                <div style={{ paddingLeft: 12, fontSize: 10.5, fontWeight: 700, color: tc.c, letterSpacing: "0.03em", textTransform: "uppercase" as const, display: "flex", alignItems: "baseline", gap: 6 }}>
                  {label}
                  {note && <span style={{ fontSize: 8.5, fontWeight: 400, color: "#9B9890", textTransform: "none" as const, letterSpacing: 0 }}>{note}</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1915", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</div>
                {!g && <div style={{ fontSize: 11, fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "rgba(0,0,0,0.32)" }}>
                  {nextTotal !== undefined ? fmt(nextTotal) : ""}
                </div>}
                {!g && <div style={{ fontSize: 9.5, textAlign: "right", color: wty ? "#4a7a5a" : "transparent", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{wty ?? ""}</div>}
                <div style={{ fontSize: 9.5, textAlign: "right", color: (!g ? atY : wty) ? "#2a6e3f" : "transparent", fontVariantNumeric: "tabular-nums", fontWeight: 500, paddingRight: 2 }}>{!g ? atY : (wty ?? "")}</div>
                <div />
              </div>
            );
          };
          // ── Liability row — slightly more indented (under obligations divider)
          const C3LiabRow = ({ l, g }: { l: Liability; g?: string }) => {
            const rate = Number(l.interestRate);
            const d = (l.description ?? "").toLowerCase();
            const isCommit = d.includes("commitment") || d.includes("unfunded");
            const meta = acctMeta(l.description ?? "");
            return (
              <div style={{ display: "grid", gridTemplateColumns: g ?? C3L, padding: "5px 0", minHeight: 30, background: "rgba(155,32,32,0.028)", borderBottom: "1px solid rgba(155,32,32,0.06)", alignItems: "center" }}>
                <div style={{ minWidth: 0, paddingLeft: 20 }}>
                  <div style={{ fontSize: 10.5, color: "#9b2020", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {meta.name}{meta.last4 && <span style={{ fontSize: 8.5, color: "#B0AEA8", marginLeft: 4 }}>{meta.last4}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#9b2020" }}>−{fmt(Number(l.value))}</div>
                {!g && <div />}{/* next month — empty for liabilities */}
                {!g && <div />}{/* After-Tax yield — empty for liabilities */}
                <div style={{ textAlign: "right" }}>
                  {!isCommit && <span style={{ fontSize: 10, color: "#9B9890", fontVariantNumeric: "tabular-nums" }}>{rate.toFixed(2)}%</span>}
                </div>
                <div style={{ fontSize: 9.5, color: "#9B9890", lineHeight: 1.3, paddingLeft: 6, paddingRight: 8 }}>{l.type === "mortgage" ? meta.collateral : ""}</div>
              </div>
            );
          };
          // ── Liability subtotal
          const C3LiabTotal = ({ label, total, g }: { label: string; total: number; g?: string }) => (
            <div style={{ display: "grid", gridTemplateColumns: g ?? C3L, padding: "5px 0", borderTop: "1.5px solid rgba(155,32,32,0.2)", borderBottom: "2px solid rgba(155,32,32,0.18)", background: "rgba(155,32,32,0.018)", marginBottom: 2 }}>
              <div style={{ paddingLeft: 12, fontSize: 10.5, fontWeight: 700, color: "#9b2020", letterSpacing: "0.03em", textTransform: "uppercase" as const }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#9b2020", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>−{fmt(total)}</div>
              {!g && <div />}{/* next month */}
              {!g && <div />}{/* after-tax yield */}
              <div /><div />
            </div>
          );
          // ── Obligations section divider
          const C3ObligDiv = ({ label }: { label: string }) => (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 12px", background: "rgba(155,32,32,0.05)", borderTop: "1px solid rgba(155,32,32,0.10)" }}>
              <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(155,32,32,0.55)" }}>↳ {label}</span>
            </div>
          );
          // ── Two-row panel footer — Total Assets + Net position, both grid-aligned
          const C3NetRow = ({ grossLabel, gross, netLabel, net, nextNet, g }: { grossLabel: string; gross: number; netLabel: string; net: number; nextNet?: number; g?: string }) => (
            <div style={{ borderTop: "2px solid #D8D6D0", background: "#F7F6F4", marginBottom: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: g ?? C3L, padding: "5px 12px 3px" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#1A1915", letterSpacing: "0.03em", textTransform: "uppercase" as const }}>{grossLabel}</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#1A1915", textAlign: "right" }}>{fmt(gross)}</span>
                {!g ? <><div /><div /><div /><div /></> : <><div /><div /></>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: g ?? C3L, padding: "3px 12px 7px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#2A2820", letterSpacing: "0.03em", textTransform: "uppercase" as const }}>{netLabel}</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: net < 0 ? "#9b2020" : "#1A1915", textAlign: "right" }}>{fmt(net)}</span>
                {!g && <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "rgba(0,0,0,0.32)", textAlign: "right" }}>
                  {nextNet !== undefined ? fmt(nextNet) : ""}
                </span>}
                {!g && <div />}
                <div /><div />
              </div>
            </div>
          );
          // ── Panel header band — card-style number
          const C3Band = ({ title, netLabel, net, tc }: { title: string; netLabel: string; net: number; tc: { c: string; bg: string } }) => (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: tc.bg, borderBottom: `2px solid ${tc.c}30` }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: tc.c }}>{title}</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.35)", marginBottom: 2 }}>{netLabel}</div>
                <div style={{ fontSize: 18, fontWeight: 300, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em", color: net < 0 ? "#9b2020" : "#1A1915", lineHeight: 1 }}>{fmt(net)}</div>
              </div>
            </div>
          );
          // ── Real estate row with mortgage + NAV inline
          const C3ReWithMort = ({ a, g }: { a: Asset; g?: string }) => {
            const d = (a.description ?? "").toLowerCase();
            const isTribeca = d.includes("tribeca");
            const propMort = mortgages.find(l => (l.description ?? "").toLowerCase().includes(isTribeca ? "tribeca" : "sarasota"));
            const zv = zillowVal(a);
            const mortAmt = propMort ? Number(propMort.value) : 0;
            const propNav = zv - mortAmt;
            const addr = reAddr(a);
            const isRental = d.includes("rented") || d.includes("rental") || d.includes("investment, fl");
            const propName = isTribeca ? "Tribeca Condo" : "Sarasota Property";
            // Pre-tax return on equity: 1yr appreciation (%) × current value ÷ NAV
            const reYieldBasePct = isTribeca ? 0.042 : 0.061;
            const reProfit = zv * reYieldBasePct;
            const navReturnPct = propNav > 0 ? `+${((reProfit / propNav) * 100).toFixed(1)}%` : "—";
            const mortMeta = propMort ? acctMeta(propMort.description ?? "") : null;
            const gc = g ?? C3L;
            return (
              <React.Fragment>
                {/* Property row — address inline to the right of name */}
                <div style={{ display: "grid", gridTemplateColumns: gc, padding: "5px 0", minHeight: 30, background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center" }}>
                  <div style={{ minWidth: 0, paddingLeft: 20, overflow: "hidden" }}>
                    <div style={{ fontSize: 10.5, color: "#1A1915", display: "flex", alignItems: "baseline", gap: 5, overflow: "hidden" }}>
                      <span style={{ whiteSpace: "nowrap", flexShrink: 0, color: "#1A1915" }}>{propName}</span>
                      <span style={{ fontSize: 10.5, color: "#9B9890", flexShrink: 0 }}>({isRental ? "rental" : "primary"})</span>
                      <span style={{ fontSize: 9, color: "#B0AEA8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{addr}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1A1915" }}>{fmt(zv)}</div>
                  {!g && <div />}{/* next month */}
                  <div style={{ fontSize: 10, textAlign: "right", color: "#2a6e3f", fontVariantNumeric: "tabular-nums" }}>{navReturnPct}</div>
                  <div style={{ fontSize: 9, color: "#3A6FAB", paddingLeft: 6, paddingRight: 8, textAlign: "right" }}>Zillow est.</div>
                </div>
                {/* Mortgage row — label: "Mortgage" */}
                {propMort && (
                  <div style={{ display: "grid", gridTemplateColumns: gc, padding: "5px 0", minHeight: 30, background: "rgba(155,32,32,0.028)", borderBottom: "1px solid rgba(155,32,32,0.06)", alignItems: "center" }}>
                    <div style={{ minWidth: 0, paddingLeft: 28 }}>
                      <div style={{ fontSize: 10, color: "#9b2020", display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: 8, color: "rgba(155,32,32,0.4)", flexShrink: 0 }}>↳</span>
                        <span>Mortgage</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11.5, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#9b2020" }}>−{fmt(Number(propMort.value))}</div>
                    {!g && <div />}{/* next month */}
                    <div style={{ fontSize: 10, textAlign: "right", color: "#9B9890", fontVariantNumeric: "tabular-nums" }}>{Number(propMort.interestRate).toFixed(2)}%</div>
                    <div style={{ fontSize: 9, color: "#9B9890", paddingLeft: 6, paddingRight: 8, textAlign: "right" }}>30-yr fixed</div>
                  </div>
                )}
                {/* Net Asset Value row */}
                <div style={{ display: "grid", gridTemplateColumns: gc, padding: "5px 0", background: "rgba(0,0,0,0.022)", borderBottom: "2px solid #E0DED8" }}>
                  <div style={{ paddingLeft: 20, fontSize: 10, fontWeight: 700, color: "#3A3830", letterSpacing: "0.02em" }}>{propName} · Net Asset Value</div>
                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums", color: propNav >= 0 ? "#1A6640" : "#9b2020" }}>{propNav >= 0 ? fmt(propNav) : `−${fmt(-propNav)}`}</div>
                  {!g && <div />}<div /><div />
                </div>
              </React.Fragment>
            );
          };

          // ── PE fund row with pro-rata liability allocation ─────────────────────
          // Splits all profLoans pro-rata by fund value / total PE value,
          // then shows each allocated slice inline under the fund row.
          const C3PEWithAlloc = ({ a, g }: { a: Asset; g?: string }) => {
            const fundVal  = Number(a.value);
            const meta     = acctMeta(a.description ?? "");
            const share    = peAssetsTotal > 0 ? fundVal / peAssetsTotal : 0;
            const d        = (a.description ?? "").toLowerCase();
            const fundName = d.includes("viii") ? "Carlyle VIII" : d.includes("ix") ? "Carlyle IX" : meta.name;
            const fundNav  = fundVal - Math.round(profTotal * share);
            const gc = g ?? C3L;
            return (
              <React.Fragment>
                {/* Fund row — white, no tint */}
                <div style={{ display: "grid", gridTemplateColumns: gc, padding: "5px 0", minHeight: 30, background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.04)", alignItems: "center" }}>
                  <div style={{ minWidth: 0, paddingLeft: 20 }}>
                    <div style={{ fontSize: 10.5, color: "#1A1915", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {meta.name}{meta.last4 && <span style={{ fontSize: 8.5, color: "#B0AEA8", marginLeft: 4 }}>{meta.last4}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1A1915" }}>{fmt(fundVal)}</div>
                  {!g && <div />}{/* next month */}
                  <div style={{ fontSize: 10, textAlign: "right", color: "#2a6e3f", fontVariantNumeric: "tabular-nums" }}>{meta.yield_}</div>
                  <div />
                </div>
                {/* Allocated liabilities — one row per profLoan */}
                {profLoans.map((l, i) => {
                  const lMeta   = acctMeta(l.description ?? "");
                  const alloc   = Math.round(Number(l.value) * share);
                  const rate    = Number(l.interestRate);
                  const isCommit = (l.description ?? "").toLowerCase().includes("commitment") || (l.description ?? "").toLowerCase().includes("unfunded");
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: gc, padding: "5px 0", minHeight: 30, background: "rgba(155,32,32,0.028)", borderBottom: "1px solid rgba(155,32,32,0.06)", alignItems: "center" }}>
                      <div style={{ minWidth: 0, paddingLeft: 28 }}>
                        <div style={{ fontSize: 10, color: "#9b2020", display: "flex", alignItems: "baseline", gap: 4, overflow: "hidden" }}>
                          <span style={{ fontSize: 8, color: "rgba(155,32,32,0.4)", flexShrink: 0 }}>↳</span>
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lMeta.name}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 11.5, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#9b2020" }}>−{fmt(alloc)}</div>
                      {!g && <div />}{/* next month */}
                      <div style={{ textAlign: "right" }}>
                        {!isCommit && <span style={{ fontSize: 10, color: "#9B9890", fontVariantNumeric: "tabular-nums" }}>{rate.toFixed(2)}%</span>}
                      </div>
                      <div />
                    </div>
                  );
                })}
                {/* Net equity row */}
                <div style={{ display: "grid", gridTemplateColumns: gc, padding: "5px 0", background: "rgba(0,0,0,0.022)", borderBottom: "2px solid #E0DED8" }}>
                  <div style={{ paddingLeft: 20, fontSize: 10, fontWeight: 700, color: "#3A3830", letterSpacing: "0.02em" }}>{fundName} · Net Equity</div>
                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums", color: fundNav >= 0 ? "#1A6640" : "#9b2020" }}>{fundNav >= 0 ? fmt(fundNav) : `−${fmt(-fundNav)}`}</div>
                  {!g && <div />}<div /><div />
                </div>
              </React.Fragment>
            );
          };

          // ── Net calculations ──
          const growthEqAmt    = growthEquity.reduce((s, a) => s + Number(a.value), 0);
          const growthRetAmt   = growthRetirement.reduce((s, a) => s + Number(a.value), 0);
          const liquidGross    = opTotal + resTotal + capTotal;
          const netLiquid      = liquidGross - consTotal;
          // Panel 2: Investments = investmentsTotal (single source of truth — see definition above)
          const lt2Net         = investmentsTotal;
          // Panel 3: Other Assets = real estate (net of mortgages) + PE (net of pro-rata loans) + alt investments + carry + RSUs
          const otherAssetsNet = reTotalZillow - mortTotal + (peAssetsTotal - profTotal) + altInvestsTotal + carryTotal + rsuTotal;
          const netLongTerm    = lt2Net + otherAssetsNet;

          // ── Next-month liquid projection ──
          const nextMonthForecast = (() => {
            if (!cashFlows.length) return null;
            const now = new Date();
            const nm  = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const key = format(nm, "MMM yy");
            const map = buildMonthMap(cashFlows);
            const d   = map[key];
            if (!d) return null;
            const net = d.inflow - d.outflow;
            return { month: format(nm, "MMM yyyy"), net, balance: netLiquid + net };
          })();

          return (
            <div style={{ marginBottom: 32, overflowX: "auto", paddingBottom: 4 }}>
              {/* ══ THREE-PANEL LEDGER ══ */}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(590px,1.35fr) minmax(454px,1fr) minmax(454px,1fr)", gap: 14, alignItems: "start", minWidth: 1510 }}>

                {/* ── PANEL 1: LIQUID ASSETS ── */}
                <div style={{ border: "1px solid #D8D6D0", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <C3Band title="Liquid Assets" netLabel="Net Liquid" net={netLiquid} tc={TC.res} />
                  <C3Header showNext />
                  {opCash.map((a, i) => <C3Row key={i} a={a} tc={TC.op} nextVal={nextMonthForecast && opTotal > 0 ? Math.round(Number(a.value) + nextMonthForecast.net * (Number(a.value) / opTotal)) : undefined} />)}
                  <C3Total tc={TC.op} label="Operating Cash" total={opTotal} nextTotal={nextMonthForecast ? opTotal + nextMonthForecast.net : undefined} wtdYield={calcWtdYield(opCash)} items={opCash} />
                  {resCash.map((a, i) => <C3Row key={i} a={a} tc={TC.res} nextVal={nextMonthForecast ? Number(a.value) : undefined} />)}
                  <C3Total tc={TC.res} label="Liquidity Reserve" total={resTotal} nextTotal={nextMonthForecast ? resTotal : undefined} wtdYield={calcWtdYield(resCash)} items={resCash} />
                  {capBuild.map((a, i) => <C3Row key={i} a={a} tc={TC.cap} nextVal={nextMonthForecast ? Number(a.value) : undefined} />)}
                  <C3Total tc={TC.cap} label="Capital Build" total={capTotal} nextTotal={nextMonthForecast ? capTotal : undefined} wtdYield={calcWtdYield(capBuild)} items={capBuild} />
                  <C3ObligDiv label="Unsecured Obligations" />
                  {consumer.map((l, i) => <C3LiabRow key={i} l={l} />)}
                  <C3LiabTotal label="Credit Cards & Loans" total={consTotal} />
                  <C3NetRow grossLabel="Total Liquid Assets" gross={liquidGross} netLabel="Net Liquid Position" net={netLiquid} nextNet={nextMonthForecast?.balance} />
                </div>

                {/* ── PANEL 2: INVESTMENTS ── */}
                <div style={{ border: "1px solid #D8D6D0", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <C3Band title="Investments" netLabel="Net Investments" net={lt2Net} tc={TC.inv} />
                  <C3Header g={C3B} />
                  {growthEquity.length > 0 && <C3SubLabel text="Taxable Brokerage" />}
                  {growthEquity.map((a, i) => <C3Row key={i} a={a} tc={TC.inv} instMode g={C3B} />)}
                  {growthEquity.length > 0 && <C3Total tc={TC.inv} label="Taxable Brokerage" total={growthEqAmt} wtdYield={calcWtdYield(growthEquity)} g={C3B} />}
                  {growthRetirement.length > 0 && <C3SubLabel text="Retirement Accounts" />}
                  {growthRetirement.map((a, i) => <C3Row key={i} a={a} tc={TC.inv} instMode g={C3B} />)}
                  {growthRetirement.length > 0 && <C3Total tc={TC.inv} label="Retirement Accounts" total={growthRetAmt} wtdYield={calcWtdYield(growthRetirement)} g={C3B} />}
                  {cryptoAssets.length > 0 && <>
                    <C3SubLabel text="Digital Assets" />
                    {cryptoAssets.map((a, i) => <C3Row key={i} a={a} tc={TC.inv} g={C3B} />)}
                    <C3Total tc={TC.inv} label="Digital Assets" total={cryptoTotal} wtdYield={calcWtdYield(cryptoAssets)} g={C3B} />
                  </>}
                  <C3NetRow grossLabel="Total Investments" gross={lt2Net} netLabel="Net Investments" net={lt2Net} g={C3B} />
                </div>

                {/* ── PANEL 3: OTHER ASSETS ── */}
                <div style={{ border: "1px solid #D8D6D0", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <C3Band title="Other Assets" netLabel="Net Other Assets" net={otherAssetsNet} tc={TC.alts} />
                  <C3Header g={C3B} />
                  {reAssets.length > 0 && <C3SubLabel text="Real Estate" />}
                  {reAssets.map((a, i) => <C3ReWithMort key={i} a={a} g={C3B} />)}
                  {reAssets.length > 0 && <C3Total tc={TC.alts} label="Real Estate" total={reTotalZillow} note={`net eq. ${fmt(reNetEquity)}`} g={C3B} />}
                  {peAssets.length > 0 && <C3SubLabel text="Private Equity" />}
                  {peAssets.map((a, i) => <C3PEWithAlloc key={i} a={a} g={C3B} />)}
                  {peAssets.length > 0 && <C3Total tc={TC.alts} label="Private Equity" total={peAssetsTotal - profTotal} note="net equity" wtdYield={calcWtdYield(peAssets)} g={C3B} />}
                  {altInvests.length > 0 && <>
                    <C3SubLabel text="Alternative Investments" />
                    {altInvests.map((a, i) => <C3Row key={i} a={a} tc={TC.alts} g={C3B} />)}
                    <C3Total tc={TC.alts} label="Alternative Investments" total={altInvestsTotal} wtdYield={calcWtdYield(altInvests)} g={C3B} />
                  </>}
                  {carryAlts.length > 0 && <>
                    <C3SubLabel text="Carry Vehicles" />
                    {carryAlts.map((a, i) => <C3Row key={i} a={a} tc={TC.alts} g={C3B} />)}
                    <C3Total tc={TC.alts} label="Carry Vehicles" total={carryTotal} wtdYield={calcWtdYield(carryAlts)} g={C3B} />
                  </>}
                  {rsuAlts.length > 0 && <>
                    <C3SubLabel text="Deferred Comp · RSUs" />
                    {rsuAlts.map((a, i) => <C3Row key={i} a={a} tc={TC.alts} g={C3B} />)}
                    <C3Total tc={TC.alts} label="RSUs" total={rsuTotal} wtdYield={calcWtdYield(rsuAlts)} g={C3B} />
                  </>}
                  <C3NetRow grossLabel="Total Other Assets" gross={reTotalZillow + peAssetsTotal - profTotal + altInvestsTotal + carryTotal + rsuTotal} netLabel="Net Other Assets" net={otherAssetsNet} g={C3B} />
                </div>

              </div>
            </div>
          );
        })()}


        {/* ── SOURCES OF LIQUIDITY — full detail ── */}
        <div style={{ marginTop: 32, marginBottom: 32 }}>
          <div style={{ margin: "0 0 14px" }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", color: "rgba(0,0,0,0.55)" }}>Additional Sources of Liquidity</span>
            <div style={{ marginTop: 6, height: 1, background: "rgba(0,0,0,0.08)" }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>

            {/* Securities-Based Lending */}
            <div style={{ flex: "1 1 0", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ height: 3, background: "#3A6FAB" }} />
              <div style={{ padding: "14px 18px 16px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "#3A6FAB", marginBottom: 10 }}>Securities-Based Lending</div>
                <div style={{ display: "flex", gap: 24, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.32)", marginBottom: 3 }}>Available</div>
                    <div style={{ fontSize: 22, fontWeight: 300, fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.025em", color: "hsl(222,45%,12%)", lineHeight: 1 }}>{fmt(sblCapacity)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.32)", marginBottom: 3 }}>Eligible Portfolio</div>
                    <div style={{ fontSize: 22, fontWeight: 300, fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.025em", color: "rgba(0,0,0,0.55)", lineHeight: 1 }}>{fmt(growthEqAmt)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 11, color: "rgba(0,0,0,0.50)", lineHeight: 1.4 }}>
                  <span>· Pledged against taxable brokerage holdings (Cresset, Schwab, E*Trade)</span>
                  <span>· Typically 50% advance rate on diversified equity</span>
                  <span>· No credit check · same-day availability · rate ~SOFR + 1.5%</span>
                </div>
              </div>
            </div>

            {/* HELOC */}
            <div style={{ flex: "1 1 0", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ height: 3, background: "#1A5C32" }} />
              <div style={{ padding: "14px 18px 16px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "#1A5C32", marginBottom: 10 }}>HELOC — Tribeca Condo</div>
                <div style={{ display: "flex", gap: 24, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.32)", marginBottom: 3 }}>Available at 80% LTV</div>
                    <div style={{ fontSize: 22, fontWeight: 300, fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.025em", color: "hsl(222,45%,12%)", lineHeight: 1 }}>{fmt(helocCapacity)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.32)", marginBottom: 3 }}>Current LTV</div>
                    <div style={{ fontSize: 22, fontWeight: 300, fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.025em", color: "rgba(0,0,0,0.55)", lineHeight: 1 }}>{primaryLTV2}%</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 11, color: "rgba(0,0,0,0.50)", lineHeight: 1.4 }}>
                  <span>· Home value {fmt(primaryVal2)} · Mortgage {fmt(primaryMtgBal2)}</span>
                  <span>· Variable rate · typically Prime + 0.50%</span>
                  <span>· Revolving draw — interest only during draw period</span>
                </div>
              </div>
            </div>

            {/* Combined capacity summary */}
            <div style={{ flex: "0 0 180px", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, background: "rgba(0,0,0,0.025)", padding: "14px 18px 16px", display: "flex", flexDirection: "column" as const, justifyContent: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.32)", marginBottom: 10 }}>Total Capacity</div>
              <div style={{ fontSize: 26, fontWeight: 300, fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.03em", color: "hsl(222,45%,12%)", lineHeight: 1, marginBottom: 6 }}>{fmt(totalBorrowCap)}</div>
              <div style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", lineHeight: 1.5 }}>SBL + HELOC combined<br/>No approval required</div>
            </div>

          </div>
        </div>

        {/* ── PAGE FOOTER ── */}
        <div style={{ fontSize: 10, color: "#B0AEA8", marginTop: 36, paddingTop: 12, borderTop: "1px solid #DAD8D2", display: "flex", justifyContent: "space-between", letterSpacing: "0.04em" }}>
          <span>Balances as of April 6, 2026 · Real estate values are Zillow estimates · For advisor use only</span>
          <span>GURU Financial · Kessler Family · Private &amp; Confidential</span>
        </div>

      </div>
    </div>
  );
}


// ─── Detection System View ────────────────────────────────────────────────────
// All data sourced from computeLiquidityTargets, computeReturnOptimization,
// and computeCumulativeNCF — the same functions that drive Balance Sheet and
// Cash Flow Forecast. No hardcoded values.
function DetectionSystemView({ assets, cashFlows, onNavigate }: {
  assets: Asset[];
  cashFlows: CashFlow[];
  onNavigate: (v: string) => void;
}) {
  const INTER = "Inter, system-ui, sans-serif";
  const DS_BG   = "#141c2b";
  const DS_CARD = "#1e2838";
  const GREEN   = "#5ecc8a";
  const AMBER   = "#ffc83c";
  const BLUE    = "#5b8fcc";
  const BORDER  = "rgba(255,255,255,0.08)";
  const MUTED   = "rgba(255,255,255,0.5)";
  const DIM     = "rgba(255,255,255,0.32)";
  const OP_COL  = "#4d9de0";
  const RES_COL = "#e8a830";
  const CAP_COL = "#2a9a5a";
  const TAX_RATE       = 0.47;  // NYC combined for bank interest
  const TREAS_TAX_RATE = 0.35;  // Federal only for treasuries (state/city exempt)

  // ── Single source of truth ─────────────────────────────────────────────────
  const {
    operatingCash, liquidityReserve, capitalBuild,
    totalLiquid, excessLiquidity, troughDepth,
  } = computeLiquidityTargets(assets, cashFlows);

  const { annualPickup, currentAnnualIncome, proformaAnnualIncome, accounts: optAccounts } =
    computeReturnOptimization(assets, cashFlows);

  const { cumulativeByMonth, troughIdx } = computeCumulativeNCF(cashFlows);
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const troughMonth = MONTH_NAMES[troughIdx] ?? "Nov";

  // ── Annual cash flow totals (live from cashFlows) ──────────────────────────
  const yr2026 = (cf: CashFlow) => new Date(cf.date as string).getFullYear() === 2026;
  const annualInflows  = cashFlows.filter(cf => cf.type === "inflow"  && yr2026(cf)).reduce((s, cf) => s + Number(cf.amount), 0);
  const annualOutflows = cashFlows.filter(cf => cf.type === "outflow" && yr2026(cf)).reduce((s, cf) => s + Number(cf.amount), 0);
  const annualNetCF    = annualInflows - annualOutflows;
  const monthlyBurn    = Math.round(annualOutflows / 12);
  const coverageRatio  = annualOutflows > 0 ? Math.round((annualInflows / annualOutflows) * 100) : 0;
  const cashRunway     = monthlyBurn > 0 ? (totalLiquid / monthlyBurn).toFixed(1) : "—";
  const sortedNet      = [...cumulativeByMonth.map((v, i) => i === 0 ? v : v - cumulativeByMonth[i-1])].sort((a, b) => a - b);
  const medianMonthly  = sortedNet[Math.floor(sortedNet.length / 2)] ?? 0;

  // ── Account groupings (mirror computeLiquidityTargets classification) ──────
  const opAccts  = assets.filter(a => a.type === "cash" && (a.description ?? "").toLowerCase().includes("checking"));
  const resAccts = assets.filter(a => a.type === "cash" && !(a.description ?? "").toLowerCase().includes("checking"));
  const capAccts = assets.filter(a => a.type === "fixed_income" && !/401|ira|roth/i.test(a.description ?? ""));

  const getGrossYield = (desc: string) => optAccounts.find(a => a.description === desc)?.grossYield ?? 0;

  const blendedGross = (accts: Asset[]) => {
    const total = accts.reduce((s, a) => s + Number(a.value), 0);
    if (total === 0) return 0;
    return accts.reduce((s, a) => s + getGrossYield(a.description ?? "") * Number(a.value), 0) / total;
  };
  const opYield  = blendedGross(opAccts);
  const resYield = blendedGross(resAccts);
  const capYield = blendedGross(capAccts);
  const totalBlended   = totalLiquid > 0 ? (operatingCash * opYield + liquidityReserve * resYield + capitalBuild * capYield) / totalLiquid : 0;
  const totalAfterTax  = totalLiquid > 0 ? (operatingCash * opYield * (1 - TAX_RATE) + liquidityReserve * resYield * (1 - TAX_RATE) + capitalBuild * capYield * (1 - TREAS_TAX_RATE)) / totalLiquid : 0;

  // ── Upcoming large payments from live cashFlows ────────────────────────────
  const upcomingPayments = cashFlows
    .filter(cf => {
      const d = new Date(cf.date as string);
      return cf.type === "outflow" && d >= DEMO_NOW && Number(cf.amount) >= 10000;
    })
    .sort((a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime())
    .slice(0, 5);

  // ── SVG donut helpers ──────────────────────────────────────────────────────
  const R = 68, CIRC = 2 * Math.PI * R;
  const seg = (frac: number, offset: number) => ({
    dashArray: `${(frac * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`,
    dashOffset: `${-offset}`,
  });
  const opFrac  = totalLiquid > 0 ? operatingCash    / totalLiquid : 0;
  const resFrac = totalLiquid > 0 ? liquidityReserve / totalLiquid : 0;
  const capFrac = totalLiquid > 0 ? capitalBuild     / totalLiquid : 0;
  const opSeg   = seg(opFrac,  0);
  const resSeg  = seg(resFrac, opFrac  * CIRC);
  const capSeg  = seg(capFrac, (opFrac + resFrac) * CIRC);

  const fmtD = (v: number) => `$${Math.round(v).toLocaleString()}`;
  const fmtY = (v: number) => v > 0 ? `${(v * 100).toFixed(2)}%` : "< 0.01%";

  // ── April cluster total ────────────────────────────────────────────────────
  const aprilTotal = cashFlows.filter(cf => {
    const d = new Date(cf.date as string);
    return cf.type === "outflow" && d.getFullYear() === 2026 && d.getMonth() === 3;
  }).reduce((s, cf) => s + Number(cf.amount), 0);

  return (
    <div style={{ background: DS_BG, color: "rgba(255,255,255,0.88)", fontFamily: INTER, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", fontSize: 13 }}>
      <style>{`
        @keyframes ds-pulse    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.25;transform:scale(0.5)} }
        @keyframes ds-scan     { 0%{left:-60%} 100%{left:130%} }
        @keyframes ds-glow-blu { 0%,100%{box-shadow:0 0 0 1px rgba(91,143,204,0.12)} 50%{box-shadow:0 0 10px 1px rgba(91,143,204,0.45),0 0 0 1px rgba(91,143,204,0.5)} }
        @keyframes ds-glow-grn { 0%,100%{box-shadow:0 0 0 1px rgba(94,204,138,0.12)} 50%{box-shadow:0 0 10px 1px rgba(94,204,138,0.45),0 0 0 1px rgba(94,204,138,0.5)} }
        @keyframes ds-glow-amb { 0%,100%{box-shadow:0 0 0 1px rgba(255,200,60,0.12)}  50%{box-shadow:0 0 10px 1px rgba(255,200,60,0.4),0 0 0 1px rgba(255,200,60,0.45)} }
        @keyframes ds-dot      { 0%,100%{box-shadow:0 0 8px rgba(94,204,138,0.4)} 50%{box-shadow:0 0 14px rgba(94,204,138,0.7)} }
      `}</style>

      {/* ── Scan bar ── */}
      <div style={{ position: "relative", background: "rgba(20,28,43,0.95)", borderBottom: "1px solid rgba(42,74,110,0.35)", padding: "5px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 0, left: "-60%", width: "35%", height: "100%", background: "linear-gradient(90deg,transparent,rgba(180,210,255,0.06),transparent)", animation: "ds-scan 3.5s linear infinite", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(180,210,255,0.75)" }}>▶ GURU AI · Detection System Active</span>
          <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.1)" }} />
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, padding: "1px 7px", borderRadius: 2, background: "rgba(94,204,138,0.09)", border: "1px solid rgba(94,204,138,0.35)", color: GREEN }}>● LIVE</span>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, padding: "1px 7px", borderRadius: 2, background: "rgba(255,200,60,0.09)", border: "1px solid rgba(255,200,60,0.35)", color: AMBER }}>4 Active</span>
        </div>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", letterSpacing: "0.05em", textTransform: "uppercase" as const, position: "relative" }}>{format(DEMO_NOW, "MMM d, yyyy")} · 9:42 AM</span>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: "auto" as const, padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* ── TOP ROW: Detection (left) + Liquidity (right) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "480px 1fr", gap: 12, alignItems: "stretch" }}>

          {/* ── LEFT: Detection System panel ── */}
          <div style={{ background: "linear-gradient(160deg,#1a3a6b 0%,#163060 55%,#0f2248 100%)", border: "1px solid rgba(91,143,204,0.32)", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,rgba(91,143,204,0.65),rgba(91,143,204,0.1) 60%,transparent)", pointerEvents: "none" }} />
            <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(91,143,204,0.28)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 3, height: 18, borderRadius: 2, background: GREEN, flexShrink: 0 }} />
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, display: "inline-block", flexShrink: 0, animation: "ds-dot 2s ease-in-out infinite" }} />
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "rgba(255,255,255,0.88)" }}>Detection System</span>
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)" }}>4 Active</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px", flex: 1 }}>

              {/* Card: Data sync */}
              <div style={{ background: "rgba(0,0,0,0.22)", borderRadius: 5, border: "1px solid rgba(91,143,204,0.18)", padding: "9px 12px", display: "flex", alignItems: "center", gap: 10, animation: "ds-glow-blu 3.2s ease-in-out infinite" }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4, marginBottom: 1 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(180,215,255,0.95)" }}>DATA SYNC COMPLETE</span>
                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>{format(DEMO_NOW, "MMM d")} · 9:42 AM</span>
                  </div>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.52)" }}>· 6 accounts refreshed · 2 new transactions</span>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.52)" }}>· Year-end bonus deposit detected · Citizens ···2847</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, minWidth: 90 }}>
                  <span style={{ padding: "2px 7px", borderRadius: 3, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, background: "rgba(94,204,138,0.09)", border: "1px solid rgba(94,204,138,0.35)", color: GREEN }}>● LIVE</span>
                  <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(180,215,255,0.38)" }}>→ Sync Log</span>
                </div>
              </div>

              {/* Card: HERO — Excess Liquidity (live) */}
              <div style={{ background: "rgba(0,0,0,0.26)", borderRadius: 6, border: "1px solid rgba(94,204,138,0.28)", borderLeft: "2.5px solid rgba(94,204,138,0.55)", padding: "11px 14px", display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden", animation: "ds-glow-grn 3.2s ease-in-out infinite", animationDelay: "0.8s", cursor: "pointer" }} onClick={() => onNavigate("guru")}>
                <div style={{ position: "absolute", top: -20, right: -20, width: 180, height: 120, background: "radial-gradient(ellipse at center,rgba(94,204,138,0.07) 0%,transparent 70%)", pointerEvents: "none" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase" as const, color: "rgba(94,204,138,0.88)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, display: "inline-block", animation: "ds-pulse 2s infinite", flexShrink: 0 }} />
                    LIQUIDITY SIGNAL
                  </div>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.28)" }}>6h ago</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.02em", color: "rgba(180,215,255,0.95)" }}>EXCESS LIQUIDITY DETECTED</div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <div style={{ flex: 1, paddingRight: 16, borderRight: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Excess Liquidity</div>
                    <div style={{ fontSize: 34, fontWeight: 300, lineHeight: 1, color: GREEN, fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.01em" }}>{fmtD(excessLiquidity)}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Above liquidity requirement · <em style={{ fontStyle: "normal", color: "rgba(94,204,138,0.65)" }}>deployable now</em></div>
                  </div>
                  <div style={{ flex: 1, paddingLeft: 16 }}>
                    <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Potential Income Pickup</div>
                    <div style={{ fontSize: 34, fontWeight: 300, lineHeight: 1, color: GREEN, fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.01em" }}>+{fmtD(annualPickup)}<span style={{ fontSize: 13, color: "rgba(94,204,138,0.68)", marginLeft: 2 }}>/yr</span></div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Pro-forma vs. current · <em style={{ fontStyle: "normal", color: "rgba(94,204,138,0.65)" }}>{fmtD(currentAnnualIncome)} → {fmtD(proformaAnnualIncome)}/yr</em></div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(94,204,138,0.35)", background: "rgba(94,204,138,0.08)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: GREEN }}>OPPORTUNITY</span>
                  <span style={{ fontSize: 8.5, fontWeight: 600, color: "rgba(180,215,255,0.5)" }}>→ Allocation ↗</span>
                </div>
              </div>

              {/* Card: April expense cluster (live) */}
              <div style={{ background: "rgba(0,0,0,0.22)", borderRadius: 5, border: "1px solid rgba(91,143,204,0.18)", padding: "9px 12px", display: "flex", alignItems: "center", gap: 10, animation: "ds-glow-amb 3.2s ease-in-out infinite", animationDelay: "1.6s" }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4, marginBottom: 1 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(180,215,255,0.95)" }}>{format(addMonths(DEMO_NOW, 1), "MMMM").toUpperCase()} · HIGH EXPENSE CLUSTER</span>
                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>4d ago</span>
                  </div>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.52)" }}>· {fmtD(aprilTotal)} flagged: tuition, federal estimated tax, property tax</span>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.52)" }}>· Reserve → Operating transfer required {format(addMonths(DEMO_NOW, 1), "MMM d")}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, minWidth: 90 }}>
                  <span style={{ padding: "2px 7px", borderRadius: 3, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, background: "rgba(255,200,60,0.09)", border: "1px solid rgba(255,200,60,0.35)", color: AMBER }}>ACTION</span>
                  <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(180,215,255,0.38)" }}>→ Cash Flow</span>
                </div>
              </div>

              {/* Card: Outflow streak (live trough data) */}
              <div style={{ background: "rgba(0,0,0,0.22)", borderRadius: 5, border: "1px solid rgba(91,143,204,0.18)", padding: "9px 12px", display: "flex", alignItems: "center", gap: 10, animation: "ds-glow-blu 3.2s ease-in-out infinite", animationDelay: "2.4s" }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4, marginBottom: 1 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(180,215,255,0.95)" }}>OUTFLOW STREAK · THROUGH {troughMonth.toUpperCase()}</span>
                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>12h ago</span>
                  </div>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.52)" }}>· Cumulative deficit peaks ({fmtD(troughDepth)}) in {troughMonth}</span>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.52)" }}>· Reserve covers full trough · No action required</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, minWidth: 90 }}>
                  <span style={{ padding: "2px 7px", borderRadius: 3, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, background: "rgba(91,143,204,0.09)", border: "1px solid rgba(91,143,204,0.35)", color: BLUE }}>WATCH</span>
                  <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(180,215,255,0.38)" }}>→ Runway</span>
                </div>
              </div>

            </div>
          </div>

          {/* ── RIGHT: Today's Liquidity Position ── */}
          <div style={{ background: DS_CARD, border: BORDER, borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 14px 7px", borderBottom: "1px solid rgba(42,74,110,0.4)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <div style={{ width: 4, height: 26, background: "linear-gradient(to bottom,rgba(91,143,204,1),rgba(91,143,204,0.15))", borderRadius: 2, flexShrink: 0, boxShadow: "0 0 8px rgba(91,143,204,0.35)" }} />
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.82)", whiteSpace: "nowrap" }}>Today's Liquidity Position</span>
              <div style={{ flex: 1, height: 2, background: "linear-gradient(to right,rgba(91,143,204,0.35),rgba(91,143,204,0.08) 50%,transparent)", borderRadius: 1 }} />
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{[...opAccts,...resAccts,...capAccts].length} accounts · {format(DEMO_NOW, "MMM d, yyyy")}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "row" as const, flex: 1, minHeight: 0 }}>

              {/* Donut sidebar */}
              <div style={{ width: 220, flexShrink: 0, padding: "14px 14px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, borderRight: "1px solid rgba(255,255,255,0.07)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(255,255,255,0.82)", alignSelf: "flex-start" }}>Cash &amp; Treasuries</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: -6, alignSelf: "flex-start" }}>{format(DEMO_NOW, "MMMM d")}</span>
                <svg viewBox="0 0 180 180" width="160" height="160">
                  <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="20"/>
                  <circle cx="90" cy="90" r={R} fill="none" stroke={OP_COL}  strokeWidth="20" strokeDasharray={opSeg.dashArray}  strokeDashoffset={opSeg.dashOffset}  transform="rotate(-90 90 90)"/>
                  <circle cx="90" cy="90" r={R} fill="none" stroke={RES_COL} strokeWidth="20" strokeDasharray={resSeg.dashArray} strokeDashoffset={resSeg.dashOffset} transform="rotate(-90 90 90)"/>
                  <circle cx="90" cy="90" r={R} fill="none" stroke={CAP_COL} strokeWidth="20" strokeDasharray={capSeg.dashArray} strokeDashoffset={capSeg.dashOffset} transform="rotate(-90 90 90)"/>
                  <text x="90" y="87" textAnchor="middle" fill="rgba(255,255,255,0.88)" fontSize="18" fontWeight="300" fontFamily="Inter,system-ui">{fmtD(totalLiquid)}</text>
                  <text x="90" y="102" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" fontWeight="500" fontFamily="Inter,system-ui" letterSpacing="1">TOTAL LIQUID</text>
                </svg>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%" }}>
                  {[
                    { color: OP_COL,  label: "Operating", val: operatingCash,    pct: totalLiquid > 0 ? Math.round(opFrac  * 100) : 0 },
                    { color: RES_COL, label: "Reserve",   val: liquidityReserve, pct: totalLiquid > 0 ? Math.round(resFrac * 100) : 0 },
                    { color: CAP_COL, label: "Build",     val: capitalBuild,     pct: totalLiquid > 0 ? Math.round(capFrac * 100) : 0 },
                  ].map(item => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: MUTED, flex: 1 }}>{item.label}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", fontVariantNumeric: "tabular-nums" as const }}>{fmtD(item.val)}</span>
                      <span style={{ fontSize: 9, color: DIM, minWidth: 24, textAlign: "right" as const }}>{item.pct}%</span>
                    </div>
                  ))}
                </div>
                <div style={{ width: "100%", borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10, display: "flex", gap: 10 }}>
                  {[
                    { label: "Blended Yield", val: fmtY(totalBlended) },
                    { label: "After-Tax",     val: fmtY(totalAfterTax) },
                  ].map(item => (
                    <div key={item.label} style={{ flex: 1 }}>
                      <div style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: DIM, marginBottom: 3 }}>{item.label}</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.72)" }}>{item.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Account table */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
                  <thead>
                    <tr style={{ background: "#1a2433", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["Account","Balance","Yield","After-Tax"].map((h, i) => (
                        <th key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(255,255,255,0.82)", padding: "6px 10px", textAlign: i === 0 ? "left" : "right" as const, paddingLeft: i === 0 ? 14 : undefined, borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.07)" : undefined }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Operating */}
                    {opAccts.map((a, i) => { const y = getGrossYield(a.description ?? ""); return (
                      <tr key={i} style={{ background: "rgba(77,157,224,0.07)", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "5px 10px 5px 18px", fontSize: 11, color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap" as const }}>{a.description}</td>
                        <td style={{ padding: "5px 10px", fontSize: 12, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const, color: "rgba(255,255,255,0.78)", borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtD(Number(a.value))}</td>
                        <td style={{ padding: "5px 10px", fontSize: 11, textAlign: "right" as const, color: DIM, borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtY(y)}</td>
                        <td style={{ padding: "5px 10px", fontSize: 11, textAlign: "right" as const, color: DIM, borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtY(y * (1 - TAX_RATE))}</td>
                      </tr>
                    ); })}
                    <tr style={{ background: "rgba(77,157,224,0.19)", borderTop: "1px solid rgba(77,157,224,0.22)" }}>
                      <td style={{ padding: "5px 10px 5px 14px", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: OP_COL }}>⬤ Operating</td>
                      <td style={{ padding: "5px 10px", fontSize: 12, fontWeight: 600, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const, color: OP_COL, borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtD(operatingCash)}</td>
                      <td style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, textAlign: "right" as const, color: OP_COL, borderLeft: "1px solid rgba(255,255,255,0.07)", opacity: 0.8 }}>{fmtY(opYield)}</td>
                      <td style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, textAlign: "right" as const, color: OP_COL, borderLeft: "1px solid rgba(255,255,255,0.07)", opacity: 0.8 }}>{fmtY(opYield * (1 - TAX_RATE))}</td>
                    </tr>
                    {/* Reserve */}
                    {resAccts.map((a, i) => { const y = getGrossYield(a.description ?? ""); return (
                      <tr key={i} style={{ background: "rgba(232,168,48,0.07)", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "5px 10px 5px 18px", fontSize: 11, color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap" as const }}>{a.description}</td>
                        <td style={{ padding: "5px 10px", fontSize: 12, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const, color: "rgba(255,255,255,0.78)", borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtD(Number(a.value))}</td>
                        <td style={{ padding: "5px 10px", fontSize: 11, textAlign: "right" as const, color: DIM, borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtY(y)}</td>
                        <td style={{ padding: "5px 10px", fontSize: 11, textAlign: "right" as const, color: DIM, borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtY(y * (1 - TAX_RATE))}</td>
                      </tr>
                    ); })}
                    <tr style={{ background: "rgba(232,168,48,0.19)", borderTop: "1px solid rgba(232,168,48,0.22)" }}>
                      <td style={{ padding: "5px 10px 5px 14px", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: RES_COL }}>⬤ Reserve</td>
                      <td style={{ padding: "5px 10px", fontSize: 12, fontWeight: 600, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const, color: RES_COL, borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtD(liquidityReserve)}</td>
                      <td style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, textAlign: "right" as const, color: RES_COL, borderLeft: "1px solid rgba(255,255,255,0.07)", opacity: 0.8 }}>{fmtY(resYield)}</td>
                      <td style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, textAlign: "right" as const, color: RES_COL, borderLeft: "1px solid rgba(255,255,255,0.07)", opacity: 0.8 }}>{fmtY(resYield * (1 - TAX_RATE))}</td>
                    </tr>
                    {/* Capital Build */}
                    {capAccts.map((a, i) => { const y = getGrossYield(a.description ?? ""); return (
                      <tr key={i} style={{ background: "rgba(42,154,90,0.07)", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "5px 10px 5px 18px", fontSize: 11, color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap" as const }}>{a.description}</td>
                        <td style={{ padding: "5px 10px", fontSize: 12, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const, color: "rgba(255,255,255,0.78)", borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtD(Number(a.value))}</td>
                        <td style={{ padding: "5px 10px", fontSize: 11, textAlign: "right" as const, color: DIM, borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtY(y)}</td>
                        <td style={{ padding: "5px 10px", fontSize: 11, textAlign: "right" as const, color: DIM, borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtY(y * (1 - TREAS_TAX_RATE))}</td>
                      </tr>
                    ); })}
                    <tr style={{ background: "rgba(42,154,90,0.19)", borderTop: "1px solid rgba(42,154,90,0.22)" }}>
                      <td style={{ padding: "5px 10px 5px 14px", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: CAP_COL }}>⬤ Capital Build</td>
                      <td style={{ padding: "5px 10px", fontSize: 12, fontWeight: 600, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const, color: CAP_COL, borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtD(capitalBuild)}</td>
                      <td style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, textAlign: "right" as const, color: CAP_COL, borderLeft: "1px solid rgba(255,255,255,0.07)", opacity: 0.8 }}>{fmtY(capYield)}</td>
                      <td style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, textAlign: "right" as const, color: CAP_COL, borderLeft: "1px solid rgba(255,255,255,0.07)", opacity: 0.8 }}>{fmtY(capYield * (1 - TREAS_TAX_RATE))}</td>
                    </tr>
                    {/* Total */}
                    <tr style={{ borderTop: "2px solid rgba(255,255,255,0.13)", background: "rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "7px 10px 7px 14px", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "rgba(255,255,255,0.88)" }}>Total Liquidity</td>
                      <td style={{ padding: "7px 10px", fontSize: 12, fontWeight: 700, textAlign: "right" as const, color: "rgba(255,255,255,0.92)", fontVariantNumeric: "tabular-nums" as const, borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtD(totalLiquid)}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, fontWeight: 700, textAlign: "right" as const, color: MUTED, borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtY(totalBlended)}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, fontWeight: 700, textAlign: "right" as const, color: MUTED, borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{fmtY(totalAfterTax)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ padding: "7px 12px", borderTop: "1px solid rgba(255,255,255,0.07)", textAlign: "right" as const, fontSize: 11, color: "rgba(91,143,204,0.8)", cursor: "pointer" }} onClick={() => onNavigate("guru")}>Optimize in Allocation Tool →</div>
              </div>

            </div>
          </div>
        </div>

        {/* ── Section break ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, padding: "8px 0 2px" }}>
          <div style={{ width: 4, height: 26, background: "linear-gradient(to bottom,rgba(91,143,204,1),rgba(91,143,204,0.15))", borderRadius: 2, flexShrink: 0, boxShadow: "0 0 8px rgba(91,143,204,0.35)" }} />
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.82)", whiteSpace: "nowrap" }}>12-Month Cash Flow Forecast</span>
          <div style={{ flex: 1, height: 2, background: "linear-gradient(to right,rgba(91,143,204,0.35),rgba(91,143,204,0.08) 50%,transparent)", borderRadius: 1 }} />
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "rgba(91,143,204,0.5)", padding: "2px 8px", border: "1px solid rgba(91,143,204,0.18)", borderRadius: 3 }}>Jan – Dec 2026</span>
        </div>

        {/* ── Forecast: KPIs (left) + Upcoming payments (right) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "480px 1fr", gap: 12, alignItems: "start" }}>

          {/* LEFT: Annual hero + KPI metrics */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: "linear-gradient(135deg,#1a2d47 0%,#162540 100%)", border: "1px solid rgba(91,143,204,0.25)", borderRadius: 8, padding: "14px 18px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,rgba(91,143,204,0.8),rgba(91,143,204,0.2),transparent)" }} />
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "rgba(91,143,204,0.55)", marginBottom: 4 }}>Annual Net Cash Flow</div>
              <div style={{ fontSize: 36, fontWeight: 300, lineHeight: 1, color: annualNetCF >= 0 ? GREEN : "#ff6464", fontVariantNumeric: "tabular-nums" as const, letterSpacing: "-0.02em", marginBottom: 8 }}>
                {annualNetCF >= 0 ? "+" : ""}{fmtD(annualNetCF)}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 3, background: annualNetCF >= 0 ? "rgba(94,204,138,0.12)" : "rgba(255,100,100,0.12)", border: `1px solid ${annualNetCF >= 0 ? "rgba(94,204,138,0.4)" : "rgba(255,100,100,0.4)"}`, color: annualNetCF >= 0 ? GREEN : "#ff6464" }}>
                  {annualNetCF >= 0 ? "▲ Cash positive" : "▼ Cash negative"}
                </span>
                <div style={{ textAlign: "right" as const }}>
                  <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(180,210,255,0.35)" }}>Income / Expenses</div>
                  <div style={{ fontSize: 11, fontWeight: 300, color: "rgba(255,255,255,0.42)", fontVariantNumeric: "tabular-nums" as const }}>{fmtD(annualInflows)} / {fmtD(annualOutflows)}</div>
                </div>
              </div>
            </div>
            <div style={{ background: DS_CARD, border: BORDER, borderRadius: 8, overflow: "hidden" }}>
              {([
                { label: "Annual Income (Pre-Tax)",   sub: "Gross earned income + distributions",    val: fmtD(annualInflows),                                            color: "rgba(255,255,255,0.82)", indent: false },
                { label: "Total Annual Expenses",      sub: "Core living + taxes + one-time",         val: `(${fmtD(annualOutflows)})`,                                   color: "rgba(255,255,255,0.82)", indent: false },
                { label: "Coverage Ratio",             sub: "Annual net income ÷ expenses",           val: `${coverageRatio}%`,                                            color: coverageRatio >= 100 ? GREEN : "#ff6464", indent: true },
                { label: "Monthly Burn Rate",          sub: "Average monthly outflows",               val: fmtD(monthlyBurn),                                             color: "#ff6464", indent: false },
                { label: "Cash Runway",                sub: "Total liquidity ÷ monthly burn",         val: `${cashRunway} months`,                                        color: "rgba(255,255,255,0.65)", indent: true },
                { label: "Cash Flow Trough",           sub: "Cumulative low point",                   val: `(${fmtD(troughDepth)})`, sub2: troughMonth.toUpperCase(),     color: AMBER, indent: false },
                { label: "Median Monthly Cash Flow",   sub: "50th percentile, monthly",               val: medianMonthly >= 0 ? fmtD(medianMonthly) : `(${fmtD(Math.abs(medianMonthly))})`, color: AMBER, indent: false },
              ] as const).map((row, i, arr) => (
                <div key={row.label} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", padding: `10px ${row.indent ? 28 : 14}px`, borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: row.indent ? "rgba(91,143,204,0.04)" : "transparent" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.82)" }}>{row.label}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", marginTop: 1 }}>{row.sub}</div>
                  </div>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ fontSize: row.indent ? 16 : 14, fontWeight: 300, fontVariantNumeric: "tabular-nums" as const, color: row.color }}>{row.val}</div>
                    {"sub2" in row && row.sub2 && <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: AMBER }}>{row.sub2}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Upcoming large payments (live from cashFlows) */}
          <div style={{ background: DS_CARD, border: BORDER, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,200,60,0.22)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 3, height: 18, borderRadius: 2, background: "rgba(255,200,60,0.75)", flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "rgba(255,255,255,0.88)" }}>Upcoming Large Payments</span>
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "rgba(255,200,60,0.55)", border: "1px solid rgba(255,200,60,0.2)", borderRadius: 3, padding: "2px 7px" }}>{upcomingPayments.length} scheduled</span>
            </div>
            {upcomingPayments.map((pmt, i) => {
              const d = new Date(pmt.date as string);
              const daysAway = Math.round((d.getTime() - DEMO_NOW.getTime()) / 86400000);
              const urgent = daysAway <= 20;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i < upcomingPayments.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none", background: urgent ? "rgba(255,200,60,0.04)" : "transparent" }}>
                  <div style={{ flexShrink: 0, width: 36, textAlign: "center" as const }}>
                    <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "rgba(255,200,60,0.8)" }}>{format(d, "MMM")}</div>
                    <div style={{ fontSize: 18, fontWeight: 300, lineHeight: 1.1, color: "rgba(255,200,60,0.9)" }}>{format(d, "d")}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{pmt.description}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", marginTop: 3 }}>CIT Bank Operating ****7842 · {pmt.category ?? "outflow"}</div>
                  </div>
                  <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 300, color: "rgba(255,200,60,0.9)", fontVariantNumeric: "tabular-nums" as const }}>{fmtD(Number(pmt.amount))}</div>
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "rgba(255,200,60,0.65)", marginTop: 2 }}>{daysAway > 0 ? `${daysAway} DAYS` : "DUE TODAY"}</div>
                  </div>
                </div>
              );
            })}
            {upcomingPayments.length === 0 && (
              <div style={{ padding: "20px 16px", fontSize: 12, color: "rgba(255,255,255,0.38)", textAlign: "center" as const }}>No large payments scheduled</div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

type ActiveView =
  | "balancesheet"
  | "investments"
  | "advisorbrief"
  | "assetoverview"
  | "financials"
  | "guru"
  | "guru_v1"
  | "moneymovement"
  | "financialmodel"
  | "guruintelligence";

export default function ClientDashboard() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);
  const [activeView, setActiveView] = useState<ActiveView>("financialmodel");
  const [guruLanding, setGuruLanding] = useState(true);
  const [financialsTab, setFinancialsTab] = useState<"balancesheet" | "cashflow">("balancesheet");
  const [financialModelTab, setFinancialModelTab] = useState<"balancesheet" | "cashflow">("balancesheet");
  const [guruIntelTab, setGuruIntelTab] = useState<"networth" | "cashflow" | "moneymovement" | "incomeoptimization" | "liquiditymodel" | "cfforecast">("networth");
  const [opsCashMonths, setOpsCashMonths] = useState(2);
  const [cfModalOpen, setCfModalOpen] = useState(false);

  // Reset guru landing when switching away
  useEffect(() => {
    if (activeView !== "guru" && activeView !== "guru_v1") setGuruLanding(true);
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

  // ── Onboarding gate: onboarding not complete → show upload flow ──────────────
  if (!client.onboardingComplete) {
    const onboardingNav = (
      <div style={{ background:"#f0ede8", borderBottom:"1px solid rgba(0,0,0,0.10)", padding:"0 32px", display:"flex", alignItems:"center", height:46, flexShrink:0, gap:16 }}>
        <Link href="/">
          <span style={{ fontFamily:"Inter, system-ui, sans-serif", fontSize:15, fontWeight:700, letterSpacing:"0.10em", color:"hsl(222,45%,12%)", cursor:"pointer", display:"inline-block" }}>GURU</span>
        </Link>
        <div style={{ width:1, height:16, background:"rgba(0,0,0,0.15)" }} />
        <span style={{ fontSize:13, color:"rgba(0,0,0,0.45)", fontFamily:"Inter, system-ui, sans-serif" }}>{client.name}</span>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#f59e0b" }} />
          <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.06em", color:"rgba(154,123,60,0.80)", textTransform:"uppercase", fontFamily:"Inter, system-ui, sans-serif" }}>Onboarding</span>
        </div>
      </div>
    );
    return (
      <Layout topNav={onboardingNav}>
        <OnboardingView clientName={client.name} clientId={client.id} />
      </Layout>
    );
  }

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

  const _daltonPayment  = _findPayment(["dalton", "tuition", "school"]);
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
        style={navActive("guru_v1") ? NAV_ITEM_ACTIVE : NAV_ITEM}
        onClick={() => setActiveView("guru_v1")}
        onMouseEnter={e => { if (!navActive("guru_v1")) { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.55)"; }}}
        onMouseLeave={e => { if (!navActive("guru_v1")) { (e.currentTarget as HTMLDivElement).style.background = ""; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.4)"; }}}
        data-testid="nav-guru-v1"
      >
        <PieChartIcon style={{ width: 12, height: 12, flexShrink: 0 }} />
        <span className="sb-hide">Allocation v1</span>
      </div>

      <div
        style={navActive("investments") ? NAV_ITEM_ACTIVE : NAV_ITEM}
        onClick={() => setActiveView("investments")}
        onMouseEnter={e => { if (!navActive("investments")) { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.55)"; }}}
        onMouseLeave={e => { if (!navActive("investments")) { (e.currentTarget as HTMLDivElement).style.background = ""; (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.4)"; }}}
        data-testid="nav-investments"
      >
        <LayoutDashboard style={{ width: 12, height: 12, flexShrink: 0 }} />
        <span className="sb-hide">Investments</span>
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

  // ── Chrome type constants ───────────────────────────────────────────────────
  const DM = "'DM Sans', system-ui, sans-serif";
  const PF = "'Playfair Display', Georgia, serif";
  const CHROME: React.CSSProperties = {
    fontFamily: DM, fontWeight: 400, fontSize: 10,
    letterSpacing: "0.13em", textTransform: "uppercase" as const,
  };
  const NAVY = "hsl(222,45%,12%)";

  // ── Nav tab active check ────────────────────────────────────────────────────
  const topNavActive = (view: ActiveView) => activeView === view;

  // ── Inline tab hover helper (onMouseEnter/Leave) ────────────────────────────
  const tabHover = (isActive: boolean) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,0,0,0.50)";
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,0,0,0.30)";
    },
  });

  const topNav = (
    <div style={{ flexShrink: 0 }}>
      {/* ── Pulsing-dot keyframes ── */}
      <style>{`
        @keyframes guru-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes guru-live-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes guru-scan { 0%,100%{opacity:0.7} 50%{opacity:1} }
      `}</style>

      {/* ── GURU AI STATUS BAR ── */}
      <div style={{
        background: "#0c1828",
        height: 28,
        padding: "0 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0,
      }}>
        {/* Left cluster */}
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.50)", animation: "guru-scan 3s ease infinite" }}>▶ GURU AI</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", margin: "0 10px" }}>·</span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)" }}>SCAN ACTIVE</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.12)", margin: "0 10px" }}>|</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#44e08a", animation: "guru-live-pulse 2s ease infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#44e08a" }}>LIVE</span>
          </div>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.12)", margin: "0 10px" }}>|</span>
          <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)" }}>6 ACCOUNTS SYNCED · DEC 29, 2025 · 9:42 AM</span>
        </div>
        {/* Centre badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "#ffc83c", border: "1px solid rgba(255,200,60,0.35)", padding: "1px 8px", borderRadius: 2 }}>2 ACTIONS PENDING</span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "rgba(68,224,138,0.80)", border: "1px solid rgba(68,224,138,0.25)", padding: "1px 8px", borderRadius: 2 }}>1 OPPORTUNITY</span>
        </div>
        {/* Right */}
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.18)" }}>GURU AI · DETECTION SYSTEM</span>
      </div>

      {/* ── IDENTITY BAR ── */}
      {(()=>{
        const isGI = activeView === "guruintelligence";
        const GI_BG = "hsl(218,12%,24%)";
        return (
          <div style={{
            background: isGI ? GI_BG : "#fff",
            height: 36,
            padding: "0 40px",
            borderBottom: isGI ? "none" : "0.5px solid rgba(0,0,0,0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            {/* Left: client name */}
            <span style={{ ...CHROME, color: isGI ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.45)" }}>Kessler Family</span>
            {/* Right: date */}
            {activeView === "advisorbrief" ? (
              <span style={{ ...CHROME, color: isGI ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.28)" }}>Tara Williams · March 6, 2026</span>
            ) : (
              <span style={{ ...CHROME, color: isGI ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.28)" }}>December 29, 2025</span>
            )}
          </div>
        );
      })()}

      {/* ── NAV BAR ── */}
      {(()=>{
        const isGI = activeView === "guruintelligence";
        const GI_BG = "hsl(218,12%,24%)";
        return (
          <div style={{
            background: isGI ? GI_BG : "#fff",
            height: 44,
            padding: "0 40px",
            borderBottom: "none",
            display: "flex",
            alignItems: "stretch",
          }}>
            {/* GURU wordmark */}
            <Link href="/" style={{ display: "flex", alignSelf: "stretch" }}>
              <div style={{
                display: "flex", alignItems: "center",
                borderRight: `0.5px solid ${isGI ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
                paddingRight: 28, marginRight: 4,
                cursor: "pointer",
              }}>
                <span style={{ ...CHROME, color: isGI ? "rgba(255,255,255,0.85)" : NAVY }}>GURU</span>
              </div>
            </Link>

            {/* Primary tabs */}
            {([
              { label: "Financial model", view: "financialmodel" as ActiveView, onClick: () => setActiveView("financialmodel") },
              { label: "Allocation",      view: "guru"           as ActiveView, onClick: () => setActiveView("guru") },
              { label: "Investments",     view: "investments"    as ActiveView, onClick: () => setActiveView("investments") },
              { label: "Advisor brief",   view: "advisorbrief"   as ActiveView, onClick: () => setActiveView("advisorbrief") },
            ]).map(tab => {
              const isActive = topNavActive(tab.view);
              const activeColor  = isGI ? "#FFFFFF" : NAVY;
              const inactiveColor = isGI ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.30)";
              return (
                <button
                  key={tab.label}
                  onClick={tab.onClick}
                  {...tabHover(isActive)}
                  style={{
                    ...CHROME,
                    color: isActive ? activeColor : inactiveColor,
                    padding: "0 16px",
                    border: "none",
                    borderBottom: isActive ? `2px solid ${activeColor}` : "2px solid transparent",
                    background: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap" as const,
                    lineHeight: 1,
                    userSelect: "none" as const,
                    alignSelf: "stretch",
                    display: "flex",
                    alignItems: "center",
                    transition: "color 0.12s, border-color 0.12s",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}

            {/* Separator before GURU intelligence */}
            <div style={{ width: "0.5px", background: isGI ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)", margin: "11px 6px", flexShrink: 0 }} />

            {/* GURU intelligence tab */}
            {(() => {
              const isActive = topNavActive("guruintelligence");
              const GI_BLUE = "#4A9FD4";
              const activeColor = isGI ? "#FFFFFF" : GI_BLUE;
              return (
                <button
                  onClick={() => setActiveView("guruintelligence")}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = isGI ? "#FFFFFF" : GI_BLUE; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = isActive ? activeColor : (isGI ? "rgba(255,255,255,0.50)" : GI_BLUE); }}
                  style={{
                    ...CHROME,
                    color: isActive ? activeColor : (isGI ? "rgba(255,255,255,0.50)" : GI_BLUE),
                    padding: "0 16px",
                    border: "none",
                    borderBottom: isActive ? `2px solid ${activeColor}` : "2px solid transparent",
                    background: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap" as const,
                    lineHeight: 1,
                    userSelect: "none" as const,
                    alignSelf: "stretch",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    transition: "color 0.12s, border-color 0.12s",
                  }}
                >
                  <div style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: isActive ? activeColor : (isGI ? "rgba(255,255,255,0.50)" : GI_BLUE),
                    animation: "guru-pulse 2.5s ease infinite",
                    flexShrink: 0,
                  }} />
                  GURU intelligence
                </button>
              );
            })()}
          </div>
        );
      })()}

      {/* ── FINANCIAL MODEL subtab row — white (advisor layer) ── */}
      {activeView === "financialmodel" && (
        <div style={{
          background: "#fff",
          borderBottom: "1px solid rgba(0,0,0,0.10)",
          padding: "0 40px",
          display: "flex",
          alignItems: "stretch",
        }}>
          {([
            { label: "Balance sheet", key: "balancesheet" },
            { label: "Cash flow",     key: "cashflow" },
          ] as const).map(t => {
            const isA = financialModelTab === t.key;
            return (
              <button key={t.key}
                onClick={() => setFinancialModelTab(t.key)}
                onMouseEnter={e => { if (!isA) (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,0,0,0.50)"; }}
                onMouseLeave={e => { if (!isA) (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,0,0,0.30)"; }}
                style={{ ...CHROME, color: isA ? NAVY : "rgba(0,0,0,0.30)", border: "none", borderBottom: isA ? `2px solid ${NAVY}` : "2px solid transparent", background: "none", cursor: "pointer", padding: "0 16px", height: 34, whiteSpace: "nowrap" as const, lineHeight: 1, userSelect: "none" as const, transition: "color 0.12s, border-color 0.12s", alignSelf: "stretch", display: "flex", alignItems: "center" }}
              >{t.label}</button>
            );
          })}
        </div>
      )}

      {/* ── GURU INTELLIGENCE subtab row — flat chrome surface ── */}
      {activeView === "guruintelligence" && (
        <div style={{
          background: "hsl(218,12%,24%)",
          borderBottom: "none",
          padding: "0 40px",
          display: "flex",
          alignItems: "stretch",
        }}>
          {([
            { label: "Detection System",    key: "cashflow" },
            { label: "Balance Sheet Today", key: "networth" },
            { label: "Money movement",      key: "moneymovement" },
            { label: "Asset forecast",      key: "liquiditymodel" },
            { label: "Cash flow forecast",  key: "cfforecast" },
          ] as const).map(t => {
            const isA = guruIntelTab === t.key;
            return (
              <button key={t.key}
                onClick={() => setGuruIntelTab(t.key as typeof guruIntelTab)}
                onMouseEnter={e => { if (!isA) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.60)"; }}
                onMouseLeave={e => { if (!isA) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.30)"; }}
                style={{ ...CHROME, color: isA ? "#fff" : "rgba(255,255,255,0.30)", border: "none", borderBottom: isA ? "2px solid #FFFFFF" : "2px solid transparent", background: "none", cursor: "pointer", padding: "0 16px", height: 34, whiteSpace: "nowrap" as const, lineHeight: 1, userSelect: "none" as const, transition: "color 0.12s, border-color 0.12s", alignSelf: "stretch", display: "flex", alignItems: "center" }}
              >{t.label}</button>
            );
          })}
          {/* Hidden internal tab — thin separator + dimmed */}
          <div style={{ width: "0.5px", background: "rgba(255,255,255,0.08)", margin: "8px 10px", flexShrink: 0 }} />
          {(() => {
            const isA = guruIntelTab === "incomeoptimization";
            return (
              <button
                onClick={() => setGuruIntelTab("incomeoptimization")}
                onMouseEnter={e => { if (!isA) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)"; }}
                onMouseLeave={e => { if (!isA) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.30)"; }}
                style={{ ...CHROME, color: isA ? "#fff" : "rgba(255,255,255,0.30)", border: "none", borderBottom: isA ? "2px solid #FFFFFF" : "2px solid transparent", background: "none", cursor: "pointer", padding: "0 14px", height: 34, whiteSpace: "nowrap" as const, lineHeight: 1, userSelect: "none" as const, transition: "color 0.12s, border-color 0.12s", alignSelf: "stretch", display: "flex", alignItems: "center", gap: 5 }}
              >
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", opacity: 0.6 }}>◆</span>
                Reallocation Calculator
              </button>
            );
          })()}
        </div>
      )}
    </div>
  );

  // ── Page header component ────────────────────────────────────────────────────
  const PageHeader = ({ eyebrow, headline, subtitle }: { eyebrow: string; headline: string; subtitle: string }) => (
    <div style={{ padding: "32px 40px 0", flexShrink: 0 }}>
      <div style={{ ...CHROME, color: "rgba(0,0,0,0.32)", marginBottom: 12 }}>{eyebrow}</div>
      <div style={{ fontFamily: PF, fontWeight: 400, fontSize: 28, color: NAVY, letterSpacing: "-0.02em", lineHeight: 1.2, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{headline}</div>
      <div style={{ fontFamily: DM, fontWeight: 400, fontSize: 13, color: "rgba(0,0,0,0.45)", lineHeight: 1.65, marginTop: 8 }}>{subtitle}</div>
    </div>
  );

  return (
    <Layout topNav={topNav}>

      {/* ── FINANCIAL MODEL VIEW ───────────────────────────────────────────────── */}
      {activeView === "financialmodel" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#ECEAE4" }}>
          {financialModelTab === "balancesheet" && (
            <BalanceSheetView assets={assets} liabilities={liabilities} cashFlows={cashFlows} />
          )}
          {financialModelTab === "cashflow" && (
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              <CashFlowAdvisorView assets={assets} cashFlows={cashFlows} />
            </div>
          )}
        </div>
      )}

      {/* ── ALLOCATION VIEW ────────────────────────────────────────────────────── */}
      {activeView === "guru" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "hsl(220,5%,93%)" }}>
          <GuruLandingView assets={assets} cashFlows={cashFlows} onStartReview={() => {}} skipLanding={false} />
        </div>
      )}

      {/* ── INVESTMENTS VIEW ───────────────────────────────────────────────────── */}
      {activeView === "investments" && (
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "hsl(220,5%,93%)" }}>
          <div style={{ padding: "24px 40px 80px", maxWidth: 900 }}>
            <BrokeragePanel assets={assets} />
          </div>
        </div>
      )}

      {/* ── ADVISOR BRIEF VIEW ─────────────────────────────────────────────────── */}
      {activeView === "advisorbrief" && (
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <AdvisorBriefView assets={assets} cashFlows={cashFlows} liabilities={liabilities} onNavigate={(v) => setActiveView(v as ActiveView)} />
        </div>
      )}

      {/* ── GURU INTELLIGENCE VIEW ─────────────────────────────────────────────── */}
      {activeView === "guruintelligence" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#141c2b" }}>

          {/* ── Bloomberg-style ticker strip ── */}
          <div style={{ background: "rgba(10,18,32,0.7)", borderBottom: "1px solid rgba(42,74,110,0.35)", padding: "0 40px", height: 27, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, overflow: "hidden", position: "relative" }}>
            <div style={{ width: "35%", height: "100%", position: "absolute", left: "-20%", background: "linear-gradient(90deg,transparent,rgba(180,210,255,0.04),transparent)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
              <span style={{ fontFamily: DM, fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(180,210,255,0.75)" }}>▶ GURU AI · Scan active</span>
              <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
              <span style={{ fontFamily: DM, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, padding: "1px 7px", borderRadius: 2, background: "rgba(94,204,138,0.10)", border: "1px solid rgba(94,204,138,0.25)", color: "hsl(152,55%,60%)" }}>● LIVE</span>
              <span style={{ fontFamily: DM, fontSize: 9, fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)" }}>6 accounts synced · {format(DEMO_NOW, "MMM d, yyyy")} · 9:42 AM</span>
              <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
              <span style={{ fontFamily: DM, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, padding: "1px 7px", borderRadius: 2, background: "rgba(255,200,60,0.08)", border: "1px solid rgba(255,200,60,0.22)", color: "rgba(255,200,60,0.8)" }}>2 actions pending</span>
              <span style={{ fontFamily: DM, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, padding: "1px 7px", borderRadius: 2, background: "rgba(91,143,204,0.08)", border: "1px solid rgba(91,143,204,0.22)", color: "rgba(180,210,255,0.7)" }}>1 opportunity</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
              <span style={{ fontFamily: DM, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, padding: "1px 7px", borderRadius: 2, background: "rgba(180,210,255,0.06)", border: "1px solid rgba(180,210,255,0.15)", color: "rgba(180,210,255,0.5)" }}>Demo: {format(DEMO_NOW, "MMMM d, yyyy")}</span>
              <span style={{ fontFamily: DM, fontSize: 9, color: "rgba(255,255,255,0.22)", letterSpacing: "0.05em", textTransform: "uppercase" as const }}>GURU AI · Detection System</span>
            </div>
          </div>

          {guruIntelTab === "networth" && (
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0, marginTop: 24 }}>
              <DetailsView assets={assets} liabilities={liabilities} cashFlows={cashFlows} clientId={clientId} />
            </div>
          )}
          {guruIntelTab === "cashflow" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
              <DetectionSystemView assets={assets} cashFlows={cashFlows} onNavigate={(v) => setActiveView(v as ActiveView)} />
            </div>
          )}
          {guruIntelTab === "moneymovement" && (
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0, marginTop: 24 }}>
              <div style={{ padding: "0 40px 80px" }}>
                <MoneyMovementView assets={assets} cashFlows={cashFlows} opsCashMonths={opsCashMonths} clientName={client.name} pendingTransfers={pendingTransfers} bucketProductSelections={bucketProductSelections} />
              </div>
            </div>
          )}
          {guruIntelTab === "incomeoptimization" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", marginTop: 0 }}>
              <iframe
                src="/income-optimization.html"
                style={{ flex: 1, width: "100%", height: "100%", border: "none", display: "block" }}
                title="Income Optimization"
              />
            </div>
          )}
          {guruIntelTab === "liquiditymodel" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", marginTop: 24 }}>
              <LiquidityWaterfallView assets={assets} cashFlows={cashFlows} />
            </div>
          )}
          {guruIntelTab === "cfforecast" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", marginTop: 24 }}>
              <CashFlowForecastWaterfallView assets={assets} cashFlows={cashFlows} />
            </div>
          )}
        </div>
      )}

      {/* ── Legacy views (kept for backward compat) ─────────────────────────────── */}
      {activeView === "balancesheet" && (
        <BalanceSheetView assets={assets} liabilities={liabilities} cashFlows={cashFlows} />
      )}
      {activeView === "assetoverview" && (
        <AssetOverviewView assets={assets} liabilities={liabilities} cashFlows={cashFlows} />
      )}
      {activeView === "financials" && (
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {financialsTab === "balancesheet" && (
            <DetailsView assets={assets} liabilities={liabilities} cashFlows={cashFlows} clientId={clientId} />
          )}
          {financialsTab === "cashflow" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
              <DetectionSystemView assets={assets} cashFlows={cashFlows} onNavigate={(v) => setActiveView(v as ActiveView)} />
            </div>
          )}
        </div>
      )}
      {activeView === "guru_v1" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <iframe src="/alloc-v1-original.html" title="Allocation v1" style={{ flex: 1, width: "100%", border: "none", display: "block", minHeight: 0 }} />
        </div>
      )}
      {activeView === "moneymovement" && (
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "#f5f4f0" }}>
          <div style={{ padding: "18px 24px 14px", display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 300, color: "#1a2e4a", letterSpacing: "-0.01em", margin: 0, lineHeight: 1 }}>Money Movement</h1>
            <span style={{ fontSize: 11, color: "rgba(0,0,0,0.40)", letterSpacing: "0.04em" }}>Kessler Family · {format(DEMO_NOW, "MMMM d, yyyy")}</span>
          </div>
          <div style={{ padding: "0 24px 48px" }}>
            <MoneyMovementView assets={assets} cashFlows={cashFlows} opsCashMonths={opsCashMonths} clientName={client.name} pendingTransfers={pendingTransfers} bucketProductSelections={bucketProductSelections} />
          </div>
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
