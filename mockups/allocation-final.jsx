import { useState, useEffect } from "react";

/*
 * ALLOCATION TAB — ENTRY EXPERIENCE
 *
 * Two views, one tab:
 *
 *   VIEW 1 — GI Intro (full screen, animated)
 *     The system announces what it found. Animated drop-in.
 *     Simple: system name, thinking beat, key findings, CTA.
 *     Click anywhere to skip. Click CTA to proceed.
 *
 *   VIEW 2 — Current Allocation Tool
 *     The actual working tool. Insight banner, liquidity policy,
 *     product selection, confirm & execute. Already built.
 *     This mockup shows a lightweight representation of it.
 *
 * The intro is a LAYER BEFORE the tool, not baked into it.
 */

const SERIF = "'Playfair Display', Georgia, serif";
const UI = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";
const GREEN = "#44e08a";
const GOLD = "#9a7b3c";
const DARK = "#0c1828";
const SURFACE = "#0f1e33";
const CARD_BG = "#1e2838";
const NAVY = "hsl(222,45%,12%)";
const BORDER = "rgba(255,255,255,0.08)";

const fmt = (n) => "$" + n.toLocaleString("en-US");

export default function AllocationFinal() {
  const [view, setView] = useState("intro"); // "intro" | "tool"
  const [phase, setPhase] = useState(0);

  // Animated intro sequence
  useEffect(() => {
    if (view !== "intro") return;
    const timers = [
      setTimeout(() => setPhase(1), 300),     // System header
      setTimeout(() => setPhase(2), 800),     // Thinking
      setTimeout(() => setPhase(3), 2600),    // Signal + description
      setTimeout(() => setPhase(4), 3200),    // Data col 1
      setTimeout(() => setPhase(5), 3500),    // Data col 2
      setTimeout(() => setPhase(6), 3750),    // Data col 3
      setTimeout(() => setPhase(7), 3950),    // Data col 4
      setTimeout(() => setPhase(8), 4150),    // Data col 5
      setTimeout(() => setPhase(9), 4600),    // Source accounts
      setTimeout(() => setPhase(10), 5200),   // CTA
    ];
    return () => timers.forEach(clearTimeout);
  }, [view]);

  // Skip animation
  const skipToReady = () => {
    if (phase < 10) setPhase(10);
  };

  const enterTool = () => setView("tool");

  return (
    <div style={{ minHeight: "100vh", fontFamily: UI }}>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* VIEW 1 — GI INTRO                                      */}
      {/* ═══════════════════════════════════════════════════════ */}
      {view === "intro" && (
        <div
          onClick={skipToReady}
          style={{
            minHeight: "100vh",
            background: DARK,
            color: "#fff",
            display: "flex", flexDirection: "column",
            position: "relative",
            cursor: phase < 10 ? "pointer" : "default",
          }}
        >
          {/* Dot grid */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "radial-gradient(rgba(255,255,255,0.018) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            pointerEvents: "none",
            opacity: phase >= 1 ? 1 : 0,
            transition: "opacity 1.5s ease",
          }} />

          {/* System header bar */}
          <div style={{
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? "translateY(0)" : "translateY(-4px)",
            transition: "all 0.4s ease",
            padding: "14px 32px",
            borderBottom: `1px solid ${BORDER}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            position: "relative", zIndex: 1,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: GREEN,
                boxShadow: "0 0 6px rgba(68,224,138,0.6)",
                animation: "pulse 2.2s infinite",
              }} />
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase", color: GREEN,
              }}>GURU Intelligence</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)" }}>·</span>
              <span style={{
                fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.22)",
                letterSpacing: "0.04em",
              }}>RC-1 Reallocation Calculator</span>
            </div>
            <span style={{
              fontFamily: MONO, fontSize: 9, color: "rgba(255,255,255,0.15)",
              letterSpacing: "0.06em",
            }}>LIVE · APR 15 2026 · CFO-7.2 · 94% CONFIDENCE</span>
          </div>

          {/* Main area */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            justifyContent: "center",
            padding: "48px 48px 64px",
            position: "relative", zIndex: 1,
            maxWidth: 860,
          }}>

            {/* Thinking state */}
            {phase >= 2 && phase < 3 && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: GREEN, opacity: 0.6,
                        animation: `thinkDot 1.2s ${i * 0.2}s ease-in-out infinite`,
                      }} />
                    ))}
                  </div>
                  <span style={{
                    fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em",
                    color: "rgba(255,255,255,0.28)",
                  }}>Analyzing Kessler balance sheet…</span>
                </div>
                <div style={{
                  height: 1, maxWidth: 360,
                  background: `linear-gradient(90deg, transparent, ${GREEN}30, transparent)`,
                  animation: "scanLine 2s ease-in-out infinite",
                }} />
              </div>
            )}

            {/* Resolved content */}
            {phase >= 3 && (
              <>
                {/* Signal badge */}
                <div style={{
                  opacity: phase >= 3 ? 1 : 0,
                  transform: phase >= 3 ? "translateY(0)" : "translateY(6px)",
                  transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                  marginBottom: 16,
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
                    textTransform: "uppercase", color: GREEN,
                    padding: "3px 8px",
                    border: "1px solid rgba(68,224,138,0.25)",
                    background: "rgba(68,224,138,0.06)",
                  }}>Rebalancing Signal</span>
                  <span style={{
                    fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.22)",
                    letterSpacing: "0.04em",
                  }}>KESSLER FAMILY · HOUSEHOLD</span>
                </div>

                {/* Description */}
                <div style={{
                  opacity: phase >= 3 ? 1 : 0,
                  transform: phase >= 3 ? "translateY(0)" : "translateY(6px)",
                  transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s",
                  marginBottom: 28,
                }}>
                  <div style={{
                    fontSize: 15, color: "rgba(255,255,255,0.50)", lineHeight: 1.65,
                    maxWidth: 540,
                  }}>
                    Cash flow model detected excess liquidity following a year-end bonus.
                    Coverage remains at target after rebalancing. Capital is deployable.
                  </div>
                </div>

                {/* Data grid — columns stagger in */}
                <div style={{ marginBottom: 36 }}>
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}>
                    {[
                      { label: "Deployable", value: "$299,966", sub: "excess liquidity", accent: true, p: 4 },
                      { label: "AT Income Pickup", value: "+$18,125", sub: "per year", accent: true, p: 5 },
                      { label: "Pro-Forma AT Yield", value: "3.42%", sub: "vs 2.94% current", accent: false, p: 6 },
                      { label: "Coverage Post-Rebal", value: "12.0 mo", sub: "target: 12.0 mo", accent: false, p: 7 },
                      { label: "Days Idle", value: "47", sub: "since event", accent: false, p: 8 },
                    ].map((m, i) => (
                      <div key={i} style={{
                        padding: "16px 0",
                        paddingRight: 20,
                        borderRight: i < 4 ? "1px solid rgba(255,255,255,0.06)" : "none",
                        paddingLeft: i > 0 ? 20 : 0,
                        opacity: phase >= m.p ? 1 : 0,
                        transform: phase >= m.p ? "translateY(0)" : "translateY(6px)",
                        transition: `all 0.35s cubic-bezier(0.16, 1, 0.3, 1)`,
                      }}>
                        <div style={{
                          fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
                          textTransform: "uppercase", color: "rgba(255,255,255,0.25)",
                          marginBottom: 8,
                        }}>{m.label}</div>
                        <div style={{
                          fontFamily: MONO, fontSize: 22, fontWeight: 400,
                          color: m.accent ? GREEN : "rgba(255,255,255,0.75)",
                          letterSpacing: "-0.02em", lineHeight: 1,
                          marginBottom: 6,
                        }}>{m.value}</div>
                        <div style={{
                          fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.18)",
                          letterSpacing: "0.02em",
                        }}>{m.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Source accounts */}
                  <div style={{
                    marginTop: 20,
                    borderLeft: "2px solid rgba(68,224,138,0.15)",
                    paddingLeft: 16,
                    opacity: phase >= 9 ? 1 : 0,
                    transform: phase >= 9 ? "translateY(0)" : "translateY(6px)",
                    transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}>
                    <div style={{
                      fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
                      textTransform: "uppercase", color: "rgba(255,255,255,0.20)",
                      marginBottom: 10,
                    }}>Excess Located In</div>
                    <div style={{ display: "flex", gap: 28 }}>
                      {[
                        { bucket: "Operating Cash", acct: "Citizens ··3858", amount: "$90,172", color: "#5a85b8" },
                        { bucket: "Reserve", acct: "Goldman ··7710 + Citizens ··4421", amount: "$209,794", color: "#b8943f" },
                      ].map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                          <div style={{ width: 3, height: 14, background: s.color, flexShrink: 0, opacity: 0.7, borderRadius: 1 }} />
                          <div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", marginBottom: 2 }}>
                              <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>{s.bucket}</span>
                              <span style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.22)", marginLeft: 8 }}>{s.acct}</span>
                            </div>
                            <div style={{
                              fontFamily: MONO, fontSize: 14, color: "rgba(255,255,255,0.60)",
                              letterSpacing: "-0.01em",
                            }}>{s.amount}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div style={{
                  opacity: phase >= 10 ? 1 : 0,
                  transform: phase >= 10 ? "translateY(0)" : "translateY(6px)",
                  transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                  display: "flex", alignItems: "center", gap: 20,
                }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); enterTool(); }}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(68,224,138,0.35)",
                      color: GREEN,
                      fontFamily: MONO, fontSize: 11, fontWeight: 500,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      padding: "11px 28px",
                      cursor: "pointer", transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => { e.target.style.background = "rgba(68,224,138,0.08)"; e.target.style.borderColor = "rgba(68,224,138,0.55)"; }}
                    onMouseLeave={(e) => { e.target.style.background = "transparent"; e.target.style.borderColor = "rgba(68,224,138,0.35)"; }}
                  >
                    Open Allocation Tool →
                  </button>
                  <span style={{
                    fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.15)",
                    letterSpacing: "0.04em",
                  }}>3 STEPS · ~6 MIN · REVERSIBLE</span>
                </div>
              </>
            )}
          </div>

          {/* Skip hint */}
          {phase > 0 && phase < 10 && (
            <div style={{
              position: "fixed", bottom: 24, left: "50%",
              transform: "translateX(-50%)",
              fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.10)",
              letterSpacing: "0.06em",
              animation: "fadeIn 1s ease 2s both",
            }}>
              CLICK ANYWHERE TO SKIP
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* VIEW 2 — ALLOCATION TOOL (current app)                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      {view === "tool" && (
        <div style={{
          minHeight: "100vh", background: DARK, color: "#fff",
          animation: "fadeIn 0.4s ease",
        }}>
          {/* This is a lightweight representation of the current tool */}
          {/* In production, this is GuruAllocationView from client-dashboard.tsx */}

          <div style={{ padding: "24px 32px", maxWidth: 960 }}>
            {/* Page header */}
            <div style={{
              display: "flex", alignItems: "flex-start",
              justifyContent: "space-between", marginBottom: 20,
            }}>
              <div>
                <div style={{
                  fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.92)",
                  letterSpacing: "-0.01em",
                }}>Allocation Tool</div>
                <div style={{
                  fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 3,
                }}>Set coverage targets · GURU generates the recommended transfer schedule</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  border: "1px solid rgba(94,204,138,0.35)",
                  borderRadius: 20, padding: "5px 12px",
                  background: "rgba(94,204,138,0.08)",
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: "50%", background: GREEN,
                    boxShadow: "0 0 4px rgba(68,224,138,0.5)",
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: GREEN,
                    letterSpacing: "0.04em",
                  }}>LIVE · 8S AGO</span>
                </div>
                <button
                  onClick={() => setView("intro")}
                  style={{
                    background: CARD_BG, border: `1px solid ${BORDER}`,
                    borderRadius: 20, padding: "5px 14px",
                    fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                  }}
                >← Back to Summary</button>
              </div>
            </div>

            {/* Insight banner */}
            <div style={{
              background: CARD_BG, border: `1px solid ${BORDER}`,
              borderRadius: 12, overflow: "hidden", marginBottom: 20,
            }}>
              <div style={{ display: "flex" }}>
                <div style={{ flex: 1, padding: "24px 28px", minWidth: 0 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%", background: GOLD,
                      boxShadow: "0 0 5px rgba(154,123,60,0.4)",
                      animation: "pulse 2.6s infinite",
                    }} />
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
                      textTransform: "uppercase", color: "rgba(154,123,60,0.85)",
                    }}>GURU Insight · Kessler Family</span>
                  </div>
                  <div style={{
                    fontFamily: SERIF, fontSize: 21, fontWeight: 400,
                    fontStyle: "italic", color: "rgba(255,255,255,0.90)",
                    lineHeight: 1.3, marginBottom: 10,
                  }}>
                    Compounding favors capital that stays invested.
                  </div>
                  <div style={{
                    fontSize: 12, lineHeight: 1.65, color: "rgba(255,255,255,0.45)",
                  }}>
                    The Kesslers had a strong year-end — bonuses landed in January. At 24.7 months
                    of coverage against a 14-month target, there's roughly{" "}
                    <span style={{ color: "rgba(154,123,60,0.85)", fontWeight: 500 }}>$299,966</span>{" "}
                    sitting above the threshold.
                  </div>
                </div>
                <div style={{ width: 1, margin: "20px 0", background: "rgba(255,255,255,0.06)" }} />
                <div style={{
                  display: "flex", flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "24px 28px", minWidth: 190, gap: 10,
                }}>
                  {[
                    { label: "Total Assets", val: "$5,912,862", color: "rgba(255,255,255,0.9)" },
                    { label: "Liquid Coverage", val: "24.7 months", color: GOLD },
                    { label: "Excess Liquidity", val: "$299,966", color: GOLD },
                    { label: "Return Pickup", val: "+$18,125/yr", color: "#2e7a52" },
                  ].map((m, i) => (
                    <div key={i}>
                      <div style={{
                        fontSize: 9, fontWeight: 600, letterSpacing: "0.12em",
                        textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 2,
                      }}>{m.label}</div>
                      <div style={{
                        fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                        color: m.color, lineHeight: 1,
                      }}>{m.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 1 indicator */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)",
              }}>1</div>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.10em",
                textTransform: "uppercase", color: "rgba(255,255,255,0.75)",
              }}>Liquidity Policy</span>
              <span style={{
                fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: 8,
              }}>Set coverage months · GURU calculates excess</span>
            </div>

            {/* Placeholder for current tool content */}
            <div style={{
              background: CARD_BG, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: "48px 32px",
              textAlign: "center",
            }}>
              <div style={{
                fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.4)",
                marginBottom: 8,
              }}>Current allocation tool loads here</div>
              <div style={{
                fontSize: 11, color: "rgba(255,255,255,0.20)", lineHeight: 1.6,
                maxWidth: 400, margin: "0 auto",
              }}>
                Bucket coverage sliders, product selection cards,
                and confirm & execute — unchanged from current implementation.
              </div>
              <div style={{
                fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.12)",
                marginTop: 12,
              }}>GuruAllocationView · client-dashboard.tsx</div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes thinkDot {
          0%, 80%, 100% { transform: scale(0.5); opacity: 0.25; }
          40% { transform: scale(1); opacity: 0.8; }
        }
        @keyframes scanLine {
          0% { transform: translateX(-100%); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(250%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
