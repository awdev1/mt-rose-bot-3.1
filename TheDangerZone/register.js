// This is awdev speaking. PAY CLOSE ATTENTION.
// I've intentionally made the code overly verbose and added wayyyyyyyy to many comments to explain the logic.
// This is to help you understand the structure and flow of the bot code Neel.
// This code tells discord to register the commands in the bot.
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId } = require('../config.json'); // Ensure these are set in config.json or .env
const fs = require('fs');
require('dotenv').config();

const commands = [];
const commandFiles = fs.readdirSync('../commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`../commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
            body: commands,
        });

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
