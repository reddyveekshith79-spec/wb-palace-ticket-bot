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
  ActivityType,
  Partials,
  Collection
} = require("discord.js");
const fs = require("fs");
const path = require("path");

/* ================= CONFIG / ENV ================= */
require("dotenv").config();

const {
  TOKEN,
  GUILD_ID,
  STAFF_ROLE_ID,
  ADMIN_ROLE_ID,
  TICKET_CATEGORY_ID,
  LOG_CHANNEL_ID
} = process.env;

if (!TOKEN || !GUILD_ID || !STAFF_ROLE_ID || !ADMIN_ROLE_ID || !TICKET_CATEGORY_ID || !LOG_CHANNEL_ID) {
  console.error("❌ Missing one or more required environment variables.");
  process.exit(1);
}

/* ================= CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

/* ================= STORAGE ================= */
const DB_FILE = path.join(__dirname, "tickets.json");

// Initialize DB safely
let db = { lastId: 0, tickets: {} };
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    db = {
      lastId: parsed.lastId ?? 0,
      tickets: parsed.tickets ?? {}
    };
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }
} catch (err) {
  console.error("❌ Failed to read tickets.json, using empty DB:", err);
}

const saveDB = () => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("❌ Failed to save DB:", err);
  }
};

/* ================= HELPERS ================= */
const isStaff = (member) => {
  if (!member || !member.roles) return false;
  return (
    member.roles.cache.has(STAFF_ROLE_ID) ||
    member.roles.cache.has(ADMIN_ROLE_ID)
  );
};

const TICKET_TYPES = ["giveaway", "partner", "support"];

const buildTicketControls = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("claim")
      .setLabel("✅ ᴄʟᴀɪᴍ")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("close")
      .setLabel("🔒 ᴄʟᴏꜱᴇ")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("reopen")
      .setLabel("🔓 ʀᴇᴏᴘᴇɴ")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("transcript")
      .setLabel("📄 ᴛʀᴀɴꜱᴄʀɪᴘᴛ")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("delete")
      .setLabel("🗑️ ᴅᴇʟᴇᴛᴇ")
      .setStyle(ButtonStyle.Danger)
  );

