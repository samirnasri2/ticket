import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  TextChannel,
  CategoryChannel,
  GuildChannel,
  PermissionOverwriteOptions,
} from "discord.js";

// ─── /lock ──────────────────────────────────────────────────────────────────
export const lockCommand = new SlashCommandBuilder()
  .setName("lock").setDescription("Lock a channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption(o => o.setName("channel").setDescription("Channel to lock (defaults to current)").setRequired(false))
  .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false));

export async function handleLock(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const ch = (i.options.getChannel("channel") ?? i.channel) as GuildChannel;
  const reason = i.options.getString("reason") ?? "Channel locked";
  if (!ch || !("permissionOverwrites" in ch)) return i.reply({ content: "❌ Invalid channel.", ephemeral: true });
  await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false });
  await i.reply({ content: `🔒 **${ch.name}** locked. **Reason:** ${reason}` });
}

// ─── /unlock ────────────────────────────────────────────────────────────────
export const unlockCommand = new SlashCommandBuilder()
  .setName("unlock").setDescription("Unlock a channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption(o => o.setName("channel").setDescription("Channel to unlock").setRequired(false));

export async function handleUnlock(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const ch = (i.options.getChannel("channel") ?? i.channel) as GuildChannel;
  if (!ch || !("permissionOverwrites" in ch)) return i.reply({ content: "❌ Invalid channel.", ephemeral: true });
  await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: null });
  await i.reply({ content: `🔓 **${ch.name}** unlocked.` });
}

// ─── /lockdown ──────────────────────────────────────────────────────────────
export const lockdownCommand = new SlashCommandBuilder()
  .setName("lockdown").setDescription("Lockdown the server or a channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("server").setDescription("Lock ALL text channels in the server")
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)))
  .addSubcommand(s => s.setName("channel").setDescription("Lock a specific channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(false))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)));

export async function handleLockdown(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  const reason = i.options.getString("reason") ?? "Lockdown activated";
  await i.deferReply();

  if (sub === "server") {
    const textChannels = i.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
    let locked = 0;
    for (const [, ch] of textChannels) {
      try {
        await (ch as GuildChannel).permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false });
        locked++;
      } catch {}
    }
    await i.editReply({ embeds: [new EmbedBuilder().setColor(0xff4757).setTitle("🔒 SERVER LOCKDOWN ACTIVE").setDescription(`Locked **${locked}** channels.\n**Reason:** ${reason}`)] });
  } else {
    const ch = (i.options.getChannel("channel") ?? i.channel) as GuildChannel;
    if (!ch || !("permissionOverwrites" in ch)) return i.editReply("❌ Invalid channel.");
    await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false });
    await i.editReply(`🔒 **${ch.name}** locked down. **Reason:** ${reason}`);
  }
}

// ─── /unlockdown ────────────────────────────────────────────────────────────
export const unlockdownCommand = new SlashCommandBuilder()
  .setName("unlockdown").setDescription("Remove lockdown from server or channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("server").setDescription("Unlock ALL channels in the server"))
  .addSubcommand(s => s.setName("channel").setDescription("Unlock a specific channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(false)));

export async function handleUnlockdown(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  await i.deferReply();

  if (sub === "server") {
    const textChannels = i.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
    let unlocked = 0;
    for (const [, ch] of textChannels) {
      try {
        await (ch as GuildChannel).permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: null });
        unlocked++;
      } catch {}
    }
    await i.editReply({ embeds: [new EmbedBuilder().setColor(0x2ed573).setTitle("🔓 Server Unlockdown").setDescription(`Unlocked **${unlocked}** channels.`)] });
  } else {
    const ch = (i.options.getChannel("channel") ?? i.channel) as GuildChannel;
    if (!ch || !("permissionOverwrites" in ch)) return i.editReply("❌ Invalid channel.");
    await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: null });
    await i.editReply(`🔓 **${ch.name}** unlocked.`);
  }
}

// ─── /slowmode ──────────────────────────────────────────────────────────────
export const slowmodeCommand = new SlashCommandBuilder()
  .setName("slowmode").setDescription("Set or disable slowmode in a channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand(s => s.setName("set").setDescription("Set slowmode")
    .addIntegerOption(o => o.setName("seconds").setDescription("Slowmode in seconds (1-21600)").setRequired(true).setMinValue(1).setMaxValue(21600))
    .addChannelOption(o => o.setName("channel").setDescription("Channel (defaults to current)").setRequired(false)))
  .addSubcommand(s => s.setName("off").setDescription("Disable slowmode")
    .addChannelOption(o => o.setName("channel").setDescription("Channel (defaults to current)").setRequired(false)));

export async function handleSlowmode(i: ChatInputCommandInteraction) {
  const sub = i.options.getSubcommand();
  const ch = (i.options.getChannel("channel") ?? i.channel) as TextChannel;
  if (!ch || !("setRateLimitPerUser" in ch)) return i.reply({ content: "❌ Invalid channel.", ephemeral: true });

  if (sub === "set") {
    const seconds = i.options.getInteger("seconds", true);
    await ch.setRateLimitPerUser(seconds);
    await i.reply({ content: `✅ Slowmode set to **${seconds}s** in **${ch.name}**.` });
  } else {
    await ch.setRateLimitPerUser(0);
    await i.reply({ content: `✅ Slowmode disabled in **${ch.name}**.` });
  }
}

