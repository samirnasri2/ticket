import "dotenv/config";
import {
  Client, GatewayIntentBits, Partials, Events,
  ChatInputCommandInteraction, ButtonInteraction,
} from "discord.js";
import { db, giveawaysTable } from "./lib/db.js";
import { eq } from "drizzle-orm";
import { cleanExpiredTokens } from "./lib/dashboard.js";

// Moderation
import { handleBan, handleUnban, handleKick, handleSoftban, handleHardban, handleTimeout, handleUntimeout, handleMute, handleUnmute } from "./commands/moderation.js";
// Warn
import { handleWarn, handleWarnings } from "./commands/warn.js";
// Purge/Clear
import { handlePurge, handleClear } from "./commands/purge.js";
// Channel
import { handleLock, handleUnlock, handleLockdown, handleUnlockdown, handleSlowmode, handleHideChannel, handleShowChannel, handleArchiveChannel, handleUnarchiveChannel, handleCloneChannel, handleCloneCategory } from "./commands/channel.js";
// Mass
import { handleMassban, handleMasskick, handleMassmute, handleMoveAll, handleDisconnectAll } from "./commands/mass.js";
// Role
import { handleRole } from "./commands/role.js";
// User
import { handleNick, handleResetnick, handleForcenick, handleForcerole, handleUnforcerole, handleJail, handleUnjail } from "./commands/user.js";
// Logs
import { handleModlogs, handleAppeal, handleReason } from "./commands/logs.js";
// AI
import { handleAI, handleTranslate, handleSummarize, handleCode } from "./commands/ai.js";
// Giveaway
import { handleGiveaway } from "./commands/giveaway.js";
// Utility
import { handlePing, handleServerInfo, handleUserInfo, handleAvatar, handlePoll, handle8Ball, handleCoinflip, handleJoke } from "./commands/utility.js";
// Dashboard
import { handleDashboard } from "./commands/dashboard.js";
// Events
import { onGuildMemberAdd } from "./events/guildMemberAdd.js";
import { onGuildMemberRemove } from "./events/guildMemberRemove.js";
import { onMessageCreate } from "./events/messageCreate.js";

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("DISCORD_BOT_TOKEN is required");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ CSI Bot is online as ${c.user.tag}`);
  c.user.setActivity("your server | /ai /ban /dashboard", { type: 0 });
  setInterval(() => cleanExpiredTokens().catch(console.error), 5 * 60 * 1000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    // Button interactions
    if (interaction.isButton()) {
      const b = interaction as ButtonInteraction;
      if (b.customId.startsWith("giveaway_enter_")) {
        const id = parseInt(b.customId.split("_")[2]);
        const giveaway = await db.query.giveawaysTable.findFirst({ where: eq(giveawaysTable.id, id) });
        if (!giveaway || giveaway.status !== "active") return b.reply({ content: "This giveaway is no longer active.", ephemeral: true });
        const participants = giveaway.participants as string[];
        if (participants.includes(b.user.id)) return b.reply({ content: "You are already entered!", ephemeral: true });
        await db.update(giveawaysTable).set({ participants: [...participants, b.user.id] }).where(eq(giveawaysTable.id, id));
        await b.reply({ content: `🎉 You entered the giveaway for **${giveaway.prize}**! Good luck!`, ephemeral: true });
      }
    }
    return;
  }

  const i = interaction as ChatInputCommandInteraction;
  try {
    switch (i.commandName) {
      // ── Moderation ─────────────────────────────────────────────────────────
      case "ban":           return await handleBan(i);
      case "unban":         return await handleUnban(i);
      case "kick":          return await handleKick(i);
      case "softban":       return await handleSoftban(i);
      case "hardban":       return await handleHardban(i);
      case "timeout":       return await handleTimeout(i);
      case "untimeout":     return await handleUntimeout(i);
      case "mute":          return await handleMute(i);
      case "unmute":        return await handleUnmute(i);
      // ── Warn ───────────────────────────────────────────────────────────────
      case "warn":          return await handleWarn(i);
      case "warnings":      return await handleWarnings(i);
      // ── Purge/Clear ────────────────────────────────────────────────────────
      case "purge":         return await handlePurge(i);
      case "clear":         return await handleClear(i);
      // ── Channel ────────────────────────────────────────────────────────────
      case "lock":          return await handleLock(i);
      case "unlock":        return await handleUnlock(i);
      case "lockdown":      return await handleLockdown(i);
      case "unlockdown":    return await handleUnlockdown(i);
      case "slowmode":      return await handleSlowmode(i);
      case "hidechannel":   return await handleHideChannel(i);
      case "showchannel":   return await handleShowChannel(i);
      case "archivechannel":  return await handleArchiveChannel(i);
      case "unarchivechannel":return await handleUnarchiveChannel(i);
      case "clonechannel":  return await handleCloneChannel(i);
      case "clonecategory": return await handleCloneCategory(i);
      // ── Mass ───────────────────────────────────────────────────────────────
      case "massban":       return await handleMassban(i);
      case "masskick":      return await handleMasskick(i);
      case "massmute":      return await handleMassmute(i);
      case "moveall":       return await handleMoveAll(i);
      case "disconnectall": return await handleDisconnectAll(i);
      // ── Role ───────────────────────────────────────────────────────────────
      case "role":          return await handleRole(i);
      // ── User ───────────────────────────────────────────────────────────────
      case "nick":          return await handleNick(i);
      case "resetnick":     return await handleResetnick(i);
      case "forcenick":     return await handleForcenick(i);
      case "forcerole":     return await handleForcerole(i);
      case "unforcerole":   return await handleUnforcerole(i);
      case "jail":          return await handleJail(i);
      case "unjail":        return await handleUnjail(i);
      // ── Logs ───────────────────────────────────────────────────────────────
      case "modlogs":       return await handleModlogs(i);
      case "appeal":        return await handleAppeal(i);
      case "reason":        return await handleReason(i);
      // ── AI ─────────────────────────────────────────────────────────────────
      case "ai":            return await handleAI(i);
      case "translate":     return await handleTranslate(i);
      case "summarize":     return await handleSummarize(i);
      case "code":          return await handleCode(i);
      // ── Giveaway ───────────────────────────────────────────────────────────
      case "giveaway":      return await handleGiveaway(i);
      // ── Utility ────────────────────────────────────────────────────────────
      case "ping":          return await handlePing(i);
      case "serverinfo":    return await handleServerInfo(i);
      case "userinfo":      return await handleUserInfo(i);
      case "avatar":        return await handleAvatar(i);
      case "poll":          return await handlePoll(i);
      case "8ball":         return await handle8Ball(i);
      case "coinflip":      return await handleCoinflip(i);
      case "joke":          return await handleJoke(i);
      // ── Dashboard ──────────────────────────────────────────────────────────
      case "dashboard":     return await handleDashboard(i);
      default:
        if (!i.replied) await i.reply({ content: "❓ Unknown command.", ephemeral: true });
    }
  } catch (err) {
    console.error(`Error in /${i.commandName}:`, err);
    const msg = { content: "❌ An error occurred.", ephemeral: true };
    if (i.replied || i.deferred) await i.editReply(msg).catch(() => {});
    else await i.reply(msg).catch(() => {});
  }
});

client.on(Events.GuildMemberAdd, onGuildMemberAdd);
client.on(Events.GuildMemberRemove, onGuildMemberRemove);
client.on(Events.MessageCreate, onMessageCreate);

await client.login(MTQ3NzA1NTc0MzQzNjkxODg5NQ.GGA4no.QUu3Nu1gUMp2PrXLbIJIySbdipECUKRTGV_K7E);
