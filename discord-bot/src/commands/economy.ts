import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  PermissionFlagsBits, EmbedBuilder,
} from "discord.js";
import { db, economyTable, shopItemsTable } from "../lib/db.js";
import { eq, and, desc, sql } from "drizzle-orm";

const C = 0xf1c40f;
const DAILY_AMT = 500, WEEKLY_AMT = 2000, MONTHLY_AMT = 10000;

async function getBalance(guildId: string, userId: string) {
  const row = await db.select().from(economyTable)
    .where(and(eq(economyTable.guildId, guildId), eq(economyTable.userId, userId))).limit(1);
  return row[0] ?? null;
}

async function ensureUser(guildId: string, userId: string) {
  const existing = await getBalance(guildId, userId);
  if (!existing) {
    await db.insert(economyTable).values({ guildId, userId, balance: 0, bank: 0, lastDaily: null, lastWeekly: null, lastMonthly: null });
  }
}

async function addBalance(guildId: string, userId: string, amount: number) {
  await ensureUser(guildId, userId);
  await db.update(economyTable).set({ balance: sql`balance + ${amount}` })
    .where(and(eq(economyTable.guildId, guildId), eq(economyTable.userId, userId)));
}

function cooldownLeft(lastUsed: Date | null, hours: number): number {
  if (!lastUsed) return 0;
  const ms = hours * 60 * 60 * 1000;
  const elapsed = Date.now() - lastUsed.getTime();
  return Math.max(0, ms - elapsed);
}

function msCooldownStr(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Command definitions ──────────────────────────────────────────────────────
export const balanceCommand = new SlashCommandBuilder()
  .setName("balance").setDescription("Check your wallet and bank balance")
  .addUserOption(o => o.setName("user").setDescription("User to check").setRequired(false));

export const payCommand = new SlashCommandBuilder()
  .setName("pay").setDescription("Pay coins to another user")
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
  .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1));

export const dailyCommand = new SlashCommandBuilder().setName("daily").setDescription("Claim your daily reward");
export const weeklyCommand = new SlashCommandBuilder().setName("weekly").setDescription("Claim your weekly reward");
export const monthlyCommand = new SlashCommandBuilder().setName("monthly").setDescription("Claim your monthly reward");

export const workCommand = new SlashCommandBuilder().setName("work").setDescription("Work to earn coins");
export const begCommand = new SlashCommandBuilder().setName("beg").setDescription("Beg for coins");

export const depositCommand = new SlashCommandBuilder()
  .setName("deposit").setDescription("Deposit coins into your bank")
  .addStringOption(o => o.setName("amount").setDescription("Amount or 'all'").setRequired(true));

export const withdrawCommand = new SlashCommandBuilder()
  .setName("withdraw").setDescription("Withdraw coins from your bank")
  .addStringOption(o => o.setName("amount").setDescription("Amount or 'all'").setRequired(true));

export const transferCommand = new SlashCommandBuilder()
  .setName("transfer").setDescription("Transfer coins to another user")
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
  .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1));

export const shopCommand = new SlashCommandBuilder()
  .setName("shop").setDescription("Item shop")
  .addSubcommand(s => s.setName("view").setDescription("Browse the shop"))
  .addSubcommand(s => s.setName("buy").setDescription("Buy an item")
    .addStringOption(o => o.setName("item").setDescription("Item name").setRequired(true)))
  .addSubcommand(s => s.setName("add").setDescription("Add an item to the shop")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName("name").setDescription("Item name").setRequired(true))
    .addIntegerOption(o => o.setName("price").setDescription("Price").setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName("description").setDescription("Description").setRequired(false))
    .addRoleOption(o => o.setName("role").setDescription("Role to give on purchase").setRequired(false)))
  .addSubcommand(s => s.setName("remove").setDescription("Remove an item")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName("name").setDescription("Item name").setRequired(true)));

export const inventoryCommand = new SlashCommandBuilder()
  .setName("inventory").setDescription("View your inventory")
  .addUserOption(o => o.setName("user").setDescription("User").setRequired(false));

export const robCommand = new SlashCommandBuilder()
  .setName("rob").setDescription("Attempt to rob another user")
  .addUserOption(o => o.setName("user").setDescription("User to rob").setRequired(true));

export const heistCommand = new SlashCommandBuilder()
  .setName("heist").setDescription("Start a heist to earn big")
  .addIntegerOption(o => o.setName("bet").setDescription("Amount to bet").setRequired(true).setMinValue(100));

