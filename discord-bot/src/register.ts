import { REST, Routes } from "discord.js";

// Moderation
import { banCommand, unbanCommand, kickCommand, softbanCommand, hardbanCommand, timeoutCommand, untimeoutCommand, muteCommand, unmuteCommand } from "./commands/moderation.js";
// Warn
import { warnCommand, warningsCommand } from "./commands/warn.js";
// Purge/Clear
import { purgeCommand, clearCommand } from "./commands/purge.js";
// Channel
import { lockCommand, unlockCommand, lockdownCommand, unlockdownCommand, slowmodeCommand, hidechannelCommand, showchannelCommand, archivechannelCommand, unarchivechannelCommand, clonechannelCommand, clonecategoryCommand } from "./commands/channel.js";
// Mass
import { massbanCommand, masskickCommand, massmuteCommand, moveallCommand, disconnectallCommand } from "./commands/mass.js";
// Role
import { roleCommand } from "./commands/role.js";
// User
import { nickCommand, resetnickCommand, forcenickCommand, forceroleCommand, unforceroleCommand, jailCommand, unjailCommand } from "./commands/user.js";
// Logs
import { modlogsCommand, appealCommand, reasonCommand } from "./commands/logs.js";
// AI
import { aiCommand, translateCommand, summarizeCommand, codeCommand } from "./commands/ai.js";
// Giveaway
import { giveawayCommand } from "./commands/giveaway.js";
// Utility
import { pingCommand, serverinfoCommand, userinfoCommand, avatarCommand, pollCommand, eightballCommand, coinflipCommand, jokeCommand } from "./commands/utility.js";
// Dashboard
import { dashboardCommand } from "./commands/dashboard.js";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
if (!token || !clientId) throw new Error("DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID are required");

const commands = [
  // Moderation
  banCommand, unbanCommand, kickCommand, softbanCommand, hardbanCommand,
  timeoutCommand, untimeoutCommand, muteCommand, unmuteCommand,
  // Warn
  warnCommand, warningsCommand,
  // Purge/Clear
  purgeCommand, clearCommand,
  // Channel
  lockCommand, unlockCommand, lockdownCommand, unlockdownCommand,
  slowmodeCommand, hidechannelCommand, showchannelCommand,
  archivechannelCommand, unarchivechannelCommand,
  clonechannelCommand, clonecategoryCommand,
  // Mass
  massbanCommand, masskickCommand, massmuteCommand, moveallCommand, disconnectallCommand,
  // Role
  roleCommand,
  // User
  nickCommand, resetnickCommand, forcenickCommand,
  forceroleCommand, unforceroleCommand,
  jailCommand, unjailCommand,
  // Logs
  modlogsCommand, appealCommand, reasonCommand,
  // AI
  aiCommand, translateCommand, summarizeCommand, codeCommand,
  // Giveaway
  giveawayCommand,
  // Utility
  pingCommand, serverinfoCommand, userinfoCommand, avatarCommand,
  pollCommand, eightballCommand, coinflipCommand, jokeCommand,
  // Dashboard
  dashboardCommand,
].map(c => c.toJSON());

const rest = new REST().setToken(token);
console.log(`Registering ${commands.length} slash commands globally...`);
const data = await rest.put(Routes.applicationCommands(clientId), { body: commands }) as unknown[];
console.log(`✅ Successfully registered ${data.length} application commands.`);
