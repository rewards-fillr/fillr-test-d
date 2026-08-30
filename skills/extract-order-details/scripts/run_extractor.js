"use strict";

/**
 * @file jsdom harness for the extract-order-details skill.
 * @description Loads an HTML page into jsdom, runs an order extractor module
 *   against it, and prints the emitted "order_details" event as JSON.
 *
 * Usage:
 *   node scripts/run_extractor.js <page.html> <extractor.js>
 *
 * Example:
 *   node scripts/run_extractor.js orders/walmart_order.html extract_order.js
 *
 * Requires jsdom (npm install).
 */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const [pageFile, extractorFile] = process.argv.slice(2);

if (!pageFile || !extractorFile) {
  console.error("Usage: node run_extractor.js <page.html> <extractor.js>");
  process.exit(1);
}
if (!fs.existsSync(pageFile)) {
  console.error(`Page not found: ${pageFile}`);
  process.exit(1);
}
if (!fs.existsSync(extractorFile)) {
  console.error(`Extractor not found: ${extractorFile}`);
  process.exit(1);
}

// Mirror the jsdom environment a jest/jsdom test harness would provide.
const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>");
global.window = dom.window;
global.document = dom.window.document;
global.CustomEvent = dom.window.CustomEvent;

document.body.innerHTML = fs.readFileSync(pageFile, "utf-8");

let order = null;
document.addEventListener("order_details", (event) => {
  order = event.detail;
}, { once: true });

try {
  const extractor = require(path.resolve(extractorFile));
  extractor();
} catch (err) {
  console.error("Extractor threw:", err);
  process.exit(1);
}

if (order) {
  console.log(JSON.stringify(order, null, 2));
} else {
  console.error("No order_details event was dispatched.");
  process.exit(1);
}
