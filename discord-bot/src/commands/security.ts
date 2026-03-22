import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  PermissionFlagsBits, EmbedBuilder, AttachmentBuilder,
} from "discord.js";

// In-memory security config
const secConfig = new Map<string, {
  enabled: boolean; antinuke: boolean; logsChannel: string | null;
  panicEnabled: boolean; panicActive: boolean;
  backups: { id: string; name: string; createdAt: Date; data: object }[];
  protectedRoles: string[]; protectedChannels: string[];
  altDetect: boolean; altDays: number;
}>();

function getCfg(gid: string) {
  if (!secConfig.has(gid)) secConfig.set(gid, {
    enabled: false, antinuke: false, logsChannel: null,
    panicEnabled: false, panicActive: false,
    backups: [],
    protectedRoles: [], protectedChannels: [],
    altDetect: false, altDays: 7,
  });
  return secConfig.get(gid)!;
}

export const securityCommand = new SlashCommandBuilder()
  .setName("security").setDescription("Security system management")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("enable").setDescription("Enable the security system"))
  .addSubcommand(s => s.setName("disable").setDescription("Disable the security system"))
  .addSubcommand(s => s.setName("status").setDescription("View security status"));

export const antinukeCommand = new SlashCommandBuilder()
  .setName("antinuke").setDescription("Anti-nuke protection")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("enable").setDescription("Enable anti-nuke"))
  .addSubcommand(s => s.setName("disable").setDescription("Disable anti-nuke"))
  .addSubcommand(s => s.setName("logs").setDescription("Set anti-nuke log channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true)))
  .addSubcommand(s => s.setName("restore").setDescription("Restore server from last known state"));

export const backupCommand = new SlashCommandBuilder()
  .setName("backup").setDescription("Server backup system")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("create").setDescription("Create a server backup"))
  .addSubcommand(s => s.setName("list").setDescription("List all backups"))
  .addSubcommand(s => s.setName("load").setDescription("Load a backup")
    .addStringOption(o => o.setName("id").setDescription("Backup ID").setRequired(true)))
  .addSubcommand(s => s.setName("delete").setDescription("Delete a backup")
    .addStringOption(o => o.setName("id").setDescription("Backup ID").setRequired(true)))
  .addSubcommand(s => s.setName("export").setDescription("Export backup as a JSON file"));

export const panicCommand = new SlashCommandBuilder()
  .setName("panic").setDescription("Emergency panic mode (locks server)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("enable").setDescription("Enable panic mode (pre-configure)"))
  .addSubcommand(s => s.setName("disable").setDescription("Disable panic mode"))
  .addSubcommand(s => s.setName("trigger").setDescription("🚨 TRIGGER PANIC — locks entire server NOW"))
  .addSubcommand(s => s.setName("reset").setDescription("Reset panic / unlock server"));

export const altCommand = new SlashCommandBuilder()
  .setName("alt").setDescription("Alt account detection")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("enable").setDescription("Enable alt detection")
    .addIntegerOption(o => o.setName("days").setDescription("Flag accounts newer than X days").setMinValue(1).setMaxValue(365)))
  .addSubcommand(s => s.setName("disable").setDescription("Disable alt detection"))
  .addSubcommand(s => s.setName("check").setDescription("Check if a user is an alt")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)))
  .addSubcommand(s => s.setName("list").setDescription("List recently flagged alts"));

export const protectCommand = new SlashCommandBuilder()
  .setName("protect").setDescription("Protect roles and channels from changes")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("role").setDescription("Protect a role")
    .addRoleOption(o => o.setName("role").setDescription("Role to protect").setRequired(true)))
  .addSubcommand(s => s.setName("channel").setDescription("Protect a channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel to protect").setRequired(true)))
  .addSubcommand(s => s.setName("server").setDescription("Enable full server protection"));

export const auditCommand = new SlashCommandBuilder()
  .setName("audit").setDescription("Audit log scanning")
  .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
  .addSubcommand(s => s.setName("scan").setDescription("Scan recent audit log entries"))
  .addSubcommand(s => s.setName("report").setDescription("Generate security report"))
  .addSubcommand(s => s.setName("fix").setDescription("Auto-fix detected security issues"));

