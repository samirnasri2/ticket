import { useState, useEffect, useCallback } from "react";

// --- Types ---
export interface BotStats {
  online: boolean;
  tag: string;
  serverCount: number;
  totalMembers: number;
  uptime: number;
}

export interface DiscordServer {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  ownerId: string;
}

export interface ModActionPayload {
  guildId: string;
  userId: string;
  reason: string;
}

export interface ModActionResponse {
  success: boolean;
  message: string;
}

// --- Hooks ---

/**
 * Fetches bot stats and polls every 30 seconds
 */
export function useBotStats() {
  const [data, setData] = useState<BotStats | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async (isSubsequent = false) => {
    if (!isSubsequent) setIsLoading(true);
    try {
      const res = await fetch("/api/bot/stats");
      if (!res.ok) {
        // Fallback mock if endpoint is missing
        if (res.status === 404) {
           throw new Error("Stats endpoint not found (/bot/stats). Is the bot running?");
        }
        throw new Error(`Failed to fetch stats: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const intervalId = setInterval(() => fetchStats(true), 30000);
    return () => clearInterval(intervalId);
  }, [fetchStats]);

  return { data, error, isLoading, refetch: fetchStats };
}

/**
 * Fetches the list of servers the bot is in
 */
export function useBotServers() {
  const [data, setData] = useState<DiscordServer[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchServers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/bot/servers");
      if (!res.ok) {
        throw new Error(`Failed to fetch servers: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  return { data, error, isLoading, refetch: fetchServers };
}

/**
 * Moderation actions (Ban/Kick)
 */
export function useModeration() {
  const [isPending, setIsPending] = useState(false);

  const executeAction = async (action: "ban" | "kick", payload: ModActionPayload): Promise<ModActionResponse> => {
    setIsPending(true);
    try {
      const res = await fetch(`/api/bot/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      
      const json = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        throw new Error(json.message || `Failed to ${action} user`);
      }
      
      return { success: true, message: json.message || `Successfully executed ${action}.` };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    } finally {
      setIsPending(false);
    }
  };

  return { executeAction, isPending };
}
