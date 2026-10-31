
require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    EmbedBuilder,
    REST,
    Routes,
    SlashCommandBuilder,
    ActivityType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// ===============================
// VEXORA MODERATION CONFIG
// ===============================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || "";

if (!TOKEN || !CLIENT_ID) {
    throw new Error("Missing DISCORD_TOKEN or CLIENT_ID in .env");
}

const PREFIX = "!";
const COLOR = "#8B5CF6";
const WARN_FILE = path.join(__dirname, "warnings.json");

const BAD_WORDS = ["badword1", "badword2"];

const warnings = fs.existsSync(WARN_FILE)
    ? JSON.parse(fs.readFileSync(WARN_FILE, "utf8"))
    : {};

const spamTracker = new Map();

// ===============================
// CLIENT
// ===============================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ===============================
// EMBED FUNCTION
// ===============================

function createEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`VEXORA | ${title}`)
        .setDescription(description)
        .setFooter({ text: "Vexora Moderation System" })
        .setTimestamp();
}

// ===============================
// LOG SYSTEM
// ===============================

async function sendLog(guild, title, description) {
    if (!LOG_CHANNEL_ID) return;

    const channel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;

    await channel.send({
        embeds: [createEmbed(title, description)]
    }).catch(console.error);
}

// ===============================
// SLASH COMMANDS
// ===============================

const commands = [

    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Check Vexora latency"),

    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Show Vexora commands"),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a member")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Member to ban")
                .setRequired(true))
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")),

    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a member")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Member to kick")
                .setRequired(true))
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")),

    new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Timeout a member")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Member")
                .setRequired(true))
        .addIntegerOption(o =>
            o.setName("minutes")
                .setDescription("Timeout duration")
                .setMinValue(1)
                .setMaxValue(40320)
                .setRequired(true))
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")),

    new SlashCommandBuilder()
        .setName("untimeout")
        .setDescription("Remove a timeout")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Member")
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a member")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Member")
                .setRequired(true))
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("View member warnings")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Member")
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Delete messages")
        .addIntegerOption(o =>
            o.setName("amount")
                .setDescription("Number of messages")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName("purge")
        .setDescription("Delete messages from a member")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Member")
                .setRequired(true))
        .addIntegerOption(o =>
            o.setName("amount")
                .setDescription("Number of messages")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Lock current channel"),

    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Unlock current channel"),

    new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Show member information")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Member")
                .setRequired(true))
];

// ===============================
// REGISTER COMMANDS
// ===============================

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands.map(command => command.toJSON()) }
    );

    console.log("Vexora slash commands registered!");
}

// ===============================
// READY
// ===============================

client.once("ready", async () => {
    console.log(`Vexora Moderation online: ${client.user.tag}`);

    client.user.setPresence({
        activities: [{
            name: "your server | Vexora",
            type: ActivityType.Watching
        }],
        status: "online"
    });

    try {
        await registerCommands();
    } catch (error) {
        console.error("Command registration error:", error);
    }
});

// ===============================
// INTERACTION HANDLER
// ===============================

