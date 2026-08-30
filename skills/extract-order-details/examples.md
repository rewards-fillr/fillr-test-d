# Examples — Worked Orders

Three worked examples extracted from real confirmation pages, showing the
expected Order object for each retailer.

## Example 1: Walmart

Sources: tracking iframe query string + `alt` texts in the collapsed item list.

```json
{
  "Order Number": "200012623519520",
  "Products": [
    { "Product Name": "Colgate Max Fresh Knockout Whitening Toothpaste, Mint Fusion, 6.3 oz, 3 Pack", "Unit Price": "7.96", "Quantity": "1", "Line Total": "7.96" },
    { "Product Name": "Johnson's Moisturizing Pink Baby Body Lotion with Coconut Oil, 27.1 oz", "Unit Price": "8.97", "Quantity": "1", "Line Total": "8.97" },
    { "Product Name": "Crest Premium Plus Scope Outlast Toothpaste, Long Lasting Mint Flavor, 5.2 oz, 3 Pack", "Unit Price": "5.72", "Quantity": "2", "Line Total": "11.44" },
    { "Product Name": "Clorox Splash-Less Liquid Bleach Cleaner, Fresh Meadow Scent, 77 fl oz, quantity 2", "Unit Price": "7.68", "Quantity": "1", "Line Total": "7.68" }
  ],
  "Shipping": "0",
  "Subtotal": "36.05",
  "Grand Total": "39.25",
  "Tax": "3.20",
  "Payment Type": "Visa"
}
```

Notes:
- `Tax = 39.25 − 36.05 − 0 = 3.20` (derived, in cents).
- "quantity 2" in the Clorox name is part of the name; real quantity is 1.
- `Payment Type` comes from the wallet logo `alt="Visa"`.

## Example 2: Target

Sources: filmstrip image `alt`s + DoubleClick conversion iframe
(`prd=`, `cost=`, `ord=`).

```json
{
  "Order Number": "102003702233176",
  "Products": [
    { "Product Name": "Large Chunky Weave Basket - Threshold™ designed with Studio McGee", "Unit Price": "69.99", "Quantity": "1", "Line Total": "69.99" },
    { "Product Name": "Brightech Leaf Modern Dimmable Integrated LED Swing Arm Arc Floor Lamp Antiqued Brass: Swingarm, 3-Way Touch Sensor, UL Listed", "Unit Price": "60.00", "Quantity": "1", "Line Total": "60.00" }
  ],
  "Shipping": "0",
  "Subtotal": "129.99",
  "Grand Total": "129.99",
  "Tax": "0",
  "Payment Type": null
}
```

Notes:
- `prd=i1:92357131|p1:69.99|q1:1|i2:94685931|p2:60|q2:1` → prices `69.99`,
  `60` (formatted `"60.00"`), quantities `1`, `1`.
- `Threshold™` arrives as `Threshold&#8482;` — needs the second entity decode.
- The conversion URL is `;`-separated and ends with a stray `?` — split on
  `[&;]`, never on `?`.
- No payment method rendered → `Payment Type: null`.

## Example 3: Macy's

Sources: label/value summary list + `.collapsed-product-detail` product cards.

```json
{
  "Order Number": "4784457221",
  "Products": [
    { "Product Name": "I.N.C. International Concepts Women's Sleeveless Cowl Neck Tank, Macy's Exclusive", "Unit Price": "26.70", "Quantity": "1", "Line Total": "26.70" },
    { "Product Name": "I.N.C. International Concepts Women's Sleeveless Cowl Neck Tank, Macy's Exclusive", "Unit Price": "26.70", "Quantity": "1", "Line Total": "26.70" },
    { "Product Name": "I.N.C. International Concepts Women's Sleeveless Cowl Neck Tank, Macy's Exclusive", "Unit Price": "26.70", "Quantity": "1", "Line Total": "26.70" }
  ],
  "Shipping": "0",
  "Subtotal": "80.10",
  "Grand Total": "80.10",
  "Tax": "0",
  "Payment Type": "Store Card"
}
```

Notes:
- Three separate line items (different colors/upc) with the same name.
- Products are the `.grid-x.small-margin-right-s` children of the single
  `.collapsed-product-detail` wrapper.
- `Payment method: Macy's ************4618` — the store's own branded card maps
  to `"Store Card"`.
- `Tax = 80.10 − 80.10 = 0` → `"0"`.
