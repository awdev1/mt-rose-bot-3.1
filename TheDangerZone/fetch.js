// This is awdev speaking. PAY CLOSE ATTENTION.
// I've intentionally made the code overly verbose and added wayyyyyyyy to many comments to explain the logic.
// This is to help you understand the structure and flow of the bot code Neel.
// This code asks discord for the commands registered in the guild and logs them to the console.
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId } = require('../config.json'); // Ensure these are set in config.json
require('dotenv').config();

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Fetching application (/) commands.');

        // Fetch existing commands
        const commands = await rest.get(Routes.applicationGuildCommands(clientId, guildId));

        // Log existing commands
        console.log('Existing commands:', commands);

        console.log('Successfully fetched all application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
