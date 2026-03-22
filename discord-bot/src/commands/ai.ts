import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { askAI } from "../lib/ai.js";

export const aiCommand = new SlashCommandBuilder()
  .setName("ai")
  .setDescription("Chat with Sapphire AI powered by OpenAI")
  .addStringOption((o) => o.setName("prompt").setDescription("Your question or message").setRequired(true));

export const translateCommand = new SlashCommandBuilder()
  .setName("translate")
  .setDescription("Translate text to another language")
  .addStringOption((o) => o.setName("text").setDescription("Text to translate").setRequired(true))
  .addStringOption((o) => o.setName("language").setDescription("Target language (e.g., Spanish, French)").setRequired(true));

export const summarizeCommand = new SlashCommandBuilder()
  .setName("summarize")
  .setDescription("Summarize a long piece of text")
  .addStringOption((o) => o.setName("text").setDescription("Text to summarize").setRequired(true));

export const codeCommand = new SlashCommandBuilder()
  .setName("code")
  .setDescription("Generate code for a task")
  .addStringOption((o) => o.setName("task").setDescription("What code should be generated?").setRequired(true))
  .addStringOption((o) => o.setName("language").setDescription("Programming language").setRequired(false));

export async function handleAI(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const prompt = interaction.options.getString("prompt", true);

  try {
    const response = await askAI([
      { role: "system", content: "You are CSI Bot, a helpful Discord bot assistant. Be concise and friendly. Keep responses under 1800 characters." },
      { role: "user", content: prompt }
    ]);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🤖 Sapphire AI")
      .addFields(
        { name: "Your question", value: prompt.slice(0, 500) },
        { name: "Response", value: response.slice(0, 1800) }
      )
      .setFooter({ text: "Powered by OpenAI" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({ content: "❌ AI is unavailable right now. Please try again later." });
  }
}

export async function handleTranslate(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const text = interaction.options.getString("text", true);
  const language = interaction.options.getString("language", true);

  try {
    const response = await askAI([
      { role: "system", content: `Translate the following text to ${language}. Only provide the translation, nothing else.` },
      { role: "user", content: text }
    ]);

    const embed = new EmbedBuilder()
      .setColor(0x2ed573)
      .setTitle(`🌍 Translation → ${language}`)
      .addFields(
        { name: "Original", value: text.slice(0, 800) },
        { name: "Translation", value: response.slice(0, 1800) }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply({ content: "❌ Translation failed." });
  }
}

export async function handleSummarize(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const text = interaction.options.getString("text", true);

  try {
    const response = await askAI([
      { role: "system", content: "Summarize the following text concisely in 3-5 bullet points. Use • for bullets." },
      { role: "user", content: text }
    ]);

    const embed = new EmbedBuilder()
      .setColor(0xffa502)
      .setTitle("📝 Summary")
      .setDescription(response.slice(0, 1800))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply({ content: "❌ Summarization failed." });
  }
}

export async function handleCode(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const task = interaction.options.getString("task", true);
  const language = interaction.options.getString("language") ?? "the most appropriate language";

  try {
    const response = await askAI([
      { role: "system", content: `You are an expert programmer. Generate clean, working code in ${language}. Wrap code in a code block.` },
      { role: "user", content: task }
    ], 1000);

    const embed = new EmbedBuilder()
      .setColor(0x747d8c)
      .setTitle("💻 Code Generator")
      .addFields({ name: "Task", value: task.slice(0, 500) })
      .setDescription(response.slice(0, 1800))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply({ content: "❌ Code generation failed." });
  }
}
