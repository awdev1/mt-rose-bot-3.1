// This is awdev speaking. PAY CLOSE ATTENTION.
// I've intentionally made the code overly verbose and added wayyyyyyyy to many comments to explain the logic.
// This is to help you understand the structure and flow of the bot code Neel.
// Import required Discord.js modules for building slash commands, embeds, and buttons
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
// Import Puppeteer for web scraping (to fetch and render the webpage)
const puppeteer = require('puppeteer');
// Import JSDOM for parsing HTML and creating a DOM-like environment
const { JSDOM } = require('jsdom');

// Define a cache object to store fetched data and avoid redundant requests
const cache = {
    data: null, // Store the fetched data
    timestamp: 0, // Store the timestamp of the last fetch
    ttl: 1000 * 60, // Time-to-live (TTL) for the cache: 1 minute (60 seconds)
};

// Function to fetch the HTML content of a webpage using Puppeteer
async function get_html(url) {
    try {
        // Launch a headless browser instance with Puppeteer
        const browser = await puppeteer.launch({
            headless: true, // Run in headless mode (no UI)
            args: ['--no-sandbox', '--disable-setuid-sandbox'], // Arguments to reduce security restrictions (useful for certain environments)
        });
        // Open a new page in the browser
        const page = await browser.newPage();
        // Set a user agent to mimic a real browser (avoids bot detection)
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        // Navigate to the URL and wait until the network is idle (no requests for 500ms)
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        // Get the HTML content of the page
        const html = await page.content();
        // Close the browser to free up resources
        await browser.close();
        return html;
    } catch (error) {
        // Log any errors that occur during the fetch and throw a user-friendly error
        console.error(`[ERROR] Failed to fetch URL ${url} with Puppeteer: ${error.message}`);
        throw new Error('Failed to fetch the webpage. Please try again later.');
    }
}

// Function to fetch and parse data from the Mt. Rose snow report webpage
async function get_data(url) {
    const now = Date.now(); // Get the current timestamp
    // Check if cached data exists and is still valid (within TTL)
    if (cache.data && (now - cache.timestamp) < cache.ttl) {
        console.log('[CACHE] Using cached data');
        return cache.data; // Return cached data if available
    }

    // Fetch the HTML content of the webpage
    const html = await get_html(url);
    // Parse the HTML into a DOM-like structure using JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const data = {}; // Object to store the parsed data

    // Try to extract terrain parks data from a JSON script tag
    const dataScript = document.querySelector('script#snow-report-data[type="application/json"]');
    if (dataScript) {
        const jsonData = JSON.parse(dataScript.textContent); // Parse the JSON data
        if (jsonData.terrainParks) {
            // Format the terrain parks data if it exists
            data['parks'] = format_parks_from_json(jsonData.terrainParks);
        }
    }

    // If terrain parks data wasn't found in the JSON, fall back to parsing the HTML
    if (!data['parks']) {
        const parksDiv = document.querySelector('.row.terrain-pad.b-border.rose-accordion');
        data['parks'] = format_parks(parksDiv);
    }

    // Extract the last updated timestamp
    const lastUpdateDiv = document.querySelector('#last-updated-block_73a6eb962d48822c82ee7fa45fad2b82');
    data['lastUpdated'] = format_last_updated(lastUpdateDiv);

    // Extract current weather conditions
    const conditionsDiv = document.querySelector('.fx-container-inner');
    data['conditions'] = format_conditions(conditionsDiv);

    // Extract lift status
    const liftsDiv = document.querySelector('#lift-status');
    data['lifts'] = format_lifts(liftsDiv);

    // Extract chutes status
    const chutesDiv = document.querySelector('#chutes-status');
    data['chutes'] = format_chutes(chutesDiv);

    // Extract parking lot information (try specific ID first, then fall back to searching for "Parking" text)
    const parkingDiv = document.querySelector('#snow-report-parking') || Array.from(document.querySelectorAll('div')).find(div => div.textContent.includes('Parking'));
    data['parking'] = format_parking_lot(parkingDiv);

    // Extract mountain notes (try specific ID first, then fall back to searching for "Daily Notes" or "Conditions Notes")
    const notesDiv = document.querySelector('#snow-report-notes') || Array.from(document.querySelectorAll('div')).find(div => div.textContent.includes('Daily Notes') || div.textContent.includes('Conditions Notes'));
    data['notes'] = format_mountain_notes(notesDiv);

    // Cache the parsed data with the current timestamp
    cache.data = data;
    cache.timestamp = now;
    console.log('[CACHE] Data cached');

    return data;
}

