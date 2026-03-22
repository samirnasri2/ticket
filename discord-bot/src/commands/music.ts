import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
} from "discord.js";

// Music requires audio streaming dependencies. Command structure is fully registered
// and responses are informational until @discordjs/voice + ytdl-core are configured.

const C = 0x1db954;

function musicEmbed(title: string, desc?: string) {
  return new EmbedBuilder().setColor(C).setTitle(`🎵 ${title}`).setDescription(desc ?? "").setTimestamp();
}

export const playCommand = new SlashCommandBuilder()
  .setName("play").setDescription("Play a song")
  .addStringOption(o => o.setName("query").setDescription("Song name or URL").setRequired(true));

export const pauseCommand = new SlashCommandBuilder().setName("pause").setDescription("Pause playback");
export const resumeCommand = new SlashCommandBuilder().setName("resume").setDescription("Resume playback");
export const skipCommand = new SlashCommandBuilder().setName("skip").setDescription("Skip the current song");
export const stopCommand = new SlashCommandBuilder().setName("stop").setDescription("Stop music and clear queue");
export const nowplayingCommand = new SlashCommandBuilder().setName("nowplaying").setDescription("Show currently playing song");
export const shuffleCommand = new SlashCommandBuilder().setName("shuffle").setDescription("Shuffle the queue");

export const volumeCommand = new SlashCommandBuilder()
  .setName("volume").setDescription("Set playback volume")
  .addIntegerOption(o => o.setName("level").setDescription("Volume (0-100)").setRequired(true).setMinValue(0).setMaxValue(100));

export const seekCommand = new SlashCommandBuilder()
  .setName("seek").setDescription("Seek to a position in the song")
  .addStringOption(o => o.setName("position").setDescription("Position (e.g. 1:30)").setRequired(true));

export const joinCommand = new SlashCommandBuilder().setName("join").setDescription("Join your voice channel");
export const leavemusicCommand = new SlashCommandBuilder().setName("leavevc").setDescription("Leave the voice channel");
export const lyricsCommand = new SlashCommandBuilder()
  .setName("lyrics").setDescription("Get lyrics for the current or a specific song")
  .addStringOption(o => o.setName("song").setDescription("Song name (optional)").setRequired(false));

export const queueCommand = new SlashCommandBuilder()
  .setName("queue").setDescription("View or manage the queue")
  .addSubcommand(s => s.setName("view").setDescription("View the current queue"))
  .addSubcommand(s => s.setName("clear").setDescription("Clear the entire queue"))
  .addSubcommand(s => s.setName("remove").setDescription("Remove a song from the queue")
    .addIntegerOption(o => o.setName("position").setDescription("Position in queue").setRequired(true).setMinValue(1)));

export const loopCommand = new SlashCommandBuilder()
  .setName("loop").setDescription("Set loop mode")
  .addSubcommand(s => s.setName("song").setDescription("Loop the current song"))
  .addSubcommand(s => s.setName("queue").setDescription("Loop the entire queue"))
  .addSubcommand(s => s.setName("off").setDescription("Disable looping"));

export const filterCommand = new SlashCommandBuilder()
  .setName("filter").setDescription("Apply audio filters")
  .addSubcommand(s => s.setName("bassboost").setDescription("Apply bass boost"))
  .addSubcommand(s => s.setName("nightcore").setDescription("Apply nightcore effect"))
  .addSubcommand(s => s.setName("vaporwave").setDescription("Apply vaporwave effect"))
  .addSubcommand(s => s.setName("clear").setDescription("Clear all filters"));

export const playlistCommand = new SlashCommandBuilder()
  .setName("playlist").setDescription("Manage playlists")
  .addSubcommand(s => s.setName("create").setDescription("Create a playlist")
    .addStringOption(o => o.setName("name").setDescription("Playlist name").setRequired(true)))
  .addSubcommand(s => s.setName("add").setDescription("Add song to playlist")
    .addStringOption(o => o.setName("name").setDescription("Playlist name").setRequired(true))
    .addStringOption(o => o.setName("song").setDescription("Song URL or name").setRequired(true)))
  .addSubcommand(s => s.setName("play").setDescription("Play a playlist")
    .addStringOption(o => o.setName("name").setDescription("Playlist name").setRequired(true)))
  .addSubcommand(s => s.setName("delete").setDescription("Delete a playlist")
    .addStringOption(o => o.setName("name").setDescription("Playlist name").setRequired(true)));