client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) return;

    const { commandName, guild, member } = interaction;

    const user = interaction.options.getUser("member");
    const target = user
        ? await guild.members.fetch(user.id).catch(() => null)
        : null;

    const reason =
        interaction.options.getString("reason") || "No reason provided";

    const hasPermission = permission =>
        member.permissions.has(permission);

    const reply = content =>
        interaction.reply({
            content,
            ephemeral: true
        });

    try {

        // PING
        if (commandName === "ping") {
            return reply(`🏓 Pong! ${client.ws.ping}ms`);
        }

        // HELP
        if (commandName === "help") {
            const embed = createEmbed(
                "COMMANDS",
                "**Moderation**\n" +
                "`/ban` `/kick` `/timeout` `/untimeout`\n" +
                "`/warn` `/warnings` `/clear` `/purge`\n\n" +
                "**Channels**\n" +
                "`/lock` `/unlock`\n\n" +
                "**Information**\n" +
                "`/userinfo` `/ping` `/help`"
            );

            return interaction.reply({ embeds: [embed] });
        }

        // BAN
        if (commandName === "ban") {
            if (!hasPermission(PermissionsBitField.Flags.BanMembers))
                return reply("❌ You need Ban Members permission.");

            if (!target || !target.bannable)
                return reply("❌ I cannot ban that member.");

            if (target.id === interaction.user.id)
                return reply("❌ You cannot ban yourself.");

            await target.ban({ reason });

            await sendLog(
                guild,
                "MEMBER BANNED",
                `Member: ${target.user.tag}\nModerator: ${interaction.user.tag}\nReason: ${reason}`
            );

            return reply(`🔨 ${target.user.tag} has been banned.`);
        }

        // KICK
        if (commandName === "kick") {
            if (!hasPermission(PermissionsBitField.Flags.KickMembers))
                return reply("❌ You need Kick Members permission.");

            if (!target || !target.kickable)
                return reply("❌ I cannot kick that member.");

            if (target.id === interaction.user.id)
                return reply("❌ You cannot kick yourself.");

            await target.kick(reason);

            await sendLog(
                guild,
                "MEMBER KICKED",
                `Member: ${target.user.tag}\nModerator: ${interaction.user.tag}\nReason: ${reason}`
            );

            return reply(`👢 ${target.user.tag} has been kicked.`);
        }

        // TIMEOUT
        if (commandName === "timeout") {
            if (!hasPermission(PermissionsBitField.Flags.ModerateMembers))
                return reply("❌ You need Moderate Members permission.");

            if (!target || !target.moderatable)
                return reply("❌ I cannot timeout that member.");

            if (target.id === interaction.user.id)
                return reply("❌ You cannot timeout yourself.");

            const minutes = interaction.options.getInteger("minutes");

            await target.timeout(minutes * 60000, reason);

            await sendLog(
                guild,
                "MEMBER TIMED OUT",
                `${target.user.tag} | ${minutes} minutes\nReason: ${reason}`
            );

            return reply(`⏳ ${target.user.tag} timed out for ${minutes} minutes.`);
        }

        // UNTIMEOUT
        if (commandName === "untimeout") {
            if (!hasPermission(PermissionsBitField.Flags.ModerateMembers))
                return reply("❌ You need Moderate Members permission.");

            if (!target || !target.moderatable)
                return reply("❌ I cannot modify that member.");

            await target.timeout(null);

            return reply(`✅ Timeout removed from ${target.user.tag}.`);
        }

        // WARN
        if (commandName === "warn") {
            if (!hasPermission(PermissionsBitField.Flags.ModerateMembers))
                return reply("❌ You need Moderate Members permission.");

            if (!target) return reply("❌ Member not found.");

            if (target.id === interaction.user.id)
                return reply("❌ You cannot warn yourself.");

            const key = `${guild.id}-${target.id}`;

            if (!warnings[key]) warnings[key] = [];

            warnings[key].push({
                reason,
                moderator: interaction.user.tag,
                date: new Date().toISOString()
            });

            fs.writeFileSync(
                WARN_FILE,
                JSON.stringify(warnings, null, 2)
            );

            await sendLog(
                guild,
                "MEMBER WARNED",
                `Member: ${target.user.tag}\nReason: ${reason}`
            );

            return reply(`⚠️ ${target.user.tag} warned. Total warnings: ${warnings[key].length}`);
        }

        // WARNINGS
        if (commandName === "warnings") {
            if (!hasPermission(PermissionsBitField.Flags.ModerateMembers))
                return reply("❌ You need Moderate Members permission.");

            if (!target) return reply("❌ Member not found.");

            const list = warnings[`${guild.id}-${target.id}`] || [];

            const embed = createEmbed(
                `WARNINGS: ${target.user.tag}`,
                list.length
                    ? list.map((w, i) =>
                        `**${i + 1}.** ${w.reason}\nModerator: ${w.moderator}`
                    ).join("\n\n")
                    : "No warnings found."
            );

            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }

        // CLEAR
        if (commandName === "clear") {
            if (!hasPermission(PermissionsBitField.Flags.ManageMessages))
                return reply("❌ You need Manage Messages permission.");

            const amount = interaction.options.getInteger("amount");

            await interaction.deferReply({ ephemeral: true });

            const deleted = await interaction.channel.bulkDelete(
                amount,
                true
            );

            return interaction.editReply(
                `🧹 Deleted ${deleted.size} messages.`
            );
        }

        // PURGE
        if (commandName === "purge") {
            if (!hasPermission(PermissionsBitField.Flags.ManageMessages))
                return reply("❌ You need Manage Messages permission.");

            if (!target) return reply("❌ Member not found.");

            const amount = interaction.options.getInteger("amount");

            await interaction.deferReply({ ephemeral: true });

            const messages = await interaction.channel.messages.fetch({
                limit: 100
            });

            const selected = messages
                .filter(m => m.author.id === target.id)
                .first(amount);

            if (!selected.length)
                return interaction.editReply("No messages found.");

            const deleted = await interaction.channel.bulkDelete(
                selected,
                true
            );

            return interaction.editReply(
                `🧹 Deleted ${deleted.size} messages from ${target.user.tag}.`
            );
        }

        // LOCK / UNLOCK
        if (commandName === "lock" || commandName === "unlock") {
            if (!hasPermission(PermissionsBitField.Flags.ManageChannels))
                return reply("❌ You need Manage Channels permission.");

            const locked = commandName === "lock";

            await interaction.channel.permissionOverwrites.edit(
                guild.roles.everyone,
                {
                    SendMessages: locked ? false : null
                }
            );

            return reply(
                locked
                    ? "🔒 Channel locked."
                    : "🔓 Channel unlocked."
            );
        }

        // USER INFO
        if (commandName === "userinfo") {
            if (!target) return reply("❌ Member not found.");

            const embed = createEmbed(
                "USER INFORMATION",
                `**Username:** ${target.user.tag}\n` +
                `**ID:** ${target.id}\n` +
                `**Joined:** <t:${Math.floor(target.joinedTimestamp / 1000)}:R>\n` +
                `**Created:** <t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`
            );

            embed.setThumbnail(target.user.displayAvatarURL());

            return interaction.reply({ embeds: [embed] });
        }

    } catch (error) {
        console.error("Vexora command error:", error);

        const message = "❌ An error occurred while running this command.";

        if (interaction.deferred || interaction.replied) {
            return interaction.followUp({
                content: message,
                ephemeral: true
            });
        }

        return reply(message);
    }
});