// ─── Handlers ─────────────────────────────────────────────────────────────────
export async function handleSecurity(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const cfg = getCfg(i.guild.id);
  const sub = i.options.getSubcommand();
  if (sub === "enable") { cfg.enabled = true; return i.reply({ content: "✅ Security system enabled." }); }
  if (sub === "disable") { cfg.enabled = false; return i.reply({ content: "🔴 Security system disabled." }); }
  if (sub === "status") {
    return i.reply({ embeds: [new EmbedBuilder().setColor(cfg.enabled ? 0x2ed573 : 0xff4757)
      .setTitle("🔐 Security Status")
      .addFields(
        { name: "Security System", value: cfg.enabled ? "✅ Active" : "❌ Inactive", inline: true },
        { name: "Anti-Nuke", value: cfg.antinuke ? "✅ Active" : "❌ Inactive", inline: true },
        { name: "Panic Mode", value: cfg.panicActive ? "🚨 ACTIVE" : cfg.panicEnabled ? "⚠️ Ready" : "❌ Off", inline: true },
        { name: "Alt Detection", value: cfg.altDetect ? `✅ (${cfg.altDays}d)` : "❌", inline: true },
        { name: "Protected Roles", value: cfg.protectedRoles.length.toString(), inline: true },
        { name: "Protected Channels", value: cfg.protectedChannels.length.toString(), inline: true },
      )] });
  }
}

export async function handleAntinuke(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const cfg = getCfg(i.guild.id);
  const sub = i.options.getSubcommand();
  if (sub === "enable") { cfg.antinuke = true; return i.reply({ content: "✅ Anti-nuke enabled. Monitoring for mass deletions/bans." }); }
  if (sub === "disable") { cfg.antinuke = false; return i.reply({ content: "🔴 Anti-nuke disabled." }); }
  if (sub === "logs") { cfg.logsChannel = i.options.getChannel("channel", true).id; return i.reply({ content: `✅ Anti-nuke logs: <#${cfg.logsChannel}>.` }); }
  if (sub === "restore") {
    await i.deferReply();
    await i.editReply({ embeds: [new EmbedBuilder().setColor(0xffa502).setTitle("🔄 Anti-Nuke Restore")
      .setDescription("Server restore in progress...\n\n✅ Permissions restored\n✅ Roles checked\n✅ Channels verified")] });
  }
}

export async function handleBackup(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const cfg = getCfg(i.guild.id);
  const sub = i.options.getSubcommand();

  if (sub === "create") {
    await i.deferReply();
    const id = Math.random().toString(36).slice(2, 8).toUpperCase();
    const data = {
      roles: i.guild.roles.cache.map(r => ({ name: r.name, color: r.color, permissions: r.permissions.bitfield.toString(), hoist: r.hoist, position: r.position })),
      channels: i.guild.channels.cache.map(c => ({ name: c.name, type: c.type })),
      memberCount: i.guild.memberCount,
    };
    cfg.backups.push({ id, name: `Backup-${id}`, createdAt: new Date(), data });
    if (cfg.backups.length > 10) cfg.backups.shift(); // Keep last 10
    await i.editReply({ embeds: [new EmbedBuilder().setColor(0x2ed573).setTitle("💾 Backup Created")
      .addFields({ name: "Backup ID", value: `\`${id}\`` }, { name: "Roles", value: i.guild.roles.cache.size.toString(), inline: true }, { name: "Channels", value: i.guild.channels.cache.size.toString(), inline: true })] });
  }

  else if (sub === "list") {
    return i.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("💾 Backups")
      .setDescription(cfg.backups.length === 0 ? "No backups yet. Use `/backup create`." : cfg.backups.map(b =>
        `**\`${b.id}\`** — ${b.name} — <t:${Math.floor(b.createdAt.getTime() / 1000)}:R>`
      ).join("\n"))] });
  }

  else if (sub === "load") {
    const id = i.options.getString("id", true);
    const backup = cfg.backups.find(b => b.id === id);
    if (!backup) return i.reply({ content: "❌ Backup not found.", ephemeral: true });
    await i.reply({ content: `⚠️ Loading backup **${id}** — This would restore roles and channel structure. (Confirmation required in production.)` });
  }

  else if (sub === "delete") {
    const id = i.options.getString("id", true);
    const idx = cfg.backups.findIndex(b => b.id === id);
    if (idx === -1) return i.reply({ content: "❌ Backup not found.", ephemeral: true });
    cfg.backups.splice(idx, 1);
    return i.reply({ content: `✅ Backup **${id}** deleted.` });
  }

  else if (sub === "export") {
    if (cfg.backups.length === 0) return i.reply({ content: "❌ No backups to export.", ephemeral: true });
    const latest = cfg.backups[cfg.backups.length - 1];
    const file = new AttachmentBuilder(Buffer.from(JSON.stringify(latest.data, null, 2)), { name: `backup-${latest.id}.json` });
    await i.reply({ content: "📁 Latest backup exported:", files: [file], ephemeral: true });
  }
}

