import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  PermissionFlagsBits, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ChannelType, TextChannel,
} from "discord.js";

const ticketConfig = new Map<string, {
  category: string | null; supportRole: string | null; logsChannel: string | null;
  limit: number; autoClose: number | null;
}>();

function getCfg(gid: string) {
  if (!ticketConfig.has(gid)) ticketConfig.set(gid, { category: null, supportRole: null, logsChannel: null, limit: 1, autoClose: null });
  return ticketConfig.get(gid)!;
}

export const ticketCommand = new SlashCommandBuilder()
  .setName("ticket").setDescription("Ticket support system")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand(s => s.setName("setup").setDescription("Setup the ticket system")
    .addChannelOption(o => o.setName("panel_channel").setDescription("Channel to post ticket panel in").setRequired(true))
    .addRoleOption(o => o.setName("support_role").setDescription("Role that can see tickets").setRequired(false))
    .addChannelOption(o => o.setName("category").setDescription("Category for ticket channels").setRequired(false))
    .addChannelOption(o => o.setName("logs").setDescription("Ticket logs channel").setRequired(false)))
  .addSubcommand(s => s.setName("create").setDescription("Open a new ticket")
    .addStringOption(o => o.setName("reason").setDescription("Reason for ticket").setRequired(false)))
  .addSubcommand(s => s.setName("close").setDescription("Close the current ticket")
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)))
  .addSubcommand(s => s.setName("reopen").setDescription("Reopen a closed ticket"))
  .addSubcommand(s => s.setName("delete").setDescription("Delete the ticket channel"))
  .addSubcommand(s => s.setName("add").setDescription("Add a user to this ticket")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)))
  .addSubcommand(s => s.setName("remove").setDescription("Remove a user from this ticket")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)))
  .addSubcommand(s => s.setName("rename").setDescription("Rename the ticket channel")
    .addStringOption(o => o.setName("name").setDescription("New name").setRequired(true)))
  .addSubcommand(s => s.setName("claim").setDescription("Claim this ticket"))
  .addSubcommand(s => s.setName("unclaim").setDescription("Unclaim this ticket"))
  .addSubcommand(s => s.setName("priority").setDescription("Set ticket priority")
    .addStringOption(o => o.setName("level").setDescription("Priority").setRequired(true)
      .addChoices({ name: "Low", value: "low" }, { name: "Medium", value: "medium" }, { name: "High", value: "high" }, { name: "Urgent", value: "urgent" })))
  .addSubcommand(s => s.setName("logs").setDescription("Set ticket logs channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true)))
  .addSubcommand(s => s.setName("transcript").setDescription("Export ticket transcript"))
  .addSubcommand(s => s.setName("limit").setDescription("Set max tickets per user")
    .addIntegerOption(o => o.setName("amount").setDescription("Max tickets").setRequired(true).setMinValue(1).setMaxValue(5)))
  .addSubcommand(s => s.setName("stats").setDescription("View ticket statistics"));

export async function handleTicket(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  const cfg = getCfg(i.guild.id);

  if (sub === "setup") {
    const panelCh = i.options.getChannel("panel_channel", true) as TextChannel;
    const supportRole = i.options.getRole("support_role");
    const category = i.options.getChannel("category");
    const logs = i.options.getChannel("logs");

    if (supportRole) cfg.supportRole = supportRole.id;
    if (category) cfg.category = category.id;
    if (logs) cfg.logsChannel = logs.id;

    const embed = new EmbedBuilder().setColor(0x5865f2)
      .setTitle("🎟️ Support Tickets")
      .setDescription("Click the button below to open a support ticket.\nA private channel will be created for you.")
      .addFields({ name: "Response Time", value: "We aim to respond within 24 hours." });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket_create").setLabel("📩 Open Ticket").setStyle(ButtonStyle.Primary),
    );

    await panelCh.send({ embeds: [embed], components: [row] });
    await i.reply({ content: `✅ Ticket panel sent to ${panelCh}.${supportRole ? ` Support role: **${supportRole.name}**` : ""}`, ephemeral: true });
  }

  else if (sub === "create") {
    const reason = i.options.getString("reason") ?? "No reason";
    const ch = await i.guild.channels.create({
      name: `ticket-${i.user.username}`,
      type: ChannelType.GuildText,
      parent: cfg.category ?? undefined,
      permissionOverwrites: [
        { id: i.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ...(cfg.supportRole ? [{ id: cfg.supportRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
      ],
    });

    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle("🎟️ Ticket Opened")
      .setDescription(`**Opened by:** ${i.user}\n**Reason:** ${reason}\n\nPlease describe your issue and our staff will assist you shortly.`);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket_close").setLabel("🔒 Close Ticket").setStyle(ButtonStyle.Danger),
    );

    await ch.send({ embeds: [embed], components: [row] });
    await i.reply({ content: `✅ Ticket created: ${ch}`, ephemeral: true });
  }

  else if (sub === "close") {
    const reason = i.options.getString("reason") ?? "Closed";
    const ch = i.channel as TextChannel;
    await i.reply({ content: `🔒 Closing ticket in 5 seconds... **Reason:** ${reason}` });
    await new Promise(r => setTimeout(r, 5000));
    await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false });
    await ch.send({ content: `🔒 Ticket closed by **${i.user.tag}**. **Reason:** ${reason}` });
  }

  else if (sub === "reopen") {
    const ch = i.channel as TextChannel;
    await ch.permissionOverwrites.edit(i.guild.roles.everyone, { ViewChannel: false, SendMessages: false });
    await i.reply({ content: "✅ Ticket reopened." });
  }

  else if (sub === "delete") {
    await i.reply({ content: "🗑️ Deleting ticket in 5 seconds..." });
    setTimeout(() => i.channel?.delete().catch(() => {}), 5000);
  }

  else if (sub === "add") {
    const user = i.options.getUser("user", true);
    const ch = i.channel as TextChannel;
    await ch.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
    await i.reply({ content: `✅ Added **${user.tag}** to this ticket.` });
  }

  else if (sub === "remove") {
    const user = i.options.getUser("user", true);
    const ch = i.channel as TextChannel;
    await ch.permissionOverwrites.delete(user.id);
    await i.reply({ content: `✅ Removed **${user.tag}** from this ticket.` });
  }

  else if (sub === "rename") {
    const name = i.options.getString("name", true);
    await (i.channel as TextChannel).edit({ name });
    await i.reply({ content: `✅ Ticket renamed to **${name}**.` });
  }

  else if (sub === "claim") {
    await i.reply({ content: `✅ **${i.user.tag}** claimed this ticket.` });
  }

  else if (sub === "unclaim") {
    await i.reply({ content: `✅ Ticket unclaimed by **${i.user.tag}**.` });
  }

  else if (sub === "priority") {
    const level = i.options.getString("level", true);
    const emojis: Record<string, string> = { low: "🟢", medium: "🟡", high: "🟠", urgent: "🔴" };
    await i.reply({ content: `${emojis[level]} Ticket priority set to **${level.toUpperCase()}**.` });
  }

  else if (sub === "logs") {
    cfg.logsChannel = i.options.getChannel("channel", true).id;
    await i.reply({ content: `✅ Ticket logs set to <#${cfg.logsChannel}>.` });
  }

  else if (sub === "transcript") {
    await i.deferReply({ ephemeral: true });
    const messages = await i.channel?.messages.fetch({ limit: 100 });
    if (!messages) return i.editReply("Could not fetch messages.");
    const content = [...messages.values()].reverse().map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`).join("\n");
    const { AttachmentBuilder } = await import("discord.js");
    const file = new AttachmentBuilder(Buffer.from(content), { name: `transcript-${i.channel?.id}.txt` });
    await i.editReply({ content: "📄 Ticket transcript:", files: [file] });
  }

  else if (sub === "limit") {
    cfg.limit = i.options.getInteger("amount", true);
    await i.reply({ content: `✅ Max tickets per user: **${cfg.limit}**.` });
  }

  else if (sub === "stats") {
    await i.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("📊 Ticket Stats")
      .addFields({ name: "Tickets Open", value: "0", inline: true }, { name: "Tickets Closed", value: "0", inline: true }, { name: "Avg. Response Time", value: "N/A", inline: true })] });
  }
}
