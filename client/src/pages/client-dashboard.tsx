import { useParams } from "wouter";
import { Layout } from "@/components/layout";
import { useClientDashboard, useGenerateStrategy } from "@/hooks/use-clients";
import { AddAssetModal, AddLiabilityModal, AddCashFlowModal } from "@/components/financial-forms";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar
} from "recharts";
import {
  BrainCircuit, TrendingUp, TrendingDown, Wallet, Activity,
  ShieldCheck, Zap, Droplets, Scale, AlertTriangle, CheckCircle2,
  ChevronLeft, Plus
} from "lucide-react";
import { format, addMonths, startOfMonth } from "date-fns";
import { Link } from "wouter";
import type { Asset, CashFlow } from "@shared/schema";

const ASSET_COLORS: Record<string, string> = {
  equity: 'hsl(221, 83%, 53%)',
  fixed_income: 'hsl(142, 71%, 45%)',
  real_estate: 'hsl(43, 74%, 56%)',
  cash: 'hsl(262, 83%, 58%)',
  alternative: 'hsl(0, 84%, 60%)',
};

const formatCurrency = (val: number, compact = false) => {
  if (compact && Math.abs(val) >= 1_000_000) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
};

const formatPct = (val: number) => `${val.toFixed(1)}%`;

// ─── Liquidity Coverage Analysis ─────────────────────────────────────────────
function computeLiquidity(assets: Asset[], cashFlows: CashFlow[]) {
  const liquidTypes = ['cash', 'fixed_income'];
  const liquidAssets = assets.filter(a => liquidTypes.includes(a.type)).reduce((s, a) => s + Number(a.value), 0);
  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);

  const annualOutflows = cashFlows
    .filter(c => c.type === 'outflow')
    .reduce((s, c) => s + Number(c.amount), 0) * 12;

  const coverageRatio = annualOutflows > 0 ? liquidAssets / annualOutflows : Infinity;
  const coverageMonths = annualOutflows > 0 ? (liquidAssets / (annualOutflows / 12)) : Infinity;

  return { liquidAssets, totalAssets, annualOutflows, coverageRatio, coverageMonths };
}

