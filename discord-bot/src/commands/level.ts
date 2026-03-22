import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  PermissionFlagsBits, EmbedBuilder,
} from "discord.js";
import { db, xpTable } from "../lib/db.js";
import { eq, and, desc, sql } from "drizzle-orm";

// Guild-specific config
const levelConfig = new Map<string, {
  enabled: boolean; xpPerMessage: number; xpCooldown: number;
  rewards: { level: number; roleId: string }[];
  bonusChannels: Map<string, number>; bonusRoles: Map<string, number>;
  ignoredChannels: Set<string>; ignoredRoles: Set<string>;
  announceEnabled: boolean; announceChannel: string | null;
  decayEnabled: boolean; decayRate: number;
}>();

function getCfg(gid: string) {
  if (!levelConfig.has(gid)) levelConfig.set(gid, {
    enabled: true, xpPerMessage: 15, xpCooldown: 60,
    rewards: [], bonusChannels: new Map(), bonusRoles: new Map(),
    ignoredChannels: new Set(), ignoredRoles: new Set(),
    announceEnabled: true, announceChannel: null,
    decayEnabled: false, decayRate: 10,
  });
  return levelConfig.get(gid)!;
}

export function calcLevel(xp: number): number {
  return Math.floor(0.1 * Math.sqrt(xp));
}
export function xpForLevel(level: number): number {
  return Math.pow(level / 0.1, 2);
}

