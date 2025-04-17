/** @format */

import puppeteer from "puppeteer";
import fs from "fs";
const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const scholarParser = {
  parse: async (userId) => {
    console.log(`Scraping publications for user: ${userId}`);

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
      headless: true,
      defaultViewport: null,
      args: [`--no-sandbox`, `--disable-setuid-sandbox`],
      slowMo: 100,
    });

    const page = await browser.newPage();
    await page.goto(
      `https://scholar.google.com/citations?hl=en&user=${userId}&view_op=list_works&sortby=pubdate`,
      {
        waitUntil: "networkidle2",
      }
    );

    let hasMoreResults = true;
    let allArticles = [];
    while (hasMoreResults) {
      const articles = await scholarParser.articleData(page);
      allArticles = [...allArticles, ...articles];

      const loadMoreButton = await page.$("#gsc_bpf_more");
      const isDisabled = await loadMoreButton.getProperty("disabled");
      const disabledValue = await isDisabled.jsonValue();
      console.log(`Button is disabled: ${disabledValue}`);

      if (loadMoreButton && !disabledValue) {
        console.log("Loading more results...");
        await page.click("#gsc_bpf_more");
        await delay(3000);
      } else {
        console.log("No more results to load.");
        hasMoreResults = false;
      }
    }

    console.log(`Total articles found: ${allArticles.length}`);
    console.log(`Current data length: ${data.length}`);

    const currentYear = new Date().getFullYear().toString();

    for (const article of allArticles) {
      const existingIndex = data.findIndex((d) => d.title === article.title);

      if (existingIndex !== -1) {
        // Update citations for ALL existing articles
        data[existingIndex].total_citations = article.total_citations;
        data[existingIndex].last_citation_update = new Date().toISOString();
        console.log(
          `Updated citations for ${article.title}: ${article.total_citations}`
        );
        continue;
      }

      // Only fetch detailed metadata for current year articles
      if (article.year === currentYear) {
        console.log(
          `New ${currentYear} article, fetching full metadata: ${article.title}`
        );
        let articleData = await scholarParser.articleMetaData(article, page);
        data.push(articleData);
      } else {
        // For older articles, just add basic data
        console.log(
          `Adding basic data for ${article.year} article: ${article.title}`
        );
        data.push({
          ...article,
          last_citation_update: new Date().toISOString(),
        });
      }
    }

    // Deduplicate using citation_for_view
    let seen = new Set();
    let uniqueArticles = [];

    for (let article of data) {
      const urlMatch = article.url?.match(/citation_for_view=[\w-]+:([\w-]+)/);
      let key = urlMatch ? urlMatch[1] : article.url;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueArticles.push(article);
      }
    }

    // make the data to json with last updated utc date
    const dataToWrite = {
      last_updated_utc: new Date().toISOString(),
      data: uniqueArticles,
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
        let title = row.querySelector(".gsc_a_t a").innerText;
        const url = row.querySelector(".gsc_a_t a").href;
        const citations =
          parseInt(row.querySelector(".gsc_a_c").innerText) || 0;
        const year = row.querySelector(".gsc_a_y").innerText;
        if (title.length > 0) {
          title = title.replace(
            /\w\S*/g,
            (text) =>
              text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
          );
        }

        console.log(citations);

        // Add timestamp for citation update
        return {
          title,
          url,
          total_citations: citations,
          last_citation_update: new Date().toISOString(),
          year,
        };
      });
    });
    return articles;
  },
  articleMetaData: async (article, page) => {
    console.log(`Scraping article: ${article.title}`);
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
        "book",
        //   "total citations",
      ];

      const skipKeys = ["scholar articles"];

      rows.forEach((row) => {
        const key = row.querySelector(".gsc_oci_field")?.innerText.trim();
        const value = row.querySelector(".gsc_oci_value")?.innerText.trim();
        if (key && value && skipKeys.includes(key.toLowerCase()) == false) {
          data[key.replaceAll(" ", "_").toLowerCase()] = value;
        }
      });

      return data;
    });
    articleData = { ...articleData, ...articleMetaData };
    console.log(articleData);

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

// List of Google Scholar user IDs
const userIds = ["qK-YgxAAAAAJ", "U9tD0ywAAAAJ", "edkjFpwAAAAJ"];
// const userIds = ["edkjFpwAAAAJ"];

// Run the parser for each user ID
userIds.forEach((userId) => {
  console.log(`Parsing for User: ${userId}`);
  scholarParser.parse(userId);
});
