const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Add stealth plugin to Puppeteer
puppeteer.use(StealthPlugin());

/**
 * Fetch HTML from paginated links and save consolidated HTML for each set.
 * @param {Array<Object>} sets - Array of objects containing set names and links.
 * @param {string} outputFolder - Path to the folder where consolidated HTML files will be saved.
 */
async function fetchAndSaveConsolidatedHTML(sets, outputFolder) {
    // Ensure the output folder exists
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    const browser = await puppeteer.launch({ headless: false }); // Set headless: true to run without a browser UI
    const page = await browser.newPage();

    for (const set of sets) {
        try {
            const { name, link } = set;
            console.log(`Fetching: ${name} (${link})`);

            let consolidatedHTML = '';
            let pageIndex = 1;
            let hasNextPage = true;

            while (hasNextPage) {
                const pageURL = `${link}?site=${pageIndex}`;
                console.log(`Visiting: ${pageURL}`);

                await page.goto(pageURL, { waitUntil: 'networkidle2' });

                // Check if the "Next page" button is disabled
                const nextButtonDisabled = await page.evaluate(() => {
                    const nextButton = document.querySelector(
                        'a.pagination-control[aria-label="Next page"]'
                    );
                    return nextButton && nextButton.classList.contains('disabled');
                });

                // Extract and append the current page HTML
                const pageContent = await page.evaluate(() => document.documentElement.outerHTML);
                consolidatedHTML += pageContent;

                console.log(`Page ${pageIndex} added.`);

                if (nextButtonDisabled) {
                    console.log(`No more pages after page ${pageIndex}`);
                    hasNextPage = false; // Stop pagination for this set
                } else {
                    pageIndex++; // Move to the next page
                }
            }

            // Save the consolidated HTML to a single file
            const fileName = name.replace(/[^a-zA-Z0-9-_]/g, '') + '.html';
            const filePath = path.join(outputFolder, fileName);
            fs.writeFileSync(filePath, consolidatedHTML, 'utf-8');

            console.log(`Consolidated HTML saved for ${name} at ${filePath}`);
        } catch (error) {
            console.error(`Failed to fetch ${set.name}:`, error.message);
        }
    }

    await browser.close();
    console.log('All sets processed.');
}

// Example usage
(async () => {
    const jsonFilePath = path.join(__dirname, 'pokemon_sets.json'); // Path to your JSON file
    const outputFolder = path.join(__dirname, 'html_files_2'); // Folder to save consolidated HTML files

    // Load the JSON file and parse it
    const sets = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));

    // Fetch and save consolidated HTML for each set
    await fetchAndSaveConsolidatedHTML(sets, outputFolder);
})();