export const gambleCommand = new SlashCommandBuilder()
  .setName("gamble").setDescription("Gambling games")
  .addSubcommand(s => s.setName("coinflip").setDescription("Flip a coin for coins")
    .addIntegerOption(o => o.setName("bet").setDescription("Bet amount").setRequired(true).setMinValue(1)))
  .addSubcommand(s => s.setName("slots").setDescription("Play the slot machine")
    .addIntegerOption(o => o.setName("bet").setDescription("Bet amount").setRequired(true).setMinValue(1)))
  .addSubcommand(s => s.setName("dice").setDescription("Roll the dice")
    .addIntegerOption(o => o.setName("bet").setDescription("Bet amount").setRequired(true).setMinValue(1)));

export const economyAdminCommand = new SlashCommandBuilder()
  .setName("economy").setDescription("Economy administration")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s => s.setName("set").setDescription("Set a user's balance")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(0)))
  .addSubcommand(s => s.setName("add").setDescription("Add coins to a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1)))
  .addSubcommand(s => s.setName("remove").setDescription("Remove coins from a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1)))
  .addSubcommand(s => s.setName("reset").setDescription("Reset a user's economy")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)))
  .addSubcommand(s => s.setName("leaderboard").setDescription("View economy leaderboard"));

// ─── Handlers ─────────────────────────────────────────────────────────────────
export async function handleBalance(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user") ?? i.user;
  await ensureUser(i.guild.id, user.id);
  const row = await getBalance(i.guild.id, user.id);
  const embed = new EmbedBuilder().setColor(C).setTitle(`💰 ${user.username}'s Balance`)
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: "👛 Wallet", value: `🪙 ${(row?.balance ?? 0).toLocaleString()}`, inline: true },
      { name: "🏦 Bank", value: `🪙 ${(row?.bank ?? 0).toLocaleString()}`, inline: true },
      { name: "💎 Total", value: `🪙 ${((row?.balance ?? 0) + (row?.bank ?? 0)).toLocaleString()}`, inline: true },
    );
  await i.reply({ embeds: [embed] });
}

export async function handlePay(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  const amount = i.options.getInteger("amount", true);
  if (user.id === i.user.id) return i.reply({ content: "❌ You can't pay yourself.", ephemeral: true });
  await ensureUser(i.guild.id, i.user.id);
  const row = await getBalance(i.guild.id, i.user.id);
  if (!row || row.balance < amount) return i.reply({ content: "❌ Insufficient funds.", ephemeral: true });
  await db.update(economyTable).set({ balance: sql`balance - ${amount}` }).where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, i.user.id)));
  await addBalance(i.guild.id, user.id, amount);
  await i.reply({ content: `✅ Paid **🪙 ${amount.toLocaleString()}** to **${user.username}**.` });
}

export async function handleDaily(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  await ensureUser(i.guild.id, i.user.id);
  const row = await getBalance(i.guild.id, i.user.id);
  const left = cooldownLeft(row?.lastDaily ?? null, 24);
  if (left > 0) return i.reply({ content: `⏰ Daily resets in **${msCooldownStr(left)}**.`, ephemeral: true });
  await db.update(economyTable).set({ balance: sql`balance + ${DAILY_AMT}`, lastDaily: new Date() })
    .where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, i.user.id)));
  await i.reply({ embeds: [new EmbedBuilder().setColor(C).setTitle("📅 Daily Reward!").setDescription(`You claimed **🪙 ${DAILY_AMT.toLocaleString()}**!`)] });
}

export async function handleWeekly(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  await ensureUser(i.guild.id, i.user.id);
  const row = await getBalance(i.guild.id, i.user.id);
  const left = cooldownLeft(row?.lastWeekly ?? null, 168);
  if (left > 0) return i.reply({ content: `⏰ Weekly resets in **${msCooldownStr(left)}**.`, ephemeral: true });
  await db.update(economyTable).set({ balance: sql`balance + ${WEEKLY_AMT}`, lastWeekly: new Date() })
    .where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, i.user.id)));
  await i.reply({ embeds: [new EmbedBuilder().setColor(C).setTitle("📅 Weekly Reward!").setDescription(`You claimed **🪙 ${WEEKLY_AMT.toLocaleString()}**!`)] });
}