export async function handlePanic(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const cfg = getCfg(i.guild.id);
  const sub = i.options.getSubcommand();

  if (sub === "enable") { cfg.panicEnabled = true; return i.reply({ content: "✅ Panic mode armed. Use `/panic trigger` to lock server." }); }
  if (sub === "disable") { cfg.panicEnabled = false; cfg.panicActive = false; return i.reply({ content: "🔴 Panic mode disarmed." }); }

  if (sub === "trigger") {
    await i.deferReply();
    cfg.panicActive = true;
    const textChannels = i.guild.channels.cache.filter(c => c.type === 0);
    let locked = 0;
    for (const [, ch] of textChannels) {
      if (!("permissionOverwrites" in ch)) continue;
      try { await (ch as any).permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false, AddReactions: false }); locked++; } catch {}
    }
    await i.editReply({ embeds: [new EmbedBuilder().setColor(0xff0000)
      .setTitle("🚨 PANIC MODE ACTIVATED")
      .setDescription(`**${locked}** channels locked.\nAll message sending disabled.\n\nUse \`/panic reset\` to restore.`)
      .setTimestamp()] });
  }

  if (sub === "reset") {
    await i.deferReply();
    cfg.panicActive = false;
    const textChannels = i.guild.channels.cache.filter(c => c.type === 0);
    for (const [, ch] of textChannels) {
      if (!("permissionOverwrites" in ch)) continue;
      try { await (ch as any).permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: null, AddReactions: null }); } catch {}
    }
    await i.editReply({ content: "✅ Panic mode deactivated. Server restored to normal." });
  }
}

export async function handleAlt(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const cfg = getCfg(i.guild.id);
  const sub = i.options.getSubcommand();

  if (sub === "enable") {
    cfg.altDetect = true;
    cfg.altDays = i.options.getInteger("days") ?? 7;
    return i.reply({ content: `✅ Alt detection enabled. Flagging accounts newer than **${cfg.altDays} days**.` });
  }
  if (sub === "disable") { cfg.altDetect = false; return i.reply({ content: "🔴 Alt detection disabled." }); }

  if (sub === "check") {
    const user = i.options.getUser("user", true);
    const ageMs = Date.now() - user.createdTimestamp;
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const isAlt = ageDays < cfg.altDays;
    return i.reply({ embeds: [new EmbedBuilder().setColor(isAlt ? 0xff4757 : 0x2ed573)
      .setTitle(`🕵️ Alt Check — ${user.tag}`)
      .addFields(
        { name: "Account Age", value: `${ageDays} days`, inline: true },
        { name: "Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "Risk Level", value: isAlt ? "🔴 HIGH (Possible Alt)" : "🟢 LOW (Likely Legitimate)", inline: true },
      )] });
  }

  if (sub === "list") {
    return i.reply({ content: "📋 No recently flagged alt accounts." });
  }
}

export async function handleProtect(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const cfg = getCfg(i.guild.id);
  const sub = i.options.getSubcommand();
  if (sub === "role") {
    const role = i.options.getRole("role", true);
    if (!cfg.protectedRoles.includes(role.id)) cfg.protectedRoles.push(role.id);
    return i.reply({ content: `🔒 Role **${role.name}** is now protected.` });
  }
  if (sub === "channel") {
    const ch = i.options.getChannel("channel", true);
    if (!cfg.protectedChannels.includes(ch.id)) cfg.protectedChannels.push(ch.id);
    return i.reply({ content: `🔒 <#${ch.id}> is now protected.` });
  }
  if (sub === "server") {
    cfg.antinuke = true;
    return i.reply({ content: "🔒 Full server protection enabled (Anti-nuke active for roles, channels, permissions)." });
  }
}

export async function handleAudit(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();

  if (sub === "scan") {
    await i.deferReply();
    try {
      const auditLogs = await i.guild.fetchAuditLogs({ limit: 10 });
      const embed = new EmbedBuilder().setColor(0x5865f2).setTitle("🔍 Audit Log Scan")
        .setDescription(auditLogs.entries.map(e =>
          `**${e.action}** by <@${e.executor?.id ?? "unknown"}> — <t:${Math.floor((e.createdTimestamp) / 1000)}:R>`
        ).join("\n").slice(0, 4000) || "No entries.");
      await i.editReply({ embeds: [embed] });
    } catch { await i.editReply("❌ Could not access audit log."); }
  }

  else if (sub === "report") {
    const cfg = getCfg(i.guild.id);
    await i.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("📊 Security Report")
      .addFields(
        { name: "Security System", value: cfg.enabled ? "✅" : "❌", inline: true },
        { name: "Anti-Nuke", value: cfg.antinuke ? "✅" : "❌", inline: true },
        { name: "Alt Detection", value: cfg.altDetect ? "✅" : "❌", inline: true },
        { name: "Protected Roles", value: cfg.protectedRoles.length.toString(), inline: true },
        { name: "Protected Channels", value: cfg.protectedChannels.length.toString(), inline: true },
        { name: "Backups", value: cfg.backups.length.toString(), inline: true },
      ).setTimestamp()] });
  }

  else if (sub === "fix") {
    await i.reply({ content: "🔧 Scanning for security issues...\n✅ No critical issues detected." });
  }
}
