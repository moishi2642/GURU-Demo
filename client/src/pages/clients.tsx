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
import { Users, Plus, ChevronRight, Briefcase } from "lucide-react";

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
    }, {
      onSuccess: () => setOpen(false)
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="hover-lift bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" /> Add Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Onboard New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" name="name" required placeholder="Jane Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" name="email" type="email" required placeholder="jane@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input id="age" name="age" type="number" required placeholder="45" min="18" max="100" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="riskTolerance">Risk Tolerance</Label>
            <Select name="riskTolerance" required defaultValue="moderate">
              <SelectTrigger>
                <SelectValue placeholder="Select risk profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conservative">Conservative</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="aggressive">Aggressive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full mt-4" disabled={mutation.isPending}>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Client Portfolios</h1>
          <p className="text-muted-foreground mt-1">Manage and analyze your active client base.</p>
        </div>
        <CreateClientModal />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : !clients?.length ? (
        <Card className="border-dashed border-2 bg-transparent text-center p-12">
          <CardContent className="pt-6">
            <div className="w-16 h-16 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">No clients found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Start by onboarding your first client to build out their financial dashboard and generate strategies.
            </p>
            <CreateClientModal />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map(client => (
            <Link key={client.id} href={`/client/${client.id}`} className="block group">
              <Card className="h-full hover-lift border-border/50 hover:border-primary/30 transition-colors duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full -z-10" />
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold text-lg">
                      {client.name.charAt(0)}
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground capitalize border border-border">
                      {client.riskTolerance} Risk
                    </span>
                  </div>
                  <h3 className="font-bold text-xl text-foreground mb-1 group-hover:text-primary transition-colors">
                    {client.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4" /> Age {client.age}
                  </p>
                  <div className="flex items-center text-primary font-medium text-sm mt-auto">
                    View Dashboard <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
