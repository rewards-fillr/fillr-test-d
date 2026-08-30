## AI_USAGE.md

### Tool
Claude Code, Claude Sonnet 5, effort 4/6 (Extra High), extended thinking enabled.

### Schema I anchored the AI with

Written before any code, so the model couldn't invent or rename fields. This would
normally be its own `CLAUDE.md` file at the repo root, but the brief says not to create
new files other than this one, so it is inlined here:

```
Our task for this repo is to scrape order details from the html files in the orders/ directory in this repo
Now each partner has a different HTML layout so each of the 3 partners will need their own branch function

We need to edit extract_order.js so that it can
1. Detect what partners webpage we are on (e.g walmart, target or macys)
2. use that to select the correct branch function to parse the data

We need to scrape the following information into an object like this

{
    "Order Number": "string",
    "Products": [{
        "Product Name": "string",
        "Unit Price": "string",
        "Quantity": "string",
        "Line Total": "string" # quantity * unit price
    }],
    "Shipping": "string",
    "Subtotal": "string", # price before tax
    "Grand Total": "string", # price including tax
    "Tax": "string",
    "Payment Type": "string"
}

Our goal is for test.js to pass for the 3 partner order confirmation HTML pages
You can run the test ./test
```

### Approach
- Wrote the schema above first with the exact target Order object shape, to stop the model inventing or renaming fields.
- Worked one partner at a time (Walmart, then Target, then Macy's) instead of handing over all three HTML files together.
- Required a field location table (field, value, exact DOM/URL source) before any code was written, so ambiguous or absent fields surfaced before implementation, not after.
- Ran ./test scoped to the completed partner only, not the full suite, until that branch was solid.
- Approved, rejected, or amended each proposed field mapping before moving to the next partner.

### What I corrected, verified, or rejected

1. **Walmart shipping.** AI's first pass hardcoded "0" for shipping because the page showed "Free shipping." Rejected: free shipping is potentially coupon or promo driven, not universal to the partner. Directed it to regex a $ amount out of the shipping card first, falling back to "0" only when no price is present.

2. **Walmart quantity/price pairing.** AI flagged that the DOM's quantity badge (on item 4) disagreed with the tracking iframe's item_quantities array (which puts qty 2 on item 3). Didn't just take either source's word for it, checked the math myself: 7.96 + 8.97 + 5.72x2 + 7.68 = 36.05, which only works if item 3 is the double quantity, and that's exactly the iframe's subtotal. So the iframe is the one to trust; went with positional pairing (names in DOM order, prices/quantities in iframe-array order, zipped by index).

3. **Macy's quantity.** AI's first pass defaulted quantity to "1" per row, reasoning a repeated purchase would produce a repeated row/image. Rejected that assumption as fragile. Pushed it to regex Quantity=(\d+) out of the product link's query string instead, so a real qty>1 order in a single row would still parse correctly, not just this fixture's three qty-1 rows.

4. **Macy's payment type.** No literal "Store Card" string exists on the page, only "Macy's ************4618." Verified the proposed derivation (strip masked digits to get an issuer string, map a known Macy's-branded string to "Store Card," return anything else verbatim) generalizes to a non-Macy's card (e.g. "Visa ****1234" to "Visa") rather than accepting a hardcode scoped only to this fixture.

5. **Target subtotal.** Not printed anywhere on the page. Verified the AI's derivation (sum of line totals) against the schema's definition of subtotal as pre-tax total, and checked the arithmetic against test.js before accepting.

None of the corrections were code bugs. Selectors, URL parsing, and entity decoding logic were correct on first pass in all three branches. Every correction was a business logic judgement call: which source to trust when two disagree, and whether an absent field should be hardcoded or regex derived with a fallback. I had to make my best judgement calls here but in a professional setting I imagine I would have resources to confirm the correct answer.

### Reusable workflow

Packaged as its own file (the README's "or as its own file/folder" option), written in
Claude Code skill format: [skills/order-parser/SKILL.md](skills/order-parser/SKILL.md)

It would normally live at `.claude/skills/order-parser/` so Claude Code could load and
invoke it directly; it's kept under `skills/` here so it's visible in the submission
without a dotfile, but it's the same format and can be moved into `.claude/` as-is.

It encodes the process used for all three partners here: read the sample HTML, map every
value into the target schema, present the mapping and flag anything uncertain/derived/
hardcoded for confirmation *before* writing code, then follow the existing dispatcher/
branch-function pattern and verify against ./test. It also carries the two findings that
generalise beyond this page: per-item prices/quantities/subtotal frequently live only in a
tracking-iframe query string (Walmart tapframe, Target Floodlight) rather than the visible
DOM, and the house rules for fields that aren't printed (Subtotal = sum of line totals, Tax
= Grand Total − Subtotal − Shipping, etc.).

I then ran the finalised skill end to end against a fourth partner, "BrightMart"
([skills/order-parser/brightmart_order.html](skills/order-parser/brightmart_order.html), kept
as a repo file this time). It read the page, produced the full field-location table, and
handled the iframe pattern on its own: BrightMart's per-item prices and quantities live only
in the `px.brightmart-analytics.com` conversion-pixel query string
(`items=<sku>:<price>:<qty>,...`), not the visible DOM, and it verified the name-to-price
pairing by matching those SKUs against the DOM item labels and image filenames rather than
trusting tile order alone.

It stopped on two genuine decision points instead of guessing, surfacing both in the mapping
table and holding for confirmation before writing any parser code:

1. **Line items vs. printed subtotal.** The iframe line items sum to $121.49, but the page
   prints a Subtotal of $119.99 — a $1.50 gap with no discount line anywhere on the page
   (the rest of the breakdown, 119.99 + 5.99 + 9.60 = 135.58, is internally consistent).
2. **Order-number prefix.** The number renders as `BRM-100244871` in the visible DOM but
   `100244871` in the iframe, the canonical URL, and the page's own HTML comment; the
   existing three branches all return digits only.

As this is a fake partner I didn't add it into the extract_order method
