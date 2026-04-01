import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ClientsPage from "./pages/clients";
import ClientDashboard from "./pages/client-dashboard";
import BookOfBusinessPage from "./pages/bookofbusiness";
import AllocationTool from "./pages/allocation-tool";
import NewClientPage from "./pages/NewClient";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ClientsPage} />
      <Route path="/client/:id" component={ClientDashboard} />
      <Route path="/bookofbusiness" component={BookOfBusinessPage} />
      <Route path="/allocation-tool" component={AllocationTool} />
      <Route path="/new-client" component={NewClientPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