export const levelCommand = new SlashCommandBuilder()
  .setName("level").setDescription("Leveling system management")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("enable").setDescription("Enable the leveling system"))
  .addSubcommand(s => s.setName("disable").setDescription("Disable the leveling system"))
  .addSubcommand(s => s.setName("rank").setDescription("View your or another user's rank")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)))
  .addSubcommand(s => s.setName("leaderboard").setDescription("View server XP leaderboard"))
  .addSubcommand(s => s.setName("xp_set").setDescription("Set a user's XP")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("XP amount").setRequired(true).setMinValue(0)))
  .addSubcommand(s => s.setName("xp_rate").setDescription("Set XP earned per message")
    .addIntegerOption(o => o.setName("amount").setDescription("XP per message (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)))
  .addSubcommand(s => s.setName("xp_cooldown").setDescription("Set XP cooldown in seconds")
    .addIntegerOption(o => o.setName("seconds").setDescription("Cooldown").setRequired(true).setMinValue(0).setMaxValue(300)))
  .addSubcommand(s => s.setName("rewards_add").setDescription("Add a role reward for reaching a level")
    .addIntegerOption(o => o.setName("level").setDescription("Level").setRequired(true).setMinValue(1))
    .addRoleOption(o => o.setName("role").setDescription("Role to award").setRequired(true)))
  .addSubcommand(s => s.setName("rewards_remove").setDescription("Remove a level reward")
    .addIntegerOption(o => o.setName("level").setDescription("Level to remove reward from").setRequired(true)))
  .addSubcommand(s => s.setName("rewards_list").setDescription("List all level rewards"))
  .addSubcommand(s => s.setName("reset").setDescription("Reset all XP in this server"))
  .addSubcommand(s => s.setName("user_reset").setDescription("Reset XP for a specific user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)))
  .addSubcommand(s => s.setName("role_bonus").setDescription("Set XP multiplier for a role")
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))
    .addNumberOption(o => o.setName("multiplier").setDescription("Multiplier (e.g. 2 = double XP)").setRequired(true).setMinValue(0.5).setMaxValue(10)))
  .addSubcommand(s => s.setName("channel_bonus").setDescription("Set XP multiplier for a channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true))
    .addNumberOption(o => o.setName("multiplier").setDescription("Multiplier").setRequired(true).setMinValue(0.5).setMaxValue(10)))
  .addSubcommand(s => s.setName("ignore_channel").setDescription("Ignore a channel from XP gain")
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true)))
  .addSubcommand(s => s.setName("ignore_role").setDescription("Ignore a role from XP gain")
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)))
  .addSubcommand(s => s.setName("announce_enable").setDescription("Enable level-up announcements"))
  .addSubcommand(s => s.setName("announce_disable").setDescription("Disable level-up announcements"))
  .addSubcommand(s => s.setName("announce_channel").setDescription("Set announcement channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true)))
  .addSubcommand(s => s.setName("decay_enable").setDescription("Enable XP decay for inactivity"))
  .addSubcommand(s => s.setName("decay_disable").setDescription("Disable XP decay"))
  .addSubcommand(s => s.setName("decay_rate").setDescription("Set decay rate (XP per day)")
    .addIntegerOption(o => o.setName("amount").setDescription("XP lost per day").setRequired(true).setMinValue(1)));

export async function handleLevel(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  const cfg = getCfg(i.guild.id);

  if (sub === "enable") { cfg.enabled = true; return i.reply({ content: "✅ Leveling system enabled." }); }
  if (sub === "disable") { cfg.enabled = false; return i.reply({ content: "🔴 Leveling system disabled." }); }

  if (sub === "rank") {
    const user = i.options.getUser("user") ?? i.user;
    const row = await db.select().from(xpTable)
      .where(and(eq(xpTable.guildId, i.guild.id), eq(xpTable.userId, user.id))).limit(1);
    const xp = row[0]?.xp ?? 0;
    const level = calcLevel(xp);
    const nextLvlXp = xpForLevel(level + 1);
    const progress = Math.min(100, Math.floor((xp / nextLvlXp) * 100));
    const bar = "█".repeat(Math.floor(progress / 10)) + "░".repeat(10 - Math.floor(progress / 10));
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`📊 ${user.username}'s Rank`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: "Level", value: level.toString(), inline: true },
        { name: "XP", value: `${xp.toLocaleString()} / ${Math.floor(nextLvlXp).toLocaleString()}`, inline: true },
        { name: "Progress", value: `${bar} ${progress}%` },
      );
    return i.reply({ embeds: [embed] });
  }

  if (sub === "leaderboard") {
    const rows = await db.select().from(xpTable)
      .where(eq(xpTable.guildId, i.guild.id))
      .orderBy(desc(xpTable.xp)).limit(10);
    const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle(`🏆 XP Leaderboard — ${i.guild.name}`)
      .setDescription(rows.length === 0 ? "No XP recorded yet." : rows.map((r, idx) =>
        `**${idx + 1}.** <@${r.userId}> — Level **${calcLevel(r.xp)}** (${r.xp.toLocaleString()} XP)`
      ).join("\n"));
    return i.reply({ embeds: [embed] });
  }

  if (sub === "xp_set") {
    const user = i.options.getUser("user", true);
    const amount = i.options.getInteger("amount", true);
    await db.insert(xpTable).values({ guildId: i.guild.id, userId: user.id, xp: amount })
      .onConflictDoUpdate({ target: [xpTable.guildId, xpTable.userId], set: { xp: amount } });
    return i.reply({ content: `✅ Set **${user.tag}**'s XP to **${amount}**.` });
  }
  if (sub === "xp_rate") { cfg.xpPerMessage = i.options.getInteger("amount", true); return i.reply({ content: `✅ XP per message: **${cfg.xpPerMessage}**.` }); }
  if (sub === "xp_cooldown") { cfg.xpCooldown = i.options.getInteger("seconds", true); return i.reply({ content: `✅ XP cooldown: **${cfg.xpCooldown}s**.` }); }

  if (sub === "rewards_add") {
    const level = i.options.getInteger("level", true);
    const role = i.options.getRole("role", true);
    cfg.rewards = cfg.rewards.filter(r => r.level !== level);
    cfg.rewards.push({ level, roleId: role.id });
    cfg.rewards.sort((a, b) => a.level - b.level);
    return i.reply({ content: `✅ Level **${level}** reward: **${role.name}**.` });
  }
  if (sub === "rewards_remove") {
    const level = i.options.getInteger("level", true);
    cfg.rewards = cfg.rewards.filter(r => r.level !== level);
    return i.reply({ content: `✅ Reward for level **${level}** removed.` });
  }
  if (sub === "rewards_list") {
    return i.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("🎁 Level Rewards")
      .setDescription(cfg.rewards.length === 0 ? "No rewards set." : cfg.rewards.map(r => `Level **${r.level}** → <@&${r.roleId}>`).join("\n"))] });
  }

  if (sub === "reset") {
    await db.delete(xpTable).where(eq(xpTable.guildId, i.guild.id));
    return i.reply({ content: "✅ All server XP reset." });
  }
  if (sub === "user_reset") {
    const user = i.options.getUser("user", true);
    await db.delete(xpTable).where(and(eq(xpTable.guildId, i.guild.id), eq(xpTable.userId, user.id)));
    return i.reply({ content: `✅ XP reset for **${user.tag}**.` });
  }

  if (sub === "role_bonus") {
    const role = i.options.getRole("role", true);
    const mult = i.options.getNumber("multiplier", true);
    cfg.bonusRoles.set(role.id, mult);
    return i.reply({ content: `✅ **${role.name}** gets **${mult}x** XP.` });
  }
  if (sub === "channel_bonus") {
    const ch = i.options.getChannel("channel", true);
    const mult = i.options.getNumber("multiplier", true);
    cfg.bonusChannels.set(ch.id, mult);
    return i.reply({ content: `✅ <#${ch.id}> gets **${mult}x** XP.` });
  }
  if (sub === "ignore_channel") { const ch = i.options.getChannel("channel", true); cfg.ignoredChannels.add(ch.id); return i.reply({ content: `✅ <#${ch.id}> ignored from XP.` }); }
  if (sub === "ignore_role") { const r = i.options.getRole("role", true); cfg.ignoredRoles.add(r.id); return i.reply({ content: `✅ **${r.name}** ignored from XP.` }); }
  if (sub === "announce_enable") { cfg.announceEnabled = true; return i.reply({ content: "✅ Level-up announcements enabled." }); }
  if (sub === "announce_disable") { cfg.announceEnabled = false; return i.reply({ content: "🔴 Level-up announcements disabled." }); }
  if (sub === "announce_channel") { cfg.announceChannel = i.options.getChannel("channel", true).id; return i.reply({ content: "✅ Announcement channel set." }); }
  if (sub === "decay_enable") { cfg.decayEnabled = true; return i.reply({ content: "✅ XP decay enabled." }); }
  if (sub === "decay_disable") { cfg.decayEnabled = false; return i.reply({ content: "🔴 XP decay disabled." }); }
  if (sub === "decay_rate") { cfg.decayRate = i.options.getInteger("amount", true); return i.reply({ content: `✅ Decay rate: **${cfg.decayRate}** XP/day.` }); }
}
