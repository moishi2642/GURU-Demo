import { useState } from "react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";

/* ── Nav item styles (mirrors client-dashboard pattern) ──────────────────── */
const NAV_ITEM: React.CSSProperties = {
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 11,
  fontWeight: 500,
  color: "rgba(255,255,255,0.4)",
  padding: "5px 8px",
  borderRadius: 5,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 7,
  marginBottom: 1,
  transition: "background 0.1s, color 0.1s",
  userSelect: "none" as const,
  whiteSpace: "nowrap" as const,
};

const NAV_ITEM_ACTIVE: React.CSSProperties = {
  ...NAV_ITEM,
  fontWeight: 600,
  color: "#ffffff",
  background: "rgba(255,255,255,0.06)",
};

const SECTION_LABEL: React.CSSProperties = {
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "rgba(255,255,255,0.2)",
  padding: "0 8px",
  marginBottom: 4,
  marginTop: 8,
};

type TabId = "onboarding" | "importer";

/* ── Sidebar nav ─────────────────────────────────────────────────────────── */
function NewClientSidebarNav({ activeTab, onTab }: { activeTab: TabId; onTab: (t: TabId) => void }) {
  return (
    <nav style={{ padding: "12px 12px 8px" }}>
      <div style={SECTION_LABEL}>New Client</div>

      <div
        style={activeTab === "onboarding" ? NAV_ITEM_ACTIVE : NAV_ITEM}
        onClick={() => onTab("onboarding")}
      >
        {/* Clipboard icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <line x1="9" y1="12" x2="15" y2="12" />
          <line x1="9" y1="16" x2="13" y2="16" />
        </svg>
        <span className="sb-hide">Onboarding Survey</span>
      </div>

      <div
        style={activeTab === "importer" ? NAV_ITEM_ACTIVE : NAV_ITEM}
        onClick={() => onTab("importer")}
      >
        {/* Upload icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="sb-hide">Document Importer</span>
      </div>

      <div style={{ ...SECTION_LABEL, marginTop: 16 }}>Navigate</div>
      <Link href="/">
        <div style={NAV_ITEM}>
          {/* Home icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="sb-hide">All Clients</span>
        </div>
      </Link>
    </nav>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function NewClientPage() {
  const [activeTab, setActiveTab] = useState<TabId>("onboarding");

  const sidebarNav = (
    <NewClientSidebarNav activeTab={activeTab} onTab={setActiveTab} />
  );

  return (
    <Layout sidebarNav={sidebarNav}>
      {/* flex: 1 + minHeight: 0 lets the iframe fill main's remaining height */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <iframe
          key={activeTab}
          src={activeTab === "onboarding" ? "/guru-onboarding.html" : "/guru-importer.html"}
          title={activeTab === "onboarding" ? "GURU Onboarding Survey" : "GURU Document Importer"}
          style={{
            flex: 1,
            width: "100%",
            border: "none",
            display: "block",
            minHeight: 0,
          }}
          allow="clipboard-write"
        />
      </div>
    </Layout>
  );
}