// ===============================
// AUTOMOD
// ===============================

client.on("messageCreate", async message => {

    if (!message.guild || message.author.bot) return;

    try {

        // Ignore moderators
        if (message.member.permissions.has(
            PermissionsBitField.Flags.ManageMessages
        )) return;

        const content = message.content.toLowerCase();

        // BAD WORD FILTER
        if (BAD_WORDS.some(word =>
            content.split(/\s+/).includes(word)
        )) {
            await message.delete().catch(() => {});
            return;
        }

        // ANTI SPAM
        const key = `${message.guild.id}-${message.author.id}`;
        const now = Date.now();

        const timestamps = (spamTracker.get(key) || [])
            .filter(t => now - t < 5000);

        timestamps.push(now);
        spamTracker.set(key, timestamps);

        if (timestamps.length >= 5) {

            spamTracker.set(key, []);

            await message.member.timeout(
                60000,
                "Vexora Anti-Spam"
            ).catch(() => {});

            await message.channel.send(
                `🚨 ${message.author}, spam detected!`
            );

            await sendLog(
                message.guild,
                "ANTI-SPAM",
                `${message.author.tag} triggered anti-spam.`
            );
        }

    } catch (error) {
        console.error("Automod error:", error);
    }
});

// ===============================
// LOGIN
// ===============================

client.login(TOKEN);

