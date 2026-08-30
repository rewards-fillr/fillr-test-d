# AI Usage — Rakuten Melbourne Engineer Code Test D

## Tool used

I worked with an AI coding assistant (a DeepSeek-powered coding agent in the
Codex/Harness environment) to analyse the three provided HTML fixtures, design
the extraction strategy, and implement `extract_order.js`. The test runner was
Jest (`jsdom` environment).

## Approach / prompts

I directed the assistant in stages rather than asking for a finished solution
up front:

1. **"Go through the project context."** — The assistant read `README.md`,
   `test.js`, `extract_order.js`, the `test` runner and the three HTML files,
   then explained the objective and the exact `Order` shape the event must
   carry.
2. **"Find where each page actually stores its order data."** — The assistant
   inspected the raw HTML and the parsed DOM (via a small `jsdom` script) and
   reported, per site, *where* each field lives:
   - **Walmart** — the payload is in a tracking `<iframe>` query string
     (`item_prices`, `item_quantities`, `order_id`, `cart_total`, `subtotal`);
     product names come from image `alt` text in the collapsed item list.
   - **Target** — product names are filmstrip image `alt`s; prices/quantities
     and the total are in a DoubleClick conversion iframe (`prd=…`, `cost=…`,
     `ord=…`); no payment method is rendered.
   - **Macy's** — a label/value summary list (`Order number`, `Payment method`,
     `Order total`) plus `.collapsed-product-detail` product cards.
3. **"Implement `extract_order.js` with site detection plus a small adapter per
   site, doing money in integer cents."** — The assistant produced the module.
4. **"Run the test and fix whatever fails."** — The assistant iterated against
   the real Jest suite until all three cases passed.

The final design: a `detectSite()` function (using `<title>` first, then
distinctive DOM markers, because the test only sets `document.body.innerHTML`
so `<head>`/`<title>` is empty), three site adapters sharing generic helpers
(query helpers, entity decoding, query-string parsing, money parsing), and a
`buildOrder()` that derives `Tax = Grand Total − Subtotal − Shipping`.

## What I had to correct, verify, or reject

- **Rejected a "one-size-fits-all DOM selectors" approach.** The three pages
  store data in three different ways (iframe query string vs. conversion-pixel
  iframe vs. visible list markup). A generic selector approach could not pass
  all three cases, so I accepted a site-detection + adapter structure and kept
  shared logic in small helpers.
- **Corrected query-string parsing.** The assistant's first version stripped the
  string at the *first* `?`. Target's DoubleClick URL uses `;` as its separator
  and ends with a stray `?` inside `~oref=…?`, so that version discarded the
  entire payload (`prd`, `cost`, `ord`) and produced an empty `Products` array.
  I had the assistant split the whole string on `[&;]` and strip any URL
  path/query prefix from the key instead.
- **Corrected Macy's product scoping.** `.collapsed-product-detail` is a *single*
  wrapper; the three line items are its `.grid-x.small-margin-right-s` children.
  Scoping to `.collapsed-product-detail` alone returned only one product, making
  `Subtotal` `26.70` instead of `80.10`.
- **Verified the double-encoded trademark.** Target's product name arrives as
  `…Threshold&#8482;…` (the source is `&amp;#8482;`). `jsdom` decodes once, so a
  second decode was required to produce the literal `™` the test expects.
- **Derived values the page doesn't show.** `Tax` is never displayed on any of
  the three pages, and Target/Macy's don't show `Subtotal`. The assistant (and I)
  confirmed these are safe to derive: `Subtotal = Σ(unit price × qty)`, and
  `Tax = Grand Total − Subtotal` (shipping is `0` on all three). Money is
  computed in integer cents to avoid the classic `39.25 − 36.05 = 3.1999…` bug.
- **Derived "Store Card".** Macy's only shows `Macy's ************4618` — no
  explicit card type. The assistant mapped a retailer-branded card to
  `"Store Card"`, which matches the expected output. (A branded network logo
  such as `Visa` is still detected directly, as on Walmart.)
- **Formatting rules.** Confirmed against the test fixture: monetary fields are
  two-decimal strings (`"60.00"`, `"80.10"`), while `Shipping` and a zero `Tax`
  are `"0"` — not `"0.00"`.

## Verification

Final run of the suite:

```
PASS ./test.js
  #extractOrder - Walmart  ✓ should return complete Order object
  #extractOrder - Target   ✓ should return complete Order object
  #extractOrder - Macy's   ✓ should return complete Order object
