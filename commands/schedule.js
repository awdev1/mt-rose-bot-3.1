// This is awdev speaking. PAY CLOSE ATTENTION.
// I've intentionally made the code overly verbose and added wayyyyyyyy to many comments to explain the logic.
// This is to help you understand the structure and flow of the bot code Neel.
// Import required Discord.js modules for building slash commands, modals, embeds, and select menus
const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require('discord.js');
// Import node-schedule for scheduling recurring or one-time jobs
const schedule = require('node-schedule');

// Define the /schedule slash command
module.exports = {
    // Define the command's metadata using SlashCommandBuilder
    data: new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('Manage your schedules')
        // Subcommand: /schedule create
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new schedule to run a command in DMs'))
        // Subcommand: /schedule view
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View your schedules'))
        // Subcommand: /schedule edit
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit an existing schedule'))
        // Subcommand: /schedule delete (now using a dropdown, so no options needed)
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a schedule')),

    // Execute function for the /schedule command
    async execute(interaction, schedules, saveSchedules) {
        const subcommand = interaction.options.getSubcommand(); // Get the subcommand name
        console.log(`[DEBUG] Executing /schedule and opening modal ${subcommand} for user ${interaction.user.id}`);

        // Utility function to parse time input and validate it
        const parseTimeInput = (timeInputValue, selectedDay, daysOfWeek) => {
            let hour, minute, amPmUpper, adjustedHour, dayNum, time, isOneTime = false, scheduledTime;

            // Handle special "now" keyword (schedules the job 10 seconds from now)
            if (timeInputValue.toLowerCase() === 'now') {
                const now = new Date(Date.now() + 10 * 1000); // Schedule 10 seconds in the future
                scheduledTime = now;
                hour = now.getHours();
                minute = now.getMinutes();
                amPmUpper = hour >= 12 ? 'PM' : 'AM';
                adjustedHour = hour;
                time = `${(hour % 12) || 12}:${minute.toString().padStart(2, '0')}`;
                dayNum = now.getDay();
                isOneTime = true; // Mark as a one-time job
                console.log(`[DEBUG] Using "now" - Scheduled for ${time} ${amPmUpper} on day ${dayNum} at ${scheduledTime.toISOString()}`);
            } else {
                // Validate time format (e.g., "2:00 PM")
                const timeRegex = /^([0-1]?[0-9]):([0-5][0-9])\s*(AM|PM)$/i;
                if (!timeRegex.test(timeInputValue)) {
                    return { error: 'Invalid time format. Use HH:MM AM/PM (e.g., 2:00 PM) or "now".' };
                }

                // Extract hour, minute, and AM/PM from the time input
                const [, hourStr, minuteStr, amPm] = timeInputValue.match(timeRegex);
                hour = parseInt(hourStr, 10);
                minute = parseInt(minuteStr, 10);
                amPmUpper = amPm.toUpperCase();

                // Validate the hour
                if (hour < 1 || hour > 12) {
                    return { error: 'Hour must be between 1 and 12.' };
                }

                // Adjust the hour for 24-hour format
                adjustedHour = hour;
                if (amPmUpper === 'PM' && hour !== 12) adjustedHour += 12;
                if (amPmUpper === 'AM' && hour === 12) adjustedHour = 0;
                time = `${hour}:${minuteStr.padStart(2, '0')}`;
                // Get the numerical day of the week (0 = Sunday, 6 = Saturday)
                dayNum = daysOfWeek.indexOf(selectedDay.toLowerCase());
            }

            return { hour, minute, amPmUpper, adjustedHour, dayNum, time, isOneTime, scheduledTime };
        };

        // Function to schedule a job (either one-time or recurring)
        const scheduleJob = (scheduleId, day, time, amPmUpper, command, dayNum, adjustedHour, minute, isOneTime, scheduledTime, repeat, client, userId) => {
            // Handle one-time or non-repeating jobs
            if (isOneTime || !repeat) {
                // Determine the exact date for a one-time job
                const oneTimeDate = isOneTime ? scheduledTime : (() => {
                    const now = new Date();
                    const scheduledDate = new Date(now);
                    scheduledDate.setHours(adjustedHour, minute, 0, 0);
                    const dayIndex = dayNum - now.getDay();
                    // Adjust the date to the next occurrence of the specified day
                    scheduledDate.setDate(now.getDate() + (dayIndex >= 0 ? dayIndex : dayIndex + 7));
                    if (scheduledDate < now) {
                        scheduledDate.setDate(scheduledDate.getDate() + 7); // Push to next week if the date has passed
                    }
                    return scheduledDate;
                })();

                console.log(`[DEBUG] Scheduling one-time job ${scheduleId} for ${oneTimeDate.toISOString()}`);
                // Schedule the one-time job using node-schedule
                schedule.scheduleJob(scheduleId, oneTimeDate, async () => {
                    console.log(`[DEBUG] Executing one-time job ${scheduleId} at ${new Date().toISOString()}`);
                    try {
                        // Fetch the user associated with the schedule
                        const user = await client.users.fetch(userId);
                        // Extract the command name (remove the leading '/')
                        const commandName = command.replace('/', '');
                        // Get the command from the client's commands collection
                        const commandToExecute = client.commands.get(commandName);

                        // Validate that the command exists
                        if (!commandToExecute) {
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
                            followUp: async (options) => await dmChannel.send(options),
                        };
                        // Execute the command in the user's DMs
                        await commandToExecute.execute(mockInteraction);
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
                // Handle recurring jobs
                // Create a cron expression (e.g., "0 14 * * 1" for 2:00 PM on Monday)
                const cronExpression = `${minute} ${adjustedHour} * * ${dayNum}`;
                console.log(`[DEBUG] Scheduling recurring job ${scheduleId} with cron ${cronExpression}`);
                // Schedule the recurring job using node-schedule
                schedule.scheduleJob(scheduleId, cronExpression, async () => {
                    console.log(`[DEBUG] Executing recurring job ${scheduleId} at ${new Date().toISOString()}`);
                    try {
                        // Fetch the user associated with the schedule
                        const user = await client.users.fetch(userId);
                        // Extract the command name
                        const commandName = command.replace('/', '');
                        // Get the command from the client's commands collection
                        const commandToExecute = client.commands.get(commandName);

                        // Validate that the command exists
                        if (!commandToExecute) {
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
                            followUp: async (options) => await dmChannel.send(options),
                        };
                        // Execute the command in the user's DMs
                        await commandToExecute.execute(mockInteraction);
                        console.log(`[DEBUG] Executed command ${commandName} in DM for schedule ${scheduleId}`);
                    } catch (error) {
                        console.log(`[ERROR] Failed to execute job ${scheduleId}: ${error.message}`);
                    }
                });
            }

            // Verify that the job was scheduled successfully
            const job = schedule.scheduledJobs[scheduleId];
            if (!job) {
                console.log(`[ERROR] Failed to schedule job ${scheduleId}`);
                return false;
            }

            console.log(`[DEBUG] Job ${scheduleId} scheduled. Next invocation at ${job.nextInvocation()?.toISOString() || 'unknown'}`);
            return true;
        };

        // Handle /schedule create subcommand
        if (subcommand === 'create') {
            // Create a modal for creating a new schedule
            const modal = new ModalBuilder()
                .setCustomId('scheduleModal')
                .setTitle('Create a Schedule');

            // Input field for a custom schedule ID (optional)
            const idInput = new TextInputBuilder()
                .setCustomId('idInput')
                .setLabel('Custom ID (leave blank for auto-generated)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            // Input field for the day of the week
            const dayInput = new TextInputBuilder()
                .setCustomId('dayInput')
                .setLabel('Day (e.g., Monday, Tuesday, etc.)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            // Input field for the time
            const timeInput = new TextInputBuilder()
                .setCustomId('timeInput')
                .setLabel('Time (e.g., 2:00 PM or "now" for 10s ahead)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            // Input field for the command to run
            const commandInput = new TextInputBuilder()
                .setCustomId('commandInput')
                .setLabel('Command to run (e.g., /get, /visualize, /vis)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            // Input field for whether the schedule should repeat weekly
            const repeatInput = new TextInputBuilder()
                .setCustomId('repeatInput')
                .setLabel('Repeat weekly? (yes/no)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            // Add the input fields to the modal
            modal.addComponents(
                new ActionRowBuilder().addComponents(idInput),
                new ActionRowBuilder().addComponents(dayInput),
                new ActionRowBuilder().addComponents(timeInput),
                new ActionRowBuilder().addComponents(commandInput),
                new ActionRowBuilder().addComponents(repeatInput)
            );

            // Show the modal to the user
            await interaction.showModal(modal);

            // Wait for the user to submit the modal (with a 60-second timeout)
            const filter = i => i.customId === 'scheduleModal' && i.user.id === interaction.user.id;
            const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 60000 }).catch(error => {
                console.log(`[ERROR] Modal submission failed: ${error.message}`);
                return null;
            });

            // Handle timeout or failure of modal submission
            if (!modalInteraction) {
                await interaction.followUp({ content: 'Modal submission timed out or failed.', ephemeral: true });
                return;
            }

            // Extract values from the modal inputs
            let customId = modalInteraction.fields.getTextInputValue('idInput')?.trim();
            const day = modalInteraction.fields.getTextInputValue('dayInput').trim();
            const timeInputValue = modalInteraction.fields.getTextInputValue('timeInput').trim();
            let command = modalInteraction.fields.getTextInputValue('commandInput').trim();
            const repeat = modalInteraction.fields.getTextInputValue('repeatInput').trim().toLowerCase() === 'yes';

            // Validate the day of the week
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            if (!daysOfWeek.includes(day.toLowerCase())) {
                await modalInteraction.reply({ content: 'Invalid day. Must be a day of the week (e.g., Monday).', ephemeral: true });
                return;
            }

            // Parse and validate the time input
            const timeResult = parseTimeInput(timeInputValue, day, daysOfWeek);
            if (timeResult.error) {
                await modalInteraction.reply({ content: timeResult.error, ephemeral: true });
                return;
            }

            const { hour, minute, amPmUpper, adjustedHour, dayNum, time, isOneTime, scheduledTime } = timeResult;

            // Validate the command
            const validCommands = ['/get', '/visualize', '/vis'];
            if (!validCommands.includes(command)) {
                await modalInteraction.reply({ content: 'Invalid command. Must be one of: /get, /visualize, /vis.', ephemeral: true });
                return;
            }

            // Map /vis to /visualize
            if (command === '/vis') {
                command = '/visualize';
            }

            // Validate the repeat option
            if (!['yes', 'no'].includes(repeat ? 'yes' : 'no')) {
                await modalInteraction.reply({ content: 'Invalid repeat option. Must be "yes" or "no".', ephemeral: true });
                return;
            }

            // Handle custom ID for the schedule
            let scheduleId;
            if (customId) {
                // Validate custom ID length and characters
                if (customId.length > 50) {
                    await modalInteraction.reply({ content: 'Custom ID must be 50 characters or less.', ephemeral: true });
                    return;
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(customId)) {
                    await modalInteraction.reply({ content: 'Custom ID can only contain letters, numbers, underscores, and hyphens.', ephemeral: true });
                    return;
                }
                scheduleId = customId;
                // Check for duplicate IDs
                if (schedules[scheduleId]) {
                    await modalInteraction.reply({ content: 'A schedule with this ID already exists. Please choose a different ID.', ephemeral: true });
                    return;
                }
            } else {
                // Auto-generate a unique ID if none provided
                scheduleId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            }

            // Create a cron expression for recurring jobs
            const cronExpression = (isOneTime || !repeat) ? null : `${minute} ${adjustedHour} * * ${dayNum}`;

            // Schedule the job
            const jobScheduled = scheduleJob(
                scheduleId,
                day,
                time,
                amPmUpper,
                command,
                dayNum,
                adjustedHour,
                minute,
                isOneTime,
                scheduledTime,
                repeat,
                interaction.client,
                interaction.user.id
            );
            if (!jobScheduled) {
                await modalInteraction.reply({ content: 'Failed to schedule the job. Please try again.', ephemeral: true });
                return;
            }

            // Save the schedule to the schedules object
            schedules[scheduleId] = {
                userID: interaction.user.id, // Store userID
                day,
                time,
                amPm: amPmUpper,
                command,
                cronExpression,
                isOneTime,
                scheduledTime: (isOneTime || !repeat) ? (isOneTime ? scheduledTime : schedule.scheduledJobs[scheduleId].nextInvocation()).toISOString() : undefined,
                repeat,
            };
            saveSchedules(); // Persist the schedules to file

            // Notify the user of successful schedule creation
            await modalInteraction.reply({ content: `Schedule created! ID: ${scheduleId}`, ephemeral: true });
        }

        // Handle /schedule view subcommand
        if (subcommand === 'view') {
            // Filter schedules to only show those belonging to the user
            const userSchedules = Object.entries(schedules).filter(([_, sched]) => sched.userID === interaction.user.id);
            if (userSchedules.length === 0) {
                await interaction.reply({ content: 'You have no schedules.', ephemeral: true });
                return;
            }

            // Create an embed to display the user's schedules
            const embed = new EmbedBuilder()
                .setTitle('Your Schedules')
                .setColor('#0099ff');

            // Add each schedule as a field in the embed
            userSchedules.forEach(([id, sched], index) => {
                embed.addFields({
                    name: `Schedule ${index + 1} (ID: ${id})`,
                    value: `Day: ${sched.day}, Time: ${sched.time} ${sched.amPm}, Command: ${sched.command}, Repeat: ${sched.repeat ? 'Yes' : 'No'}${sched.isOneTime || !sched.repeat ? ` (One-time, fires at ${new Date(sched.scheduledTime).toISOString()})` : ''}`,
                });
            });

            // Send the embed to the user
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Handle /schedule edit subcommand
        if (subcommand === 'edit') {
            // Filter schedules to only show those belonging to the user
            const userSchedules = Object.entries(schedules).filter(([_, sched]) => sched.userID === interaction.user.id);
            if (userSchedules.length === 0) {
                await interaction.reply({ content: 'You have no schedules to edit.', ephemeral: true });
                return;
            }

            // Create a dropdown menu for selecting a schedule to edit
            const scheduleSelect = new StringSelectMenuBuilder()
                .setCustomId('scheduleSelect')
                .setPlaceholder('Select a schedule to edit')
                .addOptions(
                    userSchedules.map(([id, sched], index) =>
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`Schedule ${index + 1} (ID: ${id})`)
                            .setDescription(`Day: ${sched.day}, Time: ${sched.time} ${sched.amPm}, Command: ${sched.command}`)
                            .setValue(id)
                    )
                );

            // Add the dropdown to an action row
            const row = new ActionRowBuilder().addComponents(scheduleSelect);

            // Create an embed to prompt the user to select a schedule
            const embed = new EmbedBuilder()
                .setTitle('Select a Schedule to Edit')
                .setDescription('Choose a schedule from the dropdown below.')
                .setColor('#0099ff');

            // Send the embed and dropdown to the user
            const response = await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true,
            });

            // Wait for the user to select a schedule (with a 60-second timeout)
            const filter = i => i.customId === 'scheduleSelect' && i.user.id === interaction.user.id;
            const selectInteraction = await response.awaitMessageComponent({ filter, time: 60000 }).catch(error => {
                console.log(`[ERROR] Schedule selection failed: ${error.message}`);
                return null;
            });

            // Handle timeout or failure of selection
            if (!selectInteraction) {
                await interaction.editReply({ content: 'Schedule selection timed out.', embeds: [], components: [], ephemeral: true });
                return;
            }

            // Get the selected schedule ID
            const scheduleId = selectInteraction.values[0];
            const selectedSchedule = schedules[scheduleId];

            // Create a modal for editing the selected schedule
            const editModal = new ModalBuilder()
                .setCustomId('editScheduleModal')
                .setTitle('Edit Schedule');

            // Input field for a new custom ID (pre-filled with the current ID)
            const idInput = new TextInputBuilder()
                .setCustomId('idInput')
                .setLabel('New Custom ID (leave blank to keep current)')
                .setStyle(TextInputStyle.Short)
                .setValue(scheduleId) // Show the full ID since there's no prefix
                .setRequired(false);

            // Input field for the day (pre-filled with the current value)
            const dayInput = new TextInputBuilder()
                .setCustomId('dayInput')
                .setLabel('Day (e.g., Monday, Tuesday, etc.)')
                .setStyle(TextInputStyle.Short)
                .setValue(selectedSchedule.day)
                .setRequired(true);

            // Input field for the time (pre-filled with the current value)
            const timeInput = new TextInputBuilder()
                .setCustomId('timeInput')
                .setLabel('Time (e.g., 2:00 PM or "now" for 10s ahead)')
                .setStyle(TextInputStyle.Short)
                .setValue(`${selectedSchedule.time} ${selectedSchedule.amPm}`)
                .setRequired(true);

            // Input field for the command (pre-filled with the current value)
            const commandInput = new TextInputBuilder()
                .setCustomId('commandInput')
                .setLabel('Command to run (e.g., /get, /visualize, /vis)')
                .setStyle(TextInputStyle.Short)
                .setValue(selectedSchedule.command)
                .setRequired(true);

            // Input field for the repeat option (pre-filled with the current value)
            const repeatInput = new TextInputBuilder()
                .setCustomId('repeatInput')
                .setLabel('Repeat weekly? (yes/no)')
                .setStyle(TextInputStyle.Short)
                .setValue(selectedSchedule.repeat ? 'yes' : 'no')
                .setRequired(true);

            // Add the input fields to the modal
            editModal.addComponents(
                new ActionRowBuilder().addComponents(idInput),
                new ActionRowBuilder().addComponents(dayInput),
                new ActionRowBuilder().addComponents(timeInput),
                new ActionRowBuilder().addComponents(commandInput),
                new ActionRowBuilder().addComponents(repeatInput)
            );

            // Show the modal to the user
            await selectInteraction.showModal(editModal);

            // Wait for the user to submit the modal (with a 60-second timeout)
            const modalFilter = i => i.customId === 'editScheduleModal' && i.user.id === interaction.user.id;
            const modalInteraction = await selectInteraction.awaitModalSubmit({ filter: modalFilter, time: 60000 }).catch(error => {
                console.log(`[ERROR] Edit modal submission failed: ${error.message}`);
                return null;
            });

            // Handle timeout or failure of modal submission
            if (!modalInteraction) {
                await interaction.editReply({ content: 'Modal submission timed out or failed.', embeds: [], components: [], ephemeral: true });
                return;
            }

            // Extract values from the modal inputs
            let newCustomId = modalInteraction.fields.getTextInputValue('idInput')?.trim();
            const day = modalInteraction.fields.getTextInputValue('dayInput').trim();
            const timeInputValue = modalInteraction.fields.getTextInputValue('timeInput').trim();
            let command = modalInteraction.fields.getTextInputValue('commandInput').trim();
            const repeat = modalInteraction.fields.getTextInputValue('repeatInput').trim().toLowerCase() === 'yes';

            // Validate the day of the week
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            if (!daysOfWeek.includes(day.toLowerCase())) {
                await modalInteraction.reply({ content: 'Invalid day. Must be a day of the week (e.g., Monday).', ephemeral: true });
                return;
            }

            // Parse and validate the time input
            const timeResult = parseTimeInput(timeInputValue, day, daysOfWeek);
            if (timeResult.error) {
                await modalInteraction.reply({ content: timeResult.error, ephemeral: true });
                return;
            }

            const { hour, minute, amPmUpper, adjustedHour, dayNum, time, isOneTime, scheduledTime } = timeResult;

            // Validate the command
            const validCommands = ['/get', '/visualize', '/vis'];
            if (!validCommands.includes(command)) {
                await modalInteraction.reply({ content: 'Invalid command. Must be one of: /get, /visualize, /vis.', ephemeral: true });
                return;
            }

            // Map /vis to /visualize
            if (command === '/vis') {
                command = '/visualize';
            }

            // Validate the repeat option
            if (!['yes', 'no'].includes(repeat ? 'yes' : 'no')) {
                await modalInteraction.reply({ content: 'Invalid repeat option. Must be "yes" or "no".', ephemeral: true });
                return;
            }

            // Handle custom ID for edit
            let newScheduleId = scheduleId;
            if (newCustomId) {
                // Validate new custom ID length and characters
                if (newCustomId.length > 50) {
                    await modalInteraction.reply({ content: 'Custom ID must be 50 characters or less.', ephemeral: true });
                    return;
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(newCustomId)) {
                    await modalInteraction.reply({ content: 'Custom ID can only contain letters, numbers, underscores, and hyphens.', ephemeral: true });
                    return;
                }
                newScheduleId = newCustomId;
                // Check for duplicate IDs (unless it's the same ID)
                if (newScheduleId !== scheduleId && schedules[newScheduleId]) {
                    await modalInteraction.reply({ content: 'A schedule with this ID already exists. Please choose a different ID.', ephemeral: true });
                    return;
                }
            }

            // Cancel the existing job before rescheduling
            const jobs = schedule.scheduledJobs;
            if (jobs[scheduleId]) {
                jobs[scheduleId].cancel();
                console.log(`[DEBUG] Canceled job ${scheduleId} for editing`);
            } else {
                console.log(`[WARNING] Job ${scheduleId} not found in scheduled jobs during edit`);
            }

            // Create a new cron expression for recurring jobs
            const cronExpression = (isOneTime || !repeat) ? null : `${minute} ${adjustedHour} * * ${dayNum}`;
            // Reschedule the job with the updated details
            const jobScheduled = scheduleJob(
                newScheduleId,
                day,
                time,
                amPmUpper,
                command,
                dayNum,
                adjustedHour,
                minute,
                isOneTime,
                scheduledTime,
                repeat,
                interaction.client,
                interaction.user.id
            );
            if (!jobScheduled) {
                await modalInteraction.reply({ content: 'Failed to schedule the job. Please try again.', ephemeral: true });
                return;
            }

            // If the ID changed, remove the old schedule entry
            if (newScheduleId !== scheduleId) {
                delete schedules[scheduleId];
            }

            // Update the schedules object with the new details
            schedules[newScheduleId] = {
                userID: interaction.user.id, // Store userID
                day,
                time,
                amPm: amPmUpper,
                command,
                cronExpression,
                isOneTime,
                scheduledTime: (isOneTime || !repeat) ? (isOneTime ? scheduledTime : schedule.scheduledJobs[newScheduleId].nextInvocation()).toISOString() : undefined,
                repeat,
            };
            saveSchedules(); // Persist the schedules to file

            // Notify the user of successful schedule update
            await modalInteraction.reply({ content: `Schedule ${newScheduleId} updated!`, ephemeral: true });
        }

        // Handle /schedule delete subcommand (now using a dropdown)
        if (subcommand === 'delete') {
            // Filter schedules to only show those belonging to the user
            const userSchedules = Object.entries(schedules).filter(([_, sched]) => sched.userID === interaction.user.id);
            if (userSchedules.length === 0) {
                await interaction.reply({ content: 'You have no schedules to delete.', ephemeral: true });
                return;
            }

            // Create a dropdown menu for selecting a schedule to delete
            const scheduleSelect = new StringSelectMenuBuilder()
                .setCustomId('deleteScheduleSelect')
                .setPlaceholder('Select a schedule to delete')
                .addOptions(
                    userSchedules.map(([id, sched], index) =>
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`Schedule ${index + 1} (ID: ${id})`)
                            .setDescription(`Day: ${sched.day}, Time: ${sched.time} ${sched.amPm}, Command: ${sched.command}`)
                            .setValue(id)
                    )
                );

            // Add the dropdown to an action row
            const row = new ActionRowBuilder().addComponents(scheduleSelect);

            // Create an embed to prompt the user to select a schedule
            const embed = new EmbedBuilder()
                .setTitle('Select a Schedule to Delete')
                .setDescription('Choose a schedule from the dropdown below to delete.')
                .setColor('#ff0000'); // Red color to indicate deletion

            // Send the embed and dropdown to the user
            const response = await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true,
            });

            // Wait for the user to select a schedule (with a 60-second timeout)
            const filter = i => i.customId === 'deleteScheduleSelect' && i.user.id === interaction.user.id;
            const selectInteraction = await response.awaitMessageComponent({ filter, time: 60000 }).catch(error => {
                console.log(`[ERROR] Schedule deletion selection failed: ${error.message}`);
                return null;
            });

            // Handle timeout or failure of selection
            if (!selectInteraction) {
                await interaction.editReply({ content: 'Schedule deletion selection timed out.', embeds: [], components: [], ephemeral: true });
                return;
            }

            // Get the selected schedule ID
            const scheduleId = selectInteraction.values[0];

            // Cancel the scheduled job
            const jobs = schedule.scheduledJobs;
            if (jobs[scheduleId]) {
                jobs[scheduleId].cancel();
                console.log(`[DEBUG] Canceled job ${scheduleId}`);
            } else {
                console.log(`[WARNING] Job ${scheduleId} not found in scheduled jobs`);
            }

            // Remove the schedule from the schedules object
            delete schedules[scheduleId];
            saveSchedules(); // Persist the schedules to file

            // Notify the user of successful deletion
            await selectInteraction.update({ content: `Schedule ${scheduleId} deleted.`, embeds: [], components: [], ephemeral: true });
        }
    },
};