import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import { db, giveawaysTable } from "../lib/db.js";
import { eq, and } from "drizzle-orm";

export const giveawayCommand = new SlashCommandBuilder()
  .setName("giveaway")
  .setDescription("Manage giveaways")
  .setDefaultMemberPermissions(0x20)
  .addSubcommand((sub) =>
    sub.setName("start")
      .setDescription("Start a giveaway")
      .addStringOption((o) => o.setName("prize").setDescription("What are you giving away?").setRequired(true))
      .addIntegerOption((o) => o.setName("duration").setDescription("Duration in minutes").setRequired(true).setMinValue(1))
      .addIntegerOption((o) => o.setName("winners").setDescription("Number of winners").setRequired(false).setMinValue(1))
  )
  .addSubcommand((sub) =>
    sub.setName("end")
      .setDescription("End a giveaway early")
      .addIntegerOption((o) => o.setName("id").setDescription("Giveaway ID").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("list")
      .setDescription("List active giveaways")
  )
  .addSubcommand((sub) =>
    sub.setName("reroll")
      .setDescription("Reroll a giveaway winner")
      .addIntegerOption((o) => o.setName("id").setDescription("Giveaway ID").setRequired(true))
  );

export async function handleGiveaway(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "start") {
    await interaction.deferReply();
    const prize = interaction.options.getString("prize", true);
    const duration = interaction.options.getInteger("duration", true);
    const winnerCount = interaction.options.getInteger("winners") ?? 1;
    const endsAt = new Date(Date.now() + duration * 60 * 1000);

    const [giveaway] = await db.insert(giveawaysTable).values({
      guildId: interaction.guild.id,
      channelId: interaction.channelId,
      prize,
      winnerCount,
      status: "active",
      participants: [],
      winners: [],
      endsAt,
      hostedBy: interaction.user.tag,
    }).returning();

    const endTs = Math.floor(endsAt.getTime() / 1000);

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("🎉 GIVEAWAY")
      .setDescription(`**Prize:** ${prize}\n\n**Ends:** <t:${endTs}:R>\n**Winners:** ${winnerCount}\n**Hosted by:** ${interaction.user.tag}\n\n*Click the button below to enter!*`)
      .setFooter({ text: `ID: ${giveaway.id}` })
      .setTimestamp(endsAt);

    const button = new ButtonBuilder()
      .setCustomId(`giveaway_enter_${giveaway.id}`)
      .setLabel("🎉 Enter Giveaway")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await interaction.editReply({ embeds: [embed], components: [row] });
  }

  if (sub === "end") {
    const id = interaction.options.getInteger("id", true);
    const giveaway = await db.query.giveawaysTable.findFirst({
      where: and(eq(giveawaysTable.id, id), eq(giveawaysTable.guildId, interaction.guild.id))
    });

    if (!giveaway) return interaction.reply({ content: "❌ Giveaway not found.", ephemeral: true });
    if (giveaway.status !== "active") return interaction.reply({ content: "❌ Giveaway is not active.", ephemeral: true });

    const participants = giveaway.participants as string[];
    const winnerCount = Math.min(giveaway.winnerCount, participants.length);
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, winnerCount);

    await db.update(giveawaysTable).set({ status: "ended", winners }).where(eq(giveawaysTable.id, id));

    const embed = new EmbedBuilder()
      .setColor(0x2ed573)
      .setTitle("🎉 Giveaway Ended!")
      .setDescription(`**Prize:** ${giveaway.prize}\n**Winners:** ${winners.length > 0 ? winners.map((w) => `<@${w}>`).join(", ") : "No participants"}`);

    await interaction.reply({ embeds: [embed] });
  }

  if (sub === "list") {
    const giveaways = await db.select().from(giveawaysTable)
      .where(and(eq(giveawaysTable.guildId, interaction.guild.id), eq(giveawaysTable.status, "active")));

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🎉 Active Giveaways")
      .setDescription(giveaways.length === 0 ? "No active giveaways." : giveaways.map((g) =>
        `**ID ${g.id}:** ${g.prize} — Ends <t:${Math.floor(g.endsAt.getTime() / 1000)}:R>`
      ).join("\n"));

    await interaction.reply({ embeds: [embed] });
  }

  if (sub === "reroll") {
    const id = interaction.options.getInteger("id", true);
    const giveaway = await db.query.giveawaysTable.findFirst({
      where: and(eq(giveawaysTable.id, id), eq(giveawaysTable.guildId, interaction.guild.id))
    });

    if (!giveaway || giveaway.status !== "ended") {
      return interaction.reply({ content: "❌ Giveaway not found or not ended.", ephemeral: true });
    }

    const participants = giveaway.participants as string[];
    const newWinner = participants[Math.floor(Math.random() * participants.length)];
    await db.update(giveawaysTable).set({ winners: [newWinner] }).where(eq(giveawaysTable.id, id));

    await interaction.reply({ content: `🎉 New winner: <@${newWinner}>! Congratulations!` });
  }
}
