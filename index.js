// This is awdev speaking. PAY CLOSE ATTENTION.
// I've intentionally made the code overly verbose and added wayyyyyyyy to many comments to explain the logic.
// This is to help you understand the structure and flow of the bot code Neel.
// Load environment variables from a .env file (e.g., for the bot token)
require('dotenv').config();

// Import required Discord.js modules and other dependencies
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs'); // File system module for reading/writing files
const path = require('path'); // Path module for handling file paths
const schedule = require('node-schedule'); // Library for scheduling jobs (used for recurring tasks)
const http = require('http'); // HTTP module to create a simple web server for uptime monitoring

// Initialize the Discord client with specific intents
// Intents define which events the bot will receive from Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, // For guild-related events
        GatewayIntentBits.GuildMessages, // For message-related events in guilds
        GatewayIntentBits.MessageContent, // To access message content
        GatewayIntentBits.DirectMessages, // For DM-related events
    ],
});

// Attach a commands collection to the client to store loaded commands
client.commands = new Collection();

// Define the path to the schedules.json file where scheduled tasks are stored
const schedulesFile = path.join(__dirname, '/data/schedules.json');
// Initialize the schedules object to store scheduled tasks
let schedules = {};
// Check if the schedules.json file exists; if it does, load its contents
if (fs.existsSync(schedulesFile)) {
    schedules = JSON.parse(fs.readFileSync(schedulesFile, 'utf8'));
} else {
    // If the file doesn't exist, create an empty schedules.json file
    fs.writeFileSync(schedulesFile, JSON.stringify({}, null, 2));
}

// Function to save the schedules object to schedules.json
const saveSchedules = () => {
    console.log('[DEBUG] Saving schedules to schedules.json');
    // Write the schedules object to the file with proper formatting (indented JSON)
    fs.writeFileSync(schedulesFile, JSON.stringify(schedules, null, 2));
};