export async function handleMonthly(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  await ensureUser(i.guild.id, i.user.id);
  const row = await getBalance(i.guild.id, i.user.id);
  const left = cooldownLeft(row?.lastMonthly ?? null, 720);
  if (left > 0) return i.reply({ content: `⏰ Monthly resets in **${msCooldownStr(left)}**.`, ephemeral: true });
  await db.update(economyTable).set({ balance: sql`balance + ${MONTHLY_AMT}`, lastMonthly: new Date() })
    .where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, i.user.id)));
  await i.reply({ embeds: [new EmbedBuilder().setColor(C).setTitle("📅 Monthly Reward!").setDescription(`You claimed **🪙 ${MONTHLY_AMT.toLocaleString()}**!`)] });
}

const JOBS = ["🧑‍💻 Programmer", "👨‍🍳 Chef", "🚚 Driver", "🛡️ Guard", "🎨 Artist", "📝 Writer", "🔧 Mechanic"];
export async function handleWork(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  await ensureUser(i.guild.id, i.user.id);
  const earned = 50 + Math.floor(Math.random() * 200);
  const job = JOBS[Math.floor(Math.random() * JOBS.length)];
  await addBalance(i.guild.id, i.user.id, earned);
  await i.reply({ embeds: [new EmbedBuilder().setColor(C).setTitle("💼 Work Complete!").setDescription(`You worked as a **${job}** and earned **🪙 ${earned}**!`)] });
}

export async function handleBeg(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  await ensureUser(i.guild.id, i.user.id);
  if (Math.random() < 0.3) return i.reply({ content: "😔 Nobody gave you anything..." });
  const earned = 1 + Math.floor(Math.random() * 50);
  await addBalance(i.guild.id, i.user.id, earned);
  await i.reply({ content: `🥺 Someone felt generous and gave you **🪙 ${earned}**!` });
}

export async function handleDeposit(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  await ensureUser(i.guild.id, i.user.id);
  const row = await getBalance(i.guild.id, i.user.id);
  if (!row) return;
  const raw = i.options.getString("amount", true);
  const amount = raw.toLowerCase() === "all" ? row.balance : parseInt(raw);
  if (isNaN(amount) || amount <= 0) return i.reply({ content: "❌ Invalid amount.", ephemeral: true });
  if (row.balance < amount) return i.reply({ content: "❌ Not enough in wallet.", ephemeral: true });
  await db.update(economyTable).set({ balance: sql`balance - ${amount}`, bank: sql`bank + ${amount}` })
    .where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, i.user.id)));
  await i.reply({ content: `✅ Deposited **🪙 ${amount.toLocaleString()}** into your bank.` });
}

export async function handleWithdraw(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  await ensureUser(i.guild.id, i.user.id);
  const row = await getBalance(i.guild.id, i.user.id);
  if (!row) return;
  const raw = i.options.getString("amount", true);
  const amount = raw.toLowerCase() === "all" ? row.bank : parseInt(raw);
  if (isNaN(amount) || amount <= 0) return i.reply({ content: "❌ Invalid amount.", ephemeral: true });
  if (row.bank < amount) return i.reply({ content: "❌ Not enough in bank.", ephemeral: true });
  await db.update(economyTable).set({ balance: sql`balance + ${amount}`, bank: sql`bank - ${amount}` })
    .where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, i.user.id)));
  await i.reply({ content: `✅ Withdrew **🪙 ${amount.toLocaleString()}** from your bank.` });
}

export async function handleTransfer(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  const amount = i.options.getInteger("amount", true);
  if (user.id === i.user.id) return i.reply({ content: "❌ Can't transfer to yourself.", ephemeral: true });
  await ensureUser(i.guild.id, i.user.id);
  const row = await getBalance(i.guild.id, i.user.id);
  if (!row || row.balance < amount) return i.reply({ content: "❌ Insufficient funds.", ephemeral: true });
  await db.update(economyTable).set({ balance: sql`balance - ${amount}` }).where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, i.user.id)));
  await addBalance(i.guild.id, user.id, amount);
  await i.reply({ content: `✅ Transferred **🪙 ${amount.toLocaleString()}** to **${user.username}**.` });
}

