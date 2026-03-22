import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Message,
  TextChannel,
} from "discord.js";

async function bulkDelete(i: ChatInputCommandInteraction, filter: (m: Message) => boolean, label: string, amount = 100) {
  const channel = i.channel;
  if (!channel || !("bulkDelete" in channel)) return i.reply({ content: "❌ Cannot delete in this channel.", ephemeral: true });
  await i.deferReply({ ephemeral: true });
  const messages = await channel.messages.fetch({ limit: 100 });
  const toDelete = [...messages.values()].filter(m => {
    const age = Date.now() - m.createdTimestamp;
    return age < 14 * 24 * 60 * 60 * 1000 && filter(m); // Discord 14-day limit
  }).slice(0, amount);
  if (toDelete.length === 0) return i.editReply("No matching messages found.");
  await (channel as TextChannel).bulkDelete(toDelete, true);
  await i.editReply(`✅ Deleted **${toDelete.length}** ${label} messages.`);
}

export const purgeCommand = new SlashCommandBuilder()
  .setName("purge").setDescription("Advanced message deletion")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addSubcommand(s => s.setName("bots").setDescription("Delete bot messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount (1-100)").setMinValue(1).setMaxValue(100)))
  .addSubcommand(s => s.setName("humans").setDescription("Delete human messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100)))
  .addSubcommand(s => s.setName("links").setDescription("Delete messages containing links")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100)))
  .addSubcommand(s => s.setName("images").setDescription("Delete messages with images/attachments")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100)))
  .addSubcommand(s => s.setName("embeds").setDescription("Delete messages with embeds")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100)))
  .addSubcommand(s => s.setName("attachments").setDescription("Delete messages with file attachments")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100)))
  .addSubcommand(s => s.setName("contains").setDescription("Delete messages containing specific text")
    .addStringOption(o => o.setName("text").setDescription("Text to search for").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100)))
  .addSubcommand(s => s.setName("user").setDescription("Delete messages from a specific user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100)))
  .addSubcommand(s => s.setName("before").setDescription("Delete messages before a message ID")
    .addStringOption(o => o.setName("message_id").setDescription("Message ID").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100)))
  .addSubcommand(s => s.setName("after").setDescription("Delete messages after a message ID")
    .addStringOption(o => o.setName("message_id").setDescription("Message ID").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100)))
  .addSubcommand(s => s.setName("between").setDescription("Delete messages between two message IDs")
    .addStringOption(o => o.setName("start_id").setDescription("Start message ID").setRequired(true))
    .addStringOption(o => o.setName("end_id").setDescription("End message ID").setRequired(true)))
  .addSubcommand(s => s.setName("duplicates").setDescription("Delete duplicate messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100)))
  .addSubcommand(s => s.setName("invites").setDescription("Delete messages containing Discord invites")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100)))
  .addSubcommand(s => s.setName("mentions").setDescription("Delete messages containing mentions")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100)));

