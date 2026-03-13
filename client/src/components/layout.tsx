import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Users, BrainCircuit, Users2, Bell, Search } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { label: "Client Portfolios",  href: "/",              icon: Users },
    { label: "Book of Business",   href: "/bookofbusiness", icon: Users2 },
    { label: "AI Insights",        href: "/insights",       icon: BrainCircuit },
  ];

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col md:flex-row">

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className="w-full md:w-56 flex flex-col shadow-xl z-10 flex-shrink-0 h-full"
        style={{ background: "hsl(222,45%,8%)" }}
      >
        {/* ── Brand ─────────────────────────────────────────────────────── */}
        <div className="px-5 pt-6 pb-5 border-b border-white/[0.07]">
          <div className="flex items-center justify-between">
            <span
              className="font-display text-[19px] text-white leading-none"
              style={{ letterSpacing: "0.05em" }}
            >
              GURU<span style={{ color: "#9a7b3c" }}>.</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                className="flex items-center justify-center w-7 h-7 rounded transition-colors"
                style={{ color: "rgba(255,255,255,0.30)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.30)")}
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                className="flex items-center justify-center w-7 h-7 rounded transition-colors"
                style={{ color: "rgba(255,255,255,0.30)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.30)")}
              >
                <Bell className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-[9px] text-white/25 uppercase tracking-[0.14em] mt-1.5">
            Wealth Intelligence
          </p>
        </div>

        {/* ── Navigation ────────────────────────────────────────────────── */}
        <nav className="px-3 py-4 flex-1">
          <p
            className="text-[9px] font-bold uppercase px-2 mb-2"
            style={{ color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em" }}
          >
            Platform
          </p>

          {navItems.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`
                  group flex items-center gap-2.5 px-2 py-[7px] rounded
                  text-[12.5px] font-medium transition-all duration-100 mb-0.5
                  ${isActive
                    ? "text-white"
                    : "text-white/40 hover:text-white/75 hover:bg-white/[0.04]"
                  }
                `}
                style={
                  isActive
                    ? {
                        background: "rgba(255,255,255,0.09)",
                        boxShadow: "inset 2px 0 0 hsl(216,82%,55%)",
                      }
                    : undefined
                }
              >
                <item.icon
                  className="w-[14px] h-[14px] flex-shrink-0 transition-colors"
                  style={{ color: isActive ? "hsl(216,82%,65%)" : undefined }}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ── Income Calculator portal slot ─────────────────────────────── */}
        <div id="guru-calc-slot" className="flex-shrink-0" />

        {/* ── Advisor footer ────────────────────────────────────────────── */}
        <div
          className="px-3 pb-4 pt-3 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="flex items-center gap-2.5 px-2.5 py-2 rounded"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {/* Avatar */}
            <div
              className="w-6 h-6 rounded flex items-center justify-center
                         text-white font-bold text-[9px] flex-shrink-0"
              style={{ background: "hsl(216,82%,38%)" }}
            >
              WA
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-semibold text-white/85 truncate leading-none">
                Wealth Advisor
              </p>
              <p className="text-[10px] text-white/30 truncate mt-0.5">
                Admin access
              </p>
            </div>
            {/* Settings dot */}
            <div className="w-1 h-1 rounded-full bg-white/20 flex-shrink-0" />
          </div>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0">

        {/* ── Page content ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
