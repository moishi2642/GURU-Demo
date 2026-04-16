import { useState, useEffect, useRef } from "react";

const BUCKETS = [
  { key: "reserve", label: "Operating Cash", color: "#5a85b8", purpose: "Daily transactions & immediate liquidity", icon: "💧", amount: "$63,574" },
  { key: "yield", label: "Liquidity Reserve", color: "#b8943f", purpose: "Capital preservation through outflow periods", icon: "🛡", amount: "$173,527" },
  { key: "tactical", label: "Capital Build", color: "#3da870", purpose: "Earmarked for near-term goals", icon: "🏗", amount: "$135,000" },
  { key: "growth", label: "Investments", color: "#5585ae", purpose: "Long-horizon compounded growth", icon: "📈", amount: "$3,891,000" },
  { key: "alternatives", label: "Other Assets", color: "#888888", purpose: "Tracked for net worth, outside active management", icon: "🏢", amount: "$1,240,000" },
];

const NAVY = "hsl(222,45%,12%)";
const PAGE_BG = "#0c1828";
const GREEN = "#44e08a";

export default function GuruLandingIntro() {
  const [page, setPage] = useState("landing"); // "landing" | "transition" | "flow"
  const [phase, setPhase] = useState(0);
  const [flowPhase, setFlowPhase] = useState(0);
  const [activeBucket, setActiveBucket] = useState(-1);

  // Landing animation sequence
  useEffect(() => {
    if (page !== "landing") return;
    const timers = [
      setTimeout(() => setPhase(1), 300),   // Logo appears
      setTimeout(() => setPhase(2), 1200),   // Tagline appears
      setTimeout(() => setPhase(3), 2200),   // Subtitle appears
      setTimeout(() => setPhase(4), 3000),   // CTA appears
    ];
    return () => timers.forEach(clearTimeout);
  }, [page]);

  // Flow page animation sequence
  useEffect(() => {
    if (page !== "flow") return;
    setFlowPhase(0);
    setActiveBucket(-1);
    const timers = [
      setTimeout(() => setFlowPhase(1), 200),   // Header
      setTimeout(() => setFlowPhase(2), 600),   // Income node
      setTimeout(() => setFlowPhase(3), 1000),  // GURU engine
      setTimeout(() => setFlowPhase(4), 1400),  // Flow lines appear
      setTimeout(() => { setFlowPhase(5); setActiveBucket(0); }, 1800),
      setTimeout(() => setActiveBucket(1), 2200),
      setTimeout(() => setActiveBucket(2), 2600),
      setTimeout(() => setActiveBucket(3), 3000),
      setTimeout(() => setActiveBucket(4), 3400),
      setTimeout(() => setFlowPhase(6), 3800),  // Summary appears
    ];
    return () => timers.forEach(clearTimeout);
  }, [page]);

  const handleClick = () => {
    setPage("transition");
    setTimeout(() => setPage("flow"), 600);
  };

  const handleBack = () => {
    setPage("transition");
    setTimeout(() => {
      setPhase(0);
      setPage("landing");
    }, 600);
  };

  const baseStyle = {
    width: "100%",
    minHeight: "100vh",
    background: PAGE_BG,
    fontFamily: "'Inter', system-ui, sans-serif",
    overflow: "hidden",
    position: "relative",
    transition: "opacity 0.5s ease",
    opacity: page === "transition" ? 0 : 1,
  };

  // ── LANDING PAGE ──
  if (page === "landing" || (page === "transition" && flowPhase === 0)) {
    return (
      <div style={baseStyle}>
        {/* Subtle grid background */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `
            linear-gradient(rgba(68,224,138,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(68,224,138,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }} />

        {/* Radial glow */}
        <div style={{
          position: "absolute",
          top: "30%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 800, height: 800,
          background: "radial-gradient(circle, rgba(68,224,138,0.06) 0%, transparent 70%)",
          borderRadius: "50%",
          opacity: phase >= 1 ? 1 : 0,
          transition: "opacity 1.5s ease",
        }} />

        <div style={{
          position: "relative", zIndex: 1,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          minHeight: "100vh", padding: "40px 20px",
        }}>
          {/* GURU Logo */}
          <div style={{
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? "translateY(0) scale(1)" : "translateY(30px) scale(0.9)",
            transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
            marginBottom: 40,
          }}>
            <div style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 72,
              fontWeight: 200,
              letterSpacing: "0.35em",
              color: "white",
              textTransform: "uppercase",
            }}>
              GURU
            </div>
            <div style={{
              width: "100%", height: 2,
              background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)`,
              marginTop: 8,
              opacity: phase >= 1 ? 1 : 0,
              transition: "opacity 1s ease 0.5s",
            }} />
          </div>

          {/* Tagline */}
          <div style={{
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
            marginBottom: 16,
          }}>
            <div style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 28,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.9)",
              textAlign: "center",
              lineHeight: 1.4,
            }}>
              The operating system for your capital
            </div>
          </div>

          {/* Subtitle */}
          <div style={{
            opacity: phase >= 3 ? 1 : 0,
            transform: phase >= 3 ? "translateY(0)" : "translateY(15px)",
            transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            marginBottom: 60,
          }}>
            <div style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.4)",
              textAlign: "center",
              lineHeight: 1.7,
              maxWidth: 480,
              letterSpacing: "0.01em",
            }}>
              GURU sees all capital, decides where it should go,
              and directs how it moves — continuously.
            </div>
          </div>

          {/* CTA Button */}
          <div style={{
            opacity: phase >= 4 ? 1 : 0,
            transform: phase >= 4 ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <button
              onClick={handleClick}
              style={{
                background: "transparent",
                border: `1px solid ${GREEN}`,
                color: GREEN,
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                padding: "14px 40px",
                cursor: "pointer",
                transition: "all 0.3s ease",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                e.target.style.background = GREEN;
                e.target.style.color = PAGE_BG;
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "transparent";
                e.target.style.color = GREEN;
              }}
            >
              How GURU Organizes Your Money →
            </button>
          </div>

          {/* Floating data points */}
          {phase >= 3 && (
            <>
              <div style={{
                position: "absolute", top: "15%", left: "10%",
                opacity: 0.15, animation: "float 6s ease-in-out infinite",
              }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: GREEN }}>CF-2</div>
              </div>
              <div style={{
                position: "absolute", top: "20%", right: "12%",
                opacity: 0.12, animation: "float 8s ease-in-out infinite 1s",
              }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: GREEN }}>LQ-7</div>
              </div>
              <div style={{
                position: "absolute", bottom: "25%", left: "15%",
                opacity: 0.1, animation: "float 7s ease-in-out infinite 2s",
              }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: GREEN }}>NW-1</div>
              </div>
              <div style={{
                position: "absolute", bottom: "20%", right: "18%",
                opacity: 0.13, animation: "float 9s ease-in-out infinite 0.5s",
              }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: GREEN }}>MM-1</div>
              </div>
            </>
          )}
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Inter:wght@200;300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap');
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-12px); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
          @keyframes flowRight {
            0% { width: 0%; }
            100% { width: 100%; }
          }
          @keyframes dashFlow {
            0% { stroke-dashoffset: 20; }
            100% { stroke-dashoffset: 0; }
          }
        `}</style>
      </div>
    );
  }

  // ── FLOW DIAGRAM PAGE ──
  return (
    <div style={baseStyle}>
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `
          linear-gradient(rgba(68,224,138,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(68,224,138,0.02) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        padding: "40px 60px",
        maxWidth: 1200, margin: "0 auto",
      }}>
        {/* Back button */}
        <button
          onClick={handleBack}
          style={{
            background: "none", border: "none",
            color: "rgba(255,255,255,0.35)",
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 12, cursor: "pointer",
            letterSpacing: "0.06em",
            marginBottom: 30,
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => e.target.style.color = GREEN}
          onMouseLeave={(e) => e.target.style.color = "rgba(255,255,255,0.35)"}
        >
          ← Back
        </button>

        {/* Header */}
        <div style={{
          opacity: flowPhase >= 1 ? 1 : 0,
          transform: flowPhase >= 1 ? "translateY(0)" : "translateY(15px)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          marginBottom: 50,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", color: GREEN, marginBottom: 8,
          }}>
            GURU INTELLIGENCE · CAPITAL ALLOCATION
          </div>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 32, fontStyle: "italic",
            color: "rgba(255,255,255,0.9)", marginBottom: 8,
          }}>
            How GURU organizes your money
          </div>
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.4)", maxWidth: 600,
          }}>
            Every dollar flows through the GURU engine and is allocated to one of five strategic buckets based on your cash flow forecast, liquidity needs, and goals.
          </div>
        </div>

        {/* Flow Diagram */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
        }}>

          {/* INCOME SOURCE NODE */}
          <div style={{
            opacity: flowPhase >= 2 ? 1 : 0,
            transform: flowPhase >= 2 ? "scale(1)" : "scale(0.8)",
            transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
            display: "flex", flexDirection: "column", alignItems: "center",
            marginBottom: 0,
          }}>
            <div style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              padding: "16px 48px",
              textAlign: "center",
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4,
              }}>ALL INCOME SOURCES</div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 22, fontWeight: 400, color: "white",
              }}>$489,966</div>
              <div style={{
                fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4,
              }}>Salary, bonus, dividends, distributions</div>
            </div>
          </div>

          {/* Downward flow line */}
          <div style={{
            width: 2, height: 40,
            background: flowPhase >= 3 ? `linear-gradient(to bottom, rgba(255,255,255,0.15), ${GREEN})` : "transparent",
            transition: "background 0.5s ease",
          }} />

          {/* GURU ENGINE NODE */}
          <div style={{
            opacity: flowPhase >= 3 ? 1 : 0,
            transform: flowPhase >= 3 ? "scale(1)" : "scale(0.8)",
            transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            display: "flex", flexDirection: "column", alignItems: "center",
            marginBottom: 0,
          }}>
            <div style={{
              background: `linear-gradient(135deg, rgba(68,224,138,0.12), rgba(68,224,138,0.04))`,
              border: `1.5px solid ${GREEN}`,
              padding: "20px 56px",
              textAlign: "center",
              position: "relative",
            }}>
              {/* Pulse ring */}
              <div style={{
                position: "absolute", inset: -6,
                border: `1px solid ${GREEN}`,
                opacity: 0.2,
                animation: flowPhase >= 3 ? "pulse 2s ease-in-out infinite" : "none",
              }} />
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.16em",
                textTransform: "uppercase", color: GREEN, marginBottom: 6,
              }}>GURU ENGINE</div>
              <div style={{
                fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5,
              }}>
                Analyzes · Decides · Allocates
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9, color: "rgba(68,224,138,0.5)", marginTop: 8,
                letterSpacing: "0.06em",
              }}>MODEL: CFO-7.2 · CONFIDENCE: 94%</div>
            </div>
          </div>

          {/* Flow lines to buckets */}
          <div style={{
            width: 2, height: 30,
            background: flowPhase >= 4 ? `linear-gradient(to bottom, ${GREEN}, rgba(255,255,255,0.1))` : "transparent",
            transition: "background 0.5s ease",
          }} />

          {/* Horizontal spread line */}
          <div style={{
            position: "relative",
            width: "90%",
            height: 2,
            background: flowPhase >= 4 ? "rgba(255,255,255,0.1)" : "transparent",
            transition: "background 0.5s ease",
            marginBottom: 20,
          }}>
            {/* 5 vertical drops */}
            {BUCKETS.map((b, i) => (
              <div key={b.key} style={{
                position: "absolute",
                left: `${10 + i * 20}%`,
                top: 0,
                width: 2, height: 24,
                background: activeBucket >= i
                  ? `linear-gradient(to bottom, rgba(255,255,255,0.1), ${b.color})`
                  : "transparent",
                transition: "background 0.4s ease",
                transform: "translateX(-1px)",
              }} />
            ))}
          </div>

          {/* BUCKET CARDS */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 12,
            width: "100%",
            marginTop: 8,
          }}>
            {BUCKETS.map((bucket, i) => (
              <div
                key={bucket.key}
                style={{
                  opacity: activeBucket >= i ? 1 : 0,
                  transform: activeBucket >= i ? "translateY(0)" : "translateY(20px)",
                  transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <div style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  borderTop: `3px solid ${bucket.color}`,
                  overflow: "hidden",
                }}>
                  {/* Bucket header */}
                  <div style={{ padding: "14px 14px 10px" }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
                      textTransform: "uppercase", color: bucket.color,
                      marginBottom: 8,
                    }}>
                      {bucket.label}
                    </div>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 20, fontWeight: 400, color: "white",
                      marginBottom: 6,
                    }}>
                      {bucket.amount}
                    </div>
                    <div style={{
                      fontSize: 11, color: "rgba(255,255,255,0.4)",
                      lineHeight: 1.5,
                    }}>
                      {bucket.purpose}
                    </div>
                  </div>

                  {/* Flow indicator */}
                  <div style={{
                    height: 3,
                    background: `linear-gradient(90deg, ${bucket.color}, transparent)`,
                    opacity: activeBucket >= i ? 1 : 0,
                    transition: "opacity 0.8s ease 0.3s",
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Summary bar */}
          <div style={{
            opacity: flowPhase >= 6 ? 1 : 0,
            transform: flowPhase >= 6 ? "translateY(0)" : "translateY(15px)",
            transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            width: "100%",
            marginTop: 40,
          }}>
            {/* Proportional bar */}
            <div style={{
              display: "flex", height: 6, width: "100%",
              overflow: "hidden", marginBottom: 16,
            }}>
              {BUCKETS.map((b) => {
                const amounts = { reserve: 63574, yield: 173527, tactical: 135000, growth: 3891000, alternatives: 1240000 };
                const total = Object.values(amounts).reduce((a, c) => a + c, 0);
                const pct = (amounts[b.key] / total) * 100;
                return (
                  <div key={b.key} style={{
                    width: `${pct}%`, background: b.color,
                    transition: "width 1s ease",
                  }} />
                );
              })}
            </div>

            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
            }}>
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "rgba(255,255,255,0.35)",
                  marginBottom: 4,
                }}>TOTAL ORGANIZED CAPITAL</div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 28, fontWeight: 300, color: "white",
                }}>$5,503,101</div>
              </div>
              <div style={{
                fontSize: 11, color: "rgba(255,255,255,0.3)",
                textAlign: "right", lineHeight: 1.6,
              }}>
                Every dollar has a purpose.<br />
                Nothing sits idle.
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Inter:wght@200;300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap');
        @keyframes pulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
