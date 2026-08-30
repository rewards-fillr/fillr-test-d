# Walmart — Order Schema

Describes the `Order` object emitted by `extract_order.js` in the `order_details`
event `detail` for the Walmart confirmation page.

The regular expressions match the expected value format of each field. Aliases
list alternative names for the same field (common e-commerce synonyms, plus
site-specific names where applicable).

## Order fields

| Field | Alias | Value type | Description | Regular expression |
|---|---|---|---|---|
| `Order Number` | `Order ID`, `Order #`, `Reference ID`, `order_id` | `string` | Unique order identifier, e.g. `"200012623519520"`. | `^\d+$` |
| `Products` | `Items`, `Line Items`, `Order Items` | `array<Product>` | One entry per purchased line item (4 items in the fixture). | `^\[.*\]$` |
| `Shipping` | `Shipping Cost`, `Shipping Fee`, `Delivery Fee` | `string` | Shipping charge as a string; `"0"` when free. | `^\d+(\.\d{2})?$` |
| `Subtotal` | `Sub Total`, `Items Subtotal`, `subtotal` | `string` | Sum of all line totals, 2-decimal money, e.g. `"36.05"`. | `^\d+\.\d{2}$` |
| `Grand Total` | `Order Total`, `Total`, `Total Charged`, `cart_total` | `string` | Total charged incl. tax/shipping, 2-decimal money, e.g. `"39.25"`. | `^\d+\.\d{2}$` |
| `Tax` | `Sales Tax`, `Tax Amount`, `Estimated Tax` | `string` | Tax amount, 2-decimal money; `"0"` when zero, e.g. `"3.20"`. | `^(\d+\.\d{2}\|0)$` |
| `Payment Type` | `Payment Method`, `Card Type`, `Tender Type` | `string \| null` | Card network name from the wallet logo alt, e.g. `"Visa"`. | `^(Visa\|Mastercard\|Amex\|Discover\|PayPal\|Store Card\|null)$` |

## Product fields (`Products[]`)

| Field | Alias | Value type | Description | Regular expression |
|---|---|---|---|---|
| `Product Name` | `Item Name`, `Product Title`, `Title` | `string` | Human-readable product title, e.g. `"Colgate Max Fresh Knockout Whitening Toothpaste, Mint Fusion, 6.3 oz, 3 Pack"`. | `^.+$` |
| `Unit Price` | `Price`, `Item Price`, `item_prices` | `string` | Price per unit, 2-decimal money, e.g. `"7.96"`. | `^\d+\.\d{2}$` |
| `Quantity` | `Qty`, `Count`, `item_quantities` | `string` | Number of units as a string, e.g. `"1"`. | `^\d+$` |
| `Line Total` | `Item Total`, `Extended Price`, `Line Subtotal` | `string` | `Unit Price × Quantity`, 2-decimal money, e.g. `"7.96"`. | `^\d+\.\d{2}$` |

## Source notes

- **Order Number** — tracking iframe `order_id` query parameter.
- **Products** — names from image `alt` attributes in the collapsed item list;
  prices/quantities from the iframe `item_prices` / `item_quantities` parameters.
- **Subtotal / Grand Total** — iframe `subtotal` / `cart_total` parameters.
- **Tax** — derived: `Grand Total − Subtotal − Shipping`.
- **Shipping** — free (`"0"`), per the "Free shipping" text.
- **Payment Type** — wallet card logo image `alt` (e.g. `"Visa"`).
