import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  PermissionFlagsBits, EmbedBuilder,
} from "discord.js";
import { askAI } from "../lib/ai.js";

// In-memory config per guild — can be moved to DB
export const automodConfig = new Map<string, {
  enabled: boolean;
  antispam: boolean; spamThreshold: number; spamCooldown: number;
  anticaps: boolean; capsPercent: number;
  antiemoji: boolean; emojiLimit: number;
  antilink: boolean; linkWhitelist: string[];
  antiinvite: boolean;
  antiduplicates: boolean;
  antimentions: boolean; mentionLimit: number;
  antiattachments: boolean;
  profanity: boolean; blacklist: string[]; whitelist: string[];
  antiraid: boolean; raidThreshold: number;
  ghostping: boolean;
  ai: boolean; aiSensitivity: number;
  punish: "warn" | "mute" | "kick" | "ban";
  punishThreshold: number;
  logsChannel: string | null;
  bypassRoles: string[];
  bypassChannels: string[];
}>();

function getConfig(guildId: string) {
  if (!automodConfig.has(guildId)) {
    automodConfig.set(guildId, {
      enabled: false,
      antispam: false, spamThreshold: 5, spamCooldown: 5,
      anticaps: false, capsPercent: 70,
      antiemoji: false, emojiLimit: 10,
      antilink: false, linkWhitelist: [],
      antiinvite: false,
      antiduplicates: false,
      antimentions: false, mentionLimit: 5,
      antiattachments: false,
      profanity: false, blacklist: [], whitelist: [],
      antiraid: false, raidThreshold: 10,
      ghostping: false,
      ai: false, aiSensitivity: 70,
      punish: "warn",
      punishThreshold: 3,
      logsChannel: null,
      bypassRoles: [],
      bypassChannels: [],
    });
  }
  return automodConfig.get(guildId)!;
}

