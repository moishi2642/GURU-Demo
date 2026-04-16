import { useState, useEffect } from "react";

/*
 * ALLOCATION TOOL — FULL REDESIGN
 *
 * Intro: GI dark layer. Simple — system label, headline, two findings, CTA.
 * Then: Transition fully to advisor layer. No more dark panels.
 * Left rail persists for step navigation.
 *
 * Steps match the existing app logic:
 *   1. Asset Allocation Rebalancing (GURU pre-filled)
 *   2. Product Selection (ranked)
 *   3. Confirm & Execute
 */

const SERIF = "'Playfair Display', Georgia, serif";
const UI = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";
const GREEN = "#44e08a";
const GI_BG = "#0c1828";
const SURFACE = "#0f1e33";
const NAVY = "hsl(222,45%,12%)";
const PAGE_BG = "hsl(220,5%,93%)";
const CARD_BG = "#FFFFFF";
const CARD_BORDER = "rgba(0,0,0,0.07)";
const FOOTER_BG = "hsl(220,5%,97%)";
const ADV_GREEN = "#2e7a52";
const ADV_GOLD = "#9a7b3c";
const AMBER = "#c47c2b";
const BORDER_GI = "rgba(255,255,255,0.06)";

const STEPS = [
  { label: "Rebalance", title: "Asset Allocation", badge: "GURU Pre-Filled", badgeColor: "#1E4F9C", time: "~3 min" },
  { label: "Select", title: "Product Selection", badge: "Ranked for You", badgeColor: "#9a7b3c", time: "~2 min" },
  { label: "Execute", title: "Confirm & Execute", badge: "Auto-Execute Available", badgeColor: "#2e7a52", time: "~1 min" },
];

const BUCKET_COLORS = {
  ops: "#5a85b8", liq: "#b8943f", cap: "#3da870", inv: "#5585ae", alt: "#888888",
};

