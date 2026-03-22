import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Gavel, History, CheckCircle2, AlertTriangle } from "lucide-react";
import { useBotServers, useModeration } from "@/hooks/use-bot-api";
import { Card, Input, Label, Select, Textarea, Button } from "@/components/ui";

interface ModHistoryLog {
  id: string;
  action: "ban" | "kick";
  guildName: string;
  userId: string;
  reason: string;
  timestamp: number;
  success: boolean;
}

export default function Moderation() {
  const { data: servers, isLoading: serversLoading } = useBotServers();
  const { executeAction, isPending } = useModeration();
  
  const [guildId, setGuildId] = useState("");
  const [userId, setUserId] = useState("");
  const [actionType, setActionType] = useState<"ban" | "kick">("kick");
  const [reason, setReason] = useState("");
  
  const [history, setHistory] = useState<ModHistoryLog[]>([]);
  const [statusMessage, setStatusMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem("zelo_mod_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse mod history");
      }
    }
  }, []);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guildId || !userId) {
      setStatusMessage({ type: 'error', text: "Please select a server and enter a User ID." });
      return;
    }

    setStatusMessage(null);
    const finalReason = reason.trim() || "No reason provided via dashboard.";
    
    const result = await executeAction(actionType, { guildId, userId, reason: finalReason });
    
    setStatusMessage({
      type: result.success ? 'success' : 'error',
      text: result.message
    });

    const guildName = servers?.find(s => s.id === guildId)?.name || guildId;
    
    const newLog: ModHistoryLog = {
      id: Math.random().toString(36).substring(7),
      action: actionType,
      guildName,
      userId,
      reason: finalReason,
      timestamp: Date.now(),
      success: result.success
    };

    const newHistory = [newLog, ...history].slice(0, 50); // Keep last 50
    setHistory(newHistory);
    localStorage.setItem("zelo_mod_history", JSON.stringify(newHistory));

    if (result.success) {
      setUserId("");
      setReason("");
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Moderation</h1>
        <p className="text-muted-foreground mt-1">Execute cross-server bans and kicks directly from the dashboard.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
              <div className="p-2.5 bg-destructive/10 text-destructive rounded-xl">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Execute Action</h2>
                <p className="text-sm text-muted-foreground">Bot must have permissions in the target server.</p>
              </div>
            </div>

            <form onSubmit={handleAction} className="space-y-5">
              <div>
                <Label htmlFor="server">Target Server</Label>
                <Select 
                  id="server" 
                  value={guildId} 
                  onChange={(e) => setGuildId(e.target.value)}
                  disabled={serversLoading}
                >
                  <option value="" disabled>Select a server...</option>
                  {servers?.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="userId">Target User ID</Label>
                <Input 
                  id="userId" 
                  placeholder="e.g. 123456789012345678" 
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label>Action Type</Label>
                <div className="flex gap-4">
                  <label className={`flex-1 flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${actionType === 'kick' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-secondary'}`}>
                    <input type="radio" name="action" value="kick" checked={actionType === 'kick'} onChange={() => setActionType('kick')} className="hidden" />
                    <span className="font-semibold text-lg">Kick User</span>
                  </label>
                  <label className={`flex-1 flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${actionType === 'ban' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border bg-card text-muted-foreground hover:bg-secondary'}`}>
                    <input type="radio" name="action" value="ban" checked={actionType === 'ban'} onChange={() => setActionType('ban')} className="hidden" />
                    <span className="font-semibold text-lg flex items-center gap-2"><Gavel size={18}/> Ban User</span>
                  </label>
                </div>
              </div>

              <div>
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea 
                  id="reason" 
                  placeholder="Rule violation..." 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              {statusMessage && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: "auto" }}
                  className={`p-4 rounded-xl flex items-start gap-3 ${
                    statusMessage.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  {statusMessage.type === 'success' ? <CheckCircle2 size={20} className="shrink-0 mt-0.5" /> : <AlertTriangle size={20} className="shrink-0 mt-0.5" />}
                  <p className="font-medium">{statusMessage.text}</p>
                </motion.div>
              )}

              <Button 
                type="submit" 
                className="w-full py-4 text-lg" 
                variant={actionType === 'ban' ? 'destructive' : 'primary'}
                disabled={isPending || !guildId || !userId}
              >
                {isPending ? "Executing..." : `Execute ${actionType.toUpperCase()}`}
              </Button>
            </form>
          </Card>
        </div>

        {/* History Column */}
        <div className="lg:col-span-5">
          <Card className="p-0 h-full flex flex-col max-h-[800px]">
            <div className="p-6 border-b border-border flex items-center gap-2 bg-secondary/30">
              <History className="text-muted-foreground" />
              <h2 className="text-lg font-bold text-foreground">Action History</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <p>No moderation actions have been recorded yet.</p>
                </div>
              ) : (
                history.map((log) => (
                  <motion.div 
                    key={log.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 rounded-xl border border-border bg-card relative overflow-hidden"
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${log.success ? (log.action === 'ban' ? 'bg-destructive' : 'bg-primary') : 'bg-muted'}`} />
                    
                    <div className="flex justify-between items-start pl-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            log.success 
                              ? (log.action === 'ban' ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary')
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {log.action}
                          </span>
                          {!log.success && <span className="text-xs text-destructive font-medium border border-destructive/30 px-1 rounded">FAILED</span>}
                        </div>
                        <p className="font-mono text-sm text-foreground break-all">{log.userId}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate" title={log.guildName}>in {log.guildName}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <div className="mt-3 pl-2 text-sm text-foreground bg-secondary/40 p-2 rounded border border-border/50">
                      <span className="text-muted-foreground text-xs block mb-1">Reason:</span>
                      {log.reason}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
