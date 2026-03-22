import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  PermissionFlagsBits, EmbedBuilder, AttachmentBuilder,
} from "discord.js";
import { db, serverLogsTable } from "../lib/db.js";
import { eq, and, desc } from "drizzle-orm";

// Per-guild log channel config (in-memory)
export const logConfig = new Map<string, {
  enabled: boolean;
  channel: string | null;
  events: Record<string, boolean>;
}>();

const ALL_EVENTS = [
  "message_edit","message_delete","join","leave","ban","kick","mute","warn",
  "role_update","channel_update","emoji_update","voice_update","server_update",
  "invite_create","invite_delete","webhook","boost","nickname","avatar","username",
  "permissions","audit",
];

function getCfg(guildId: string) {
  if (!logConfig.has(guildId)) {
    const events: Record<string, boolean> = {};
    for (const e of ALL_EVENTS) events[e] = true;
    logConfig.set(guildId, { enabled: false, channel: null, events });
  }
  return logConfig.get(guildId)!;
}

export const logsCommand = new SlashCommandBuilder()
  .setName("logs").setDescription("Server event logging system")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("enable").setDescription("Enable server logging"))
  .addSubcommand(s => s.setName("disable").setDescription("Disable server logging"))
  .addSubcommand(s => s.setName("channel").setDescription("Set the log channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel to send logs to").setRequired(true)))
  .addSubcommand(s => s.setName("view").setDescription("View recent logs")
    .addIntegerOption(o => o.setName("limit").setDescription("Number of entries (1-25)").setMinValue(1).setMaxValue(25)))
  .addSubcommand(s => s.setName("config").setDescription("View logging configuration"))
  .addSubcommand(s => s.setName("clear").setDescription("Clear stored logs"))
  .addSubcommand(s => s.setName("export").setDescription("Export logs as a text file"))
  .addSubcommand(s => s.setName("message_edit").setDescription("Toggle message edit logs"))
  .addSubcommand(s => s.setName("message_delete").setDescription("Toggle message delete logs"))
  .addSubcommand(s => s.setName("join").setDescription("Toggle member join logs"))
  .addSubcommand(s => s.setName("leave").setDescription("Toggle member leave logs"))
  .addSubcommand(s => s.setName("ban").setDescription("Toggle ban logs"))
  .addSubcommand(s => s.setName("kick").setDescription("Toggle kick logs"))
  .addSubcommand(s => s.setName("mute").setDescription("Toggle mute logs"))
  .addSubcommand(s => s.setName("warn").setDescription("Toggle warn logs"))
  .addSubcommand(s => s.setName("role_update").setDescription("Toggle role update logs"))
  .addSubcommand(s => s.setName("channel_update").setDescription("Toggle channel update logs"))
  .addSubcommand(s => s.setName("voice_update").setDescription("Toggle voice activity logs"))
  .addSubcommand(s => s.setName("server_update").setDescription("Toggle server setting change logs"))
  .addSubcommand(s => s.setName("boost").setDescription("Toggle server boost logs"))
  .addSubcommand(s => s.setName("invite").setDescription("Toggle invite create/delete logs"))
  .addSubcommand(s => s.setName("audit").setDescription("Toggle audit log tracking"));

export async function handleLogs(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  const cfg = getCfg(i.guild.id);

  if (sub === "enable") { cfg.enabled = true; return i.reply({ content: "✅ Server logging **enabled**." }); }
  if (sub === "disable") { cfg.enabled = false; return i.reply({ content: "🔴 Server logging **disabled**." }); }

  if (sub === "channel") {
    const ch = i.options.getChannel("channel", true);
    cfg.channel = ch.id;
    return i.reply({ content: `✅ Log channel set to <#${ch.id}>.` });
  }

  if (sub === "config") {
    const enabledEvents = Object.entries(cfg.events).filter(([, v]) => v).map(([k]) => k);
    return i.reply({ embeds: [new EmbedBuilder().setColor(cfg.enabled ? 0x2ed573 : 0xff4757)
      .setTitle("📋 Logging Config")
      .addFields(
        { name: "Status", value: cfg.enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
        { name: "Channel", value: cfg.channel ? `<#${cfg.channel}>` : "Not set", inline: true },
        { name: "Active Events", value: `${enabledEvents.length}/${ALL_EVENTS.length}`, inline: true },
        { name: "Tracked Events", value: enabledEvents.join(", ") || "None" },
      )] });
  }

  if (sub === "view") {
    const limit = i.options.getInteger("limit") ?? 10;
    const logs = await db.select().from(serverLogsTable)
      .where(eq(serverLogsTable.guildId, i.guild.id))
      .orderBy(desc(serverLogsTable.createdAt)).limit(limit);
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle("📋 Recent Server Logs")
      .setDescription(logs.length === 0 ? "No logs." : logs.map(l =>
        `**${l.type.toUpperCase()}** <t:${Math.floor(l.createdAt.getTime() / 1000)}:R>\n${l.description.slice(0, 150)}`
      ).join("\n\n").slice(0, 4000));
    return i.reply({ embeds: [embed] });
  }

  if (sub === "clear") {
    await db.delete(serverLogsTable).where(eq(serverLogsTable.guildId, i.guild.id));
    return i.reply({ content: "✅ All server logs cleared." });
  }

  if (sub === "export") {
    await i.deferReply({ ephemeral: true });
    const logs = await db.select().from(serverLogsTable)
      .where(eq(serverLogsTable.guildId, i.guild.id))
      .orderBy(desc(serverLogsTable.createdAt)).limit(500);
    const content = logs.map(l =>
      `[${l.createdAt.toISOString()}] [${l.type.toUpperCase()}] ${l.description}`
    ).join("\n");
    const file = new AttachmentBuilder(Buffer.from(content || "No logs"), { name: "server-logs.txt" });
    return i.editReply({ files: [file] });
  }

  // Toggle individual events
  if (ALL_EVENTS.includes(sub) || ["message_edit","message_delete","role_update","channel_update","voice_update","server_update","invite"].includes(sub)) {
    const eventKey = sub === "invite" ? "invite_create" : sub;
    if (eventKey in cfg.events) {
      cfg.events[eventKey] = !cfg.events[eventKey];
      return i.reply({ content: `${cfg.events[eventKey] ? "✅" : "🔴"} **${eventKey.replace("_", " ")}** logs ${cfg.events[eventKey] ? "enabled" : "disabled"}.` });
    }
    const key = sub;
    if (key in cfg.events) {
      cfg.events[key] = !cfg.events[key];
      return i.reply({ content: `${cfg.events[key] ? "✅" : "🔴"} **${key}** logs toggled.` });
    }
  }

  // fallback toggle for anything else
  const k = sub.replace(/-/g, "_");
  if (k in cfg.events) {
    cfg.events[k] = !cfg.events[k];
    return i.reply({ content: `${cfg.events[k] ? "✅" : "🔴"} **${sub}** logging ${cfg.events[k] ? "enabled" : "disabled"}.` });
  }

  return i.reply({ content: "✅ Log setting updated.", ephemeral: true });
}
