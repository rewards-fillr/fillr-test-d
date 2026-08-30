# Macy's — Order Schema

Describes the `Order` object emitted by `extract_order.js` in the `order_details`
event `detail` for the Macy's confirmation page.

The regular expressions match the expected value format of each field. Aliases
list alternative names for the same field (common e-commerce synonyms, plus
site-specific names where applicable).

## Order fields

| Field | Alias | Value type | Description | Regular expression |
|---|---|---|---|---|
| `Order Number` | `Order ID`, `Order #`, `Reference ID`, `Order number:` | `string` | Unique order identifier, e.g. `"4784457221"`. | `^\d+$` |
| `Products` | `Items`, `Line Items`, `Order Items` | `array<Product>` | One entry per purchased line item (3 items in the fixture). | `^\[.*\]$` |
| `Shipping` | `Shipping Cost`, `Shipping Fee`, `Delivery Fee` | `string` | Shipping charge as a string; `"0"` when free. | `^\d+(\.\d{2})?$` |
| `Subtotal` | `Sub Total`, `Items Subtotal` | `string` | Sum of all line totals, 2-decimal money, e.g. `"80.10"`. | `^\d+\.\d{2}$` |
| `Grand Total` | `Order Total`, `Total`, `Total Charged`, `Order total:` | `string` | Total charged incl. tax/shipping, 2-decimal money, e.g. `"80.10"`. | `^\d+\.\d{2}$` |
| `Tax` | `Sales Tax`, `Tax Amount`, `Estimated Tax` | `string` | Tax amount, 2-decimal money; `"0"` when zero. | `^(\d+\.\d{2}\|0)$` |
| `Payment Type` | `Payment Method`, `Card Type`, `Tender Type`, `Payment method:` | `string \| null` | Card type; a retailer-branded card maps to `"Store Card"`. | `^(Visa\|Mastercard\|Amex\|Discover\|PayPal\|Store Card\|null)$` |

## Product fields (`Products[]`)

| Field | Alias | Value type | Description | Regular expression |
|---|---|---|---|---|
| `Product Name` | `Item Name`, `Product Title`, `Title`, `aria-label` | `string` | Human-readable product title, e.g. `"I.N.C. International Concepts Women's Sleeveless Cowl Neck Tank, Macy's Exclusive"`. | `^.+$` |
| `Unit Price` | `Price`, `Item Price`, `price-reg` | `string` | Price per unit, 2-decimal money, e.g. `"26.70"`. | `^\d+\.\d{2}$` |
| `Quantity` | `Qty`, `Count`, `Quantity` (href param) | `string` | Number of units as a string, e.g. `"1"`. | `^\d+$` |
| `Line Total` | `Item Total`, `Extended Price`, `Line Subtotal` | `string` | `Unit Price × Quantity`, 2-decimal money, e.g. `"26.70"`. | `^\d+\.\d{2}$` |

## Source notes

- **Order Number** — label/value pair `"Order number:"` in the order summary.
- **Products** — `.collapsed-product-detail` line-item cards: name from the
  product link `aria-label`, price from `.price-reg`, quantity from the link's
  `Quantity` query parameter.
- **Grand Total** — label/value pair `"Order total:"` (e.g. `"$80.10"`).
- **Subtotal** — derived: `Σ(Unit Price × Quantity)`.
- **Tax** — derived: `Grand Total − Subtotal − Shipping`.
- **Shipping** — free (`"0"`).
- **Payment Type** — derived from `"Payment method:"` text; `"Macy's …"` (the
  store's own branded card) maps to `"Store Card"`.
