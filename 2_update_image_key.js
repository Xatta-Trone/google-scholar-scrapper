/** @format */

import fs from "fs";
import path from "path";

// Load the JSON file
const dataPath = "scholar-data-qK-YgxAAAAAJ.json";
const rawData = fs.readFileSync(dataPath);
const scholarData = JSON.parse(rawData);
const items = scholarData.data;

// Directory where images are stored
const imagesDir = path.join("images");

// Function to check and update the JSON file
function updateImageKeys() {
  let isUpdated = false;

  // Iterate over each item in the JSON data
  for (let item of items) {
    if (!item.img) {
      // Construct the expected image filename
      const year = item.year;
      const uniqueId = item.url.includes("citation_for_view")
        ? new URL(item.url).searchParams.get("citation_for_view").split(":")[1]
        : null;

      if (uniqueId) {
        const imageName = `${year}_${uniqueId}.jpg`;
        const imagePath = path.join(imagesDir, imageName);

        // Check if the image exists in the images directory
        if (fs.existsSync(imagePath)) {
          // Add the img key with the filename to the item
          item.img = `images/${imageName}`;
          isUpdated = true;
          console.log(`Updated img key for item: ${item.title}`);
        }
      }
    }
  }

  // If any updates were made, save the updated JSON data back to the file
  if (isUpdated) {
    fs.writeFileSync(dataPath, JSON.stringify(scholarData, null, 4));
    console.log("JSON file updated successfully with img keys.");
  } else {
    console.log("No updates were necessary.");
  }
}

// Run the function
updateImageKeys();