export async function handleShop(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  if (sub === "view") {
    const items = await db.select().from(shopItemsTable).where(eq(shopItemsTable.guildId, i.guild.id));
    const embed = new EmbedBuilder().setColor(C).setTitle("🛒 Shop")
      .setDescription(items.length === 0 ? "No items for sale." : items.map(it =>
        `**${it.name}** — 🪙 ${it.price.toLocaleString()}\n${it.description ?? ""}${it.roleId ? ` → <@&${it.roleId}>` : ""}`
      ).join("\n\n"));
    return i.reply({ embeds: [embed] });
  }
  if (sub === "buy") {
    const name = i.options.getString("item", true);
    const item = (await db.select().from(shopItemsTable).where(and(eq(shopItemsTable.guildId, i.guild.id), eq(shopItemsTable.name, name))))[0];
    if (!item) return i.reply({ content: "❌ Item not found.", ephemeral: true });
    await ensureUser(i.guild.id, i.user.id);
    const row = await getBalance(i.guild.id, i.user.id);
    if (!row || row.balance < item.price) return i.reply({ content: "❌ Not enough coins.", ephemeral: true });
    await db.update(economyTable).set({ balance: sql`balance - ${item.price}` }).where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, i.user.id)));
    if (item.roleId) {
      const member = await i.guild.members.fetch(i.user.id).catch(() => null);
      if (member) await member.roles.add(item.roleId).catch(() => {});
    }
    return i.reply({ content: `✅ Purchased **${item.name}** for 🪙 ${item.price.toLocaleString()}!` });
  }
  if (sub === "add") {
    const name = i.options.getString("name", true);
    const price = i.options.getInteger("price", true);
    const description = i.options.getString("description") ?? null;
    const role = i.options.getRole("role");
    await db.insert(shopItemsTable).values({ guildId: i.guild.id, name, price, description, roleId: role?.id ?? null });
    return i.reply({ content: `✅ Added **${name}** to shop for 🪙 ${price.toLocaleString()}.` });
  }
  if (sub === "remove") {
    const name = i.options.getString("name", true);
    await db.delete(shopItemsTable).where(and(eq(shopItemsTable.guildId, i.guild.id), eq(shopItemsTable.name, name)));
    return i.reply({ content: `✅ Removed **${name}** from shop.` });
  }
}

export async function handleInventory(i: ChatInputCommandInteraction) {
  await i.reply({ content: "🎒 Your inventory is empty. Buy items from /shop!" });
}

export async function handleRob(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const user = i.options.getUser("user", true);
  if (user.id === i.user.id) return i.reply({ content: "❌ Can't rob yourself.", ephemeral: true });
  await ensureUser(i.guild.id, user.id);
  await ensureUser(i.guild.id, i.user.id);
  const target = await getBalance(i.guild.id, user.id);
  if (!target || target.balance < 100) return i.reply({ content: "❌ Target has less than 100 coins — not worth it." });
  if (Math.random() < 0.4) {
    const fine = Math.floor(Math.random() * 200) + 50;
    await db.update(economyTable).set({ balance: sql`GREATEST(0, balance - ${fine})` }).where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, i.user.id)));
    return i.reply({ content: `🚔 You got caught! Paid a fine of **🪙 ${fine}**.` });
  }
  const stolen = Math.floor(target.balance * (0.1 + Math.random() * 0.2));
  await db.update(economyTable).set({ balance: sql`balance - ${stolen}` }).where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, user.id)));
  await addBalance(i.guild.id, i.user.id, stolen);
  await i.reply({ content: `💰 You robbed **${user.username}** for **🪙 ${stolen.toLocaleString()}**!` });
}

export async function handleHeist(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const bet = i.options.getInteger("bet", true);
  await ensureUser(i.guild.id, i.user.id);
  const row = await getBalance(i.guild.id, i.user.id);
  if (!row || row.balance < bet) return i.reply({ content: "❌ Insufficient funds.", ephemeral: true });
  const success = Math.random() > 0.45;
  const multiplier = 1.5 + Math.random() * 2;
  if (success) {
    const won = Math.floor(bet * multiplier);
    await addBalance(i.guild.id, i.user.id, won - bet);
    await i.reply({ embeds: [new EmbedBuilder().setColor(0x2ed573).setTitle("🏦 Heist Success!").setDescription(`You pulled off the heist and earned **🪙 ${won.toLocaleString()}**! (${multiplier.toFixed(1)}x)`)] });
  } else {
    await db.update(economyTable).set({ balance: sql`GREATEST(0, balance - ${bet})` }).where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, i.user.id)));
    await i.reply({ embeds: [new EmbedBuilder().setColor(0xff4757).setTitle("🚔 Heist Failed!").setDescription(`You lost **🪙 ${bet.toLocaleString()}**. Better luck next time.`)] });
  }
}

