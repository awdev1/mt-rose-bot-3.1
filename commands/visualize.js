const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { Readable } = require('stream');

// Function to get camera images
async function get_images() {
    const cameras = [
        'https://player.brownrice.com/snapshot/mtrosecam',
        'https://player.brownrice.com/snapshot/mtrose1',
        'https://player.brownrice.com/snapshot/mtrosesummit',
        'https://player.brownrice.com/snapshot/mtrosewcl'
    ];

    const imageUrls = [];

    // Fetch image URLs asynchronously
    await Promise.all(cameras.map(async (camera) => {
        try {
            const response = await axios.get(camera);
            if (response.headers['content-type'].includes('image')) {
                imageUrls.push(camera);
            } else {
                console.log(`No image found for camera: ${camera}`);
            }
        } catch (error) {
            console.error(`Error fetching ${camera}: ${error.message}`);
        }
    }));

    return imageUrls;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('visualize')
        .setDescription('Get camera images from 4 locations on the Mt. Rose Ski Resort.'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        const imageUrls = await get_images(); // Get the image URLs

        if (imageUrls && imageUrls.length > 0) {
            const files = [];

            for (const imageUrl of imageUrls) {
                try {
                    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                    const filename = imageUrl.split('/').pop().toLowerCase().endsWith('.jpg') ? imageUrl.split('/').pop() : imageUrl.split('/').pop() + '.jpg';

                    // Create a stream from the response data
                    const bufferStream = new Readable();
                    bufferStream.push(Buffer.from(response.data));
                    bufferStream.push(null); // Signal the end of the stream

                    // Create a file attachment
                    const attachment = {
                        attachment: bufferStream,
                        name: filename
                    };
                    files.push(attachment);
                } catch (error) {
                    console.error(`Error downloading ${imageUrl}: ${error.message}`);
                }
            }

            // Send the images
            await interaction.followUp({ files });
        } else {
            await interaction.followUp("No images could be retrieved.");
        }
    }
};
