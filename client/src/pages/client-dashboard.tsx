import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useClientDashboard, useGenerateStrategy } from "@/hooks/use-clients";
import {
  AddAssetModal,
  AddLiabilityModal,
  AddCashFlowModal,
} from "@/components/financial-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  LabelList,
  Legend,
} from "recharts";
import {
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
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
} from "lucide-react";
import { motion } from "framer-motion";
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
  const now = new Date();
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
  const visRows = 6;
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
    label: "Reserve",
    short: "Instantly available transaction accounts",
    color: "hsl(221,83%,53%)",
    tagCls: "bg-blue-100   text-blue-700",
  },
  yield: {
    label: "Yield",
    short: "Penalty-free, higher-yielding accounts",
    color: "hsl(43,74%,50%)",
    tagCls: "bg-amber-100  text-amber-700",
  },
  tactical: {
    label: "Tactical",
    short: "1–2 days to settle or committed for a term",
    color: "hsl(142,71%,40%)",
    tagCls: "bg-emerald-100 text-emerald-700",
  },
  growth: {
    label: "Growth",
    short: "Long-horizon investments — higher return potential",
    color: "hsl(262,72%,55%)",
    tagCls: "bg-violet-100 text-violet-700",
  },
  alternatives: {
    label: "Alternatives",
    short: "Real estate, private equity, RSUs — strategic illiquid assets",
    color: "hsl(25,90%,52%)",
    tagCls: "bg-orange-100 text-orange-700",
  },
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
    return {
      month: format(month, "MMM"),
      inflow: d.inflow,
      outflow: d.outflow,
      net,
      cumulative,
    };
  });
}