// ─── /hidechannel ───────────────────────────────────────────────────────────
export const hidechannelCommand = new SlashCommandBuilder()
  .setName("hidechannel").setDescription("Hide a channel from @everyone")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption(o => o.setName("channel").setDescription("Channel to hide").setRequired(false));

export async function handleHideChannel(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const ch = (i.options.getChannel("channel") ?? i.channel) as GuildChannel;
  if (!ch || !("permissionOverwrites" in ch)) return i.reply({ content: "❌ Invalid channel.", ephemeral: true });
  await ch.permissionOverwrites.edit(i.guild.roles.everyone, { ViewChannel: false });
  await i.reply({ content: `👁️ **${ch.name}** is now hidden from @everyone.` });
}

// ─── /showchannel ───────────────────────────────────────────────────────────
export const showchannelCommand = new SlashCommandBuilder()
  .setName("showchannel").setDescription("Show a hidden channel to @everyone")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption(o => o.setName("channel").setDescription("Channel to show").setRequired(false));

export async function handleShowChannel(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const ch = (i.options.getChannel("channel") ?? i.channel) as GuildChannel;
  if (!ch || !("permissionOverwrites" in ch)) return i.reply({ content: "❌ Invalid channel.", ephemeral: true });
  await ch.permissionOverwrites.edit(i.guild.roles.everyone, { ViewChannel: null });
  await i.reply({ content: `👁️ **${ch.name}** is now visible to @everyone.` });
}

// ─── /archivechannel ────────────────────────────────────────────────────────
export const archivechannelCommand = new SlashCommandBuilder()
  .setName("archivechannel").setDescription("Archive a channel (make read-only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption(o => o.setName("channel").setDescription("Channel to archive").setRequired(false));

export async function handleArchiveChannel(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const ch = (i.options.getChannel("channel") ?? i.channel) as GuildChannel;
  if (!ch || !("permissionOverwrites" in ch)) return i.reply({ content: "❌ Invalid channel.", ephemeral: true });
  await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false, AddReactions: false });
  if ("setName" in ch) await (ch as TextChannel).edit({ name: `📦-${ch.name.replace(/^📦-/, "")}` }).catch(() => {});
  await i.reply({ content: `📦 **${ch.name}** has been archived.` });
}

// ─── /unarchivechannel ──────────────────────────────────────────────────────
export const unarchivechannelCommand = new SlashCommandBuilder()
  .setName("unarchivechannel").setDescription("Unarchive a channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption(o => o.setName("channel").setDescription("Channel to unarchive").setRequired(false));

export async function handleUnarchiveChannel(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const ch = (i.options.getChannel("channel") ?? i.channel) as GuildChannel;
  if (!ch || !("permissionOverwrites" in ch)) return i.reply({ content: "❌ Invalid channel.", ephemeral: true });
  await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: null, AddReactions: null });
  if ("setName" in ch) await (ch as TextChannel).edit({ name: ch.name.replace(/^📦-/, "") }).catch(() => {});
  await i.reply({ content: `✅ **${ch.name}** has been unarchived.` });
}

// ─── /clonechannel ──────────────────────────────────────────────────────────
export const clonechannelCommand = new SlashCommandBuilder()
  .setName("clonechannel").setDescription("Clone a channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption(o => o.setName("channel").setDescription("Channel to clone (defaults to current)").setRequired(false))
  .addStringOption(o => o.setName("name").setDescription("New channel name").setRequired(false));

export async function handleCloneChannel(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const ch = (i.options.getChannel("channel") ?? i.channel) as GuildChannel;
  const name = i.options.getString("name");
  if (!ch) return i.reply({ content: "❌ Invalid channel.", ephemeral: true });
  try {
    const cloned = await ch.clone({ name: name ?? `${ch.name}-clone` });
    await i.reply({ content: `✅ Channel cloned: ${cloned}` });
  } catch { await i.reply({ content: "❌ Failed to clone channel.", ephemeral: true }); }
}

// ─── /clonecategory ─────────────────────────────────────────────────────────
export const clonecategoryCommand = new SlashCommandBuilder()
  .setName("clonecategory").setDescription("Clone an entire category and its channels")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption(o => o.setName("category").setDescription("Category to clone").setRequired(true))
  .addStringOption(o => o.setName("name").setDescription("New category name").setRequired(false));

export async function handleCloneCategory(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const cat = i.options.getChannel("category") as CategoryChannel;
  if (!cat || cat.type !== ChannelType.GuildCategory) return i.reply({ content: "❌ Please select a category.", ephemeral: true });
  await i.deferReply();
  try {
    const newCat = await cat.clone({ name: i.options.getString("name") ?? `${cat.name}-clone` });
    const children = cat.children.cache;
    let cloned = 0;
    for (const [, ch] of children) {
      await ch.clone({ parent: newCat.id }).catch(() => {});
      cloned++;
    }
    await i.editReply(`✅ Cloned category **${cat.name}** with **${cloned}** channels → **${newCat.name}**.`);
  } catch { await i.editReply("❌ Failed to clone category."); }
}
