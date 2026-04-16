import { useState, useEffect } from "react";

/*
 * CONCEPT B — "Dark Takeover"
 *
 * The allocation tab opens with an animated transition: the advisor layer
 * fades to the GI dark layer. GURU's engine "wakes up" — logo pulses,
 * signal IDs flash, then the bucket overview materializes. The dark layer
 * takes over ~40% of the screen (left/top) while the advisor content
 * (cards, actions) lives in the light layer (right/bottom).
 *
 * As the advisor moves through steps, the dark-to-light ratio shifts:
 * Step 0 (review): mostly light, dark header
 * Step 1 (recommend): 50/50 split — dark signal panel + light action panel
 * Step 2 (confirm): mostly light, dark summary strip
 * Step 3 (execute): dark takeover for the confirmation moment
 */

const SERIF = "'Playfair Display', Georgia, serif";
const UI = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";
const GREEN = "#44e08a";
const DARK = "#0d1829";
const NAVY = "#1a2a4a";

const SIGNALS = ["CF-2", "LQ-7", "NW-1", "YO-3", "MM-1"];

const BUCKETS = [
  { name: "Operating Cash", color: "#5a85b8", amount: "$132,050", sub: "5.7 mo covered", excess: "+$68,476" },
  { name: "Reserve Cash", color: "#b8943f", amount: "$426,586", sub: "12-mo reserve", excess: "+$253,059" },
  { name: "Capital Build", color: "#3da870", amount: "$135,000", sub: "Home purchase", gap: "–$413,000" },
  { name: "Investments", color: "#5585ae", amount: "$2,313,414", sub: "5+ yr horizon", excess: null },
  { name: "Other Assets", color: "#888888", amount: "$2,989,500", sub: "Tracked", excess: null },
];

