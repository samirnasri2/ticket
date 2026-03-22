import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Terminal, ArrowRight, Loader2, AlertCircle } from "lucide-react";

interface ConnectedGuild {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
}

interface ConnectPageProps {
  onConnect: (guild: ConnectedGuild) => void;
}

export default function ConnectPage({ onConnect }: ConnectPageProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bot/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "Invalid code. Try again.");
      } else {
        onConnect(data.guild);
      }
    } catch {
      setError("Connection failed. Make sure the bot is online.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Terminal className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">CSI Control Center</h1>
          <p className="mt-2 text-muted-foreground">
            Link your Discord server to get started.
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Enter your server code</h2>
              <p className="text-xs text-muted-foreground">Run <code className="bg-secondary px-1 py-0.5 rounded font-mono">/dashboard</code> in your Discord server to get a code</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ""))}
                placeholder="e.g. A3F9C2"
                maxLength={6}
                className="w-full px-4 py-3 text-center text-2xl font-mono font-bold tracking-widest uppercase rounded-xl border-2 border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-2 text-center">6-character code — valid for 15 minutes</p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={code.length !== 6 || loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-base transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
              ) : (
                <>Connect Server <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>

        {/* Steps */}
        <div className="mt-6 bg-secondary/40 border border-border rounded-xl p-5 space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">How it works</p>
          {[
            "Open Discord and go to your server",
            "Type /dashboard and press Enter",
            "Copy the 6-character code the bot sends you",
            "Paste it above and click Connect",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
