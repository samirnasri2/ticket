require("dotenv").config();
const {
  Client, GatewayIntentBits, Partials, EmbedBuilder,
  PermissionFlagsBits, SlashCommandBuilder, REST, Routes,
  ActivityType,
} = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, entersState } = require("@discordjs/voice");
const play = require("play-dl");
const Anthropic = require("@anthropic-ai/sdk");

const express  = require("express");
const cors     = require("cors");
const crypto   = require("crypto");

// code → { guildId, guildName, expires }
const dashboardCodes = new Map();

// ── AutoMod State ─────────────────────────────────────────────────────────────
const automodConfig = new Map(); // guildId → config object
const warnings      = new Map(); // guildId → Map<userId, [{rule,reason,timestamp,username}]>
const spamTracker   = new Map(); // `guildId:userId` → [timestamps]
const automodLogs   = new Map(); // guildId → [{...}] (last 200)

function getAutomodConfig(guildId) {
  if (!automodConfig.has(guildId)) {
    automodConfig.set(guildId, {
      enabled: false,
      logChannelId: null,
      badWords:    { enabled: false, words: [], action: "delete_warn", exemptChannels: [] },
      spam:        { enabled: false, maxMessages: 5, timeWindow: 5, action: "delete_mute" },
      links:       { enabled: false, blockInvites: true, blockExternal: false, action: "delete_warn", exemptChannels: [] },
      caps:        { enabled: false, minLength: 10, threshold: 70, action: "delete_warn" },
      mentionSpam: { enabled: false, maxMentions: 5, action: "delete_mute" },
    });
  }
  return automodConfig.get(guildId);
}

function addWarning(guildId, userId, username, reason, rule) {
  if (!warnings.has(guildId)) warnings.set(guildId, new Map());
  const gw = warnings.get(guildId);
  if (!gw.has(userId)) gw.set(userId, []);
  const list = gw.get(userId);
  list.push({ reason, rule, timestamp: Date.now(), username });
  return list.length;
}

function pushLog(guildId, entry) {
  if (!automodLogs.has(guildId)) automodLogs.set(guildId, []);
  const logs = automodLogs.get(guildId);
  logs.unshift({ ...entry, timestamp: Date.now() });
  if (logs.length > 200) logs.pop();
}

async function applyAction(member, message, action, reason, rule) {
  const guild = member.guild;
  const config = getAutomodConfig(guild.id);

  pushLog(guild.id, {
    userId: member.id,
    username: member.user.tag,
    channelId: message.channel.id,
    channelName: message.channel.name || "unknown",
    content: message.content.slice(0, 300),
    rule, action, reason,
  });

  if (action.includes("delete")) message.delete().catch(() => {});

  const punishment = action.replace("delete_", "");

  if (punishment === "warn") {
    const n = addWarning(guild.id, member.id, member.user.tag, reason, rule);
    member.send(`⚠️ **Warning #${n}** in **${guild.name}**: ${reason}`).catch(() => {});
  } else if (punishment === "mute") {
    addWarning(guild.id, member.id, member.user.tag, reason, rule);
    await member.timeout(5 * 60 * 1000, reason).catch(() => {});
    member.send(`🔇 Muted in **${guild.name}** for 5 min: ${reason}`).catch(() => {});
  } else if (punishment === "kick") {
    addWarning(guild.id, member.id, member.user.tag, reason, rule);
    member.send(`👢 Kicked from **${guild.name}**: ${reason}`).catch(() => {});
    await member.kick(reason).catch(() => {});
  } else if (punishment === "ban") {
    addWarning(guild.id, member.id, member.user.tag, reason, rule);
    member.send(`🔨 Banned from **${guild.name}**: ${reason}`).catch(() => {});
    await guild.members.ban(member.id, { reason }).catch(() => {});
  }

  if (config.logChannelId) {
    const ch = guild.channels.cache.get(config.logChannelId);
    if (ch?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle(`🤖 AutoMod — ${rule}`)
        .setColor(0xFF4444)
        .addFields(
          { name: "User",    value: `<@${member.id}> (${member.user.tag})`, inline: true },
          { name: "Channel", value: `<#${message.channel.id}>`,             inline: true },
          { name: "Action",  value: action,                                  inline: true },
          { name: "Reason",  value: reason,                                  inline: false },
          { name: "Message", value: (message.content || "(empty)").slice(0, 500), inline: false },
        )
        .setTimestamp();
      ch.send({ embeds: [embed] }).catch(() => {});
    }
  }
}

