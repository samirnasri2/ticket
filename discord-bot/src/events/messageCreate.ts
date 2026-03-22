import { Message } from "discord.js";
import { db, automodSettingsTable, guildSettingsTable, serverLogsTable, moderationActionsTable } from "../lib/db.js";
import { eq } from "drizzle-orm";
import { askAI } from "../lib/ai.js";

const SCAM_PATTERNS = [/free\s*nitro/i, /discord\s*gift/i, /bit\.ly/i, /tinyurl/i, /claim.*reward/i];

export async function onMessageCreate(message: Message) {
  if (message.author.bot || !message.guild) return;

  const [automod, guildSettings] = await Promise.all([
    db.query.automodSettingsTable.findFirst({ where: eq(automodSettingsTable.guildId, message.guild.id) }),
    db.query.guildSettingsTable.findFirst({ where: eq(guildSettingsTable.guildId, message.guild.id) }),
  ]);

  if (automod?.enabled) {
    const content = message.content;

    if (automod.badWordFilter && automod.badWords) {
      const words = automod.badWords as string[];
      const found = words.some((w) => content.toLowerCase().includes(w.toLowerCase()));
      if (found) {
        await message.delete().catch(() => {});
        const warn = await message.channel.send(`⚠️ <@${message.author.id}> Your message was removed for containing prohibited words.`);
        setTimeout(() => warn.delete().catch(() => {}), 5000);
        await db.insert(serverLogsTable).values({
          guildId: message.guild.id,
          type: "automod",
          description: `Bad word filter triggered for ${message.author.tag}`,
          userId: message.author.id,
          username: message.author.tag,
        });
        return;
      }
    }

    if (automod.scamDetection) {
      const isScam = SCAM_PATTERNS.some((p) => p.test(content));
      if (isScam) {
        await message.delete().catch(() => {});
        const warn = await message.channel.send(`🚨 <@${message.author.id}> Potential scam message detected and removed.`);
        setTimeout(() => warn.delete().catch(() => {}), 5000);
        return;
      }
    }

    if (automod.linkFilter) {
      const urlPattern = /https?:\/\/[^\s]+/gi;
      if (urlPattern.test(content)) {
        await message.delete().catch(() => {});
        const warn = await message.channel.send(`🔗 <@${message.author.id}> Links are not allowed in this server.`);
        setTimeout(() => warn.delete().catch(() => {}), 5000);
        return;
      }
    }

    if (automod.capsLimit && content.length > 10) {
      const caps = content.replace(/[^A-Z]/g, "").length;
      const ratio = (caps / content.length) * 100;
      if (ratio > automod.capsLimit) {
        await message.delete().catch(() => {});
        await message.channel.send(`🔤 <@${message.author.id}> Please don't use excessive caps.`);
        return;
      }
    }
  }

  if (guildSettings?.aiEnabled && guildSettings.autoReplies && guildSettings.aiChannelId === message.channelId) {
    if (!message.content.startsWith("/")) {
      try {
        const response = await askAI([
          { role: "system", content: "You are CSI Bot, a helpful Discord bot. Keep responses under 500 characters and be friendly." },
          { role: "user", content: message.content }
        ], Math.min(guildSettings.maxResponseLength, 500));

        await message.reply(response.slice(0, 2000));
      } catch {
        // silent fail
      }
    }
  }
}
