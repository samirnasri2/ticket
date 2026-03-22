import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  PermissionFlagsBits, EmbedBuilder,
} from "discord.js";

// In-memory config
export const welcomeConfig = new Map<string, {
  enabled: boolean; channel: string | null; message: string;
  embed: boolean; imageEnabled: boolean; bg: string | null;
  color: number; autoroles: string[];
  memberCountEnabled: boolean; memberCountChannel: string | null;
  verification: boolean; captcha: boolean; verificationRole: string | null;
}>();
export const leaveConfig = new Map<string, {
  enabled: boolean; channel: string | null; message: string;
}>();

function getWCfg(gid: string) {
  if (!welcomeConfig.has(gid)) welcomeConfig.set(gid, {
    enabled: false, channel: null, message: "Welcome {user} to {server}!",
    embed: true, imageEnabled: false, bg: null, color: 0x5865f2, autoroles: [],
    memberCountEnabled: false, memberCountChannel: null,
    verification: false, captcha: false, verificationRole: null,
  });
  return welcomeConfig.get(gid)!;
}
function getLCfg(gid: string) {
  if (!leaveConfig.has(gid)) leaveConfig.set(gid, { enabled: false, channel: null, message: "**{user}** has left the server." });
  return leaveConfig.get(gid)!;
}

// ─── /welcome ────────────────────────────────────────────────────────────────
export const welcomeCommand = new SlashCommandBuilder()
  .setName("welcome").setDescription("Welcome system configuration")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("enable").setDescription("Enable welcome messages"))
  .addSubcommand(s => s.setName("disable").setDescription("Disable welcome messages"))
  .addSubcommand(s => s.setName("message").setDescription("Set welcome message text")
    .addStringOption(o => o.setName("text").setDescription("Use {user}, {server}, {count}").setRequired(true)))
  .addSubcommand(s => s.setName("channel").setDescription("Set welcome channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true)))
  .addSubcommand(s => s.setName("embed").setDescription("Toggle embed style welcome"))
  .addSubcommand(s => s.setName("image_enable").setDescription("Enable welcome banner image"))
  .addSubcommand(s => s.setName("image_disable").setDescription("Disable welcome banner image"))
  .addSubcommand(s => s.setName("color").setDescription("Set embed color")
    .addStringOption(o => o.setName("hex").setDescription("Hex color e.g. #5865f2").setRequired(true)))
  .addSubcommand(s => s.setName("preview").setDescription("Preview the welcome message"));

export async function handleWelcome(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  const cfg = getWCfg(i.guild.id);

  if (sub === "enable") { cfg.enabled = true; return i.reply({ content: "✅ Welcome messages enabled." }); }
  if (sub === "disable") { cfg.enabled = false; return i.reply({ content: "🔴 Welcome messages disabled." }); }
  if (sub === "message") { cfg.message = i.options.getString("text", true); return i.reply({ content: `✅ Welcome message updated.` }); }
  if (sub === "channel") { cfg.channel = i.options.getChannel("channel", true).id; return i.reply({ content: `✅ Welcome channel set.` }); }
  if (sub === "embed") { cfg.embed = !cfg.embed; return i.reply({ content: `${cfg.embed ? "✅" : "🔴"} Embed style ${cfg.embed ? "on" : "off"}.` }); }
  if (sub === "image_enable") { cfg.imageEnabled = true; return i.reply({ content: "✅ Welcome image enabled." }); }
  if (sub === "image_disable") { cfg.imageEnabled = false; return i.reply({ content: "🔴 Welcome image disabled." }); }
  if (sub === "color") {
    const hex = i.options.getString("hex", true).replace("#", "");
    cfg.color = parseInt(hex, 16);
    return i.reply({ content: `✅ Color set to **#${hex}**.` });
  }
  if (sub === "preview") {
    const msg = cfg.message.replace("{user}", `**${i.user.username}**`).replace("{server}", `**${i.guild.name}**`).replace("{count}", `**${i.guild.memberCount}**`);
    const embed = new EmbedBuilder().setColor(cfg.color).setTitle(`👋 Welcome Preview`).setDescription(msg)
      .setThumbnail(i.user.displayAvatarURL()).setTimestamp();
    return i.reply({ embeds: [embed] });
  }
}

// ─── /leave ──────────────────────────────────────────────────────────────────
export const leaveCommand = new SlashCommandBuilder()
  .setName("leave").setDescription("Leave message configuration")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("enable").setDescription("Enable leave messages"))
  .addSubcommand(s => s.setName("disable").setDescription("Disable leave messages"))
  .addSubcommand(s => s.setName("message").setDescription("Set leave message")
    .addStringOption(o => o.setName("text").setDescription("Use {user}, {server}").setRequired(true)))
  .addSubcommand(s => s.setName("channel").setDescription("Set leave channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true)));

export async function handleLeave(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  const cfg = getLCfg(i.guild.id);
  if (sub === "enable") { cfg.enabled = true; return i.reply({ content: "✅ Leave messages enabled." }); }
  if (sub === "disable") { cfg.enabled = false; return i.reply({ content: "🔴 Leave messages disabled." }); }
  if (sub === "message") { cfg.message = i.options.getString("text", true); return i.reply({ content: "✅ Leave message set." }); }
  if (sub === "channel") { cfg.channel = i.options.getChannel("channel", true).id; return i.reply({ content: "✅ Leave channel set." }); }
}

// ─── /autorole ───────────────────────────────────────────────────────────────
export const autoroleCommand = new SlashCommandBuilder()
  .setName("autorole").setDescription("Auto-assign roles when members join")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand(s => s.setName("add").setDescription("Add an auto-role")
    .addRoleOption(o => o.setName("role").setDescription("Role to auto-assign").setRequired(true)))
  .addSubcommand(s => s.setName("remove").setDescription("Remove an auto-role")
    .addRoleOption(o => o.setName("role").setDescription("Role to remove").setRequired(true)))
  .addSubcommand(s => s.setName("list").setDescription("List all auto-roles"));

export async function handleAutorole(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const cfg = getWCfg(i.guild.id);
  const sub = i.options.getSubcommand();
  if (sub === "add") {
    const role = i.options.getRole("role", true);
    if (!cfg.autoroles.includes(role.id)) cfg.autoroles.push(role.id);
    return i.reply({ content: `✅ **${role.name}** will be auto-assigned to new members.` });
  }
  if (sub === "remove") {
    const role = i.options.getRole("role", true);
    cfg.autoroles = cfg.autoroles.filter(r => r !== role.id);
    return i.reply({ content: `✅ **${role.name}** removed from auto-roles.` });
  }
  if (sub === "list") {
    const list = cfg.autoroles.map(r => `<@&${r}>`).join(", ") || "No auto-roles set.";
    return i.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("🎭 Auto-Roles").setDescription(list)] });
  }
}

