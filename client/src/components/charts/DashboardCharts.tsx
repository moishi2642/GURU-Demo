npm import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { type Asset, type Liability, type CashFlow } from '@shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function AssetAllocationChart({ assets }: { assets: Asset[] }) {
  const data = useMemo(() => {
    const agg = assets.reduce((acc, curr) => {
      acc[curr.type] = (acc[curr.type] || 0) + Number(curr.value);
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(agg)
      .map(([name, value]) => ({ name: name.replace('_', ' ').toUpperCase(), value }))
      .filter(d => d.value > 0);
  }, [assets]);

  if (data.length === 0) return (
    <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
      No asset data available
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <RechartsTooltip 
          formatter={(value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
        />
        <Legend verticalAlign="bottom" height={36} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BalanceSheetChart({ assets, liabilities }: { assets: Asset[], liabilities: Liability[] }) {
  const data = useMemo(() => {
    const totalAssets = assets.reduce((sum, a) => sum + Number(a.value), 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + Number(l.value), 0);
    return [
      { name: 'Assets', amount: totalAssets },
      { name: 'Liabilities', amount: totalLiabilities }
    ];
  }, [assets, liabilities]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis 
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} 
          tick={{ fill: 'hsl(var(--muted-foreground))' }} 
          axisLine={false} 
          tickLine={false}
        />
        <RechartsTooltip 
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
          formatter={(value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
        />
        <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.name === 'Assets' ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashFlowChart({ cashFlows }: { cashFlows: CashFlow[] }) {
  const data = useMemo(() => {
    // Sort chronologically
    const sorted = [...cashFlows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Group by month
    const monthly = sorted.reduce((acc, curr) => {
      const month = format(new Date(curr.date), 'MMM yyyy');
      if (!acc[month]) {
        acc[month] = { name: month, net: 0 };
      }
      const val = Number(curr.amount);
      acc[month].net += curr.type === 'inflow' ? val : -val;
      return acc;
    }, {} as Record<string, { name: string, net: number }>);
    
    return Object.values(monthly);
  }, [cashFlows]);

  if (data.length === 0) return (
    <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
      No cash flow data available
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis 
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} 
          tick={{ fill: 'hsl(var(--muted-foreground))' }} 
          axisLine={false} 
          tickLine={false}
        />
        <RechartsTooltip 
          formatter={(value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
        />
        <Line 
          type="monotone" 
          dataKey="net" 
          stroke="hsl(var(--accent))" 
          strokeWidth={3} 
          dot={{ fill: 'hsl(var(--accent))', strokeWidth: 2, r: 4 }} 
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )