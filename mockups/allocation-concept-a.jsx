import { useState, useEffect } from "react";

/*
 * CONCEPT A — "Chrome Shift"
 *
 * The allocation tab replaces the normal app navigation with a focused
 * workflow stepper. The tab bar dims and collapses, a persistent step
 * rail appears on the left, and the content area becomes a single-focus
 * surface. The advisor can't wander — they move forward or back through
 * the workflow. Feels like entering a cockpit from a lobby.
 */

const SERIF = "'Playfair Display', Georgia, serif";
const UI = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";

const STEPS = [
  { num: 0, label: "Review", title: "Current Allocation" },
  { num: 1, label: "Recommend", title: "GURU's Recommendation" },
  { num: 2, label: "Confirm", title: "Review & Approve" },
  { num: 3, label: "Execute", title: "Money Movement" },
];

const BUCKETS = [
  { name: "Operating Cash", color: "#5a85b8", current: "$132,050", target: "$63,574", delta: "+$68,476", status: "over" },
  { name: "Reserve Cash", color: "#b8943f", current: "$426,586", target: "$173,527", delta: "+$253,059", status: "over" },
  { name: "Capital Build", color: "#3da870", current: "$135,000", target: "$548,000", delta: "–$413,000", status: "under" },
  { name: "Investments", color: "#5585ae", current: "$2,313,414", target: "$2,313,414", delta: "—", status: "ok" },
  { name: "Other Assets", color: "#888888", current: "$2,989,500", target: "—", delta: "—", status: "tracked" },
];

