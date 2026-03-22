import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";

export const pingCommand = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check bot latency");

export const serverinfoCommand = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("Show server information");

export const userinfoCommand = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("Show information about a user")
  .addUserOption((o) => o.setName("user").setDescription("User to check").setRequired(false));

export const avatarCommand = new SlashCommandBuilder()
  .setName("avatar")
  .setDescription("Show a user's avatar")
  .addUserOption((o) => o.setName("user").setDescription("User").setRequired(false));

export const pollCommand = new SlashCommandBuilder()
  .setName("poll")
  .setDescription("Create a poll")
  .addStringOption((o) => o.setName("question").setDescription("Poll question").setRequired(true))
  .addStringOption((o) => o.setName("options").setDescription("Comma-separated options (up to 5)").setRequired(false));

export const eightballCommand = new SlashCommandBuilder()
  .setName("8ball")
  .setDescription("Ask the magic 8-ball")
  .addStringOption((o) => o.setName("question").setDescription("Your question").setRequired(true));

export const coinflipCommand = new SlashCommandBuilder()
  .setName("coinflip")
  .setDescription("Flip a coin");

export const jokeCommand = new SlashCommandBuilder()
  .setName("joke")
  .setDescription("Get a random joke");

export async function handlePing(interaction: ChatInputCommandInteraction) {
  const sent = await interaction.reply({ content: "Pinging...", fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  const wsLatency = interaction.client.ws.ping;
  
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🏓 Pong!")
    .addFields(
      { name: "Bot Latency", value: `${latency}ms`, inline: true },
      { name: "WebSocket", value: `${wsLatency}ms`, inline: true }
    );
  
  await interaction.editReply({ content: "", embeds: [embed] });
}

export async function handleServerInfo(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const guild = interaction.guild;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL())
    .addFields(
      { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
      { name: "Members", value: guild.memberCount.toString(), inline: true },
      { name: "Channels", value: guild.channels.cache.size.toString(), inline: true },
      { name: "Roles", value: guild.roles.cache.size.toString(), inline: true },
      { name: "Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      { name: "Boosts", value: guild.premiumSubscriptionCount?.toString() ?? "0", inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export async function handleUserInfo(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser("user") ?? interaction.user;
  const member = interaction.guild?.members.cache.get(target.id);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(target.tag)
    .setThumbnail(target.displayAvatarURL())
    .addFields(
      { name: "ID", value: target.id, inline: true },
      { name: "Account Created", value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
    );

  if (member) {
    embed.addFields(
      { name: "Joined Server", value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : "Unknown", inline: true },
      { name: "Roles", value: member.roles.cache.size > 1 ? `${member.roles.cache.size - 1} roles` : "No roles", inline: true }
    );
  }

  await interaction.reply({ embeds: [embed] });
}

export async function handleAvatar(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser("user") ?? interaction.user;
  const avatarUrl = target.displayAvatarURL({ size: 512 });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${target.username}'s Avatar`)
    .setImage(avatarUrl);

  await interaction.reply({ embeds: [embed] });
}

export async function handlePoll(interaction: ChatInputCommandInteraction) {
  const question = interaction.options.getString("question", true);
  const rawOptions = interaction.options.getString("options");
  const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📊 " + question)
    .setFooter({ text: `Poll by ${interaction.user.tag}` })
    .setTimestamp();

  if (rawOptions) {
    const options = rawOptions.split(",").map((o) => o.trim()).slice(0, 5);
    embed.setDescription(options.map((o, i) => `${emojis[i]} ${o}`).join("\n"));
    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (let i = 0; i < options.length; i++) {
      await msg.react(emojis[i]);
    }
  } else {
    embed.setDescription("Vote with 👍 or 👎");
    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    await msg.react("👍");
    await msg.react("👎");
  }
}

export async function handle8Ball(interaction: ChatInputCommandInteraction) {
  const answers = [
    "It is certain.", "It is decidedly so.", "Without a doubt.", "Yes, definitely.",
    "You may rely on it.", "As I see it, yes.", "Most likely.", "Outlook good.",
    "Yes.", "Signs point to yes.", "Reply hazy, try again.", "Ask again later.",
    "Better not tell you now.", "Cannot predict now.", "Concentrate and ask again.",
    "Don't count on it.", "My reply is no.", "My sources say no.",
    "Outlook not so good.", "Very doubtful."
  ];
  const question = interaction.options.getString("question", true);
  const answer = answers[Math.floor(Math.random() * answers.length)];

  const embed = new EmbedBuilder()
    .setColor(0x2f3542)
    .setTitle("🎱 Magic 8-Ball")
    .addFields(
      { name: "Question", value: question },
      { name: "Answer", value: answer }
    );

  await interaction.reply({ embeds: [embed] });
}

export async function handleCoinflip(interaction: ChatInputCommandInteraction) {
  const result = Math.random() < 0.5 ? "🪙 Heads" : "🪙 Tails";
  await interaction.reply({ content: `You flipped a coin... **${result}**!` });
}

export async function handleJoke(interaction: ChatInputCommandInteraction) {
  const jokes = [
    { setup: "Why don't scientists trust atoms?", punchline: "Because they make up everything!" },
    { setup: "Why did the programmer quit his job?", punchline: "Because he didn't get arrays!" },
    { setup: "How many programmers does it take to change a light bulb?", punchline: "None – that's a hardware problem!" },
    { setup: "Why do programmers prefer dark mode?", punchline: "Light attracts bugs!" },
    { setup: "What do you call a fish without eyes?", punchline: "A fsh!" },
  ];
  const joke = jokes[Math.floor(Math.random() * jokes.length)];

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("😂 Random Joke")
    .setDescription(`${joke.setup}\n\n||${joke.punchline}||`);

  await interaction.reply({ embeds: [embed] });
}
