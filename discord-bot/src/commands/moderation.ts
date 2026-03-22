import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { db, moderationActionsTable, serverLogsTable } from "../lib/db.js";
import { eq, and } from "drizzle-orm";

const C_OK = 0x2ed573;
const C_WARN = 0xffa502;
const C_ERR = 0xff4757;
const C_INFO = 0x5865f2;

export async function logAction(
  guildId: string, targetUserId: string, targetUsername: string,
  moderatorId: string, moderatorUsername: string,
  action: string, reason?: string, duration?: string
) {
  await db.insert(moderationActionsTable).values({
    guildId, targetUserId, targetUsername, moderatorId, moderatorUsername, action,
    reason: reason ?? null, duration: duration ?? null,
  });
  await db.insert(serverLogsTable).values({
    guildId, type: "moderation",
    description: `${action.toUpperCase()}: ${targetUsername} by ${moderatorUsername}${reason ? ` — ${reason}` : ""}`,
    userId: moderatorId, username: moderatorUsername,
    metadata: { targetUserId, targetUsername, action, reason, duration },
  });
}

// ─── /ban ───────────────────────────────────────────────────────────────────
export const banCommand = new SlashCommandBuilder()
  .setName("ban").setDescription("Ban a user from the server")
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
  .addIntegerOption(o => o.setName("delete_days").setDescription("Days of messages to delete (0-7)").setMinValue(0).setMaxValue(7));

export async function handleBan(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  const reason = i.options.getString("reason") ?? "No reason provided";
  const days = i.options.getInteger("delete_days") ?? 0;
  try {
    await i.guild.members.ban(user.id, { reason, deleteMessageDays: days });
    await logAction(i.guild.id, user.id, user.tag, i.user.id, i.user.tag, "ban", reason);
    await i.reply({ embeds: [new EmbedBuilder().setColor(C_OK).setTitle("🔨 Banned").addFields({ name: "User", value: `${user.tag}` }, { name: "Reason", value: reason }).setTimestamp()] });
  } catch { await i.reply({ content: "❌ Failed to ban user.", ephemeral: true }); }
}

// ─── /unban ─────────────────────────────────────────────────────────────────
export const unbanCommand = new SlashCommandBuilder()
  .setName("unban").setDescription("Unban a user")
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addStringOption(o => o.setName("user_id").setDescription("User ID to unban").setRequired(true))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false));

export async function handleUnban(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const userId = i.options.getString("user_id", true);
  const reason = i.options.getString("reason") ?? "No reason";
  try {
    const banned = await i.guild.bans.fetch(userId);
    await i.guild.members.unban(userId, reason);
    await logAction(i.guild.id, userId, banned.user.tag, i.user.id, i.user.tag, "unban", reason);
    await i.reply({ embeds: [new EmbedBuilder().setColor(C_OK).setTitle("✅ Unbanned").setDescription(`**${banned.user.tag}** has been unbanned.`)] });
  } catch { await i.reply({ content: "❌ User not found in ban list.", ephemeral: true }); }
}

// ─── /kick ──────────────────────────────────────────────────────────────────
export const kickCommand = new SlashCommandBuilder()
  .setName("kick").setDescription("Kick a user from the server")
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false));

export async function handleKick(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  const reason = i.options.getString("reason") ?? "No reason provided";
  try {
    const member = await i.guild.members.fetch(user.id);
    await member.kick(reason);
    await logAction(i.guild.id, user.id, user.tag, i.user.id, i.user.tag, "kick", reason);
    await i.reply({ embeds: [new EmbedBuilder().setColor(C_OK).setTitle("👢 Kicked").addFields({ name: "User", value: user.tag }, { name: "Reason", value: reason })] });
  } catch { await i.reply({ content: "❌ Failed to kick.", ephemeral: true }); }
}

// ─── /softban ───────────────────────────────────────────────────────────────
export const softbanCommand = new SlashCommandBuilder()
  .setName("softban").setDescription("Softban (ban+unban to delete messages)")
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
  .addIntegerOption(o => o.setName("delete_days").setDescription("Days to delete (1-7)").setMinValue(1).setMaxValue(7));

export async function handleSoftban(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  const reason = i.options.getString("reason") ?? "Softban";
  const days = i.options.getInteger("delete_days") ?? 7;
  try {
    await i.guild.members.ban(user.id, { reason, deleteMessageDays: days });
    await i.guild.members.unban(user.id, "Softban unban");
    await logAction(i.guild.id, user.id, user.tag, i.user.id, i.user.tag, "softban", reason);
    await i.reply({ embeds: [new EmbedBuilder().setColor(C_WARN).setTitle("🧹 Softbanned").setDescription(`**${user.tag}** was softbanned. Messages deleted, user can rejoin.`)] });
  } catch { await i.reply({ content: "❌ Failed.", ephemeral: true }); }
}

// ─── /hardban ───────────────────────────────────────────────────────────────
export const hardbanCommand = new SlashCommandBuilder()
  .setName("hardban").setDescription("Permanently ban with 7-day message deletion")
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false));

