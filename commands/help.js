// This is awdev speaking. PAY CLOSE ATTENTION.
// I've intentionally made the code overly verbose and added wayyyyyyyy to many comments to explain the logic.
// Import required Discord.js modules for building slash commands and embeds
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Define the /help slash command
module.exports = {
    // Define the command's metadata using SlashCommandBuilder
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get information about available commands for the Mt. Rose Bot.'),

    // Execute function for the /help command
    async execute(interaction) {
        // Defer the reply to give the bot time to build the embed
        await interaction.deferReply({ ephemeral: true });

        // Create an embed to display the help information
        const helpEmbed = new EmbedBuilder()
            .setTitle('🏔️ Mt. Rose Bot Help')
            .setDescription('Here’s a list of commands you can use to interact with the Mt. Rose Bot. This bot provides updates and visuals for the Mt. Rose Ski Resort.')
            .setColor('#87CEEB') // Light blue color to match the theme of the /get command
            .setThumbnail('https://skirose.com/wp-content/uploads/2023/07/cropped-Mt.-Rose-Logo.png') // Optional: Add a thumbnail (Mt. Rose logo)
            .addFields(
                // Field for the /get command
                {
                    name: '📊 /get',
                    value: 'Fetches the latest Mt. Rose snow report, including weather conditions, lift status, terrain parks, chutes, parking, and more.\n' +
                           '**Example:** `/get`\n' +
                           '- This will display a detailed snow report in the channel.',
                    inline: false,
                },
                // Field for the /visualize command
                {
                    name: '📸 /visualize',
                    value: 'Retrieves live camera images from 4 locations on the Mt. Rose Ski Resort.\n' +
                           '**Example:** `/visualize`\n' +
                           '- This will send images from the resort’s cameras to the channel.',
                    inline: false,
                },
                // Field for the /schedule command
                {
                    name: '⏰ /schedule',
                    value: 'Manage scheduled tasks to run commands in your DMs. Subcommands include:\n' +
                           '- **create**: Create a new schedule to run a command (e.g., `/get` or `/visualize`) at a specific time.\n' +
                           '- **view**: View all your scheduled tasks.\n' +
                           '- **edit**: Edit an existing schedule.\n' +
                           '- **delete**: Delete a schedule using a dropdown menu.\n' +
                           '**Example:** `/schedule create`\n' +
                           '- This will open a modal to set up a schedule, such as running `/get` every Monday at 8:00 AM.',
                    inline: false,
                },
                // Field for additional information
                {
                    name: 'ℹ️ Additional Information',
                    value: 'All commands are designed to help you stay updated on Mt. Rose Ski Resort conditions. If you encounter any issues, please contact <@717412351451594852>.\n' +
                           '- The bot uses official data from [skirose.com](https://skirose.com/snow-report/).\n' +
                           '- Schedules run commands in your DMs, so make sure the bot can message you!',
                    inline: false,
                }
            )
            .setFooter({ text: 'Mt. Rose Bot | Helping you shred the slopes since 2025!' })
            .setTimestamp(); // Add the current timestamp

        // Send the help embed to the user
        await interaction.editReply({ embeds: [helpEmbed], ephemeral: true });
    },
};