import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import { db, moderationActionsTable, serverLogsTable } from "../lib/db.js";
import { eq, and, desc } from "drizzle-orm";

// Appeal storage (in-memory; can be persisted to DB)
const appeals = new Map<string, { id: string; userId: string; username: string; reason: string; status: "pending" | "accepted" | "denied"; createdAt: Date }[]>();
let appealChannelCache = new Map<string, string>(); // guildId → channelId

// ─── /modlogs ───────────────────────────────────────────────────────────────
export const modlogsCommand = new SlashCommandBuilder()
  .setName("modlogs").setDescription("Moderation logs management")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(s => s.setName("view").setDescription("View mod logs for a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("limit").setDescription("Number of entries").setMinValue(1).setMaxValue(50)))
  .addSubcommand(s => s.setName("clear").setDescription("Clear all mod logs for a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)))
  .addSubcommand(s => s.setName("export").setDescription("Export mod logs for a user as a text file")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)));

export async function handleModlogs(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();

  if (sub === "view") {
    const user = i.options.getUser("user", true);
    const limit = i.options.getInteger("limit") ?? 20;
    const logs = await db.select().from(moderationActionsTable)
      .where(and(eq(moderationActionsTable.guildId, i.guild.id), eq(moderationActionsTable.targetUserId, user.id)))
      .orderBy(desc(moderationActionsTable.createdAt)).limit(limit);

    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`📋 Mod Logs — ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(logs.length === 0 ? "No logs found." : logs.map(l =>
        `**${l.action.toUpperCase()}** — <t:${Math.floor(l.createdAt.getTime() / 1000)}:R>\nBy: ${l.moderatorUsername} | Reason: ${l.reason ?? "None"}${l.duration ? ` | Duration: ${l.duration}` : ""}`
      ).join("\n\n").slice(0, 4000))
      .setFooter({ text: `Total shown: ${logs.length}` });
    await i.reply({ embeds: [embed] });
  }

  else if (sub === "clear") {
    const user = i.options.getUser("user", true);
    await db.delete(moderationActionsTable)
      .where(and(eq(moderationActionsTable.guildId, i.guild.id), eq(moderationActionsTable.targetUserId, user.id)));
    await i.reply({ content: `✅ All mod logs cleared for **${user.tag}**.` });
  }

  else if (sub === "export") {
    const user = i.options.getUser("user", true);
    await i.deferReply({ ephemeral: true });
    const logs = await db.select().from(moderationActionsTable)
      .where(and(eq(moderationActionsTable.guildId, i.guild.id), eq(moderationActionsTable.targetUserId, user.id)))
      .orderBy(desc(moderationActionsTable.createdAt));

    const content = logs.length === 0 ? "No logs found." : logs.map(l =>
      `[${l.createdAt.toISOString()}] ${l.action.toUpperCase()} | By: ${l.moderatorUsername} | Reason: ${l.reason ?? "None"}${l.duration ? ` | Duration: ${l.duration}` : ""}`
    ).join("\n");

    const file = new AttachmentBuilder(Buffer.from(content), { name: `modlogs-${user.id}.txt` });
    await i.editReply({ content: `📁 Mod logs for **${user.tag}**:`, files: [file] });
  }
}

// ─── /appeal ────────────────────────────────────────────────────────────────
export const appealCommand = new SlashCommandBuilder()
  .setName("appeal").setDescription("Punishment appeal system")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(s => s.setName("setup").setDescription("Set up the appeal channel")
    .addChannelOption(o => o.setName("channel").setDescription("Appeal review channel").setRequired(true)))
  .addSubcommand(s => s.setName("list").setDescription("List all pending appeals"))
  .addSubcommand(s => s.setName("accept").setDescription("Accept an appeal")
    .addStringOption(o => o.setName("appeal_id").setDescription("Appeal ID").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)))
  .addSubcommand(s => s.setName("deny").setDescription("Deny an appeal")
    .addStringOption(o => o.setName("appeal_id").setDescription("Appeal ID").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)))
  .addSubcommand(s => s.setName("remove").setDescription("Remove an appeal from the list")
    .addStringOption(o => o.setName("appeal_id").setDescription("Appeal ID").setRequired(true)));

export async function handleAppeal(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  const guildAppeals = appeals.get(i.guild.id) ?? [];

  if (sub === "setup") {
    const channel = i.options.getChannel("channel", true);
    appealChannelCache.set(i.guild.id, channel.id);
    await i.reply({ content: `✅ Appeal channel set to ${channel}. Users can DM the bot with \`!appeal <reason>\` to submit an appeal.` });
  }

  else if (sub === "list") {
    const pending = guildAppeals.filter(a => a.status === "pending");
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle("📋 Pending Appeals")
      .setDescription(pending.length === 0 ? "No pending appeals." : pending.map(a =>
        `**ID:** \`${a.id}\`\n**User:** ${a.username}\n**Reason:** ${a.reason}\n**Submitted:** <t:${Math.floor(a.createdAt.getTime() / 1000)}:R>`
      ).join("\n\n"));
    await i.reply({ embeds: [embed] });
  }

  else if (sub === "accept") {
    const id = i.options.getString("appeal_id", true);
    const reason = i.options.getString("reason") ?? "Appeal accepted";
    const appeal = guildAppeals.find(a => a.id === id);
    if (!appeal) return i.reply({ content: "❌ Appeal not found.", ephemeral: true });
    appeal.status = "accepted";
    appeals.set(i.guild.id, guildAppeals);
    await i.reply({ content: `✅ Appeal \`${id}\` from **${appeal.username}** accepted. **Reason:** ${reason}` });
  }

  else if (sub === "deny") {
    const id = i.options.getString("appeal_id", true);
    const reason = i.options.getString("reason") ?? "Appeal denied";
    const appeal = guildAppeals.find(a => a.id === id);
    if (!appeal) return i.reply({ content: "❌ Appeal not found.", ephemeral: true });
    appeal.status = "denied";
    appeals.set(i.guild.id, guildAppeals);
    await i.reply({ content: `❌ Appeal \`${id}\` from **${appeal.username}** denied. **Reason:** ${reason}` });
  }

  else if (sub === "remove") {
    const id = i.options.getString("appeal_id", true);
    const idx = guildAppeals.findIndex(a => a.id === id);
    if (idx === -1) return i.reply({ content: "❌ Appeal not found.", ephemeral: true });
    guildAppeals.splice(idx, 1);
    appeals.set(i.guild.id, guildAppeals);
    await i.reply({ content: `✅ Appeal \`${id}\` removed.` });
  }
}