// Load commands from the 'commands' directory
const commandsPath = path.join(__dirname, 'commands');
// Get a list of all .js files in the commands directory
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Iterate over each command file to load it
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath); // Load the command module
    // Check if the command has the required 'data' and 'execute' properties
    if ('data' in command && 'execute' in command) {
        // Add the command to the client's commands collection
        client.commands.set(command.data.name, command);
        console.log(`[DEBUG] Loaded command ${command.data.name}`);
    } else {
        // Log a warning if the command is missing required properties
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Create a simple HTTP server for uptime monitoring
// This allows external services to check if the bot is running
const server = http.createServer((req, res) => {
    // Respond with a 200 status and a simple message
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!\n');
});

// Start the HTTP server on port 1347, listening on all network interfaces
server.listen(1347, '0.0.0.0', () => {
    console.log('[INFO] Uptime monitoring server running on http://0.0.0.0:1347');
});

// Event handler for when the bot is ready (logged in and connected to Discord)
client.once('ready', () => {
    console.log(`[DEBUG] Logged in as ${client.user.tag}!`);

    // Schedule existing jobs from schedules.json after the bot is ready
    for (const [scheduleId, sched] of Object.entries(schedules)) {
        console.log(`[DEBUG] Loading schedule ${scheduleId} for user ${sched.userId}`);
        console.log(`[DEBUG] Schedule details: ${JSON.stringify(sched)}`);

        // Map day names to their corresponding numerical values (0 = Sunday, 6 = Saturday)
        const daysOfWeek = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6
        };
        // Get the numerical day of the week for the schedule
        const dayNum = daysOfWeek[sched.day.toLowerCase()];
        // Validate the day; skip if invalid
        if (dayNum === undefined) {
            console.log(`[ERROR] Invalid day in schedule ${scheduleId}: ${sched.day}`);
            continue;
        }

        // Function to schedule a job (either one-time or recurring)
        const scheduleJob = () => {
            console.log(`[DEBUG] Scheduling job ${scheduleId}`);
            // Check if the schedule is one-time or non-repeating
            if (!sched.repeat || sched.isOneTime) {
                const scheduledTime = new Date(sched.scheduledTime);
                console.log(`[DEBUG] Scheduling one-time job ${scheduleId} for ${scheduledTime.toISOString()}`);
                // Schedule a one-time job using node-schedule
                schedule.scheduleJob(scheduleId, scheduledTime, async () => {
                    console.log(`[DEBUG] Executing one-time job ${scheduleId} at ${new Date().toISOString()}`);
                    try {
                        // Fetch the user associated with the schedule
                        const user = await client.users.fetch(sched.userId);
                        // Extract the command name (remove the leading '/')
                        const commandName = sched.command.replace('/', '');
                        // Get the command from the client's commands collection
                        const command = client.commands.get(commandName);

                        // Validate that the command exists
                        if (!command) {
                            console.log(`[ERROR] Command ${commandName} not found for schedule ${scheduleId}`);
                            return;
                        }

                        // Create a DM channel with the user
                        const dmChannel = await user.createDM();
                        // Create a mock interaction object to simulate a command execution in DMs
                        const mockInteraction = {
                            user,
                            channel: dmChannel,
                            client,
                            isCommand: () => true,
                            commandName,
                            reply: async (options) => await dmChannel.send(options),
                            editReply: async (options) => await dmChannel.send(options),
                            deferReply: async () => {},
                        };
                        // Execute the command in the user's DMs
                        await command.execute(mockInteraction);
                        console.log(`[DEBUG] Executed command ${commandName} in DM for schedule ${scheduleId}`);

                        // Remove the one-time schedule after execution
                        delete schedules[scheduleId];
                        saveSchedules();
                        console.log(`[DEBUG] Removed one-time schedule ${scheduleId} after execution`);
                    } catch (error) {
                        console.log(`[ERROR] Failed to execute job ${scheduleId}: ${error.message}`);
                    }
                });
            } else {
                // Handle recurring schedules
                // Parse the time (e.g., "2:00" into hour and minute)
                const [hour, minute] = sched.time.split(':').map(Number);
                let adjustedHour = hour;
                // Adjust the hour based on AM/PM
                if (sched.amPm === 'PM' && hour !== 12) adjustedHour += 12;
                if (sched.amPm === 'AM' && hour === 12) adjustedHour = 0;

                // Create a cron expression for the recurring schedule (e.g., "0 14 * * 1" for 2:00 PM on Monday)
                const cronExpression = `${minute} ${adjustedHour} * * ${dayNum}`;
                console.log(`[DEBUG] Scheduling recurring job ${scheduleId} with cron ${cronExpression}`);
                // Schedule a recurring job using node-schedule
                schedule.scheduleJob(scheduleId, cronExpression, async () => {
                    console.log(`[DEBUG] Executing recurring job ${scheduleId} at ${new Date().toISOString()}`);
                    try {
                        // Fetch the user associated with the schedule
                        const user = await client.users.fetch(sched.userId);
                        // Extract the command name
                        const commandName = sched.command.replace('/', '');
                        // Get the command from the client's commands collection
                        const command = client.commands.get(commandName);

                        // Validate that the command exists
                        if (!command) {
                            console.log(`[ERROR] Command ${commandName} not found for schedule ${scheduleId}`);
                            return;
                        }

                        // Create a DM channel with the user
                        const dmChannel = await user.createDM();
                        // Create a mock interaction object for DM execution
                        const mockInteraction = {
                            user,
                            channel: dmChannel,
                            client,
                            isCommand: () => true,
                            commandName,
                            reply: async (options) => await dmChannel.send(options),
                            editReply: async (options) => await dmChannel.send(options),
                            deferReply: async () => {},
                        };
                        // Execute the command in the user's DMs
                        await command.execute(mockInteraction);
                        console.log(`[DEBUG] Executed command ${commandName} in DM for schedule ${scheduleId}`);
                    } catch (error) {
                        console.log(`[ERROR] Failed to execute job ${scheduleId}: ${error.message}`);
                    }
                });
            }
        };

        // Call the function to schedule the job
        scheduleJob();
    }

    // Log all active scheduled jobs for debugging
    console.log('[DEBUG] Active scheduled jobs:');
    for (const [name, job] of Object.entries(schedule.scheduledJobs)) {
        console.log(`[DEBUG] Job ${name}: Next invocation at ${job.nextInvocation()?.toISOString() || 'unknown'}`);
    }
});

// Event handler for Discord interactions (commands and modal submissions)
client.on('interactionCreate', async interaction => {
    // Ignore interactions that aren't commands or modal submissions
    if (!interaction.isCommand() && !interaction.isModalSubmit()) return;

    // Handle command interactions
    if (interaction.isCommand()) {
        // Get the command from the client's commands collection
        const command = client.commands.get(interaction.commandName);
        if (!command) return; // Ignore if the command doesn't exist

        try {
            // Execute the command, passing the interaction, schedules, and saveSchedules function
            await command.execute(interaction, schedules, saveSchedules);
        } catch (error) {
            // Log any errors during command execution and notify the user
            console.error(`[ERROR] Command execution failed: ${error.message}`);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

// Get the bot token from environment variables
const botToken = process.env.TOKEN;
// Validate that the token exists; exit if it doesn't
if (!botToken) {
    console.error('[ERROR] TOKEN not found in .env file. Please set it and restart the bot.');
    process.exit(1);
}
// Log the bot into Discord using the token
client.login(botToken);