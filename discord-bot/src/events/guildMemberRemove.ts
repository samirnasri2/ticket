import { GuildMember, PartialGuildMember } from "discord.js";
import { db, welcomeSettingsTable, serverLogsTable } from "../lib/db.js";
import { eq } from "drizzle-orm";

export async function onGuildMemberRemove(member: GuildMember | PartialGuildMember) {
  const settings = await db.query.welcomeSettingsTable.findFirst({
    where: eq(welcomeSettingsTable.guildId, member.guild.id),
  });

  if (settings?.goodbyeEnabled && settings.goodbyeChannelId) {
    const channel = member.guild.channels.cache.get(settings.goodbyeChannelId);
    if (channel?.isTextBased()) {
      const message = (settings.goodbyeMessage ?? "**{username}** has left **{server}**.")
        .replace("{user}", `<@${member.id}>`)
        .replace("{server}", member.guild.name)
        .replace("{username}", member.user?.username ?? "Unknown");

      await channel.send(message);
    }
  }

  await db.insert(serverLogsTable).values({
    guildId: member.guild.id,
    type: "member_leave",
    description: `${member.user?.tag ?? "Unknown"} left the server`,
    userId: member.id,
    username: member.user?.tag ?? "Unknown",
    metadata: { userId: member.id },
  });
}
