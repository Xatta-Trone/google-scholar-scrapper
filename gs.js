/** @format */

import puppeteer from "puppeteer";
import fs from "fs";

const scholarParser = {
  parse: async (userId) => {
    console.log(userId);
    // publications data array
    let data = [];

    // load the json file if exists
    const fileName = `scholar-data-${userId}.json`;
    if (fs.existsSync(fileName)) {
      const rawJsonData = fs.readFileSync(fileName, "utf8");
      const jsonData = JSON.parse(rawJsonData);
      if (jsonData.data.length > 0) {
        data = jsonData.data;
      }
    }

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.goto(
      `https://scholar.google.com/citations?hl=en&user=${userId}&view_op=list_works&sortby=pubdate`,
      {
        waitUntil: "networkidle2",
      }
    );

    // Scrape article title, url, citations, year from the main page
    const articles = await scholarParser.articleData(page);

    for (const article of articles) {
      // check if the article title is already in the data
      if (data.some((d) => d.title === article.title)) {
        console.log(`Skipping ${article.title}`);
        continue;
      }

      // visit each article page
      let articleData = await scholarParser.articleMetaData(article, page);
      data.push(articleData);
    }
    // make the data to json with last updated utc date
    const dataToWrite = {
      last_updated_utc: new Date().toISOString(),
      data: data,
    };
    // write it to a file
    fs.writeFile(
      `scholar-data-${userId}.json`,
      JSON.stringify(dataToWrite, null, 4),
      (err) => {
        console.log(err);
      }
    );

    await browser.close();
  },

  getText: async (page, xpath) => {
    return await page.evaluate((xpath) => {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.STRING_TYPE,
        null
      );
      return result.stringValue.trim();
    }, xpath);
  },
  // Extract value using CSS selector
  getCSSValue: async (page, selector, href = false) => {
    return await page.evaluate(
      (selector, href) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        // If href flag is true, return the href attribute, otherwise return the text
        return href ? element.href : element.innerText.trim();
      },
      selector,
      href
    );
  },
  extractFieldData: async (page, fieldName) => {
    return await page.evaluate((fieldName) => {
      const fieldElements = Array.from(
        document.querySelectorAll(".gsc_oci_field")
      );
      for (let el of fieldElements) {
        if (el.innerText === fieldName) {
          return el.nextElementSibling.innerText.trim();
        }
      }
      return null;
    }, fieldName);
  },
  articleData: async (page) => {
    // Scrape article titles and URLs from the main page
    const articles = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".gsc_a_tr"));
      return rows.map((row) => {
        const title = row.querySelector(".gsc_a_t a").innerText;
        const url = row.querySelector(".gsc_a_t a").href;
        const citations = row.querySelector(".gsc_a_c").innerText;
        const year = row.querySelector(".gsc_a_y").innerText;
        return { title, url, total_citations: citations, year };
      });
    });
    return articles;
  },
  articleMetaData: async (article, page) => {
    let articleData = { ...article };
    // visit each article page
    await page.goto(article.url, { waitUntil: "networkidle2" });

    // Mapping CSS selectors for title (CSS selectors) and other fields (XPath)
    const cssMappings = {
      title: ".gsc_oci_title_link",
    };

    // Extract the source URL from the page
    for (const [key, value] of Object.entries(cssMappings)) {
      let val = await scholarParser.getCSSValue(page, value, true);
      if (val != null) {
        articleData["source_url"] = val;
      } else {
        console.error(`${key} not found`);
      }
    }

    //   extract gs_scl > gsc_oci_field data with its value
    const articleMetaData = await page.evaluate(() => {
      const data = {};
      const rows = Array.from(document.querySelectorAll(".gs_scl"));
      const acceptedKeys = [
        "authors",
        "publication date",
        "journal",
        "volume",
        "pages",
        "publisher",
        "description",
        //   "total citations",
      ];

      rows.forEach((row) => {
        const key = row.querySelector(".gsc_oci_field")?.innerText.trim();
        const value = row.querySelector(".gsc_oci_value")?.innerText.trim();
        if (key && value && acceptedKeys.includes(key.toLowerCase())) {
          data[key.replaceAll(" ", "_").toLowerCase()] = value;
        }
      });

      return data;
    });
    articleData = { ...articleData, ...articleMetaData };

    return articleData;
  },
  loadExistingData: async (fileName) => {
    let existingData = [];
    try {
      if (await fs.access(fileName)) {
        const rawJsonData = await fs.readFile(fileName, "utf8");
        const jsonData = JSON.parse(rawJsonData);
        existingData = jsonData.data;
      }
    } catch (err) {
      console.error("Error reading file:", err);
    }

    return existingData;
  },
};

// Run the parser
scholarParser.parse("qK-YgxAAAAAJ"); // Replace with the Google Scholar user ID