// Utility function to clean up whitespace in text (replace multiple spaces with a single space and trim)
function cleanWhitespace(text) {
    if (!text) return text; // Return early if text is null or undefined
    return text.replace(/\s+/g, ' ').trim();
}

// Function to format the "Last Updated" timestamp from the webpage
function format_last_updated(lastUpdateDiv) {
    if (!lastUpdateDiv) return 'No update information available.'; // Return default message if the div is not found
    
    // Extract the date and time from the div
    const strongElement = lastUpdateDiv.querySelector('.time-updated strong');
    const date = strongElement?.textContent.trim() ?? 'Unknown date';
    const time = strongElement?.nextSibling?.textContent.trim() ?? 'Unknown time';
    let result = cleanWhitespace(`${date} ${time}`);
    // Remove "Last Update:" prefix (with or without "at") from the start
    result = result.replace(/^Last Update:(\s*at)?\s*/i, '').trim();
    console.log('[DEBUG] Last Updated:', result);
    return result || 'No update information available.';
}

// Function to format weather conditions (weather, temperature, wind speed)
function format_conditions(conditionsDiv) {
    // Return default values if the conditions div is not found
    if (!conditionsDiv) return { weather: 'Unknown', temperature: 'Unknown', windSpeed: 'Unknown' };
    
    // Extract weather cards (each card contains a piece of weather data)
    const cards = conditionsDiv.querySelectorAll('.fx-card');
    if (cards.length < 3) return { weather: 'Unknown', temperature: 'Unknown', windSpeed: 'Unknown' }; // Ensure there are enough cards

    // Extract weather, temperature, and wind speed from the cards
    let weather = cleanWhitespace(cards[0].querySelector('.fx-card-footer')?.textContent ?? 'Unknown');
    let temperature = cleanWhitespace(cards[1].querySelector('.temperatures')?.textContent ?? 'Unknown');
    let windSpeed = cleanWhitespace(cards[2].querySelector('.fx-wind')?.textContent ?? 'Unknown');

    // Format the weather string (capitalize the first letter)
    weather = weather.charAt(0).toUpperCase() + weather.slice(1);
    // Add temperature units if missing
    if (temperature !== 'Unknown') {
        if (!temperature.includes('°')) {
            temperature += '°F';
        } else if (!temperature.includes('F')) {
            temperature += 'F';
        }
    }
    // Add wind speed units if missing
    if (windSpeed !== 'Unknown' && !windSpeed.includes('mph')) windSpeed += ' mph';

    return { weather, temperature, windSpeed };
}

// Function to format lift status information
function format_lifts(liftsDiv) {
    if (!liftsDiv) return 'No lift information available.'; // Return default message if the div is not found
    
    const lifts = [];
    const excludedLifts = ['Magic East', 'Magic West']; // Lifts to exclude from the report
    const liftRows = liftsDiv.querySelectorAll('.column-group'); // Get all lift rows

    // Iterate over each lift row to extract name and status
    liftRows.forEach(element => {
        const liftName = cleanWhitespace(element.querySelector('.rose-name')?.textContent);
        const liftStatus = cleanWhitespace(element.querySelector('.column-status span')?.textContent ?? 'Status Unknown');
        // Add the lift to the list if it has a name and isn't excluded
        if (liftName && !excludedLifts.includes(liftName)) {
            lifts.push(`**${liftName}**: ${liftStatus}`);
        }
    });

    // Return the formatted list of lifts or a default message if none are found
    return lifts.length ? lifts.join('\n') : 'No lift information available.';
}

