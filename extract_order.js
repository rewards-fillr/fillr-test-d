"use strict";

/**
 * @file Order details extractor for e-commerce confirmation pages.
 * @module extract_order
 * @author Simon Chen <alexion389@gmail.com>
 * @version 1.0.0
 * @date 2026-08-29
 *
 * Scrapes an e-commerce order confirmation page and emits the extracted data as
 * a DOM CustomEvent named "order_details", whose `detail` is an Order object:
 *
 *   {
 *     "Order Number": string,
 *     Products: [ { "Product Name", "Unit Price", Quantity, "Line Total" }, ... ],
 *     Shipping:    string,   // "0" when free
 *     Subtotal:    string,   // 2-decimal money
 *     "Grand Total": string, // 2-decimal money
 *     Tax:         string,   // "0" when zero, else 2-decimal money
 *     "Payment Type": string | null,
 *   }
 *
 * Each retailer renders its confirmation page differently, so the module first
 * detects the site and then applies a small site-specific adapter. Money maths
 * is done in integer cents to avoid floating point drift.
 */

// ---------------------------------------------------------------------------
// Generic utilities
// ---------------------------------------------------------------------------

/**
 * Query all elements matching a selector.
 * @param {string} selector - CSS selector.
 * @param {Element} [root=document] - Root element to search within.
 * @returns {Element[]} Array of matching elements.
 */
function queryAll(selector, root) {
  return Array.from((root || document).querySelectorAll(selector));
}

/**
 * Query the first element matching a selector.
 * @param {string} selector - CSS selector.
 * @param {Element} [root=document] - Root element to search within.
 * @returns {Element|null} The first matching element, or null.
 */
function query(selector, root) {
  return (root || document).querySelector(selector);
}

/**
 * Decode HTML entities in a string. jsdom already decodes the source once, so
 * an attribute value like "Threshold&#8482;" (from a double-encoded source)
 * still contains a literal entity; re-decoding through innerHTML resolves it
 * to "Threshold™". We loop a few times to tolerate double/triple encoding.
 * @param {string} str - Raw text that may contain HTML entities.
 * @returns {string} Entity-decoded, trimmed text.
 */
function decodeEntities(str) {
  if (str == null) return "";
  let value = String(str);
  const el = document.createElement("div");
  for (let i = 0; i < 3; i += 1) {
    el.innerHTML = value;
    const next = el.textContent || "";
    if (next === value) break;
    value = next;
  }
  return value.trim();
}

/**
 * Parse a query/fragment string into key/value pairs. Accepts both `&` and `;`
 * separators (retailers use both) and percent-decodes each value.
 * @param {string} str - URL or query string to parse.
 * @returns {Object<string, string>} Map of parameter names to decoded values.
 */
function parseQueryString(str) {
  const out = {};
  if (!str) return out;
  const s = String(str);
  // Some retailers separate params with "&", others with ";". Split on both and
  // tolerate a URL path/query prefix (e.g. ".../tapframe?item_ids=...") on the
  // first segment by stripping it from the key.
  for (const pair of s.split(/[&;]/)) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).replace(/^.*[/?]/, "");
    const rawVal = pair.slice(idx + 1);
    let val = rawVal;
    try {
      val = decodeURIComponent(rawVal);
    } catch (e) {
      /* keep raw */
    }
    if (key) out[key] = val;
  }
  return out;
}

/**
 * Strip a currency string down to a Number ("$26.70" -> 26.7).
 * @param {string} str - Currency string, e.g. "$26.70".
 * @returns {number} Numeric value, or 0 when unparseable.
 */
