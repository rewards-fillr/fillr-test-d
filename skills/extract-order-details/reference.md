# Reference — Retailer Source Maps & Parsing Gotchas

Field-source maps for the three retailers this skill was built against, plus a
deep dive on the parsing rules that keep the extractor correct.

## Walmart

Payload lives in a tracking iframe's query string; product names live in the
collapsed item list's image `alt`s.

| Field | Source |
|---|---|
| Order Number | iframe `order_id` param |
| Product names | `[data-testid="collapsedItemList"] img[alt]` (in DOM order) |
| Unit prices | iframe `item_prices` param (comma-separated) |
| Quantities | iframe `item_quantities` param (comma-separated) |
| Subtotal | iframe `subtotal` param |
| Grand Total | iframe `cart_total` param |
| Payment Type | wallet card logo `img[alt]` (e.g. `"Visa"`) |
| Tax / Shipping | derived; shipping is free (`"0"`) |

Iframe URL example:

```
https://tap.walmart.com/v1/tapframe?item_ids=371217523%2C391706535%2C857115210%2C295568187
  &item_prices=7.96%2C8.97%2C5.72%2C7.68
  &item_quantities=1%2C1%2C2%2C1
  &order_id=200012623519520
  &cart_total=39.25
  &subtotal=36.05
```

Zip names/prices/quantities by index. Note the quantity badge on a product
image can look like "2" while the real quantity is in `item_quantities` — and a
"quantity 2" inside a product *name* is part of the name, not the quantity.

## Target

Product names render as filmstrip image `alt`s; prices, quantities and the
grand total ride in a DoubleClick conversion iframe. No payment method is
rendered.

| Field | Source |
|---|---|
| Order Number | conversion iframe `ord` param (fallback: visible `Order # …` text) |
| Product names | `img[class*="quantity-image"]` `alt` (in DOM order) |
| Unit prices / quantities | conversion iframe `prd` param |
| Grand Total | conversion iframe `cost` param |
| Subtotal | derived: `Σ(Unit Price × Quantity)` |
| Payment Type | `null` (not shown) |
| Tax / Shipping | derived; shipping is free (`"0"`) |

`prd` format — pipe-separated, indexed fields:

```
prd=i1:92357131|p1:69.99|q1:1|i2:94685931|p2:60|q2:1
     ^id1  ^price1 ^qty1 ^id2  ^price2 ^qty2
```

Group segments by trailing index (`i`/`p`/`q` + number), sort by index.

The conversion URL is `;`-separated (no `?` query separator) and may end with a
stray `?`. Never split on `?` — split on `[&;]`.

## Macy's

Order summary is a label/value `<li>` list; products are cards inside a single
`.collapsed-product-detail` wrapper.

| Field | Source |
|---|---|
| Order Number | label `Order number:` value |
| Grand Total | label `Order total:` value (e.g. `$80.10`) |
| Payment Type | label `Payment method:` text (`Macy's …` → `"Store Card"`) |
| Product names | `a[aria-label]` (or `img[alt]`) in each card |
| Unit price | `.price-reg` span (e.g. `$26.70`) |
| Quantity | `Quantity=` param in the product link's `href` |
| Subtotal | derived: `Σ(Unit Price × Quantity)` |
| Tax / Shipping | derived; shipping is free (`"0"`) |

Product card selector: `.collapsed-product-detail .grid-x.small-margin-right-s`
— `.collapsed-product-detail` alone matches the *wrapper*, not the items.

## Parsing gotchas (deep dive)

**Double-encoded entities.** The source may contain `&amp;#8482;`. One HTML
decode (jsdom) turns it into the literal text `&#8482;`. Re-decode through a
temp element until stable:

```js
function decodeEntities(str) {
  const el = document.createElement("div");
  let value = String(str);
  for (let i = 0; i < 3; i++) {
    el.innerHTML = value;
    const next = el.textContent || "";
    if (next === value) break;
    value = next;
  }
  return value.trim();
}
```

**Float money.** `39.25 − 36.05 === 3.1999999999999993`. Round to cents:

```js
const cents = Math.round(parseFloat(s) * 100);   // parse, strip $ and commas
const money = (cents / 100).toFixed(2);           // "3.20"
```

**Query-string parsing.** Accept both separators and tolerate URL prefixes:

```js
for (const pair of str.split(/[&;]/)) {
  const idx = pair.indexOf("=");
  if (idx <= 0) continue;
  const key = pair.slice(0, idx).replace(/^.*[/?]/, ""); // strip "…/tapframe?item_ids"
  let val = pair.slice(idx + 1);
  try { val = decodeURIComponent(val); } catch (e) { /* keep raw */ }
  out[key] = val;
}
```

**Site detection when `<title>` is empty.** Test harnesses often set only
`document.body.innerHTML`, so fall back to markers: Walmart
`[data-testid="od-summary"]`, Target `[data-test="order-confirmation-container"]`,
Macy's `.collapsed-product-detail`.

**Selectors that look right but are wrong.** Verify counts: 4 Walmart products
→ 4 name images; 2 Target products → 2 quantity images; 3 Macy's products → 3
cards. If the count is 1, you matched a wrapper, not the items.
