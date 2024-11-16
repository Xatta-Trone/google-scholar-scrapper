/** @format */

import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

// Load JSON file
const dataPath = "scholar-data-qK-YgxAAAAAJ.json";
const rawData = fs.readFileSync(dataPath);
const scholarData = JSON.parse(rawData);
const items = scholarData.data;

// Delay function
const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

// Function to generate an image
async function generateImage(details) {
  const year = details.year;
  const uniqueId = details.url.includes("citation_for_view")
    ? new URL(details.url).searchParams.get("citation_for_view").split(":")[1]
    : Date.now();
  const imageName = `${year}_${uniqueId}.jpg`;
  const imagePath = path.join("images", imageName);

  // Skip generation if image already exists
  if (fs.existsSync(imagePath)) {
    console.log(`Image already exists for ${imageName}`);
    return imageName; // Return the existing image name
  }

  const prompt = `Create a highly detailed landscape illustration inspired by the title '${details.title}' and the following abstract: '${details.description}'. Put emphasis on the title more. The image should be in a 1280x800 dimension, capturing a wide landscape format. Visually interpret the main themes and findings of the research, integrating elements or symbols that represent key concepts outlined in the abstract. The landscape should either depict a natural or futuristic environment, blending scientific, analytical, or thematic visuals related to the study's subject. Ensure the scene is rich in detail, using colors and lighting that convey the abstract's mood and significance, while maintaining a professional, visually compelling style.`;

  // Launch Puppeteer and generate the image
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });
  const page = await browser.newPage();

  // // Step 1: Go to the login page
  // await page.goto("https://deepdreamgenerator.com/login");
  // // Step 2: Enter email and password
  // // const email = "viyen42549@opposir.com";
  // // const email = "qjoskgecnwxpfxyeoy@nbmbb.com";
  // const email = "apeywsrwiouzafyhuy@nbmbb.com";
  // await page.type('input[name="email"]', email);
  // await page.type('input[name="password"]', email);

  // // Step 3: Click the "Log in" button
  // await page.click('button[type="submit"]');

  await delay(2000); // Short delay for proper navigation
  await page.goto("https://deepdreamgenerator.com/generate");
  await page.waitForSelector("#text-prompt");
  await page.type("#text-prompt", prompt);
  await page.click(".submit.generator-submit");

  // Step 1: Wait for the image element to appear
  await page.waitForSelector(".temp-image.img-responsive", { timeout: 60000 });

  // Step 2: Wait until the image is completely loaded
  await page.evaluate(async () => {
    const img = document.querySelector(".temp-image.img-responsive");
    while (!img.complete) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Check every 100ms
    }
  });

  // Step 3: Extract the image URL and download it using fetch
  const imageUrl = await page.$eval(
    ".temp-image.img-responsive",
    (img) => img.src
  );

  try {
    // const response = await fetch(imageUrl);
    // if (!response.ok)
    //   throw new Error(`Failed to fetch image: ${response.statusText}`);
    // const imageBuffer = await response.buffer();

    const imagePage = await page.goto(imageUrl);
    const imageBuffer = await imagePage.buffer();

    // Save the image to the 'images' directory
    if (!fs.existsSync("images")) fs.mkdirSync("images");
    fs.writeFileSync(imagePath, imageBuffer);
    console.log(`Image downloaded successfully as ${imageName}!`);
  } catch (error) {
    console.error(`Failed to download image: ${error.message}`);
  }

  await browser.close();

  return imageName;
}

// Main function to process items
async function processItems() {
  for (let item of items) {
    if (!item.img) {
      console.log(`Processing item: ${item.title}`);
      const imageName = await generateImage(item);
      if (imageName) item.img = imageName; // Add the img key with filename
    }
  }

  // Save updated JSON file
  fs.writeFileSync(dataPath, JSON.stringify(scholarData, null, 4));
  console.log("All items processed and JSON updated successfully.");
}

// Execute the processing
processItems();