function buildNWProjection(
  netWorth: number,
  cashFlows: CashFlow[],
  assets: Asset[],
) {
  const annualSurplus = buildForecast(cashFlows).reduce((s, d) => s + d.net, 0);
  // Growth assets (equity + alternatives + real estate) compound at conservative 6.5% annually
  const growthValue = assets
    .filter((a) => ["equity", "alternative", "real_estate"].includes(a.type))
    .reduce((s, a) => s + Number(a.value), 0);
  const GROWTH_RATE = 0.065;
  const now = new Date();
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
      <div className="px-4 pt-4 pb-0 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
            Net Worth{" "}
            <span className="text-muted-foreground/60 font-normal normal-case tracking-normal">
              · Today
            </span>
          </p>
          <p
            className="text-2xl font-bold text-foreground"
            data-testid="kpi-net-worth"
          >
            {fmt(netWorth)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            5-Year Projection
          </p>
          <p className="text-base font-bold text-blue-600">
            {fmt(projYear5, true)}
          </p>
        </div>
      </div>
      <div className="h-28 px-1 mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={projData}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BLUE} stopOpacity={0.2} />
                <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={BLUE}
              strokeWidth={2}
              fill="url(#nwGrad)"
              dot={(props: any) => {
                const { cx, cy, index } = props;
                if (index === 0)
                  return (
                    <g key="nw-now">
                      <circle
                        cx={cx}
                        cy={cy}
                        r={10}
                        fill={BLUE}
                        opacity={0.12}
                        style={{
                          animation: "live-pulse 2s ease-in-out infinite",
                          transformOrigin: `${cx}px ${cy}px`,
                        }}
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={3.5}
                        fill={BLUE}
                        stroke="white"
                        strokeWidth={1.5}
                      />
                    </g>
                  );
                if (index === projData.length - 1)
                  return (
                    <circle
                      key="nw-end"
                      cx={cx}
                      cy={cy}
                      r={3.5}
                      fill={BLUE}
                      stroke="white"
                      strokeWidth={1.5}
                    />
                  );
                return <g key={index} />;
              }}
              activeDot={{ r: 5, stroke: "white", strokeWidth: 2 }}
            />
            <ReferenceLine
              x="Now"
              stroke={BLUE}
              strokeDasharray="3 3"
              strokeOpacity={0.4}
            />
            <RechartsTooltip
              formatter={(v: number) => [fmt(v), "Net Worth"]}
              contentStyle={{ fontSize: 11 }}
            />
          </AreaChart>
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
        <div className="space-y-0.5 max-h-40 overflow-y-auto">
          {view === "assets" ? (
            <>
              {sortedAssets.slice(0, 9).map((a) => {
                const tag = liquidityTag(a);
                const label = a.description.split("(")[0].split("—")[0].trim();
                return (
                  <div
                    key={a.id}
                    className="flex justify-between items-center text-xs py-0.5 gap-1"
                  >
                    <span
                      className={`text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0 ${tag.tagCls}`}
                    >
                      {tag.label}
                    </span>
                    <span
                      className="text-muted-foreground truncate flex-1"
                      title={label}
                    >
                      {label}
                    </span>
                    <span className="font-semibold tabular-nums flex-shrink-0">
                      {fmt(Number(a.value))}
                    </span>
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
              {Object.entries(liabGroups)
                .sort((a, b) => b[1] - a[1])
                .map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between items-center text-xs py-0.5"
                  >
                    <span
                      className="text-muted-foreground truncate pr-2"
                      style={{ maxWidth: "65%" }}
                    >
                      {label}
                    </span>
                    <span className="font-semibold tabular-nums text-rose-600">
                      -{fmt(value)}
                    </span>
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
  const minVal = Math.min(...data.map((d) => d.cumulative));
  const maxVal = Math.max(...data.map((d) => d.cumulative));
  const troughIdx = data.findIndex((d) => d.cumulative === minVal);
  const troughMonth = data[troughIdx]?.month ?? "";
  const hasTrough = minVal < 0;
  const range = maxVal - minVal || 1;
  const zeroOffset = `${Math.max(0, Math.min(100, (maxVal / range) * 100)).toFixed(1)}%`;
  const finalVal = data[data.length - 1]?.cumulative ?? 0;
  const isPositive = annualNet >= 0;

  return (
    <div className={PANEL_CLS}>
      <div className="px-4 pt-4 pb-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              12-Month Cash Flow
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {isPositive ? (
                <TrendingUp className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              ) : (
                <TrendingDown className="w-5 h-5 text-rose-500 flex-shrink-0" />
              )}
              <p
                className={`text-xl font-bold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}
                data-testid="kpi-annual-net"
              >
                {isPositive ? "+" : ""}
                {fmt(annualNet, true)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isPositive
                ? "Net surplus over 12 months"
                : "Net deficit over 12 months"}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground mt-0.5">
            <p>Monthly avg</p>
            <p
              className={`font-bold text-sm ${annualNet / 12 >= 0 ? "text-emerald-600" : "text-rose-600"}`}
            >
              {annualNet / 12 >= 0 ? "+" : ""}
              {fmtK(Math.round(annualNet / 12))}/mo
            </p>
          </div>
        </div>
      </div>
      <div className="px-1 pb-2" style={{ height: 198 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 30, right: 48, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset={zeroOffset}
                  stopColor={GREEN}
                  stopOpacity={0.28}
                />
                <stop offset={zeroOffset} stopColor={RED} stopOpacity={0.22} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
            />
            <XAxis
              dataKey="month"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmtK}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <ReferenceLine
              y={0}
              stroke="hsl(var(--border))"
              strokeWidth={1.5}
            />
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
                      <rect
                        x={x - 33}
                        y={y - 34}
                        width={66}
                        height={28}
                        rx={4}
                        fill="hsl(0,80%,97%)"
                        stroke="hsl(0,80%,80%)"
                        strokeWidth={1}
                      />
                      <text
                        x={x}
                        y={y - 22}
                        textAnchor="middle"
                        fill="hsl(0,72%,50%)"
                        fontSize={8}
                        fontWeight="700"
                      >
                        TROUGH
                      </text>
                      <text
                        x={x}
                        y={y - 11}
                        textAnchor="middle"
                        fill="hsl(0,72%,45%)"
                        fontSize={9}
                        fontWeight="800"
                      >
                        {fmt(minVal, true)}
                      </text>
                      <polygon
                        points={`${x - 5},${y - 6} ${x + 5},${y - 6} ${x},${y}`}
                        fill="hsl(0,80%,80%)"
                      />
                    </g>
                  );
                }}
              />
            )}
            <RechartsTooltip
              formatter={(v: number, name: string) => [
                fmt(v),
                name === "cumulative" ? "Cumulative Net" : "Monthly Net",
              ]}
              contentStyle={{ fontSize: 11 }}
            />
            <Bar dataKey="net" radius={[2, 2, 0, 0]} maxBarSize={12}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.net >= 0 ? "hsl(142,60%,55%)" : "hsl(0,72%,60%)"}
                  fillOpacity={0.4}
                />
              ))}
            </Bar>
            <Area
              type="monotone"
              dataKey="cumulative"
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
                      <circle
                        cx={cx}
                        cy={cy}
                        r={11}
                        fill={liveCol}
                        opacity={0.12}
                        style={{
                          animation: "live-pulse 2s ease-in-out infinite",
                          transformOrigin: `${cx}px ${cy}px`,
                        }}
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={4.5}
                        fill={liveCol}
                        stroke="white"
                        strokeWidth={1.5}
                      />
                      <text
                        x={cx}
                        y={cy - 11}
                        textAnchor="middle"
                        fill={liveCol}
                        fontSize={8}
                        fontWeight="800"
                      >
                        NOW
                      </text>
                    </g>
                  );
                }
                if (index === data.length - 1) {
                  const arrowChar = isPositive ? "▲" : "▼";
                  const col = isPositive
                    ? "hsl(142,71%,35%)"
                    : "hsl(0,72%,50%)";
                  return (
                    <g key="end-dot">
                      <circle
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={isPositive ? GREEN : RED}
                        stroke="white"
                        strokeWidth={2}
                      />
                      <text
                        x={cx + 8}
                        y={cy + 4}
                        fill={col}
                        fontSize={8}
                        fontWeight="800"
                      >
                        {arrowChar} {fmtK(finalVal)}
                      </text>
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
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{" "}
          Surplus
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />{" "}
          Deficit
        </span>
        {hasTrough && (
          <span className="flex items-center gap-1 ml-auto text-rose-500 font-semibold">
            Trough at {troughMonth}
          </span>
        )}
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
  const [active, setActive] = useState<GuroBucket>("reserve");
  const {
    reserve,
    yieldBucket,
    tactical,
    growth,
    alts,
    reserveItems,
    yieldItems,
    tacticalItems,
    growthItems,
    altItems,
    totalLiquid,
  } = cashBuckets(assets);

  const bucketValues: Record<GuroBucket, number> = {
    reserve,
    yield: yieldBucket,
    tactical,
    growth,
    alternatives: alts,
  };
  const bucketItems: Record<GuroBucket, { label: string; value: number }[]> = {
    reserve: reserveItems,
    yield: yieldItems,
    tactical: tacticalItems,
    growth: growthItems,
    alternatives: altItems,
  };

  const forecastData = buildForecast(cashFlows);
  const cashTrough = computeTrough(forecastData);
  const isSufficient = totalLiquid >= cashTrough;
  const totalAll = reserve + yieldBucket + tactical + growth + alts;

  const donutData = GURU_BUCKET_ORDER.map((k) => ({
    name: GURU_BUCKETS[k].label,
    value: bucketValues[k],
    color: GURU_BUCKETS[k].color,
  })).filter((d) => d.value > 0);

  const activeItems = bucketItems[active] ?? [];
  const activeTotal = bucketValues[active] ?? 0;
  const isLiquid =
    active === "reserve" || active === "yield" || active === "tactical";

  return (
    <div className={PANEL_CLS + " flex flex-col"}>
      <div className="px-4 pt-4 pb-2 border-b border-border">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
          The GURU Method
        </p>
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold ${isSufficient ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
        >
          {isSufficient ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5" />
          )}
          {isSufficient
            ? "LIQUID RESERVES SUFFICIENT"
            : "CASH SHORTFALL — ACTION NEEDED"}
        </div>
      </div>

      {/* Donut + legend */}
      <div className="flex items-center px-3 py-2 gap-2">
        <div style={{ width: 88, height: 88, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={24}
                outerRadius={40}
                dataKey="value"
                paddingAngle={2}
              >
                {donutData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(v: number, n: string) => [fmt(v), n]}
                contentStyle={{ fontSize: 10 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-0.5 text-xs min-w-0">
          {GURU_BUCKET_ORDER.map((k) => {
            const v = bucketValues[k];
            if (!v) return null;
            const pct = totalAll > 0 ? Math.round((v / totalAll) * 100) : 0;
            return (
              <button
                key={k}
                onClick={() => setActive(k)}
                className={`w-full flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-colors text-left ${active === k ? "bg-secondary" : "hover:bg-secondary/50"}`}
                data-testid={`bucket-${k}`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: GURU_BUCKETS[k].color }}
                />
                <span
                  className={`font-bold flex-shrink-0 ${active === k ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {GURU_BUCKETS[k].label}
                </span>
                <span className="text-muted-foreground ml-auto tabular-nums flex-shrink-0">
                  {pct}%
                </span>
                <span className="font-semibold tabular-nums flex-shrink-0">
                  {fmt(v, true)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active bucket detail */}
      <div className="px-3 pb-3 flex-1">
        <div
          className={`rounded-lg px-3 py-2 mb-2 border ${GURU_BUCKETS[
            active
          ].tagCls
            .split(" ")
            .map((c) =>
              c
                .replace("text-", "border-")
                .replace("700", "200")
                .replace("bg-", "bg-"),
            )
            .join(" ")}`}
          style={{ borderColor: GURU_BUCKETS[active].color + "40" }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: GURU_BUCKETS[active].color }}
          >
            {GURU_BUCKETS[active].label}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {GURU_BUCKETS[active].short}
          </p>
        </div>
        <div className="space-y-0.5">
          {activeItems.map((item, i) => (
            <div
              key={`${item.label}-${i}`}
              className="flex justify-between text-xs"
            >
              <span className="text-muted-foreground truncate pr-2">
                {item.label}
              </span>
              <span className="font-semibold tabular-nums">
                {fmt(item.value)}
              </span>
            </div>
          ))}
          {activeItems.length > 0 && (
            <div className="flex justify-between text-xs font-bold border-t border-border pt-1 mt-1">
              <span>{GURU_BUCKETS[active].label} Total</span>
              <span>{fmt(activeTotal)}</span>
            </div>
          )}
          {activeItems.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No assets in this bucket
            </p>
          )}
          {!isLiquid && (
            <p className="text-[10px] text-muted-foreground mt-1 italic">
              Not included in 12-month liquidity calculation
            </p>
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

  const typeMap: Record<string, number> = {};
  for (const a of [...brokerageAssets, ...retirementAssets]) {
    const label =
      a.type === "equity"
        ? "Equities"
        : a.type === "fixed_income"
          ? "Fixed Income"
          : "Alternatives";
    typeMap[label] = (typeMap[label] || 0) + Number(a.value);
  }
  const pieData = Object.entries(typeMap).map(([name, value]) => ({
    name,
    value,
  }));
  const PIE_COLORS = [
    "hsl(221,83%,53%)",
    "hsl(142,71%,40%)",
    "hsl(0,84%,60%)",
    "hsl(43,74%,56%)",
  ];

  const spyUp = (spyQuote?.changePercent ?? 0) >= 0;

  return (
    <div className={PANEL_CLS}>
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Taxable Brokerage + Retirement
        </p>
        <p
          className="text-2xl font-bold text-foreground"
          data-testid="kpi-brokerage"
        >
          {fmt(total, true)}
        </p>
        <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
          <span>
            Brokerage{" "}
            <span className="font-semibold text-foreground">
              {fmt(totalBrok, true)}
            </span>
          </span>
          <span>
            Retirement{" "}
            <span className="font-semibold text-foreground">
              {fmt(totalRet, true)}
            </span>
          </span>
        </div>
        {spyQuote ? (
          <div className="flex items-center gap-3 text-xs mt-1">
            <span
              className={`font-semibold flex items-center gap-0.5 ${spyUp ? "text-emerald-600" : "text-rose-600"}`}
            >
              {spyUp ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              S&P {spyUp ? "+" : ""}
              {spyQuote.changePercent?.toFixed(2)}% today
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground">
              SPY ${spyQuote.price?.toFixed(2)}
            </span>
          </div>
        ) : (
          <div className="flex gap-4 text-xs mt-1">
            <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              4.32% YTD
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-4 pb-3">
        <div style={{ width: 110, height: 110, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                dataKey="value"
                paddingAngle={4}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(v: number, n: string) => [fmt(v), n]}
                contentStyle={{ fontSize: 10 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1">
          {pieData.map((d, i) => (
            <div
              key={d.name}
              className="flex justify-between items-center text-xs"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="text-muted-foreground">{d.name}</span>
              </span>
              <span className="font-semibold tabular-nums">
                {fmt(d.value, true)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-border mx-4 mb-3" />
      <div className="px-4 pb-4 space-y-1">
        {[...brokerageAssets, ...retirementAssets].slice(0, 5).map((a) => {
          const isGS =
            (a.description ?? "").toLowerCase().includes("goldman") ||
            (a.description ?? "").toLowerCase().includes("rsu");
          const livePrice = isGS && gsQuote ? gsQuote : null;
          const gsUp = (gsQuote?.changePercent ?? 0) >= 0;
          return (
            <div
              key={a.id}
              className="flex justify-between items-center text-xs gap-1"
            >
              <span className="text-muted-foreground truncate pr-1 flex-1">
                {a.description.split("(")[0].split("—")[0].trim()}
              </span>
              {livePrice && (
                <span
                  className={`font-semibold flex-shrink-0 ${gsUp ? "text-emerald-600" : "text-rose-600"}`}
                >
                  GS ${livePrice.price?.toFixed(2)}
                </span>
              )}
              <span className="font-semibold tabular-nums flex-shrink-0">
                {fmt(Number(a.value), true)}
              </span>
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
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Income vs. Expense Projection
        </p>
      </div>
      <div className="flex-1 overflow-x-auto px-4 pb-4">
        <table className="w-full text-xs" style={{ minWidth: 480 }}>
          <thead>
            <tr className="border-b border-border">
              <td
                className="pb-1.5 text-muted-foreground font-semibold pr-3"
                style={{ minWidth: 90 }}
              ></td>
              {data.map((d) => (
                <td
                  key={d.month}
                  className="pb-1.5 text-muted-foreground text-center font-medium tabular-nums"
                  style={{ minWidth: 52 }}
                >
                  {d.month}
                </td>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            <tr>
              <td className="py-1.5 font-semibold text-foreground pr-3">
                Income
              </td>
              {data.map((d) => (
                <td
                  key={d.month}
                  className="py-1.5 text-center tabular-nums text-emerald-700"
                >
                  {fmtK(d.inflow)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-1.5 font-semibold text-foreground pr-3">
                Expenses
              </td>
              {data.map((d) => (
                <td
                  key={d.month}
                  className="py-1.5 text-center tabular-nums text-rose-600"
                >
                  ({fmtK(d.outflow)})
                </td>
              ))}
            </tr>
            <tr className="bg-secondary/30">
              <td className="py-1.5 font-bold text-foreground pr-3">
                Net Cash Flow
              </td>
              {data.map((d) => (
                <td
                  key={d.month}
                  className={`py-1.5 text-center font-bold tabular-nums ${d.net >= 0 ? "text-emerald-700" : "text-rose-600"}`}
                >
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
function GuruOptimizerPanel({
  assets,
  cashFlows,
}: {
  assets: Asset[];
  cashFlows: CashFlow[];
}) {
  const { reserve, yieldBucket, tactical, totalLiquid } = cashBuckets(assets);
  const forecastData = buildForecast(cashFlows);
  const cashTrough = computeTrough(forecastData);
  const cashExcess = totalLiquid - cashTrough;

  // Idle cash in checking earning near-zero → yield improvement
  const additionalCashIncome = Math.round(reserve * 0.036); // ~3.6% money market rate on Reserve cash

  // Investment optimization: cash sitting in brokerage + excess bank cash
  const brokerageCash = assets
    .filter(
      (a) =>
        a.type === "cash" &&
        (a.description ?? "").toLowerCase().includes("brokerage"),
    )
    .reduce((s, a) => s + Number(a.value), 0);
  const totalToInvest = Math.round(brokerageCash + Math.max(0, cashExcess));
  const investPctIncrease = assets
    .filter((a) => ["equity", "alternative"].includes(a.type))
    .reduce((s, a) => s + Number(a.value), 0);
  const investPct =
    investPctIncrease > 0
      ? Math.round((totalToInvest / investPctIncrease) * 100)
      : 0;
  const cashFlowPct =
    additionalCashIncome > 0 &&
    cashFlows
      .filter((c) => c.type === "inflow")
      .reduce((s, c) => s + Number(c.amount), 0) /
      12 >
      0
      ? Math.round(
          (additionalCashIncome /
            (cashFlows
              .filter((c) => c.type === "inflow")
              .reduce((s, c) => s + Number(c.amount), 0) /
              12)) *
            100,
        )
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
          <p className="text-xs font-bold text-foreground mb-3">
            Cash Optimizer
          </p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">
                Cash Excess / Deficit
              </p>
              <p
                className={`font-bold text-base ${cashExcess >= 0 ? "text-emerald-600" : "text-rose-600"}`}
              >
                {fmt(cashExcess, true)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Additional Cash Income / Year
              </p>
              <p className="font-bold text-base text-foreground">
                {fmt(additionalCashIncome, true)}
              </p>
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
          <p className="text-xs font-bold text-foreground mb-3">
            Investments Optimizer
          </p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">
                Total Cash to Invest (A+B)
              </p>
              <p className="font-bold text-base text-foreground">
                {fmt(totalToInvest, true)}
              </p>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  A: Investment accts idle cash
                </span>
                <span className="font-semibold">
                  {fmt(brokerageCash, true)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  B: Excess cash to reallocate
                </span>
                <span className="font-semibold">
                  {fmt(Math.max(0, cashExcess), true)}
                </span>
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
    value: number;
    rate: string | null;
    comment: AssetComment | null;
  }[];
  subtotal: number;
  avgRate: string | null;
}

function buildAssetGroups(assets: Asset[]): BsGroup[] {
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
    !isRSU(a) &&
    ((a.description ?? "").toLowerCase().includes("brokerage") ||
      (a.description ?? "").toLowerCase().includes("taxable") ||
      (a.description ?? "").toLowerCase().includes("fidelity"));

  const checking = assets.filter(
    (a) =>
      a.type === "cash" &&
      (a.description ?? "").toLowerCase().includes("checking"),
  );
  const savingsMM = assets.filter(
    (a) =>
      a.type === "cash" &&
      !(a.description ?? "").toLowerCase().includes("checking"),
  );
  const brokerage = assets.filter((a) => isBrokerage(a));
  const altAssets = assets.filter(
    (a) => a.type === "alternative" && !isCarry(a),
  );
  const carry = assets.filter((a) => isCarry(a));
  const rsus = assets.filter((a) => isRSU(a));
  const realEstate = assets.filter((a) => a.type === "real_estate");
  const retirement = assets.filter((a) => isRetirement(a));

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
    groups.push({
      category: "Checking Bank Accounts",
      items: checking.map(toItem),
      subtotal: subtot(checking),
      avgRate: wavgRate(checking),
    });
  }
  if (savingsMM.length > 0) {
    groups.push({
      category: "Savings & Money Market Accounts",
      items: savingsMM.map(toItem),
      subtotal: subtot(savingsMM),
      avgRate: wavgRate(savingsMM),
    });
  }
  const totalCash = subtot([...checking, ...savingsMM]);
  if (totalCash > 0) {
    groups.push({
      category: "Cash",
      items: [],
      subtotal: totalCash,
      avgRate: wavgRate([...checking, ...savingsMM]),
    });
  }
  const investments = [...brokerage, ...altAssets];
  if (brokerage.length > 0) {
    groups.push({
      category: "Taxable Brokerage",
      items: brokerage.map(toItem),
      subtotal: subtot(brokerage),
      avgRate: null,
    });
  }
  if (altAssets.length > 0) {
    groups.push({
      category: "Alternative Assets",
      items: altAssets.map(toItem),
      subtotal: subtot(altAssets),
      avgRate: null,
    });
  }
  if (investments.length > 0) {
    groups.push({
      category: "Investments",
      items: [],
      subtotal: subtot(investments),
      avgRate: null,
    });
  }
  if (carry.length > 0) {
    groups.push({
      category: "Carry",
      items: carry.map(toItem),
      subtotal: subtot(carry),
      avgRate: null,
    });
  }
  if (rsus.length > 0) {
    const carryAndRSUs = [...carry, ...rsus];
    groups.push({
      category: "Carry and RSUs",
      items: rsus.map(toItem),
      subtotal: subtot(carryAndRSUs),
      avgRate: null,
    });
  }
  if (realEstate.length > 0) {
    groups.push({
      category: "Real Estate",
      items: realEstate.map(toItem),
      subtotal: subtot(realEstate),
      avgRate: null,
    });
  }
  if (retirement.length > 0) {
    groups.push({
      category: "Retirement",
      items: retirement.map(toItem),
      subtotal: subtot(retirement),
      avgRate: null,
    });
  }

  return groups;
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
    value: Number(l.value),
    rate:
      parseFloat(l.interestRate) > 0
        ? parseFloat(l.interestRate).toFixed(2)
        : null,
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
  groups,
  totalLabel,
  totalValue,
  totalRate,
  isLiability = false,
}: {
  groups: BsGroup[];
  totalLabel: string;
  totalValue: number;
  totalRate?: string | null;
  isLiability?: boolean;
}) {
  const isSubtotalOnly = (g: BsGroup) => g.items.length === 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden text-xs">
      <div
        className="grid bg-[hsl(221,39%,24%)] text-white font-semibold"
        style={{ gridTemplateColumns: "1fr 90px 56px 90px" }}
      >
        <div className="px-3 py-2">
          {isLiability ? "Liability Category" : "Asset Category"}
        </div>
        <div className="px-2 py-2 text-right">Current Balance</div>
        <div className="px-2 py-2 text-right">
          {isLiability ? "Cost" : "Return"}
        </div>
        <div className="px-2 py-2">Comments</div>
      </div>

      {groups.map((group, gi) => (
        <div key={gi}>
          {!isSubtotalOnly(group) &&
            group.items.map((item, ii) => (
              <div
                key={ii}
                className="grid border-t border-border hover:bg-secondary/20"
                style={{ gridTemplateColumns: "1fr 90px 56px 90px" }}
              >
                <div className="px-4 py-1.5 text-muted-foreground pl-5">
                  {item.label}
                </div>
                <div className="px-2 py-1.5 text-right tabular-nums font-medium">
                  {item.value > 0 ? fmt(item.value) : "—"}
                </div>
                <div className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                  {item.rate ? (
                    `${item.rate}%`
                  ) : item.value > 0 ? (
                    <span className="italic text-muted-foreground/60">
                      [Ret]
                    </span>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="px-2 py-1.5">
                  {item.comment && (
                    <span
                      className={`font-semibold ${item.comment.color === "red" ? "text-rose-600" : item.comment.color === "orange" ? "text-amber-600" : "text-muted-foreground"}`}
                    >
                      {item.comment.text}
                    </span>
                  )}
                </div>
              </div>
            ))}
          <div
            className={`grid border-t font-semibold ${isSubtotalOnly(group) ? "bg-[hsl(221,39%,20%)] text-white" : "bg-[hsl(221,15%,88%)] text-[hsl(221,39%,20%)]"}`}
            style={{ gridTemplateColumns: "1fr 90px 56px 90px" }}
          >
            <div className="px-3 py-1.5">{group.category}</div>
            <div className="px-2 py-1.5 text-right tabular-nums">
              {fmt(group.subtotal)}
            </div>
            <div className="px-2 py-1.5 text-right tabular-nums">
              {group.avgRate
                ? `${group.avgRate}%`
                : isSubtotalOnly(group)
                  ? ""
                  : ""}
            </div>
            <div className="px-2 py-1.5" />
          </div>
        </div>
      ))}

      <div
        className="grid border-t-2 border-[hsl(221,39%,24%)] bg-[hsl(43,74%,56%)] text-white font-bold"
        style={{ gridTemplateColumns: "1fr 90px 56px 90px" }}
      >
        <div className="px-3 py-2">{totalLabel}</div>
        <div className="px-2 py-2 text-right tabular-nums">
          {fmt(totalValue)}
        </div>
        <div className="px-2 py-2 text-right tabular-nums">
          {totalRate ? `${totalRate}%` : ""}
        </div>
        <div className="px-2 py-2" />
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
    descs: ["Monthly Net Salary"],
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
    descs: ["Tribeca Mortgage"],
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
    label: "Rental Income (net of mgmt fee)",
    descs: ["Sarasota Rental Income"],
  },
  {
    key: "sara_exp",
    kind: "item",
    label: "Property Expenses (mgmt + HOA + mortgage)",
    descs: ["Sarasota Property Expenses"],
  },
  {
    key: "fl_tax",
    kind: "item",
    label: "FL Property Taxes (annual)",
    descs: ["FL Property Taxes"],
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
    label: "Childcare / Babysitter",
    descs: ["Childcare"],
  },
  {
    key: "food",
    kind: "item",
    label: "Food, Groceries & Dining",
    descs: ["Food, Groceries"],
  },
  {
    key: "sub_living",
    kind: "subtotal",
    label: "Total Living Expenses",
    sumOf: ["childcare", "food"],
  },
  { key: "g_edu", kind: "group", label: "EDUCATION" },
  {
    key: "tuition",
    kind: "item",
    label: "Private School Tuition (quarterly)",
    descs: ["Tuition"],
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
    descs: ["Student Loan"],
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
    label: "Q4 Estimated Federal Income Tax",
    descs: ["Estimated Federal"],
  },
  { key: "g_travel", kind: "group", label: "TRAVEL & LIFESTYLE" },
  {
    key: "trav_mem",
    kind: "item",
    label: "Memorial Day Travel",
    descs: ["Memorial Day"],
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
    label: "Summer Vacation (Europe)",
    descs: ["Summer Vacation"],
  },
  {
    key: "golf",
    kind: "item",
    label: "Golf Club Annual Dues",
    descs: ["Golf Club"],
  },
  {
    key: "sub_travel",
    kind: "subtotal",
    label: "Total Travel & Lifestyle",
    sumOf: ["trav_mem", "trav_wknd", "trav_sum", "golf"],
  },
];

const CF_MONTHS = [
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
  { label: "Jan", year: 2027, month: 1 },
  { label: "Feb", year: 2027, month: 2 },
];

function CashFlowForecastView({
  assets,
  cashFlows,
}: {
  assets: Asset[];
  cashFlows: CashFlow[];
}) {
  const { reserve } = cashBuckets(assets);
  const startBalance = reserve;
  const wfData = buildWaterfallData(cashFlows, startBalance);

  function monthVal(descs: string[], year: number, month: number): number {
    return cashFlows
      .filter((cf) => {
        const d = new Date(cf.date);
        return (
          d.getFullYear() === year &&
          d.getMonth() + 1 === month &&
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

  const netByMonth = CF_MONTHS.map((_, mi) =>
    CF_PL_ROWS.filter((r) => r.kind === "item").reduce(
      (s, r) => s + (vals[r.key]?.[mi] ?? 0),
      0,
    ),
  );
  const annualNet = netByMonth.reduce((s, v) => s + v, 0);

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
          d.getFullYear() === m.year &&
          d.getMonth() + 1 === m.month &&
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
          d.getFullYear() === m.year &&
          d.getMonth() + 1 === m.month &&
          cf.type === "outflow"
        );
      })
      .reduce((s, cf) => s + Number(cf.amount), 0),
  );
  const medianIn = medianOf(monthlyInflows);
  const medianOut = medianOf(monthlyOutflows);
  const totalIn = monthlyInflows.reduce((s, v) => s + v, 0);
  const totalOut = monthlyOutflows.reduce((s, v) => s + v, 0);

  function fmtCell(v: number): string {
    if (v === 0) return "—";
    return v > 0 ? `+${fmt(v)}` : `(${fmt(Math.abs(v))})`;
  }

  return (
    <div className="space-y-5">
      {/* Median Monthly Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className="p-4 border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl"
          data-testid="stat-avg-inflow"
        >
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Median Monthly Inflows
          </p>
          <p className="text-2xl font-display font-black tabular-nums text-emerald-700">
            +{fmt(medianIn, true)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {fmt(totalIn, true)} annually
          </p>
        </div>
        <div
          className="p-4 border border-rose-200 bg-rose-50 dark:bg-rose-950/20 rounded-xl"
          data-testid="stat-avg-outflow"
        >
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Median Monthly Outflows
          </p>
          <p className="text-2xl font-display font-black tabular-nums text-rose-700">
            ({fmt(medianOut, true)})
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {fmt(totalOut, true)} annually
          </p>
        </div>
        <div
          className={`p-4 border rounded-xl ${annualNet >= 0 ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20" : "border-rose-200 bg-rose-50"}`}
          data-testid="stat-net"
        >
          <p className="text-xs font-medium text-muted-foreground mb-1">
            12-Month Net
          </p>
          <p
            className={`text-2xl font-display font-black tabular-nums ${annualNet >= 0 ? "text-blue-700" : "text-rose-700"}`}
          >
            {annualNet >= 0 ? "+" : ""}
            {fmt(Math.abs(annualNet), true)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Incl. year-end bonuses
          </p>
        </div>
      </div>

      {/* Waterfall Chart */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-5 pt-4 pb-2 border-b border-border">
          <p className="font-display font-bold text-base text-foreground">
            12-Month Cashflow Waterfall
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quarterly view · Starting from checking balance ·{" "}
            {fmt(startBalance)} beginning
          </p>
        </div>
        <div className="p-4 bg-card">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart
              data={wfData}
              margin={{ top: 30, right: 20, left: 20, bottom: 20 }}
              barCategoryGap="8%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) =>
                  v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${v}`
                }
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <RechartsTooltip
                formatter={(value: number, name: string) => {
                  if (name === "invisible") return null;
                  const labels: Record<string, string> = {
                    income: "Income",
                    coreExp: "Core Expenses",
                    oneTime: "One-Time",
                    balance: "Balance",
                  };
                  return [fmt(value), labels[name] ?? name];
                }}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                }}
                itemStyle={{ padding: "2px 0" }}
              />
              {[3, 7, 11].map((i) => (
                <ReferenceLine
                  key={i}
                  x={wfData[i]?.name}
                  stroke="hsl(var(--border))"
                  strokeDasharray="4 2"
                />
              ))}
              <Bar
                dataKey="invisible"
                stackId="wf"
                fill="transparent"
                isAnimationActive={false}
              />
              <Bar
                dataKey="income"
                stackId="wf"
                fill="#1a6b3a"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="coreExp"
                stackId="wf"
                fill="#c0392b"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="oneTime"
                stackId="wf"
                fill="#922b21"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="balance"
                fill="hsl(221,39%,38%)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                <LabelList
                  content={(p: any) => <WfLabel {...p} type="balance" />}
                />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ background: "#1a6b3a" }}
              />
              Income
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ background: "#c0392b" }}
              />
              Core Expenses
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ background: "#922b21" }}
              />
              One-Time
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[hsl(221,39%,38%)] inline-block" />
              Cash Balance
            </span>
          </div>
        </div>
      </div>

      {/* P&L Detail Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="bg-[hsl(221,39%,24%)] text-white">
                <th
                  className="text-left px-4 py-2.5 font-semibold"
                  style={{ minWidth: 230 }}
                >
                  Cash Flow P&L · Mar 2026 – Feb 2027
                </th>
                {CF_MONTHS.map((m) => (
                  <th
                    key={m.label}
                    className="text-right px-1.5 py-2.5 font-semibold whitespace-nowrap opacity-80"
                    style={{ minWidth: 50 }}
                  >
                    {m.label}
                  </th>
                ))}
                <th
                  className="text-right px-4 py-2.5 font-semibold opacity-80"
                  style={{ minWidth: 70 }}
                >
                  Annual
                </th>
              </tr>
            </thead>
            <tbody>
              {CF_PL_ROWS.map((row, rowIdx) => {
                if (row.kind === "group") {
                  return (
                    <tr
                      key={row.key}
                      className="bg-[hsl(221,39%,20%)] text-white border-t border-[hsl(221,39%,30%)]"
                    >
                      <td
                        className="px-4 py-1.5 font-bold text-[10px] uppercase tracking-widest opacity-90"
                        colSpan={15}
                      >
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                const rowVals = vals[row.key] ?? [];
                const annual = rowVals.reduce((s, v) => s + v, 0);
                if (row.kind === "item") {
                  const stripe =
                    rowIdx % 2 === 0
                      ? "bg-white dark:bg-card"
                      : "bg-[hsl(221,39%,98%)] dark:bg-secondary/10";
                  return (
                    <tr
                      key={row.key}
                      className={`border-t border-border/20 hover:bg-[hsl(221,39%,95%)] dark:hover:bg-secondary/20 transition-colors ${stripe}`}
                    >
                      <td className="px-4 py-1.5 pl-7 text-foreground/80">
                        {row.label}
                      </td>
                      {rowVals.map((v, i) => (
                        <td
                          key={i}
                          className={`text-right px-1.5 py-1.5 tabular-nums ${v > 0 ? "text-emerald-700" : v < 0 ? "text-rose-600" : "text-muted-foreground/25"}`}
                        >
                          {fmtCell(v)}
                        </td>
                      ))}
                      <td
                        className={`text-right px-4 py-1.5 tabular-nums font-semibold ${annual > 0 ? "text-emerald-700" : annual < 0 ? "text-rose-600" : "text-muted-foreground"}`}
                      >
                        {fmtCell(annual)}
                      </td>
                    </tr>
                  );
                }
                if (row.kind === "subtotal") {
                  return (
                    <tr
                      key={row.key}
                      className="border-t border-[hsl(221,39%,70%)] bg-[hsl(221,15%,88%)] dark:bg-[hsl(221,25%,22%)] text-[hsl(221,39%,20%)] dark:text-white/90"
                    >
                      <td className="px-4 py-1.5 pl-7 font-bold">
                        {row.label}
                      </td>
                      {rowVals.map((v, i) => (
                        <td
                          key={i}
                          className={`text-right px-1.5 py-1.5 tabular-nums font-bold ${v > 0 ? "text-emerald-700 dark:text-emerald-400" : v < 0 ? "text-rose-600 dark:text-rose-400" : "opacity-30"}`}
                        >
                          {fmtCell(v)}
                        </td>
                      ))}
                      <td
                        className={`text-right px-4 py-1.5 tabular-nums font-bold ${annual >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                      >
                        {fmtCell(annual)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })}
              {/* NET CASH FLOW */}
              <tr className="border-t-2 border-[hsl(221,39%,24%)] bg-[hsl(43,74%,56%)] text-white">
                <td className="px-4 py-2.5 font-display font-black text-sm tracking-tight">
                  NET CASH FLOW
                </td>
                {netByMonth.map((v, i) => (
                  <td
                    key={i}
                    className="text-right px-1.5 py-2.5 tabular-nums font-bold"
                  >
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
  monthsInputConfig?: { defaultMonths: number; monthlyUnit: number; label: string };
}) {
  const [months, setMonths] = useState(monthsInputConfig?.defaultMonths ?? 0);
  const effTarget = monthsInputConfig ? monthsInputConfig.monthlyUnit * months : target;
  const effDelta = effTarget - current;

  const needsFunding = effDelta > 1000 && bucketName !== "Grow";
  const isSurplus = effDelta < -1000;
  const isBalanced = !needsFunding && !isSurplus;
  const isGrow = bucketName === "Grow";

  const statusLabel =
    isGrow && isBalanced
      ? "OPPORTUNITY TO INCREASE"
      : isBalanced
        ? "BALANCED"
        : needsFunding
          ? "NEEDS FUNDING"
          : "SURPLUS";
  const statusColor =
    isGrow && isBalanced
      ? "#8b5cf6"
      : isBalanced
        ? "#22c55e"
        : needsFunding
          ? "#f43f5e"
          : "#10b981";

  const BUCKET_NAMES = ["Operating Cash", "Reserve", "Build", "Grow"];
  const defaultFrom = needsFunding ? "Grow" : bucketName;
  const defaultTo = needsFunding
    ? bucketName
    : (BUCKET_NAMES.find((n) => n !== bucketName) ?? "Reserve");

  const suggested = Math.abs(effDelta);
  const [rawAmt, setRawAmt] = useState(
    suggested > 0 ? String(Math.round(suggested)) : "",
  );
  const [executed, setExecuted] = useState(false);
  const [fromAccount, setFromAccount] = useState(defaultFrom);
  const [toAccount, setToAccount] = useState(defaultTo);

  const parsedAmt = parseFloat(rawAmt.replace(/[^0-9.]/g, "")) || 0;
  const fmtD = (v: number) => `$${Math.round(v).toLocaleString()}`;
  const fmtInput = (raw: string) => {
    const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? raw : Math.round(n).toLocaleString();
  };

  return (
    <div className="w-80 flex-shrink-0 border-l border-r border-border bg-card flex flex-col">
      <div className="flex-1 p-5 flex flex-col gap-4">
        {/* Status / Target Coverage */}
        {monthsInputConfig ? (
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-2.5">
              Target Coverage
            </p>
            <div className="flex items-center gap-3 bg-secondary/30 rounded-xl px-4 py-3 border border-border">
              <button
                onClick={() => setMonths((m) => Math.max(1, m - 1))}
                className="w-7 h-7 rounded-full border border-border bg-background flex items-center justify-center text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors select-none"
              >−</button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-black tabular-nums leading-none" style={{ color: bgColor }}>
                  {months}
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground ml-1.5 leading-none">
                  {monthsInputConfig.label}
                </span>
              </div>
              <button
                onClick={() => setMonths((m) => m + 1)}
                className="w-7 h-7 rounded-full border border-border bg-background flex items-center justify-center text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors select-none"
              >+</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
                Status
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColor }} />
                <span className="text-[10px] font-black leading-tight" style={{ color: statusColor }}>
                  {statusLabel}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
                Δ vs Target
              </p>
              <span className="text-xs font-black tabular-nums" style={{ color: statusColor }}>
                {isBalanced ? "—" : (needsFunding ? "+" : "−") + fmtD(Math.abs(effDelta))}
              </span>
            </div>
          </div>
        )}

        {/* Current / Target row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
              Current
            </p>
            <p className="text-sm font-black tabular-nums text-foreground">{fmtD(current)}</p>
          </div>
          <div
            className="rounded-lg border px-3 py-2"
            style={{ borderColor: bgColor + "40", background: bgColor + "10" }}
          >
            <p className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: bgColor }}>
              GURU Target
            </p>
            <p className="text-sm font-black tabular-nums" style={{ color: bgColor }}>{fmtD(effTarget)}</p>
          </div>
        </div>

        {/* Executed confirmation banner */}
        {executed && (
          <div
            className="rounded-lg px-3 py-2.5 flex items-start gap-2"
            style={{ background: bgColor + "15", border: `1px solid ${bgColor}40` }}
          >
            <span className="text-base leading-none mt-0.5">✓</span>
            <div>
              <p className="text-[10px] font-black text-foreground">Transfer Executed</p>
              <p className="text-[9px] text-muted-foreground tabular-nums mt-0.5">
                {fmtD(parsedAmt)} moved{" "}
                <span className="font-semibold text-foreground">{fromAccount} → {toAccount}</span>
              </p>
              <p className="text-[9px] tabular-nums mt-0.5" style={{ color: bgColor }}>
                New balance: {fmtD(needsFunding ? current + parsedAmt : current - parsedAmt)}
              </p>
            </div>
          </div>
        )}

        {/* Transfer amount input */}
        {!executed && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">
                Transfer Amount
              </p>
              {suggested > 0 && (
                <button
                  onClick={() => { setRawAmt(String(Math.round(suggested))); setExecuted(false); }}
                  className="text-[9px] font-semibold underline underline-offset-2 tabular-nums"
                  style={{ color: bgColor }}
                >
                  Use {fmtD(suggested)}
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={fmtInput(rawAmt)}
                onChange={(e) => { setRawAmt(e.target.value.replace(/,/g, "")); setExecuted(false); }}
                placeholder="0"
                className="w-full pl-6 pr-3 py-2 text-sm font-semibold tabular-nums rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2"
              />
            </div>
            {parsedAmt > 0 && (
              <p className="text-[9px] text-muted-foreground mt-1 tabular-nums">
                New balance:{" "}
                <span className="font-semibold text-foreground">
                  {fmtD(needsFunding ? current + parsedAmt : current - parsedAmt)}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Routing */}
        {!executed && (
          <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Route</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[8px] uppercase tracking-wider text-muted-foreground mb-0.5">From</p>
                <select
                  value={fromAccount}
                  onChange={(e) => { setFromAccount(e.target.value); setExecuted(false); }}
                  className="w-full text-[11px] font-semibold text-foreground bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 appearance-none cursor-pointer"
                  style={{
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 6px center",
                    paddingRight: "22px",
                  }}
                >
                  {BUCKET_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <span className="text-muted-foreground flex-shrink-0 mt-4 text-sm">→</span>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] uppercase tracking-wider text-muted-foreground mb-0.5">To</p>
                <select
                  value={toAccount}
                  onChange={(e) => { setToAccount(e.target.value); setExecuted(false); }}
                  className="w-full text-[11px] font-semibold bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 appearance-none cursor-pointer"
                  style={{
                    color: bgColor,
                    borderColor: bgColor + "60",
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
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
          </div>
        )}
      </div>

      {/* Execute / Undo button */}
      <div className="px-5 pb-4">
        {executed ? (
          <button
            onClick={() => { setExecuted(false); onUndo?.(fromAccount, toAccount); }}
            className="w-full py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-colors"
            style={{ color: bgColor, borderColor: bgColor + "60", background: "transparent" }}
          >
            Undo Transfer
          </button>
        ) : (
          <button
            onClick={() => { setExecuted(true); onExecute?.(fromAccount, toAccount, parsedAmt); }}
            disabled={parsedAmt <= 0}
            className="w-full py-2 rounded-lg text-xs font-black uppercase tracking-widest text-white transition-opacity disabled:opacity-30"
            style={{ background: parsedAmt > 0 ? bgColor : "#94a3b8" }}
          >
            Execute
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
  const defaultSelected = top3.findIndex((p) => p.isGuru);
  const initialIdx =
    defaultSelected >= 0 ? defaultSelected : top3.length > 0 ? 0 : -1;

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
    <div className="w-80 flex-shrink-0 flex flex-col border-l border-border bg-card">
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
                    {p.isGuru && (
                      <span
                        className="inline-block text-[7px] font-black px-1 py-px rounded text-white leading-none mb-1"
                        style={{ background: bgColor }}
                      >
                        ★ GURU
                      </span>
                    )}
                    <p className="text-[11px] font-semibold text-foreground leading-snug">
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
                        className="w-11 text-right text-[12px] font-black tabular-nums rounded border px-1.5 py-1 focus:outline-none focus:ring-1 bg-background"
                        style={{ color: bgColor, borderColor: bgColor + "80" }}
                      />
                      <span className="text-[11px] font-bold" style={{ color: bgColor }}>%</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Yield metrics row */}
              <div className="px-3 pb-2.5 flex items-center gap-3 ml-6">
                <div>
                  <div className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Yield</div>
                  <div className="text-[10px] font-bold text-foreground tabular-nums">{p.grossYield}</div>
                </div>
                <div>
                  <div className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Tax-Eff</div>
                  <div className="text-[10px] font-bold text-emerald-600 tabular-nums">{p.atYield}</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Pickup</div>
                  <div className="text-[9px] font-semibold tabular-nums" style={{ color: pickupPositive ? bgColor : isNaN(pickupVal) ? "#94a3b8" : "#f43f5e" }}>
                    {pickupStr}
                  </div>
                </div>
              </div>
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

// ─── GURU Asset Allocation View ───────────────────────────────────────────────
const GURU_BUCKETS_DEF = [
  {
    name: "Operating Cash",
    tagline: "Your safety net",
    rule: "2-3 months of cash",
    bg: "#1a3a8a",
    dark: "#142e6e",
    accent: "#93c5fd",
  },
  {
    name: "Reserve",
    tagline: "Active cash management for what's next",
    rule: "12 months of cash for anticipated outflow",
    bg: "#7c5200",
    dark: "#5c3c00",
    accent: "#fcd34d",
  },
  {
    name: "Build",
    tagline: "Disciplined saving for big goals on the horizon",
    rule: "Large expenditure in next 3 years",
    bg: "#14532d",
    dark: "#0d3b1f",
    accent: "#4ade80",
  },
  {
    name: "Grow",
    tagline: "Long-term compounded investing",
    rule: "5 years + aggressive investment portfolio",
    bg: "#4c1d95",
    dark: "#3b1578",
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
      name: "CIT Money Market Account",
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
      name: "US Treasury Ladder — 1, 3 & 6-Month T-Bills",
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
  cashFlows,
}: {
  assets: Asset[];
  cashFlows: CashFlow[];
}) {
  const [pendingTransfers, setPendingTransfers] = useState<
    { from: string; to: string; amount: number }[]
  >([]);

  const [bucketProductSelections, setBucketProductSelections] = useState<
    Record<string, Array<{ product: BucketProduct; alloc: number }>>
  >({});

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
        const otherCurrent = altValEarly + reValEarly;
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

        const reserveTarget = Math.round(minMonthly * 2);
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
        };
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
            return {
              name: shortName(a.description),
              value: Number(a.value),
              yield_: y,
              yieldAT: toATFull(y), // bank checking: fully taxed (fed+state+city)
            };
          });

        const flowAccts: Acct[] = assets
          .filter(
            (a) =>
              a.type === "cash" &&
              !(a.description ?? "").toLowerCase().includes("checking") &&
              !(a.description ?? "").toLowerCase().includes("brokerage"),
          )
          .map((a) => {
            const y = extractRate(a.description)
              ? extractRate(a.description) + "%"
              : "0.01%";
            return {
              name: shortName(a.description),
              value: Number(a.value),
              yield_: y,
              // MM funds / sweep in treasuries: federal only; bank savings: fully taxed
              yieldAT: isTreasuryMM(a.description) ? toATFed(y) : toATFull(y),
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
            return {
              name: shortName(a.description),
              value: Number(a.value),
              yield_: y,
              yieldAT: toATFed(y), // US Treasuries: federal only
            };
          });

        const altVal = altValEarly;
        const reVal = reValEarly;
        // Grow sub-accounts: detailed breakdown per prototype model
        // yieldAT field repurposed as 5yr historical return for display
        const growAccts: Acct[] = [
          { name: "Cash — Brokerage Sweep",  value: 222965, yield_: "—", yieldAT: "2.5%" },
          { name: "International",            value: 244685, yield_: "—", yieldAT: "7.9%" },
          { name: "US Total Market",          value: 779878, yield_: "—", yieldAT: "14.1%" },
          { name: "US Large Cap",             value: 535000, yield_: "—", yieldAT: "15.2%" },
          { name: "US Small Cap",             value: 323582, yield_: "—", yieldAT: "9.1%" },
          { name: "US Dividend / Value",      value: 94369,  yield_: "—", yieldAT: "10.3%" },
          { name: "Single Stock",             value: 238311, yield_: "—", yieldAT: "~20%+" },
          { name: "Bonds",                    value: 61210,  yield_: "—", yieldAT: "0.2%" },
          { name: "Crypto",                   value: 9500,   yield_: "—", yieldAT: "~30%+" },
        ];
        const otherAccts: Acct[] = [
          ...(altVal > 0
            ? [
                {
                  name: "Private Equity & Alternatives",
                  value: altVal,
                  yield_: "[15%+]",
                  yieldAT: toATCapG("15%"), // cap gains rate → 10.20%
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
        // Weights AT yields (excludes "Tax-def." and "—" entries)
        const weightedATYield = (accts: Acct[], total: number): number => {
          if (total === 0 || accts.length === 0) return 0;
          let weightedSum = 0, weightedTotal = 0;
          for (const a of accts) {
            const n = parseYieldNum(a.yieldAT);
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
            flowCurrent,
            flowTarget,
            flowDelta,
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
            6.00, // S&P 500 / Total Market ETF: 7.5% × 80% (fed cap gains 20% only)
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
              const HERO_COLORS: Record<
                string,
                { bg: string; accent: string; dot: string }
              > = {
                "Operating Cash": {
                  bg: "#1d4ed8",
                  accent: "#93c5fd",
                  dot: "#60a5fa",
                },
                Reserve: { bg: "#047857", accent: "#6ee7b7", dot: "#4ade80" },
                Build: { bg: "#ca8a04", accent: "#fde68a", dot: "#fde68a" },
                Grow: { bg: "#5b21b6", accent: "#c084fc", dot: "#c084fc" },
                "Grow (Other)": {
                  bg: "#6b7280",
                  accent: "#d1d5db",
                  dot: "#d1d5db",
                },
              };
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
                        {fmt(totalAssets)}
                      </p>
                      <p className="text-[10px] text-emerald-600/70 mt-1">
                        GURU Allocation View · {assets.length} accounts
                      </p>
                    </div>

                    {/* DIVIDER */}
                    <div className="hidden sm:block w-px self-stretch bg-emerald-200" />

                    {/* 3 key metrics */}
                    <div className="flex-1 grid grid-cols-3 gap-6">
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-emerald-700/70 font-bold mb-0.5">
                          Excess Cash
                        </p>
                        <p className="text-2xl font-black tabular-nums text-emerald-700">
                          {fmt(excessCash)}
                        </p>
                        <p className="text-[9px] text-emerald-600/60 mt-0.5">
                          available to redeploy
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-emerald-700/70 font-bold mb-0.5">
                          Potential After-Tax Income Pickup Per Year
                        </p>
                        <p className="text-2xl font-black tabular-nums text-emerald-700">
                          {fmt(addlIncome)}
                        </p>
                        <p className="text-[9px] text-emerald-600/60 mt-0.5">
                          projected annual gain
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-emerald-700/70 font-bold mb-0.5">
                          Potential Cashflow Increase
                        </p>
                        <p className="text-2xl font-black tabular-nums text-emerald-700">
                          {pctIncrease}%
                        </p>
                        <p className="text-[9px] text-emerald-600/60 mt-0.5">
                          vs. current yield
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* 5 bucket mini-cards (4 active + Grow Other) */}
                  <div className="grid grid-cols-5 gap-3 mt-5">
                    {rows.map((r) => {
                      const hc = HERO_COLORS[r.def.name] ?? {
                        bg: r.def.bg,
                        accent: r.def.accent,
                      };
                      const fmtK = (v: number) =>
                        `$${Math.round(v).toLocaleString()}`;
                      const avgYieldV = weightedGrossYield(
                        r.subAccounts,
                        r.current,
                      );
                      const isOverfund = r.delta < -5000;
                      return (
                        <div key={r.def.name} className="flex flex-col">
                          <div className="text-center mb-1 h-4">
                            {isOverfund && (
                              <span className="text-[8px] font-black uppercase tracking-widest text-rose-500 animate-pulse">
                                ⚠ OVERFUNDED
                              </span>
                            )}
                          </div>
                          <div
                            className="rounded-xl p-4 flex-1"
                            style={{ background: hc.bg }}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: hc.dot }}
                              />
                              <span className="text-[11px] font-black uppercase text-white leading-tight truncate">
                                {r.def.name}
                              </span>
                            </div>
                            <p className="text-[9px] italic text-white/50 leading-snug h-8 line-clamp-2">
                              {r.def.rule}
                            </p>
                            <div className="flex items-baseline justify-between mt-1 gap-1">
                              <p
                                className={`${fmtK(r.current).length > 9 ? "text-sm" : fmtK(r.current).length > 7 ? "text-base" : "text-xl"} font-black text-white leading-none tabular-nums`}
                              >
                                {fmtK(r.current)}
                              </p>
                              <p className="text-white/60 tabular-nums flex-shrink-0 text-[12px]">
                                {avgYieldV.toFixed(2)}% yield
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Grow (Other) — display-only, no reallocation */}
                    {(() => {
                      const fmtK = (v: number) =>
                        `$${Math.round(v).toLocaleString()}`;
                      const otherYield = weightedGrossYield(
                        otherAccts,
                        otherCurrent,
                      );
                      const hcO = HERO_COLORS["Grow (Other)"];
                      return (
                        <div className="flex flex-col">
                          <div className="h-4 mb-1" />
                          <div
                            className="rounded-xl p-4 flex-1"
                            style={{ background: hcO.bg }}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: hcO.accent }}
                              />
                              <span className="text-[11px] font-black uppercase text-white leading-tight">
                                Grow (Other)
                              </span>
                            </div>
                            <p className="text-[9px] italic text-white/50 leading-snug h-8 line-clamp-2">
                              Alternative Assets, Real Estate etc
                            </p>
                            <div className="flex items-baseline justify-between mt-1 gap-1">
                              <p
                                className={`${fmtK(otherCurrent).length > 9 ? "text-sm" : fmtK(otherCurrent).length > 7 ? "text-base" : "text-xl"} font-black text-white leading-none tabular-nums`}
                              >
                                {fmtK(otherCurrent)}
                              </p>
                              <p className="text-white/60 tabular-nums flex-shrink-0 text-[12px]">
                                {otherYield.toFixed(2)}% yield
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  {/* ── Org-chart flow lines ── */}
                  {(() => {
                    const H = 72;
                    const dropY = 36;
                    const surplusRows = rows.filter((r) => r.delta < -5000);
                    const needRows = rows.filter(
                      (r) => r.delta > 5000 || r.def.name === "Build",
                    );
                    if (surplusRows.length === 0 || needRows.length === 0)
                      return null;
                    let dotIdx = 0;
                    return (
                      <div className="relative mt-1 mb-1" style={{ height: H }}>
                        {/* Vertical drop line + dollar label for every surplus source */}
                        {surplusRows.map((src) => {
                          const srcIdx = rows.indexOf(src);
                          const srcPct =
                            ((srcIdx + 0.5) / (rows.length + 1)) * 100;
                          const srcColor =
                            HERO_COLORS[src.def.name]?.bg ?? "#64748b";
                          const fmtFull = (v: number) =>
                            `$${Math.round(v).toLocaleString()}`;
                          return (
                            <div key={`drop-${src.def.name}`}>
                              <div
                                className="absolute rounded-full"
                                style={{
                                  left: `${srcPct}%`,
                                  top: 0,
                                  width: 2,
                                  height: dropY,
                                  background: srcColor,
                                  transform: "translateX(-50%)",
                                  opacity: 0.6,
                                }}
                              />
                              <div
                                className="absolute text-[9px] font-black tabular-nums bg-white/90 rounded px-1 leading-tight whitespace-nowrap"
                                style={{
                                  left: `calc(${srcPct}% + 6px)`,
                                  top: Math.floor(dropY / 2) - 6,
                                  color: srcColor,
                                }}
                              >
                                {fmtFull(Math.abs(src.delta))}
                              </div>
                            </div>
                          );
                        })}
                        {/* Connectors: each surplus → each need */}
                        {surplusRows.flatMap((src, connIdx) => {
                          const srcIdx = rows.indexOf(src);
                          const srcPct =
                            ((srcIdx + 0.5) / (rows.length + 1)) * 100;
                          const srcColor =
                            HERO_COLORS[src.def.name]?.bg ?? "#64748b";
                          return needRows.map((need, needIdx) => {
                            const tgtIdx = rows.indexOf(need);
                            const tgtPct =
                              ((tgtIdx + 0.5) / (rows.length + 1)) * 100;
                            const leftPct = Math.min(srcPct, tgtPct);
                            const wPct = Math.abs(srcPct - tgtPct);
                            const tgtColor =
                              HERO_COLORS[need.def.name]?.bg ?? "#64748b";
                            const midPct = (srcPct + tgtPct) / 2;
                            const labelIdx =
                              connIdx * needRows.length + needIdx;
                            const labelTop = dropY + 6 + labelIdx * 14;
                            const amount =
                              need.def.name === "Build"
                                ? Math.abs(src.delta)
                                : Math.abs(need.delta);
                            const fmtAmt = `$${Math.round(amount).toLocaleString()}`;
                            const di = dotIdx++;
                            return (
                              <div key={`${src.def.name}->${need.def.name}`}>
                                {/* Horizontal connector */}
                                <div
                                  className="absolute"
                                  style={{
                                    left: `${leftPct}%`,
                                    top: dropY,
                                    width: `${wPct}%`,
                                    height: 2,
                                    background: `linear-gradient(to ${srcPct < tgtPct ? "right" : "left"}, ${srcColor}80, ${tgtColor}80)`,
                                  }}
                                />
                                {/* Vertical rise to target */}
                                <div
                                  className="absolute rounded-full"
                                  style={{
                                    left: `${tgtPct}%`,
                                    top: dropY - 28,
                                    width: 2,
                                    height: 28,
                                    background: tgtColor,
                                    transform: "translateX(-50%)",
                                    opacity: 0.6,
                                  }}
                                />
                                {/* Animated dot */}
                                <motion.div
                                  className="absolute rounded-full z-10 shadow"
                                  style={{
                                    width: 9,
                                    height: 9,
                                    background: srcColor,
                                    marginLeft: -4,
                                    marginTop: -4,
                                  }}
                                  animate={{
                                    left: [
                                      `${srcPct}%`,
                                      `${srcPct}%`,
                                      `${tgtPct}%`,
                                      `${tgtPct}%`,
                                    ],
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
                          });
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
                    className="rounded-xl overflow-hidden flex shadow-sm border border-border"
                  >
                    {/* ── LEFT: Header + Accounts ── */}
                    <div className="flex-1 min-w-[340px] flex flex-col border-r border-border">
                      <div
                        className="px-4 py-3 flex items-center gap-2.5"
                        style={{ background: r.def.bg }}
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
                        <div
                          className="grid mb-2 gap-2"
                          style={{ gridTemplateColumns: "1fr 76px 52px 60px" }}
                        >
                          <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">
                            Account
                          </span>
                          <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground text-right">
                            Balance
                          </span>
                          <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground text-right">
                            {r.def.name === "Grow" ? "" : "Yield"}
                          </span>
                          <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground text-right">
                            {r.def.name === "Grow" ? "5yr Return" : "Tax-Eff Yld"}
                          </span>
                        </div>
                        {(() => {
                          const activeSels = bucketProductSelections[r.def.name] ?? [];
                          const hasNewAlloc = activeSels.length > 0;
                          return (
                        <div className="space-y-1.5 flex-1">
                          {r.subAccounts.map((acct) => (
                            <div
                              key={acct.name}
                              className="grid items-center gap-2"
                              style={{
                                gridTemplateColumns: "1fr 76px 52px 60px",
                                opacity: hasNewAlloc ? 0.35 : 1,
                                textDecorationLine: hasNewAlloc ? "line-through" : "none",
                                textDecorationColor: hasNewAlloc ? "#94a3b8" : undefined,
                              }}
                            >
                              <span className="flex items-center gap-1.5 text-[11px] min-w-0 overflow-hidden text-muted-foreground">
                                <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: hasNewAlloc ? "#94a3b8" : r.def.accent }} />
                                <span className="truncate">{acct.name}</span>
                              </span>
                              <span className="text-[11px] font-semibold text-right tabular-nums text-foreground">
                                {fmt(acct.value)}
                              </span>
                              <span className="text-[10px] font-semibold text-right tabular-nums text-foreground">
                                {acct.yield_}
                              </span>
                              <span className="text-[10px] text-right tabular-nums text-muted-foreground">
                                {acct.yieldAT}
                              </span>
                            </div>
                          ))}
                          {/* New amber rows for selected products */}
                          {activeSels.map((sel) => {
                            const allocBal = r.current * (sel.alloc / 100);
                            return (
                              <div
                                key={sel.product.name}
                                className="grid items-center gap-2 rounded-md px-2 py-1.5 border border-amber-300 bg-amber-50"
                                style={{ gridTemplateColumns: "1fr 76px 52px 60px" }}
                              >
                                <span className="flex items-center gap-1.5 text-[11px] min-w-0 overflow-hidden">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-500" />
                                  <span className="truncate font-semibold text-amber-800">{sel.product.name}</span>
                                </span>
                                <span className="text-[11px] font-bold text-amber-700 text-right tabular-nums">
                                  {fmt(allocBal)}
                                </span>
                                <span className="text-[10px] font-semibold text-amber-600 text-right tabular-nums">
                                  {sel.product.grossYield}
                                </span>
                                <span className="text-[10px] text-amber-600 text-right tabular-nums">
                                  {sel.product.atYield}
                                </span>
                              </div>
                            );
                          })}
                          {r.subAccounts.length === 0 && (
                            <p className="text-xs text-muted-foreground italic">
                              No accounts mapped
                            </p>
                          )}
                          {/* Pending outbound transfers (source bucket) */}
                          {pendingTransfers
                            .filter((t) => t.from === r.def.name)
                            .map((pt) => (
                              <div
                                key={`outbound-${pt.to}`}
                                className="grid items-center gap-2 rounded-md px-2 py-1.5 border border-amber-300 bg-amber-50"
                                style={{ gridTemplateColumns: "1fr 76px 52px 60px" }}
                              >
                                <span className="flex items-center gap-1.5 text-[11px] min-w-0 overflow-hidden">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-500 animate-pulse" />
                                  <span className="truncate font-semibold text-amber-800">
                                    Transfer out → {pt.to}
                                  </span>
                                </span>
                                <span className="text-[11px] font-bold text-red-600 text-right tabular-nums">
                                  −{fmt(pt.amount)}
                                </span>
                                <span className="text-[10px] text-amber-500 text-right">—</span>
                                <span className="text-[10px] text-amber-500 text-right">—</span>
                              </div>
                            ))}
                          {/* Pending inbound transfers (destination bucket) */}
                          {pendingTransfers
                            .filter((t) => t.to === r.def.name)
                            .map((pt) => (
                              <div
                                key={`inbound-${pt.from}`}
                                className="grid items-center gap-2 rounded-md px-2 py-1.5 border border-amber-300 bg-amber-50"
                                style={{ gridTemplateColumns: "1fr 76px 52px 60px" }}
                              >
                                <span className="flex items-center gap-1.5 text-[11px] min-w-0 overflow-hidden">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-500 animate-pulse" />
                                  <span className="truncate font-semibold text-amber-800">
                                    Transfer from {pt.from}
                                  </span>
                                </span>
                                <span className="text-[11px] font-bold text-amber-700 text-right tabular-nums">
                                  +{fmt(pt.amount)}
                                </span>
                                <span className="text-[10px] text-amber-500 text-right">—</span>
                                <span className="text-[10px] text-amber-500 text-right">—</span>
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
                        {/* Weighted avg yield + totals footer */}
                        {(() => {
                          const outAmt = pendingTransfers
                            .filter((t) => t.from === r.def.name)
                            .reduce((s, t) => s + t.amount, 0);
                          const inAmt = pendingTransfers
                            .filter((t) => t.to === r.def.name)
                            .reduce((s, t) => s + t.amount, 0);
                          const netDelta = inAmt - outAmt;
                          const hasPending = netDelta !== 0;
                          const adjTotal = r.current + netDelta;
                          return (
                            <div className="mt-2.5 pt-2 border-t border-border">
                              <div
                                className="grid items-center gap-2"
                                style={{ gridTemplateColumns: "1fr 76px 52px 60px" }}
                              >
                                <span className="text-[9px] text-muted-foreground italic">
                                  {r.subAccounts.length} position
                                  {r.subAccounts.length !== 1 ? "s" : ""}
                                </span>
                                {hasPending ? (
                                  <span className="text-xs font-bold tabular-nums text-right flex flex-col items-end leading-tight">
                                    <span className="text-muted-foreground line-through text-[10px]">{fmt(r.current)}</span>
                                    <span className="text-amber-600">{fmt(adjTotal)}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs font-bold tabular-nums text-foreground text-right">
                                    {fmt(r.current)}
                                  </span>
                                )}
                                <span
                                  className="text-[10px] font-bold tabular-nums text-right"
                                  style={{ color: r.def.bg }}
                                >
                                  {r.current > 0
                                    ? `${weightedGrossYield(r.subAccounts, r.current).toFixed(2)}%`
                                    : "—"}
                                </span>
                                <span className="text-[9px] text-muted-foreground tabular-nums text-right">
                                  {r.current > 0
                                    ? `${weightedATYield(r.subAccounts, r.current).toFixed(2)}%`
                                    : "—"}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* ── MIDDLE: execution panel ── */}
                    {(() => {
                      const avgYield = weightedGrossYield(r.subAccounts, r.current);
                      const avgYieldAT = weightedATYield(r.subAccounts, r.current);
                      return (
                        <BucketExecutionPanel
                          key={r.def.name}
                          bucketName={r.def.name}
                          current={r.current}
                          target={r.target}
                          delta={r.delta}
                          accentColor={r.def.accent}
                          bgColor={r.def.bg}
                          avgYield={avgYield}
                          avgYieldAT={avgYieldAT}
                          bpPickup={r.bpPickup}
                          totalAssets={totalAssets}
                          onExecute={handleExecute}
                          onUndo={handleUndo}
                          monthsInputConfig={
                            r.def.name === "Operating Cash"
                              ? { defaultMonths: 2, monthlyUnit: r.target / 2, label: "mos. of expenses" }
                              : r.def.name === "Reserve"
                                ? { defaultMonths: 12, monthlyUnit: r.target / 12, label: "mos. of cash flow" }
                                : undefined
                          }
                        />
                      );
                    })()}

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
            {/* Totals summary strip */}
            <div className="rounded-xl bg-slate-900 px-5 py-3.5 grid grid-cols-4 gap-4 text-white">
              <div>
                <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-0.5">
                  Total Assets
                </p>
                <p className="font-bold text-base tabular-nums">
                  {fmt(totalAssets)}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-0.5">
                  GURU Total
                </p>
                <p className="font-bold text-base tabular-nums">
                  {fmt(rows.reduce((s, r) => s + r.target, 0))}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-0.5">
                  Net Redeployment
                </p>
                <p className="font-bold text-base tabular-nums text-cyan-400">
                  {excessCash > 0 ? `${fmt(excessCash)} → Grow` : "Balanced"}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-0.5">
                  Balance Check
                </p>
                <p className="font-bold text-base text-emerald-400">
                  ✓ Zero Net Change
                </p>
              </div>
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
  const [tab, setTab] = useState<"bs" | "assets" | "liab" | "cf">("bs");
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 border border-border rounded-lg p-1 bg-secondary/30 text-xs">
          {(["bs", "assets", "liab", "cf"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${tab === t ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t === "bs"
                ? "Balance Sheet"
                : t === "assets"
                  ? "Assets"
                  : t === "liab"
                    ? "Liabilities"
                    : "Cash Flows"}
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
                <div
                  className="grid bg-[hsl(155,60%,35%)] text-white font-bold"
                  style={{ gridTemplateColumns: "1fr 90px 56px 90px" }}
                >
                  <div className="px-3 py-2.5 text-base">Net Worth</div>
                  <div className="px-2 py-2.5 text-right tabular-nums text-base">
                    {fmt(netWorth)}
                  </div>
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
          {assets.map((a) => (
            <div
              key={a.id}
              className="p-4 border border-border rounded-lg hover:border-primary/30 transition-colors"
              data-testid={`asset-card-${a.id}`}
            >
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className="text-xs capitalize">
                  {a.type.replace("_", " ")}
                </Badge>
                <span className="font-bold text-sm">
                  {fmt(Number(a.value))}
                </span>
              </div>
              <p className="text-sm text-foreground leading-snug">
                {a.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "liab" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {liabilities.map((l) => (
            <div
              key={l.id}
              className="p-4 border border-border rounded-lg hover:border-rose-200 transition-colors"
              data-testid={`liability-card-${l.id}`}
            >
              <div className="flex justify-between items-start mb-2">
                <Badge
                  variant="outline"
                  className="text-xs capitalize text-rose-600 border-rose-200"
                >
                  {l.type.replace("_", " ")}
                </Badge>
                <div className="text-right">
                  <p className="font-bold text-sm text-rose-600">
                    {fmt(Number(l.value))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.interestRate}% APR
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{l.description}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "cf" && (
        <div className="divide-y border border-border rounded-lg overflow-hidden">
          {cashFlows.map((flow) => (
            <div
              key={flow.id}
              className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
              data-testid={`cashflow-row-${flow.id}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${flow.type === "inflow" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}
                >
                  {flow.type === "inflow" ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">{flow.description}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {flow.category.replace("_", " ")} ·{" "}
                    {format(new Date(flow.date), "MMM yyyy")}
                  </p>
                </div>
              </div>
              <span
                className={`font-bold text-sm ${flow.type === "inflow" ? "text-emerald-600" : "text-rose-600"}`}
              >
                {flow.type === "inflow" ? "+" : "-"}
                {fmt(Number(flow.amount))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type ActiveView =
  | "dashboard"
  | "strategy"
  | "balancesheet"
  | "cashflow"
  | "guru";

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

  const { client, assets, liabilities, cashFlows, strategies } = data;

  // ── Top-level cash metrics (shared across banner + panels) ──────────────────
  const _forecastData = buildForecast(cashFlows);
  const {
    reserve: reserveTop,
    yieldBucket: yieldTop,
    tactical: tacticalTop,
    totalLiquid: totalLiquidTop,
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

  // Next month's net cash flow
  const _nextMonthDate = addMonths(new Date(), 1);
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

  const riskColor: Record<string, string> = {
    conservative: "bg-blue-100 text-blue-700",
    moderate: "bg-amber-100 text-amber-700",
    aggressive: "bg-rose-100 text-rose-700",
  };

  const navItems: {
    key: ActiveView;
    label: string;
    icon: React.ElementType;
  }[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "strategy", label: "Strategy", icon: BrainCircuit },
    { key: "balancesheet", label: "Balance Sheet", icon: Scale },
    { key: "cashflow", label: "Cash Flow Forecast", icon: BarChart2 },
    { key: "guru", label: "GURU Allocation", icon: PieChartIcon },
  ];

  const handleGenerate = () => {
    generateStrategy.mutate();
    setActiveView("strategy");
  };

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
                {strategies.length > 0
                  ? `${strategies.length} active AI recommendation${strategies.length > 1 ? "s" : ""} · Last updated today`
                  : "No AI strategy generated yet"}
              </p>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateStrategy.isPending}
            size="sm"
            className={`gap-2 font-semibold shadow transition-all flex-shrink-0 ${
              generateStrategy.isPending
                ? "bg-indigo-400 text-white cursor-not-allowed"
                : strategies.length === 0
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white"
                  : "bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white"
            }`}
            data-testid="button-generate-strategy"
          >
            {generateStrategy.isPending ? (
              <>
                <Activity className="w-3.5 h-3.5 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <BrainCircuit className="w-3.5 h-3.5" />
                {strategies.length === 0
                  ? "Run AI Analysis"
                  : "Refresh AI Analysis"}
              </>
            )}
          </Button>
        </div>

        {/* ── Tab Navigation — pill style ─────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl px-1.5 py-1.5 shadow-sm">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              data-testid={`nav-${key}`}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium rounded-lg transition-all ${
                activeView === key
                  ? "bg-[hsl(222,47%,12%)] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {key === "strategy" && strategies.length > 0 && (
                <span
                  className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${activeView === key ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-600"}`}
                >
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
          <div
            className={`rounded-xl border shadow-sm px-6 py-5 ${isPositiveTop ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200" : "bg-gradient-to-r from-rose-50 to-orange-50 border-rose-200"}`}
          >
            <div className="flex flex-col sm:flex-row gap-6">
              {/* LEFT: Where cash is sitting */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Cash Allocation
                </p>
                {[
                  {
                    key: "reserve",
                    label: "Operating Cash",
                    value: reserveTop,
                    color: GURU_BUCKETS.reserve.color,
                  },
                  {
                    key: "yield",
                    label: "Yield",
                    value: yieldTop,
                    color: GURU_BUCKETS.yield.color,
                  },
                  {
                    key: "tactical",
                    label: "Tactical",
                    value: tacticalTop,
                    color: GURU_BUCKETS.tactical.color,
                  },
                ].map((b) => {
                  const pct =
                    totalLiquidTop > 0 ? (b.value / totalLiquidTop) * 100 : 0;
                  return (
                    <div key={b.key} className="flex items-center gap-3 mb-2.5">
                      <span
                        className="text-xs font-semibold w-16 flex-shrink-0"
                        style={{ color: b.color }}
                      >
                        {b.label}
                      </span>
                      <div className="flex-1 h-1.5 bg-black/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: b.color }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums w-20 text-right text-foreground">
                        {fmt(b.value, true)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* DIVIDER */}
              <div
                className={`hidden sm:block w-px self-stretch ${isPositiveTop ? "bg-emerald-200" : "bg-rose-200"}`}
              />

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
                <p
                  className="text-4xl font-extrabold leading-tight tabular-nums mb-1 text-emerald-700"
                  data-testid="kpi-cash-excess"
                >
                  {fmt(totalToInvestTop)}
                </p>
                <p className="text-[10px] text-muted-foreground mb-3">
                  GURU Optimizer · A + B
                </p>
                <div
                  className={`grid grid-cols-3 gap-3 border-t pt-3 ${isPositiveTop ? "border-emerald-200" : "border-rose-200"}`}
                >
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium leading-tight mb-0.5">
                      A: Idle Cash
                    </p>
                    <p className="text-sm font-bold tabular-nums text-foreground">
                      {fmt(brokerageCashTop, true)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium leading-tight mb-0.5">
                      B: Liquid Surplus
                    </p>
                    <p
                      className={`text-sm font-bold tabular-nums ${cashExcessTop >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {cashExcessTop >= 0 ? "+" : ""}
                      {fmt(cashExcessTop, true)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium leading-tight mb-0.5">
                      12-Mo Req'd
                    </p>
                    <p className="text-sm font-bold tabular-nums text-foreground">
                      {fmt(cashTroughTop, true)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <CashFlowTicker cashFlows={cashFlows} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <NetWorthPanel
              assets={assets}
              liabilities={liabilities}
              cashFlows={cashFlows}
            />
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
                    <p className="text-sm font-bold text-indigo-900">
                      GURU AI Insights
                    </p>
                    <p className="text-xs text-indigo-500">
                      {strategies.length} recommendations · Full analysis in
                      Strategy tab
                    </p>
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
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        +{fmt(Number(s.impact), true)}/yr
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-foreground leading-snug mb-1">
                      {s.name}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {s.recommendation}
                    </p>
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
                  <p className="font-semibold text-sm text-foreground">
                    No AI analysis yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Run GURU to get balance sheet strategy and cash management
                    recommendations
                  </p>
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
                <p className="font-semibold text-sm text-indigo-800">
                  GURU is analyzing the balance sheet…
                </p>
                <p className="text-xs text-indigo-500">
                  Reviewing cash flows, liquidity position, and asset allocation
                </p>
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
        <DetailsView
          assets={assets}
          liabilities={liabilities}
          cashFlows={cashFlows}
          clientId={clientId}
        />
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
