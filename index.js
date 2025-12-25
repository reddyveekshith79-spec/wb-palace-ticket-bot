const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActivityType
} = require("discord.js");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ================= STORAGE ================= */
const DB_FILE = "./tickets.json";
let db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

const saveDB = () =>
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

/* ================= READY ================= */
client.once("ready", async () => {
  console.log(`🎟️ ᴛɪᴄᴋᴇᴛ ʙᴏᴛ ᴏɴʟɪɴᴇ ᴀꜱ ${client.user.tag}`);

  client.user.setPresence({
    activities: [{
      name: "🛡️ ᴍᴀɴᴀɢɪɴɢ ᴛɪᴄᴋᴇᴛꜱ • ᴡʙ ▸ ᴘᴀʟᴀᴄᴇ",
      type: ActivityType.Playing
    }],
    status: "online"
  });

  await client.application.commands.set([
    {
      name: "tickets",
      description: "open ticket panel"
    },
    {
      name: "ticket",
      description: "ticket management",
      options: [
        { name: "claim", type: 1, description: "claim ticket" },
        { name: "close", type: 1, description: "close ticket" },
        { name: "reopen", type: 1, description: "reopen ticket" },
        {
          name: "rename",
          type: 1,
          description: "rename ticket",
          options: [{ name: "name", type: 3, required: true }]
        },
        { name: "transcript", type: 1, description: "export transcript" },
        { name: "delete", type: 1, description: "delete ticket" }
      ]
    }
  ], process.env.GUILD_ID);
});

/* ================= UTIL ================= */
const isStaff = (m) =>
  m.roles.cache.has(process.env.STAFF_ROLE_ID) ||
  m.roles.cache.has(process.env.ADMIN_ROLE_ID);

/* ================= TICKET PANEL ================= */
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand() || i.commandName !== "tickets") return;

  if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator))
    return i.reply({ content: "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ", ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle("🎟️ ᴡʙ ▸ ᴘᴀʟᴀᴄᴇ ᴛɪᴄᴋᴇᴛꜱ")
    .setDescription(
      "🎁 ɢɪᴠᴇᴀᴡᴀʏ ᴄʟᴀɪᴍ\n🤝 ᴘᴀʀᴛɴᴇʀ\n❓ ꜱᴜᴘᴘᴏʀᴛ"
    )
    .setColor(0x5865F2);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("giveaway").setLabel("🎁 ɢɪᴠᴇᴀᴡᴀʏ").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("partner").setLabel("🤝 ᴘᴀʀᴛɴᴇʀ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("support").setLabel("❓ ꜱᴜᴘᴘᴏʀᴛ").setStyle(ButtonStyle.Secondary)
  );

  i.reply({ embeds: [embed], components: [row] });
});

/* ================= BUTTON → MODAL ================= */
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  const modal = new ModalBuilder()
    .setCustomId(`modal_${i.customId}`)
    .setTitle("ᴛɪᴄᴋᴇᴛ ꜰᴏʀᴍ");

  const add = (id, label, style) =>
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(true)
    );

  if (i.customId === "giveaway") {
    modal.addComponents(
      add("q1", "ᴡʜᴀᴛ ᴅɪᴅ ʏᴏᴜ ᴡɪɴ / ʜᴏᴡ ᴍᴜᴄʜ", TextInputStyle.Short),
      add("q2", "ᴡʜᴏ ʜᴏꜱᴛᴇᴅ ᴛʜᴇ ɢɪᴠᴇᴀᴡᴀʏ", TextInputStyle.Short)
    );
  }

  if (i.customId === "partner") {
    modal.addComponents(
      add("q1", "ʜᴏᴡ ᴍᴀɴʏ ᴍᴇᴍʙᴇʀꜱ ᴅᴏᴇꜱ ʏᴏᴜʀ ꜱᴇʀᴠᴇʀ ʜᴀᴠᴇ", TextInputStyle.Short),
      add("q2", "ᴅᴏ ʏᴏᴜ ᴀɢʀᴇᴇ ᴡɪᴛʜ ᴏᴜʀ ʀᴇQᴜɪʀᴇᴍᴇɴᴛꜱ (ʏᴇꜱ / ɴᴏ)", TextInputStyle.Short)
    );
  }

  if (i.customId === "support") {
    modal.addComponents(
      add("q1", "ᴡʜᴀᴛ ᴅᴏ ʏᴏᴜ ɴᴇᴇᴅ ʜᴇʟᴘ ᴡɪᴛʜ", TextInputStyle.Paragraph)
    );
  }

  await i.showModal(modal);
});

