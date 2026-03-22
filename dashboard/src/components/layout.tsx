import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Server, ShieldBan, Menu, X, Activity, Sun, Moon, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBotStats } from "@/hooks/use-bot-api";
import { useTheme, useServer } from "@/App";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: stats, isLoading } = useBotStats();
  const { theme, toggleTheme } = useTheme();
  const { guild, disconnect } = useServer();

  const isOnline = stats?.online ?? false;

  const navItems = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/servers", label: "Servers", icon: Server },
    { href: "/moderation", label: "Moderation", icon: ShieldBan },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center gap-2 font-display font-bold text-xl">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            C
          </div>
          CSI Bot
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out md:static md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 hidden md:flex items-center justify-between">
          <div className="flex items-center gap-3 font-display font-bold text-2xl text-foreground">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              C
            </div>
            CSI
          </div>
          <button
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200"
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="text-xs font-bold text-sidebar-foreground uppercase tracking-wider mb-4 px-3">
            Dashboard
          </div>
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-sidebar-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon size={20} className={cn(isActive && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Connected Server */}
        <div className="p-4 border-t border-sidebar-border space-y-2">
          {guild && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/8">
              {guild.icon ? (
                <img src={guild.icon} alt={guild.name} className="w-7 h-7 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {guild.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{guild.name}</p>
                <p className="text-[10px] text-muted-foreground">{guild.memberCount.toLocaleString()} members</p>
              </div>
              <button
                onClick={disconnect}
                title="Disconnect server"
                className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/50 border border-border/50">
            <div className="relative flex h-3 w-3">
              {isLoading ? (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-muted"></span>
              ) : isOnline ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-20"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">
                {isLoading ? "Checking status..." : stats?.tag || "CSI Bot"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {isLoading ? "Connecting" : isOnline ? "Online & Polling" : "Offline"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative h-[100dvh] overflow-hidden">
        {/* Overlay for mobile sidebar */}
        {isMobileMenuOpen && (
          <div 
            className="absolute inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
