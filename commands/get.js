const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const puppeteer = require('puppeteer');
const { JSDOM } = require('jsdom');

const cache = {
    data: null,
    timestamp: 0,
    ttl: 1000 * 60, 
};


async function get_html(url) {
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        const html = await page.content();
        await browser.close();
        return html;
    } catch (error) {
        console.error(`[ERROR] Failed to fetch URL ${url} with Puppeteer: ${error.message}`);
        throw new Error('Failed to fetch the webpage. Please try again later.');
    }
}

async function get_data(url) {
    const now = Date.now();
    if (cache.data && (now - cache.timestamp) < cache.ttl) {
        console.log('[CACHE] Using cached data');
        return cache.data;
    }

    const html = await get_html(url);
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const data = {};

    const dataScript = document.querySelector('script#snow-report-data[type="application/json"]');
    if (dataScript) {
        const jsonData = JSON.parse(dataScript.textContent);
        if (jsonData.terrainParks) {
            data['parks'] = format_parks_from_json(jsonData.terrainParks);
        }
    }

    if (!data['parks']) {
        const parksDiv = document.querySelector('.row.terrain-pad.b-border.rose-accordion');
        data['parks'] = format_parks(parksDiv);
    }

    const lastUpdateDiv = document.querySelector('#last-updated-block_73a6eb962d48822c82ee7fa45fad2b82');
    data['lastUpdated'] = format_last_updated(lastUpdateDiv);

    const conditionsDiv = document.querySelector('.fx-container-inner');
    data['conditions'] = format_conditions(conditionsDiv);

    const liftsDiv = document.querySelector('#lift-status');
    data['lifts'] = format_lifts(liftsDiv);

    const chutesDiv = document.querySelector('#chutes-status');
    data['chutes'] = format_chutes(chutesDiv);

    const parkingDiv = document.querySelector('#snow-report-parking') || Array.from(document.querySelectorAll('div')).find(div => div.textContent.includes('Parking'));
    data['parking'] = format_parking_lot(parkingDiv);

    const notesDiv = document.querySelector('#snow-report-notes') || Array.from(document.querySelectorAll('div')).find(div => div.textContent.includes('Daily Notes') || div.textContent.includes('Conditions Notes'));
    data['notes'] = format_mountain_notes(notesDiv);

    cache.data = data;
    cache.timestamp = now;
    console.log('[CACHE] Data cached');

    return data;
}

function cleanWhitespace(text) {
    if (!text) return text;
    return text.replace(/\s+/g, ' ').trim();
}

function format_last_updated(lastUpdateDiv) {
    if (!lastUpdateDiv) return 'No update information available.';
    
    const strongElement = lastUpdateDiv.querySelector('.time-updated strong');
    const date = strongElement?.textContent.trim() ?? 'Unknown date';
    const time = strongElement?.nextSibling?.textContent.trim() ?? 'Unknown time';
    let result = cleanWhitespace(`${date} ${time}`);
    // Remove "Last Update:" (with or without "at") from the start
    result = result.replace(/^Last Update:(\s*at)?\s*/i, '').trim();
    console.log('[DEBUG] Last Updated:', result);
    return result || 'No update information available.';
}
// Function to format weather conditions
function format_conditions(conditionsDiv) {
    if (!conditionsDiv) return { weather: 'Unknown', temperature: 'Unknown', windSpeed: 'Unknown' };
    
    const cards = conditionsDiv.querySelectorAll('.fx-card');
    if (cards.length < 3) return { weather: 'Unknown', temperature: 'Unknown', windSpeed: 'Unknown' };

    let weather = cleanWhitespace(cards[0].querySelector('.fx-card-footer')?.textContent ?? 'Unknown');
    let temperature = cleanWhitespace(cards[1].querySelector('.temperatures')?.textContent ?? 'Unknown');
    let windSpeed = cleanWhitespace(cards[2].querySelector('.fx-wind')?.textContent ?? 'Unknown');

    weather = weather.charAt(0).toUpperCase() + weather.slice(1);
    if (temperature !== 'Unknown') {
        if (!temperature.includes('°')) {
            temperature += '°F';
        } else if (!temperature.includes('F')) {
            temperature += 'F';
        }
    }
    if (windSpeed !== 'Unknown' && !windSpeed.includes('mph')) windSpeed += ' mph';

    return { weather, temperature, windSpeed };
}

function format_lifts(liftsDiv) {
    if (!liftsDiv) return 'No lift information available.';
    
    const lifts = [];
    const excludedLifts = ['Magic East', 'Magic West'];
    const liftRows = liftsDiv.querySelectorAll('.column-group');

    liftRows.forEach(element => {
        const liftName = cleanWhitespace(element.querySelector('.rose-name')?.textContent);
        const liftStatus = cleanWhitespace(element.querySelector('.column-status span')?.textContent ?? 'Status Unknown');
        if (liftName && !excludedLifts.includes(liftName)) {
            lifts.push(`**${liftName}**: ${liftStatus}`);
        }
    });

    return lifts.length ? lifts.join('\n') : 'No lift information available.';
}

function format_parks_from_json(parksData) {
    if (!parksData || !Array.isArray(parksData)) return 'No terrain parks information available.';

    const parks = parksData.map(park => {
        const parkName = cleanWhitespace(park.name);
        const parkStatus = cleanWhitespace(park.status);
        if (parkName && parkStatus) {
            return `**${parkName}**: ${parkStatus}`;
        }
        return null;
    }).filter(Boolean);

    return parks.length ? parks.join('\n') : 'No terrain parks information available.';
}

