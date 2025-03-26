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
const schedule = require('node-schedule');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('Manage your schedules')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new schedule to run a command in DMs'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View your schedules'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit an existing schedule'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a schedule')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('The ID of the schedule to delete')
                        .setRequired(true))),
    async execute(interaction, schedules, saveSchedules) {
        const subcommand = interaction.options.getSubcommand();
        console.log(`[DEBUG] Executing /schedule and opening modal ${subcommand} for user ${interaction.user.id}`);

        const parseTimeInput = (timeInputValue, selectedDay, daysOfWeek) => {
            let hour, minute, amPmUpper, adjustedHour, dayNum, time, isOneTime = false, scheduledTime;

            if (timeInputValue.toLowerCase() === 'now') {
                const now = new Date(Date.now() + 10 * 1000);
                scheduledTime = now;
                hour = now.getHours();
                minute = now.getMinutes();
                amPmUpper = hour >= 12 ? 'PM' : 'AM';
                adjustedHour = hour;
                time = `${(hour % 12) || 12}:${minute.toString().padStart(2, '0')}`;
                dayNum = now.getDay();
                isOneTime = true;
                console.log(`[DEBUG] Using "now" - Scheduled for ${time} ${amPmUpper} on day ${dayNum} at ${scheduledTime.toISOString()}`);
            } else {
                const timeRegex = /^([0-1]?[0-9]):([0-5][0-9])\s*(AM|PM)$/i;
                if (!timeRegex.test(timeInputValue)) {
                    return { error: 'Invalid time format. Use HH:MM AM/PM (e.g., 2:00 PM) or "now".' };
                }

                const [, hourStr, minuteStr, amPm] = timeInputValue.match(timeRegex);
                hour = parseInt(hourStr, 10);
                minute = parseInt(minuteStr, 10);
                amPmUpper = amPm.toUpperCase();

                if (hour < 1 || hour > 12) {
                    return { error: 'Hour must be between 1 and 12.' };
                }

                adjustedHour = hour;
                if (amPmUpper === 'PM' && hour !== 12) adjustedHour += 12;
                if (amPmUpper === 'AM' && hour === 12) adjustedHour = 0;
                time = `${hour}:${minuteStr.padStart(2, '0')}`;
                dayNum = daysOfWeek.indexOf(selectedDay.toLowerCase());
            }

            return { hour, minute, amPmUpper, adjustedHour, dayNum, time, isOneTime, scheduledTime };
        };

        const scheduleJob = (scheduleId, day, time, amPmUpper, command, dayNum, adjustedHour, minute, isOneTime, scheduledTime, repeat, client, userId) => {
            if (isOneTime || !repeat) {
                const oneTimeDate = isOneTime ? scheduledTime : (() => {
                    const now = new Date();
                    const scheduledDate = new Date(now);
                    scheduledDate.setHours(adjustedHour, minute, 0, 0);
                    const dayIndex = dayNum - now.getDay();
                    scheduledDate.setDate(now.getDate() + (dayIndex >= 0 ? dayIndex : dayIndex + 7));
                    if (scheduledDate < now) {
                        scheduledDate.setDate(scheduledDate.getDate() + 7);
                    }
                    return scheduledDate;
                })();

                console.log(`[DEBUG] Scheduling one-time job ${scheduleId} for ${oneTimeDate.toISOString()}`);
                schedule.scheduleJob(scheduleId, oneTimeDate, async () => {
                    console.log(`[DEBUG] Executing one-time job ${scheduleId} at ${new Date().toISOString()}`);
                    try {
                        const user = await client.users.fetch(userId);
                        const commandName = command.replace('/', '');
                        const commandToExecute = client.commands.get(commandName);

                        if (!commandToExecute) {
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
                            followUp: async (options) => await dmChannel.send(options),
                        };
                        await commandToExecute.execute(mockInteraction);
                        console.log(`[DEBUG] Executed command ${commandName} in DM for schedule ${scheduleId}`);

                        delete schedules[scheduleId];
                        saveSchedules();
                        console.log(`[DEBUG] Removed one-time schedule ${scheduleId} after execution`);
                    } catch (error) {
                        console.log(`[ERROR] Failed to execute job ${scheduleId}: ${error.message}`);
                    }
                });
            } else {
                const cronExpression = `${minute} ${adjustedHour} * * ${dayNum}`;
                console.log(`[DEBUG] Scheduling recurring job ${scheduleId} with cron ${cronExpression}`);
                schedule.scheduleJob(scheduleId, cronExpression, async () => {
                    console.log(`[DEBUG] Executing recurring job ${scheduleId} at ${new Date().toISOString()}`);
                    try {
                        const user = await client.users.fetch(userId);
                        const commandName = command.replace('/', '');
                        const commandToExecute = client.commands.get(commandName);

                        if (!commandToExecute) {
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
                            followUp: async (options) => await dmChannel.send(options),
                        };
                        await commandToExecute.execute(mockInteraction);
                        console.log(`[DEBUG] Executed command ${commandName} in DM for schedule ${scheduleId}`);
                    } catch (error) {
                        console.log(`[ERROR] Failed to execute job ${scheduleId}: ${error.message}`);
                    }
                });
            }

            const job = schedule.scheduledJobs[scheduleId];
            if (!job) {
                console.log(`[ERROR] Failed to schedule job ${scheduleId}`);
                return false;
            }

            console.log(`[DEBUG] Job ${scheduleId} scheduled. Next invocation at ${job.nextInvocation()?.toISOString() || 'unknown'}`);
            return true;
        };

        // /schedule create
        if (subcommand === 'create') {
            const modal = new ModalBuilder()
                .setCustomId('scheduleModal')
                .setTitle('Create a Schedule');

            const idInput = new TextInputBuilder()
                .setCustomId('idInput')
                .setLabel('Custom ID (leave blank for auto-generated)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            const dayInput = new TextInputBuilder()
                .setCustomId('dayInput')
                .setLabel('Day (e.g., Monday, Tuesday, etc.)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const timeInput = new TextInputBuilder()
                .setCustomId('timeInput')
                .setLabel('Time (e.g., 2:00 PM or "now" for 10s ahead)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const commandInput = new TextInputBuilder()
                .setCustomId('commandInput')
                .setLabel('Command to run (e.g., /get, /visualize, /vis)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const repeatInput = new TextInputBuilder()
                .setCustomId('repeatInput')
                .setLabel('Repeat weekly? (yes/no)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(idInput),
                new ActionRowBuilder().addComponents(dayInput),
                new ActionRowBuilder().addComponents(timeInput),
                new ActionRowBuilder().addComponents(commandInput),
                new ActionRowBuilder().addComponents(repeatInput)
            );

            await interaction.showModal(modal);

            const filter = i => i.customId === 'scheduleModal' && i.user.id === interaction.user.id;
            const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 60000 }).catch(error => {
                console.log(`[ERROR] Modal submission failed: ${error.message}`);
                return null;
            });

            if (!modalInteraction) {
                await interaction.followUp({ content: 'Modal submission timed out or failed.', ephemeral: true });
                return;
            }

            let customId = modalInteraction.fields.getTextInputValue('idInput')?.trim();
            const day = modalInteraction.fields.getTextInputValue('dayInput').trim();
            const timeInputValue = modalInteraction.fields.getTextInputValue('timeInput').trim();
            let command = modalInteraction.fields.getTextInputValue('commandInput').trim();
            const repeat = modalInteraction.fields.getTextInputValue('repeatInput').trim().toLowerCase() === 'yes';

            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            if (!daysOfWeek.includes(day.toLowerCase())) {
                await modalInteraction.reply({ content: 'Invalid day. Must be a day of the week (e.g., Monday).', ephemeral: true });
                return;
            }

            const timeResult = parseTimeInput(timeInputValue, day, daysOfWeek);
            if (timeResult.error) {
                await modalInteraction.reply({ content: timeResult.error, ephemeral: true });
                return;
            }

            const { hour, minute, amPmUpper, adjustedHour, dayNum, time, isOneTime, scheduledTime } = timeResult;

            // Allow /vis as an alias for /visualize
            const validCommands = ['/get', '/visualize', '/vis'];
            if (!validCommands.includes(command)) {
                await modalInteraction.reply({ content: 'Invalid command. Must be one of: /get, /visualize, /vis.', ephemeral: true });
                return;
            }

            // Map /vis to /visualize
            if (command === '/vis') {
                command = '/visualize';
            }

            if (!['yes', 'no'].includes(repeat ? 'yes' : 'no')) {
                await modalInteraction.reply({ content: 'Invalid repeat option. Must be "yes" or "no".', ephemeral: true });
                return;
            }

            // Handle custom ID
            let scheduleId;
            if (customId) {
                // Validate custom ID
                if (customId.length > 50) {
                    await modalInteraction.reply({ content: 'Custom ID must be 50 characters or less.', ephemeral: true });
                    return;
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(customId)) {
                    await modalInteraction.reply({ content: 'Custom ID can only contain letters, numbers, underscores, and hyphens.', ephemeral: true });
                    return;
                }
                scheduleId = customId;
                if (schedules[scheduleId]) {
                    await modalInteraction.reply({ content: 'A schedule with this ID already exists. Please choose a different ID.', ephemeral: true });
                    return;
                }
            } else {
                // Auto-generate ID if none provided
                scheduleId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            }

            const cronExpression = (isOneTime || !repeat) ? null : `${minute} ${adjustedHour} * * ${dayNum}`;

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

            schedules[scheduleId] = {
                userID: interaction.user.id, // Store userID instead of userId
                day,
                time,
                amPm: amPmUpper,
                command,
                cronExpression,
                isOneTime,
                scheduledTime: (isOneTime || !repeat) ? (isOneTime ? scheduledTime : schedule.scheduledJobs[scheduleId].nextInvocation()).toISOString() : undefined,
                repeat,
            };
            saveSchedules();

            await modalInteraction.reply({ content: `Schedule created! ID: ${scheduleId}`, ephemeral: true });
        }

        // /schedule view
        if (subcommand === 'view') {
            const userSchedules = Object.entries(schedules).filter(([_, sched]) => sched.userID === interaction.user.id);
            if (userSchedules.length === 0) {
                await interaction.reply({ content: 'You have no schedules.', ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('Your Schedules')
                .setColor('#0099ff');

            userSchedules.forEach(([id, sched], index) => {
                embed.addFields({
                    name: `Schedule ${index + 1} (ID: ${id})`,
                    value: `Day: ${sched.day}, Time: ${sched.time} ${sched.amPm}, Command: ${sched.command}, Repeat: ${sched.repeat ? 'Yes' : 'No'}${sched.isOneTime || !sched.repeat ? ` (One-time, fires at ${new Date(sched.scheduledTime).toISOString()})` : ''}`,
                });
            });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // /schedule edit
        if (subcommand === 'edit') {
            const userSchedules = Object.entries(schedules).filter(([_, sched]) => sched.userID === interaction.user.id);
            if (userSchedules.length === 0) {
                await interaction.reply({ content: 'You have no schedules to edit.', ephemeral: true });
                return;
            }

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

            const row = new ActionRowBuilder().addComponents(scheduleSelect);

            const embed = new EmbedBuilder()
                .setTitle('Select a Schedule to Edit')
                .setDescription('Choose a schedule from the dropdown below.')
                .setColor('#0099ff');

            const response = await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true,
            });

            const filter = i => i.customId === 'scheduleSelect' && i.user.id === interaction.user.id;
            const selectInteraction = await response.awaitMessageComponent({ filter, time: 60000 }).catch(error => {
                console.log(`[ERROR] Schedule selection failed: ${error.message}`);
                return null;
            });

            if (!selectInteraction) {
                await interaction.editReply({ content: 'Schedule selection timed out.', embeds: [], components: [], ephemeral: true });
                return;
            }

            const scheduleId = selectInteraction.values[0];
            const selectedSchedule = schedules[scheduleId];

            const editModal = new ModalBuilder()
                .setCustomId('editScheduleModal')
                .setTitle('Edit Schedule');

            const idInput = new TextInputBuilder()
                .setCustomId('idInput')
                .setLabel('New Custom ID (leave blank to keep current)')
                .setStyle(TextInputStyle.Short)
                .setValue(scheduleId) // Show the full ID since there's no prefix
                .setRequired(false);

            const dayInput = new TextInputBuilder()
                .setCustomId('dayInput')
                .setLabel('Day (e.g., Monday, Tuesday, etc.)')
                .setStyle(TextInputStyle.Short)
                .setValue(selectedSchedule.day)
                .setRequired(true);

            const timeInput = new TextInputBuilder()
                .setCustomId('timeInput')
                .setLabel('Time (e.g., 2:00 PM or "now" for 10s ahead)')
                .setStyle(TextInputStyle.Short)
                .setValue(`${selectedSchedule.time} ${selectedSchedule.amPm}`)
                .setRequired(true);

            const commandInput = new TextInputBuilder()
                .setCustomId('commandInput')
                .setLabel('Command to run (e.g., /get, /visualize, /vis)')
                .setStyle(TextInputStyle.Short)
                .setValue(selectedSchedule.command)
                .setRequired(true);

            const repeatInput = new TextInputBuilder()
                .setCustomId('repeatInput')
                .setLabel('Repeat weekly? (yes/no)')
                .setStyle(TextInputStyle.Short)
                .setValue(selectedSchedule.repeat ? 'yes' : 'no')
                .setRequired(true);

            editModal.addComponents(
                new ActionRowBuilder().addComponents(idInput),
                new ActionRowBuilder().addComponents(dayInput),
                new ActionRowBuilder().addComponents(timeInput),
                new ActionRowBuilder().addComponents(commandInput),
                new ActionRowBuilder().addComponents(repeatInput)
            );

            await selectInteraction.showModal(editModal);

            const modalFilter = i => i.customId === 'editScheduleModal' && i.user.id === interaction.user.id;
            const modalInteraction = await selectInteraction.awaitModalSubmit({ filter: modalFilter, time: 60000 }).catch(error => {
                console.log(`[ERROR] Edit modal submission failed: ${error.message}`);
                return null;
            });

            if (!modalInteraction) {
                await interaction.editReply({ content: 'Modal submission timed out or failed.', embeds: [], components: [], ephemeral: true });
                return;
            }

            let newCustomId = modalInteraction.fields.getTextInputValue('idInput')?.trim();
            const day = modalInteraction.fields.getTextInputValue('dayInput').trim();
            const timeInputValue = modalInteraction.fields.getTextInputValue('timeInput').trim();
            let command = modalInteraction.fields.getTextInputValue('commandInput').trim();
            const repeat = modalInteraction.fields.getTextInputValue('repeatInput').trim().toLowerCase() === 'yes';

            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            if (!daysOfWeek.includes(day.toLowerCase())) {
                await modalInteraction.reply({ content: 'Invalid day. Must be a day of the week (e.g., Monday).', ephemeral: true });
                return;
            }

            const timeResult = parseTimeInput(timeInputValue, day, daysOfWeek);
            if (timeResult.error) {
                await modalInteraction.reply({ content: timeResult.error, ephemeral: true });
                return;
            }

            const { hour, minute, amPmUpper, adjustedHour, dayNum, time, isOneTime, scheduledTime } = timeResult;

            // Allow /vis as an alias for /visualize
            const validCommands = ['/get', '/visualize', '/vis'];
            if (!validCommands.includes(command)) {
                await modalInteraction.reply({ content: 'Invalid command. Must be one of: /get, /visualize, /vis.', ephemeral: true });
                return;
            }

            // Map /vis to /visualize
            if (command === '/vis') {
                command = '/visualize';
            }

            if (!['yes', 'no'].includes(repeat ? 'yes' : 'no')) {
                await modalInteraction.reply({ content: 'Invalid repeat option. Must be "yes" or "no".', ephemeral: true });
                return;
            }

            // Handle custom ID for edit
            let newScheduleId = scheduleId;
            if (newCustomId) {
                // Validate new custom ID
                if (newCustomId.length > 50) {
                    await modalInteraction.reply({ content: 'Custom ID must be 50 characters or less.', ephemeral: true });
                    return;
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(newCustomId)) {
                    await modalInteraction.reply({ content: 'Custom ID can only contain letters, numbers, underscores, and hyphens.', ephemeral: true });
                    return;
                }
                newScheduleId = newCustomId;
                if (newScheduleId !== scheduleId && schedules[newScheduleId]) {
                    await modalInteraction.reply({ content: 'A schedule with this ID already exists. Please choose a different ID.', ephemeral: true });
                    return;
                }
            }

            const jobs = schedule.scheduledJobs;
            if (jobs[scheduleId]) {
                jobs[scheduleId].cancel();
                console.log(`[DEBUG] Canceled job ${scheduleId} for editing`);
            } else {
                console.log(`[WARNING] Job ${scheduleId} not found in scheduled jobs during edit`);
            }

            const cronExpression = (isOneTime || !repeat) ? null : `${minute} ${adjustedHour} * * ${dayNum}`;
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

            schedules[newScheduleId] = {
                userID: interaction.user.id, // Store userID instead of userId
                day,
                time,
                amPm: amPmUpper,
                command,
                cronExpression,
                isOneTime,
                scheduledTime: (isOneTime || !repeat) ? (isOneTime ? scheduledTime : schedule.scheduledJobs[newScheduleId].nextInvocation()).toISOString() : undefined,
                repeat,
            };
            saveSchedules();

            await modalInteraction.reply({ content: `Schedule ${newScheduleId} updated!`, ephemeral: true });
        }

        // /schedule delete
        if (subcommand === 'delete') {
            const scheduleId = interaction.options.getString('id');
            const userSchedules = Object.entries(schedules).filter(([_, sched]) => sched.userID === interaction.user.id);

            if (userSchedules.length === 0) {
                await interaction.reply({ content: 'You have no schedules to delete.', ephemeral: true });
                return;
            }

            if (!schedules[scheduleId] || schedules[scheduleId].userID !== interaction.user.id) {
                await interaction.reply({ content: 'Invalid schedule ID or you do not own this schedule.', ephemeral: true });
                return;
            }

            const jobs = schedule.scheduledJobs;
            if (jobs[scheduleId]) {
                jobs[scheduleId].cancel();
                console.log(`[DEBUG] Canceled job ${scheduleId}`);
            } else {
                console.log(`[WARNING] Job ${scheduleId} not found in scheduled jobs`);
            }

            delete schedules[scheduleId];
            saveSchedules();

            await interaction.reply({ content: `Schedule ${scheduleId} deleted.`, ephemeral: true });
        }
    },
};