export const automodCommand = new SlashCommandBuilder()
  .setName("automod").setDescription("AutoMod configuration")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

  // config group
  .addSubcommandGroup(g => g.setName("config").setDescription("General automod configuration")
    .addSubcommand(s => s.setName("enable").setDescription("Enable AutoMod"))
    .addSubcommand(s => s.setName("disable").setDescription("Disable AutoMod"))
    .addSubcommand(s => s.setName("status").setDescription("View current AutoMod settings"))
    .addSubcommand(s => s.setName("reset").setDescription("Reset all AutoMod settings to defaults"))
    .addSubcommand(s => s.setName("logs")
      .setDescription("Set the AutoMod logs channel")
      .addChannelOption(o => o.setName("channel").setDescription("Log channel").setRequired(true))))

  // spam group
  .addSubcommandGroup(g => g.setName("spam").setDescription("Spam / caps / emoji / duplicate detection")
    .addSubcommand(s => s.setName("antispam_on").setDescription("Enable anti-spam"))
    .addSubcommand(s => s.setName("antispam_off").setDescription("Disable anti-spam"))
    .addSubcommand(s => s.setName("anticaps").setDescription("Toggle anti-caps")
      .addIntegerOption(o => o.setName("percent").setDescription("Caps percentage to trigger (default 70%)").setMinValue(10).setMaxValue(100)))
    .addSubcommand(s => s.setName("antiemoji").setDescription("Toggle emoji limit")
      .addIntegerOption(o => o.setName("limit").setDescription("Max emojis per message").setMinValue(1).setMaxValue(50)))
    .addSubcommand(s => s.setName("duplicate").setDescription("Toggle duplicate message detection"))
    .addSubcommand(s => s.setName("mentions").setDescription("Toggle mention spam protection")
      .addIntegerOption(o => o.setName("limit").setDescription("Max mentions per message").setMinValue(1).setMaxValue(25)))
    .addSubcommand(s => s.setName("attachments").setDescription("Toggle attachment-only message filtering"))
    .addSubcommand(s => s.setName("ghostping").setDescription("Toggle ghost ping detection"))
    .addSubcommand(s => s.setName("threshold").setDescription("Set spam message threshold")
      .addIntegerOption(o => o.setName("count").setDescription("Messages per window").setRequired(true).setMinValue(2).setMaxValue(30)))
    .addSubcommand(s => s.setName("cooldown").setDescription("Set spam window in seconds")
      .addIntegerOption(o => o.setName("seconds").setDescription("Time window").setRequired(true).setMinValue(1).setMaxValue(60))))

  // link group
  .addSubcommandGroup(g => g.setName("link").setDescription("Link and invite filtering")
    .addSubcommand(s => s.setName("antilink_on").setDescription("Enable anti-link"))
    .addSubcommand(s => s.setName("antilink_off").setDescription("Disable anti-link"))
    .addSubcommand(s => s.setName("invites").setDescription("Toggle Discord invite blocking"))
    .addSubcommand(s => s.setName("whitelist").setDescription("Whitelist a domain")
      .addStringOption(o => o.setName("domain").setDescription("Domain to whitelist (e.g. google.com)").setRequired(true))))

  // profanity group
  .addSubcommandGroup(g => g.setName("profanity").setDescription("Word filter management")
    .addSubcommand(s => s.setName("on").setDescription("Enable profanity filter"))
    .addSubcommand(s => s.setName("off").setDescription("Disable profanity filter"))
    .addSubcommand(s => s.setName("blacklist").setDescription("Add a word to the blacklist")
      .addStringOption(o => o.setName("word").setDescription("Word to block").setRequired(true)))
    .addSubcommand(s => s.setName("whitelist").setDescription("Add a word to the whitelist (allow)")
      .addStringOption(o => o.setName("word").setDescription("Word to allow").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("View filter word lists"))
    .addSubcommand(s => s.setName("remove").setDescription("Remove a word from filter")
      .addStringOption(o => o.setName("word").setDescription("Word to remove").setRequired(true)))
    .addSubcommand(s => s.setName("raid_on").setDescription("Enable anti-raid mode"))
    .addSubcommand(s => s.setName("raid_off").setDescription("Disable anti-raid mode")))

  // punish group
  .addSubcommandGroup(g => g.setName("punish").setDescription("AutoMod punishment settings")
    .addSubcommand(s => s.setName("warn").setDescription("Set punishment to warn"))
    .addSubcommand(s => s.setName("mute").setDescription("Set punishment to mute"))
    .addSubcommand(s => s.setName("kick").setDescription("Set punishment to kick"))
    .addSubcommand(s => s.setName("ban").setDescription("Set punishment to ban"))
    .addSubcommand(s => s.setName("threshold").setDescription("Set violations before punishment")
      .addIntegerOption(o => o.setName("count").setDescription("Number of violations").setRequired(true).setMinValue(1).setMaxValue(20))))

  // ai group
  .addSubcommandGroup(g => g.setName("ai").setDescription("AI-powered AutoMod")
    .addSubcommand(s => s.setName("enable").setDescription("Enable AI moderation"))
    .addSubcommand(s => s.setName("disable").setDescription("Disable AI moderation"))
    .addSubcommand(s => s.setName("sensitivity").setDescription("Set AI sensitivity level")
      .addIntegerOption(o => o.setName("level").setDescription("Sensitivity 0-100").setRequired(true).setMinValue(0).setMaxValue(100)))
    .addSubcommand(s => s.setName("review").setDescription("Review recent AI mod decisions"))
    .addSubcommand(s => s.setName("logs").setDescription("View AI moderation logs"))
    .addSubcommand(s => s.setName("reset").setDescription("Reset AI training data"))
    .addSubcommand(s => s.setName("stats").setDescription("View AI moderation statistics")))

  // bypass group
  .addSubcommandGroup(g => g.setName("bypass").setDescription("Bypass rules for roles/channels")
    .addSubcommand(s => s.setName("add").setDescription("Add bypass for a role or channel")
      .addRoleOption(o => o.setName("role").setDescription("Role to bypass").setRequired(false))
      .addChannelOption(o => o.setName("channel").setDescription("Channel to bypass").setRequired(false)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove bypass")
      .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(false))
      .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(false)))
    .addSubcommand(s => s.setName("list").setDescription("List all bypasses")));