// ── Global crash guards ───────────────────────────────────────────────────────
process.on("uncaughtException",  err => console.error("Uncaught Exception:", err));
process.on("unhandledRejection", err => console.error("Unhandled Rejection:", err));

// ── Config ────────────────────────────────────────────────────────────────────
const TOKEN         = process.env.DISCORD_TOKEN;
const CLIENT_ID     = process.env.CLIENT_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const ai = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ── Client Setup ──────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.on("error", err => console.error("Discord client error:", err));

// ── Safe reply helpers ────────────────────────────────────────────────────────
async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (e) {
    console.error("safeReply failed:", e.message);
  }
}

async function safeEditReply(interaction, payload) {
  try {
    await interaction.editReply(payload);
  } catch (e) {
    console.error("safeEditReply failed:", e.message);
  }
}

// ── Music State ───────────────────────────────────────────────────────────────
const musicState = new Map();

function getState(guildId) {
  if (!musicState.has(guildId)) {
    musicState.set(guildId, { queue: [], player: null, connection: null });
  }
  return musicState.get(guildId);
}

// Returns the title on success, null on failure
async function playNext(guildId, textChannel) {
  const state = getState(guildId);
  if (!state.queue.length) {
    if (state.connection) state.connection.destroy();
    musicState.delete(guildId);
    return null;
  }
  const { url, title } = state.queue.shift();
  try {
    const source   = await play.stream(url, { quality: 0 });
    const resource = createAudioResource(source.stream, { inputType: source.type });
    state.player.play(resource);
    return title;
  } catch (e) {
    console.error(`playNext error for "${title}":`, e.message);
    textChannel?.send(`❌ Failed to play **${title}**: ${e.message}`).catch(() => {});
    return playNext(guildId, textChannel);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SLASH COMMAND DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════
const commands = [
  // ── Moderation ──────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("kick").setDescription("Kick a member")
    .addUserOption(o => o.setName("member").setDescription("Member to kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder().setName("ban").setDescription("Ban a member")
    .addUserOption(o => o.setName("member").setDescription("Member to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder().setName("unban").setDescription("Unban a user by ID")
    .addStringOption(o => o.setName("user_id").setDescription("User ID").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder().setName("mute").setDescription("Timeout (mute) a member")
    .addUserOption(o => o.setName("member").setDescription("Member to mute").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes (default 10)").setMinValue(1).setMaxValue(10080))
    .addStringOption(o => o.setName("reason").setDescription("Reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder().setName("unmute").setDescription("Remove timeout from a member")
    .addUserOption(o => o.setName("member").setDescription("Member to unmute").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder().setName("purge").setDescription("Delete messages (max 100)")
    .addIntegerOption(o => o.setName("amount").setDescription("Number of messages").setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // ── Music ────────────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("play").setDescription("Play a song from YouTube")
    .addStringOption(o => o.setName("query").setDescription("Song name or URL").setRequired(true)),

  new SlashCommandBuilder().setName("skip").setDescription("Skip the current song"),
  new SlashCommandBuilder().setName("stop").setDescription("Stop music and disconnect"),
  new SlashCommandBuilder().setName("pause").setDescription("Pause playback"),
  new SlashCommandBuilder().setName("resume").setDescription("Resume playback"),
  new SlashCommandBuilder().setName("queue").setDescription("Show the music queue"),

  // ── Fun ──────────────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("roll").setDescription("Roll dice (e.g. 2d6)")
    .addStringOption(o => o.setName("dice").setDescription("Dice notation like 1d20 (default: 1d6)")),

  new SlashCommandBuilder().setName("coinflip").setDescription("Flip a coin"),

  new SlashCommandBuilder().setName("8ball").setDescription("Ask the magic 8-ball")
    .addStringOption(o => o.setName("question").setDescription("Your yes/no question").setRequired(true)),

  new SlashCommandBuilder().setName("poll").setDescription("Create a yes/no poll")
    .addStringOption(o => o.setName("question").setDescription("Poll question").setRequired(true)),

  new SlashCommandBuilder().setName("joke").setDescription("Get a random joke"),

  new SlashCommandBuilder().setName("avatar").setDescription("Show a user's avatar")
    .addUserOption(o => o.setName("member").setDescription("User (blank = you)")),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Show server info"),

  new SlashCommandBuilder().setName("userinfo").setDescription("Show user info")
    .addUserOption(o => o.setName("member").setDescription("User (blank = you)")),

  // ── AI ───────────────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("ask").setDescription("Ask Claude AI a question")
    .addStringOption(o => o.setName("question").setDescription("Your question").setRequired(true)),

  new SlashCommandBuilder().setName("roast").setDescription("AI roast of a user (all in fun!)")
    .addUserOption(o => o.setName("member").setDescription("Who to roast").setRequired(true)),

  new SlashCommandBuilder().setName("compliment").setDescription("AI compliment for a user")
    .addUserOption(o => o.setName("member").setDescription("Who to compliment").setRequired(true)),

  // ── Dashboard ────────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Generate a one-time code to link this server to the CSI web dashboard")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // ── Help ─────────────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("help").setDescription("Show all commands"),
].map(c => c.toJSON());

// ══════════════════════════════════════════════════════════════════════════════
//  REGISTER COMMANDS
// ══════════════════════════════════════════════════════════════════════════════
async function deployCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  console.log("🔄 Deploying slash commands...");
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("✅ Slash commands deployed!");
}

// ══════════════════════════════════════════════════════════════════════════════
//  EVENTS
// ══════════════════════════════════════════════════════════════════════════════
client.once("ready", () => {
  client.user.setActivity("over the server 👀", { type: ActivityType.Watching });
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("guildMemberAdd", async member => {
  const channel = member.guild.channels.cache.find(c => c.name === "general" && c.isTextBased());
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle(`👋 Welcome, ${member.displayName}!`)
    .setDescription(`You're member **#${member.guild.memberCount}**. Enjoy your stay!`)
    .setThumbnail(member.displayAvatarURL())
    .setColor(0x57F287);
  channel.send({ embeds: [embed] }).catch(() => {});
});

// ══════════════════════════════════════════════════════════════════════════════
//  INTERACTION HANDLER
// ══════════════════════════════════════════════════════════════════════════════
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  try {
    // ── MODERATION ─────────────────────────────────────────────────────────────
    if (commandName === "kick") {
      const member = interaction.options.getMember("member");
      const reason = interaction.options.getString("reason") ?? "No reason provided";
      await member.kick(reason);
      const embed = new EmbedBuilder().setTitle("👢 Member Kicked").setColor(0xFEE75C)
        .addFields({ name: "User", value: member.toString(), inline: true },
                   { name: "Reason", value: reason, inline: true },
                   { name: "By", value: interaction.user.toString(), inline: true });
      return await interaction.reply({ embeds: [embed] });
    }

    if (commandName === "ban") {
      const member = interaction.options.getMember("member");
      const reason = interaction.options.getString("reason") ?? "No reason provided";
      await member.ban({ reason });
      const embed = new EmbedBuilder().setTitle("🔨 Member Banned").setColor(0xED4245)
        .addFields({ name: "User", value: member.toString(), inline: true },
                   { name: "Reason", value: reason, inline: true },
                   { name: "By", value: interaction.user.toString(), inline: true });
      return await interaction.reply({ embeds: [embed] });
    }

    if (commandName === "unban") {
      const userId = interaction.options.getString("user_id");
      try {
        await interaction.guild.bans.remove(userId);
        return await interaction.reply(`✅ Unbanned user \`${userId}\`.`);
      } catch {
        return await interaction.reply({ content: "❌ User not found or not banned.", flags: 64 });
      }
    }

    if (commandName === "mute") {
      const member  = interaction.options.getMember("member");
      const minutes = interaction.options.getInteger("minutes") ?? 10;
      const reason  = interaction.options.getString("reason") ?? "No reason provided";
      await member.timeout(minutes * 60 * 1000, reason);
      const embed = new EmbedBuilder().setTitle("🔇 Member Muted").setColor(0x99AAB5)
        .addFields({ name: "User", value: member.toString(), inline: true },
                   { name: "Duration", value: `${minutes} min`, inline: true },
                   { name: "Reason", value: reason, inline: true });
      return await interaction.reply({ embeds: [embed] });
    }

    if (commandName === "unmute") {
      const member = interaction.options.getMember("member");
      await member.timeout(null);
      return await interaction.reply(`🔊 ${member} has been unmuted.`);
    }

    if (commandName === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.deferReply({ flags: 64 });
      const deleted = await interaction.channel.bulkDelete(amount, true);
      return await interaction.editReply(`🗑️ Deleted **${deleted.size}** messages.`);
    }

    // ── MUSIC ──────────────────────────────────────────────────────────────────
    if (commandName === "play") {
      const query = interaction.options.getString("query");
      const voiceChannel = interaction.member.voice?.channel;
      if (!voiceChannel) {
        return await interaction.reply({ content: "❌ Join a voice channel first!", flags: 64 });
      }
      await interaction.deferReply();

      let url, title;
      try {
        if (play.yt_validate(query) === "video") {
          const info = await play.video_info(query);
          url   = query;
          title = info.video_details.title;
        } else {
          const results = await play.search(query, { source: { youtube: "video" }, limit: 1 });
          if (!results.length) return await interaction.editReply("❌ No results found.");
          url   = results[0].url;
          title = results[0].title;
        }
      } catch (e) {
        return await interaction.editReply(`❌ Search failed: ${e.message}`);
      }

      const state = getState(interaction.guildId);
      state.queue.push({ url, title });

      if (!state.connection) {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId:   interaction.guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        try {
          await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
        } catch {
          connection.destroy();
          musicState.delete(interaction.guildId);
          return await interaction.editReply("❌ Could not connect to voice channel. Check my permissions.");
        }

        state.connection = connection;
        state.player = createAudioPlayer();
        state.connection.subscribe(state.player);

        state.connection.on(VoiceConnectionStatus.Disconnected, async () => {
          try {
            await Promise.race([
              entersState(state.connection, VoiceConnectionStatus.Signalling, 5_000),
              entersState(state.connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
          } catch {
            state.connection.destroy();
            musicState.delete(interaction.guildId);
          }
        });

        state.player.on(AudioPlayerStatus.Idle, () => playNext(interaction.guildId, interaction.channel));
        state.player.on("error", e => {
          console.error("Audio player error:", e.message);
          interaction.channel.send(`❌ Player error: ${e.message}`).catch(() => {});
          playNext(interaction.guildId, interaction.channel);
        });

        const playedTitle = await playNext(interaction.guildId, interaction.channel);
        if (!playedTitle) {
          return await interaction.editReply("❌ Could not stream that track. Try a different song.");
        }
        return await interaction.editReply(`▶️ Now playing: **${playedTitle}**`);
      }

      return await interaction.editReply(`➕ Added to queue: **${title}**`);
    }

    if (commandName === "skip") {
      const state = getState(interaction.guildId);
      if (!state.player) return await interaction.reply({ content: "❌ Nothing is playing.", flags: 64 });
      state.player.stop();
      return await interaction.reply("⏭️ Skipped!");
    }

    if (commandName === "stop") {
      const state = getState(interaction.guildId);
      if (!state.connection) return await interaction.reply({ content: "❌ Not in a voice channel.", flags: 64 });
      state.queue = [];
      state.connection.destroy();
      musicState.delete(interaction.guildId);
      return await interaction.reply("⏹️ Stopped and disconnected.");
    }

    if (commandName === "pause") {
      const state = getState(interaction.guildId);
      if (state.player?.state.status === AudioPlayerStatus.Playing) {
        state.player.pause();
        return await interaction.reply("⏸️ Paused.");
      }
      return await interaction.reply({ content: "❌ Nothing to pause.", flags: 64 });
    }

    if (commandName === "resume") {
      const state = getState(interaction.guildId);
      if (state.player?.state.status === AudioPlayerStatus.Paused) {
        state.player.unpause();
        return await interaction.reply("▶️ Resumed.");
      }
      return await interaction.reply({ content: "❌ Nothing to resume.", flags: 64 });
    }

    if (commandName === "queue") {
      const state = getState(interaction.guildId);
      if (!state.queue.length) return await interaction.reply("📭 Queue is empty.");
      const lines = state.queue.map((s, i) => `**${i + 1}.** ${s.title}`).join("\n");
      const embed = new EmbedBuilder().setTitle("🎵 Music Queue").setDescription(lines).setColor(0x5865F2);
      return await interaction.reply({ embeds: [embed] });
    }

    // ── FUN ────────────────────────────────────────────────────────────────────
    if (commandName === "roll") {
      const dice  = (interaction.options.getString("dice") ?? "1d6").toLowerCase();
      const match = dice.match(/^(\d+)d(\d+)$/);
      if (!match) return await interaction.reply({ content: "❌ Use format like `1d20` or `2d6`.", flags: 64 });
      const [, numStr, sidesStr] = match;
      const num = parseInt(numStr), sides = parseInt(sidesStr);
      if (num < 1 || num > 20 || sides < 2 || sides > 100)
        return await interaction.reply({ content: "❌ Dice out of range (1–20 dice, 2–100 sides).", flags: 64 });
      const rolls = Array.from({ length: num }, () => Math.ceil(Math.random() * sides));
      const total = rolls.reduce((a, b) => a + b, 0);
      const detail = num > 1 ? rolls.join(" + ") + ` = **${total}**` : `**${total}**`;
      return await interaction.reply(`🎲 **${dice}** → ${detail}`);
    }

    if (commandName === "coinflip") {
      return await interaction.reply(Math.random() < 0.5 ? "🪙 **Heads!**" : "🪙 **Tails!**");
    }

    if (commandName === "8ball") {
      const question = interaction.options.getString("question");
      const answers  = [
        "✅ It is certain.", "✅ Without a doubt.", "✅ Yes, definitely.",
        "✅ You may rely on it.", "🔮 Ask again later.", "🔮 Cannot predict now.",
        "❌ Don't count on it.", "❌ My sources say no.", "❌ Outlook not so good.",
      ];
      const embed = new EmbedBuilder().setTitle("🎱 Magic 8-Ball").setColor(0x2B2D31)
        .addFields({ name: "Question", value: question, inline: false },
                   { name: "Answer", value: answers[Math.floor(Math.random() * answers.length)], inline: false });
      return await interaction.reply({ embeds: [embed] });
    }

    if (commandName === "poll") {
      const question = interaction.options.getString("question");
      const embed = new EmbedBuilder().setTitle("📊 Poll").setDescription(question).setColor(0xF1C40F)
        .setFooter({ text: `Asked by ${interaction.user.displayName}` });
      await interaction.reply({ content: "✅ Poll created!", flags: 64 });
      const msg = await interaction.channel.send({ embeds: [embed] });
      await msg.react("👍");
      await msg.react("👎");
      return;
    }

    if (commandName === "joke") {
      const jokes = [
        ["Why don't scientists trust atoms?",         "Because they make up everything!"],
        ["Why did the scarecrow win an award?",        "He was outstanding in his field!"],
        ["I told my wife she was drawing her eyebrows too high.", "She looked surprised."],
        ["Why don't eggs tell jokes?",                 "They'd crack each other up."],
        ["What do you call a fake noodle?",            "An impasta!"],
        ["Why can't a bicycle stand on its own?",      "Because it's two-tired!"],
        ["What do you call cheese that isn't yours?",  "Nacho cheese!"],
        ["Why did the math book look sad?",            "Because it had too many problems."],
      ];
      const [setup, punchline] = jokes[Math.floor(Math.random() * jokes.length)];
      const embed = new EmbedBuilder().setTitle("😂 Joke Time").setColor(0xF1C40F)
        .addFields({ name: "Setup", value: setup, inline: false },
                   { name: "Punchline", value: punchline, inline: false });
      return await interaction.reply({ embeds: [embed] });
    }

    if (commandName === "avatar") {
      const target = interaction.options.getMember("member") ?? interaction.member;
      const embed  = new EmbedBuilder()
        .setTitle(`${target.displayName}'s Avatar`)
        .setImage(target.displayAvatarURL({ size: 512 }))
        .setColor(0x5865F2);
      return await interaction.reply({ embeds: [embed] });
    }

    if (commandName === "serverinfo") {
      const g = interaction.guild;
      await g.members.fetch();
      const embed = new EmbedBuilder().setTitle(g.name).setColor(0x5865F2)
        .setThumbnail(g.iconURL())
        .addFields(
          { name: "Owner",    value: `<@${g.ownerId}>`,         inline: true },
          { name: "Members",  value: `${g.memberCount}`,         inline: true },
          { name: "Channels", value: `${g.channels.cache.size}`, inline: true },
          { name: "Roles",    value: `${g.roles.cache.size}`,    inline: true },
          { name: "Created",  value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
        );
      return await interaction.reply({ embeds: [embed] });
    }

    if (commandName === "userinfo") {
      const target = interaction.options.getMember("member") ?? interaction.member;
      const topRole = target.roles.highest;
      const embed = new EmbedBuilder().setTitle(target.user.tag).setColor(target.displayColor || 0x5865F2)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "ID",       value: target.id,                                              inline: true },
          { name: "Nickname", value: target.nickname ?? "None",                              inline: true },
          { name: "Joined",   value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:D>`,   inline: true },
          { name: "Account",  value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:D>`, inline: true },
          { name: "Top Role", value: topRole.id !== interaction.guild.id ? topRole.toString() : "None", inline: true },
        );
      return await interaction.reply({ embeds: [embed] });
    }

    // ── AI ─────────────────────────────────────────────────────────────────────
    if (commandName === "ask") {
      const question = interaction.options.getString("question");
      await interaction.deferReply();
      const response = await ai.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 600,
        system: "You are a helpful, friendly Discord bot assistant. Keep answers concise (under 400 words) and conversational.",
        messages: [{ role: "user", content: question }],
      });
      const embed = new EmbedBuilder().setTitle("🤖 Claude AI")
        .setDescription(response.content[0].text).setColor(0xDA373C)
        .setFooter({ text: `Asked by ${interaction.user.displayName}` });
      return await interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "roast") {
      const member = interaction.options.getMember("member");
      await interaction.deferReply();
      const response = await ai.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 200,
        system: "You are a witty Discord bot. Write a short, playful, harmless roast (2-3 sentences). Keep it fun and not offensive.",
        messages: [{ role: "user", content: `Roast a Discord user named ${member.displayName}.` }],
      });
      return await interaction.editReply(`🔥 ${member} — ${response.content[0].text}`);
    }

    if (commandName === "compliment") {
      const member = interaction.options.getMember("member");
      await interaction.deferReply();
      const response = await ai.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 150,
        system: "Write a warm, genuine, uplifting compliment in 1-2 sentences for a Discord user.",
        messages: [{ role: "user", content: `Compliment a Discord user named ${member.displayName}.` }],
      });
      return await interaction.editReply(`💖 ${member} — ${response.content[0].text}`);
    }

    // ── DASHBOARD ──────────────────────────────────────────────────────────────
    if (commandName === "dashboard") {
      const guild = interaction.guild;
      // Purge any expired codes for this guild first
      for (const [c, v] of dashboardCodes) {
        if (v.guildId === guild.id || v.expires < Date.now()) dashboardCodes.delete(c);
      }
      const code = crypto.randomBytes(3).toString("hex").toUpperCase(); // e.g. "A3F9C2"
      dashboardCodes.set(code, { guildId: guild.id, guildName: guild.name, expires: Date.now() + 15 * 60 * 1000 });
      const embed = new EmbedBuilder()
        .setTitle("🖥️ CSI Dashboard — Server Link Code")
        .setDescription(
          `Copy the code below and paste it in the **CSI Control Center** dashboard to link **${guild.name}**.\n\n` +
          `\`\`\`\n${code}\n\`\`\`\n` +
          `⏳ This code expires in **15 minutes** and can only be used once.`
        )
        .setColor(0x0080FF)
        .setFooter({ text: "CSI Control Center • Only you can see this" });
      return await interaction.reply({ embeds: [embed], flags: 64 });
    }

    // ── HELP ───────────────────────────────────────────────────────────────────
    if (commandName === "help") {
      const embed = new EmbedBuilder().setTitle("📖 Bot Commands").setColor(0x5865F2)
        .addFields(
          { name: "🛡️ Moderation", value: "`/kick` `/ban` `/unban` `/mute` `/unmute` `/purge`", inline: false },
          { name: "🎵 Music",       value: "`/play` `/skip` `/stop` `/pause` `/resume` `/queue`", inline: false },
          { name: "🎮 Fun",         value: "`/roll` `/coinflip` `/8ball` `/poll` `/joke` `/avatar` `/serverinfo` `/userinfo`", inline: false },
          { name: "🤖 AI (Claude)", value: "`/ask` `/roast` `/compliment`", inline: false },
        );
      return await interaction.reply({ embeds: [embed], flags: 64 });
    }

  } catch (err) {
    console.error(`Error in /${commandName}:`, err);
    await safeReply(interaction, { content: `❌ Error: ${err.message}`, flags: 64 });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════════════════════════════════
if (process.argv.includes("--deploy")) {
  deployCommands().then(() => process.exit(0)).catch(console.error);
} else {
  if (!TOKEN) throw new Error("DISCORD_TOKEN not set");
  if (!CLIENT_ID) throw new Error("CLIENT_ID not set");

  // ── Express API + Keep-alive server ───────────────────────────────────────
  const app  = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  // Keep-alive ping
  app.get("/", (_req, res) => res.send("Bot is online!"));

  // GET /bot/stats
  app.get("/bot/stats", (_req, res) => {
    const totalMembers = client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0);
    res.json({
      online:      client.isReady(),
      tag:         client.user?.tag ?? "Unknown",
      serverCount: client.guilds.cache.size,
      totalMembers,
      uptime:      process.uptime(),
    });
  });

  // GET /bot/servers
  app.get("/bot/servers", (_req, res) => {
    const servers = client.guilds.cache.map(g => ({
      id:          g.id,
      name:        g.name,
      icon:        g.iconURL({ size: 64 }),
      memberCount: g.memberCount,
      ownerId:     g.ownerId,
    }));
    res.json(servers);
  });

  // POST /bot/verify  — body: { code }
  app.post("/bot/verify", (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: "No code provided" });
    const entry = dashboardCodes.get(code.toUpperCase().trim());
    if (!entry) return res.status(404).json({ success: false, message: "Invalid or expired code" });
    if (entry.expires < Date.now()) {
      dashboardCodes.delete(code.toUpperCase().trim());
      return res.status(410).json({ success: false, message: "Code has expired — run /dashboard again" });
    }
    const guild = client.guilds.cache.get(entry.guildId);
    dashboardCodes.delete(code.toUpperCase().trim()); // one-time use
    res.json({
      success: true,
      guild: {
        id: entry.guildId,
        name: entry.guildName,
        icon: guild?.iconURL({ size: 64 }) ?? null,
        memberCount: guild?.memberCount ?? 0,
      },
    });
  });

  // POST /bot/ban  — body: { guildId, userId, reason }
  app.post("/bot/ban", async (req, res) => {
    const { guildId, userId, reason = "Banned via dashboard" } = req.body;
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ success: false, message: "Server not found" });
      await guild.members.ban(userId, { reason });
      res.json({ success: true, message: `Banned user ${userId}` });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // POST /bot/kick  — body: { guildId, userId, reason }
  app.post("/bot/kick", async (req, res) => {
    const { guildId, userId, reason = "Kicked via dashboard" } = req.body;
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ success: false, message: "Server not found" });
      const member = await guild.members.fetch(userId);
      await member.kick(reason);
      res.json({ success: true, message: `Kicked user ${userId}` });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.listen(PORT, () => {
    console.log(`🌐 Dashboard API running on port ${PORT}`);
  });

  client.login(TOKEN);
}
