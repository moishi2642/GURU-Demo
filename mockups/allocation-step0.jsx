import { useState } from "react";

const SERIF = "'Playfair Display', Georgia, serif";
const UI = "'Inter', system-ui, sans-serif";

const BUCKETS = [
  {
    key: "reserve",
    name: "Operating Cash",
    color: "#5a85b8",
    accent: "#1E4F9C",
    desc: "Daily liquidity & upcoming expenditures",
    total: "$132,050",
    totalSub: "5.7 mo covered",
    approach: "Covers 2–3 months of core expenses. Instantly accessible. No rate optimization — pure safety net.",
    accounts: [
      { name: "Citizens Private Checking", sub: "– 2847", bal: "$82,050" },
      { name: "SoFi High-Yield Checking", sub: "– 3391", bal: "$50,000" },
    ],
  },
  {
    key: "yield",
    name: "Reserve Cash",
    color: "#b8943f",
    accent: "#835800",
    desc: "Active cash management with full liquidity",
    total: "$426,586",
    totalSub: "12-month reserve target",
    approach: "Targets 12 months of anticipated outflows. Deployed in high-yield products — money market, T-bills — that can be liquidated same-day.",
    accounts: [
      { name: "Citizens Bank Money Market", sub: "– 7204", bal: "$225,000", tag: "excess" },
      { name: "Citizens High Yield Savings", sub: "– 1482", bal: "$100,440", tag: "excess" },
      { name: "JPMorgan 100% Treasury Money Market Fund", sub: "– 4976", bal: "$101,146" },
    ],
  },
  {
    key: "tactical",
    name: "Capital Build",
    color: "#3da870",
    accent: "#195830",
    desc: "Disciplined saving for near-term goals",
    total: "$135,000",
    totalSub: "Goal-directed · 1–3 yr horizon",
    approach: "Holds capital earmarked for goals 1–3 years out: property, business, major expenditure. Deployed in short-duration ladders to protect principal while earning yield.",
    accounts: [
      { name: "Fidelity Cash Sweep", sub: "– 8821 · idle", bal: "$174,000", tag: "excess" },
      { name: "3-Mo T-Bill Ladder", sub: "– 1142 · matures Mar 31", bal: "$135,000" },
    ],
  },
  {
    key: "growth",
    name: "Investments",
    color: "#5585ae",
    accent: "#4A3FA0",
    desc: "Long-term compounded growth",
    total: "$2,313,414",
    totalSub: "5+ year horizon",
    approach: "Capital with a 5+ year horizon managed through CIO-led strategies. Not touched for liquidity needs — this bucket compounds.",
    accounts: [
      { name: "CIO Sector Rotation Fund", sub: "Fidelity · Growth equity", bal: "$1,250,000" },
      { name: "Small Cap Sleeve", sub: "Fidelity · High growth", bal: "$875,000" },
      { name: "Cresset Short Duration", sub: "Fixed income anchor", bal: "$384,500" },
    ],
  },
  {
    key: "alternatives",
    name: "Other Assets",
    color: "#888888",
    accent: "#5C5C6E",
    desc: "Real estate, private equity & alternatives",
    total: "$2,989,500",
    totalSub: "Tracked · not actively managed",
    approach: "Illiquid or hard-to-rebalance holdings. Tracked for net worth context but excluded from liquidity planning.",
    accounts: [
      { name: "Primary Residence", sub: "Westchester, NY", bal: "$1,800,000" },
      { name: "Investment Property", sub: "Palm Beach, FL", bal: "$750,000" },
      { name: "Unvested RSUs", sub: "Vesting 2025–2027", bal: "$395,100" },
    ],
  },
];

