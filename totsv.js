/** @format */

import fs from "fs";

// Load the JSON file
const rawData = fs.readFileSync("scholar-data-U9tD0ywAAAAJ.json");
const jsonData = JSON.parse(rawData);

// Function to format date properly
function formatDate(dateStr) {
  const parts = dateStr.split("/");
  if (parts.length === 1) {
    return `${parts[0]}-01-01`; // Only year -> YYYY-01-01
  } else if (parts.length === 2) {
    return `${parts[0]}-${parts[1].padStart(2, "0")}-01`; // Year/Month -> YYYY-MM-01
  } else {
    return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(
      2,
      "0"
    )}`; // Full date -> YYYY-MM-DD
  }
}

// Extract relevant data fields
const publications = jsonData.data.map((pub) => ({
  pub_date: formatDate(pub.publication_date), // Format publication date
  title: sanitizeText(pub.title),
  venue: sanitizeText(
    pub.journal || pub.conference || pub.book || pub.institution || "N/A"
  ),
  excerpt: sanitizeText(
    pub.description ? pub.description.substring(0, 200) + "..." : ""
  ),
  citation: sanitizeText(
    `${pub.authors} (${pub.year}). "${pub.title}" ${
      pub.journal || pub.conference || pub.book || pub.institution || "N/A"
    }.`
  ),
  url_slug: sanitizeText(pub.title)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, ""),
  paper_url: sanitizeText(pub.source_url || pub.url || ""),
}));

// Function to remove unwanted characters (\t, \n, etc.)
function sanitizeText(text) {
  return text ? text.replace(/[\t\n\r]+/g, " ").trim() : "Unknown";
}


// Define the TSV headers
const headers = [
  "pub_date",
  "title",
  "venue",
  "excerpt",
  "citation",
  "url_slug",
  "paper_url",
];

// Convert to TSV format
const tsvContent = [
  headers.join("\t"),
  ...publications.map((pub) => headers.map((h) => pub[h]).join("\t")),
].join("\n");

// Save the TSV file
fs.writeFileSync("publications-U9tD0ywAAAAJ.tsv", tsvContent, "utf8");

console.log("TSV file created: publications.tsv");
