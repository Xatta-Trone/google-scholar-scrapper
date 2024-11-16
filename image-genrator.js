/** @format */

import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

// Delay function
const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

// Function to generate an image
async function generateImage(details) {
  // Extract year and unique id from the URL
  const year = details.year;
  const uniqueId = details.url.includes("citation_for_view")
    ? new URL(details.url).searchParams.get("citation_for_view").split(":")[1]
    : Date.now();
  const imageName = `${year}_${uniqueId}.jpg`;
  const imagePath = path.join("images", imageName);

  // Generate the prompt based on title and description
  const prompt = `Create a highly detailed landscape illustration inspired by the title '${details.title}' and the following abstract: '${details.description}'. The image should be in a 1280x800 dimension, capturing a wide landscape format. Visually interpret the main themes and findings of the research, integrating elements or symbols that represent key concepts outlined in the abstract. The landscape should either depict a natural or futuristic environment, blending scientific, analytical, or thematic visuals related to the study's subject. Ensure the scene is rich in detail, using colors and lighting that convey the abstract's mood and significance, while maintaining a professional, visually compelling style`;

  // Launch Puppeteer and navigate to Deep Dream Generator
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });
  const page = await browser.newPage();

  // Step 1: Go to the login page
  await page.goto("https://deepdreamgenerator.com/login");

  // Step 2: Enter email and password
  // const email = "viyen42549@opposir.com";
  const email = "apeywsrwiouzafyhuy@nbmbb.com";
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', email);

  // Step 3: Click the "Log in" button
  await page.click('button[type="submit"]');

  // Navigate to the generator page directly
  await delay(2000); // Short delay to ensure proper navigation
  await page.goto("https://deepdreamgenerator.com/generate");

  // Step 1: Enter the prompt into the textarea
  await page.waitForSelector("#text-prompt");
  await page.type("#text-prompt", prompt);

  // Step 2: Click the "Generate" button
  await page.click(".submit.generator-submit");

  // Step 3: Wait for the generated image to appear
  await page.waitForSelector(".temp-image.img-responsive", { timeout: 60000 });

  // Step 4: Extract the image URL and download it
  const imageUrl = await page.$eval(
    ".temp-image.img-responsive",
    (img) => img.src
  );
  const imagePage = await page.goto(imageUrl);
  const imageBuffer = await imagePage.buffer();

  // Save the image to the 'images' directory
  if (!fs.existsSync("images")) {
    fs.mkdirSync("images");
  }
  fs.writeFileSync(imagePath, imageBuffer);

  console.log(`Image downloaded successfully as ${imageName}!`);

  await browser.close();
}

// Example usage of the function
const details = {
  title:
    "Understanding socio-demographic factors associated with shared-use-paths (SUPs) utilization",
  url: "https://scholar.google.com/citations?view_op=view_citation&hl=en&user=qK-YgxAAAAAJ&sortby=pubdate&citation_for_view=qK-YgxAAAAAJ:QaSi33NTfwYC",
  total_citations: "3",
  year: "2024",
  source_url:
    "https://www.sciencedirect.com/science/article/pii/S2950105924000032",
  authors:
    "Boniphace Kutela, Frank Ngeni, Norris Novat, Hellen Shita, Mark Ngotonie, Rafael John Mwekh’iga, Neema Langa, Subasish Das",
  publication_date: "2024/12/1",
  journal: "Journal of Cycling and Micromobility Research",
  volume: "2",
  pages: "100012",
  publisher: "Elsevier",
  description:
    "Shared Use Paths (SUPs) are becoming very popular in North America due to the current initiatives that promote active travel. SUPs can accommodate different types of users, including pedestrians, bicyclists, scooterists, and skateboarders. Although the interest in SUPs continues to increase, relatively less research has been performed on their utilization, especially using revealed preferences. Therefore, this study utilizes the survey data collected from Edmonton, Canada, between June 12th to 19th 2018 to explore the likelihood of utilizing the SUPs and the associated frequency of use. Results indicate that not all variables associated with the likelihood of utilization are also associated with the frequency of use. Specifically, higher levels of education influence the likelihood of SUP utilization, while the higher frequency of SUP usage is influenced by the secondary modes of transportation. On the other hand, as the ...",
};

// Call the function
generateImage(details);