// Function to format terrain parks data from JSON (if available)
function format_parks_from_json(parksData) {
    if (!parksData || !Array.isArray(parksData)) return 'No terrain parks information available.'; // Validate input

    // Map each park to a formatted string
    const parks = parksData.map(park => {
        const parkName = cleanWhitespace(park.name);
        const parkStatus = cleanWhitespace(park.status);
        if (parkName && parkStatus) {
            return `**${parkName}**: ${parkStatus}`;
        }
        return null;
    }).filter(Boolean); // Remove null entries

    // Return the formatted list of parks or a default message if none are found
    return parks.length ? parks.join('\n') : 'No terrain parks information available.';
}

// Function to format terrain parks data from HTML (fallback if JSON is unavailable)
function format_parks(parksDiv) {
    if (!parksDiv) return 'No terrain parks information available.'; // Return default message if the div is not found

    const parks = [];
    // Get all park rows from the parent element
    const parkRows = parksDiv.parentElement.querySelectorAll('.row.terrain-pad.b-border.rose-accordion');

    // Iterate over each park row to extract name and status
    parkRows.forEach(parkRow => {
        const parkName = cleanWhitespace(parkRow.querySelector('.rose-name')?.textContent);
        const parkStatus = cleanWhitespace(parkRow.querySelector('.column span')?.textContent);
        if (parkName && parkStatus) parks.push(`**${parkName}**: ${parkStatus}`);
    });

    // Return the formatted list of parks or a default message if none are found
    return parks.length ? parks.join('\n') : 'No terrain parks information available.';
}

// Function to format chutes status information
function format_chutes(chutesDiv) {
    if (!chutesDiv) return 'No chutes information available.'; // Return default message if the div is not found

    const chutesNotes = chutesDiv.querySelector('.chutes-notes'); // Extract chutes notes
    if (!chutesNotes) return 'No chutes information available.'; // Return default if notes are not found

    let notes = cleanWhitespace(chutesNotes.textContent);
    // Remove "Chutes Notes –" prefix from the text
    notes = notes.replace(/^Chutes Notes\s*–\s*/i, '').trim();

    return notes || 'No chutes information available.';
}

// Function to format parking lot information
function format_parking_lot(parkingDiv) {
    if (!parkingDiv) {
        // console.log('[DEBUG] parkingDiv is null or undefined');
        return 'No parking lot information available.'; // Return default message if the div is not found
    }

    // console.log('[DEBUG] parkingDiv HTML:', parkingDiv.outerHTML);

    const parkingLots = [];
    // Get all parking lot rows
    const parkingRows = parkingDiv.querySelectorAll('.row.terrain-pad.b-border.rose-accordion.empty');
    // console.log('[DEBUG] Number of parking rows:', parkingRows.length);

    // Iterate over each parking lot row to extract name and status
    parkingRows.forEach((row, index) => {
        // console.log(`[DEBUG] Parking row ${index} HTML:`, row.outerHTML);

        const lotNameElement = row.querySelector('.column-parking-name .rose-name');
        const lotName = cleanWhitespace(lotNameElement?.textContent);
        
        const lotStatusElement = row.querySelector('.column-parking-status span');
        const lotStatus = cleanWhitespace(lotStatusElement?.textContent);

        // console.log(`[DEBUG] Lot ${index} Name:`, lotName, 'Status:', lotStatus);

        // Add the parking lot to the list if it has a name and status
        if (lotName && lotStatus) {
            parkingLots.push(`**${lotName}**: ${lotStatus}`);
        }
    });

    // Extract any additional parking notes
    const parkingNoteElement = parkingDiv.querySelector('.parking-note .parking-text');
    const parkingNote = cleanWhitespace(parkingNoteElement?.textContent);
    // console.log('[DEBUG] Parking Note:', parkingNote);

    // Format the result, including parking lots and any notes
    let result = parkingLots.length ? parkingLots.join('\n') : 'No parking lot information available.';
    if (parkingNote) {
        result += `\n_${parkingNote}_`; // Add the note in italics
    }

    return result;
}