export async function handleAutomod(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const group = i.options.getSubcommandGroup();
  const sub = i.options.getSubcommand();
  const cfg = getConfig(i.guild.id);

  // ── config group ──────────────────────────────────────────────────────────
  if (group === "config") {
    if (sub === "enable") {
      cfg.enabled = true;
      return i.reply({ content: "✅ AutoMod **enabled**." });
    }
    if (sub === "disable") {
      cfg.enabled = false;
      return i.reply({ content: "🔴 AutoMod **disabled**." });
    }
    if (sub === "reset") {
      automodConfig.delete(i.guild.id);
      return i.reply({ content: "🔄 AutoMod settings reset to defaults." });
    }
    if (sub === "logs") {
      const ch = i.options.getChannel("channel", true);
      cfg.logsChannel = ch.id;
      return i.reply({ content: `✅ AutoMod logs set to ${ch}.` });
    }
    if (sub === "status") {
      const embed = new EmbedBuilder().setColor(cfg.enabled ? 0x2ed573 : 0xff4757)
        .setTitle(`🛡️ AutoMod — ${i.guild.name}`)
        .addFields(
          { name: "Status", value: cfg.enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
          { name: "Anti-Spam", value: cfg.antispam ? "✅" : "❌", inline: true },
          { name: "Anti-Caps", value: cfg.anticaps ? "✅" : "❌", inline: true },
          { name: "Anti-Emoji", value: cfg.antiemoji ? "✅" : "❌", inline: true },
          { name: "Anti-Link", value: cfg.antilink ? "✅" : "❌", inline: true },
          { name: "Anti-Invite", value: cfg.antiinvite ? "✅" : "❌", inline: true },
          { name: "Profanity Filter", value: cfg.profanity ? "✅" : "❌", inline: true },
          { name: "Anti-Raid", value: cfg.antiraid ? "✅" : "❌", inline: true },
          { name: "Ghost Ping", value: cfg.ghostping ? "✅" : "❌", inline: true },
          { name: "AI Mod", value: cfg.ai ? `✅ (${cfg.aiSensitivity}%)` : "❌", inline: true },
          { name: "Punishment", value: cfg.punish.toUpperCase(), inline: true },
          { name: "Blacklisted Words", value: cfg.blacklist.length.toString(), inline: true },
        ).setTimestamp();
      return i.reply({ embeds: [embed] });
    }
  }

  // ── spam group ────────────────────────────────────────────────────────────
  if (group === "spam") {
    if (sub === "antispam_on") { cfg.antispam = true; return i.reply({ content: "✅ Anti-spam enabled." }); }
    if (sub === "antispam_off") { cfg.antispam = false; return i.reply({ content: "🔴 Anti-spam disabled." }); }
    if (sub === "anticaps") {
      cfg.anticaps = !cfg.anticaps;
      const pct = i.options.getInteger("percent") ?? cfg.capsPercent;
      cfg.capsPercent = pct;
      return i.reply({ content: `${cfg.anticaps ? "✅" : "🔴"} Anti-caps ${cfg.anticaps ? "enabled" : "disabled"} at ${pct}%.` });
    }
    if (sub === "antiemoji") {
      cfg.antiemoji = !cfg.antiemoji;
      const limit = i.options.getInteger("limit") ?? cfg.emojiLimit;
      cfg.emojiLimit = limit;
      return i.reply({ content: `${cfg.antiemoji ? "✅" : "🔴"} Anti-emoji ${cfg.antiemoji ? "enabled" : "disabled"} (max ${limit}).` });
    }
    if (sub === "duplicate") { cfg.antiduplicates = !cfg.antiduplicates; return i.reply({ content: `${cfg.antiduplicates ? "✅" : "🔴"} Duplicate detection ${cfg.antiduplicates ? "on" : "off"}.` }); }
    if (sub === "mentions") {
      cfg.antimentions = !cfg.antimentions;
      const limit = i.options.getInteger("limit") ?? cfg.mentionLimit;
      cfg.mentionLimit = limit;
      return i.reply({ content: `${cfg.antimentions ? "✅" : "🔴"} Mention limit ${cfg.antimentions ? "enabled" : "disabled"} (max ${limit}).` });
    }
    if (sub === "attachments") { cfg.antiattachments = !cfg.antiattachments; return i.reply({ content: `${cfg.antiattachments ? "✅" : "🔴"} Attachment filter ${cfg.antiattachments ? "on" : "off"}.` }); }
    if (sub === "ghostping") { cfg.ghostping = !cfg.ghostping; return i.reply({ content: `${cfg.ghostping ? "✅" : "🔴"} Ghost ping detection ${cfg.ghostping ? "on" : "off"}.` }); }
    if (sub === "threshold") { cfg.spamThreshold = i.options.getInteger("count", true); return i.reply({ content: `✅ Spam threshold: **${cfg.spamThreshold}** messages per window.` }); }
    if (sub === "cooldown") { cfg.spamCooldown = i.options.getInteger("seconds", true); return i.reply({ content: `✅ Spam window: **${cfg.spamCooldown}s**.` }); }
  }

  // ── link group ────────────────────────────────────────────────────────────
  if (group === "link") {
    if (sub === "antilink_on") { cfg.antilink = true; return i.reply({ content: "✅ Anti-link enabled." }); }
    if (sub === "antilink_off") { cfg.antilink = false; return i.reply({ content: "🔴 Anti-link disabled." }); }
    if (sub === "invites") { cfg.antiinvite = !cfg.antiinvite; return i.reply({ content: `${cfg.antiinvite ? "✅" : "🔴"} Anti-invite ${cfg.antiinvite ? "on" : "off"}.` }); }
    if (sub === "whitelist") {
      const domain = i.options.getString("domain", true);
      if (!cfg.linkWhitelist.includes(domain)) cfg.linkWhitelist.push(domain);
      return i.reply({ content: `✅ **${domain}** added to link whitelist.` });
    }
  }

  // ── profanity group ───────────────────────────────────────────────────────
  if (group === "profanity") {
    if (sub === "on") { cfg.profanity = true; return i.reply({ content: "✅ Profanity filter enabled." }); }
    if (sub === "off") { cfg.profanity = false; return i.reply({ content: "🔴 Profanity filter disabled." }); }
    if (sub === "raid_on") { cfg.antiraid = true; return i.reply({ content: "✅ Anti-raid enabled." }); }
    if (sub === "raid_off") { cfg.antiraid = false; return i.reply({ content: "🔴 Anti-raid disabled." }); }
    if (sub === "blacklist") {
      const word = i.options.getString("word", true).toLowerCase();
      if (!cfg.blacklist.includes(word)) cfg.blacklist.push(word);
      return i.reply({ content: `✅ **${word}** added to blacklist.`, ephemeral: true });
    }
    if (sub === "whitelist") {
      const word = i.options.getString("word", true).toLowerCase();
      if (!cfg.whitelist.includes(word)) cfg.whitelist.push(word);
      return i.reply({ content: `✅ **${word}** whitelisted.`, ephemeral: true });
    }
    if (sub === "remove") {
      const word = i.options.getString("word", true).toLowerCase();
      cfg.blacklist = cfg.blacklist.filter(w => w !== word);
      cfg.whitelist = cfg.whitelist.filter(w => w !== word);
      return i.reply({ content: `✅ **${word}** removed from all lists.`, ephemeral: true });
    }
    if (sub === "list") {
      return i.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("🔤 Word Filter Lists")
        .addFields(
          { name: "🚫 Blacklisted", value: cfg.blacklist.length ? `||${cfg.blacklist.slice(0, 20).join(", ")}||` : "None" },
          { name: "✅ Whitelisted", value: cfg.whitelist.slice(0, 20).join(", ") || "None" },
        )], ephemeral: true });
    }
  }

  // ── punish group ──────────────────────────────────────────────────────────
  if (group === "punish") {
    if (sub === "warn") { cfg.punish = "warn"; return i.reply({ content: "✅ Punishment set to **warn**." }); }
    if (sub === "mute") { cfg.punish = "mute"; return i.reply({ content: "✅ Punishment set to **mute**." }); }
    if (sub === "kick") { cfg.punish = "kick"; return i.reply({ content: "✅ Punishment set to **kick**." }); }
    if (sub === "ban") { cfg.punish = "ban"; return i.reply({ content: "✅ Punishment set to **ban**." }); }
    if (sub === "threshold") { cfg.punishThreshold = i.options.getInteger("count", true); return i.reply({ content: `✅ Punishment threshold: **${cfg.punishThreshold}** violations.` }); }
  }

  // ── ai group ──────────────────────────────────────────────────────────────
  if (group === "ai") {
    if (sub === "enable") { cfg.ai = true; return i.reply({ content: "✅ AI moderation enabled." }); }
    if (sub === "disable") { cfg.ai = false; return i.reply({ content: "🔴 AI moderation disabled." }); }
    if (sub === "sensitivity") {
      cfg.aiSensitivity = i.options.getInteger("level", true);
      return i.reply({ content: `✅ AI sensitivity set to **${cfg.aiSensitivity}%**.` });
    }
    if (sub === "review") return i.reply({ content: "📋 No recent AI decisions to review." });
    if (sub === "logs") return i.reply({ content: "📋 AI moderation log is empty." });
    if (sub === "reset") return i.reply({ content: "🔄 AI training data reset." });
    if (sub === "stats") return i.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("🤖 AI Mod Stats")
      .addFields({ name: "AI Status", value: cfg.ai ? "Active" : "Inactive" }, { name: "Sensitivity", value: `${cfg.aiSensitivity}%` }, { name: "Actions Today", value: "0" })] });
  }

  // ── bypass group ──────────────────────────────────────────────────────────
  if (group === "bypass") {
    if (sub === "add") {
      const role = i.options.getRole("role");
      const ch = i.options.getChannel("channel");
      if (role && !cfg.bypassRoles.includes(role.id)) cfg.bypassRoles.push(role.id);
      if (ch && !cfg.bypassChannels.includes(ch.id)) cfg.bypassChannels.push(ch.id);
      return i.reply({ content: `✅ Bypass added for ${role ? `role **${role.name}**` : ""}${role && ch ? " and " : ""}${ch ? `channel <#${ch.id}>` : ""}.` });
    }
    if (sub === "remove") {
      const role = i.options.getRole("role");
      const ch = i.options.getChannel("channel");
      if (role) cfg.bypassRoles = cfg.bypassRoles.filter(r => r !== role.id);
      if (ch) cfg.bypassChannels = cfg.bypassChannels.filter(c => c !== ch.id);
      return i.reply({ content: "✅ Bypass removed." });
    }
    if (sub === "list") {
      const roles = cfg.bypassRoles.map(r => `<@&${r}>`).join(", ") || "None";
      const channels = cfg.bypassChannels.map(c => `<#${c}>`).join(", ") || "None";
      return i.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("🔓 AutoMod Bypasses")
        .addFields({ name: "Roles", value: roles }, { name: "Channels", value: channels })] });
    }
  }

  await i.reply({ content: "Unknown subcommand.", ephemeral: true });
}
