import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useClients, useCreateClient } from "@/hooks/use-clients";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronRight, Lock, Plus } from "lucide-react";

/* ─── Tokens ────────────────────────────────────────────────────────────────── */
const navy   = "hsl(222,45%,12%)";
const gold   = "#9a7b3c";
const green  = "#2e7a52";
const linen  = "#f0ede8";
const panel  = "#faf9f7";
const border = "rgba(0,0,0,0.08)";
const muted  = "rgba(0,0,0,0.40)";
const faint  = "rgba(0,0,0,0.22)";
const INTER  = "Inter, system-ui, sans-serif";

/* ─── Number formatter ──────────────────────────────────────────────────────── */
function fmt$(n: number | null): string {
  if (!n) return "—";
  return "$" + n.toLocaleString("en-US");
}
function pct(aum: number, total: number): string {
  if (!total) return "—";
  return Math.round((aum / total) * 100) + "%";
}

/* ─── Avatar palette ────────────────────────────────────────────────────────── */
const PALETTES = [
  { bg: "hsl(222,45%,88%)", fg: navy },
  { bg: "hsl(36,55%,88%)",  fg: "#5a3d10" },
  { bg: "hsl(160,40%,87%)", fg: "#174030" },
  { bg: "hsl(196,50%,88%)", fg: "#113045" },
];
function pal(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + h * 31;
  return PALETTES[Math.abs(h) % PALETTES.length];
}

/* ─── Risk ──────────────────────────────────────────────────────────────────── */
const RISK_DOT: Record<string, string> = { conservative: green, moderate: gold, aggressive: "#c0392b" };
const RISK_LBL: Record<string, string> = { conservative: "Conservative", moderate: "Moderate", aggressive: "Aggressive" };

/* ─── Static family data ────────────────────────────────────────────────────── */
const ACTIVE_FAMILIES = [
  {
    id: "kessler", href: "/client/1",
    name: "Sarah & Michael Kessler", initials: "SK", age: 44,
    risk: "moderate", aum: 814877, totalAssets: 5912862,
    onboarding: true, lastActivity: "Today, 2:34 PM",
    excessLiquidity: 299966, rateExposure: true, upcomingCash: 5511,
  },
  {
    id: "mari", href: "/client/2",
    name: "Mari Oishi", initials: "MO", age: 29,
    risk: "moderate", aum: 0, totalAssets: 0,
    onboarding: false, lastActivity: "3 days ago",
    excessLiquidity: null, rateExposure: false, upcomingCash: null,
  },
];

const LOCKED_FAMILIES = [
  { name: "James & Patricia Harrington", initials: "JH", risk: "conservative", age: 67, aum: 8400000,  totalAssets: 11200000, lastActivity: "2 weeks ago" },
  { name: "Olivia Chen",                 initials: "OC", risk: "aggressive",   age: 38, aum: 3100000,  totalAssets: 4800000,  lastActivity: "5 days ago"  },
  { name: "Robert & Susan Delacroix",    initials: "RD", risk: "moderate",     age: 55, aum: 12700000, totalAssets: 18500000, lastActivity: "3 days ago"  },
  { name: "Marcus Thornton",             initials: "MT", risk: "aggressive",   age: 42, aum: 5900000,  totalAssets: 8100000,  lastActivity: "1 week ago"  },
];

/* ─── Column template ───────────────────────────────────────────────────────── */
//  Family  |  Risk  |  Total Assets  |  AUM  |  Excess Liq  |  Rate  |  Upcoming  |  Activity  |  >
const COLS = "1fr 120px 150px 130px 140px 90px 130px 110px 20px";

const cellStyle: React.CSSProperties = {
  fontFamily: INTER, fontSize: 13, color: navy, fontVariantNumeric: "tabular-nums",
};
const dimStyle: React.CSSProperties = { ...cellStyle, color: muted };
const hdrStyle: React.CSSProperties = {
  fontFamily: INTER, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
  textTransform: "uppercase", color: faint,
};

