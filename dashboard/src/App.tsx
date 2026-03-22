import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Servers from "@/pages/servers";
import Moderation from "@/pages/moderation";
import ConnectPage from "@/pages/connect";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

// ── Theme ─────────────────────────────────────────────────────────────────────
interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void;
}
export const ThemeContext = createContext<ThemeContextType>({ theme: "light", toggleTheme: () => {} });
export function useTheme() { return useContext(ThemeContext); }

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    (localStorage.getItem("csi-theme") as "light" | "dark") ?? "light"
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("csi-theme", theme);
  }, [theme]);
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => t === "light" ? "dark" : "light") }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Server Context ────────────────────────────────────────────────────────────
interface ConnectedGuild {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
}
interface ServerContextType {
  guild: ConnectedGuild | null;
  disconnect: () => void;
}
export const ServerContext = createContext<ServerContextType>({ guild: null, disconnect: () => {} });
export function useServer() { return useContext(ServerContext); }

function ServerProvider({ children }: { children: React.ReactNode }) {
  const [guild, setGuild] = useState<ConnectedGuild | null>(() => {
    try { return JSON.parse(localStorage.getItem("csi-guild") ?? "null"); } catch { return null; }
  });

  const connect = (g: ConnectedGuild) => {
    setGuild(g);
    localStorage.setItem("csi-guild", JSON.stringify(g));
  };
  const disconnect = () => {
    setGuild(null);
    localStorage.removeItem("csi-guild");
  };

  if (!guild) return <ConnectPage onConnect={connect} />;

  return (
    <ServerContext.Provider value={{ guild, disconnect }}>
      {children}
    </ServerContext.Provider>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────
function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/servers" component={Servers} />
        <Route path="/moderation" component={Moderation} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ServerProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </ServerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
