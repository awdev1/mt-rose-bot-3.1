// This is awdev speaking. PAY CLOSE ATTENTION.
// I've intentionally made the code overly verbose and added wayyyyyyyy to many comments to explain the logic.
// This is to help you understand the structure and flow of the bot code Neel.
// Import required Discord.js module for building slash commands
const { SlashCommandBuilder } = require('discord.js');
// Import axios for making HTTP requests to fetch images
const axios = require('axios');
// Import Readable from the stream module to create streams from image data
const { Readable } = require('stream');

// Function to fetch image URLs from Mt. Rose Ski Resort cameras
async function get_images() {
    // Define the list of camera URLs to fetch images from
    const cameras = [
        'https://player.brownrice.com/snapshot/mtrosecam',
        'https://player.brownrice.com/snapshot/mtrose1',
        'https://player.brownrice.com/snapshot/mtrosesummit',
        'https://player.brownrice.com/snapshot/mtrosewcl'
    ];

    const imageUrls = []; // Array to store valid image URLs

    // Fetch image URLs asynchronously using Promise.all for parallel requests
    await Promise.all(cameras.map(async (camera) => {
        try {
            // Make a GET request to the camera URL
            const response = await axios.get(camera);
            // Check if the response content type indicates an image
            if (response.headers['content-type'].includes('image')) {
                imageUrls.push(camera); // Add the URL to the list if it's an image
            } else {
                console.log(`No image found for camera: ${camera}`);
            }
        } catch (error) {
            // Log any errors that occur during the fetch
            console.error(`Error fetching ${camera}: ${error.message}`);
        }
    }));

    return imageUrls; // Return the list of valid image URLs
}

// Define the /visualize slash command
module.exports = {
    // Define the command's metadata using SlashCommandBuilder
    data: new SlashCommandBuilder()
        .setName('visualize')
        .setDescription('Get camera images from 4 locations on the Mt. Rose Ski Resort.'),

    // Execute function for the /visualize command
    async execute(interaction) {
        // Defer the reply to give the bot time to fetch and process the images
        await interaction.deferReply({ ephemeral: false });

        // Fetch the image URLs from the cameras
        const imageUrls = await get_images();

        // Check if any image URLs were retrieved
        if (imageUrls && imageUrls.length > 0) {
            const files = []; // Array to store file attachments

            // Iterate over each image URL to download and prepare it for sending
            for (const imageUrl of imageUrls) {
                try {
                    // Make a GET request to download the image as an array buffer
                    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                    // Determine the filename for the image
                    const filename = imageUrl.split('/').pop().toLowerCase().endsWith('.jpg') 
                        ? imageUrl.split('/').pop() 
                        : imageUrl.split('/').pop() + '.jpg';

                    // Create a Readable stream from the image data
                    const bufferStream = new Readable();
                    bufferStream.push(Buffer.from(response.data)); // Add the image data to the stream
                    bufferStream.push(null); // Signal the end of the stream

                    // Create a file attachment object for Discord
                    const attachment = {
                        attachment: bufferStream, // The stream containing the image data
                        name: filename // The filename for the attachment
                    };
                    files.push(attachment); // Add the attachment to the list
                } catch (error) {
                    // Log any errors that occur during the download
                    console.error(`Error downloading ${imageUrl}: ${error.message}`);
                }
            }

            // Send the images as attachments in a follow-up message
            await interaction.followUp({ files });
        } else {
            // Notify the user if no images could be retrieved
            await interaction.followUp("No images could be retrieved.");
        }
    }
};