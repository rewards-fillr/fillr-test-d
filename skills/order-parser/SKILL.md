---
name: order-parser
description: Add HTML order-extraction support for a new partner site. Use when given a sample HTML file from an unfamiliar partner and asked to extract order data from it.
---

# Adding a new partner order parser

## Process
1. Read the sample HTML file. If none is provided, ask for one order confirmation page before doing anything else.
2. Inspect the DOM and find where each schema field lives, including the repeating product block.
   - Per-item prices, quantities, and the subtotal are often **not in the visible DOM at all** — they live only in the query string of a tracking/analytics iframe. All three existing partners work this way: Walmart's `tap.walmart.com/v1/tapframe` (`item_prices`, `item_quantities`, `subtotal`, `cart_total`), Target's Google Floodlight iframe (`prd=i1:<sku>|p1:<price>|q1:<qty>|...`, `cost=<grand total>`), and the fictional BrightMart example (`items=<sku>:<price>:<qty>,...`). Grep the raw HTML for `<iframe` and for numbers you already know (a visible price, the order total) before concluding a field is absent.
   - When names come from the DOM but prices/quantities come from an iframe array, pair them **positionally by index** — the array order matches the product-tile order, and a per-item DOM badge may disagree (it did on Walmart). Sanity-check with arithmetic: Σ(unit price × qty) should equal the subtotal.
3. Use the schema in AI_USAGE.md's "Schema I anchored the AI with" section as the target shape — don't copy it elsewhere, don't invent your own version.
4. For any field that isn't printed directly on the page, apply the established rule from "Derivations" below — don't invent a new one.
5. **Show the user the proposed field mapping and wait for confirmation** — see "Confirm before writing code". Don't write parser code until the mapping is agreed.
6. Look at extract_order.js and copy the existing pattern — function signature, error handling, how detection/dispatch works for walmart/target/macys.
7. Write the new parser as its own branch function, matching the naming convention of the existing three.
8. Register it in the dispatcher using a stable detection signal (domain reference, class name, title pattern) — same approach as the existing three.
9. Add a test case using the sample HTML.
10. Run ./test and make sure the existing three parsers still pass.

## Confirm before writing code
- Show the user the proposed field mapping (Order Number, Products, Shipping, Subtotal, Grand Total, Tax, Payment Type) before writing any parser code.
- Call out anything uncertain: fields you couldn't find, fields with hard coded values, fields with multiple possible matches, computed/derived fields where the source isn't a direct mapping (see "Derivations" for the established rules).
- Wait for the user to confirm or correct the mapping before proceeding.
- If the site-detection signal is shaky, flag that too before wiring it into the dispatcher.

## Derivations (when a field isn't printed on the page)

These are the conventions all three existing branches already follow. Reuse them so a new partner stays consistent with the others — and still flag each derived field to the user rather than slipping it in silently.

- **Line Total** — always computed, never read: `quantity × unit price`, formatted like every other money value.
- **Subtotal** — if not shown anywhere, it's the sum of the product line totals. This matches the schema's definition of subtotal as the pre-tax total.
- **Tax** — if not shown, derive it: `Grand Total − Subtotal − Shipping`.
- **Shipping** — if only promo text ("Free shipping") or policy links appear with no amount, use `"0"`. If a real charge could render in that same spot, regex a `$` amount out first and fall back to `"0"` (see `walmartShipping()`).
- **Payment Type** — if nothing is on the page, `null`. If only a masked string shows ("Macy's ••••4618"), strip the mask to the issuer, map a known store-card brand to `"Store Card"`, otherwise return the issuer verbatim.
- **Money formatting** — 2 decimal places, except an exact zero collapses to the bare string `"0"`. Round to cents before the zero check so floating-point residue still reads as `"0"`.

## Notes
- Don't change the shared schema to fit one partner's quirks. Map into what's there, or flag it to the user if a field genuinely doesn't exist yet.
- If the HTML is JS-rendered with no data in the raw source, say so immediately — the current parsers assume static HTML and this partner might need a different approach entirely.
