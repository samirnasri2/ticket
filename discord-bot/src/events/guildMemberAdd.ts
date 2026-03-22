import { GuildMember } from "discord.js";
import { db, welcomeSettingsTable, serverLogsTable } from "../lib/db.js";
import { eq } from "drizzle-orm";

export async function onGuildMemberAdd(member: GuildMember) {
  const settings = await db.query.welcomeSettingsTable.findFirst({
    where: eq(welcomeSettingsTable.guildId, member.guild.id),
  });

  if (settings?.autoRoleId) {
    try {
      await member.roles.add(settings.autoRoleId);
    } catch {
      console.error("Failed to add auto role to", member.user.tag);
    }
  }

  if (settings?.welcomeEnabled && settings.welcomeChannelId) {
    const channel = member.guild.channels.cache.get(settings.welcomeChannelId);
    if (channel?.isTextBased()) {
      const message = (settings.welcomeMessage ?? "Welcome {user} to **{server}**!")
        .replace("{user}", `<@${member.id}>`)
        .replace("{server}", member.guild.name)
        .replace("{username}", member.user.username)
        .replace("{count}", member.guild.memberCount.toString());

      await channel.send(message);
    }
  }

  await db.insert(serverLogsTable).values({
    guildId: member.guild.id,
    type: "member_join",
    description: `${member.user.tag} joined the server`,
    userId: member.id,
    username: member.user.tag,
    metadata: { userId: member.id, username: member.user.tag },
  });
}
