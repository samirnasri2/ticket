import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { createDashboardToken } from "../lib/dashboard.js";

function getDashboardUrl(): string {
  if (process.env.DASHBOARD_URL) return process.env.DASHBOARD_URL;
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domain) return `https://${domain}`;
  return "http://localhost";
}
const DASHBOARD_URL = getDashboardUrl();

export const dashboardCommand = new SlashCommandBuilder()
  .setName("dashboard")
  .setDescription("Get a temporary access code for the web dashboard (Admins only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function handleDashboard(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const member = interaction.guild.members.cache.get(interaction.user.id);
  if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: "❌ Only server administrators can use this command.",
      ephemeral: true,
    });
  }

  try {
    const token = await createDashboardToken(interaction.guild.id, interaction.user.id);
    const expiresAt = Math.floor((Date.now() + 15 * 60 * 1000) / 1000);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🔑 Dashboard Access Code")
      .setDescription(
        `Here is your temporary dashboard access code for **${interaction.guild.name}**.\n\n` +
        `Visit the dashboard and enter this code to gain access.\n\n` +
        `**⚠️ This code expires in 15 minutes!**`
      )
      .addFields(
        { name: "Access Code", value: `\`\`\`${token}\`\`\`` },
        { name: "Expires", value: `<t:${expiresAt}:R>` },
        { name: "Dashboard URL", value: DASHBOARD_URL }
      )
      .setFooter({ text: "Keep this code secret! Anyone with it can access your server dashboard." })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (err) {
    console.error("Failed to create dashboard token:", err);
    await interaction.reply({
      content: "❌ Failed to generate access code. Please try again.",
      ephemeral: true,
    });
  }
}
