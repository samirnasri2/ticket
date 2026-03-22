import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  VoiceChannel,
  ChannelType,
} from "discord.js";
import { logAction } from "./moderation.js";

// ─── /massban ───────────────────────────────────────────────────────────────
export const massbanCommand = new SlashCommandBuilder()
  .setName("massban").setDescription("Ban multiple users by user IDs")
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addStringOption(o => o.setName("user_ids").setDescription("Space or comma-separated user IDs").setRequired(true))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false));

export async function handleMassban(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const raw = i.options.getString("user_ids", true);
  const reason = i.options.getString("reason") ?? "Massban";
  const ids = raw.split(/[\s,]+/).filter(id => /^\d{17,20}$/.test(id));
  if (ids.length === 0) return i.reply({ content: "❌ No valid user IDs provided.", ephemeral: true });
  await i.deferReply();
  let success = 0, failed = 0;
  for (const id of ids) {
    try {
      await i.guild.members.ban(id, { reason, deleteMessageDays: 1 });
      await logAction(i.guild.id, id, id, i.user.id, i.user.tag, "ban", `Massban: ${reason}`);
      success++;
    } catch { failed++; }
  }
  await i.editReply({ embeds: [new EmbedBuilder().setColor(0xff4757).setTitle("🔨 Massban Complete")
    .addFields({ name: "Banned", value: success.toString(), inline: true }, { name: "Failed", value: failed.toString(), inline: true }, { name: "Reason", value: reason })] });
}

// ─── /masskick ──────────────────────────────────────────────────────────────
export const masskickCommand = new SlashCommandBuilder()
  .setName("masskick").setDescription("Kick multiple users by user IDs")
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addStringOption(o => o.setName("user_ids").setDescription("Space or comma-separated user IDs").setRequired(true))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false));

export async function handleMasskick(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const raw = i.options.getString("user_ids", true);
  const reason = i.options.getString("reason") ?? "Masskick";
  const ids = raw.split(/[\s,]+/).filter(id => /^\d{17,20}$/.test(id));
  if (ids.length === 0) return i.reply({ content: "❌ No valid user IDs provided.", ephemeral: true });
  await i.deferReply();
  let success = 0, failed = 0;
  for (const id of ids) {
    try {
      const member = await i.guild.members.fetch(id);
      await member.kick(reason);
      await logAction(i.guild.id, id, member.user.tag, i.user.id, i.user.tag, "kick", `Masskick: ${reason}`);
      success++;
    } catch { failed++; }
  }
  await i.editReply({ embeds: [new EmbedBuilder().setColor(0xffa502).setTitle("👢 Masskick Complete")
    .addFields({ name: "Kicked", value: success.toString(), inline: true }, { name: "Failed", value: failed.toString(), inline: true })] });
}

// ─── /massmute ──────────────────────────────────────────────────────────────
export const massmuteCommand = new SlashCommandBuilder()
  .setName("massmute").setDescription("Timeout multiple users by user IDs")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addStringOption(o => o.setName("user_ids").setDescription("Space or comma-separated user IDs").setRequired(true))
  .addIntegerOption(o => o.setName("duration").setDescription("Duration in minutes").setRequired(true).setMinValue(1).setMaxValue(40320))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false));

export async function handleMassmute(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const raw = i.options.getString("user_ids", true);
  const duration = i.options.getInteger("duration", true);
  const reason = i.options.getString("reason") ?? "Massmute";
  const ids = raw.split(/[\s,]+/).filter(id => /^\d{17,20}$/.test(id));
  if (ids.length === 0) return i.reply({ content: "❌ No valid IDs.", ephemeral: true });
  await i.deferReply();
  let success = 0, failed = 0;
  for (const id of ids) {
    try {
      const member = await i.guild.members.fetch(id);
      await member.timeout(duration * 60 * 1000, reason);
      await logAction(i.guild.id, id, member.user.tag, i.user.id, i.user.tag, "mute", `Massmute: ${reason}`, `${duration}m`);
      success++;
    } catch { failed++; }
  }
  await i.editReply({ embeds: [new EmbedBuilder().setColor(0xffa502).setTitle("🔇 Massmute Complete")
    .addFields({ name: "Muted", value: success.toString(), inline: true }, { name: "Failed", value: failed.toString(), inline: true }, { name: "Duration", value: `${duration} minutes` })] });
}

// ─── /moveall ───────────────────────────────────────────────────────────────
export const moveallCommand = new SlashCommandBuilder()
  .setName("moveall").setDescription("Move all users from one voice channel to another")
  .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
  .addChannelOption(o => o.setName("from").setDescription("Source voice channel").setRequired(true))
  .addChannelOption(o => o.setName("to").setDescription("Destination voice channel").setRequired(true));

export async function handleMoveAll(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const from = i.options.getChannel("from") as VoiceChannel;
  const to = i.options.getChannel("to") as VoiceChannel;
  if (!from || from.type !== ChannelType.GuildVoice) return i.reply({ content: "❌ Invalid source channel.", ephemeral: true });
  if (!to || to.type !== ChannelType.GuildVoice) return i.reply({ content: "❌ Invalid destination channel.", ephemeral: true });
  await i.deferReply();
  const members = from.members;
  let moved = 0;
  for (const [, member] of members) {
    try { await member.voice.setChannel(to); moved++; } catch {}
  }
  await i.editReply(`✅ Moved **${moved}** member(s) from **${from.name}** to **${to.name}**.`);
}

// ─── /disconnectall ─────────────────────────────────────────────────────────
export const disconnectallCommand = new SlashCommandBuilder()
  .setName("disconnectall").setDescription("Disconnect all users from a voice channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
  .addChannelOption(o => o.setName("channel").setDescription("Voice channel to clear").setRequired(true));

export async function handleDisconnectAll(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const ch = i.options.getChannel("channel") as VoiceChannel;
  if (!ch || ch.type !== ChannelType.GuildVoice) return i.reply({ content: "❌ Invalid voice channel.", ephemeral: true });
  await i.deferReply();
  const members = ch.members;
  let disconnected = 0;
  for (const [, member] of members) {
    try { await member.voice.disconnect(); disconnected++; } catch {}
  }
  await i.editReply(`✅ Disconnected **${disconnected}** member(s) from **${ch.name}**.`);
}