export default function ConceptA() {
  const [activeStep, setActiveStep] = useState(0);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setTimeout(() => setEntered(true), 100);
  }, []);

  return (
    <div style={{
      display: "flex", minHeight: "100vh",
      fontFamily: UI, background: "hsl(220,5%,93%)",
    }}>

      {/* ── Left Rail: Step Navigator ── */}
      <div style={{
        width: entered ? 220 : 0,
        background: "#0d1829",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", color: "#44e08a", marginBottom: 4,
          }}>Asset Allocation</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Kessler Family</div>
        </div>

        <div style={{ padding: "16px 0", flex: 1 }}>
          {STEPS.map((s, i) => {
            const isActive = i === activeStep;
            const isPast = i < activeStep;
            return (
              <div
                key={i}
                onClick={() => i <= activeStep && setActiveStep(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 18px",
                  cursor: i <= activeStep ? "pointer" : "default",
                  background: isActive ? "rgba(68,224,138,0.08)" : "transparent",
                  borderLeft: isActive ? "3px solid #44e08a" : "3px solid transparent",
                  transition: "all 0.3s ease",
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  background: isPast ? "#44e08a" : isActive ? "rgba(68,224,138,0.15)" : "rgba(255,255,255,0.06)",
                  color: isPast ? "#0d1829" : isActive ? "#44e08a" : "rgba(255,255,255,0.25)",
                  transition: "all 0.3s ease",
                }}>
                  {isPast ? "✓" : i + 1}
                </div>
                <div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    color: isActive ? "#44e08a" : "rgba(255,255,255,0.3)",
                  }}>{s.label}</div>
                  <div style={{
                    fontSize: 12, marginTop: 1,
                    color: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)",
                  }}>{s.title}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Exit button */}
        <div style={{
          padding: "16px 18px", borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{
            fontSize: 11, color: "rgba(255,255,255,0.3)", cursor: "pointer",
            transition: "color 0.2s",
          }}>
            ← Exit Allocation
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div style={{ flex: 1, overflow: "auto" }}>

        {/* Minimal top bar — no tabs, just context */}
        <div style={{
          height: 44, padding: "0 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
          background: "#fff",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              fontSize: 13, fontWeight: 500, color: "#1a2a4a",
            }}>{STEPS[activeStep].title}</div>
          </div>
          <div style={{
            fontSize: 10, color: "rgba(0,0,0,0.3)", letterSpacing: "0.06em",
          }}>
            Step {activeStep + 1} of {STEPS.length}
          </div>
        </div>

        {/* Step 0 Content: Current Allocation Review */}
        {activeStep === 0 && (
          <div style={{
            padding: "32px 36px",
            opacity: entered ? 1 : 0,
            transform: entered ? "translateY(0)" : "translateY(10px)",
            transition: "all 0.4s ease 0.3s",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#b8943f", marginBottom: 8,
            }}>Before We Begin</div>
            <div style={{
              fontFamily: SERIF, fontSize: 30, color: "#1a2a4a",
              letterSpacing: "-0.02em", marginBottom: 8,
            }}>How GURU organizes your money</div>
            <div style={{
              fontSize: 13, color: "rgba(0,0,0,0.5)", lineHeight: 1.6,
              maxWidth: 500, marginBottom: 28,
            }}>
              Review the current allocation across all five buckets before we make any changes.
            </div>

            {/* Bucket summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 32 }}>
              {BUCKETS.map((b) => (
                <div key={b.name} style={{
                  background: "#fff", border: "0.5px solid rgba(0,0,0,0.07)", overflow: "hidden",
                }}>
                  <div style={{ height: 4, background: b.color }} />
                  <div style={{ padding: "14px 14px 10px" }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
                      textTransform: "uppercase", color: b.color, marginBottom: 6,
                    }}>{b.name}</div>
                    <div style={{
                      fontSize: 20, fontWeight: 300, color: "#1a2a4a",
                      fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em",
                    }}>{b.current}</div>
                  </div>
                  {/* Current vs Target */}
                  <div style={{
                    padding: "8px 14px", borderTop: "0.5px solid rgba(0,0,0,0.05)",
                    background: "hsl(220,5%,97%)",
                    display: "flex", justifyContent: "space-between",
                  }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)" }}>Target</div>
                      <div style={{ fontSize: 12, color: "rgba(0,0,0,0.5)", fontVariantNumeric: "tabular-nums" }}>{b.target}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)" }}>Delta</div>
                      <div style={{
                        fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums",
                        color: b.status === "over" ? "#2e7a52" : b.status === "under" ? "#c47c2b" : "rgba(0,0,0,0.3)",
                      }}>{b.delta}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Continue CTA */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setActiveStep(1)}
                style={{
                  background: "#1a2a4a", color: "#fff", border: "none",
                  fontFamily: UI, fontSize: 12, fontWeight: 600,
                  letterSpacing: "0.04em", padding: "12px 28px",
                  cursor: "pointer",
                }}
              >
                Continue to GURU's Recommendation →
              </button>
            </div>
          </div>
        )}

        {/* Step 1 Placeholder */}
        {activeStep === 1 && (
          <div style={{ padding: "32px 36px" }}>
            <div style={{
              fontFamily: SERIF, fontSize: 28, color: "#1a2a4a", marginBottom: 20,
            }}>GURU's Recommendation</div>
            <div style={{
              padding: 40, background: "#0d1829", border: "1px solid rgba(255,255,255,0.06)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                GURU Intelligence recommendation card would appear here —
                dark panel with signal analysis, deployment scenarios, and yield projections.
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <button onClick={() => setActiveStep(0)} style={{
                background: "none", border: "1px solid rgba(0,0,0,0.12)", color: "#1a2a4a",
                fontFamily: UI, fontSize: 12, fontWeight: 500, padding: "10px 24px", cursor: "pointer",
              }}>← Back</button>
              <button onClick={() => setActiveStep(2)} style={{
                background: "#1a2a4a", color: "#fff", border: "none",
                fontFamily: UI, fontSize: 12, fontWeight: 600, padding: "12px 28px", cursor: "pointer",
              }}>Review & Approve →</button>
            </div>
          </div>
        )}

        {/* Step 2 Placeholder */}
        {activeStep === 2 && (
          <div style={{ padding: "32px 36px" }}>
            <div style={{
              fontFamily: SERIF, fontSize: 28, color: "#1a2a4a", marginBottom: 20,
            }}>Review & Approve</div>
            <div style={{
              padding: 40, background: "#fff", border: "0.5px solid rgba(0,0,0,0.07)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 13, color: "rgba(0,0,0,0.4)" }}>
                Confirmation summary — before/after comparison, line-by-line money movements,
                advisor approval checkboxes.
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <button onClick={() => setActiveStep(1)} style={{
                background: "none", border: "1px solid rgba(0,0,0,0.12)", color: "#1a2a4a",
                fontFamily: UI, fontSize: 12, fontWeight: 500, padding: "10px 24px", cursor: "pointer",
              }}>← Back</button>
              <button onClick={() => setActiveStep(3)} style={{
                background: "#2e7a52", color: "#fff", border: "none",
                fontFamily: UI, fontSize: 12, fontWeight: 600, padding: "12px 28px", cursor: "pointer",
              }}>Approve & Execute →</button>
            </div>
          </div>
        )}

        {/* Step 3 Placeholder */}
        {activeStep === 3 && (
          <div style={{ padding: "32px 36px", textAlign: "center" }}>
            <div style={{ marginTop: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
              <div style={{
                fontFamily: SERIF, fontSize: 28, color: "#1a2a4a", marginBottom: 10,
              }}>Allocation Executed</div>
              <div style={{ fontSize: 13, color: "rgba(0,0,0,0.45)", marginBottom: 32 }}>
                Money movement initiated. Transfers will settle within 1–3 business days.
              </div>
              <button onClick={() => { setActiveStep(0); }} style={{
                background: "none", border: "1px solid rgba(0,0,0,0.12)", color: "#1a2a4a",
                fontFamily: UI, fontSize: 12, fontWeight: 500, padding: "10px 24px", cursor: "pointer",
              }}>← Return to Overview</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
