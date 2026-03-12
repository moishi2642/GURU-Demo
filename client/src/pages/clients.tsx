import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useClients, useCreateClient } from "@/hooks/use-clients";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, ChevronRight, TrendingUp, Lock, ArrowUpRight } from "lucide-react";

/* ── Placeholder seeded clients (locked / not yet onboarded) ─────────────── */
const PLACEHOLDER_CLIENTS = [
  { name: "James & Patricia Harrington", initials: "JH", risk: "conservative", age: 67, aum: "$8.4M",  riskKey: "conservative" },
  { name: "Olivia Chen",                 initials: "OC", risk: "aggressive",   age: 38, aum: "$3.1M",  riskKey: "aggressive"   },
  { name: "Robert & Susan Delacroix",    initials: "RD", risk: "moderate",     age: 55, aum: "$12.7M", riskKey: "moderate"     },
  { name: "Marcus Thornton",             initials: "MT", risk: "aggressive",   age: 42, aum: "$5.9M",  riskKey: "aggressive"   },
];

/* ── Risk badge styles — border only, no fill ────────────────────────────── */
const RISK_STYLES: Record<string, { dot: string; text: string; border: string; label: string }> = {
  conservative: {
    dot:    "bg-[hsl(216,82%,50%)]",
    text:   "text-[hsl(216,82%,38%)]",
    border: "border-[hsl(216,82%,75%)]",
    label:  "Conservative",
  },
  moderate: {
    dot:    "bg-[hsl(36,70%,48%)]",
    text:   "text-[hsl(36,70%,36%)]",
    border: "border-[hsl(36,70%,68%)]",
    label:  "Moderate",
  },
  aggressive: {
    dot:    "bg-rose-500",
    text:   "text-rose-700",
    border: "border-rose-300",
    label:  "Aggressive",
  },
};

/* ── Initials background colors — muted, institutional ───────────────────── */
const INITIALS_COLORS = [
  "bg-[hsl(216,60%,88%)] text-[hsl(216,82%,32%)]",
  "bg-[hsl(196,55%,88%)] text-[hsl(196,78%,28%)]",
  "bg-[hsl(160,45%,87%)] text-[hsl(160,60%,26%)]",
  "bg-[hsl(36,55%,88%)]  text-[hsl(36,70%,32%)]",
];

function getInitialsColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31;
  return INITIALS_COLORS[Math.abs(hash) % INITIALS_COLORS.length];
}

