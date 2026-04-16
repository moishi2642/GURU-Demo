import { useState, useEffect } from "react";

/*
 * CONCEPT C — "Narrative Flow"
 *
 * The allocation tab tells a story horizontally. Instead of stacking steps
 * vertically, the advisor scrolls/navigates through a horizontal narrative:
 *
 *   [Diagnosis] → [Recommendation] → [Execution]
 *
 * Each "scene" takes the full viewport width. The dark GI layer is used
 * for the diagnosis (left), transitions through a mixed zone for the
 * recommendation (center), and resolves in the advisor layer for execution
 * (right). The horizontal movement creates a sense of progression —
 * you're moving through the engine toward the action.
 *
 * No sidebar, no stepper. Just a fluid left-to-right story.
 */

const SERIF = "'Playfair Display', Georgia, serif";
const UI = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";
const GREEN = "#44e08a";
const DARK = "#0d1829";
const NAVY = "#1a2a4a";
const LIGHT = "hsl(220,5%,93%)";

const BUCKETS = [
  { name: "Operating Cash", color: "#5a85b8", amount: "$132,050", target: "$63,574", excess: "$68,476" },
  { name: "Reserve Cash", color: "#b8943f", amount: "$426,586", target: "$173,527", excess: "$253,059" },
  { name: "Capital Build", color: "#3da870", amount: "$135,000", target: "$548,000", gap: "$413,000" },
  { name: "Investments", color: "#5585ae", amount: "$2,313,414" },
  { name: "Other Assets", color: "#888888", amount: "$2,989,500" },
];