export async function handleGamble(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  const bet = i.options.getInteger("bet", true);
  await ensureUser(i.guild.id, i.user.id);
  const row = await getBalance(i.guild.id, i.user.id);
  if (!row || row.balance < bet) return i.reply({ content: "❌ Not enough coins.", ephemeral: true });

  if (sub === "coinflip") {
    const win = Math.random() < 0.5;
    if (win) { await addBalance(i.guild.id, i.user.id, bet); return i.reply({ content: `🪙 **Heads!** You won **🪙 ${bet.toLocaleString()}**!` }); }
    else { await db.update(economyTable).set({ balance: sql`balance - ${bet}` }).where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, i.user.id))); return i.reply({ content: `🪙 **Tails!** You lost **🪙 ${bet.toLocaleString()}**.` }); }
  }
  if (sub === "slots") {
    const SYMS = ["🍎", "🍋", "🍇", "💎", "7️⃣", "⭐"];
    const reels = [SYMS[Math.floor(Math.random() * SYMS.length)], SYMS[Math.floor(Math.random() * SYMS.length)], SYMS[Math.floor(Math.random() * SYMS.length)]];
    const allSame = reels[0] === reels[1] && reels[1] === reels[2];
    const twoSame = reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2];
    const win = allSame ? bet * 5 : twoSame ? bet : 0;
    if (win > 0) { await addBalance(i.guild.id, i.user.id, win - bet); return i.reply({ content: `🎰 ${reels.join(" | ")}\n${allSame ? "🎉 JACKPOT! " : "✨ Match! "}Won **🪙 ${win.toLocaleString()}**!` }); }
    else { await db.update(economyTable).set({ balance: sql`balance - ${bet}` }).where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, i.user.id))); return i.reply({ content: `🎰 ${reels.join(" | ")}\nNo match. Lost **🪙 ${bet.toLocaleString()}**.` }); }
  }
  if (sub === "dice") {
    const roll = Math.ceil(Math.random() * 6);
    const botRoll = Math.ceil(Math.random() * 6);
    if (roll > botRoll) { await addBalance(i.guild.id, i.user.id, bet); return i.reply({ content: `🎲 You: **${roll}** vs Bot: **${botRoll}** — You win **🪙 ${bet.toLocaleString()}**!` }); }
    else if (roll < botRoll) { await db.update(economyTable).set({ balance: sql`balance - ${bet}` }).where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, i.user.id))); return i.reply({ content: `🎲 You: **${roll}** vs Bot: **${botRoll}** — You lose **🪙 ${bet.toLocaleString()}**.` }); }
    else return i.reply({ content: `🎲 You: **${roll}** vs Bot: **${botRoll}** — Tie! No change.` });
  }
}

export async function handleEconomyAdmin(i: ChatInputCommandInteraction) {
  if (!i.guild) return;
  const sub = i.options.getSubcommand();
  if (sub === "leaderboard") {
    const rows = await db.select().from(economyTable).where(eq(economyTable.guildId, i.guild.id)).orderBy(desc(sql`balance + bank`)).limit(10);
    const embed = new EmbedBuilder().setColor(C).setTitle(`💰 Economy Leaderboard — ${i.guild.name}`)
      .setDescription(rows.length === 0 ? "No data." : rows.map((r, idx) => `**${idx + 1}.** <@${r.userId}> — 🪙 ${((r.balance ?? 0) + (r.bank ?? 0)).toLocaleString()}`).join("\n"));
    return i.reply({ embeds: [embed] });
  }
  const user = i.options.getUser("user", true);
  await ensureUser(i.guild.id, user.id);
  if (sub === "set") {
    const amount = i.options.getInteger("amount", true);
    await db.update(economyTable).set({ balance: amount }).where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, user.id)));
    return i.reply({ content: `✅ **${user.tag}**'s balance set to 🪙 ${amount.toLocaleString()}.` });
  }
  if (sub === "add") {
    await addBalance(i.guild.id, user.id, i.options.getInteger("amount", true));
    return i.reply({ content: `✅ Added 🪙 ${i.options.getInteger("amount", true)?.toLocaleString()} to **${user.tag}**.` });
  }
  if (sub === "remove") {
    const amount = i.options.getInteger("amount", true);
    await db.update(economyTable).set({ balance: sql`GREATEST(0, balance - ${amount})` }).where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, user.id)));
    return i.reply({ content: `✅ Removed 🪙 ${amount.toLocaleString()} from **${user.tag}**.` });
  }
  if (sub === "reset") {
    await db.delete(economyTable).where(and(eq(economyTable.guildId, i.guild.id), eq(economyTable.userId, user.id)));
    return i.reply({ content: `✅ Economy reset for **${user.tag}**.` });
  }
}
