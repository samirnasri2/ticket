import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";

export const roleCommand = new SlashCommandBuilder()
  .setName("role").setDescription("Role management")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand(s => s.setName("add").setDescription("Add a role to a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)))
  .addSubcommand(s => s.setName("remove").setDescription("Remove a role from a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)))
  .addSubcommand(s => s.setName("create").setDescription("Create a new role")
    .addStringOption(o => o.setName("name").setDescription("Role name").setRequired(true))
    .addStringOption(o => o.setName("color").setDescription("Color hex (e.g. #ff0000)").setRequired(false))
    .addBooleanOption(o => o.setName("hoist").setDescription("Display separately?").setRequired(false))
    .addBooleanOption(o => o.setName("mentionable").setDescription("Mentionable?").setRequired(false)))
  .addSubcommand(s => s.setName("delete").setDescription("Delete a role")
    .addRoleOption(o => o.setName("role").setDescription("Role to delete").setRequired(true)))
  .addSubcommand(s => s.setName("rename").setDescription("Rename a role")
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))
    .addStringOption(o => o.setName("name").setDescription("New name").setRequired(true)))
  .addSubcommand(s => s.setName("color").setDescription("Change a role's color")
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))
    .addStringOption(o => o.setName("color").setDescription("Hex color (e.g. #ff0000)").setRequired(true)))
  .addSubcommand(s => s.setName("permissions").setDescription("View a role's permissions")
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)));

export async function handleRole(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();

  if (sub === "add") {
    const user = i.options.getUser("user", true);
    const role = i.options.getRole("role", true);
    try {
      const member = await i.guild.members.fetch(user.id);
      await member.roles.add(role.id);
      await i.reply({ content: `✅ Added **${role.name}** to **${user.tag}**.` });
    } catch { await i.reply({ content: "❌ Failed to add role.", ephemeral: true }); }
  }

  else if (sub === "remove") {
    const user = i.options.getUser("user", true);
    const role = i.options.getRole("role", true);
    try {
      const member = await i.guild.members.fetch(user.id);
      await member.roles.remove(role.id);
      await i.reply({ content: `✅ Removed **${role.name}** from **${user.tag}**.` });
    } catch { await i.reply({ content: "❌ Failed to remove role.", ephemeral: true }); }
  }

  else if (sub === "create") {
    const name = i.options.getString("name", true);
    const color = i.options.getString("color") ?? undefined;
    const hoist = i.options.getBoolean("hoist") ?? false;
    const mentionable = i.options.getBoolean("mentionable") ?? false;
    try {
      const hexColor = color ? parseInt(color.replace("#", ""), 16) : 0;
      const role = await i.guild.roles.create({ name, color: hexColor, hoist, mentionable });
      await i.reply({ embeds: [new EmbedBuilder().setColor(hexColor).setTitle("✅ Role Created").setDescription(`Created role **${role.name}** (${role.id})`)] });
    } catch (e) { await i.reply({ content: `❌ Failed to create role: ${(e as Error).message}`, ephemeral: true }); }
  }

  else if (sub === "delete") {
    const role = i.options.getRole("role", true);
    try {
      await i.guild.roles.delete(role.id);
      await i.reply({ content: `✅ Role **${role.name}** deleted.` });
    } catch { await i.reply({ content: "❌ Failed to delete role. Check bot role hierarchy.", ephemeral: true }); }
  }

  else if (sub === "rename") {
    const role = i.options.getRole("role", true);
    const name = i.options.getString("name", true);
    try {
      await i.guild.roles.edit(role.id, { name });
      await i.reply({ content: `✅ Role renamed to **${name}**.` });
    } catch { await i.reply({ content: "❌ Failed to rename role.", ephemeral: true }); }
  }

  else if (sub === "color") {
    const role = i.options.getRole("role", true);
    const colorStr = i.options.getString("color", true);
    try {
      const hex = parseInt(colorStr.replace("#", ""), 16);
      await i.guild.roles.edit(role.id, { color: hex });
      await i.reply({ embeds: [new EmbedBuilder().setColor(hex).setTitle("🎨 Role Color Updated").setDescription(`**${role.name}** is now **${colorStr}**.`)] });
    } catch { await i.reply({ content: "❌ Invalid color or failed to update.", ephemeral: true }); }
  }

  else if (sub === "permissions") {
    const role = i.options.getRole("role", true);
    const r = await i.guild.roles.fetch(role.id);
    if (!r) return i.reply({ content: "Role not found.", ephemeral: true });
    const perms = r.permissions.toArray();
    const embed = new EmbedBuilder()
      .setColor(r.color || 0x5865f2)
      .setTitle(`🔐 Permissions — ${r.name}`)
      .setDescription(perms.length === 0 ? "No permissions." : perms.map(p => `• ${p}`).join("\n").slice(0, 4000));
    await i.reply({ embeds: [embed] });
  }
}
