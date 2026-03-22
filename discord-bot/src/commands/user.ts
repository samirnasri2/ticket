import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { logAction } from "./moderation.js";

// ─── /nick ──────────────────────────────────────────────────────────────────
export const nickCommand = new SlashCommandBuilder()
  .setName("nick").setDescription("Change a user's nickname")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
  .addStringOption(o => o.setName("nickname").setDescription("New nickname").setRequired(true));

export async function handleNick(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  const nickname = i.options.getString("nickname", true);
  try {
    const member = await i.guild.members.fetch(user.id);
    await member.setNickname(nickname);
    await i.reply({ content: `✅ Nickname for **${user.tag}** set to **${nickname}**.` });
  } catch { await i.reply({ content: "❌ Failed to change nickname.", ephemeral: true }); }
}

// ─── /resetnick ─────────────────────────────────────────────────────────────
export const resetnickCommand = new SlashCommandBuilder()
  .setName("resetnick").setDescription("Reset a user's nickname to their username")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true));

export async function handleResetnick(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  try {
    const member = await i.guild.members.fetch(user.id);
    await member.setNickname(null);
    await i.reply({ content: `✅ Nickname reset for **${user.tag}**.` });
  } catch { await i.reply({ content: "❌ Failed.", ephemeral: true }); }
}

// ─── /forcenick ─────────────────────────────────────────────────────────────
export const forcenickCommand = new SlashCommandBuilder()
  .setName("forcenick").setDescription("Force a permanent nickname on a user")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
  .addStringOption(o => o.setName("nickname").setDescription("Forced nickname").setRequired(true));

export async function handleForcenick(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  const nickname = i.options.getString("nickname", true);
  try {
    const member = await i.guild.members.fetch(user.id);
    await member.setNickname(nickname);
    await i.reply({ content: `🔒 Force-nickname **${nickname}** applied to **${user.tag}**.` });
  } catch { await i.reply({ content: "❌ Failed.", ephemeral: true }); }
}

// ─── /forcerole ─────────────────────────────────────────────────────────────
export const forceroleCommand = new SlashCommandBuilder()
  .setName("forcerole").setDescription("Force-assign a role to a user")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
  .addRoleOption(o => o.setName("role").setDescription("Role to force-assign").setRequired(true));

export async function handleForcerole(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  const role = i.options.getRole("role", true);
  try {
    const member = await i.guild.members.fetch(user.id);
    await member.roles.add(role.id);
    await i.reply({ content: `🔒 Force-assigned **${role.name}** to **${user.tag}**.` });
  } catch { await i.reply({ content: "❌ Failed.", ephemeral: true }); }
}

// ─── /unforcerole ───────────────────────────────────────────────────────────
export const unforceroleCommand = new SlashCommandBuilder()
  .setName("unforcerole").setDescription("Remove a force-assigned role from a user")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
  .addRoleOption(o => o.setName("role").setDescription("Role to remove").setRequired(true));

export async function handleUnforcerole(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  const role = i.options.getRole("role", true);
  try {
    const member = await i.guild.members.fetch(user.id);
    await member.roles.remove(role.id);
    await i.reply({ content: `✅ Removed force-role **${role.name}** from **${user.tag}**.` });
  } catch { await i.reply({ content: "❌ Failed.", ephemeral: true }); }
}

// ─── /jail ──────────────────────────────────────────────────────────────────
// (Assigns a "jailed" role that restricts access, removes all other roles)
const jailCache = new Map<string, string[]>(); // userId → previous role IDs

export const jailCommand = new SlashCommandBuilder()
  .setName("jail").setDescription("Jail a user (remove all roles and assign jail role)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
  .addRoleOption(o => o.setName("jail_role").setDescription("The jail role to assign").setRequired(true))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false));

export async function handleJail(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  const jailRole = i.options.getRole("jail_role", true);
  const reason = i.options.getString("reason") ?? "No reason";
  try {
    const member = await i.guild.members.fetch(user.id);
    const previousRoles = member.roles.cache.map(r => r.id).filter(id => id !== i.guild!.id);
    jailCache.set(`${i.guild.id}:${user.id}`, previousRoles);
    await member.roles.set([jailRole.id]);
    await logAction(i.guild.id, user.id, user.tag, i.user.id, i.user.tag, "jail", reason);
    await i.reply({ embeds: [new EmbedBuilder().setColor(0x747d8c).setTitle("🔒 Jailed")
      .addFields({ name: "User", value: user.tag }, { name: "Reason", value: reason }, { name: "Previous Roles", value: `${previousRoles.length} roles saved` })] });
  } catch { await i.reply({ content: "❌ Failed to jail user.", ephemeral: true }); }
}

// ─── /unjail ────────────────────────────────────────────────────────────────
export const unjailCommand = new SlashCommandBuilder()
  .setName("unjail").setDescription("Unjail a user (restore their previous roles)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true));

export async function handleUnjail(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  const key = `${i.guild.id}:${user.id}`;
  const previousRoles = jailCache.get(key);
  try {
    const member = await i.guild.members.fetch(user.id);
    if (previousRoles && previousRoles.length > 0) {
      await member.roles.set(previousRoles);
      jailCache.delete(key);
      await i.reply({ content: `✅ **${user.tag}** unjailed. ${previousRoles.length} roles restored.` });
    } else {
      await i.reply({ content: `✅ **${user.tag}** unjailed. (No previous roles cached — roles kept as-is.)` });
    }
    await logAction(i.guild.id, user.id, user.tag, i.user.id, i.user.tag, "unjail");
  } catch { await i.reply({ content: "❌ Failed.", ephemeral: true }); }
}
