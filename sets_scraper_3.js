const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Add stealth plugin to Puppeteer
puppeteer.use(StealthPlugin());

/**
 * Fetch HTML from paginated links by clicking the "Next page" button
 * and save consolidated HTML for each set.
 * Failed links are logged to a separate JSON file for later handling continuously.
 * @param {Array<Object>} sets - Array of objects containing set names and links.
 * @param {string} outputFolder - Path to the folder where consolidated HTML files will be saved.
 * @param {string} errorLinksFilePath - Path to the JSON file for storing failed links.
 */
async function fetchAndSaveConsolidatedHTML(sets, outputFolder, errorLinksFilePath) {
    // Ensure the output folder exists
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    // Initialize error file if it doesn't exist
    if (!fs.existsSync(errorLinksFilePath)) {
        fs.writeFileSync(errorLinksFilePath, JSON.stringify([], null, 2), 'utf-8');
    }

    const browser = await puppeteer.launch({ headless: false }); // Set headless: true to run without a browser UI
    const page = await browser.newPage();

    for (const set of sets) {
        try {
            const { name, link } = set;
            console.log(`Fetching: ${name} (${link})`);

            let consolidatedHTML = '';
            let pageIndex = 1;

            // Navigate to the first page
            await page.goto(link, { waitUntil: 'networkidle2' });

            while (true) {
                console.log(`Processing page ${pageIndex} for ${name}`);

                // Wait for the table body to ensure content has loaded
                await page.waitForSelector('div.table-body', { timeout: 10000 });

                // Extract and append the current page HTML
                const pageContent = await page.evaluate(() => document.documentElement.outerHTML);
                consolidatedHTML += pageContent;

                // Check if the "Next page" button is disabled
                const nextButtonDisabled = await page.evaluate(() => {
                    const nextButton = document.querySelector(
                        'a.pagination-control[aria-label="Next page"]'
                    );
                    return nextButton && nextButton.classList.contains('disabled');
                });

                if (nextButtonDisabled) {
                    console.log(`Reached the last page for ${name}`);
                    break; // Exit the pagination loop
                }

                // Click the "Next page" button and wait for navigation
                const nextButton = await page.$('a.pagination-control[aria-label="Next page"]');
                if (nextButton) {
                    await Promise.all([
                        nextButton.click(),
                        page.waitForNavigation({ waitUntil: 'networkidle2' }),
                    ]);
                    pageIndex++;
                } else {
                    console.error(`"Next page" button not found on page ${pageIndex}`);
                    break; // Exit if the button is unexpectedly missing
                }
            }

            // Save the consolidated HTML to a single file
            const fileName = name.replace(/[^a-zA-Z0-9-_]/g, '') + '.html';
            const filePath = path.join(outputFolder, fileName);
            fs.writeFileSync(filePath, consolidatedHTML, 'utf-8');

            console.log(`Consolidated HTML saved for ${name} at ${filePath}`);
        } catch (error) {
            console.error(`Failed to fetch ${set.name}:`, error.message);

            // Continuously write error links to the JSON file
            const errorLinks = JSON.parse(fs.readFileSync(errorLinksFilePath, 'utf-8'));
            errorLinks.push({ name: set.name, link: set.link, error: error.message });
            fs.writeFileSync(errorLinksFilePath, JSON.stringify(errorLinks, null, 2), 'utf-8');
            console.log(`Error logged for ${set.name}`);
        }
    }

    await browser.close();
    console.log('All sets processed.');
}

// Example usage
(async () => {
    const jsonFilePath = path.join(__dirname, 'corrected_pokemon_sets.json'); // Path to your JSON file
    const outputFolder = path.join(__dirname, 'html_files_3'); // Folder to save consolidated HTML files
    const errorLinksFilePath = path.join(__dirname, 'error_links_sets.json'); // Path to save error links

    // Load the JSON file and parse it
    const sets = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));

    // Fetch and save consolidated HTML for each set
    await fetchAndSaveConsolidatedHTML(sets, outputFolder, errorLinksFilePath);
})();
