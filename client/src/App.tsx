import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import VerifyAccount from "@/pages/verify-account";
import PasswordRecovery from "@/pages/password-recovery";
import CommunityDashboard from "@/pages/community-dashboard";
import AdminCommunity from "@/pages/admin-community";
import Dashboard from "@/pages/dashboard";
import Admin from "@/pages/admin";
import AdminUsersPage from "@/pages/admin-users";
import AdminHome from "@/pages/admin-home";
import SubscriptionPage from "@/pages/subscription";
import PrivacyPolicy from "@/pages/privacy";
import TermsOfUse from "@/pages/terms";
import FuelFinderPage from "@/pages/fuel-finder";
import MessagingPage from "@/pages/messaging";
import AdminMessagingPage from "@/pages/admin-messaging";
import FuelMarketplacePage from "@/pages/fuel-marketplace";
import AdminMarketplacePage from "@/pages/admin-marketplace";
import NotFound from "@/pages/not-found";

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/community" component={CommunityDashboard} />
        <Route path="/admin" component={AdminHome} />
        <Route path="/admin/panel" component={Admin} />
        <Route path="/admin/users" component={AdminUsersPage} />
        <Route path="/admin/community" component={AdminCommunity} />
        <Route path="/admin/messaging" component={AdminMessagingPage} />
        <Route path="/fuel-finder" component={FuelFinderPage} />
        <Route path="/messages" component={MessagingPage} />
        <Route path="/marketplace" component={FuelMarketplacePage} />
        <Route path="/admin/marketplace" component={AdminMarketplacePage} />
        <Route path="/subscription" component={SubscriptionPage} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/verify-account" component={VerifyAccount} />
        <Route path="/password-recovery" component={PasswordRecovery} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/terms" component={TermsOfUse} />
        <Route path="/">
          {user ? <Dashboard /> : <><Navbar /><Landing /></>}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppRoutes />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
