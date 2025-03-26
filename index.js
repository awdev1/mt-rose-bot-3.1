require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');
const http = require('http'); // Add the http module for the web server

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
});

client.commands = new Collection();

const schedulesFile = path.join(__dirname, '/data/schedules.json');
let schedules = {};
if (fs.existsSync(schedulesFile)) {
    schedules = JSON.parse(fs.readFileSync(schedulesFile, 'utf8'));
} else {
    fs.writeFileSync(schedulesFile, JSON.stringify({}, null, 2));
}

const saveSchedules = () => {
    console.log('[DEBUG] Saving schedules to schedules.json');
    fs.writeFileSync(schedulesFile, JSON.stringify(schedules, null, 2));
};

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`[DEBUG] Loaded command ${command.data.name}`);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Start a simple web server for uptime monitoring on localhost:1347
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!\n');
});

server.listen(1347, '0.0.0.0', () => {
    console.log('[INFO] Uptime monitoring server running on http://0.0.0.0:1347');
});

client.once('ready', () => {
    console.log(`[DEBUG] Logged in as ${client.user.tag}!`);

    // Schedule existing jobs after the bot is ready and commands are loaded
    for (const [scheduleId, sched] of Object.entries(schedules)) {
        console.log(`[DEBUG] Loading schedule ${scheduleId} for user ${sched.userId}`);
        console.log(`[DEBUG] Schedule details: ${JSON.stringify(sched)}`);

        const daysOfWeek = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6
        };
        const dayNum = daysOfWeek[sched.day.toLowerCase()];
        if (dayNum === undefined) {
            console.log(`[ERROR] Invalid day in schedule ${scheduleId}: ${sched.day}`);
            continue;
        }

        const scheduleJob = () => {
            console.log(`[DEBUG] Scheduling job ${scheduleId}`);
            if (!sched.repeat || sched.isOneTime) {
                const scheduledTime = new Date(sched.scheduledTime);
                console.log(`[DEBUG] Scheduling one-time job ${scheduleId} for ${scheduledTime.toISOString()}`);
                schedule.scheduleJob(scheduleId, scheduledTime, async () => {
                    console.log(`[DEBUG] Executing one-time job ${scheduleId} at ${new Date().toISOString()}`);
                    try {
                        const user = await client.users.fetch(sched.userId);
                        const commandName = sched.command.replace('/', '');
                        const command = client.commands.get(commandName);

                        if (!command) {
                            console.log(`[ERROR] Command ${commandName} not found for schedule ${scheduleId}`);
                            return;
                        }

                        const dmChannel = await user.createDM();
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
                        await command.execute(mockInteraction);
                        console.log(`[DEBUG] Executed command ${commandName} in DM for schedule ${scheduleId}`);

                        delete schedules[scheduleId];
                        saveSchedules();
                        console.log(`[DEBUG] Removed one-time schedule ${scheduleId} after execution`);
                    } catch (error) {
                        console.log(`[ERROR] Failed to execute job ${scheduleId}: ${error.message}`);
                    }
                });
            } else {
                const [hour, minute] = sched.time.split(':').map(Number);
                let adjustedHour = hour;
                if (sched.amPm === 'PM' && hour !== 12) adjustedHour += 12;
                if (sched.amPm === 'AM' && hour === 12) adjustedHour = 0;

                const cronExpression = `${minute} ${adjustedHour} * * ${dayNum}`;
                console.log(`[DEBUG] Scheduling recurring job ${scheduleId} with cron ${cronExpression}`);
                schedule.scheduleJob(scheduleId, cronExpression, async () => {
                    console.log(`[DEBUG] Executing recurring job ${scheduleId} at ${new Date().toISOString()}`);
                    try {
                        const user = await client.users.fetch(sched.userId);
                        const commandName = sched.command.replace('/', '');
                        const command = client.commands.get(commandName);

                        if (!command) {
                            console.log(`[ERROR] Command ${commandName} not found for schedule ${scheduleId}`);
                            return;
                        }

                        const dmChannel = await user.createDM();
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
                        await command.execute(mockInteraction);
                        console.log(`[DEBUG] Executed command ${commandName} in DM for schedule ${scheduleId}`);
                    } catch (error) {
                        console.log(`[ERROR] Failed to execute job ${scheduleId}: ${error.message}`);
                    }
                });
            }
        };

        scheduleJob();
    }

    console.log('[DEBUG] Active scheduled jobs:');
    for (const [name, job] of Object.entries(schedule.scheduledJobs)) {
        console.log(`[DEBUG] Job ${name}: Next invocation at ${job.nextInvocation()?.toISOString() || 'unknown'}`);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() && !interaction.isModalSubmit()) return;

    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction, schedules, saveSchedules);
        } catch (error) {
            console.error(`[ERROR] Command execution failed: ${error.message}`);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

const botToken = process.env.TOKEN;
if (!botToken) {
    console.error('[ERROR] TOKEN not found in .env file. Please set it and restart the bot.');
    process.exit(1);
}
client.login(botToken);