export default function ConceptB() {
  const [phase, setPhase] = useState(0);
  const [step, setStep] = useState(0);

  // Entry animation sequence
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),   // Dark bg appears
      setTimeout(() => setPhase(2), 800),   // Logo + signals flash
      setTimeout(() => setPhase(3), 1600),  // "Analyzing" text
      setTimeout(() => setPhase(4), 2400),  // Transition to content
      setTimeout(() => setPhase(5), 3000),  // Full content visible
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // ── ENTRY ANIMATION (phases 0-4) ──
  if (phase < 5) {
    return (
      <div style={{
        minHeight: "100vh",
        background: phase >= 1 ? DARK : "hsl(220,5%,93%)",
        transition: "background 0.8s ease",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column",
        fontFamily: UI,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Grid background */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `
            linear-gradient(rgba(68,224,138,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(68,224,138,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          opacity: phase >= 1 ? 1 : 0,
          transition: "opacity 0.8s ease",
        }} />

        {/* Radial glow */}
        <div style={{
          position: "absolute", top: "40%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 600, height: 600,
          background: `radial-gradient(circle, rgba(68,224,138,0.08) 0%, transparent 70%)`,
          borderRadius: "50%",
          opacity: phase >= 2 ? 1 : 0,
          transition: "opacity 1s ease",
        }} />

        {/* GURU label */}
        <div style={{
          position: "relative", zIndex: 1,
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.16em",
            textTransform: "uppercase", color: GREEN, marginBottom: 16,
          }}>GURU Intelligence</div>
          <div style={{
            fontSize: 48, fontWeight: 200, letterSpacing: "0.3em",
            color: "white", textTransform: "uppercase",
          }}>
            GURU
          </div>
          <div style={{
            width: 120, height: 1, margin: "12px auto",
            background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)`,
          }} />
        </div>

        {/* Floating signal IDs */}
        {phase >= 2 && SIGNALS.map((sig, i) => (
          <div key={sig} style={{
            position: "absolute",
            top: `${20 + (i * 14)}%`,
            left: i % 2 === 0 ? `${8 + i * 5}%` : undefined,
            right: i % 2 === 1 ? `${10 + i * 4}%` : undefined,
            fontFamily: MONO, fontSize: 10, color: GREEN,
            opacity: phase >= 2 ? 0.2 : 0,
            transition: `opacity 0.5s ease ${i * 0.1}s`,
            animation: "float 6s ease-in-out infinite",
            animationDelay: `${i * 0.8}s`,
          }}>
            {sig}
          </div>
        ))}

        {/* Analyzing text */}
        <div style={{
          position: "relative", zIndex: 1,
          marginTop: 32,
          opacity: phase >= 3 ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}>
          <div style={{
            fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.06em",
          }}>
            Analyzing Kessler Family allocation...
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          position: "relative", zIndex: 1,
          width: 200, height: 2, marginTop: 16,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            background: GREEN,
            width: phase >= 4 ? "100%" : phase >= 3 ? "60%" : "0%",
            transition: "width 0.8s ease",
          }} />
        </div>

        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
        `}</style>
      </div>
    );
  }

  // ── MAIN ALLOCATION EXPERIENCE (phase 5+) ──
  return (
    <div style={{
      minHeight: "100vh", fontFamily: UI,
      background: "hsl(220,5%,93%)",
      animation: "fadeIn 0.5s ease",
    }}>
      {/* Dark header band — GI presence at top */}
      <div style={{
        background: DARK,
        borderBottom: `2px solid ${GREEN}`,
      }}>
        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 32px", height: 44,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", cursor: "pointer" }}>← Exit</span>
            <span style={{ color: "rgba(255,255,255,0.12)" }}>|</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>Kessler Family</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>· Asset Allocation</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN }} />
            <span style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>
              STEP {step + 1} OF 3
            </span>
          </div>
        </div>

        {/* Step indicator strip */}
        <div style={{
          display: "flex", padding: "0 32px",
        }}>
          {["Review Allocation", "GURU's Recommendation", "Confirm & Execute"].map((label, i) => (
            <div
              key={i}
              onClick={() => i <= step && setStep(i)}
              style={{
                flex: 1, padding: "12px 0",
                textAlign: "center", cursor: i <= step ? "pointer" : "default",
                borderBottom: i === step ? `2px solid ${GREEN}` : "2px solid transparent",
                transition: "all 0.3s ease",
              }}
            >
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: i === step ? GREEN : i < step ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
                transition: "color 0.3s ease",
              }}>
                {i < step ? "✓ " : ""}{label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Step 0: Review ── */}
      {step === 0 && (
        <div style={{ padding: "28px 36px 48px" }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#b8943f", marginBottom: 8,
            }}>Before We Begin</div>
            <div style={{
              fontFamily: SERIF, fontSize: 30, color: NAVY,
              letterSpacing: "-0.02em", marginBottom: 8,
            }}>How GURU organizes your money</div>
            <div style={{
              fontSize: 13, color: "rgba(0,0,0,0.45)", lineHeight: 1.6, maxWidth: 500,
            }}>
              Every dollar belongs to a bucket. Review the current state before we make changes.
            </div>
          </div>

          {/* Bucket cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 28 }}>
            {BUCKETS.map((b) => (
              <div key={b.name} style={{
                background: "#fff", border: "0.5px solid rgba(0,0,0,0.07)", overflow: "hidden",
              }}>
                <div style={{ height: 4, background: b.color }} />
                <div style={{ padding: "14px 14px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
                      textTransform: "uppercase", color: b.color,
                    }}>{b.name}</div>
                    <div style={{
                      fontSize: 18, fontWeight: 300, color: NAVY,
                      fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em",
                    }}>{b.amount}</div>
                  </div>
                  <div style={{
                    fontSize: 11, color: "rgba(0,0,0,0.4)", marginTop: 4,
                  }}>{b.sub}</div>
                </div>
                {(b.excess || b.gap) && (
                  <div style={{
                    padding: "8px 14px", borderTop: "0.5px solid rgba(0,0,0,0.05)",
                    background: "hsl(220,5%,97%)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>
                      {b.gap ? "Gap to target" : "Above target"}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums",
                      color: b.gap ? "#c47c2b" : "#2e7a52",
                    }}>{b.gap || b.excess}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setStep(1)}
              style={{
                background: NAVY, color: "#fff", border: "none",
                fontFamily: UI, fontSize: 12, fontWeight: 600,
                padding: "12px 28px", cursor: "pointer",
              }}
            >Continue to GURU's Recommendation →</button>
          </div>
        </div>
      )}

      {/* ── Step 1: Recommendation — 50/50 split ── */}
      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "calc(100vh - 100px)" }}>
          {/* Left: GI Dark panel — the signal */}
          <div style={{
            background: DARK, padding: "32px 28px",
            borderRight: `1px solid rgba(255,255,255,0.06)`,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
              textTransform: "uppercase", color: GREEN, marginBottom: 6,
            }}>GURU Intelligence · Signal YO-3</div>
            <div style={{
              fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.25)",
              letterSpacing: "0.06em", marginBottom: 20,
            }}>YIELD OPTIMIZATION · MODEL CFO-7.2 · CONFIDENCE 94%</div>

            <div style={{
              fontFamily: SERIF, fontSize: 24, fontStyle: "italic",
              color: "rgba(255,255,255,0.85)", lineHeight: 1.4, marginBottom: 20,
            }}>
              $321,535 in excess liquidity is earning below its potential.
            </div>

            <div style={{
              fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 28,
            }}>
              Operating Cash and Reserve Cash buckets hold $321,535 above their required targets.
              This capital can be redeployed to Capital Build (closing the home purchase gap)
              and Investments (long-term compounding) without compromising liquidity coverage.
            </div>

            {/* Signal metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Excess Liquidity", val: "$321,535", color: GREEN },
                { label: "Coverage After Move", val: "104%", color: GREEN },
                { label: "After-Tax Yield Gain", val: "+$8,241", color: GREEN },
                { label: "Risk Delta", val: "Neutral", color: "rgba(255,255,255,0.6)" },
              ].map((m) => (
                <div key={m.label} style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "0.5px solid rgba(255,255,255,0.06)",
                  padding: "10px 12px",
                }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
                    textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4,
                  }}>{m.label}</div>
                  <div style={{
                    fontFamily: MONO, fontSize: 16, color: m.color,
                  }}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Advisor layer — the action */}
          <div style={{ background: "hsl(220,5%,93%)", padding: "32px 28px" }}>
            <div style={{
              fontFamily: SERIF, fontSize: 24, color: NAVY,
              marginBottom: 8, letterSpacing: "-0.02em",
            }}>Recommended Moves</div>
            <div style={{
              fontSize: 13, color: "rgba(0,0,0,0.45)", lineHeight: 1.6, marginBottom: 24,
            }}>
              Three transfers to optimize allocation. Nothing moves until you approve.
            </div>

            {/* Move cards */}
            {[
              { num: 1, from: "Operating Cash", to: "Capital Build", amount: "$68,476", tag: "review", desc: "Excess above 2-month operating target → home purchase fund" },
              { num: 2, from: "Reserve Cash", to: "Capital Build", amount: "$144,524", tag: "review", desc: "Excess above trough reserve → close home purchase gap to $200,000" },
              { num: 3, from: "Reserve Cash", to: "Investments", amount: "$108,535", tag: "review", desc: "Remaining excess → CIO Sector Rotation Fund for long-term growth" },
            ].map((m) => (
              <div key={m.num} style={{
                background: "#fff", border: "0.5px solid rgba(0,0,0,0.07)",
                marginBottom: 10, padding: "16px 18px",
                display: "flex", gap: 14, alignItems: "flex-start",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: NAVY, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>{m.num}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>
                      {m.from} → {m.to}
                    </div>
                    <div style={{
                      fontSize: 15, fontWeight: 300, color: NAVY,
                      fontVariantNumeric: "tabular-nums",
                    }}>{m.amount}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", marginTop: 4, lineHeight: 1.5 }}>
                    {m.desc}
                  </div>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button onClick={() => setStep(0)} style={{
                background: "none", border: "1px solid rgba(0,0,0,0.12)", color: NAVY,
                fontFamily: UI, fontSize: 12, fontWeight: 500, padding: "10px 24px", cursor: "pointer",
              }}>← Back</button>
              <button onClick={() => setStep(2)} style={{
                background: NAVY, color: "#fff", border: "none",
                fontFamily: UI, fontSize: 12, fontWeight: 600, padding: "12px 28px", cursor: "pointer",
              }}>Review & Approve →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Confirm — dark takes over for execution ── */}
      {step === 2 && (
        <div style={{
          background: DARK, minHeight: "calc(100vh - 100px)",
          padding: "40px 36px", textAlign: "center",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", color: GREEN, marginBottom: 12,
          }}>Confirm Execution</div>
          <div style={{
            fontFamily: SERIF, fontSize: 28, fontStyle: "italic",
            color: "rgba(255,255,255,0.9)", marginBottom: 8,
          }}>Ready to move $321,535</div>
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 36, maxWidth: 400, margin: "0 auto 36px",
          }}>
            Three transfers across two buckets. Transfers settle in 1–3 business days.
            Nothing moves until you approve.
          </div>

          {/* Summary table */}
          <div style={{
            maxWidth: 560, margin: "0 auto 36px",
            border: "1px solid rgba(255,255,255,0.08)",
            textAlign: "left",
          }}>
            {[
              { label: "Operating Cash → Capital Build", amount: "$68,476" },
              { label: "Reserve Cash → Capital Build", amount: "$144,524" },
              { label: "Reserve Cash → Investments", amount: "$108,535" },
            ].map((r, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
              }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{r.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{r.amount}</span>
              </div>
            ))}
            <div style={{
              display: "flex", justifyContent: "space-between",
              padding: "12px 18px",
              borderTop: `2px solid ${GREEN}`,
              background: "rgba(68,224,138,0.04)",
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: GREEN, letterSpacing: "0.04em" }}>Total Movement</span>
              <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: GREEN }}>$321,535</span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button onClick={() => setStep(1)} style={{
              background: "none", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)",
              fontFamily: UI, fontSize: 12, fontWeight: 500, padding: "10px 24px", cursor: "pointer",
            }}>← Back</button>
            <button onClick={() => setStep(3)} style={{
              background: GREEN, color: DARK, border: "none",
              fontFamily: UI, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
              padding: "12px 36px", cursor: "pointer",
            }}>Approve & Execute</button>
          </div>
        </div>
      )}

      {/* ── Step 3: Executed ── */}
      {step === 3 && (
        <div style={{
          background: DARK, minHeight: "calc(100vh - 100px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: `rgba(68,224,138,0.12)`, border: `2px solid ${GREEN}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, color: GREEN, marginBottom: 20,
          }}>✓</div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", color: GREEN, marginBottom: 10,
          }}>Execution Complete</div>
          <div style={{
            fontFamily: SERIF, fontSize: 28, color: "rgba(255,255,255,0.9)",
            marginBottom: 10,
          }}>$321,535 allocated</div>
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 32,
          }}>Transfers initiated. Settlement in 1–3 business days.</div>
          <button onClick={() => { setStep(0); }} style={{
            background: "none", border: `1px solid rgba(255,255,255,0.15)`,
            color: "rgba(255,255,255,0.5)",
            fontFamily: UI, fontSize: 12, fontWeight: 500, padding: "10px 24px", cursor: "pointer",
          }}>← Return to Overview</button>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
