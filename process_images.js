import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const WINDOW_W = 1920;
const WINDOW_H = 1080;

// Resize: fix height, auto width (aspect preserved)
const OUT_H = 600;

// Navigation tuning
const NAV_TIMEOUT_MS = 60000;      // per navigation
const RETRIES = 2;                 // retries after initial try
const BACKOFF_MS = 1500;           // backoff between retries
const WAIT_STATES = ['networkidle0', 'load', 'domcontentloaded']; // strict -> lenient
const folderName = 'new_images';

// delay helper (replacement for page.waitForTimeout in newer Puppeteer)
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// ---- Helpers -------------------------------------------------------

function isValidHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Unique ID rules:
// - If item.url has ?citation_for_view=...:ID → extract ID
// - Else base64 of item.url (or empty string), trimmed to 16 chars
// - If that’s empty (e.g., url missing), fall back to index-based ID
function getUniqueId(item, idx) {
  try {
    if (typeof item?.url === 'string') {
      const u = new URL(item.url);
      const cv = u.searchParams.get('citation_for_view');
      if (cv && cv.includes(':')) {
        const maybeId = cv.split(':')[1] || cv;
        if (maybeId) return maybeId;
      }
      const b64 = Buffer.from(item.url).toString('base64').slice(0, 16);
      if (b64) return b64;
    }
  } catch {
    // fall through to index-based
  }
  return `noid_${String(idx).padStart(6, '0')}`;
}

async function tryGoto(page, url) {
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    for (const state of WAIT_STATES) {
      try {
        await page.goto(url, { waitUntil: state, timeout: NAV_TIMEOUT_MS });
        await page.waitForSelector('body', { timeout: 10000 });
        await page.waitForFunction(
          () => ['interactive', 'complete'].includes(document.readyState),
          { timeout: 10000 }
        );
        return true;
      } catch (err) {
        const lastState = state === WAIT_STATES[WAIT_STATES.length - 1];
        if (lastState && attempt < RETRIES) {
          const wait = BACKOFF_MS * (attempt + 1);
          console.warn(`goto retry ${attempt + 1} after ${wait}ms (${state} failed)`);
          await delay(wait);
        } else if (lastState && attempt === RETRIES) {
          throw err;
        }
      }
    }
  }
}

async function acceptCookiesIfAny(page) {
  try {
    // brief wait for banner render
    await delay(1500);

    // Only match <button> elements that contain "accept cookie" (case-insensitive)
    const [button] = await page.$x(
      "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'accept cookie')]"
    );
    if (button) {
      await button.click({ delay: 20 });
      console.log("Clicked 'Accept Cookie' button");
      await delay(800);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

// ---- Main ---------------------------------------------------------

async function processImages(jsonFilePath) {
  try {
    const rawData = await fs.readFile(jsonFilePath, 'utf8');
    const jsonData = JSON.parse(rawData);

    const imagesDir = path.join(path.dirname(jsonFilePath), folderName);
    await fs.mkdir(imagesDir, { recursive: true });

    const browser = await puppeteer.launch({
      headless: true,
      defaultViewport: null, // use window size as viewport
      args: [
        `--window-size=${WINDOW_W},${WINDOW_H}`,
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-notifications'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: WINDOW_W, height: WINDOW_H, deviceScaleFactor: 1 });
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    page.setDefaultTimeout(30000);

    // Stable UA helps some consent frameworks
    // await page.setUserAgent(
    //   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    //   'Chrome/120.0.0.0 Safari/537.36'
    // );

    // Ensure jsonData.data is an array
    const items = Array.isArray(jsonData?.data) ? jsonData.data : [];
    if (items.length === 0) {
      console.warn('No items found under jsonData.data');
    }

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];

      // 1) Build a robust uniqueId FIRST (does not require valid URLs)
      const uniqueId = getUniqueId(item, idx);
      const imagePath = path.join(imagesDir, `${uniqueId}.png`);

      // 2) FIRST check: if image already exists, skip immediately
      try {
        await fs.access(imagePath);
        console.log(`Image already exists for ID: ${uniqueId}`);
        continue;
      } catch {
        // not found → proceed
      }

      // 3) Validate presence and URL validity of required keys
      const urlOK = isValidHttpUrl(item?.url);
      const sourceOK = isValidHttpUrl(item?.source_url);
      if (!urlOK || !sourceOK) {
        console.warn(
          `Skipping ${uniqueId}: invalid or missing url/source_url ` +
          `(urlOK=${urlOK}, sourceOK=${sourceOK})`
        );
        continue;
      }

      try {
        // 4) Navigate
        await tryGoto(page, item.source_url);

        // 5) Try to accept cookie banner
        await acceptCookiesIfAny(page);

        // 6) Small settle time for dynamic layouts
        await delay(500);

        // 7) Screenshot visible viewport (1920x1080)
        const screenshotBuffer = await page.screenshot({
          type: 'png',
          fullPage: false
        });

        // 8) Resize by height only; width auto (keeps aspect ratio)
        await sharp(screenshotBuffer)
          .resize({ height: OUT_H })
          .png()
          .toFile(imagePath);

        console.log(`Saved ${uniqueId}: 1920x1080 → auto×${OUT_H}`);
      } catch (err) {
        console.error(`Error processing ${uniqueId}:`, err);
      }
    }

    await browser.close();
    console.log('Processing complete!');
  } catch (err) {
    console.error('Error:', err);
  }
}

// Run
processImages('scholar-data-qK-YgxAAAAAJ.json');
