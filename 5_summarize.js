/** @format */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Normalize function
function normalizeJournal(raw) {
  const journal = raw.toLowerCase();
  if (journal.includes("ssrn")) return "ssrn";
  if (journal.includes("arxiv")) return "arxiv";
  if (journal.includes("transportation research board"))
    return "transportation research board";
  return journal;
}

async function processJournalData(inputFilename) {
  const inputFilePath = path.join(__dirname, inputFilename);
  const outputFilename = inputFilename.replace("scholar-data-", "summary-");
  const outputFilePath = path.join(__dirname, outputFilename);
  try {
    const data = await fs.readFile(inputFilePath, "utf8");
    const jsonData = JSON.parse(data);
    const items = jsonData.data;

    const journalYearCounts = {};

    items.forEach((item) => {
      const journalRaw = item.journal || item.source;

      if (!journalRaw) {
        console.warn("Missing journal field in item:", item.title);
        return;
      }

      // Check if it's a URL
      const isURL = /^https?:\/\//i.test(journalRaw);

      if (isURL) {
        console.warn("Journal field is a URL, skipping:", item.title);
        return;
      }

      const journal = normalizeJournal(journalRaw);
      console.log(journal);
      const year = item.year;

      if (journal && year) {
        if (!journalYearCounts[journal]) {
          journalYearCounts[journal] = {};
        }
        if (!journalYearCounts[journal][year]) {
          journalYearCounts[journal][year] = 0;
        }
        journalYearCounts[journal][year]++;
      }
    });

    // Prepare final output structure
    const outputJson = {
      data: journalYearCounts,
    };

    // Write to output file
    await fs.writeFile(
      outputFilePath,
      JSON.stringify(outputJson, null, 2),
      "utf8"
    );

    console.log(`Output written to: ${outputFilename}`);
  } catch (err) {
    console.error("Error:", err);
  }
}

// Find all scholar-data-*.json files and process each
async function processAllFiles() {
  try {
    const files = await fs.readdir(__dirname);
    const scholarFiles = files.filter(
      (file) => file.startsWith("scholar-data-") && file.endsWith(".json")
    );

    if (scholarFiles.length === 0) {
      console.log("No scholar-data-*.json files found.");
      return;
    }

    for (const file of scholarFiles) {
      await processJournalData(file);
    }

    console.log("All files processed.");
  } catch (err) {
    console.error("Error reading directory:", err);
  }
}

processAllFiles();
