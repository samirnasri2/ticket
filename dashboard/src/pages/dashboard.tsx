import { motion } from "framer-motion";
import { Server, Users, Clock, Activity, AlertCircle } from "lucide-react";
import { useBotStats } from "@/hooks/use-bot-api";
import { formatUptime } from "@/lib/utils";
import { Card } from "@/components/ui";

export default function Dashboard() {
  const { data: stats, isLoading, error } = useBotStats();

  const statCards = [
    {
      title: "Total Servers",
      value: stats?.serverCount ?? 0,
      icon: Server,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      title: "Total Members",
      value: stats?.totalMembers?.toLocaleString() ?? 0,
      icon: Users,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      title: "Uptime",
      value: stats?.uptime ? formatUptime(stats.uptime) : "0m",
      icon: Clock,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
    {
      title: "Status",
      value: stats?.online ? "Online" : "Offline",
      icon: Activity,
      color: stats?.online ? "text-success" : "text-destructive",
      bg: stats?.online ? "bg-success/10" : "bg-destructive/10",
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden h-48 md:h-64 border border-border shadow-2xl"
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/dashboard-banner.png`} 
          alt="Dashboard Banner" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 md:p-8">
          <h1 className="text-3xl md:text-5xl font-display font-bold text-white mb-2 tracking-tight">
            CSI Control Center
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl font-medium max-w-2xl">
            Monitor and manage your bot's presence across the platform.
          </p>
        </div>
      </motion.div>

      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
          <div>
            <h3 className="font-semibold text-destructive">Connection Error</h3>
            <p className="text-sm text-destructive/80 mt-1">{error.message}</p>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="p-6 flex flex-col justify-between h-full hover:border-primary/50 hover:shadow-xl transition-all duration-300 group">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-muted-foreground">{stat.title}</h3>
                  <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} transition-transform duration-300 group-hover:scale-110`}>
                    <Icon size={20} />
                  </div>
                </div>
                <div>
                  {isLoading ? (
                    <div className="h-8 w-24 bg-secondary rounded animate-pulse" />
                  ) : (
                    <div className="text-3xl font-display font-bold text-foreground">
                      {stat.value}
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
      
      {/* Quick Info panel */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
         <Card className="p-6 bg-gradient-to-br from-card to-card/50">
            <h3 className="text-xl font-display font-bold mb-4 flex items-center gap-2">
              <Activity className="text-primary" /> System Health
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted-foreground">API Connection</span>
                <span className="flex items-center gap-2 text-success font-medium">
                  <div className="w-2 h-2 rounded-full bg-success"></div> Active
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted-foreground">Last Refresh</span>
                <span className="text-foreground font-medium">Just now</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Bot Tag</span>
                <span className="text-foreground font-medium bg-secondary px-2 py-1 rounded-md text-sm">
                  {stats?.tag || "Unknown"}
                </span>
              </div>
            </div>
         </Card>
      </motion.div>
    </div>
  );
}
