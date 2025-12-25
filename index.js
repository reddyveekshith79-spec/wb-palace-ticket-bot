const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActivityType
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

/*
REQUIRED SECRETS:
TOKEN
GUILD_ID
TICKET_CATEGORY_ID
STAFF_ROLE_ID
ADMIN_ROLE_ID
LOG_CHANNEL_ID
*/

const tickets = new Map();

/* ================= READY ================= */
client.once("ready", async () => {
  console.log(`🎟️ ᴛɪᴄᴋᴇᴛ ʙᴏᴛ ᴠ4.1 ᴏɴʟɪɴᴇ ᴀꜱ ${client.user.tag}`);

  // 🎮 CUSTOM RPC
  client.user.setPresence({
    activities: [{
      name: "🛡️ ᴍᴀɴᴀɢɪɴɢ ᴛɪᴄᴋᴇᴛꜱ • ᴡʙ ▸ ᴘᴀʟᴀᴄᴇ",
      type: ActivityType.Playing
    }],
    status: "online"
  });

  await client.application.commands.set([
    { name: "tickets", description: "open the ticket panel" }
  ], process.env.GUILD_ID);
});

/* ================= TICKET PANEL ================= */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "tickets") return;

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ.", ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle("🎟️ ᴡʙ ▸ ᴘᴀʟᴀᴄᴇ ᴛɪᴄᴋᴇᴛꜱ")
    .setDescription(
      "🎁 ɢɪᴠᴇᴀᴡᴀʏ ᴄʟᴀɪᴍ\n" +
      "🤝 ᴘᴀʀᴛɴᴇʀ\n" +
      "❓ ꜱᴜᴘᴘᴏʀᴛ"
    )
    .setColor(0x5865F2);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("giveaway").setLabel("🎁 ɢɪᴠᴇᴀᴡᴀʏ ᴄʟᴀɪᴍ").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("partner").setLabel("🤝 ᴘᴀʀᴛɴᴇʀ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("support").setLabel("❓ ꜱᴜᴘᴘᴏʀᴛ").setStyle(ButtonStyle.Secondary)
  );

  interaction.reply({ embeds: [embed], components: [row] });
});

/* ================= BUTTON → MODAL ================= */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const modal = new ModalBuilder()
    .setCustomId(`modal_${interaction.customId}`)
    .setTitle("ᴛɪᴄᴋᴇᴛ ꜰᴏʀᴍ");

  const field = (id, label, style) =>
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(true)
    );

  if (interaction.customId === "giveaway") {
    modal.addComponents(
      field("q1", "ᴡʜᴀᴛ ᴅɪᴅ ʏᴏᴜ ᴡɪɴ / ʜᴏᴡ ᴍᴜᴄʜ", TextInputStyle.Short),
      field("q2", "ᴡʜᴏ ʜᴏꜱᴛᴇᴅ ᴛʜᴇ ɢɪᴠᴇᴀᴡᴀʏ", TextInputStyle.Short)
    );
  }

  if (interaction.customId === "partner") {
    modal.addComponents(
      field("q1", "ʜᴏᴡ ᴍᴀɴʏ ᴍᴇᴍʙᴇʀꜱ ᴅᴏᴇꜱ ʏᴏᴜʀ ꜱᴇʀᴠᴇʀ ʜᴀᴠᴇ", TextInputStyle.Short),
      field("q2", "ᴅᴏ ʏᴏᴜ ᴀɢʀᴇᴇ ᴡɪᴛʜ ᴏᴜʀ ʀᴇQᴜɪʀᴇᴍᴇɴᴛꜱ (ʏᴇꜱ / ɴᴏ)", TextInputStyle.Short)
    );
  }

  if (interaction.customId === "support") {
    modal.addComponents(
      field("q1", "ᴡʜᴀᴛ ᴅᴏ ʏᴏᴜ ɴᴇᴇᴅ ʜᴇʟᴘ ᴡɪᴛʜ", TextInputStyle.Paragraph)
    );
  }

  await interaction.showModal(modal);
});

