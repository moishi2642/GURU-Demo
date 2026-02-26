import { useParams } from "wouter";
import { Layout } from "@/components/layout";
import { useClientDashboard, useGenerateStrategy } from "@/hooks/use-clients";
import { AddAssetModal, AddLiabilityModal, AddCashFlowModal } from "@/components/financial-forms";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import { 
  BrainCircuit, TrendingUp, TrendingDown, Wallet, Activity, ShieldCheck, Zap 
} from "lucide-react";
import { format } from "date-fns";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function ClientDashboard() {
  const { id } = useParams();
  const clientId = parseInt(id || "0", 10);
  const { data, isLoading } = useClientDashboard(clientId);
  const generateStrategy = useGenerateStrategy(clientId);

  if (isLoading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-8">
          <div className="h-24 bg-secondary/50 rounded-2xl w-full" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-secondary/50 rounded-2xl" />)}
          </div>
          <div className="h-[400px] bg-secondary/50 rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (!data) return <Layout><div className="text-center mt-20">Client not found</div></Layout>;

  const { client, assets, liabilities, cashFlows, strategies } = data;

  const totalAssets = assets.reduce((sum, a) => sum + Number(a.value), 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + Number(l.value), 0);
  const netWorth = totalAssets - totalLiabilities;
  
  const monthlyInflow = cashFlows.filter(c => c.type === 'inflow').reduce((sum, c) => sum + Number(c.amount), 0);
  const monthlyOutflow = cashFlows.filter(c => c.type === 'outflow').reduce((sum, c) => sum + Number(c.amount), 0);
  const netCashFlow = monthlyInflow - monthlyOutflow;

  const assetData = assets.map(a => ({ name: a.type, value: Number(a.value) }));
  const cashFlowData = [
    { name: 'Inflows', amount: monthlyInflow },
    { name: 'Outflows', amount: monthlyOutflow }
  ];

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-display font-bold text-foreground">{client.name}'s Dashboard</h1>
            <span className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-bold uppercase tracking-wider">
              {client.riskTolerance} Risk
            </span>
          </div>
          <p className="text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Unified Client Profile & Balance Sheet
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => generateStrategy.mutate()} 
            disabled={generateStrategy.isPending}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-indigo-500/25 border-0 hover-lift"
          >
            {generateStrategy.isPending ? (
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 animate-spin" /> Synthesizing Data...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4" /> AI Generate Strategy
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Net Worth</p>
                <h3 className="text-2xl font-bold text-foreground">{formatCurrency(netWorth)}</h3>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Assets</p>
                <h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(totalAssets)}</h3>
              </div>
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Liabilities</p>
                <h3 className="text-2xl font-bold text-rose-600">{formatCurrency(totalLiabilities)}</h3>
              </div>
              <div className="p-2 bg-rose-500/10 rounded-lg">
                <TrendingDown className="w-5 h-5 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Net Cash Flow</p>
                <h3 className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow)}
                </h3>
              </div>
              <div className="p-2 bg-secondary rounded-lg">
                <Activity className="w-5 h-5 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Charts Section */}
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Asset Allocation & Flow</CardTitle>
            <CardDescription>Visual breakdown of current holdings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-8 h-[300px]">
              <div className="flex-1 min-w-0">
                {assets.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={assetData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {assetData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                    Add assets to view allocation
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {cashFlows.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashFlowData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{fill: 'hsl(var(--muted-foreground))'}} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(val) => `$${val/1000}k`} tick={{fill: 'hsl(var(--muted-foreground))'}} axisLine={false} tickLine={false} />
                      <RechartsTooltip formatter={(val: number) => formatCurrency(val)} cursor={{fill: 'hsl(var(--secondary))'}} />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {cashFlowData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.name === 'Inflows' ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-5))'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                    Add cash flows to view metrics
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Strategy Section */}
        <Card className={`border-2 shadow-lg transition-all duration-500 ${generateStrategy.isPending ? 'border-indigo-400 shadow-indigo-500/20 animate-pulse' : 'border-indigo-100 shadow-indigo-500/5'}`}>
          <CardHeader className="bg-indigo-50/50 border-b border-indigo-100/50">
            <CardTitle className="flex items-center gap-2 text-indigo-900">
              <Zap className="w-5 h-5 text-indigo-500" />
              Active Strategy
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[340px] overflow-y-auto p-6 space-y-4">
              {strategies.length > 0 ? (
                strategies.map((strategy, i) => (
                  <div key={strategy.id} className="p-4 bg-white border border-indigo-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-foreground text-sm">{strategy.name}</h4>
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                        +{formatCurrency(Number(strategy.impact))} Impact
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{strategy.recommendation}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-3 text-right">
                      Generated {format(new Date(strategy.createdAt!), 'MMM d, yyyy')}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-300 rounded-full flex items-center justify-center mx-auto mb-3">
                    <BrainCircuit className="w-6 h-6" />
                  </div>
                  <p className="text-sm text-muted-foreground px-4">No AI strategies generated yet. Click the button above to analyze this profile.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Tabs */}
      <Card className="border-border/50 shadow-sm">
        <Tabs defaultValue="assets" className="w-full">
          <div className="border-b border-border px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="liabilities">Liabilities</TabsTrigger>
              <TabsTrigger value="cashflows">Cash Flows</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <AddAssetModal clientId={clientId} />
              <AddLiabilityModal clientId={clientId} />
              <AddCashFlowModal clientId={clientId} />
            </div>
          </div>
          
          <div className="p-6">
            <TabsContent value="assets" className="m-0 focus-visible:ring-0 focus-visible:outline-none">
              {assets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assets.map(asset => (
                    <div key={asset.id} className="p-4 border rounded-xl hover:border-primary/30 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md uppercase tracking-wider">
                          {asset.type.replace('_', ' ')}
                        </span>
                        <span className="font-bold">{formatCurrency(Number(asset.value))}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{asset.description}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-muted-foreground text-sm">No assets recorded.</p>}
            </TabsContent>

            <TabsContent value="liabilities" className="m-0 focus-visible:ring-0 focus-visible:outline-none">
              {liabilities.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liabilities.map(liability => (
                    <div key={liability.id} className="p-4 border rounded-xl hover:border-rose-500/30 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded-md uppercase tracking-wider">
                          {liability.type.replace('_', ' ')}
                        </span>
                        <div className="text-right">
                          <span className="font-bold block">{formatCurrency(Number(liability.value))}</span>
                          <span className="text-xs text-muted-foreground">{liability.interestRate}% APR</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{liability.description}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-muted-foreground text-sm">No liabilities recorded.</p>}
            </TabsContent>

            <TabsContent value="cashflows" className="m-0 focus-visible:ring-0 focus-visible:outline-none">
              {cashFlows.length > 0 ? (
                <div className="divide-y border rounded-xl overflow-hidden">
                  {cashFlows.map(flow => (
                    <div key={flow.id} className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          flow.type === 'inflow' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                        }`}>
                          {flow.type === 'inflow' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{flow.description}</p>
                          <p className="text-xs text-muted-foreground capitalize">{flow.category.replace('_', ' ')} • {format(new Date(flow.date), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      <span className={`font-bold ${flow.type === 'inflow' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {flow.type === 'inflow' ? '+' : '-'}{formatCurrency(Number(flow.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-muted-foreground text-sm">No cash flows recorded.</p>}
            </TabsContent>
          </div>
        </Tabs>
      </Card>
    </Layout>
  );
}
