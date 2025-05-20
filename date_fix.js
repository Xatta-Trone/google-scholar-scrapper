import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Create __dirname manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read all JSON files in the directory
const files = fs.readdirSync(__dirname).filter(file => file.endsWith('.json'));

for (const file of files) {
  try {
    const fullPath = path.join(__dirname, file);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const json = JSON.parse(raw);

    if (Array.isArray(json.data)) {
      let currentDate = new Date();

      // Add date_added in reverse order (last = newest date)
      for (let i = json.data.length - 1; i >= 0; i--) {
        json.data[i]['date_added'] = currentDate.toISOString().split('T')[0];
        currentDate.setDate(currentDate.getDate() - 1);
      }

      // Save back to the same file
      fs.writeFileSync(fullPath, JSON.stringify(json, null, 2));
      console.log(`✅ Updated: ${file}`);
    } else {
      console.log(`⚠️ Skipped (no 'data' array): ${file}`);
    }
  } catch (err) {
    console.error(`❌ Error processing ${file}: ${err.message}`);
  }
}
