"use strict";
// ** Write your module here **
// It must send an event "order_details" from the page containing an Order object,
// which describes all the relevant data points on the page.
// The order_details data you are sending should match the `expected_output` object in `test.js`

module.exports = function extract_order() {
  let order = null;
  try {
    const partner = detectPartner();

    const branch = BRANCHES[partner];
    if (!branch) {
      throw new Error(`No branch function for partner page (detected: ${partner})`);
    }

    order = branch();
  } catch (e) {
    console.error(e);
  }

  // Always emit the event, even on failure. A null detail gives the test (and
  // any real page listener) an immediate, inspectable signal instead of a
  // silent hang until the listener times out.
  document.dispatchEvent(new CustomEvent("order_details", { detail: order }));
};

// Partner name -> branch extractor. detectPartner() picks the key; each branch
// knows how to pull the Order object out of that partner's markup.
const BRANCHES = {
  walmart: extractWalmartOrder,
  target: extractTargetOrder,
  macys: extractMacysOrder,
};

// ---------------------------------------------------------------------------
// Partner detection
// ---------------------------------------------------------------------------

// Sniff the DOM for host/brand markers unique to each partner. Checking for an
// element whose src/href references the partner domain is far cheaper than
// serialising the whole document to a string first - the Macy's fixture alone is
// ~13 MB, and detection runs before any branch does.
function detectPartner() {
  const seen = (domains) =>
    domains
      .split("|")
      .some((d) => document.querySelector(`[src*="${d}"], [href*="${d}"]`));
  if (seen("walmart.com|walmartimages.com")) return "walmart";
  if (seen("target.com|target.scene7.com")) return "target";
  if (seen("macys.com|macysassets.com")) return "macys";
  return null;
}

