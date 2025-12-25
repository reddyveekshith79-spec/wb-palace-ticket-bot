const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("ready", async () => {
  console.log(`✅ Ticket bot online as ${client.user.tag}`);

  await client.application.commands.set([
    {
      name: "tickets",
      description: "Open a support ticket"
    }
  ], process.env.GUILD_ID);
});

/* ===== SLASH COMMAND ===== */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "tickets") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ admin only.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle("🎟️ tickets")
      .setDescription(
        "🎁 **giveaway claim**\n" +
        "🤝 **partner**\n" +
        "❓ **support**"
      )
      .setColor(0x5865F2);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("giveaway")
        .setLabel("🎁 giveaway claim")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("partner")
        .setLabel("🤝 partner")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("support")
        .setLabel("❓ support")
        .setStyle(ButtonStyle.Secondary)
    );

    interaction.reply({ embeds: [embed], components: [row] });
  }
});

/* ===== BUTTON HANDLER ===== */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const guild = interaction.guild;
  const member = interaction.member;

  const channel = await guild.channels.create({
    name: `ticket-${member.user.username}`.toLowerCase(),
    type: ChannelType.GuildText,
    parent: process.env.TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: process.env.STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ]
  });

  let questions = [];

  if (interaction.customId === "giveaway") {
    questions = [
      "what did you win / how much?",
      "who hosted the giveaway?"
    ];
  }

  if (interaction.customId === "partner") {
    questions = [
      "how many members does your server have?",
      "do you agree with our partnership requirements? (yes / no)"
    ];
  }

  if (interaction.customId === "support") {
    questions = [
      "what do you need help with?"
    ];
  }

  const embed = new EmbedBuilder()
    .setTitle("📝 please answer")
    .setDescription(questions.map((q, i) => `${i + 1}. ${q}`).join("\n"))
    .setColor(0x2ECC71);

  channel.send({
    content: `<@${member.id}> <@&${process.env.STAFF_ROLE_ID}>`,
    embeds: [embed]
  });

  interaction.reply({ content: "✅ ticket created.", ephemeral: true });
});

client.login(process.env.TOKEN);
