import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { AddClientDialog } from "@/components/forms/AddClientDialog";
import { useClients } from "@/hooks/use-clients";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ArrowRight, ShieldAlert, ShieldCheck, Shield } from "lucide-react";
import { motion } from "framer-motion";

function getRiskColor(risk: string) {
  switch (risk.toLowerCase()) {
    case 'conservative': return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-blue-200";
    case 'moderate': return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 border-emerald-200";
    case 'aggressive': return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 border-orange-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function getRiskIcon(risk: string) {
  switch (risk.toLowerCase()) {
    case 'conservative': return <ShieldCheck className="h-3.5 w-3.5 mr-1" />;
    case 'moderate': return <Shield className="h-3.5 w-3.5 mr-1" />;
    case 'aggressive': return <ShieldAlert className="h-3.5 w-3.5 mr-1" />;
    default: return null;
  }
}

export default function ClientsList() {
  const { data: clients, isLoading, error } = useClients();

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
          <div>
            <h1 className="font-display text-4xl font-bold text-foreground">Client Portfolios</h1>
            <p className="text-muted-foreground mt-2 text-lg">Manage wealth strategies and track financial health.</p>
          </div>
          <AddClientDialog />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="glass-card">
                <CardHeader className="gap-2">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-4/5" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-destructive font-medium">Failed to load clients. Please try again.</p>
          </div>
        ) : clients?.length === 0 ? (
          <div className="text-center py-32 bg-card rounded-3xl border border-border border-dashed">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-display text-2xl font-semibold text-foreground mb-2">No clients yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">Start building your practice by adding your first client profile to track their wealth journey.</p>
            <AddClientDialog />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients?.map((client, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                key={client.id}
              >
                <Link href={`/client/${client.id}`} className="block h-full">
                  <Card className="h-full glass-card hover-elevate cursor-pointer group flex flex-col">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-display text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                            {client.name}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">{client.email}</p>
                        </div>
                        <div className="bg-primary/5 text-primary rounded-full h-10 w-10 flex items-center justify-center font-bold text-sm">
                          {client.name.charAt(0)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-6 flex-grow">
                      <div className="flex gap-4">
                        <div className="bg-muted/50 rounded-lg p-3 flex-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Age</p>
                          <p className="font-semibold">{client.age} yrs</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3 flex-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Profile</p>
                          <Badge variant="outline" className={`capitalize ${getRiskColor(client.riskTolerance)}`}>
                            {getRiskIcon(client.riskTolerance)}
                            {client.riskTolerance}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0 pb-6 border-t border-border/40 mt-auto pt-4 flex justify-between items-center text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                      View Dashboard
                      <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                    </CardFooter>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
