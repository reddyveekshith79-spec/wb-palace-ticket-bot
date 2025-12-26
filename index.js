const {
  Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActivityType,
  Partials, AttachmentBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

/* ================= CONFIGURATION ================= */
const {
  TOKEN, GUILD_ID, STAFF_ROLE_ID, ADMIN_ROLE_ID,
  TICKET_CATEGORY_ID, LOG_CHANNEL_ID
} = process.env;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

/* ================= DATABASE LOGIC ================= */
const DB_FILE = path.join(__dirname, "tickets.json");
let db = { lastId: 0, tickets: {} };

const loadDB = () => {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  }
};
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
loadDB();

/* ================= UI COMPONENTS ================= */
const COLORS = {
  blue: 0x5865f2,
  green: 0x2ecc71,
  red: 0xe74c3c,
  yellow: 0xf1c40f,
  gray: 0x95a5a6
};

const buildTicketControls = (isClosed = false, isClaimed = false) => {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("claim")
      .setLabel(isClaimed ? "ᴄʟᴀɪᴍᴇᴅ" : "✅ ᴄʟᴀɪᴍ")
      .setStyle(ButtonStyle.Success)
      .setDisabled(isClaimed || isClosed),
    new ButtonBuilder()
      .setCustomId("close")
      .setLabel("🔒 ᴄʟᴏꜱᴇ")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId("transcript")
      .setLabel("📄 ᴛʀᴀɴꜱᴄʀɪᴘᴛ")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("delete_confirm")
      .setLabel("🗑️ ᴅᴇʟᴇᴛᴇ")
      .setStyle(ButtonStyle.Danger)
  );
  return row;
};

/* ================= EVENT HANDLERS ================= */
client.once("ready", () => {
  console.log(`🚀 ${client.user.tag} is ready.`);
  client.user.setActivity("🎟️ Support Tickets", { type: ActivityType.Watching });
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) handleSlash(interaction);
    if (interaction.isButton()) handleButtons(interaction);
    if (interaction.isModalSubmit()) handleModal(interaction);
  } catch (err) {
    console.error("Interaction Error:", err);
  }
});

/* ================= FUNCTIONALITY ================= */

async function handleSlash(interaction) {
  if (interaction.commandName === "tickets") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "Admin only.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle("🎟️ WB Palace Support")
      .setDescription("Click a button below to open a ticket.\n\n🎁 **Giveaway**\n🤝 **Partnership**\n❓ **General Support**")
      .setColor(COLORS.blue)
      .setThumbnail(interaction.guild.iconURL());

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_giveaway").setLabel("Giveaway").setStyle(ButtonStyle.Success).setEmoji("🎁"),
      new ButtonBuilder().setCustomId("btn_partner").setLabel("Partner").setStyle(ButtonStyle.Primary).setEmoji("🤝"),
      new ButtonBuilder().setCustomId("btn_support").setLabel("Support").setStyle(ButtonStyle.Secondary).setEmoji("❓")
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
}

async function handleButtons(interaction) {
  const { customId, guild, channel, member, user } = interaction;

  // 1. Ticket Creation Buttons
  if (customId.startsWith("btn_")) {
    const type = customId.replace("btn_", "");
    return showTicketModal(interaction, type);
  }

  // 2. Management Buttons
  const ticket = db.tickets[channel.id];
  if (!ticket) return;

  const isStaff = member.roles.cache.has(STAFF_ROLE_ID) || member.roles.cache.has(ADMIN_ROLE_ID);
  if (!isStaff) return interaction.reply({ content: "Only staff can use these buttons.", ephemeral: true });

  switch (customId) {
    case "claim":
      ticket.claimedBy = user.id;
      saveDB();
      await channel.setName(`claimed-${ticket.id}`);
      await interaction.update({ components: [buildTicketControls(false, true)] });
      await channel.send({ 
        embeds: [new EmbedBuilder().setColor(COLORS.green).setDescription(`✅ This ticket has been claimed by <@${user.id}>`)] 
      });
      break;

    case "close":
      ticket.closed = true;
      saveDB();
      await channel.permissionOverwrites.edit(ticket.user, { ViewChannel: false });
      await interaction.reply({ 
        embeds: [new EmbedBuilder().setColor(COLORS.yellow).setDescription("🔒 Ticket closed. User access removed.")] 
      });
      await interaction.editReply({ components: [buildTicketControls(true, !!ticket.claimedBy)] });
      break;

    case "transcript":
      await generateTranscript(interaction, ticket);
      break;

    case "delete_confirm":
      // Immediate ephemeral confirmation
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("delete_final").setLabel("Confirm Delete").setStyle(ButtonStyle.Danger)
      );
      await interaction.reply({ content: "Are you sure? This cannot be undone.", components: [confirmRow], ephemeral: true });
      break;

    case "delete_final":
      await interaction.reply("🗑️ Deleting in 3 seconds...");
      setTimeout(() => {
        delete db.tickets[channel.id];
        saveDB();
        channel.delete();
      }, 3000);
      break;
  }
}

async function showTicketModal(interaction, type) {
  const modal = new ModalBuilder().setCustomId(`modal_${type}`).setTitle(`${type.toUpperCase()} Ticket`);
  
  const input = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel("Briefly explain your request")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function handleModal(interaction) {
  const { guild, user, fields, customId } = interaction;
  const type = customId.replace("modal_", "");
  const reason = fields.getTextInputValue("reason");

  await interaction.deferReply({ ephemeral: true });

  db.lastId++;
  const tId = db.lastId;

  const channel = await guild.channels.create({
    name: `${type}-${tId}`,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] }
    ]
  });

  db.tickets[channel.id] = { id: tId, user: user.id, type, closed: false, createdAt: Date.now() };
  saveDB();

  const embed = new EmbedBuilder()
    .setTitle(`Ticket #${tId} | ${type.toUpperCase()}`)
    .addFields(
      { name: "User", value: `<@${user.id}>`, inline: true },
      { name: "Reason", value: reason }
    )
    .setColor(COLORS.green)
    .setTimestamp();

  await channel.send({ content: `<@&${STAFF_ROLE_ID}>`, embeds: [embed], components: [buildTicketControls()] });
  await interaction.editReply(`Ticket Created: ${channel}`);
}

async function generateTranscript(interaction, ticket) {
  const messages = await interaction.channel.messages.fetch({ limit: 100 });
  const logContent = messages.reverse().map(m => `${m.author.tag}: ${m.content}`).join("\n");
  
  const buffer = Buffer.from(logContent, "utf-8");
  const attachment = new AttachmentBuilder(buffer, { name: `transcript-ticket-${ticket.id}.txt` });

  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel) {
    await logChannel.send({ 
      content: `Transcript for Ticket #${ticket.id} (User: <@${ticket.user}>)`, 
      files: [attachment] 
    });
    interaction.reply({ content: "✅ Transcript sent to logs.", ephemeral: true });
  } else {
    interaction.reply({ content: "❌ Log channel not found.", ephemeral: true });
  }
}

client.login(TOKEN);