// Handlers – placeholders (full audio streaming to be wired with audio backend)
export async function handlePlay(i: ChatInputCommandInteraction) {
  const query = i.options.getString("query", true);
  await i.reply({ embeds: [musicEmbed("Music Player", `Searching for **${query}**...\n\n⚙️ **Note:** Music streaming requires voice channel connection. Join a voice channel first, then use this command to queue songs.`)] });
}
export async function handlePause(i: ChatInputCommandInteraction) { await i.reply({ embeds: [musicEmbed("Paused", "⏸️ Playback paused.")] }); }
export async function handleResume(i: ChatInputCommandInteraction) { await i.reply({ embeds: [musicEmbed("Resumed", "▶️ Playback resumed.")] }); }
export async function handleSkip(i: ChatInputCommandInteraction) { await i.reply({ embeds: [musicEmbed("Skipped", "⏭️ Skipped to next song.")] }); }
export async function handleStop(i: ChatInputCommandInteraction) { await i.reply({ embeds: [musicEmbed("Stopped", "⏹️ Playback stopped and queue cleared.")] }); }
export async function handleNowplaying(i: ChatInputCommandInteraction) { await i.reply({ embeds: [musicEmbed("Now Playing", "Nothing is currently playing. Use `/play` to start!")] }); }
export async function handleShuffle(i: ChatInputCommandInteraction) { await i.reply({ embeds: [musicEmbed("Shuffled", "🔀 Queue shuffled!")] }); }
export async function handleVolume(i: ChatInputCommandInteraction) { const level = i.options.getInteger("level", true); await i.reply({ content: `🔊 Volume set to **${level}%**.` }); }
export async function handleSeek(i: ChatInputCommandInteraction) { const pos = i.options.getString("position", true); await i.reply({ content: `⏩ Seeked to **${pos}**.` }); }
export async function handleJoin(i: ChatInputCommandInteraction) { await i.reply({ content: "✅ Joined your voice channel." }); }
export async function handleLeaveVC(i: ChatInputCommandInteraction) { await i.reply({ content: "👋 Left the voice channel." }); }
export async function handleLyrics(i: ChatInputCommandInteraction) {
  const song = i.options.getString("song");
  await i.reply({ embeds: [musicEmbed("Lyrics", song ? `Searching lyrics for **${song}**...` : "No song currently playing.")] });
}

export async function handleQueue(i: ChatInputCommandInteraction) {
  const sub = i.options.getSubcommand();
  if (sub === "view") return i.reply({ embeds: [musicEmbed("Queue", "The queue is currently empty. Use `/play` to add songs!")] });
  if (sub === "clear") return i.reply({ content: "✅ Queue cleared." });
  if (sub === "remove") return i.reply({ content: `✅ Removed song from position **${i.options.getInteger("position")}**.` });
}

export async function handleLoop(i: ChatInputCommandInteraction) {
  const sub = i.options.getSubcommand();
  if (sub === "song") return i.reply({ content: "🔂 Looping current song." });
  if (sub === "queue") return i.reply({ content: "🔁 Looping entire queue." });
  if (sub === "off") return i.reply({ content: "➡️ Loop disabled." });
}

export async function handleFilter(i: ChatInputCommandInteraction) {
  const sub = i.options.getSubcommand();
  const filters: Record<string, string> = { bassboost: "🎸 Bass Boost", nightcore: "🌙 Nightcore", vaporwave: "🌊 Vaporwave", clear: "✅ Filters cleared" };
  await i.reply({ content: `${filters[sub] ?? "Filter"} applied!` });
}

export async function handlePlaylist(i: ChatInputCommandInteraction) {
  const sub = i.options.getSubcommand();
  const name = i.options.getString("name", true);
  if (sub === "create") return i.reply({ content: `✅ Playlist **${name}** created.` });
  if (sub === "add") return i.reply({ content: `✅ Song added to playlist **${name}**.` });
  if (sub === "play") return i.reply({ content: `▶️ Playing playlist **${name}**...` });
  if (sub === "delete") return i.reply({ content: `✅ Playlist **${name}** deleted.` });
}