export default function ConceptC() {
  const [scene, setScene] = useState(0);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setTimeout(() => setEntered(true), 200);
  }, []);

  const sceneLabels = ["The Diagnosis", "The Recommendation", "The Execution"];

  return (
    <div style={{ minHeight: "100vh", fontFamily: UI, overflow: "hidden" }}>

      {/* Fixed top bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 48,
        background: scene === 0 ? DARK : scene === 2 ? "#fff" : "rgba(13,24,41,0.95)",
        borderBottom: scene === 2 ? "1px solid rgba(0,0,0,0.08)" : `1px solid rgba(255,255,255,0.06)`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px",
        transition: "all 0.6s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 12,
            color: scene === 2 ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.35)",
            cursor: "pointer",
            transition: "color 0.6s ease",
          }}>← Exit</span>
          <span style={{
            color: scene === 2 ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.12)",
            transition: "color 0.6s ease",
          }}>|</span>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: scene === 2 ? NAVY : "rgba(255,255,255,0.85)",
            transition: "color 0.6s ease",
          }}>Kessler Family</span>
        </div>

        {/* Scene indicators */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {sceneLabels.map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                onClick={() => setScene(i)}
                style={{
                  padding: "4px 12px", cursor: "pointer",
                  background: i === scene
                    ? (scene === 2 ? NAVY : GREEN)
                    : "transparent",
                  border: i === scene
                    ? "none"
                    : `1px solid ${scene === 2 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)"}`,
                  transition: "all 0.3s ease",
                }}
              >
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  color: i === scene
                    ? (scene === 2 ? "#fff" : DARK)
                    : (scene === 2 ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)"),
                  transition: "color 0.3s ease",
                }}>{label}</span>
              </div>
              {i < 2 && (
                <span style={{
                  fontSize: 10,
                  color: scene === 2 ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.15)",
                  transition: "color 0.6s ease",
                }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scene container with horizontal slide */}
      <div style={{
        display: "flex",
        width: "300vw",
        transform: `translateX(-${scene * 100}vw)`,
        transition: "transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
        marginTop: 48,
      }}>

        {/* ── SCENE 1: The Diagnosis (Dark) ── */}
        <div style={{
          width: "100vw", minHeight: "calc(100vh - 48px)",
          background: DARK,
          padding: "40px 48px",
          display: "flex", gap: 40,
        }}>
          {/* Left column: headline + signal */}
          <div style={{ width: 380, flexShrink: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
              textTransform: "uppercase", color: GREEN, marginBottom: 6,
              opacity: entered ? 1 : 0, transition: "opacity 0.5s ease 0.2s",
            }}>GURU Intelligence · Allocation Analysis</div>
            <div style={{
              fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.25)",
              letterSpacing: "0.06em", marginBottom: 24,
              opacity: entered ? 1 : 0, transition: "opacity 0.5s ease 0.3s",
            }}>MODEL CFO-7.2 · CONFIDENCE 94% · LIVE</div>

            <div style={{
              fontFamily: SERIF, fontSize: 28, fontStyle: "italic",
              color: "rgba(255,255,255,0.9)", lineHeight: 1.35, marginBottom: 20,
              opacity: entered ? 1 : 0, transform: entered ? "translateY(0)" : "translateY(10px)",
              transition: "all 0.6s ease 0.4s",
            }}>
              $321,535 is sitting in the wrong place.
            </div>

            <div style={{
              fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 32,
              opacity: entered ? 1 : 0, transition: "opacity 0.6s ease 0.5s",
            }}>
              Operating Cash and Reserve Cash hold $321,535 above their GURU-calculated
              targets. This capital is safe but underperforming — earning blended 3.2%
              when it could be closing the home purchase gap or compounding in the
              investment portfolio.
            </div>

            {/* Key metrics */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
              opacity: entered ? 1 : 0, transition: "opacity 0.6s ease 0.6s",
            }}>
              {[
                { label: "Excess Liquidity", val: "$321,535", color: GREEN },
                { label: "Home Purchase Gap", val: "$413,000", color: "#ffc83c" },
                { label: "Potential Yield Gain", val: "+$8,241/yr", color: GREEN },
                { label: "Coverage After", val: "104%", color: GREEN },
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
                  <div style={{ fontFamily: MONO, fontSize: 16, color: m.color }}>{m.val}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setScene(1)}
              style={{
                marginTop: 28, background: GREEN, color: DARK, border: "none",
                fontFamily: UI, fontSize: 12, fontWeight: 700,
                letterSpacing: "0.04em", padding: "12px 28px", cursor: "pointer",
              }}
            >See Recommendation →</button>
          </div>

          {/* Right column: bucket breakdown */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14,
            }}>Current vs Target</div>

            {BUCKETS.map((b, i) => (
              <div key={b.name} style={{
                display: "flex", alignItems: "center",
                padding: "10px 0",
                borderBottom: i < BUCKETS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                opacity: entered ? 1 : 0,
                transform: entered ? "translateX(0)" : "translateX(20px)",
                transition: `all 0.5s ease ${0.3 + i * 0.1}s`,
              }}>
                <div style={{ width: 4, height: 32, background: b.color, marginRight: 14, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)",
                  }}>{b.name}</div>
                  <div style={{
                    fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2,
                  }}>
                    {b.target ? `Target: ${b.target}` : "Not actively managed"}
                  </div>
                </div>
                <div style={{ textAlign: "right", marginRight: 20, width: 100 }}>
                  <div style={{
                    fontFamily: MONO, fontSize: 14, color: "rgba(255,255,255,0.8)",
                  }}>{b.amount}</div>
                </div>
                <div style={{ textAlign: "right", width: 90 }}>
                  {b.excess && (
                    <span style={{
                      fontFamily: MONO, fontSize: 12, color: GREEN,
                    }}>+{b.excess}</span>
                  )}
                  {b.gap && (
                    <span style={{
                      fontFamily: MONO, fontSize: 12, color: "#ffc83c",
                    }}>–{b.gap}</span>
                  )}
                  {!b.excess && !b.gap && (
                    <span style={{
                      fontFamily: MONO, fontSize: 12, color: "rgba(255,255,255,0.2)",
                    }}>—</span>
                  )}
                </div>
              </div>
            ))}

            {/* Proportional bar */}
            <div style={{ marginTop: 24 }}>
              <div style={{ display: "flex", height: 4, overflow: "hidden", marginBottom: 8 }}>
                {BUCKETS.map((b) => {
                  const amounts = { "Operating Cash": 132050, "Reserve Cash": 426586, "Capital Build": 135000, "Investments": 2313414, "Other Assets": 2989500 };
                  const total = Object.values(amounts).reduce((a, c) => a + c, 0);
                  return (
                    <div key={b.name} style={{ width: `${(amounts[b.name] / total) * 100}%`, background: b.color }} />
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>$5,996,550 total</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: GREEN }}>$321,535 deployable</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── SCENE 2: The Recommendation (Mixed) ── */}
        <div style={{
          width: "100vw", minHeight: "calc(100vh - 48px)",
          display: "flex",
        }}>
          {/* Dark left strip — signal context */}
          <div style={{
            width: 320, background: DARK, padding: "36px 24px",
            borderRight: `2px solid ${GREEN}`,
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: GREEN, marginBottom: 16,
            }}>GURU's Logic</div>

            {[
              { step: "1", text: "Size Operating Cash to 2-month target: $63,574. Deploy $68,476 excess." },
              { step: "2", text: "Size Reserve to trough depth: $173,527. Deploy $253,059 excess." },
              { step: "3", text: "Allocate $213,000 to Capital Build (closing gap to $348,000). Remaining $108,535 to Investments." },
            ].map((s) => (
              <div key={s.step} style={{
                display: "flex", gap: 10, marginBottom: 16,
                padding: "12px", background: "rgba(255,255,255,0.03)",
                border: "0.5px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: "rgba(68,224,138,0.12)", color: GREEN,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>{s.step}</div>
                <div style={{
                  fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.5,
                }}>{s.text}</div>
              </div>
            ))}
          </div>

          {/* Light right area — action cards */}
          <div style={{
            flex: 1, background: LIGHT, padding: "36px 40px",
          }}>
            <div style={{
              fontFamily: SERIF, fontSize: 28, color: NAVY,
              letterSpacing: "-0.02em", marginBottom: 6,
            }}>Three moves. One approval.</div>
            <div style={{
              fontSize: 13, color: "rgba(0,0,0,0.45)", marginBottom: 28,
            }}>Nothing moves until you say so.</div>

            {[
              { from: "Operating Cash", to: "Capital Build", amount: "$68,476", color: "#3da870", desc: "Excess above 2-month operating floor → home purchase fund" },
              { from: "Reserve Cash", to: "Capital Build", amount: "$144,524", color: "#3da870", desc: "Excess above trough reserve → close the home purchase gap" },
              { from: "Reserve Cash", to: "Investments", amount: "$108,535", color: "#5585ae", desc: "Remaining excess → CIO Sector Rotation for long-term compounding" },
            ].map((m, i) => (
              <div key={i} style={{
                background: "#fff", border: "0.5px solid rgba(0,0,0,0.07)",
                borderLeft: `4px solid ${m.color}`,
                marginBottom: 10, padding: "16px 18px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>
                    {m.from} → {m.to}
                  </div>
                  <div style={{
                    fontSize: 17, fontWeight: 300, color: NAVY,
                    fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em",
                  }}>{m.amount}</div>
                </div>
                <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", marginTop: 4, lineHeight: 1.5 }}>
                  {m.desc}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <button onClick={() => setScene(0)} style={{
                background: "none", border: "1px solid rgba(0,0,0,0.12)", color: NAVY,
                fontFamily: UI, fontSize: 12, fontWeight: 500, padding: "10px 24px", cursor: "pointer",
              }}>← Back to Diagnosis</button>
              <button onClick={() => setScene(2)} style={{
                background: NAVY, color: "#fff", border: "none",
                fontFamily: UI, fontSize: 12, fontWeight: 600, padding: "12px 28px", cursor: "pointer",
              }}>Approve & Execute →</button>
            </div>
          </div>
        </div>

        {/* ── SCENE 3: The Execution (Light → confirmation) ── */}
        <div style={{
          width: "100vw", minHeight: "calc(100vh - 48px)",
          background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column",
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "#f0faf4", border: "2px solid #2e7a52",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, color: "#2e7a52", marginBottom: 24,
          }}>✓</div>
          <div style={{
            fontFamily: SERIF, fontSize: 32, color: NAVY,
            marginBottom: 10, letterSpacing: "-0.02em",
          }}>$321,535 allocated</div>
          <div style={{
            fontSize: 14, color: "rgba(0,0,0,0.4)", marginBottom: 6,
          }}>Three transfers initiated. Settlement in 1–3 business days.</div>
          <div style={{
            fontSize: 12, color: "rgba(0,0,0,0.3)", marginBottom: 36,
          }}>GURU will continue monitoring and will notify you of any changes needed.</div>

          {/* After state summary */}
          <div style={{
            display: "flex", gap: 16, marginBottom: 32,
          }}>
            {[
              { label: "Liquidity Coverage", val: "104%", color: "#2e7a52" },
              { label: "Capital Build Progress", val: "63%", color: "#3da870" },
              { label: "After-Tax Yield", val: "+$8,241/yr", color: "#2e7a52" },
            ].map((m) => (
              <div key={m.label} style={{
                padding: "14px 24px", border: "0.5px solid rgba(0,0,0,0.07)",
                textAlign: "center",
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
                  textTransform: "uppercase", color: "rgba(0,0,0,0.35)", marginBottom: 6,
                }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 300, color: m.color }}>{m.val}</div>
              </div>
            ))}
          </div>

          <button onClick={() => setScene(0)} style={{
            background: "none", border: "1px solid rgba(0,0,0,0.12)", color: NAVY,
            fontFamily: UI, fontSize: 12, fontWeight: 500, padding: "10px 24px", cursor: "pointer",
          }}>← Return to Overview</button>
        </div>
      </div>
    </div>
  );
}