function parseMoney(str) {
  if (str == null) return 0;
  const cleaned = String(str).replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Convert a money value to integer cents.
 * @param {string|number} value - Money value.
 * @returns {number} Integer cents.
 */
function toCents(value) {
  return Math.round(parseMoney(value) * 100);
}

/**
 * Convert integer cents to a 2-decimal money string.
 * @param {number} cents - Integer cents.
 * @returns {string} 2-decimal money string.
 */
function centsToMoney(cents) {
  return (cents / 100).toFixed(2);
}

/**
 * Recognise a card network from free text (used for "Payment Type").
 * @param {string} text - Free text that may name a card network.
 * @returns {string|null} Card network name, or null.
 */
function cardBrandFromText(text) {
  if (!text) return null;
  const s = String(text);
  if (/visa/i.test(s)) return "Visa";
  if (/master\s*card|mastercard/i.test(s)) return "Mastercard";
  if (/american\s*express|\bamex\b/i.test(s)) return "Amex";
  if (/discover/i.test(s)) return "Discover";
  if (/paypal/i.test(s)) return "PayPal";
  return null;
}

// ---------------------------------------------------------------------------
// Order assembly
// ---------------------------------------------------------------------------

/**
 * Build the final Order object. Subtotals and grand totals are passed as
 * integer cents; tax is derived as the difference, so the extractor never has
 * to find a tax line explicitly.
 * @param {string} orderNumber - Unique order identifier.
 * @param {Object[]} products - Line items.
 * @param {number} subtotalCents - Subtotal in integer cents.
 * @param {number} grandTotalCents - Grand total in integer cents.
 * @param {string|null} paymentType - Payment type (network name or "Store Card").
 * @param {number} [shippingCents=0] - Shipping in integer cents.
 * @returns {Object} The assembled Order object.
 */
function buildOrder(orderNumber, products, subtotalCents, grandTotalCents, paymentType, shippingCents) {
  const shipping = shippingCents == null ? 0 : shippingCents;
  const tax = grandTotalCents - subtotalCents - shipping;
  return {
    "Order Number": String(orderNumber),
    Products: products,
    Shipping: shipping === 0 ? "0" : centsToMoney(shipping),
    Subtotal: centsToMoney(subtotalCents),
    "Grand Total": centsToMoney(grandTotalCents),
    Tax: tax === 0 ? "0" : centsToMoney(tax),
    "Payment Type": paymentType,
  };
}

/**
 * Build a product line, computing "Line Total" = price * quantity.
 * @param {string} name - Product name.
 * @param {number} priceCents - Unit price in integer cents.
 * @param {string|number} quantity - Quantity ordered.
 * @returns {Object} Product line item.
 */
function makeProduct(name, priceCents, quantity) {
  const qty = parseInt(quantity, 10);
  const n = Number.isFinite(qty) && qty > 0 ? qty : 1;
  return {
    "Product Name": name,
    "Unit Price": centsToMoney(priceCents),
    Quantity: String(n),
    "Line Total": centsToMoney(priceCents * n),
  };
}

// ---------------------------------------------------------------------------
// Site detection
// ---------------------------------------------------------------------------

/**
 * Detect which retailer the current page belongs to.
 * @returns {string} "walmart" | "target" | "macys" | "unknown".
 */
function detectSite() {
  const title = (document.title || "").toLowerCase();
  if (title.indexOf("walmart") !== -1) return "walmart";
  if (title.indexOf("target") !== -1) return "target";
  if (title.indexOf("macy") !== -1) return "macys";

  // Fall back to distinctive DOM markers when <title> is not enough.
  if (query('[data-testid="od-summary"]')) return "walmart";
  if (query('[data-test="order-confirmation-container"]')) return "target";
  if (query(".collapsed-product-detail")) return "macys";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Walmart
// ---------------------------------------------------------------------------
// The confirmation page carries the full payload in a tracking iframe's query
// string (item_prices, item_quantities, order_id, cart_total, subtotal) and
// renders product names in the collapsed item list's image alt attributes.

/**
 * Extract an Order from a Walmart confirmation page.
 * @returns {Object} The Walmart Order object.
 */
function extractWalmart() {
  const src =
    queryAll("iframe")
      .map((f) => f.getAttribute("src") || "")
      .find((s) => s.indexOf("item_prices=") !== -1) || "";
  const params = parseQueryString(src);

  const prices = (params.item_prices || "").split(",");
  const quantities = (params.item_quantities || "").split(",");

  const list = query('[data-testid="collapsedItemList"]');
  const nameImgs = queryAll("img[alt]", list).filter((img) => (img.getAttribute("alt") || "").trim());

  const products = [];
  const count = Math.max(prices.length, quantities.length, nameImgs.length);
  for (let i = 0; i < count; i += 1) {
    const name = decodeEntities(nameImgs[i] ? nameImgs[i].getAttribute("alt") : "");
    products.push(makeProduct(name, toCents(prices[i]), quantities[i]));
  }

  // Payment type comes from the wallet card logo's alt text (e.g. "Visa").
  let paymentType = null;
  for (const img of queryAll("img[alt]")) {
    const brand = cardBrandFromText(img.getAttribute("alt"));
    if (brand) {
      paymentType = brand;
      break;
    }
  }

  return buildOrder(
    params.order_id,
    products,
    products.reduce((sum, p) => sum + toCents(p["Unit Price"]) * parseInt(p.Quantity, 10), 0),
    toCents(params.cart_total),
    paymentType,
    0
  );
}

// ---------------------------------------------------------------------------
// Target
// ---------------------------------------------------------------------------
// Product names render as filmstrip image alt text; prices, quantities and the
// grand total are carried in a DoubleClick conversion iframe (`prd=...`,
// `cost=...`, `ord=...`). No payment method is exposed, so it is null.

/**
 * Extract an Order from a Target confirmation page.
 * @returns {Object} The Target Order object.
 */
function extractTarget() {
  const src =
    queryAll("iframe")
      .map((f) => f.getAttribute("src") || "")
      .find((s) => s.indexOf("prd=") !== -1) || "";
  const params = parseQueryString(src);

  // prd=i1:92357131|p1:69.99|q1:1|i2:94685931|p2:60|q2:1
  const items = parseTargetPrd(params.prd);
  const nameImgs = queryAll('img[class*="quantity-image"]');

  const products = items.map((item, i) => {
    const name = decodeEntities(nameImgs[i] ? nameImgs[i].getAttribute("alt") : "");
    return makeProduct(name, toCents(item.p), item.q);
  });

  const orderNumber = params.ord || findOrderNumberFromText();

  return buildOrder(
    orderNumber,
    products,
    products.reduce((sum, p) => sum + toCents(p["Unit Price"]) * parseInt(p.Quantity, 10), 0),
    toCents(params.cost),
    null,
    0
  );
}

/**
 * Parse a Target conversion iframe `prd` value into item records.
 * @param {string} prd - The `prd` value, e.g. "i1:92357131|p1:69.99|q1:1|...".
 * @returns {Object[]} Items sorted by index, each with `i`, `p`, `q` fields.
 */
function parseTargetPrd(prd) {
  if (!prd) return [];
  const items = {};
  for (const part of String(prd).split("|")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const key = part.slice(0, idx);
    const val = part.slice(idx + 1);
    const match = key.match(/^([a-z]+)(\d+)$/i);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const num = match[2];
    if (!items[num]) items[num] = {};
    items[num][field] = val;
  }
  return Object.keys(items)
    .sort((a, b) => Number(a) - Number(b))
    .map((num) => items[num]);
}

/**
 * Fallback: scan visible text for "Order # <digits>".
 * @returns {string} Order number, or empty string.
 */
function findOrderNumberFromText() {
  const text = document.body ? document.body.textContent : "";
  const match = text.match(/order\s*#\s*:?\s*(\d+)/i);
  return match ? match[1] : "";
}

// ---------------------------------------------------------------------------
// Macy's
// ---------------------------------------------------------------------------
// The order summary is a list of label/value pairs. Products live in
// `.collapsed-product-detail` cards (name, `price-reg`, and `Quantity` in the
// product link). Payment is a store-branded card.

/**
 * Extract an Order from a Macy's confirmation page.
 * @returns {Object} The Macy's Order object.
 */
function extractMacys() {
  const orderNumber = macysLabelValue(/order\s*number/i);
  const totalRaw = macysLabelValue(/order\s*total/i);
  const paymentRaw = macysLabelValue(/payment\s*method/i);

  const products = queryAll(".collapsed-product-detail .grid-x.small-margin-right-s").map((card) => {
    const link = query('a[aria-label]', card) || query("img[alt]", card);
    const name = decodeEntities(
      link ? link.getAttribute("aria-label") || link.getAttribute("alt") : ""
    );
    const priceEl = query(".price-reg", card);
    const priceCents = toCents(priceEl ? priceEl.textContent : 0);
    const href = link ? link.getAttribute("href") || "" : "";
    const qty = parseQueryString(href).Quantity || "1";
    return makeProduct(name, priceCents, qty);
  });

  return buildOrder(
    orderNumber,
    products,
    products.reduce((sum, p) => sum + toCents(p["Unit Price"]) * parseInt(p.Quantity, 10), 0),
    toCents(totalRaw),
    macysPaymentType(paymentRaw),
    0
  );
}

/**
 * Find the value that follows a given label inside the order-summary list.
 * @param {RegExp} labelRe - Regex matched against the list label.
 * @returns {string|null} The associated value text, or null.
 */
function macysLabelValue(labelRe) {
  for (const li of queryAll("li")) {
    const label = query(".list-label", li);
    const value = query(".list-details", li);
    if (label && value && labelRe.test(label.textContent || "")) {
      return value.textContent.trim();
    }
  }
  return null;
}

/**
 * Determine the Macy's payment type from the payment method text.
 * @param {string} raw - Payment method text.
 * @returns {string|null} Card network name, "Store Card", or null.
 */
function macysPaymentType(raw) {
  const brand = cardBrandFromText(raw);
  if (brand) return brand;
  // A card branded with the retailer's own name is a store card.
  if (/macy/i.test(String(raw || ""))) return "Store Card";
  return null;
}

// ---------------------------------------------------------------------------
// Generic fallback (best-effort for unknown pages)
// ---------------------------------------------------------------------------

/**
 * Generic best-effort extractor for unknown pages.
 * @returns {Object} A minimal Order object.
 */
function extractGeneric() {
  const orderNumber = findOrderNumberFromText();
  const products = queryAll("img[alt]")
    .filter((img) => (img.getAttribute("alt") || "").trim())
    .map((img) => makeProduct(decodeEntities(img.getAttribute("alt")), 0, 1));
  return buildOrder(orderNumber, products, 0, 0, null, 0);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Entry point: detect the site, extract the Order, and emit it as a
 * CustomEvent named "order_details".
 * @returns {void}
 */
module.exports = function extract_order() {
  try {
    const site = detectSite();
    let order;
    if (site === "walmart") order = extractWalmart();
    else if (site === "target") order = extractTarget();
    else if (site === "macys") order = extractMacys();
    else order = extractGeneric();

    document.dispatchEvent(new CustomEvent("order_details", { detail: order }));
  } catch (e) {
    console.error(e);
  }
};