/* ================= MODAL SUBMIT ================= */
client.on("interactionCreate", async (i) => {
  if (!i.isModalSubmit()) return;

  const type = i.customId.replace("modal_", "");
  const guild = i.guild;
  const user = i.user;

  db.lastId++;
  const ticketId = `T-${db.lastId}`;

  const channel = await guild.channels.create({
    name: `${type}-${user.username}`.toLowerCase(),
    type: ChannelType.GuildText,
    parent: process.env.TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: process.env.STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] },
      { id: process.env.ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ]
  });

  db.tickets[channel.id] = {
    ticketId,
    type,
    user: user.id,
    claimed: null,
    opened: Date.now(),
    closed: null
  };
  saveDB();

  const answers = i.fields.fields.map(
    (f, idx) => `**Q${idx + 1}:** ${f.value}`
  ).join("\n\n");

  const embed = new EmbedBuilder()
    .setTitle(`🎟️ ᴛɪᴄᴋᴇᴛ #${ticketId}`)
    .setDescription("📋 ᴀɴꜱᴡᴇʀꜱ\n──────────────\n" + answers)
    .setColor(0x2ECC71)
    .setFooter({ text: "ꜱᴛᴀᴛᴜꜱ: ᴏᴘᴇɴ" })
    .setTimestamp();

  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("claim").setLabel("✅ ᴄʟᴀɪᴍ").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("close").setLabel("🔒 ᴄʟᴏꜱᴇ").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("transcript").setLabel("📄 ᴛʀᴀɴꜱᴄʀɪᴘᴛ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("delete").setLabel("🗑️ ᴅᴇʟᴇᴛᴇ").setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `<@${user.id}> <@&${process.env.STAFF_ROLE_ID}>`,
    embeds: [embed],
    components: [controls]
  });

  i.reply({ content: "✅ ᴛɪᴄᴋᴇᴛ ᴄʀᴇᴀᴛᴇᴅ", ephemeral: true });
});

/* ================= STAFF BUTTONS ================= */
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;
  const data = db.tickets[i.channel.id];
  if (!data || !isStaff(i.member)) return;

  if (i.customId === "claim") {
    data.claimed = i.user.id;
    await i.channel.setName(`claimed-${i.channel.name.split("-").slice(1).join("-")}`);
    saveDB();
    return i.reply(`✅ ᴄʟᴀɪᴍᴇᴅ ʙʏ ${i.user.tag}`);
  }

  if (i.customId === "close") {
    data.closed = Date.now();
    await i.channel.permissionOverwrites.edit(data.user, { SendMessages: false });
    saveDB();
    return i.reply("🔒 ᴛɪᴄᴋᴇᴛ ᴄʟᴏꜱᴇᴅ");
  }

  if (i.customId === "delete") {
    delete db.tickets[i.channel.id];
    saveDB();
    return i.channel.delete();
  }

  if (i.customId === "transcript") {
    let messages = [];
    let last;
    do {
      const fetched = await i.channel.messages.fetch({ limit: 100, before: last });
      if (!fetched.size) break;
      messages.push(...fetched.values());
      last = fetched.last().id;
    } while (true);

    const content = messages.reverse().map(
      m => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}`
    ).join("\n");

    const log = await i.guild.channels.fetch(process.env.LOG_CHANNEL_ID);
    log.send({
      content:
        `📄 ᴛɪᴄᴋᴇᴛ ᴛʀᴀɴꜱᴄʀɪᴘᴛ (#${data.ticketId})\n\n\`\`\`\n${content}\n\`\`\``
    });

    return i.reply("📄 ᴛʀᴀɴꜱᴄʀɪᴘᴛ ꜱᴇɴᴛ");
  }
});

client.login(process.env.TOKEN);
