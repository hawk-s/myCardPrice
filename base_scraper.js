const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Add stealth plugin
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: false }); // Use headless: true to run without UI
    const page = await browser.newPage();

    try {
        const url = "https://www.cardmarket.com/en/Pokemon/Products/Singles";

        // Go to the base site
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Wait for the specific filter form to load
        await page.waitForSelector('div.row.g-2.align-items-end.filter-form');

        // Retrieve the full HTML content
        const htmlContent = await page.evaluate(() => document.documentElement.outerHTML);

        // Save the HTML to a file
        const outputPath = path.join(__dirname, 'base_singles.html');
        fs.writeFileSync(outputPath, htmlContent, 'utf-8');

        console.log(`HTML content saved to ${outputPath}`);
    } catch (error) {
        console.error(`Failed to retrieve and save the HTML: ${error.message}`);
    } finally {
        await browser.close();
    }
})();
