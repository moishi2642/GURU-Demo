// ─── Demo date: simulate "today = December 31, 2025" ──────────────────────────
// SINGLE SOURCE OF TRUTH for all tab date displays.
// This constant is visible / referenced from the GURU Intelligence tab header.
// All other tabs derive their "today" from this value.
export const DEMO_NOW = new Date(2025, 11, 31); // December 31, 2025

// ─── Institutional color palette — private wealth / Goldman aesthetic ─────────
// Deep, desaturated. Navy, warm gold, forest, slate. No orange, no purple.
export const HERO_COLORS: Record<string, { bg: string; accent: string; dot: string }> = {
  "Operating Cash": { bg: "#162843", accent: "#7aa7d4", dot: "#5a85b8" }, // deep navy
  Reserve:          { bg: "#3a2710", accent: "#c9a84c", dot: "#b8943f" }, // deep warm gold
  Build:            { bg: "#0e3320", accent: "#5ab88a", dot: "#3da870" }, // deep forest
  Grow:             { bg: "#1e2d40", accent: "#7da3c8", dot: "#5585ae" }, // deep slate
  "Real Estate":        { bg: "#2a2a2a", accent: "#a3a3a3", dot: "#888888" },
  "Alternative Assets": { bg: "#2a2a2a", accent: "#a3a3a3", dot: "#888888" },
  "529 Plans":          { bg: "#2a2a2a", accent: "#a3a3a3", dot: "#888888" },
};

// ─── Book of Business — flag metadata & client data ───────────────────────────
export type FlagKey = "excess_cash" | "cash_deficit" | "product_needed" | "follow_up" | "autobill_approval" | "money_movement";

// ─── Institutional flag colors — border-only badges, no filled backgrounds ─────
export const FLAG_META: Record<FlagKey, { label: string; short: string; color: string; bg: string; text: string; border: string }> = {
  excess_cash:       { label: "Excess Cash",      short: "Excess Cash",  color: "#b45309", bg: "bg-transparent", text: "text-[#92400e]",  border: "border-[#b45309]/40" },
  cash_deficit:      { label: "Cash Deficit",      short: "Deficit",      color: "#b91c1c", bg: "bg-transparent", text: "text-[#991b1b]",  border: "border-[#b91c1c]/40" },
  product_needed:    { label: "Product Selection", short: "Product",      color: "#1a4f9c", bg: "bg-transparent", text: "text-[#1a4f9c]",  border: "border-[#1a4f9c]/40" },
  follow_up:         { label: "Follow Up",         short: "Follow Up",    color: "#1a5c35", bg: "bg-transparent", text: "text-[#1a5c35]",  border: "border-[#1a5c35]/40" },
  autobill_approval: { label: "Autobill Approval", short: "Autobill",     color: "#1a5f52", bg: "bg-transparent", text: "text-[#1a5f52]",  border: "border-[#1a5f52]/40" },
  money_movement:    { label: "Money Movement",    short: "Movement",     color: "#233554", bg: "bg-transparent", text: "text-[#233554]",  border: "border-[#233554]/40" },
};

export interface BobClient {
  id: number;
  name: string;
  initials: string;
  aum: number;
  totalAssets: number;
  liquidCash: number;
  cashPct: number;
  flags: FlagKey[];
  advisor: string;
  lastContact: string;
}