function format_parks(parksDiv) {
    if (!parksDiv) return 'No terrain parks information available.';

    const parks = [];
    const parkRows = parksDiv.parentElement.querySelectorAll('.row.terrain-pad.b-border.rose-accordion');

    parkRows.forEach(parkRow => {
        const parkName = cleanWhitespace(parkRow.querySelector('.rose-name')?.textContent);
        const parkStatus = cleanWhitespace(parkRow.querySelector('.column span')?.textContent);
        if (parkName && parkStatus) parks.push(`**${parkName}**: ${parkStatus}`);
    });

    return parks.length ? parks.join('\n') : 'No terrain parks information available.';
}

function format_chutes(chutesDiv) {
    if (!chutesDiv) return 'No chutes information available.';

    const chutesNotes = chutesDiv.querySelector('.chutes-notes');
    if (!chutesNotes) return 'No chutes information available.';

    let notes = cleanWhitespace(chutesNotes.textContent);
    // Remove "Chutes Notes –" prefix
    notes = notes.replace(/^Chutes Notes\s*–\s*/i, '').trim();

    return notes || 'No chutes information available.';
}

function format_parking_lot(parkingDiv) {
    if (!parkingDiv) {
        // console.log('[DEBUG] parkingDiv is null or undefined');
        return 'No parking lot information available.';
    }

    // console.log('[DEBUG] parkingDiv HTML:', parkingDiv.outerHTML);

    const parkingLots = [];
    const parkingRows = parkingDiv.querySelectorAll('.row.terrain-pad.b-border.rose-accordion.empty');
    // console.log('[DEBUG] Number of parking rows:', parkingRows.length);

    parkingRows.forEach((row, index) => {
        // console.log(`[DEBUG] Parking row ${index} HTML:`, row.outerHTML);

        const lotNameElement = row.querySelector('.column-parking-name .rose-name');
        const lotName = cleanWhitespace(lotNameElement?.textContent);
        
        const lotStatusElement = row.querySelector('.column-parking-status span');
        const lotStatus = cleanWhitespace(lotStatusElement?.textContent);

        // console.log(`[DEBUG] Lot ${index} Name:`, lotName, 'Status:', lotStatus);

        if (lotName && lotStatus) {
            parkingLots.push(`**${lotName}**: ${lotStatus}`);
        }
    });

    const parkingNoteElement = parkingDiv.querySelector('.parking-note .parking-text');
    const parkingNote = cleanWhitespace(parkingNoteElement?.textContent);
    // console.log('[DEBUG] Parking Note:', parkingNote);

    let result = parkingLots.length ? parkingLots.join('\n') : 'No parking lot information available.';
    if (parkingNote) {
        result += `\n_${parkingNote}_`;
    }

    return result;
}

// Function to format mountain notes (removing offers)
function format_mountain_notes(notesDiv) {
    if (!notesDiv) {
        // console.log('[DEBUG] notesDiv is null or undefined');
        return 'No mountain notes available.';
    }

    let notes = cleanWhitespace(notesDiv.textContent);
    // console.log('[DEBUG] Raw Mountain Notes:', notes);

    notes = notes.replace(
        /(Special offer|Offer|Discount|Buy now|Save \d+%|Free \w+ with purchase|Season pass|Limited time|Book now|Deal|Sale|Promo|Save big|Exclusive offer|Get \w+ today|Sign up|Join now|Don’t miss|Act now|Only \$\d+|Spring Break Special|Child’s lift \+pizza ticket)[^.!?]*[.!?]/gi,
        ''
    ).trim();

    notes = notes.replace(/\b(offer|discount|buy|save|free|deal|sale|promo|book|pass|limited|exclusive|join|sign up|miss|act|special)\b/gi, '').trim();
    // console.log('[DEBUG] Mountain Notes after removing offers:', notes);

    return notes || 'No mountain notes available.';
}

// Command definition
module.exports = {
    data: new SlashCommandBuilder()
        .setName('get')
        .setDescription('Fetch the latest Mt. Rose mountain report in this channel'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            await interaction.editReply({ content: 'Give me a second while I fetch the latest report...' });

            const url = 'https://skirose.com/snow-report/';
            const reportData = await get_data(url);

            const embed = new EmbedBuilder()
                .setTitle(`🏔️ Mt. Rose Snow Report - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`)
                .setDescription('Your daily update for skiing and snowboarding conditions at Mt. Rose! ❄️')
                .setColor('#87CEEB')
                .setFooter({ text: 'Powered by Mt. Rose Bot. Data from official sources. Refresh for the latest updates.' })
                .setTimestamp()
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

            const reportButton = new ButtonBuilder()
                .setLabel('View Full Report')
                .setURL('https://skirose.com/snow-report/')
                .setStyle(ButtonStyle.Link);

            const row = new ActionRowBuilder().addComponents(reportButton);

            await interaction.editReply({ content: null, embeds: [embed], components: [row] });
        } catch (error) {
            console.error('[ERROR] Error executing /get command:', error.message);
            let errorMessage = 'There was an error fetching the mountain report. Let <@717412351451594852> know if this issue persists.';
            if (error.message.includes('fetch')) {
                errorMessage = 'Failed to connect to the Mt. Rose website. Please try again later. Most likely the website is down.';
            } else if (error.message.includes('parse')) {
                errorMessage = 'Failed to parse the mountain report data. The website structure may have changed. Let <@717412351451594852> know if this issue persists.';
            }
            await interaction.editReply({ content: errorMessage });
        }
    }
};