/* ================= MODAL SUBMIT ================= */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  const type = interaction.customId.replace("modal_", "");
  const guild = interaction.guild;
  const member = interaction.member;

  const answers = interaction.fields.fields
    .map((f, i) => `**Q${i + 1}:** ${f.value}`)
    .join("\n\n");

  const channel = await guild.channels.create({
    name: `${type}-${member.user.username}`.toLowerCase(),
    type: ChannelType.GuildText,
    parent: process.env.TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: process.env.STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] },
      { id: process.env.ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ]
  });

  tickets.set(channel.id, {
    user: member.id,
    type,
    opened: Date.now(),
    claimed: null,
    closed: null
  });

  const embed = new EmbedBuilder()
    .setTitle("🎟️ ᴛɪᴄᴋᴇᴛ ᴅᴇᴛᴀɪʟꜱ")
    .setDescription("📋 ᴀɴꜱᴡᴇʀꜱ\n────────────────\n" + answers)
    .setColor(type === "giveaway" ? 0xF1C40F : type === "partner" ? 0x5865F2 : 0x2ECC71)
    .setFooter({ text: `ᴏᴘᴇɴᴇᴅ ʙʏ ${member.user.tag}` })
    .setTimestamp();

  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("claim").setLabel("✅ ᴄʟᴀɪᴍ").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("close").setLabel("🔒 ᴄʟᴏꜱᴇ").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("transcript").setLabel("📄 ᴛʀᴀɴꜱᴄʀɪᴘᴛ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("delete").setLabel("🗑️ ᴅᴇʟᴇᴛᴇ").setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `<@${member.id}> <@&${process.env.STAFF_ROLE_ID}>`,
    embeds: [embed],
    components: [controls]
  });

  interaction.reply({ content: "✅ ᴛɪᴄᴋᴇᴛ ᴄʀᴇᴀᴛᴇᴅ.", ephemeral: true });
});

/* ================= STAFF CONTROLS ================= */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const channel = interaction.channel;
  const data = tickets.get(channel.id);
  if (!data) return;

  // CLAIM + RENAME
  if (interaction.customId === "claim") {
    data.claimed = interaction.user.id;

    await channel.setName(`claimed-${channel.name.split("-").slice(1).join("-")}`);

    await channel.permissionOverwrites.edit(process.env.STAFF_ROLE_ID, { SendMessages: false });
    await channel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true,
      SendMessages: true
    });

    interaction.reply(`✅ ᴄʟᴀɪᴍᴇᴅ ʙʏ ${interaction.user.tag}`);
  }

  // CLOSE
  if (interaction.customId === "close") {
    data.closed = Date.now();
    await channel.permissionOverwrites.edit(data.user, { SendMessages: false });
    interaction.reply("🔒 ᴛɪᴄᴋᴇᴛ ᴄʟᴏꜱᴇᴅ");
  }

  // DELETE
  if (interaction.customId === "delete") {
    await channel.delete();
    tickets.delete(channel.id);
  }

  // TRANSCRIPT
  if (interaction.customId === "transcript") {
    const messages = await channel.messages.fetch({ limit: 100 });
    const content = messages.reverse().map(m => `[${m.author.tag}] ${m.content}`).join("\n");

    const log = await interaction.guild.channels.fetch(process.env.LOG_CHANNEL_ID);
    log.send({
      content:
        "📄 ᴛɪᴄᴋᴇᴛ ᴛʀᴀɴꜱᴄʀɪᴘᴛ\n" +
        `ᴛʏᴘᴇ: ${data.type}\n` +
        `ᴜꜱᴇʀ: <@${data.user}>\n` +
        `ꜱᴛᴀꜰꜰ: ${data.claimed ? `<@${data.claimed}>` : "ᴜɴᴄʟᴀɪᴍᴇᴅ"}\n\n` +
        "```" + content + "```"
    });

    interaction.reply("📄 ᴛʀᴀɴꜱᴄʀɪᴘᴛ ꜱᴇɴᴛ");
  }
});

client.login(process.env.TOKEN);

