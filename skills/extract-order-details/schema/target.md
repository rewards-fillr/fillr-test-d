# Target — Order Schema

Describes the `Order` object emitted by `extract_order.js` in the `order_details`
event `detail` for the Target confirmation page.

The regular expressions match the expected value format of each field. Aliases
list alternative names for the same field (common e-commerce synonyms, plus
site-specific names where applicable).

## Order fields

| Field | Alias | Value type | Description | Regular expression |
|---|---|---|---|---|
| `Order Number` | `Order ID`, `Order #`, `Reference ID`, `ord` | `string` | Unique order identifier, e.g. `"102003702233176"`. | `^\d+$` |
| `Products` | `Items`, `Line Items`, `Order Items` | `array<Product>` | One entry per purchased line item (2 items in the fixture). | `^\[.*\]$` |
| `Shipping` | `Shipping Cost`, `Shipping Fee`, `Delivery Fee` | `string` | Shipping charge as a string; `"0"` when free. | `^\d+(\.\d{2})?$` |
| `Subtotal` | `Sub Total`, `Items Subtotal` | `string` | Sum of all line totals, 2-decimal money, e.g. `"129.99"`. | `^\d+\.\d{2}$` |
| `Grand Total` | `Order Total`, `Total`, `Total Charged`, `cost` | `string` | Total charged incl. tax/shipping, 2-decimal money, e.g. `"129.99"`. | `^\d+\.\d{2}$` |
| `Tax` | `Sales Tax`, `Tax Amount`, `Estimated Tax` | `string` | Tax amount, 2-decimal money; `"0"` when zero. | `^(\d+\.\d{2}\|0)$` |
| `Payment Type` | `Payment Method`, `Card Type`, `Tender Type` | `string \| null` | `null` — no payment method is rendered on this page. | `^(Visa\|Mastercard\|Amex\|Discover\|PayPal\|Store Card\|null)$` |

## Product fields (`Products[]`)

| Field | Alias | Value type | Description | Regular expression |
|---|---|---|---|---|
| `Product Name` | `Item Name`, `Product Title`, `Title` | `string` | Human-readable product title, e.g. `"Large Chunky Weave Basket - Threshold™ designed with Studio McGee"`. | `^.+$` |
| `Unit Price` | `Price`, `Item Price`, `p` (prd param) | `string` | Price per unit, 2-decimal money, e.g. `"69.99"` or `"60.00"`. | `^\d+\.\d{2}$` |
| `Quantity` | `Qty`, `Count`, `q` (prd param) | `string` | Number of units as a string, e.g. `"1"`. | `^\d+$` |
| `Line Total` | `Item Total`, `Extended Price`, `Line Subtotal` | `string` | `Unit Price × Quantity`, 2-decimal money, e.g. `"69.99"`. | `^\d+\.\d{2}$` |

## Source notes

- **Order Number** — conversion iframe `ord` parameter (fallback: visible
  `"Order # …"` text).
- **Products** — names from filmstrip image `alt` attributes
  (`img[class*="quantity-image"]`); prices/quantities from the conversion iframe
  `prd` parameter (`iN:` id, `pN:` price, `qN:` quantity).
- **Grand Total** — conversion iframe `cost` parameter.
- **Subtotal** — derived: `Σ(Unit Price × Quantity)`.
- **Tax** — derived: `Grand Total − Subtotal − Shipping`.
- **Shipping** — free (`"0"`).
- **Payment Type** — `null` (not shown).