export default function AllocationRedesign() {
  const [view, setView] = useState("intro"); // "intro" | "fading" | "process"
  const [phase, setPhase] = useState(0);
  const [railOpen, setRailOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Rail slides in
  useEffect(() => {
    setTimeout(() => setRailOpen(true), 300);
  }, []);

  // Intro animation
  useEffect(() => {
    if (view !== "intro") return;
    const t = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 3000),
    ];
    return () => t.forEach(clearTimeout);
  }, [view]);

  const handleBegin = () => {
    setView("fading");
    setTimeout(() => { setView("process"); setStep(0); }, 600);
  };

  // ── Shared left rail ──
  const Rail = () => (
    <div style={{
      width: railOpen ? 200 : 0,
      background: SURFACE,
      borderRight: `1px solid ${BORDER_GI}`,
      transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
      overflow: "hidden", flexShrink: 0,
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ padding: "16px 14px 12px", borderBottom: `1px solid ${BORDER_GI}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: GREEN, marginBottom: 2 }}>
          GURU
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Capital Allocation</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>Kessler Family</div>
      </div>

      <div style={{ padding: "12px 0", flex: 1 }}>
        {STEPS.map((s, i) => {
          const isActive = view === "process" && i === step;
          const isPast = view === "process" && i < step;
          const available = view === "process";
          return (
            <div key={i}
              onClick={() => isPast && setStep(i)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 14px",
                cursor: isPast ? "pointer" : "default",
                background: isActive ? "rgba(68,224,138,0.06)" : "transparent",
                borderLeft: isActive ? `2px solid ${GREEN}` : "2px solid transparent",
                opacity: available ? 1 : 0.25,
                transition: "all 0.3s",
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700,
                background: isPast ? GREEN : isActive ? "rgba(68,224,138,0.12)" : "rgba(255,255,255,0.04)",
                color: isPast ? GI_BG : isActive ? GREEN : "rgba(255,255,255,0.2)",
              }}>
                {isPast ? "✓" : i + 1}
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isActive ? GREEN : "rgba(255,255,255,0.25)" }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 10, color: isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)" }}>
                  {s.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "10px 14px", borderTop: `1px solid ${BORDER_GI}` }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: "rgba(255,255,255,0.18)", letterSpacing: "0.04em", lineHeight: 1.6 }}>
          CFO-7.2 · 94%<br />APR 15 2026
        </div>
      </div>
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${BORDER_GI}` }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", cursor: "pointer" }}>← Exit</div>
      </div>
    </div>
  );

  return (
    <div style={{
      display: "flex", minHeight: "100vh", fontFamily: UI,
      background: view === "process" ? PAGE_BG : GI_BG,
      transition: "background 0.6s ease",
    }}>
      <Rail />

      <div style={{ flex: 1, overflow: "auto" }}>

        {/* ═══════════════════════════════════════════
            INTRO — GI Dark Layer
            ═══════════════════════════════════════════ */}
        {(view === "intro" || view === "fading") && (
          <div style={{
            minHeight: "100vh", display: "flex", flexDirection: "column",
            justifyContent: "center", alignItems: "center", padding: 40,
            opacity: view === "fading" ? 0 : 1,
            transition: "opacity 0.5s ease",
            position: "relative",
          }}>
            {/* Grid bg */}
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "linear-gradient(rgba(68,224,138,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(68,224,138,0.02) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
              opacity: phase >= 1 ? 1 : 0, transition: "opacity 1s ease",
            }} />

            <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 520 }}>
              {/* System label */}
              <div style={{
                opacity: phase >= 1 ? 1 : 0,
                transform: phase >= 1 ? "translateY(0)" : "translateY(12px)",
                transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                marginBottom: 28,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: GREEN, marginBottom: 12 }}>
                  GURU Capital Allocation
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em" }}>
                  KESSLER FAMILY · MODEL CFO-7.2 · CONFIDENCE 94%
                </div>
              </div>

              {/* Headline */}
              <div style={{
                opacity: phase >= 2 ? 1 : 0,
                transform: phase >= 2 ? "translateY(0)" : "translateY(12px)",
                transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                marginBottom: 40,
              }}>
                <div style={{
                  fontFamily: SERIF, fontSize: 32, fontStyle: "italic",
                  color: "rgba(255,255,255,0.9)", lineHeight: 1.35, letterSpacing: "-0.02em",
                }}>
                  Idle capital, ready to work.
                </div>
              </div>

              {/* Two key findings */}
              <div style={{
                opacity: phase >= 3 ? 1 : 0,
                transform: phase >= 3 ? "translateY(0)" : "translateY(12px)",
                transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                display: "flex", justifyContent: "center", gap: 32, marginBottom: 44,
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                    Excess Liquidity
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 400, color: GREEN, letterSpacing: "-0.02em" }}>
                    $321,535
                  </div>
                </div>
                <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                    After-Tax Income Pickup
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 400, color: GREEN, letterSpacing: "-0.02em" }}>
                    +$8,241<span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}> /yr</span>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div style={{
                opacity: phase >= 4 ? 1 : 0,
                transform: phase >= 4 ? "translateY(0)" : "translateY(12px)",
                transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
              }}>
                <button onClick={handleBegin} style={{
                  background: "transparent", border: `1px solid ${GREEN}`, color: GREEN,
                  fontFamily: UI, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em",
                  textTransform: "uppercase", padding: "13px 36px", cursor: "pointer",
                  transition: "all 0.2s",
                }}
                  onMouseEnter={(e) => { e.target.style.background = GREEN; e.target.style.color = GI_BG; }}
                  onMouseLeave={(e) => { e.target.style.background = "transparent"; e.target.style.color = GREEN; }}
                >
                  View GURU's Recommendations →
                </button>
              </div>
            </div>
          </div>
        )}


        {/* ═══════════════════════════════════════════
            PROCESS — Advisor Layer (all steps)
            ═══════════════════════════════════════════ */}
        {view === "process" && (
          <div style={{ animation: "fadeIn 0.5s ease" }}>

            {/* Top bar */}
            <div style={{
              height: 44, padding: "0 32px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: `1px solid ${CARD_BORDER}`, background: CARD_BG,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>{STEPS[step].title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  color: STEPS[step].badgeColor, padding: "3px 8px",
                  background: `${STEPS[step].badgeColor}12`, border: `0.5px solid ${STEPS[step].badgeColor}30`,
                }}>
                  {STEPS[step].badge}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)" }}>
                  Step {step + 1} of 3 · {STEPS[step].time}
                </span>
              </div>
            </div>

            {/* ── STEP 1: Asset Allocation Rebalancing ── */}
            {step === 0 && (
              <div style={{ padding: "28px 36px" }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{
                    fontFamily: SERIF, fontSize: 26, color: NAVY,
                    letterSpacing: "-0.02em", marginBottom: 8,
                  }}>
                    GURU's recommended rebalancing
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(0,0,0,0.45)", lineHeight: 1.6, maxWidth: 560 }}>
                    GURU sized each bucket from the cash flow forecast and liquidity model.
                    Review the proposed transfers — adjust anything before moving forward.
                  </div>
                </div>

                {/* Summary strip */}
                <div style={{
                  background: CARD_BG, border: `0.5px solid ${CARD_BORDER}`,
                  display: "flex", marginBottom: 20,
                }}>
                  {[
                    { label: "Excess Liquidity", value: "$321,535", color: ADV_GREEN },
                    { label: "After-Tax Income Pickup", value: "+$8,241 / year", color: ADV_GREEN },
                    { label: "Coverage After Moves", value: "104%", color: NAVY },
                    { label: "Home Purchase Gap Remaining", value: "$200,000", color: AMBER },
                  ].map((m, i) => (
                    <div key={i} style={{
                      flex: 1, padding: "14px 18px",
                      borderRight: i < 3 ? `0.5px solid ${CARD_BORDER}` : "none",
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(0,0,0,0.35)", marginBottom: 6 }}>
                        {m.label}
                      </div>
                      <div style={{
                        fontSize: 18, fontWeight: 300, color: m.color,
                        fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em",
                      }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Transfer table */}
                <div style={{ background: CARD_BG, border: `0.5px solid ${CARD_BORDER}`, marginBottom: 20 }}>
                  {/* Header */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 140px 140px 120px",
                    padding: "10px 18px",
                    borderBottom: `1px solid ${CARD_BORDER}`,
                    background: FOOTER_BG,
                  }}>
                    {["Account / Bucket", "Current Balance", "Target Balance", "Transfer"].map((h, i) => (
                      <div key={h} style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                        textTransform: "uppercase", color: "rgba(0,0,0,0.35)",
                        textAlign: i > 0 ? "right" : "left",
                      }}>{h}</div>
                    ))}
                  </div>

                  {/* Transfers Out */}
                  <div style={{ padding: "8px 18px 4px", borderBottom: `0.5px solid ${CARD_BORDER}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)", marginBottom: 6 }}>
                      Transfers Out
                    </div>
                    {[
                      { name: "Operating Cash", sub: "Citizens Private Checking, SoFi", current: "$132,050", target: "$63,574", delta: "–$68,476", color: BUCKET_COLORS.ops },
                      { name: "Liquidity Reserve", sub: "Citizens Money Market, High Yield Savings, JPMorgan", current: "$426,586", target: "$173,527", delta: "–$253,059", color: BUCKET_COLORS.liq },
                    ].map((r, i) => (
                      <div key={i} style={{
                        display: "grid", gridTemplateColumns: "1fr 140px 140px 120px",
                        padding: "10px 0", alignItems: "center",
                        borderBottom: `0.5px solid rgba(0,0,0,0.04)`,
                      }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 3, height: 20, background: r.color, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>{r.name}</div>
                              <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>{r.sub}</div>
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", fontSize: 13, fontWeight: 300, color: NAVY, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{r.current}</div>
                        <div style={{ textAlign: "right", fontSize: 13, fontWeight: 300, color: NAVY, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{r.target}</div>
                        <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "#c0392b", fontVariantNumeric: "tabular-nums" }}>{r.delta}</div>
                      </div>
                    ))}
                  </div>

                  {/* Transfers In */}
                  <div style={{ padding: "8px 18px 4px", borderBottom: `0.5px solid ${CARD_BORDER}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)", marginBottom: 6 }}>
                      Transfers In
                    </div>
                    {[
                      { name: "Capital Build", sub: "Home purchase — June 2027", current: "$135,000", target: "$348,000", delta: "+$213,000", color: BUCKET_COLORS.cap },
                      { name: "Investments", sub: "CIO Sector Rotation Fund", current: "$2,313,414", target: "$2,421,949", delta: "+$108,535", color: BUCKET_COLORS.inv },
                    ].map((r, i) => (
                      <div key={i} style={{
                        display: "grid", gridTemplateColumns: "1fr 140px 140px 120px",
                        padding: "10px 0", alignItems: "center",
                        borderBottom: `0.5px solid rgba(0,0,0,0.04)`,
                      }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 3, height: 20, background: r.color, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>{r.name}</div>
                              <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>{r.sub}</div>
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", fontSize: 13, fontWeight: 300, color: NAVY, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{r.current}</div>
                        <div style={{ textAlign: "right", fontSize: 13, fontWeight: 300, color: NAVY, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{r.target}</div>
                        <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: ADV_GREEN, fontVariantNumeric: "tabular-nums" }}>{r.delta}</div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 140px 140px 120px",
                    padding: "12px 18px", background: FOOTER_BG,
                    borderTop: `1px solid ${CARD_BORDER}`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>Net Reallocation</div>
                    <div />
                    <div />
                    <div style={{ textAlign: "right", fontSize: 14, fontWeight: 600, color: ADV_GREEN, fontVariantNumeric: "tabular-nums" }}>$321,535</div>
                  </div>
                </div>

                {/* Footer note + CTA */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: "rgba(0,0,0,0.35)", lineHeight: 1.5 }}>
                    Nothing moves until Step 3. Every step is reversible.
                  </div>
                  <button onClick={() => setStep(1)} style={{
                    background: NAVY, color: "#fff", border: "none",
                    fontFamily: UI, fontSize: 12, fontWeight: 600, padding: "12px 28px", cursor: "pointer",
                  }}>
                    Continue to Product Selection →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Product Selection ── */}
            {step === 1 && (
              <div style={{ padding: "28px 36px" }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{
                    fontFamily: SERIF, fontSize: 26, color: NAVY,
                    letterSpacing: "-0.02em", marginBottom: 8,
                  }}>
                    Where should the capital go?
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(0,0,0,0.45)", lineHeight: 1.6, maxWidth: 560 }}>
                    GURU ranked products by after-tax yield, liquidity, and risk profile.
                    Select the deployment vehicles for each transfer.
                  </div>
                </div>

                {/* Transfer 1: $213,000 → Capital Build */}
                <div style={{ background: CARD_BG, border: `0.5px solid ${CARD_BORDER}`, marginBottom: 14 }}>
                  <div style={{ height: 4, background: BUCKET_COLORS.cap }} />
                  <div style={{ padding: "14px 18px 12px", borderBottom: `0.5px solid ${CARD_BORDER}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: BUCKET_COLORS.cap, marginBottom: 4 }}>
                          Capital Build — Home Purchase
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: NAVY }}>$213,000 to deploy</div>
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>Goal: $548,000 by June 2027</div>
                    </div>
                  </div>
                  {/* Product options */}
                  {[
                    { name: "3-Month Treasury Bill Ladder", yield: "4.82%", atYield: "3.04%", risk: "Very Low", liquidity: "T+1", rec: true },
                    { name: "6-Month Treasury Bill", yield: "4.71%", atYield: "2.97%", risk: "Very Low", liquidity: "T+1", rec: false },
                    { name: "Fidelity Government Money Market Fund", yield: "4.45%", atYield: "2.80%", risk: "Very Low", liquidity: "T+0", rec: false },
                  ].map((p, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "12px 18px",
                      borderBottom: `0.5px solid rgba(0,0,0,0.04)`,
                      background: p.rec ? "rgba(46,122,82,0.03)" : "transparent",
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        border: p.rec ? `2px solid ${ADV_GREEN}` : "1.5px solid rgba(0,0,0,0.15)",
                        background: p.rec ? ADV_GREEN : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, cursor: "pointer",
                      }}>
                        {p.rec && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>{p.name}</span>
                          {p.rec && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: ADV_GREEN }}>Recommended</span>}
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 2 }}>
                          Risk: {p.risk} · Liquidity: {p.liquidity}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 300, color: NAVY, fontVariantNumeric: "tabular-nums" }}>{p.yield}</div>
                        <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>{p.atYield} after-tax</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Transfer 2: $108,535 → Investments */}
                <div style={{ background: CARD_BG, border: `0.5px solid ${CARD_BORDER}`, marginBottom: 20 }}>
                  <div style={{ height: 4, background: BUCKET_COLORS.inv }} />
                  <div style={{ padding: "14px 18px 12px", borderBottom: `0.5px solid ${CARD_BORDER}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: BUCKET_COLORS.inv, marginBottom: 4 }}>
                          Investments — Long-Term Growth
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: NAVY }}>$108,535 to deploy</div>
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>Horizon: 5+ years</div>
                    </div>
                  </div>
                  {[
                    { name: "CIO Sector Rotation Fund", yield: "7.2% 5yr avg", atYield: "Equity", risk: "Moderate", liquidity: "T+2", rec: true },
                    { name: "Vanguard Total Stock Market Index", yield: "6.8% 5yr avg", atYield: "Equity", risk: "Moderate", liquidity: "T+2", rec: false },
                  ].map((p, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "12px 18px",
                      borderBottom: `0.5px solid rgba(0,0,0,0.04)`,
                      background: p.rec ? "rgba(46,122,82,0.03)" : "transparent",
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        border: p.rec ? `2px solid ${ADV_GREEN}` : "1.5px solid rgba(0,0,0,0.15)",
                        background: p.rec ? ADV_GREEN : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, cursor: "pointer",
                      }}>
                        {p.rec && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>{p.name}</span>
                          {p.rec && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: ADV_GREEN }}>Recommended</span>}
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 2 }}>
                          Risk: {p.risk} · Liquidity: {p.liquidity}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 300, color: NAVY, fontVariantNumeric: "tabular-nums" }}>{p.yield}</div>
                        <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>{p.atYield}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={() => setStep(0)} style={{
                    background: "none", border: `1px solid rgba(0,0,0,0.10)`, color: NAVY,
                    fontFamily: UI, fontSize: 12, fontWeight: 500, padding: "10px 24px", cursor: "pointer",
                  }}>← Back</button>
                  <button onClick={() => setStep(2)} style={{
                    background: NAVY, color: "#fff", border: "none",
                    fontFamily: UI, fontSize: 12, fontWeight: 600, padding: "12px 28px", cursor: "pointer",
                  }}>Confirm & Execute →</button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Confirm & Execute ── */}
            {step === 2 && (
              <div style={{ padding: "28px 36px" }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{
                    fontFamily: SERIF, fontSize: 26, color: NAVY,
                    letterSpacing: "-0.02em", marginBottom: 8,
                  }}>
                    Confirm and execute
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(0,0,0,0.45)", lineHeight: 1.6, maxWidth: 560 }}>
                    Review the final allocation. Once approved, GURU initiates all transfers.
                    Settlements complete in 1–3 business days.
                  </div>
                </div>

                {/* Final summary */}
                <div style={{ background: CARD_BG, border: `0.5px solid ${CARD_BORDER}`, marginBottom: 20 }}>
                  <div style={{ padding: "14px 18px 10px", borderBottom: `0.5px solid ${CARD_BORDER}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(0,0,0,0.35)" }}>
                      Execution Summary
                    </div>
                  </div>

                  {[
                    { label: "Operating Cash → Capital Build (3-Month Treasury Bill Ladder)", amount: "$68,476", type: "out" },
                    { label: "Liquidity Reserve → Capital Build (3-Month Treasury Bill Ladder)", amount: "$144,524", type: "out" },
                    { label: "Liquidity Reserve → Investments (CIO Sector Rotation Fund)", amount: "$108,535", type: "out" },
                  ].map((r, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 18px",
                      borderBottom: `0.5px solid rgba(0,0,0,0.04)`,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 400, color: NAVY }}>{r.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 300, color: NAVY, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{r.amount}</div>
                    </div>
                  ))}

                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "14px 18px", background: FOOTER_BG,
                    borderTop: `1px solid ${CARD_BORDER}`,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Total Reallocation</div>
                    <div style={{ fontSize: 18, fontWeight: 300, color: ADV_GREEN, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em" }}>$321,535</div>
                  </div>
                </div>

                {/* Post-execution impact */}
                <div style={{
                  background: CARD_BG, border: `0.5px solid ${CARD_BORDER}`, marginBottom: 24,
                  display: "flex",
                }}>
                  {[
                    { label: "Liquidity Coverage", before: "186%", after: "104%", note: "Above minimum" },
                    { label: "Capital Build Progress", before: "25%", after: "63%", note: "$200,000 remaining" },
                    { label: "After-Tax Income", before: "$0", after: "+$8,241 / year", note: "From redeployed capital" },
                  ].map((m, i) => (
                    <div key={i} style={{
                      flex: 1, padding: "14px 18px",
                      borderRight: i < 2 ? `0.5px solid ${CARD_BORDER}` : "none",
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(0,0,0,0.35)", marginBottom: 8 }}>
                        {m.label}
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "rgba(0,0,0,0.3)", fontVariantNumeric: "tabular-nums", textDecoration: "line-through" }}>{m.before}</span>
                        <span style={{ fontSize: 10, color: "rgba(0,0,0,0.2)" }}>→</span>
                        <span style={{ fontSize: 18, fontWeight: 300, color: ADV_GREEN, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em" }}>{m.after}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>{m.note}</div>
                    </div>
                  ))}
                </div>

                {/* Approval */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={() => setStep(1)} style={{
                    background: "none", border: `1px solid rgba(0,0,0,0.10)`, color: NAVY,
                    fontFamily: UI, fontSize: 12, fontWeight: 500, padding: "10px 24px", cursor: "pointer",
                  }}>← Back</button>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 12, color: "rgba(0,0,0,0.35)" }}>
                      Nothing moves until you approve.
                    </span>
                    <button style={{
                      background: ADV_GREEN, color: "#fff", border: "none",
                      fontFamily: UI, fontSize: 12, fontWeight: 700, padding: "13px 32px", cursor: "pointer",
                    }}>
                      Approve & Execute
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