export default function AllocationStep0() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "hsl(220,5%,93%)",
      fontFamily: UI,
    }}>
      {/* Topbar */}
      <div style={{
        height: 44, padding: "0 28px",
        display: "flex", alignItems: "center",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        background: "#fff",
      }}>
        <span style={{ fontSize: 12, color: "rgba(0,0,0,0.4)", cursor: "pointer" }}>‹ Back</span>
        <span style={{ margin: "0 10px", color: "rgba(0,0,0,0.2)" }}>|</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#1a2a4a" }}>Kessler Family</span>
        <span style={{ margin: "0 8px", color: "rgba(0,0,0,0.2)" }}>·</span>
        <span style={{ fontSize: 12, color: "rgba(0,0,0,0.4)" }}>Asset Allocation</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#3da870" }} />
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
            textTransform: "uppercase", color: "rgba(0,0,0,0.3)",
          }}>Step 1 of 3</span>
        </div>
      </div>

      {/* Page content */}
      <div style={{ padding: "32px 36px 48px", maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "#b8943f",
            marginBottom: 8,
          }}>
            Before We Begin
          </div>
          <div style={{
            fontFamily: SERIF, fontSize: 32, fontWeight: 400,
            color: "#1a2a4a", letterSpacing: "-0.02em",
            marginBottom: 10,
          }}>
            How GURU organizes your money
          </div>
          <div style={{
            fontSize: 14, color: "rgba(0,0,0,0.5)", lineHeight: 1.65,
            maxWidth: 520,
          }}>
            Every dollar belongs to a bucket. Each bucket has a job — a yield target, a liquidity profile,
            and a horizon. Review what's in each one before we make any changes.
          </div>
        </div>

        {/* Bucket Cards Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 14,
          alignItems: "start",
        }}>
          {BUCKETS.map((b) => (
            <div key={b.key} style={{
              background: "#fff",
              border: "0.5px solid rgba(0,0,0,0.07)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}>
              {/* Color stripe */}
              <div style={{ height: 4, background: b.color }} />

              {/* Header + amount */}
              <div style={{ padding: "14px 16px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
                    textTransform: "uppercase", color: b.color,
                  }}>
                    {b.name}
                  </div>
                  <div style={{
                    fontSize: 18, fontWeight: 300, color: "#1a2a4a",
                    letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}>
                    {b.total}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", lineHeight: 1.4 }}>
                    {b.desc}
                  </div>
                  <div style={{
                    fontSize: 10, color: "rgba(0,0,0,0.3)", whiteSpace: "nowrap", marginLeft: 8,
                  }}>
                    {b.totalSub}
                  </div>
                </div>
              </div>

              {/* GURU's Approach */}
              <div style={{
                padding: "10px 16px",
                borderTop: "0.5px solid rgba(0,0,0,0.06)",
                background: "hsl(220,5%,97%)",
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
                  textTransform: "uppercase", color: b.color,
                  marginBottom: 6,
                }}>
                  GURU's Approach
                </div>
                <div style={{
                  fontSize: 12, color: "rgba(0,0,0,0.55)", lineHeight: 1.55,
                }}>
                  {b.approach}
                </div>
              </div>

              {/* Accounts */}
              <div style={{
                borderTop: "0.5px solid rgba(0,0,0,0.06)",
                padding: "0 16px",
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
                  textTransform: "uppercase", color: "rgba(0,0,0,0.3)",
                  padding: "10px 0 6px",
                }}>
                  Accounts in This Bucket
                </div>
                {b.accounts.map((a, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    padding: "7px 0",
                    borderTop: i > 0 ? "0.5px solid rgba(0,0,0,0.04)" : "none",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#1a2a4a" }}>
                        {a.name}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>
                        {a.sub}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 300, color: "#1a2a4a",
                        fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em",
                      }}>
                        {a.bal}
                      </div>
                      {a.tag === "excess" && (
                        <div style={{
                          fontSize: 8, fontWeight: 700, letterSpacing: "0.08em",
                          textTransform: "uppercase", color: "#c47c2b",
                          marginTop: 2,
                        }}>
                          Excess
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ height: 10 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
