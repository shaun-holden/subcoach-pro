import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import CoachDashboard from "@/pages/coach-dashboard";
import OwnerDashboard from "@/pages/owner-dashboard";
import CalendarPage from "@/pages/calendar";
import Billing from "@/pages/billing";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          {/* Redirect based on user type */}
          {user?.userType === 'coach' ? (
            <>
              <Route path="/" component={CoachDashboard} />
              <Route path="/coach-dashboard" component={CoachDashboard} />
              <Route path="/calendar" component={CalendarPage} />
            </>
          ) : user?.userType === 'owner' ? (
            <>
              <Route path="/" component={OwnerDashboard} />
              <Route path="/owner-dashboard" component={OwnerDashboard} />
              <Route path="/calendar" component={CalendarPage} />
              <Route path="/billing" component={Billing} />
            </>
          ) : (
            <Route path="/" component={Landing} />
          )}
        </>
      )}
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