function pageHtml() {
  if (document.documentElement && document.documentElement.outerHTML) {
    return document.documentElement.outerHTML;
  }
  return document.body ? document.body.innerHTML : "";
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Normalise a currency-ish value ("$1,234.50", "7.96", 60) to "1234.50".
// Zero (or an unparseable value) collapses to a bare "0" to match the fixtures.
// Numbers are taken as-is (that's how buildOrder passes its derived Tax); for
// strings we pull out the first number rather than stripping every non-digit, so
// stray text ("Free shipping", a phone number) fails loudly to "0" instead of
// being mangled into a bogus amount.
function money(value) {
  let n;
  if (typeof value === "number") {
    n = value;
  } else {
    const m = String(value == null ? "" : value).match(/-?\d[\d,]*(?:\.\d+)?/);
    n = m ? parseFloat(m[0].replace(/,/g, "")) : NaN;
  }
  if (!Number.isFinite(n)) return "0";
  const fixed = n.toFixed(2);
  return parseFloat(fixed) === 0 ? "0" : fixed;
}

// quantity * unit price, formatted like every other money field.
function lineTotal(unitPrice, quantity) {
  return money(parseFloat(unitPrice) * parseInt(quantity, 10));
}

// Decode HTML entities in a string, including values that were escaped twice at
// the source (e.g. Target's alt text: "&amp;#8482;" -> "&#8482;" -> "™").
function decodeEntities(str) {
  if (!str) return "";
  const el = document.createElement("textarea");
  let out = String(str);
  for (let i = 0; i < 2; i++) {
    el.innerHTML = out;
    if (el.value === out) break;
    out = el.value;
  }
  return out;
}

// Alt text of every image matching `selector`, entity-decoded and trimmed - the
// shape product names arrive in on the Walmart and Target confirmation pages.
function imgAlts(selector) {
  return Array.from(document.querySelectorAll(selector)).map((img) =>
    decodeEntities(img.getAttribute("alt")).trim()
  );
}

// Build the Products array by zipping DOM-sourced names against price and
// quantity arrays pulled from a partner's tracking iframe. Pairing is positional
// by index: the iframe arrays are ordered to match the product tiles, and a
// per-tile DOM badge can disagree (Walmart's did). Quantity falls back to "1"
// when the array is short or blank; Line Total is always computed. A name/price
// count mismatch means the positional pairing is unreliable, so warn once here
// instead of in each branch.
function buildProducts(names, prices, quantities, partner) {
  if (names.length !== prices.length) {
    console.warn(
      `${partner}: ${names.length} product names but ${prices.length} iframe prices - positional pairing may be off`
    );
  }
  return names.map((name, i) => {
    const unitPrice = money(prices[i]);
    const quantity =
      String(quantities[i] == null ? "" : quantities[i]).trim() || "1";
    return {
      "Product Name": name,
      "Unit Price": unitPrice,
      Quantity: quantity,
      "Line Total": lineTotal(unitPrice, quantity),
    };
  });
}

// Assemble the final Order object, applying the house rules for the fields a
// confirmation page often doesn't print directly:
//   Subtotal - the sum of the product line totals (the schema's pre-tax total),
//              unless the caller passes a value the page states outright.
//   Tax      - whatever is left of the Grand Total once Subtotal and Shipping
//              are removed.
// Every money field is run through money() so formatting stays consistent, and
// the key order/spelling lives in exactly one place instead of once per branch.
function buildOrder({
  orderNumber,
  products,
  grandTotal,
  shipping = "0",
  subtotal,
  paymentType = null,
}) {
  const sub = money(
    subtotal != null
      ? subtotal
      : products.reduce((s, p) => s + parseFloat(p["Line Total"]), 0)
  );
  const grand = money(grandTotal);
  const ship = money(shipping);
  return {
    "Order Number": orderNumber,
    Products: products,
    Shipping: ship,
    Subtotal: sub,
    "Grand Total": grand,
    Tax: money(parseFloat(grand) - parseFloat(sub) - parseFloat(ship)),
    "Payment Type": paymentType,
  };
}

// ---------------------------------------------------------------------------
// Walmart
// ---------------------------------------------------------------------------

function extractWalmartOrder() {
  // Walmart's confirmation page does NOT render per-item prices, quantities or
  // the subtotal anywhere in the DOM. Those only exist in the query string of
  // the `tap.walmart.com/v1/tapframe` tracking iframe, and they are ordered to
  // line up positionally with the product tiles in the "collapsed item list".
  const frame = document.querySelector(
    'iframe[src*="tapframe"], iframe[src*="tap.walmart.com"]'
  );
  if (!frame) throw new Error("Walmart: tracking iframe (tapframe) not found");
  const params = new URL(frame.getAttribute("src")).searchParams;

  // Names come from the DOM tiles, prices/quantities from the iframe array;
  // buildProducts() zips them by index and flags a count mismatch.
  const products = buildProducts(
    imgAlts('[data-testid="collapsedItemList"] img[alt]'),
    (params.get("item_prices") || "").split(","),
    (params.get("item_quantities") || "").split(","),
    "Walmart"
  );

  // The tapframe states the subtotal and cart total outright; shipping can be a
  // real charge (see walmartShipping()) so it's passed through. buildOrder still
  // derives Tax, which isn't printed anywhere on the page.
  return buildOrder({
    orderNumber: (params.get("order_id") || walmartOrderNumberFromText() || "").trim(),
    products,
    grandTotal: params.get("cart_total"),
    shipping: walmartShipping(),
    subtotal: params.get("subtotal"),
    paymentType: walmartPaymentType(),
  });
}

function walmartOrderNumberFromText() {
  const m = (document.body.textContent || "").match(/Order\s*#\s*(\d+)/i);
  return m ? m[1] : null;
}

// The "Free shipping" text here is promo-driven, so a normal order may instead
// show a real charge in the same card. Pull out a "$x.xx" amount if present,
// otherwise treat shipping as free ("0").
function walmartShipping() {
  const scope =
    document.querySelector('[data-testid="shipping-card-header"]') ||
    document.querySelector('[data-testid="fc-delivery-section"]');
  const m = (scope ? scope.textContent : "").match(/\$\s*(\d[\d,]*(?:\.\d{2})?)/);
  return m ? money(m[1]) : "0";
}

// The card brand is the alt text of the network logo next to the "Payment
// method" heading. `div.w_al6g` is Walmart's hashed utility class for that card
// and will change without notice, so it's only a hint: try it first, then walk
// up from the heading and take the first ancestor that contains a logo image.
function walmartPaymentType() {
  const header = Array.from(document.querySelectorAll("h3")).find((el) =>
    /payment method/i.test(el.textContent || "")
  );
  if (!header) return null;

  const hinted = header.closest("div.w_al6g");
  let img = hinted && hinted.querySelector("img[alt]");
  for (
    let el = header.parentElement;
    el && !img && el !== document.body;
    el = el.parentElement
  ) {
    img = el.querySelector("img[alt]");
  }
  return img ? img.getAttribute("alt").trim() : null;
}

// ---------------------------------------------------------------------------
// Target
// ---------------------------------------------------------------------------

function extractTargetOrder() {
  // The Target confirmation page renders the order number and a product image
  // per fulfillment group, but no prices, quantities or totals. Those live in
  // the Google Floodlight conversion iframe, whose `src` is ";"-delimited:
  //   ...;ord=<order#>;...;cost=<grand total>;...;prd=i1:<sku>|p1:<price>|q1:<qty>|i2:...
  const html = pageHtml();
  const prd = (html.match(/[;?&]prd=(i1:[^;"'&\s]+)/) || [])[1] || "";
  const prdMap = {};
  prd.split("|").forEach((pair) => {
    const i = pair.indexOf(":");
    if (i > 0) prdMap[pair.slice(0, i)] = pair.slice(i + 1);
  });

  // prd keys are 1-based (p1/q1, p2/q2, ...); flatten them into index-aligned
  // arrays so buildProducts() can zip them against the DOM names.
  const names = imgAlts('[data-test="fulfillment-images-filmstrip"] img[alt]');
  const products = buildProducts(
    names,
    names.map((_, i) => prdMap["p" + (i + 1)]),
    names.map((_, i) => prdMap["q" + (i + 1)]),
    "Target"
  );

  // No cost breakdown is shown on the page, so buildOrder derives Subtotal (sum
  // of line totals) and Tax (Grand Total - Subtotal - Shipping). Shipping is
  // unlisted so it stays "0", and Payment Type isn't on the confirmation page.
  return buildOrder({
    orderNumber: targetOrderNumber(html),
    products,
    grandTotal: (html.match(/[;?&]cost=([\d.]+)/) || [])[1],
  });
}

function targetOrderNumber(html) {
  const el = document.querySelector('[class*="order-number"]');
  const fromDom =
    el && (el.textContent.match(/Order\s*#?\s*([\d-]+)/i) || [])[1];
  if (fromDom) return fromDom.replace(/\D/g, "");
  return (html.match(/[;?&]ord=(\d+)/) || [])[1] || "";
}

// ---------------------------------------------------------------------------
// Macy's
// ---------------------------------------------------------------------------

function extractMacysOrder() {
  // Macy's server-renders everything into the DOM (Vue app). The "Order Details"
  // list holds the order number, payment method and order total; the product
  // rows hold names + unit prices. Subtotal, shipping and tax are not shown, so
  // subtotal is the sum of line totals and tax is the remainder vs. the total.
  const infos = Array.from(
    document.querySelectorAll('.collapsed-product-detail [id^="product-info-"]')
  );

  const products = infos.map((info) => {
    const row = info.closest(".grid-x") || info.parentElement;
    const priceEl = row.querySelector(".price-reg");
    const unitPrice = money(priceEl ? priceEl.textContent : "");
    // Quantity isn't printed; it rides along in the product link's query string.
    // Pick the link that actually carries Quantity= rather than the first <a> in
    // the row - Macy's also renders rec/ad links there that would shadow it.
    const href = Array.from(row.querySelectorAll("a[href]"))
      .map((a) => a.getAttribute("href") || "")
      .find((h) => /[?&]Quantity=\d+/i.test(h)) || "";
    const quantity = (href.match(/[?&]Quantity=(\d+)/i) || [])[1] || "1";
    return {
      "Product Name": decodeEntities(info.textContent).trim(),
      "Unit Price": unitPrice,
      Quantity: quantity,
      "Line Total": lineTotal(unitPrice, quantity),
    };
  });

  // Only "Shipping Policy" footer links appear (no amount), and subtotal/tax
  // aren't shown, so buildOrder derives Subtotal from the line totals and Tax
  // from the remainder; shipping stays "0".
  return buildOrder({
    orderNumber: macysDetail(/order number/i).replace(/\D/g, ""),
    products,
    grandTotal: macysDetail(/order total/i),
    paymentType: macysPaymentType(),
  });
}

// Read the value cell of an "Order Details" row by its label text.
function macysDetail(labelRe) {
  const label = Array.from(document.querySelectorAll(".list-label")).find((el) =>
    labelRe.test(el.textContent || "")
  );
  if (!label) return "";
  const li = label.closest("li") || label.parentElement;
  const details = li.querySelector(".list-details");
  return details ? details.textContent.replace(/\s+/g, " ").trim() : "";
}

// The Macy's "Payment method" cell only ever shows a masked card, e.g.
// "Macy's ************4618" or "Visa •••• 1234". Two independent steps:
// reduce it to the issuer, then map Macy's own store card to the schema's
// "Store Card" label and pass any other issuer through verbatim.
function macysPaymentType() {
  const raw = macysDetail(/payment method/i);
  if (!raw) return null;
  const issuer = cardIssuer(raw);
  if (!issuer) return null;
  return /\bmacy'?s\b/i.test(issuer) ? "Store Card" : issuer;
}

// Strip a trailing masked card number off a payment string, leaving the issuer.
// Handles bullet/asterisk/dot masks ("•••• 1234", "****4618", "....4618"),
// "xxxx" masks and "ending in 1234" phrasing. Only a run of >=2 mask characters
// counts, so an issuer that merely ends in "x" (e.g. "Amex") is left intact.
function cardIssuer(raw) {
  return String(raw)
    .replace(/\bending(?:\s+in)?\b.*$/i, "")
    .replace(/[\s-]*(?:[*•·‧●.]{2,}|x{2,})[\s*•·x.-]*\d*\s*$/i, "")
    .trim();
}
