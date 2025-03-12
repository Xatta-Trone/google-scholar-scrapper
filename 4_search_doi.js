/** @format */

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const folderPath = "./"; // Set folder path where JSON files are stored
const baseUrl = "https://search.crossref.org/search/works?q=";
const filePrefix = "scholar-data"; // Process only files starting with this prefix

/**
 * Extracts DOI from CrossRef search page by matching title.
 * @param {object} page - Puppeteer page instance.
 * @param {string} expectedTitle - The title to match.
 * @returns {string} - DOI if matched, else an empty string.
 */
async function extractDOI(page, expectedTitle) {
  try {
    await page.waitForSelector("tr .item-data", { timeout: 10000 });

    const result = await page.evaluate((expectedTitle) => {
      const items = document.querySelectorAll("tr .item-data");

      for (let item of items) {
        const titleElement = item.querySelector("p.lead");
        const doiLinkElement = item.querySelector(".item-links a");

        if (!titleElement || !doiLinkElement) continue;

        const title = titleElement.innerText.trim();
        const doiUrl = doiLinkElement.href.trim();

        // Extract DOI from the URL
        const doiMatch = doiUrl.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/);
        const doi = doiMatch ? doiMatch[0] : null;

        if (title.toLowerCase() === expectedTitle.toLowerCase() && doi) {
          return doi;
        }
      }

      return ""; // Return empty string if no match found
    }, expectedTitle);

    return result;
  } catch (error) {
    console.error("❌ Error extracting DOI:", error);
    return ""; // Return empty string on error
  }
}

/**
 * Processes missing DOIs by searching CrossRef.
 * @param {array} data - The JSON data array.
 */
async function processMissingDOIs(data) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  for (const entry of data) {
    if (!entry.doi) {
      // Skip if DOI already exists
      const searchUrl = `${baseUrl}${encodeURIComponent(
        entry.title
      )}&from_ui=yes`;
      console.log(`🔍 Searching for DOI: ${entry.title}`);

      await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });

      const doi = await extractDOI(page, entry.title);
      entry.doi = doi || ""; // Assign found DOI or empty string

      console.log(doi ? `✅ Found DOI: ${doi}` : `❌ No DOI found`);
    }
  }

  await browser.close();
}

/**
 * Reads a JSON file, updates missing DOIs, and writes back.
 * @param {string} filePath - Path to the JSON file.
 */
async function updateDOIsInJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    let jsonData = JSON.parse(content);

    await processMissingDOIs(jsonData.data);

    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 4), "utf8");
    console.log(`✅ Updated file: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error processing JSON file (${filePath}):`, error);
  }
}

/**
 * Scans the folder and processes only JSON files with 'scholar-data' prefix.
 */
async function processAllScholarDataFiles() {
  try {
    const files = fs.readdirSync(folderPath);

    // Filter only files that start with "scholar-data" and end in .json
    const jsonFiles = files.filter(
      (file) => file.startsWith("scholar-data") && file.endsWith(".json")
    );

    console.log(`📂 Found ${jsonFiles.length} JSON files to process.`);

    for (const file of jsonFiles) {
      console.log(`🚀 Processing file: ${file}`);
      await updateDOIsInJSON(path.join(folderPath, file));
    }

    console.log("✅ All files processed successfully!");
  } catch (error) {
    console.error("❌ Error scanning folder:", error);
  }
}

// Run the script
processAllScholarDataFiles();

