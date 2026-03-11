import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ClientDashboard from "./pages/client-dashboard";
import BookOfBusinessPage from "./pages/bookofbusiness";

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <Redirect to="/client/1" />}</Route>
      <Route path="/client/:id" component={ClientDashboard} />
      <Route path="/bookofbusiness" component={BookOfBusinessPage} />
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
