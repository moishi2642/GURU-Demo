import { Link } from "wouter";
import { Building2, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
                Aura Wealth
              </h1>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Advisor Intelligence
              </p>
            </div>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Clients</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
