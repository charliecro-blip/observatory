import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import LogPage from "@/pages/log";
import Logs from "@/pages/logs";
import Supplements from "@/pages/supplements";
import Activities from "@/pages/activities";
import Patterns from "@/pages/patterns";
import Chat from "@/pages/chat";
import Natal from "@/pages/natal";
import Track from "@/pages/track";
import Blueprint from "@/pages/blueprint";
import Cultivator from "@/pages/cultivator";
import CalendarPage from "@/pages/calendar";
import Settings from "@/pages/settings";
import AuspicePage from "@/pages/auspice";
import { TesterProvider } from "@/contexts/tester-context";
import { TesterModal } from "@/components/tester-modal";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/log" component={LogPage} />
        <Route path="/track" component={Track} />
        <Route path="/logs" component={Logs} />
        <Route path="/supplements" component={Supplements} />
        <Route path="/activities" component={Activities} />
        <Route path="/patterns" component={Patterns} />
        <Route path="/natal" component={Natal} />
        <Route path="/blueprint" component={Blueprint} />
        <Route path="/cultivator" component={Cultivator} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/settings" component={Settings} />
        <Route path="/auspice" component={AuspicePage} />
        <Route path="/chat" component={Chat} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TesterProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <TesterModal />
        </TesterProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