export async function handlePurge(i: ChatInputCommandInteraction) {
  const sub = i.options.getSubcommand();
  const amount = i.options.getInteger("amount") ?? 100;

  switch (sub) {
    case "bots": return bulkDelete(i, m => m.author.bot, "bot", amount);
    case "humans": return bulkDelete(i, m => !m.author.bot, "human", amount);
    case "links": return bulkDelete(i, m => /https?:\/\/\S+/i.test(m.content), "link", amount);
    case "images": return bulkDelete(i, m => m.attachments.some(a => a.contentType?.startsWith("image")), "image", amount);
    case "embeds": return bulkDelete(i, m => m.embeds.length > 0, "embed", amount);
    case "attachments": return bulkDelete(i, m => m.attachments.size > 0, "attachment", amount);
    case "contains": {
      const text = i.options.getString("text", true).toLowerCase();
      return bulkDelete(i, m => m.content.toLowerCase().includes(text), `containing "${text}"`, amount);
    }
    case "user": {
      const user = i.options.getUser("user", true);
      return bulkDelete(i, m => m.author.id === user.id, `from ${user.username}`, amount);
    }
    case "before": {
      const msgId = i.options.getString("message_id", true);
      const channel = i.channel;
      if (!channel || !("bulkDelete" in channel)) return i.reply({ content: "❌ Cannot delete here.", ephemeral: true });
      await i.deferReply({ ephemeral: true });
      const messages = await channel.messages.fetch({ limit: amount, before: msgId });
      const toDelete = [...messages.values()].filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
      await (channel as TextChannel).bulkDelete(toDelete, true);
      return i.editReply(`✅ Deleted **${toDelete.length}** messages before that message.`);
    }
    case "after": {
      const msgId = i.options.getString("message_id", true);
      const channel = i.channel;
      if (!channel || !("bulkDelete" in channel)) return i.reply({ content: "❌ Cannot delete here.", ephemeral: true });
      await i.deferReply({ ephemeral: true });
      const messages = await channel.messages.fetch({ limit: amount, after: msgId });
      const toDelete = [...messages.values()].filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
      await (channel as TextChannel).bulkDelete(toDelete, true);
      return i.editReply(`✅ Deleted **${toDelete.length}** messages after that message.`);
    }
    case "between": {
      const startId = i.options.getString("start_id", true);
      const endId = i.options.getString("end_id", true);
      const channel = i.channel;
      if (!channel || !("bulkDelete" in channel)) return i.reply({ content: "❌ Cannot delete here.", ephemeral: true });
      await i.deferReply({ ephemeral: true });
      const messages = await channel.messages.fetch({ limit: 100, after: startId });
      const toDelete = [...messages.values()].filter(m => m.id < endId && Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
      await (channel as TextChannel).bulkDelete(toDelete, true);
      return i.editReply(`✅ Deleted **${toDelete.length}** messages between those IDs.`);
    }
    case "duplicates": {
      const channel = i.channel;
      if (!channel || !("bulkDelete" in channel)) return i.reply({ content: "❌ Cannot delete here.", ephemeral: true });
      await i.deferReply({ ephemeral: true });
      const messages = await channel.messages.fetch({ limit: 100 });
      const seen = new Set<string>();
      const toDelete = [...messages.values()].filter(m => {
        if (seen.has(m.content) && m.content.length > 0) return true;
        seen.add(m.content);
        return false;
      }).filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
      await (channel as TextChannel).bulkDelete(toDelete, true);
      return i.editReply(`✅ Deleted **${toDelete.length}** duplicate messages.`);
    }
    case "invites": return bulkDelete(i, m => /discord\.gg\/\S+/i.test(m.content), "invite", amount);
    case "mentions": return bulkDelete(i, m => m.mentions.users.size > 0 || m.mentions.roles.size > 0, "mention", amount);
    default: return i.reply({ content: "Unknown subcommand.", ephemeral: true });
  }
}

// ─── /clear ─────────────────────────────────────────────────────────────────
export const clearCommand = new SlashCommandBuilder()
  .setName("clear").setDescription("Delete a set number of messages")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addIntegerOption(o => o.setName("amount").setDescription("Number of messages (1-100)").setRequired(true).setMinValue(1).setMaxValue(100))
  .addUserOption(o => o.setName("user").setDescription("Filter by user").setRequired(false));

export async function handleClear(i: ChatInputCommandInteraction) {
  const amount = i.options.getInteger("amount", true);
  const user = i.options.getUser("user");
  const channel = i.channel;
  if (!channel || !("bulkDelete" in channel)) return i.reply({ content: "❌ Cannot delete here.", ephemeral: true });
  await i.deferReply({ ephemeral: true });
  const messages = await channel.messages.fetch({ limit: 100 });
  let toDelete = [...messages.values()].filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
  if (user) toDelete = toDelete.filter(m => m.author.id === user.id);
  toDelete = toDelete.slice(0, amount);
  await (channel as TextChannel).bulkDelete(toDelete, true);
  await i.editReply(`✅ Deleted **${toDelete.length}** messages.`);
}
