import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { db, moderationActionsTable } from "../lib/db.js";
import { eq, and, count } from "drizzle-orm";
import { logAction } from "./moderation.js";

// Per-guild warning limits stored in memory (could be persisted to DB)
const warnLimits = new Map<string, { limit: number; action: string }>();

export const warnCommand = new SlashCommandBuilder()
  .setName("warn").setDescription("Warning management")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(sub => sub.setName("add").setDescription("Warn a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)))
  .addSubcommand(sub => sub.setName("remove").setDescription("Remove a warning (unwarn)")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("id").setDescription("Warning DB ID to remove").setRequired(false)))
  .addSubcommand(sub => sub.setName("list").setDescription("View warnings for a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)))
  .addSubcommand(sub => sub.setName("reset").setDescription("Clear all warnings for a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)))
  .addSubcommand(sub => sub.setName("setlimit").setDescription("Set auto-punishment threshold")
    .addIntegerOption(o => o.setName("count").setDescription("Warnings before action").setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName("action").setDescription("Action: kick, mute, ban").setRequired(true)
      .addChoices({ name: "Kick", value: "kick" }, { name: "Mute (1 hour)", value: "mute" }, { name: "Ban", value: "ban" })))
  .addSubcommand(sub => sub.setName("removelimit").setDescription("Remove auto-punishment threshold"));

export async function handleWarn(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();

  if (sub === "add") {
    const user = i.options.getUser("user", true);
    const reason = i.options.getString("reason", true);
    await logAction(i.guild.id, user.id, user.tag, i.user.id, i.user.tag, "warn", reason);

    // Count warnings and check limit
    const warnings = await db.select().from(moderationActionsTable)
      .where(and(eq(moderationActionsTable.guildId, i.guild.id), eq(moderationActionsTable.targetUserId, user.id), eq(moderationActionsTable.action, "warn")));

    const limitConfig = warnLimits.get(i.guild.id);
    let limitNote = "";

    if (limitConfig && warnings.length >= limitConfig.limit) {
      limitNote = `\n⚠️ Warning limit reached (${limitConfig.limit})! Auto-action: **${limitConfig.action}**.`;
      try {
        const member = await i.guild.members.fetch(user.id);
        if (limitConfig.action === "kick") await member.kick("Auto-kick: warning limit");
        else if (limitConfig.action === "mute") await member.timeout(60 * 60 * 1000, "Auto-mute: warning limit");
        else if (limitConfig.action === "ban") await i.guild.members.ban(user.id, { reason: "Auto-ban: warning limit" });
      } catch {}
    }

    await i.reply({ embeds: [new EmbedBuilder().setColor(0xffa502).setTitle("⚠️ Warning Issued")
      .addFields({ name: "User", value: user.tag }, { name: "Warnings Total", value: warnings.length.toString() }, { name: "Reason", value: reason + limitNote })
      .setTimestamp()] });
  }

  else if (sub === "remove") {
    const user = i.options.getUser("user", true);
    const id = i.options.getInteger("id");
    const warnings = await db.select().from(moderationActionsTable)
      .where(and(eq(moderationActionsTable.guildId, i.guild.id), eq(moderationActionsTable.targetUserId, user.id), eq(moderationActionsTable.action, "warn")));

    if (warnings.length === 0) return i.reply({ content: "No warnings found for this user.", ephemeral: true });

    const toRemove = id ? warnings.find(w => w.id === id) : warnings[warnings.length - 1];
    if (!toRemove) return i.reply({ content: "Warning not found.", ephemeral: true });

    const { sql } = await import("drizzle-orm");
    await db.delete(moderationActionsTable).where(eq(moderationActionsTable.id, toRemove.id));
    await i.reply({ content: `✅ Warning removed from **${user.tag}**. They now have ${warnings.length - 1} warning(s).` });
  }

  else if (sub === "list") {
    const user = i.options.getUser("user", true);
    const warnings = await db.select().from(moderationActionsTable)
      .where(and(eq(moderationActionsTable.guildId, i.guild.id), eq(moderationActionsTable.targetUserId, user.id), eq(moderationActionsTable.action, "warn")));

    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`⚠️ Warnings — ${user.tag}`)
      .setDescription(warnings.length === 0 ? "No warnings." : warnings.slice(0, 10).map((w, idx) =>
        `**#${w.id}** — ${w.reason ?? "No reason"} <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`
      ).join("\n"))
      .setFooter({ text: `Total: ${warnings.length}` });
    await i.reply({ embeds: [embed] });
  }

  else if (sub === "reset") {
    const user = i.options.getUser("user", true);
    await db.delete(moderationActionsTable).where(
      and(eq(moderationActionsTable.guildId, i.guild.id), eq(moderationActionsTable.targetUserId, user.id), eq(moderationActionsTable.action, "warn"))
    );
    await logAction(i.guild.id, user.id, user.tag, i.user.id, i.user.tag, "warn_reset");
    await i.reply({ content: `✅ All warnings cleared for **${user.tag}**.` });
  }

  else if (sub === "setlimit") {
    const count = i.options.getInteger("count", true);
    const action = i.options.getString("action", true);
    warnLimits.set(i.guild.id, { limit: count, action });
    await i.reply({ content: `✅ Auto-punishment set: after **${count}** warnings, action: **${action}**.` });
  }

  else if (sub === "removelimit") {
    warnLimits.delete(i.guild.id);
    await i.reply({ content: "✅ Warning limit removed." });
  }
}

// Alias: /warnings → /warn list
export const warningsCommand = new SlashCommandBuilder()
  .setName("warnings").setDescription("View warnings for a user")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true));

export async function handleWarnings(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  const warnings = await db.select().from(moderationActionsTable)
    .where(and(eq(moderationActionsTable.guildId, i.guild.id), eq(moderationActionsTable.targetUserId, user.id), eq(moderationActionsTable.action, "warn")));
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`⚠️ Warnings — ${user.tag}`)
    .setDescription(warnings.length === 0 ? "No warnings." : warnings.slice(0, 10).map((w, idx) =>
      `**#${w.id}** — ${w.reason ?? "No reason"} <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`
    ).join("\n")).setFooter({ text: `Total: ${warnings.length}` });
  await i.reply({ embeds: [embed] });
}