export async function handleHardban(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  const reason = i.options.getString("reason") ?? "Hardban";
  try {
    await i.guild.members.ban(user.id, { reason, deleteMessageDays: 7 });
    await logAction(i.guild.id, user.id, user.tag, i.user.id, i.user.tag, "hardban", reason);
    await i.reply({ embeds: [new EmbedBuilder().setColor(C_ERR).setTitle("🔒 Hardbanned").setDescription(`**${user.tag}** permanently banned with 7 days of messages deleted.`)] });
  } catch { await i.reply({ content: "❌ Failed.", ephemeral: true }); }
}

// ─── /timeout ───────────────────────────────────────────────────────────────
export const timeoutCommand = new SlashCommandBuilder()
  .setName("timeout").setDescription("Timeout a user")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(sub => sub.setName("set").setDescription("Set a timeout on a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("duration").setDescription("Duration in minutes (1-40320)").setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)));

export async function handleTimeout(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  if (sub === "set") {
    const user = i.options.getUser("user", true);
    const dur = i.options.getInteger("duration", true);
    const reason = i.options.getString("reason") ?? "No reason";
    try {
      const member = await i.guild.members.fetch(user.id);
      await member.timeout(dur * 60 * 1000, reason);
      await logAction(i.guild.id, user.id, user.tag, i.user.id, i.user.tag, "timeout", reason, `${dur}m`);
      await i.reply({ embeds: [new EmbedBuilder().setColor(C_WARN).setTitle("⏰ Timed Out").addFields({ name: "User", value: user.tag }, { name: "Duration", value: `${dur} minutes` }, { name: "Reason", value: reason })] });
    } catch { await i.reply({ content: "❌ Failed.", ephemeral: true }); }
  }
}

// ─── /untimeout ─────────────────────────────────────────────────────────────
export const untimeoutCommand = new SlashCommandBuilder()
  .setName("untimeout").setDescription("Remove timeout from a user")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true));

export async function handleUntimeout(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  try {
    const member = await i.guild.members.fetch(user.id);
    await member.timeout(null);
    await logAction(i.guild.id, user.id, user.tag, i.user.id, i.user.tag, "untimeout");
    await i.reply({ content: `✅ Timeout removed from **${user.tag}**.` });
  } catch { await i.reply({ content: "❌ Failed.", ephemeral: true }); }
}

// ─── /mute ──────────────────────────────────────────────────────────────────
export const muteCommand = new SlashCommandBuilder()
  .setName("mute").setDescription("Mute a member (timeout) or set mute role")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(sub => sub.setName("member").setDescription("Mute a member")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("duration").setDescription("Duration in minutes").setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)))
  .addSubcommand(sub => sub.setName("role").setDescription("Set the mute role for this server")
    .addRoleOption(o => o.setName("role").setDescription("Role to use as mute role").setRequired(true)));

export async function handleMute(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  if (sub === "member") {
    const user = i.options.getUser("user", true);
    const dur = i.options.getInteger("duration", true);
    const reason = i.options.getString("reason") ?? "No reason";
    try {
      const member = await i.guild.members.fetch(user.id);
      await member.timeout(dur * 60 * 1000, reason);
      await logAction(i.guild.id, user.id, user.tag, i.user.id, i.user.tag, "mute", reason, `${dur}m`);
      await i.reply({ embeds: [new EmbedBuilder().setColor(C_WARN).setTitle("🔇 Muted").addFields({ name: "User", value: user.tag }, { name: "Duration", value: `${dur} minutes` }, { name: "Reason", value: reason })] });
    } catch { await i.reply({ content: "❌ Failed.", ephemeral: true }); }
  } else if (sub === "role") {
    const role = i.options.getRole("role", true);
    await i.reply({ content: `✅ Mute role set to **${role.name}**. Note: Role-based muting requires manual application.` });
  }
}

// ─── /unmute ────────────────────────────────────────────────────────────────
export const unmuteCommand = new SlashCommandBuilder()
  .setName("unmute").setDescription("Unmute a member or configure unmute role")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(sub => sub.setName("member").setDescription("Unmute a member")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)))
  .addSubcommand(sub => sub.setName("role").setDescription("Clear the configured mute role")
    .addRoleOption(o => o.setName("role").setDescription("Role to remove from user").setRequired(true))
    .addUserOption(o => o.setName("user").setDescription("User to remove role from").setRequired(true)));

export async function handleUnmute(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  if (sub === "member") {
    const user = i.options.getUser("user", true);
    try {
      const member = await i.guild.members.fetch(user.id);
      await member.timeout(null);
      await logAction(i.guild.id, user.id, user.tag, i.user.id, i.user.tag, "unmute");
      await i.reply({ content: `✅ **${user.tag}** has been unmuted.` });
    } catch { await i.reply({ content: "❌ Failed.", ephemeral: true }); }
  } else if (sub === "role") {
    const role = i.options.getRole("role", true);
    const user = i.options.getUser("user", true);
    try {
      const member = await i.guild.members.fetch(user.id);
      await member.roles.remove(role.id);
      await i.reply({ content: `✅ Removed **${role.name}** from **${user.tag}**.` });
    } catch { await i.reply({ content: "❌ Failed.", ephemeral: true }); }
  }
}
