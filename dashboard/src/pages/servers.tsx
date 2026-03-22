import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Users, Shield, ServerIcon } from "lucide-react";
import { useBotServers } from "@/hooks/use-bot-api";
import { Card, Input } from "@/components/ui";

export default function Servers() {
  const { data: servers, isLoading, error } = useBotServers();
  const [search, setSearch] = useState("");

  const filteredServers = servers?.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.id.includes(search)
  ) || [];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Servers</h1>
          <p className="text-muted-foreground mt-1">Manage all guilds the bot is currently in.</p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <Input 
            placeholder="Search servers by name or ID..." 
            className="pl-10 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center border-dashed border-2">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
             <ServerIcon className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Failed to load servers</h3>
          <p className="text-muted-foreground max-w-md">{error.message}</p>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-secondary rounded w-3/4" />
                  <div className="h-4 bg-secondary rounded w-1/2" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredServers.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center border-dashed border-2">
           <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
             <ServerIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">No servers found</h3>
          <p className="text-muted-foreground">The bot is not in any servers or none match your search.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredServers.map((server, i) => (
            <motion.div
              key={server.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.5) }}
            >
              <Card className="p-6 hover:border-primary/40 hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    {server.icon ? (
                      <img 
                        src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png?size=128`} 
                        alt={server.name}
                        className="w-16 h-16 rounded-2xl object-cover shadow-md group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary to-muted flex items-center justify-center text-xl font-bold text-muted-foreground shadow-md group-hover:scale-105 transition-transform duration-300">
                        {server.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-foreground truncate" title={server.name}>
                      {server.name}
                    </h3>
                    <p className="text-xs font-mono text-muted-foreground mt-1 truncate">
                      ID: {server.id}
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-lg">
                    <Users size={16} className="text-primary" />
                    <span className="font-medium text-foreground">{server.memberCount.toLocaleString()}</span> members
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Owner ID">
                    <Shield size={14} />
                    <span className="truncate w-24 block font-mono">{server.ownerId}</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