// Helper to submit an appeal (called from message event for DMs)
export function submitAppeal(guildId: string, userId: string, username: string, reason: string) {
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  const list = appeals.get(guildId) ?? [];
  list.push({ id, userId, username, reason, status: "pending", createdAt: new Date() });
  appeals.set(guildId, list);
  return id;
}

// ─── /reason ────────────────────────────────────────────────────────────────
export const reasonCommand = new SlashCommandBuilder()
  .setName("reason").setDescription("Set or edit the reason for a mod action")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(s => s.setName("set").setDescription("Set reason for a mod log entry")
    .addIntegerOption(o => o.setName("log_id").setDescription("Mod log entry ID").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)))
  .addSubcommand(s => s.setName("edit").setDescription("Edit an existing reason")
    .addIntegerOption(o => o.setName("log_id").setDescription("Mod log entry ID").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("New reason").setRequired(true)))
  .addSubcommand(s => s.setName("clear").setDescription("Clear the reason for a mod log entry")
    .addIntegerOption(o => o.setName("log_id").setDescription("Mod log entry ID").setRequired(true)));

export async function handleReason(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  const logId = i.options.getInteger("log_id", true);

  if (sub === "set" || sub === "edit") {
    const reason = i.options.getString("reason", true);
    const { sql } = await import("drizzle-orm");
    await db.update(moderationActionsTable).set({ reason }).where(eq(moderationActionsTable.id, logId));
    await i.reply({ content: `✅ Reason for log **#${logId}** ${sub === "edit" ? "updated" : "set"} to: **${reason}**` });
  }

  else if (sub === "clear") {
    await db.update(moderationActionsTable).set({ reason: null }).where(eq(moderationActionsTable.id, logId));
    await i.reply({ content: `✅ Reason cleared for log **#${logId}**.` });
  }
}
