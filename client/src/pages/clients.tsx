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
import { Badge } from "@/components/ui/badge";
import { Users, Plus, ChevronRight, Mail, TrendingUp, Zap, Lock } from "lucide-react";

const PLACEHOLDER_CLIENTS = [
  { name: "James & Patricia Harrington", initials: "JH", risk: "conservative", age: 67, aum: "$8.4M", tag: "bg-blue-50 text-blue-700" },
  { name: "Olivia Chen", initials: "OC", risk: "aggressive", age: 38, aum: "$3.1M", tag: "bg-rose-50 text-rose-700" },
  { name: "Robert & Susan Delacroix", initials: "RD", risk: "moderate", age: 55, aum: "$12.7M", tag: "bg-amber-50 text-amber-700" },
  { name: "Marcus Thornton", initials: "MT", risk: "aggressive", age: 42, aum: "$5.9M", tag: "bg-rose-50 text-rose-700" },
];

const riskColors: Record<string, { bg: string; text: string }> = {
  conservative: { bg: "bg-blue-50", text: "text-blue-700" },
  moderate: { bg: "bg-amber-50", text: "text-amber-700" },
  aggressive: { bg: "bg-rose-50", text: "text-rose-700" },
};

function CreateClientModal() {
  const [open, setOpen] = useState(false);
  const mutation = useCreateClient();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutation.mutate({
      name: fd.get("name") as string,
      email: fd.get("email") as string,
      age: parseInt(fd.get("age") as string, 10),
      riskTolerance: fd.get("riskTolerance") as string,
    }, { onSuccess: () => setOpen(false) });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0 shadow-lg shadow-indigo-500/20" data-testid="button-add-client">
          <Plus className="w-4 h-4 mr-2" /> Add Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Onboard New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" name="name" required placeholder="Jane Doe" data-testid="input-client-name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" name="email" type="email" required placeholder="jane@example.com" data-testid="input-client-email" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="age">Age</Label>
              <Input id="age" name="age" type="number" required placeholder="45" min="18" max="100" data-testid="input-client-age" />
            </div>
            <div className="space-y-1.5">
              <Label>Risk Profile</Label>
              <Select name="riskTolerance" required defaultValue="moderate">
                <SelectTrigger data-testid="select-risk-tolerance">
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
          <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-client">
            {mutation.isPending ? "Creating..." : "Create Client Profile"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientsPage() {
  const { data: clients, isLoading } = useClients();

  return (
    <Layout>
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-indigo-500" />
            <h1 className="text-2xl font-display font-bold text-foreground">Client Portfolios</h1>
          </div>
          <p className="text-sm text-muted-foreground">See financial forecasts for clients + manage capital allocation + execute money movement</p>
        </div>
        <CreateClientModal />
      </div>
      {/* Summary bar */}
      {!isLoading && clients && clients.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-secondary/40 rounded-xl border border-border/50">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{clients.length}</p>
            <p className="text-xs text-muted-foreground">Active Clients</p>
          </div>
          <div className="text-center border-x border-border/60">
            <p className="text-2xl font-bold text-foreground">{clients.filter(c => c.riskTolerance === "moderate").length}</p>
            <p className="text-xs text-muted-foreground">Moderate Risk</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{Math.round(clients.reduce((s, c) => s + c.age, 0) / clients.length)}</p>
            <p className="text-xs text-muted-foreground">Avg Client Age</p>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-52 rounded-xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : !clients?.length ? (
        <Card className="border-dashed border-2 bg-transparent text-center p-14">
          <CardContent className="pt-0">
            <div className="w-16 h-16 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold mb-2">No clients yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
              Onboard your first client to start building balance sheet strategies and running AI analysis.
            </p>
            <CreateClientModal />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {clients.map(client => {
            const rc = riskColors[client.riskTolerance] || { bg: "bg-secondary", text: "text-secondary-foreground" };
            return (
              <Link key={client.id} href={`/client/${client.id}`} className="block group" data-testid={`link-client-${client.id}`}>
                <Card className="h-full hover-elevate border-border/60 hover:border-primary/30 transition-colors duration-200 cursor-pointer">
                  <CardContent className="p-5">
                    {/* Avatar + Risk badge */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-indigo-500/20 flex items-center justify-center font-bold text-lg text-primary">
                        {client.name.charAt(0)}
                      </div>
                      <Badge className={`${rc.bg} ${rc.text} capitalize text-xs font-semibold border-0`}>
                        {client.riskTolerance}
                      </Badge>
                    </div>

                    <h3 className="font-bold text-base text-foreground mb-0.5 group-hover:text-primary transition-colors" data-testid={`text-client-name-${client.id}`}>
                      {client.name}
                    </h3>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" /> $5.9M AUM
                      </span>
                      <span>Age {client.age}</span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" /> View Dashboard
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {/* ── Placeholder client cards ── */}
          {PLACEHOLDER_CLIENTS.map((ph) => (
            <div key={ph.name} className="block cursor-not-allowed">
              <Card className="h-full border-border/60">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-indigo-500/20 flex items-center justify-center font-bold text-lg text-primary">
                      {ph.initials}
                    </div>
                    <Badge className={`${ph.tag} capitalize text-xs font-semibold border-0`}>
                      {ph.risk}
                    </Badge>
                  </div>

                  <h3 className="font-bold text-base text-foreground mb-0.5">{ph.name}</h3>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {ph.aum} AUM
                    </span>
                    <span>Age {ph.age}</span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Not yet onboarded
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
