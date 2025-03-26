const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
require('dotenv').config(); // Load environment variables from .env file

// Retrieve credentials from environment variables
const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

// Initialize the bot client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Create an instance of the REST client
const rest = new REST({ version: '10' }).setToken(token);

// Function to delete all guild-specific slash commands
async function deleteGuildCommands() {
  try {
    // Fetch all guild-specific slash commands using the correct route
    const commands = await rest.get(Routes.applicationGuildCommands(clientId, guildId));

    // Log the fetched commands to check if any are returned
    console.log('Fetched guild-specific commands:', commands);

    // If no commands were found
    if (commands.length === 0) {
      console.log('No guild-specific commands found to delete.');
      return;
    }

    // Loop through each command and delete it
    for (const command of commands) {
      await rest.delete(Routes.applicationGuildCommand(clientId, guildId, command.id));
      console.log(`Deleted guild-specific command: ${command.name}`);
    }
  } catch (error) {
    console.error('Error deleting commands:', error);
  }
}

// When the bot is ready
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  deleteGuildCommands();
});

// Login to Discord with your app's token
client.login(token);
