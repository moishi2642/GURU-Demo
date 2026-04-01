import { ReactNode } from "react";

export function Layout({ children, sidebarNav, topNav }: { children: ReactNode; sidebarNav?: ReactNode; topNav?: ReactNode }) {

  /* ── Top-nav layout (no sidebar) ── */
  if (topNav) {
    return (
      <div className="h-screen overflow-hidden flex flex-col" style={{ background: "#f0ede8" }}>
        {topNav}
        <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  /* ── Original sidebar layout ── */
  return (
    <div className="h-screen overflow-hidden flex flex-row" style={{ background: "hsl(152,38%,7%)" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        .guru-sb {
          width: 48px;
          transition: width 0.2s ease;
          overflow: hidden;
          flex-shrink: 0;
        }
        .guru-sb:hover {
          width: 170px;
        }
        .sb-hide {
          opacity: 0;
          transition: opacity 0.15s ease;
          white-space: nowrap;
          pointer-events: none;
        }
        .guru-sb:hover .sb-hide {
          opacity: 1;
          pointer-events: auto;
        }
        .sb-collapsed-logo {
          display: flex;
        }
        .guru-sb:hover .sb-collapsed-logo {
          display: none;
        }
        .sb-expanded-logo {
          display: none;
        }
        .guru-sb:hover .sb-expanded-logo {
          display: flex;
        }
      `}</style>

      {/* ── Sidebar ── */}
      <aside
        className="guru-sb flex flex-col z-10 h-full"
        style={{
          background: "#2c3040",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* ── Logo area ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "14px 0 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 10,
          flexShrink: 0,
          position: "relative",
        }}>
          <span className="sb-collapsed-logo" style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 20, fontWeight: 700, letterSpacing: "0.12em",
            lineHeight: 1, alignItems: "center",
          }}>
            <span style={{ color: "#ffffff" }}>G</span><span style={{ color: "#5ecc8a" }}>.</span>
          </span>
          <span className="sb-expanded-logo" style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 20, fontWeight: 700, letterSpacing: "0.12em",
            lineHeight: 1, alignItems: "center", paddingLeft: 14, width: "100%",
          }}>
            <span style={{ color: "#ffffff" }}>GURU</span><span style={{ color: "#5ecc8a" }}>.</span>
          </span>
        </div>

        {/* ── Navigation ── */}
        {sidebarNav ?? (
          <nav className="px-3 py-2 flex-1" />
        )}

        {/* ── Advisor footer ── */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "10px 0 10px 14px",
          flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: "50%",
            background: "rgba(255,255,255,0.08)", flexShrink: 0,
          }} />
          <span className="sb-hide" style={{
            fontSize: 9.5, fontWeight: 600,
            color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em",
            fontFamily: "Inter, system-ui, sans-serif",
          }}>
            Wealth Advisor
          </span>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {children}
      </main>

    </div>
  );
}
