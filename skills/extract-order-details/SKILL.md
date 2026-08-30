---
name: extract-order-details
description: Extracts structured Order objects (order number, products, unit prices, quantities, line totals, shipping, subtotal, grand total, tax, payment type) from e-commerce order-confirmation HTML pages and emits them via an order_details DOM event. Use when scraping or parsing retailer order confirmation / checkout thank-you pages (e.g. Walmart, Target, Macy's), building order autofill or receipt extraction, or writing DOM/iframe scrapers for confirmation pages.
disable-model-invocation: true
---

# Extract Order Details

## What this does

Scrapes an e-commerce order-confirmation ("thank you") page and produces a flat,
string-typed `Order` object with order number, line items, totals, tax, and
payment type. Confirmation pages rarely render all of this as visible text —
the data hides in image `alt`s, tracking iframes, label/value lists, and href
query params. This skill encodes where to look and the parsing rules that keep
money, encoding, and formatting correct.

## Target contract

Deliver the Order as the `detail` of a synchronous DOM event:

```js
document.dispatchEvent(new CustomEvent("order_details", { detail: order }));
```

```js
{
  "Order Number": "200012623519520",     // digits, string
  Products: [
    { "Product Name": "...", "Unit Price": "7.96", Quantity: "1", "Line Total": "7.96" }
  ],
  Shipping: "0",                          // "0" when free
  Subtotal: "36.05",                      // 2-decimal money string
  "Grand Total": "39.25",                 // 2-decimal money string
  Tax: "3.20",                            // "0" when zero
  "Payment Type": "Visa"                  // network | "Store Card" | null
}
```

Every value is a string (except `Payment Type`, which may be `null`).

## Workflow

1. **Inventory every field before writing code.** For each field — Order Number,
   each product (name, unit price, quantity), Shipping, Subtotal, Grand Total,
   Tax, Payment Type — write down its source: an element selector/attribute, a
   URL parameter, or "not shown → derive".
2. **Check non-text sources** (see "Where the data hides").
3. **Detect the site** from `document.title`, falling back to distinctive
   `data-test*`/class markers. Test harnesses often set only
   `document.body.innerHTML`, so `<title>` may be empty.
4. **Write one small adapter per retailer**, sharing generic helpers (query,
   entity decode, query-string parse, money).
5. **Do all money arithmetic in integer cents**; format only at the end.
6. **Run the tests and iterate** until the exact expected values pass.

## Where the data hides (check in this order)

1. **Visible label/value lists** — e.g. Macy's `Order number: 4784457221`.
2. **Image `alt` / `aria-label` attributes** — product names often live here
   (Walmart, Target).
3. **Tracking/conversion iframes** — query params or `;`-separated pixel URLs:
   `item_prices=`, `item_quantities=`, `order_id=`, `cart_total=`, `subtotal=`
   (Walmart); `prd=i1:…|p1:69.99|q1:1|…`, `cost=`, `ord=` (Target).
4. **JSON scripts / data layers** — `__NEXT_DATA__`, `application/ld+json`,
   `dataLayer`, `adobeDataLayer`.
5. **href query params** — e.g. `Quantity=1` in product links (Macy's).

## Rules that prevent the common failure modes

- **Money in cents**: `Math.round(parseMoney(s) * 100)`, format with
  `(cents / 100).toFixed(2)`. Never trust float subtraction — derive
  `Tax = Grand Total − Subtotal − Shipping` in cents.
- **Formatting**: money fields are 2-decimal strings (`"60.00"`); `Shipping` and
  a zero `Tax` are `"0"`; `Quantity` is a string.
- **Derive missing totals**: `Subtotal = Σ(Unit Price × Quantity)`;
  `Tax = Grand Total − Subtotal − Shipping`; free shipping → `"0"`; no payment
  info → `null`.
- **Entity decoding**: saved pages double-encode (`&amp;#8482;` becomes a
  literal `&#8482;` in the attribute after one decode). Decode once via the DOM,
  then re-decode leftovers through a temp element's `innerHTML`, looping until
  stable.
- **Query-string parsing**: retailers use both `&` and `;` separators, and URLs
  can contain a stray `?` inside a value. Split the whole string on `[&;]`,
  strip any URL path/query prefix from the key, and wrap `decodeURIComponent`
  in try/catch.
- **Scope selectors tightly**: the selector count must equal the expected number
  of line items. A single wrapper containing the items as children is a classic
  trap (Macy's `.collapsed-product-detail` wrapper vs. its
  `.grid-x.small-margin-right-s` children).
- **Payment type**: card network from logo `alt` or text (`Visa`,
  `Mastercard`, `Amex`, `Discover`, `PayPal`); a card branded with the
  retailer's own name → `"Store Card"`; absent → `null`.
- **Event contract**: dispatch synchronously — test harnesses listen with
  `{ once: true }`.

## Quick validation checklist

- [ ] Every field present with the right value type (all strings)
- [ ] Money is 2 decimals; zero tax/shipping are `"0"`
- [ ] Product count matches the page
- [ ] `Line Total = Unit Price × Quantity` for every line
- [ ] `Tax = Grand Total − Subtotal − Shipping`
- [ ] Output deep-equals the expected fixture (`toEqual`)

## Running the harness

```bash
node scripts/run_extractor.js <page.html> <extractor.js>
```

Loads the HTML in jsdom, runs the extractor module, and prints the emitted
Order as JSON. Requires `jsdom` (`npm install`).

## Coding comment format

Use the JSDoc style from [templates/js_commont_temp.js](templates/js_commont_temp.js)
as the comment template for the extractor module:

- **File header** — a JSDoc block with `@file` (what the module does), `@module`,
  `@author`, `@version`, `@date`.
- **Functions** — JSDoc above every function with `@param {type} name - description`
  for each argument and a `@returns {type}` line.
- Update `@version` when the extractor changes and `@date` to the edit date.

## Additional resources

- [reference.md](reference.md) — per-retailer field-source maps and parsing gotchas
- [examples.md](examples.md) — worked examples for Walmart, Target, Macy's
- [scripts/run_extractor.js](scripts/run_extractor.js) — jsdom harness script
- [schema/](schema/) — per-retailer Order field schemas (Field, Alias, Value
  Type, Description, Regular Expression) in Markdown and CSV
- [templates/js_commont_temp.js](templates/js_commont_temp.js) — JSDoc comment
  template for the coding format