// Function to format mountain notes, removing promotional offers
function format_mountain_notes(notesDiv) {
    if (!notesDiv) {
        // console.log('[DEBUG] notesDiv is null or undefined');
        return 'No mountain notes available.'; // Return default message if the div is not found
    }

    let notes = cleanWhitespace(notesDiv.textContent);
    // console.log('[DEBUG] Raw Mountain Notes:', notes);

    // Remove sentences containing promotional keywords (e.g., "Special offer", "Discount")
    notes = notes.replace(
        /(Special offer|Offer|Discount|Buy now|Save \d+%|Free \w+ with purchase|Season pass|Limited time|Book now|Deal|Sale|Promo|Save big|Exclusive offer|Get \w+ today|Sign up|Join now|Don’t miss|Act now|Only \$\d+|Spring Break Special|Child’s lift \+pizza ticket)[^.!?]*[.!?]/gi,
        ''
    ).trim();

    // Remove standalone promotional words
    notes = notes.replace(/\b(offer|discount|buy|save|free|deal|sale|promo|book|pass|limited|exclusive|join|sign up|miss|act|special)\b/gi, '').trim();
    // console.log('[DEBUG] Mountain Notes after removing offers:', notes);

    return notes || 'No mountain notes available.';
}

// Define the /get slash command
module.exports = {
    // Define the command's metadata using SlashCommandBuilder
    data: new SlashCommandBuilder()
        .setName('get')
        .setDescription('Fetch the latest Mt. Rose mountain report in this channel'),

    // Execute function for the /get command
    async execute(interaction) {
        try {
            // Defer the reply to give the bot time to fetch and process the data
            await interaction.deferReply();
            // Send an initial message to inform the user that the report is being fetched
            await interaction.editReply({ content: 'Give me a second while I fetch the latest report...' });

            const url = 'https://skirose.com/snow-report/'; // URL of the Mt. Rose snow report
            const reportData = await get_data(url); // Fetch the report data

            // Create an embed to display the snow report
            const embed = new EmbedBuilder()
                .setTitle(`🏔️ Mt. Rose Snow Report - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`)
                .setDescription('Your daily update for skiing and snowboarding conditions at Mt. Rose! ❄️')
                .setColor('#87CEEB') // Light blue color for the embed
                .setFooter({ text: 'Powered by Mt. Rose Bot. Data from official sources. Refresh for the latest updates.' })
                .setTimestamp() // Add the current timestamp
                .addFields(
                    { name: '📝 **Mountain Notes**', value: reportData.notes, inline: false },
                    { 
                        name: '🌤️ **Current Conditions**', 
                        value: `**Weather:** ${reportData.conditions.weather}\n**Temperature:** ${reportData.conditions.temperature}\n**Wind Speed:** ${reportData.conditions.windSpeed}`, 
                        inline: true 
                    },
                    { 
                        name: '🚡 **Lift Status**', 
                        value: reportData.lifts, 
                        inline: true 
                    },
                    { name: '⛷️ **Chutes**', value: reportData.chutes, inline: false },
                    { name: '🏂 **Terrain Parks**', value: reportData.parks, inline: false },
                    { name: '🅿️ **Parking Lot**', value: reportData.parking, inline: false },
                    { name: '⏰ **Last Updated by Mt. Rose Officials at**', value: reportData.lastUpdated, inline: false }
                );

            // Create a button linking to the full snow report
            const reportButton = new ButtonBuilder()
                .setLabel('View Full Report')
                .setURL('https://skirose.com/snow-report/')
                .setStyle(ButtonStyle.Link);

            // Add the button to an action row
            const row = new ActionRowBuilder().addComponents(reportButton);

            // Update the interaction reply with the embed and button
            await interaction.editReply({ content: null, embeds: [embed], components: [row] });
        } catch (error) {
            // Log any errors that occur during execution
            console.error('[ERROR] Error executing /get command:', error.message);
            // Default error message
            let errorMessage = 'There was an error fetching the mountain report. Let <@717412351451594852> know if this issue persists.';
            // Customize the error message based on the type of error
            if (error.message.includes('fetch')) {
                errorMessage = 'Failed to connect to the Mt. Rose website. Please try again later. Most likely the website is down.';
            } else if (error.message.includes('parse')) {
                errorMessage = 'Failed to parse the mountain report data. The website structure may have changed. Let <@717412351451594852> know if this issue persists.';
            }
            // Update the interaction reply with the error message
            await interaction.editReply({ content: errorMessage });
        }
    },
};