// ─── /membercount ─────────────────────────────────────────────────────────────
export const membercountCommand = new SlashCommandBuilder()
  .setName("membercount").setDescription("Member count channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("enable").setDescription("Enable member count channel"))
  .addSubcommand(s => s.setName("disable").setDescription("Disable member count channel"))
  .addSubcommand(s => s.setName("channel").setDescription("Set the member count channel")
    .addChannelOption(o => o.setName("channel").setDescription("Voice channel to use").setRequired(true)));

export async function handleMembercount(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const cfg = getWCfg(i.guild.id);
  const sub = i.options.getSubcommand();
  if (sub === "enable") { cfg.memberCountEnabled = true; return i.reply({ content: "✅ Member count channel enabled." }); }
  if (sub === "disable") { cfg.memberCountEnabled = false; return i.reply({ content: "🔴 Member count channel disabled." }); }
  if (sub === "channel") {
    const ch = i.options.getChannel("channel", true);
    cfg.memberCountChannel = ch.id;
    try {
      await i.guild.channels.edit(ch.id, { name: `👥 Members: ${i.guild.memberCount}` });
    } catch {}
    return i.reply({ content: `✅ Member count channel set to <#${ch.id}>.` });
  }
}

// ─── /verification ────────────────────────────────────────────────────────────
export const verificationCommand = new SlashCommandBuilder()
  .setName("verification").setDescription("Join verification system")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("enable").setDescription("Enable join verification"))
  .addSubcommand(s => s.setName("disable").setDescription("Disable join verification"))
  .addSubcommand(s => s.setName("captcha").setDescription("Toggle captcha verification"))
  .addSubcommand(s => s.setName("role").setDescription("Set verified member role")
    .addRoleOption(o => o.setName("role").setDescription("Role given after verification").setRequired(true)));

export async function handleVerification(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const cfg = getWCfg(i.guild.id);
  const sub = i.options.getSubcommand();
  if (sub === "enable") { cfg.verification = true; return i.reply({ content: "✅ Verification enabled." }); }
  if (sub === "disable") { cfg.verification = false; return i.reply({ content: "🔴 Verification disabled." }); }
  if (sub === "captcha") { cfg.captcha = !cfg.captcha; return i.reply({ content: `${cfg.captcha ? "✅" : "🔴"} Captcha ${cfg.captcha ? "enabled" : "disabled"}.` }); }
  if (sub === "role") { cfg.verificationRole = i.options.getRole("role", true).id; return i.reply({ content: "✅ Verification role set." }); }
}
