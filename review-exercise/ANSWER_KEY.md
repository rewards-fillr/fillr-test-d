# Review Exercise — Answer Key (interviewer only)

Give the candidate `extract_order.js`, `test.js`, and `orders/walmart_order.html`
only. Tell them: "An AI assistant wrote this order extractor and the test
passes. Review it as if you were reviewing a teammate's PR — what's wrong or
risky, even though the test is green?" Budget ~10 minutes.

Everything in this file is genuinely parsed from the page (no hardcoded
answers) — the test passes because the fixture's specific shape happens not
to trigger any of the underlying problems. A strong candidate should flag
several of these without needing to run anything.

## Planted issues, ranked by severity

1. **`nameImgs` selection is a heuristic, not a real selector (line ~26).**
   Filtering all `img[alt]` on the page by `alt.length > 25` to "find the
   products" is guesswork — there's no scoping to the actual item-list
   container (e.g. `[data-testid="collapsedItemList"]`). It happens to work
   here because this page's product names are all long and everything else
   (nav icons, "Walmart+", "decorative image") is short. A product with a
   short name, or a promo banner with long alt text, would silently shift
   the array and pair the wrong name with the wrong price/qty — no crash,
   just wrong data. This is the most important thing to catch: it's the
   difference between "parses this page" and "parses Walmart pages."

2. **No bounds/null check before `nameImgs[i].getAttribute(...)` (line ~34).**
   If `nameImgs` ever has fewer entries than `prices` (a product image fails
   to load, the length filter above misses one, page markup changes), this
   throws a `TypeError` reading `.getAttribute` off `undefined`.

3. **The `catch` block swallows everything into a silent `null` (lines
   ~71-73).** No `console.error`, no indication of *why* extraction failed.
   Combined with #2, a single malformed page produces a silent `null`
   payload in production with zero diagnostic trail — nothing in logs to
   act on.

4. **`Tax` is derived with plain floating-point subtraction (line ~61):**
   `(grandTotal - subtotal).toFixed(2)`. It comes out clean on this fixture's
   numbers, but this is the classic float-drift trap (`0.1 + 0.2 !== 0.3`) —
   safer to do the whole computation in integer cents and only format at the
   end. Same risk applies to `lineTotal = price * qty` accumulating into
   `subtotal` (line ~40).

5. **Payment-brand matching scans every `img[alt]` on the page for a
   substring match (lines ~46-54)**, not just the payment-method section.
   Any nav/promo image whose alt text happens to contain "Visa", "Amex",
   etc. (a "Visa waitlist" banner, an unrelated affiliate badge) would be
   matched first and reported as the payment type, since the code takes the
   *first* match anywhere on the page. It works today because the payment
   logo happens to be the only "brand-shaped" alt text present.

6. **HTML entities are never decoded.** Product names come straight from
   `alt` attributes. This fixture's names are plain ASCII, but a title with
   `&amp;`, `&#8482;` (™), etc. would come through un-decoded. Not exercised
   by this test, but worth asking "what if a product name has a special
   character?"

7. **`params.order_id` and `params.cart_total` are used with no presence
   check.** If the iframe is missing or its query string doesn't include
   these keys (e.g. a slightly different tracking payload), `order_id`
   becomes `undefined` and `cart_total` becomes `NaN` — and `NaN.toFixed(2)`
   is `"NaN"`, which would silently ship as the Grand Total.

## What a good candidate should say (in order of importance)

- "The product-name matching is based on alt-text *length*, not a real
  selector — that's fragile and I'd want it scoped to the actual item list."
- "There's no bounds check before indexing into `nameImgs`, and the catch
  block hides the failure instead of surfacing it — hard to debug in prod."
- "The payment-type match scans the whole page for a brand name substring,
  not just the payment section — that could false-positive on an unrelated
  image."
- Bonus points: naming the float-precision risk on Tax/subtotal, the missing
  entity decoding, or the unchecked `order_id`/`cart_total` presence.

## Scoring guide

- **Strong (catches 3+, including #1):** ready to review AI-generated code
  independently.
- **Adequate (catches 1-2):** can review with guidance.
- **Weak (catches 0, or says "looks fine, tests pass"):** relies on tests
  alone and doesn't read code critically — a real concern given this role
  involves reviewing AI-assisted submissions.
