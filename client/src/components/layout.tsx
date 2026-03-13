import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Users, BrainCircuit, Users2, Bell, Search } from "lucide-react";

export function Layout({ children, sidebarNav }: { children: ReactNode; sidebarNav?: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { label: "Client Portfolios",  href: "/",               icon: Users },
    { label: "Book of Business",   href: "/bookofbusiness",  icon: Users2 },
    { label: "AI Insights",        href: "/insights",        icon: BrainCircuit },
  ];

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col md:flex-row">

      {/* ── Sidebar ── */}
      <aside
        className="w-full md:w-52 flex flex-col z-10 flex-shrink-0 h-full"
        style={{ background: "hsl(222,45%,8%)", borderRight: "1px solid rgba(255,255,255,0.05)" }}
      >

        {/* ── Logo ── */}
        <div className="px-6 pt-7 pb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-start justify-between">
            <div>
              <span
                className="font-display text-[20px] text-white leading-none"
                style={{ letterSpacing: "0.04em" }}
              >
                GURU<span style={{ color: "#9a7b3c" }}>.</span>
              </span>
              <p className="text-[8.5px] text-white/20 uppercase mt-1.5" style={{ letterSpacing: "0.16em" }}>
                Wealth Intelligence
              </p>
            </div>
            <div className="flex flex-col gap-1.5 pt-0.5">
              <button
                style={{ color: "rgba(255,255,255,0.22)" }}
                className="hover:text-white/60 transition-colors"
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.22)")}
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                style={{ color: "rgba(255,255,255,0.22)" }}
                className="hover:text-white/60 transition-colors"
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.22)")}
              >
                <Bell className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        {sidebarNav ? sidebarNav : (
          <nav className="px-4 py-5 flex-1">
            {navItems.map((item) => {
              const isActive =
                location === item.href ||
                (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2.5 px-2.5 py-2 rounded mb-0.5
                    text-[12px] font-medium transition-all duration-100
                    ${isActive ? "text-white" : "text-white/32 hover:text-white/65 hover:bg-white/[0.03]"}
                  `}
                  style={isActive ? {
                    background: "rgba(255,255,255,0.07)",
                    boxShadow: "inset 2px 0 0 rgba(154,123,60,0.7)",
                  } : undefined}
                >
                  <item.icon
                    className="w-[13px] h-[13px] flex-shrink-0"
                    style={{ color: isActive ? "#9a7b3c" : undefined, opacity: isActive ? 1 : 0.5 }}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* ── Income Calculator portal slot ── */}
        <div id="guru-calc-slot" className="flex-shrink-0" />

        {/* ── Minimal advisor footer ── */}
        <div
          className="px-6 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="text-[10px] font-medium text-white/40 leading-none">Wealth Advisor</p>
          <p className="text-[9px] text-white/18 mt-1" style={{ letterSpacing: "0.05em" }}>Admin</p>
        </div>

      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="flex-1 overflow-y-auto p-5 md:p-7">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

    </div>
  );
}
