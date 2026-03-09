import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Users, BrainCircuit, BarChart3, Layers, Bell, Search, Users2 } from "lucide-react";

type HeatStatus = "ok" | "excess" | "deficit" | "product" | "followup" | "autobill" | "movement";
const HM_COLORS: Record<HeatStatus, string> = {
  ok: "#10b981", excess: "#f59e0b", deficit: "#ef4444",
  product: "#3b82f6", followup: "#8b5cf6", autobill: "#ec4899", movement: "#06b6d4",
};
const HM_LEGEND: { key: HeatStatus; label: string }[] = [
  { key: "ok",       label: "Healthy" },
  { key: "excess",   label: "Excess Cash" },
  { key: "deficit",  label: "Deficit" },
  { key: "product",  label: "Product" },
  { key: "followup", label: "Follow Up" },
  { key: "autobill", label: "Autobill" },
  { key: "movement", label: "Movement" },
];
const HM_DATA: { n: string; s: HeatStatus }[] = [
  {n:"Kessler",s:"movement"},{n:"Anderson",s:"excess"},{n:"Blake",s:"ok"},{n:"Chen",s:"product"},
  {n:"Davis",s:"deficit"},{n:"Evans",s:"autobill"},{n:"Foster",s:"excess"},{n:"Garcia",s:"ok"},
  {n:"Harris",s:"followup"},{n:"Irving",s:"movement"},{n:"James",s:"excess"},{n:"Kelly",s:"product"},
  {n:"Lopez",s:"ok"},{n:"Mason",s:"deficit"},{n:"Norton",s:"autobill"},{n:"Owen",s:"excess"},
  {n:"Parker",s:"movement"},{n:"Quinn",s:"ok"},{n:"Reed",s:"product"},{n:"Scott",s:"followup"},
  {n:"Taylor",s:"excess"},{n:"Upton",s:"deficit"},{n:"Vance",s:"autobill"},{n:"Walsh",s:"excess"},
  {n:"Xavier",s:"ok"},{n:"Young",s:"movement"},{n:"Zhang",s:"product"},{n:"Abbott",s:"excess"},
  {n:"Brown",s:"deficit"},{n:"Cole",s:"followup"},{n:"Doyle",s:"ok"},{n:"Ellis",s:"autobill"},
  {n:"Flynn",s:"excess"},{n:"Grant",s:"movement"},{n:"Holt",s:"product"},{n:"Irwin",s:"ok"},
  {n:"Janes",s:"excess"},{n:"Knox",s:"deficit"},{n:"Lane",s:"followup"},{n:"Moore",s:"autobill"},
  {n:"Nash",s:"ok"},{n:"Ortiz",s:"excess"},{n:"Penn",s:"movement"},{n:"Quinn2",s:"product"},
  {n:"Ramos",s:"deficit"},{n:"Stone",s:"autobill"},{n:"Troy",s:"ok"},{n:"Vega",s:"excess"},
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { label: "Client Portfolios", href: "/", icon: Users },
    { label: "Book of Business", href: "/bookofbusiness", icon: Users2 },
    { label: "AI Insights", href: "/insights", icon: BrainCircuit },
  ];

  const needsAction = HM_DATA.filter(c => c.s !== "ok").length;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-full md:w-60 bg-[hsl(222,47%,10%)] flex flex-col shadow-2xl z-10 flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Layers className="text-white w-4 h-4" />
          </div>
          <div>
            <span className="font-display font-bold text-lg text-white tracking-tight leading-none">GURU</span>
            <p className="text-[9px] text-white/35 uppercase tracking-widest font-medium mt-0.5">Wealth Intelligence</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="px-3 py-5 space-y-0.5">
          <p className="text-[9px] font-semibold text-white/25 uppercase tracking-widest px-3 mb-2.5">Navigation</p>
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-150 text-[13px] font-medium ${
                  isActive
                    ? "bg-white/12 text-white"
                    : "text-white/45 hover:bg-white/6 hover:text-white/75"
                }`}
              >
                <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-blue-400" : "text-white/40"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ── Client Heatmap ─────────────────────────────────────────────── */}
        <div className="px-3 py-3 border-t border-white/8 flex-1">
          <div className="px-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Client Heatmap</p>
              <span className="text-[9px] font-bold text-rose-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                {needsAction} flags
              </span>
            </div>
            <p className="text-[9px] text-white/20 mb-2.5">{HM_DATA.length} accounts in book</p>

            {/* Grid of squares */}
            <div className="flex flex-wrap gap-[3px]">
              {HM_DATA.map((c, i) => (
                <div
                  key={i}
                  title={`${c.n} — ${c.s}`}
                  className="w-[18px] h-[18px] rounded-[3px] cursor-default hover:scale-125 transition-transform flex-shrink-0"
                  style={{ background: HM_COLORS[c.s] }}
                />
              ))}
            </div>

            {/* Legend */}
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
              {HM_LEGEND.map(({ key, label }) => {
                const count = HM_DATA.filter(d => d.s === key).length;
                return (
                  <div key={key} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: HM_COLORS[key] }} />
                    <span className="text-[8px] text-white/35 truncate">{label}</span>
                    <span className="text-[8px] text-white/20 ml-auto tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Advisor footer */}
        <div className="px-3 pb-4 border-t border-white/8 pt-3 flex-shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shadow-md flex-shrink-0">
              WA
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white/90 truncate leading-none">Advisor Portal</p>
              <p className="text-[11px] text-white/35 truncate mt-0.5">Admin Access</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar — dark navy matching sidebar */}
        <header className="border-b border-white/10 flex-shrink-0 flex items-center justify-between px-6 py-3" style={{ background: "hsl(222,47%,13%)" }}>
          <div className="flex items-center gap-2 text-[13px] text-white/50">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>AI Financial Decisioning System</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-white/40 hover:text-white/70 transition-colors">
              <Search className="w-4 h-4" />
            </button>
            <button className="text-white/40 hover:text-white/70 transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <span className="h-4 w-px bg-white/15" />
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-medium border border-emerald-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AI Ready
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 md:p-7">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
