import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Users, BrainCircuit, BarChart3, Layers, Bell, Search, Users2 } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { label: "Client Portfolios", href: "/", icon: Users },
    { label: "Book of Business", href: "/bookofbusiness", icon: Users2 },
    { label: "AI Insights", href: "/insights", icon: BrainCircuit },
  ];

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col md:flex-row">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-full md:w-60 bg-[hsl(222,47%,10%)] flex flex-col shadow-2xl z-10 flex-shrink-0 h-full">
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

        {/* Income Calculator slot — populated via portal from GURU tab */}
        <div id="guru-calc-slot" className="flex-shrink-0" />

        {/* Spacer pushes footer to bottom */}
        <div className="flex-1" />

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
      <main className="flex-1 flex flex-col min-h-0 min-w-0">
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