/* ================= READY ================= */
client.once("ready", async () => {
  console.log(`🎟️ Ticket bot online as ${client.user.tag}`);

  client.user.setPresence({
    activities: [
      {
        name: "🎟️ ᴛɪᴄᴋᴇᴛꜱ • ᴡʙ ▸ ᴘᴀʟᴀᴄᴇ",
        type: ActivityType.Playing
      }
    ],
    status: "online"
  });

  try {
    await client.application.commands.set(
      [
        {
          name: "tickets",
          description: "Post ticket panel"
        }
      ],
      GUILD_ID
    );
    console.log("✅ Slash commands registered.");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
});

/* ================= INTERACTION HANDLER ================= */
client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlash(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (err) {
    console.error("❌ Interaction error:", err);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({
        content: "⚠️ Something went wrong. Please try again.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

/* ================= SLASH: /tickets ================= */
async function handleSlash(interaction) {
  if (interaction.commandName !== "tickets") return;

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({
      content: "❌ Only administrators can use this command.",
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("🎟️ ᴛɪᴄᴋᴇᴛ ꜱᴜᴘᴘᴏʀᴛ")
    .setDescription(
      [
        "🎁 **ɢɪᴠᴇᴀᴡᴀʏ ᴄʟᴀɪᴍ**",
        "🤝 **ᴘᴀʀᴛɴᴇʀ**",
        "❓ **ꜱᴜᴘᴘᴏʀᴛ**",
        "",
        "ᴄʜᴏᴏꜱᴇ ᴀ ᴄᴀᴛᴇɢᴏʀʏ ᴛᴏ ᴄʀᴇᴀᴛᴇ ᴀ ᴛɪᴄᴋᴇᴛ"
      ].join("\n")
    )
    .setColor(0x5865f2);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("giveaway")
      .setLabel("🎁 ɢɪᴠᴇᴀᴡᴀʏ")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("partner")
      .setLabel("🤝 ᴘᴀʀᴛɴᴇʀ")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("support")
      .setLabel("❓ ꜱᴜᴘᴘᴏʀᴛ")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}

/* ================= BUTTONS (OPEN MODAL + STAFF) ================= */
async function handleButton(interaction) {
  const id = interaction.customId;

  // Category buttons → show modal
  if (TICKET_TYPES.includes(id)) {
    return showTicketModal(interaction, id);
  }

  // Staff controls → require staff and ticket channel
  const ticket = db.tickets[interaction.channel.id];
  if (!ticket) return;
  if (!isStaff(interaction.member)) {
    return interaction.reply({
      content: "❌ You do not have permission to manage this ticket.",
      ephemeral: true
    });
  }

  switch (id) {
    case "claim":
      return handleClaim(interaction, ticket);
    case "close":
      return handleClose(interaction, ticket);
    case "reopen":
      return handleReopen(interaction, ticket);
    case "delete":
      return handleDelete(interaction, ticket);
    case "transcript":
      return handleTranscript(interaction, ticket);
  }
}

/* ========== Open Modal ========== */
async function showTicketModal(interaction, type) {
  const modal = new ModalBuilder()
    .setCustomId(`modal_${type}`)
    .setTitle("ᴛɪᴄᴋᴇᴛ ꜰᴏʀᴍ");

  const makeField = (id, label, style, required = true) =>
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(style)
        .setRequired(required)
    );

  if (type === "giveaway") {
    modal.addComponents(
      makeField("prize", "ʜᴏᴡ ᴍᴜᴄʜ ᴅɪᴅ ʏᴏᴜ ᴡɪɴ?", TextInputStyle.Short),
      makeField("host", "ᴡʜᴏ ʜᴏꜱᴛᴇᴅ ᴛʜᴇ ɢɪᴠᴇᴀᴡᴀʏ?", TextInputStyle.Short)
    );
  } else if (type === "partner") {
    modal.addComponents(
      makeField("members", "ʜᴏᴡ ᴍᴀɴʏ ᴍᴇᴍʙᴇʀꜱ ᴅᴏᴇꜱ ʏᴏᴜʀ ꜱᴇʀᴠᴇʀ ʜᴀᴠᴇ?", TextInputStyle.Short),
      makeField("agree", "ᴅᴏ ʏᴏᴜ ᴀɢʀᴇᴇ ᴛᴏ ᴏᴜʀ ʀᴇQᴜɪʀᴇᴍᴇɴᴛꜱ? (ʏᴇꜱ / ɴᴏ)", TextInputStyle.Short)
    );
  } else if (type === "support") {
    modal.addComponents(
      makeField("issue", "ᴡʜᴀᴛ ᴅᴏ ʏᴏᴜ ɴᴇᴇᴅ ʜᴇʟᴘ ᴡɪᴛʜ?", TextInputStyle.Paragraph)
    );
  }

  await interaction.showModal(modal);
}

/* ================= MODAL SUBMIT (CREATE TICKET) ================= */
async function handleModal(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;
  const type = interaction.customId.replace("modal_", "");

  if (!TICKET_TYPES.includes(type)) {
    return interaction.reply({
      content: "⚠️ Unknown ticket type.",
      ephemeral: true
    });
  }

  // Prevent duplicate open tickets per user & type (optional but helpful)
  const alreadyOpen = Object.values(db.tickets).find(
    (t) => t.user === user.id && t.type === type && !t.closed
  );
  if (alreadyOpen) {
    return interaction.reply({
      content: `⚠️ You already have an open ${type} ticket: <#${alreadyOpen.channelId}>`,
      ephemeral: true
    });
  }

  db.lastId += 1;
  const ticketId = `T-${db.lastId}`;

  const channel = await guild.channels.create({
    name: `ticket-${ticketId}`.toLowerCase(),
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      },
      {
        id: STAFF_ROLE_ID,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      },
      {
        id: ADMIN_ROLE_ID,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }
    ]
  });

  const answers = interaction.fields.fields
    .map((f) => `**${f.label}**\n${f.value}`)
    .join("\n\n");

  db.tickets[channel.id] = {
    id: ticketId,
    channelId: channel.id,
    user: user.id,
    type,
    closed: false,
    createdAt: Date.now()
  };
  saveDB();

  const embed = new EmbedBuilder()
    .setTitle(`🎟️ ᴛɪᴄᴋᴇᴛ #${ticketId}`)
    .setDescription(answers)
    .setColor(0x2ecc71)
    .setFooter({ text: "ꜱᴛᴀᴛᴜꜱ: ᴏᴘᴇɴ" })
    .setTimestamp();

  await channel.send({
    content: `<@${user.id}> <@&${STAFF_ROLE_ID}>`,
    embeds: [embed],
    components: [buildTicketControls()]
  });

  await interaction.reply({
    content: `✅ ᴛɪᴄᴋᴇᴛ ᴄʀᴇᴀᴛᴇᴅ: ${channel}`,
    ephemeral: true
  });
}

/* ================= STAFF ACTIONS ================= */
async function handleClaim(interaction, ticket) {
  await interaction.reply(`✅ ᴄʟᴀɪᴍᴇᴅ ʙʏ ${interaction.user.tag}`);
}

async function handleClose(interaction, ticket) {
  if (ticket.closed) {
    return interaction.reply({ content: "⚠️ Ticket is already closed.", ephemeral: true });
  }
  ticket.closed = true;
  saveDB();

  await interaction.channel.permissionOverwrites.edit(ticket.user, {
    SendMessages: false
  });

  // Update embed footer if present
  const msg = (await interaction.channel.messages.fetch({ limit: 10 }))
    .find((m) => m.embeds.length && m.components.length);
  if (msg) {
    const e = EmbedBuilder.from(msg.embeds[0]);
    e.setFooter({ text: "ꜱᴛᴀᴛᴜꜱ: ᴄʟᴏꜱᴇᴅ" });
    await msg.edit({ embeds: [e], components: [buildTicketControls()] });
  }

  await interaction.reply("🔒 ᴛɪᴄᴋᴇᴛ ᴄʟᴏꜱᴇᴅ");
}

async function handleReopen(interaction, ticket) {
  if (!ticket.closed) {
    return interaction.reply({ content: "⚠️ Ticket is already open.", ephemeral: true });
  }
  ticket.closed = false;
  saveDB();

  await interaction.channel.permissionOverwrites.edit(ticket.user, {
    SendMessages: true
  });

  const msg = (await interaction.channel.messages.fetch({ limit: 10 }))
    .find((m) => m.embeds.length && m.components.length);
  if (msg) {
    const e = EmbedBuilder.from(msg.embeds[0]);
    e.setFooter({ text: "ꜱᴛᴀᴛᴜꜱ: ᴏᴘᴇɴ" });
    await msg.edit({ embeds: [e], components: [buildTicketControls()] });
  }

  await interaction.reply("🔓 ᴛɪᴄᴋᴇᴛ ʀᴇᴏᴘᴇɴᴇᴅ");
}

async function handleDelete(interaction, ticket) {
  delete db.tickets[interaction.channel.id];
  saveDB();
  await interaction.reply({ content: "🗑️ Deleting ticket channel...", ephemeral: true });
  setTimeout(() => interaction.channel.delete().catch(() => {}), 1500);
}

async function handleTranscript(interaction, ticket) {
  const msgCollection = await interaction.channel.messages.fetch({ limit: 100 });
  const msgs = [...msgCollection.values()].sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp
  );

  const content = msgs
    .map((m) => {
      const time = new Date(m.createdTimestamp).toISOString();
      const text = m.content || "";
      return `[${time}] [${m.author?.tag ?? "Unknown"}]: ${text}`;
    })
    .join("\n");

  const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);

  if (!logChannel || !logChannel.isTextBased()) {
    return interaction.reply({
      content: "⚠️ Log channel not found or not text-based.",
      ephemeral: true
    });
  }

  const trimmed =
    content.length > 1900 ? content.slice(0, 1900) + "\n...[truncated]" : content;

  await logChannel.send({
    content: `📄 ᴛʀᴀɴꜱᴄʀɪᴘᴛ #${ticket.id}\n\`\`\`\n${trimmed}\n\`\`\``
  });

  await interaction.reply("📄 ᴛʀᴀɴꜱᴄʀɪᴘᴛ ꜱᴇɴᴛ ᴛᴏ ʟᴏɢ ᴄʜᴀɴɴᴇʟ");
}

/* ================= LOGIN ================= */
client.login(TOKEN);
