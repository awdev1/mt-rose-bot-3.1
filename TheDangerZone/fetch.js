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