/* ── Risk badge component ─────────────────────────────────────────────────── */
function RiskBadge({ risk }: { risk: string }) {
  const s = RISK_STYLES[risk] ?? {
    dot: "bg-muted-foreground", text: "text-muted-foreground",
    border: "border-border", label: risk,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10.5px] font-semibold
                  px-1.5 py-0.5 rounded border ${s.text} ${s.border} bg-transparent
                  uppercase tracking-wide`}
    >
      <span className={`w-1 h-1 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/* ── Add client modal ─────────────────────────────────────────────────────── */
function CreateClientModal() {
  const [open, setOpen] = useState(false);
  const mutation = useCreateClient();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutation.mutate(
      {
        name:          fd.get("name")          as string,
        email:         fd.get("email")         as string,
        age:           parseInt(fd.get("age") as string, 10),
        riskTolerance: fd.get("riskTolerance") as string,
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="h-8 px-3 text-[12.5px] font-semibold bg-primary text-primary-foreground
                     border-0 shadow-sm hover:opacity-90 transition-opacity"
          data-testid="button-add-client"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-[14px]">Onboard New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground" htmlFor="name">Full Name</Label>
            <Input id="name" name="name" required placeholder="Jane Doe" data-testid="input-client-name" className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground" htmlFor="email">Email Address</Label>
            <Input id="email" name="email" type="email" required placeholder="jane@example.com" data-testid="input-client-email" className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground" htmlFor="age">Age</Label>
              <Input id="age" name="age" type="number" required placeholder="45" min="18" max="100" data-testid="input-client-age" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Risk Profile</Label>
              <Select name="riskTolerance" required defaultValue="moderate">
                <SelectTrigger className="h-8 text-sm" data-testid="select-risk-tolerance">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full h-8 text-[12.5px]" disabled={mutation.isPending} data-testid="button-submit-client">
            {mutation.isPending ? "Creating…" : "Create Client Profile"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Client row / card component ─────────────────────────────────────────── */
function ClientCard({
  href,
  name,
  initials,
  age,
  risk,
  aum,
  locked = false,
}: {
  href?: string;
  name: string;
  initials: string;
  age: number;
  risk: string;
  aum: string;
  locked?: boolean;
}) {
  const initClr = getInitialsColor(name);
  const inner = (
    <div
      className={`
        flex items-center gap-4 px-4 py-3
        border-b border-border/50 last:border-0
        transition-colors duration-100
        ${!locked ? "cursor-pointer hover:bg-secondary/60" : "opacity-55 cursor-not-allowed"}
      `}
    >
      {/* Initials */}
      <div
        className={`w-8 h-8 rounded flex items-center justify-center
                    text-[11px] font-bold flex-shrink-0 ${initClr}`}
      >
        {initials}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground truncate leading-tight">
            {name}
          </span>
          {locked && <Lock className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />}
        </div>
        <span className="text-[11px] text-muted-foreground">Age {age}</span>
      </div>

      {/* AUM */}
      <div className="text-right flex-shrink-0 hidden sm:block">
        <p className="text-[12.5px] font-semibold tabular text-foreground">{aum}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">AUM</p>
      </div>

      {/* Risk badge */}
      <div className="flex-shrink-0 w-24 flex justify-end">
        <RiskBadge risk={risk} />
      </div>

      {/* Arrow */}
      {!locked ? (
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
      ) : (
        <div className="w-3.5" />
      )}
    </div>
  );

  if (href && !locked) {
    return (
      <Link href={href} className="block group" data-testid={`link-client-${href.split("/").pop()}`}>
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function ClientsPage() {
  const { data: clients, isLoading } = useClients();

  return (
    <Layout>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[17px] font-display font-bold text-foreground tracking-tight">
            Client Portfolios
          </h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Financial forecasts · capital allocation · money movement
          </p>
        </div>
        <CreateClientModal />
      </div>

      {/* ── Summary strip ───────────────────────────────────────────────── */}
      {!isLoading && clients && clients.length > 0 && (
        <div className="grid grid-cols-3 gap-0 mb-4 border border-border rounded overflow-hidden bg-card">
          {[
            { label: "Active Clients",  value: String(clients.length) },
            {
              label: "Moderate Risk",
              value: String(clients.filter(c => c.riskTolerance === "moderate").length),
            },
            {
              label: "Avg Age",
              value: String(Math.round(clients.reduce((s, c) => s + c.age, 0) / clients.length)),
            },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`px-4 py-3 text-center ${i !== 2 ? "border-r border-border" : ""}`}
            >
              <p className="text-[18px] font-bold tabular text-foreground">{stat.value}</p>
              <p className="text-[10.5px] text-muted-foreground uppercase tracking-wide mt-0.5">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Client list ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 rounded bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : !clients?.length ? (
        /* Empty state */
        <Card className="border-dashed border-2 bg-transparent text-center p-14">
          <CardContent className="pt-0">
            <div className="w-12 h-12 mx-auto bg-primary/10 text-primary rounded flex items-center justify-center mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-[14px] font-semibold mb-1.5">No clients yet</h3>
            <p className="text-[12px] text-muted-foreground mb-5 max-w-xs mx-auto">
              Onboard your first client to start building balance sheet strategies and running AI analysis.
            </p>
            <CreateClientModal />
          </CardContent>
        </Card>
      ) : (
        /* Client table */
        <Card className="overflow-hidden border border-border shadow-sm">
          {/* Table header */}
          <div className="grid px-4 py-2 bg-secondary/60 border-b border-border"
               style={{ gridTemplateColumns: "2rem 1fr 7rem 7rem 1.5rem" }}>
            <div />
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Client</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground text-right hidden sm:block">AUM</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground text-right">Risk</p>
            <div />
          </div>

          {/* Active (real) clients */}
          {clients.map(client => (
            <ClientCard
              key={client.id}
              href={`/client/${client.id}`}
              name={client.name}
              initials={client.name.charAt(0) + (client.name.split(" ")[1]?.charAt(0) ?? "")}
              age={client.age}
              risk={client.riskTolerance}
              aum="$5.9M"
            />
          ))}

          {/* Locked placeholder clients */}
          {PLACEHOLDER_CLIENTS.map(ph => (
            <ClientCard
              key={ph.name}
              name={ph.name}
              initials={ph.initials}
              age={ph.age}
              risk={ph.riskKey}
              aum={ph.aum}
              locked
            />
          ))}

          {/* Footer: add more */}
          <div className="px-4 py-2.5 border-t border-border bg-secondary/30 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {(clients.length + PLACEHOLDER_CLIENTS.length)} clients total
            </span>
            <button className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline transition-colors">
              <ArrowUpRight className="w-3 h-3" />
              Export roster
            </button>
          </div>
        </Card>
      )}
    </Layout>
  );
}