/* ─── Add-family modal ──────────────────────────────────────────────────────── */
function AddFamilyModal() {
  const [open, setOpen] = useState(false);
  const mutation = useCreateClient();
  const [, navigate] = useLocation();
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const first = (fd.get("firstName") as string).trim();
    const last  = (fd.get("lastName")  as string).trim();
    mutation.mutate(
      { name: last ? `${first} ${last}` : first, email: "", age: 0, riskTolerance: "moderate" },
      { onSuccess: () => { setOpen(false); navigate("/new-client"); } },
    );
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          data-testid="button-add-client"
          style={{
            background: navy, color: "#fff", border: "none",
            padding: "10px 20px", fontSize: 12, fontWeight: 600,
            letterSpacing: "0.05em", borderRadius: 4, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 7,
            fontFamily: INTER,
          }}
        >
          <Plus style={{ width: 13, height: 13 }} /> Add Family
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader><DialogTitle className="text-[13px]">New Family</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10.5px] uppercase tracking-wide text-muted-foreground" htmlFor="firstName">First</Label>
              <Input id="firstName" name="firstName" required autoFocus placeholder="Jane" data-testid="input-client-first-name" className="h-7 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10.5px] uppercase tracking-wide text-muted-foreground" htmlFor="lastName">Last</Label>
              <Input id="lastName" name="lastName" required placeholder="Morrison" data-testid="input-client-last-name" className="h-7 text-sm" />
            </div>
          </div>
          <Button type="submit" className="w-full h-7 text-[11.5px]" disabled={mutation.isPending} data-testid="button-submit-client">
            {mutation.isPending ? "Creating…" : "Create & start profile →"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Table header row ──────────────────────────────────────────────────────── */
function THead() {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: COLS, gap: 0,
      padding: "0 28px", height: 38,
      borderBottom: `1px solid ${border}`,
      alignItems: "center",
      background: panel,
    }}>
      <div style={hdrStyle}>Family</div>
      <div style={hdrStyle}>Risk</div>
      <div style={{ ...hdrStyle, textAlign: "right" }}>Total Assets</div>
      <div style={{ ...hdrStyle, textAlign: "right" }}>AUM</div>
      <div style={{ ...hdrStyle, textAlign: "right" }}>Excess Liquidity</div>
      <div style={{ ...hdrStyle, textAlign: "center" }}>Rate</div>
      <div style={{ ...hdrStyle, textAlign: "right" }}>Upcoming Cash</div>
      <div style={{ ...hdrStyle, textAlign: "right" }}>Last Active</div>
      <div />
    </div>
  );
}