```

(On this machine Jest's file watcher hits a local watchman/LaunchAgents
permission error, so I ran it with `CI=true npx jest --watchman=false`; this is
an environment issue, not a code issue.)

---

## Function call diagram

Call tree of `extract_order.js`: the entry point detects the site, dispatches to
a per-retailer adapter, and the adapters share generic helpers. Arrows show
callee → deeper callee.

```text
extract_order()  module.exports, entry point; dispatches the "order_details" event
│
├── detectSite() ────────────────► "walmart" | "target" | "macys" | "unknown"
│     └── query()                     DOM markers when <title> is empty
│
├── extractWalmart()               [site == "walmart"]
│     ├── queryAll()                     iframe srcs, img[alt]
│     ├── parseQueryString()             item_prices, item_quantities, order_id, cart_total, subtotal
│     ├── query()                        [data-testid="collapsedItemList"]
│     ├── decodeEntities()               product names from img alt
│     ├── toCents()                      via parseMoney() → integer cents
│     ├── makeProduct()                  via centsToMoney() → line item
│     ├── cardBrandFromText()            payment logo alt → "Visa"
│     └── buildOrder()                   assembles Order; Tax derived
│
├── extractTarget()                [site == "target"]
│     ├── queryAll()                     iframe srcs, img[class*="quantity-image"]
│     ├── parseQueryString()             ord, cost, prd
│     ├── parseTargetPrd()               "i1:…|p1:69.99|q1:1|…" → [{ i, p, q }, …]
│     ├── decodeEntities()               product names (double-encoded ™)
│     ├── makeProduct()
│     ├── findOrderNumberFromText()      fallback when ord is missing
│     └── buildOrder()
│
├── extractMacys()                 [site == "macys"]
│     ├── macysLabelValue() ×3           "Order number:", "Order total:", "Payment method:"
│     │     ├── queryAll()               li items
│     │     └── query()                  .list-label / .list-details
│     ├── queryAll()                     .collapsed-product-detail .grid-x.small-margin-right-s
│     ├── query()                        a[aria-label] / .price-reg
│     ├── decodeEntities()
│     ├── parseQueryString()             Quantity= from product href
│     ├── makeProduct()
│     ├── macysPaymentType()             via cardBrandFromText(); "Macy's …" → "Store Card"
│     └── buildOrder()
│
├── extractGeneric()               [site == "unknown"]  (best-effort fallback)
│     ├── findOrderNumberFromText()
│     ├── queryAll()                     img[alt] product names
│     ├── decodeEntities()
│     ├── makeProduct()
│     └── buildOrder()
│
└── (dispatch) document.dispatchEvent(new CustomEvent("order_details", { detail: order }))
```

Shared helpers used by more than one extractor:

| Helper | Purpose |
|---|---|
| `queryAll(selector, root)` | All elements matching a CSS selector |
| `query(selector, root)` | First element matching a CSS selector |
| `decodeEntities(str)` | HTML entity decode (handles double-encoded source) |
| `parseQueryString(str)` | Key/value parse of `&`- or `;`-separated params |
| `parseMoney(str)` | Currency string → Number |
| `toCents(value)` | Money → integer cents |
| `centsToMoney(cents)` | Integer cents → `"12.34"` |
| `cardBrandFromText(text)` | `"Visa"`, `"Mastercard"`, …, or `null` |
| `makeProduct(name, priceCents, qty)` | Builds one `Products[]` line item |
| `buildOrder(orderNumber, products, …)` | Assembles the Order object; derives Tax |

---

## Reusable workflow

A prompt/checklist you can hand to an AI (or follow yourself) for a *different*
e-commerce order-confirmation page.

### Skill
 ./skills/extract-order-details

### Prompt template

> You are extracting an Order object from a saved order-confirmation page. The
> target object shape is:
>
> ```json
> {
>   "Order Number": "",
>   "Products": [ { "Product Name": "", "Unit Price": "", "Quantity": "", "Line Total": "" } ],
>   "Shipping": "", "Subtotal": "", "Grand Total": "", "Tax": "", "Payment Type": null
> }
> ```
>
> Rules:
> - Monetary fields are two-decimal strings; `Shipping`/`Tax` are `"0"` when zero.
> - `Line Total = Unit Price × Quantity`; `Subtotal = Σ Line Total`.
> - If `Tax`/`Shipping`/`Subtotal` are not visible, derive them from the totals
>   that are present.
> - Do money arithmetic in integer cents (never float) to avoid rounding errors.
> - Do not assume a field is visible text — check iframes, tracking pixels,
>   JSON-LD/`__NEXT_DATA__`, data layers, and image `alt`s.
> - HTML-entity-decode text, and re-decode if the source looks double-encoded.
>
> Steps:
> 1. Load the page in a DOM and report, for each field, the exact element/URL
>    parameter that holds it (quote the source).
> 2. Detect the retailer (title or a distinctive `data-test*` marker).
> 3. Implement one small adapter per retailer; share generic helpers.
> 4. Run the test and iterate.

### Checklist

1. **Locate every field before coding.** For each of `Order Number`, each
   product (name/price/qty), `Shipping`, `Subtotal`, `Grand Total`, `Tax`,
   `Payment Type`, write down the source (element selector, attribute, iframe
   URL param, or "not shown → derive").
2. **Check non-text sources.** Order data frequently hides in: tracking/conversion
   iframes (`prd=`, `item_prices=`, `cost=`, `subtotal=`), `<script>` JSON
   (`application/ld+json`, `__NEXT_DATA__`), `data-layer` globals, and image
   `alt` attributes.
3. **Scope tightly.** Confirm the selector count matches the expected number of
   line items (this caught the Macy's single-wrapper/three-children bug).
4. **Handle entity encoding.** Saved pages often double-encode (`&amp;#8482;`).
   Decode once, then re-decode if `&…;` literals remain.
5. **Use integer cents** for all sums/derivations; format only at the end.
6. **Derive, don't guess, the missing totals.** Prefer `Grand Total − Subtotal`
   for tax and `Σ(price × qty)` for subtotal; only hard-code when the page is
   genuinely silent (e.g. free shipping → `"0"`, no payment info → `null`).
7. **Match the fixture's formatting exactly** (`"60.00"` vs `"0"`).