// ─── 12-Month Cash Flow Forecast ─────────────────────────────────────────────
function buildForecast(cashFlows: CashFlow[]) {
  const monthlyInflow = cashFlows.filter(c => c.type === 'inflow').reduce((s, c) => s + Number(c.amount), 0);
  const monthlyOutflow = cashFlows.filter(c => c.type === 'outflow').reduce((s, c) => s + Number(c.amount), 0);
  const monthlyNet = monthlyInflow - monthlyOutflow;

  const now = startOfMonth(new Date());
  return Array.from({ length: 12 }, (_, i) => {
    const month = addMonths(now, i);
    const cumulative = monthlyNet * (i + 1);
    return {
      month: format(month, 'MMM yy'),
      inflow: monthlyInflow,
      outflow: monthlyOutflow,
      net: monthlyNet,
      cumulative,
    };
  });
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, subLabel, icon: Icon, color = "blue", trend }: {
  label: string; value: string; subLabel?: string; icon: React.ElementType;
  color?: "blue" | "green" | "red" | "purple" | "amber"; trend?: "up" | "down" | "neutral";
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-rose-50 text-rose-600",
    purple: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <Card className="border-border/50 shadow-sm hover-elevate">
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className="text-xl font-bold text-foreground truncate" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g,'-')}`}>{value}</p>
            {subLabel && <p className="text-xs text-muted-foreground mt-1">{subLabel}</p>}
          </div>
          <div className={`p-2 rounded-lg flex-shrink-0 ml-3 ${colorMap[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1">
            {trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
            {trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-rose-500" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Liquidity Panel ──────────────────────────────────────────────────────────
function LiquidityPanel({ assets, cashFlows }: { assets: Asset[]; cashFlows: CashFlow[] }) {
  const { liquidAssets, totalAssets, annualOutflows, coverageRatio, coverageMonths } = computeLiquidity(assets, cashFlows);
  const liquidPct = totalAssets > 0 ? (liquidAssets / totalAssets) * 100 : 0;

  let coverageStatus: "good" | "warning" | "critical";
  if (coverageMonths >= 6) coverageStatus = "good";
  else if (coverageMonths >= 3) coverageStatus = "warning";
  else coverageStatus = "critical";

  const statusConfig = {
    good: { color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2, label: "Adequate" },
    warning: { color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: AlertTriangle, label: "Monitor" },
    critical: { color: "text-rose-600", bg: "bg-rose-50 border-rose-200", icon: AlertTriangle, label: "Action Needed" },
  };
  const cfg = statusConfig[coverageStatus];
  const StatusIcon = cfg.icon;

  // Breakdown by type
  const liquidBreakdown = assets
    .filter(a => ['cash', 'fixed_income'].includes(a.type))
    .map(a => ({ desc: a.description, type: a.type, value: Number(a.value) }));

  return (
    <Card className="border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Droplets className="w-4 h-4 text-blue-500" />
          Liquidity Analysis
        </CardTitle>
        <CardDescription>Cash coverage vs. annual obligations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status badge */}
        <div className={`flex items-center gap-2 p-3 rounded-lg border ${cfg.bg}`}>
          <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
          <div>
            <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</p>
            <p className="text-xs text-muted-foreground">
              {isFinite(coverageMonths)
                ? `${coverageMonths.toFixed(1)} months of liquid coverage`
                : "No outflows recorded"}
            </p>
          </div>
        </div>

        {/* Key numbers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-secondary/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Liquid Assets</p>
            <p className="font-bold text-sm text-foreground">{formatCurrency(liquidAssets, true)}</p>
            <p className="text-xs text-muted-foreground">{formatPct(liquidPct)} of total assets</p>
          </div>
          <div className="p-3 bg-secondary/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Annual Outflows</p>
            <p className="font-bold text-sm text-foreground">{formatCurrency(annualOutflows, true)}</p>
            <p className="text-xs text-muted-foreground">Coverage: {isFinite(coverageRatio) ? `${coverageRatio.toFixed(1)}x` : "∞"}</p>
          </div>
        </div>

        {/* Coverage bar */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Coverage Ratio</span>
            <span className="font-semibold">{isFinite(coverageRatio) ? `${coverageRatio.toFixed(1)}x` : "∞"}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                coverageStatus === "good" ? "bg-emerald-500" :
                coverageStatus === "warning" ? "bg-amber-500" : "bg-rose-500"
              }`}
              style={{ width: `${Math.min(100, isFinite(coverageRatio) ? (coverageRatio / 3) * 100 : 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground/70 mt-1">
            <span>0x</span><span>1x</span><span>2x</span><span>3x+</span>
          </div>
        </div>

        {/* Liquid asset breakdown */}
        {liquidBreakdown.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Liquid Holdings</p>
            <div className="space-y-1.5">
              {liquidBreakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate flex-1 mr-2">{item.desc}</span>
                  <span className="font-medium text-foreground">{formatCurrency(item.value, true)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Balance Sheet View ───────────────────────────────────────────────────────
function BalanceSheetView({ assets, liabilities }: { assets: Asset[]; liabilities: typeof liabilities }) {
  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.value), 0);
  const netWorth = totalAssets - totalLiabilities;

  const grouped = assets.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + Number(a.value);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Assets column */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Assets
          </h4>
          <span className="text-sm font-bold text-emerald-600">{formatCurrency(totalAssets)}</span>
        </div>
        <div className="space-y-2">
          {Object.entries(grouped).map(([type, val]) => (
            <div key={type} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ASSET_COLORS[type] || '#888' }} />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm text-muted-foreground capitalize">{type.replace('_', ' ')}</span>
                <span className="text-sm font-medium">{formatCurrency(val)}</span>
              </div>
              <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(val / totalAssets) * 100}%`, backgroundColor: ASSET_COLORS[type] || '#888' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Liabilities + equity column */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-500" /> Liabilities
          </h4>
          <span className="text-sm font-bold text-rose-600">{formatCurrency(totalLiabilities)}</span>
        </div>
        <div className="space-y-2">
          {liabilities.map(l => (
            <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
              <div>
                <p className="text-sm text-muted-foreground capitalize">{l.type.replace('_', ' ')}</p>
                <p className="text-xs text-muted-foreground/60">{l.interestRate}% APR</p>
              </div>
              <span className="text-sm font-medium text-rose-600">{formatCurrency(Number(l.value))}</span>
            </div>
          ))}
          {liabilities.length === 0 && <p className="text-xs text-muted-foreground">No liabilities recorded</p>}
        </div>

        <div className="mt-4 pt-4 border-t-2 border-foreground/20 flex items-center justify-between">
          <span className="text-sm font-bold text-foreground flex items-center gap-2">
            <Scale className="w-4 h-4" /> Net Worth
          </span>
          <span className={`text-sm font-bold ${netWorth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatCurrency(netWorth)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const { id } = useParams();
  const clientId = parseInt(id || "0", 10);
  const { data, isLoading } = useClientDashboard(clientId);
  const generateStrategy = useGenerateStrategy(clientId);

  if (isLoading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-6">
          <div className="h-16 bg-secondary/50 rounded-xl w-2/3" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-secondary/50 rounded-xl" />)}
          </div>
          <div className="h-72 bg-secondary/50 rounded-xl" />
          <div className="h-60 bg-secondary/50 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="text-center mt-24">
          <p className="text-muted-foreground">Client not found.</p>
          <Link href="/"><Button variant="outline" className="mt-4">Back to Clients</Button></Link>
        </div>
      </Layout>
    );
  }

  const { client, assets, liabilities, cashFlows, strategies } = data;

  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.value), 0);
  const netWorth = totalAssets - totalLiabilities;
  const monthlyInflow = cashFlows.filter(c => c.type === 'inflow').reduce((s, c) => s + Number(c.amount), 0);
  const monthlyOutflow = cashFlows.filter(c => c.type === 'outflow').reduce((s, c) => s + Number(c.amount), 0);
  const netCashFlow = monthlyInflow - monthlyOutflow;

  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  const assetData = Object.entries(
    assets.reduce((acc, a) => { acc[a.type] = (acc[a.type] || 0) + Number(a.value); return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name: name.replace('_', ' '), value }));

  const forecastData = buildForecast(cashFlows);

  const riskColor: Record<string, string> = { conservative: "bg-blue-100 text-blue-700", moderate: "bg-amber-100 text-amber-700", aggressive: "bg-rose-100 text-rose-700" };

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <Link href="/">
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3" data-testid="link-back-clients">
            <ChevronLeft className="w-3.5 h-3.5" /> All Clients
          </button>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-client-name">{client.name}</h1>
              <Badge className={`${riskColor[client.riskTolerance] || 'bg-secondary text-secondary-foreground'} capitalize text-xs font-semibold border-0`}>
                {client.riskTolerance} Risk
              </Badge>
              <Badge variant="outline" className="text-xs">Age {client.age}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Unified Balance Sheet &amp; Cash Flow Intelligence
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => generateStrategy.mutate()}
              disabled={generateStrategy.isPending}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0 shadow-lg shadow-indigo-500/20"
              data-testid="button-generate-strategy"
            >
              {generateStrategy.isPending ? (
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 animate-spin" /> Analyzing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4" /> Generate AI Strategy
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          label="Net Worth"
          value={formatCurrency(netWorth, true)}
          subLabel={`${formatCurrency(totalAssets, true)} assets`}
          icon={Wallet}
          color="blue"
        />
        <KPICard
          label="Net Cash Flow"
          value={(netCashFlow >= 0 ? "+" : "") + formatCurrency(netCashFlow, true) + "/mo"}
          subLabel={netCashFlow >= 0 ? "Positive surplus" : "Deficit — review outflows"}
          icon={netCashFlow >= 0 ? TrendingUp : TrendingDown}
          color={netCashFlow >= 0 ? "green" : "red"}
          trend={netCashFlow >= 0 ? "up" : "down"}
        />
        <KPICard
          label="Debt-to-Assets"
          value={formatPct(debtRatio)}
          subLabel={debtRatio < 40 ? "Healthy leverage" : "High leverage — monitor"}
          icon={Scale}
          color={debtRatio < 40 ? "purple" : "red"}
        />
        <KPICard
          label="Annual Income"
          value={formatCurrency(monthlyInflow * 12, true)}
          subLabel={`${formatCurrency(monthlyOutflow * 12, true)}/yr expenses`}
          icon={Activity}
          color="amber"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Asset Allocation Pie */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Asset Allocation</CardTitle>
            <CardDescription>Breakdown of holdings by class</CardDescription>
          </CardHeader>
          <CardContent>
            {assetData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={assetData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value">
                    {assetData.map((entry, i) => (
                      <Cell key={i} fill={ASSET_COLORS[entry.name.replace(' ', '_')] || `hsl(${i * 60}, 70%, 55%)`} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs capitalize text-muted-foreground">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg">
                <p className="text-xs text-muted-foreground">No assets recorded</p>
                <AddAssetModal clientId={clientId} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 12-Month Cash Flow Forecast */}
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">12-Month Cash Flow Forecast</CardTitle>
            <CardDescription>
              Projected cumulative net position • Monthly surplus: {formatCurrency(netCashFlow)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cashFlows.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={forecastData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cumGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={netCashFlow >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={netCashFlow >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    formatter={(v: number, name: string) => [formatCurrency(v), name === 'cumulative' ? 'Cumulative Net' : name]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="cumulative" name="Cumulative Net" stroke={netCashFlow >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"} fill="url(#cumGradient)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg">
                <p className="text-xs text-muted-foreground">No cash flow data yet</p>
                <AddCashFlowModal clientId={clientId} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Middle Row: Liquidity + AI Strategy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <LiquidityPanel assets={assets} cashFlows={cashFlows} />

        {/* AI Strategy Panel */}
        <Card className={`lg:col-span-2 border-2 shadow-sm transition-all duration-500 ${
          generateStrategy.isPending
            ? "border-indigo-300 shadow-indigo-200"
            : strategies.length > 0 ? "border-indigo-100" : "border-dashed border-border"
        }`}>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-500" />
                AI Balance Sheet Strategy
              </CardTitle>
              <CardDescription>
                {strategies.length > 0
                  ? `${strategies.length} recommendation${strategies.length !== 1 ? "s" : ""} — click "Generate" to refresh`
                  : "Powered by GPT-5 • Analyzes your full balance sheet"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {generateStrategy.isPending ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
                <p className="text-sm text-muted-foreground">Analyzing balance sheet &amp; cash flows…</p>
              </div>
            ) : strategies.length > 0 ? (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {strategies.map((s, i) => (
                  <div key={s.id} className="p-4 rounded-lg border border-border bg-card hover:border-indigo-200 transition-colors" data-testid={`strategy-card-${s.id}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <h4 className="font-semibold text-sm text-foreground">{s.name}</h4>
                      </div>
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs flex-shrink-0">
                        +{formatCurrency(Number(s.impact), true)} impact
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-7">{s.recommendation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-14 h-14 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                  <BrainCircuit className="w-7 h-7 text-indigo-300" />
                </div>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Click <strong>Generate AI Strategy</strong> above to analyze this client's balance sheet and get personalized cash management recommendations.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Card className="border-border/50 shadow-sm">
        <Tabs defaultValue="balance-sheet">
          <div className="border-b border-border px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <TabsList className="bg-secondary/60 h-9">
              <TabsTrigger value="balance-sheet" className="text-xs">Balance Sheet</TabsTrigger>
              <TabsTrigger value="assets" className="text-xs">Assets</TabsTrigger>
              <TabsTrigger value="liabilities" className="text-xs">Liabilities</TabsTrigger>
              <TabsTrigger value="cashflows" className="text-xs">Cash Flows</TabsTrigger>
            </TabsList>
            <div className="flex gap-2 flex-wrap">
              <AddAssetModal clientId={clientId} />
              <AddLiabilityModal clientId={clientId} />
              <AddCashFlowModal clientId={clientId} />
            </div>
          </div>

          <div className="p-5">
            <TabsContent value="balance-sheet" className="m-0">
              <BalanceSheetView assets={assets} liabilities={liabilities} />
            </TabsContent>

            <TabsContent value="assets" className="m-0">
              {assets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {assets.map(a => (
                    <div key={a.id} className="p-4 border rounded-lg hover:border-primary/30 transition-colors" data-testid={`asset-card-${a.id}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ASSET_COLORS[a.type] || '#888' }} />
                          <span className="text-xs font-semibold capitalize text-muted-foreground">{a.type.replace('_', ' ')}</span>
                        </span>
                        <span className="font-bold text-sm">{formatCurrency(Number(a.value))}</span>
                      </div>
                      <p className="text-sm text-foreground">{a.description}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No assets. Add one above.</p>}
            </TabsContent>

            <TabsContent value="liabilities" className="m-0">
              {liabilities.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {liabilities.map(l => (
                      <div key={l.id} className="p-4 border rounded-lg hover:border-rose-300/50 transition-colors" data-testid={`liability-card-${l.id}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-semibold capitalize text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                            {l.type.replace('_', ' ')}
                          </span>
                          <div className="text-right">
                            <p className="font-bold text-sm text-rose-600">{formatCurrency(Number(l.value))}</p>
                            <p className="text-xs text-muted-foreground">{l.interestRate}% APR</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{l.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground">No liabilities. Add one above.</p>}
            </TabsContent>

            <TabsContent value="cashflows" className="m-0">
              {cashFlows.length > 0 ? (
                <div>
                  <div className="mb-5 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Monthly Inflows', value: monthlyInflow, fill: 'hsl(142, 71%, 45%)' },
                        { name: 'Monthly Outflows', value: monthlyOutflow, fill: 'hsl(0, 84%, 60%)' },
                        { name: 'Net', value: Math.abs(netCashFlow), fill: netCashFlow >= 0 ? 'hsl(221, 83%, 53%)' : 'hsl(0, 60%, 50%)' },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                        <RechartsTooltip formatter={(v: number) => formatCurrency(v)} cursor={{ fill: 'hsl(var(--secondary))' }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {[
                            <Cell key="0" fill="hsl(142, 71%, 45%)" />,
                            <Cell key="1" fill="hsl(0, 84%, 60%)" />,
                            <Cell key="2" fill={netCashFlow >= 0 ? 'hsl(221, 83%, 53%)' : 'hsl(0, 60%, 50%)'} />,
                          ]}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="divide-y border rounded-lg overflow-hidden">
                    {cashFlows.map(flow => (
                      <div key={flow.id} className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors" data-testid={`cashflow-row-${flow.id}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            flow.type === 'inflow' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                          }`}>
                            {flow.type === 'inflow' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{flow.description}</p>
                            <p className="text-xs text-muted-foreground capitalize">{flow.category.replace('_', ' ')} • {format(new Date(flow.date), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <span className={`font-bold text-sm ${flow.type === 'inflow' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {flow.type === 'inflow' ? '+' : '-'}{formatCurrency(Number(flow.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground">No cash flows. Add one above.</p>}
            </TabsContent>
          </div>
        </Tabs>
      </Card>
    </Layout>
  );
}