export const BOB_CLIENTS: BobClient[] = (() => {
  const LN = ["Adams","Allen","Anderson","Baker","Barnes","Bell","Bennett","Brooks","Brown","Campbell","Carter","Clark","Collins","Cook","Cooper","Cox","Davis","Evans","Fisher","Foster","Garcia","Gonzalez","Gray","Green","Hall","Harris","Harrison","Hayes","Hill","Howard","Hughes","Jackson","James","Jenkins","Johnson","Jones","Kelly","King","Lee","Lewis","Long","Martin","Martinez","Mason","Miller","Mitchell","Moore","Morgan","Morris","Murphy","Nelson","Parker","Patterson","Perry","Peterson","Phillips","Powell","Price","Reed","Richardson","Rivera","Roberts","Robinson","Rogers","Ross","Russell","Sanders","Scott","Shaw","Simpson","Smith","Stewart","Sullivan","Taylor","Thomas","Thompson","Torres","Turner","Walker","Ward","Watson","White","Williams","Wilson","Wood","Wright","Young"];
  const FN = ["James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda","William","Barbara","David","Susan","Richard","Jessica","Joseph","Karen","Charles","Sarah","Thomas","Lisa","Daniel","Nancy","Anthony","Betty","Donald","Margaret","Mark","Sandra","Paul","Ashley","Steven","Dorothy","Andrew","Kimberly","Kenneth","Emily","Joshua","Donna","Kevin","Michelle"];
  const ADV = ["Sarah Chen","Marcus Webb","Priya Patel","James Harlow","Emma Laurent"];
  const FS: FlagKey[][] = [["excess_cash"],["excess_cash","product_needed"],["cash_deficit"],["cash_deficit","follow_up"],["product_needed"],["product_needed","follow_up"],["follow_up"],["autobill_approval"],["autobill_approval","money_movement"],["money_movement"],["money_movement","excess_cash"],[],[],["excess_cash","autobill_approval"],["cash_deficit","money_movement"],["follow_up","autobill_approval"]];
  const AUML = [750_000,1_500_000,3_200_000,7_800_000,14_500_000,28_000_000,42_000_000];
  const CTACT = ["Today","Yesterday","2d ago","1 wk ago","2 wk ago","1 mo ago","3 mo ago"];
  return Array.from({length:100},(_,i)=>{
    const flags = FS[i % FS.length];
    const aum = Math.round(AUML[i % AUML.length] * (1 + (i * 0.17) % 0.85));
    const totalAssets = Math.round(aum * (1.18 + (i * 0.041) % 0.32));
    const cpct = flags.includes("excess_cash") ? 12+(i%18) : flags.includes("cash_deficit") ? 0.4+(i%2)*0.8 : 2.5+(i%7);
    return { id:i+1, name:`${LN[i%LN.length]}, ${FN[i%FN.length]}`, initials:`${FN[i%FN.length][0]}${LN[i%LN.length][0]}`, aum, totalAssets, liquidCash:Math.round(aum*cpct/100), cashPct:Math.round(cpct*10)/10, flags, advisor:ADV[i%ADV.length], lastContact:CTACT[i%CTACT.length] };
  });
})();

export const PANEL_CLS =
  "bg-white overflow-hidden [border:0.5px_solid_rgba(0,0,0,0.07)]";

// Intelligence-layer panels — dark forest green analytical canvas
export const INTEL_PANEL_CLS =
  "guru-intelligence border shadow-sm rounded-xl overflow-hidden";

// ─── Color constants (updated to institutional palette) ────────────────────────
export const GREEN = "hsl(160, 60%, 38%)";
export const RED   = "hsl(0, 72%, 50%)";
export const BLUE  = "hsl(216, 82%, 43%)";

// Intelligence-layer chart colors
export const INTEL_GREEN      = "hsl(152, 52%, 44%)";   // positive / growth line
export const INTEL_GREEN_DIM  = "hsl(152, 40%, 32%)";   // area fill
export const INTEL_GRID       = "hsl(152, 22%, 18%)";   // chart grid lines

// ─── GURU Method: 5 Strategic Bucket Definitions ─────────────────────────────
export const GURU_BUCKETS = {
  reserve: {
    label: "Operating Cash",
    short: "Checking — instantly available transaction accounts",
    color: "#1E4F9C",
    tagCls: "bg-transparent border border-[#1E4F9C]/35 text-[#1E4F9C]",
  },
  yield: {
    label: "Liquidity Reserve",
    short: "Savings & money market — penalty-free, higher-yielding",
    color: "#835800",
    tagCls: "bg-transparent border border-[#835800]/35 text-[#835800]",
  },
  tactical: {
    label: "Capital Build",
    short: "Treasuries & fixed income — 1–3 year horizon",
    color: "#195830",
    tagCls: "bg-transparent border border-[#195830]/35 text-[#195830]",
  },
  growth: {
    label: "Investments",
    short: "Long-horizon investments — equities, compounding wealth",
    color: "#4A3FA0",
    tagCls: "bg-transparent border border-[#4A3FA0]/35 text-[#4A3FA0]",
  },
  alternatives: {
    label: "Alternatives",
    short: "Real estate, private equity, RSUs — strategic illiquid assets",
    color: "#5C5C6E",
    tagCls: "bg-transparent border border-slate-400/40 text-slate-600",
  },
} as const;

export type GuroBucket = keyof typeof GURU_BUCKETS;