/* ─── Active family row ─────────────────────────────────────────────────────── */
function FamilyRow(f: typeof ACTIVE_FAMILIES[0] & { resolvedHref: string }) {
  const p = pal(f.name);
  // Clients with onboarding:false are still being onboarded → send to onboarding flow
  const href = !f.onboarding ? "/new-client" : f.resolvedHref;
  return (
    <Link href={href} className="block" data-testid={`link-client-${f.resolvedHref.split("/").pop()}`}>
      <div
        style={{
          display: "grid", gridTemplateColumns: COLS, gap: 0,
          padding: "14px 28px", alignItems: "center",
          borderBottom: `1px solid ${border}`,
          cursor: "pointer", transition: "background 0.10s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "#fdfaf6")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        {/* Name */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6, flexShrink: 0,
            background: p.bg, color: p.fg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, fontFamily: INTER,
          }}>
            {f.initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: navy, fontFamily: INTER, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
              {f.name}
            </div>
            {!f.onboarding && (
              <div style={{ fontSize: 10, fontWeight: 600, color: gold, letterSpacing: "0.04em", marginTop: 1, fontFamily: INTER }}>
                Onboarding in progress
              </div>
            )}
            {f.onboarding && f.age > 0 && (
              <div style={{ fontSize: 11, color: muted, marginTop: 1, fontFamily: INTER }}>Age {f.age}</div>
            )}
          </div>
        </div>

        {/* Risk */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: RISK_DOT[f.risk] ?? muted, flexShrink: 0 }} />
          <span style={{ ...cellStyle, fontSize: 12 }}>{RISK_LBL[f.risk] ?? f.risk}</span>
        </div>

        {/* Total Assets */}
        <div style={{ textAlign: "right" as const, ...cellStyle }}>{fmt$(f.totalAssets)}</div>

        {/* AUM */}
        <div style={{ textAlign: "right" as const, ...cellStyle }}>{fmt$(f.aum)}</div>

        {/* Excess Liquidity — gold if flagged */}
        <div style={{ textAlign: "right" as const }}>
          {f.excessLiquidity
            ? <span style={{ ...cellStyle, color: gold, fontWeight: 500 }}>{fmt$(f.excessLiquidity)}</span>
            : <span style={dimStyle}>—</span>}
        </div>

        {/* Rate exposure — simple dot indicator */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          {f.rateExposure
            ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2563eb", display: "inline-block" }} title="Rate exposed" />
            : <span style={dimStyle}>—</span>}
        </div>

        {/* Upcoming Cash */}
        <div style={{ textAlign: "right" as const }}>
          {f.upcomingCash
            ? <span style={{ ...cellStyle, color: green, fontWeight: 500 }}>{fmt$(f.upcomingCash)}</span>
            : <span style={dimStyle}>—</span>}
        </div>

        {/* Last Activity */}
        <div style={{ textAlign: "right" as const, ...dimStyle, fontSize: 12 }}>{f.lastActivity}</div>

        {/* Arrow */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <ChevronRight style={{ width: 14, height: 14, color: faint }} />
        </div>
      </div>
    </Link>
  );
}

/* ─── Locked row ────────────────────────────────────────────────────────────── */
function LockedRow(f: typeof LOCKED_FAMILIES[0]) {
  const p = pal(f.name);
  return (
    <div style={{
      display: "grid", gridTemplateColumns: COLS, gap: 0,
      padding: "13px 28px", alignItems: "center",
      borderBottom: `1px solid ${border}`,
      opacity: 0.35,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6, flexShrink: 0,
          background: p.bg, color: p.fg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, fontFamily: INTER,
        }}>
          {f.initials}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: navy, fontFamily: INTER }}>{f.name}</span>
            <Lock style={{ width: 10, height: 10, color: muted }} />
          </div>
          {f.age > 0 && <div style={{ fontSize: 11, color: muted, marginTop: 1, fontFamily: INTER }}>Age {f.age}</div>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: RISK_DOT[f.risk] ?? muted }} />
        <span style={{ ...cellStyle, fontSize: 12 }}>{RISK_LBL[f.risk] ?? f.risk}</span>
      </div>
      <div style={{ textAlign: "right" as const, ...cellStyle }}>{fmt$(f.totalAssets)}</div>
      <div style={{ textAlign: "right" as const, ...cellStyle }}>{fmt$(f.aum)}</div>
      <div style={{ textAlign: "right" as const, ...dimStyle }}>—</div>
      <div style={{ textAlign: "center" as const, ...dimStyle }}>—</div>
      <div style={{ textAlign: "right" as const, ...dimStyle }}>—</div>
      <div style={{ textAlign: "right" as const, ...dimStyle, fontSize: 12 }}>{f.lastActivity}</div>
      <div />
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────────── */
export default function ClientsPage() {
  const { data: dbClients } = useClients();

  function resolveHref(name: string, fallback: string): string {
    if (!dbClients) return fallback;
    const match = dbClients.find((c: { name: string }) => c.name === name);
    return match ? `/client/${match.id}` : fallback;
  }

  const totalAUM    = ACTIVE_FAMILIES.reduce((s, c) => s + c.aum, 0)         + LOCKED_FAMILIES.reduce((s, c) => s + c.aum, 0);
  const totalAssets = ACTIVE_FAMILIES.reduce((s, c) => s + c.totalAssets, 0) + LOCKED_FAMILIES.reduce((s, c) => s + c.totalAssets, 0);

  const topNav = (
    <div style={{ background: panel, borderBottom: `1px solid ${border}`, padding: "0 40px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <span style={{ fontFamily: INTER, fontSize: 15, fontWeight: 700, letterSpacing: "0.10em", color: navy }}>GURU</span>
        <div style={{ width: 1, height: 14, background: border, display: "inline-block", marginBottom: -2 }} />
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 400, color: navy, lineHeight: 1 }}>Current Client Portfolio</span>
        <span style={{ fontSize: 12, color: muted, letterSpacing: "0.03em" }}>GURU Advisor Intelligence</span>
      </div>
      <AddFamilyModal />
    </div>
  );

  return (
    <Layout topNav={topNav}>
      {/* Full-width linen canvas */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: linen, fontFamily: INTER }}>

        {/* ── KPI strip ── */}
        <div style={{
          background: panel, borderBottom: `1px solid ${border}`,
          padding: "20px 40px", display: "flex", gap: 56, flexShrink: 0,
        }}>
          {[
            { label: "Total AUM",    value: fmt$(totalAUM),    sub: "Under management",    accent: false },
            { label: "Total Assets", value: fmt$(totalAssets), sub: "Across all families", accent: false },
            { label: "Clients",      value: "73",              sub: "Active book",          accent: false },
            { label: "Action Items", value: "3",               sub: "Need attention today", accent: true  },
          ].map(k => (
            <div key={k.label}>
              <div style={{
                fontFamily: INTER, fontVariantNumeric: "tabular-nums",
                fontSize: 26, fontWeight: 600, lineHeight: 1,
                color: k.accent ? gold : navy,
                letterSpacing: "-0.4px", marginBottom: 4,
              }}>{k.value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: muted, marginBottom: 1 }}>{k.label}</div>
              <div style={{ fontSize: 11, color: faint }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Table area ── */}
        <div style={{ padding: "24px 40px 60px" }}>
          <div style={{
            background: panel,
            border: `1px solid ${border}`,
            borderRadius: 6,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <THead />

            {ACTIVE_FAMILIES.map(f => (
              <FamilyRow
                key={f.id}
                {...f}
                resolvedHref={resolveHref(f.name, f.href)}
              />
            ))}

            {/* Divider before locked rows */}
            <div style={{
              padding: "10px 28px 8px",
              borderBottom: `1px solid ${border}`,
              fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
              textTransform: "uppercase" as const, color: faint,
              fontFamily: INTER,
            }}>
              Coming Soon — Migrating to GURU
            </div>

            {LOCKED_FAMILIES.map(f => (
              <LockedRow key={f.name} {...f} />
            ))}
          </div>
        </div>

      </div>
    </Layout>
  );
}
