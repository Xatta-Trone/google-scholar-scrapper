/** @format */

import fs from "fs";
import path from "path";

const folderPath = "./"; // Adjust folder path if necessary

/**
 * Extracts DOI from a given URL if present.
 * @param {string} url - The source URL to extract DOI from.
 * @returns {string|null} - The extracted DOI or null if not found.
 */
function extractDOI(url) {
  const doiPattern = /10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/;
  const match = url.match(doiPattern);
  return match ? match[0] : null;
}

/**
 * Adds DOI key to dataset entries if not already present.
 * @param {Array} data - The JSON data array.
 * @returns {Array} - Updated JSON data with DOI added where applicable.
 */
function addDOIKey(data) {
  return data.map((entry) => {
    if (!entry.doi && entry.source_url) {
      const doi = extractDOI(entry.source_url);
      if (doi) {
        entry.doi = doi;
      }
    }
    return entry;
  });
}

/**
 * Reads a JSON file, updates missing DOIs, and writes back.
 * @param {string} filePath - Path to the JSON file.
 */
function processJSONFile(filePath) {
  fs.readFile(filePath, "utf8", (err, content) => {
    if (err) {
      console.error(`❌ Error reading file: ${filePath}`, err);
      return;
    }

    try {
      let jsonData = JSON.parse(content);
      jsonData.data = addDOIKey(jsonData.data);

      fs.writeFile(
        filePath,
        JSON.stringify(jsonData, null, 4),
        "utf8",
        (err) => {
          if (err) {
            console.error(`❌ Error writing file: ${filePath}`, err);
          } else {
            console.log(`✅ File updated successfully: ${filePath}`);
          }
        }
      );
    } catch (parseError) {
      console.error(`❌ Error parsing JSON in file: ${filePath}`, parseError);
    }
  });
}

/**
 * Scans the folder and processes all JSON files.
 */
function processAllJSONFiles() {
  try {
    const files = fs.readdirSync(folderPath);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    console.log(`📂 Found ${jsonFiles.length} JSON files to process.`);

    jsonFiles.forEach((file) => {
      console.log(`🚀 Processing file: ${file}`);
      processJSONFile(path.join(folderPath, file));
    });

    console.log("✅ All files processed successfully!");
  } catch (error) {
    console.error("❌ Error scanning folder:", error);
  }
}

// Run the script
processAllJSONFiles();
