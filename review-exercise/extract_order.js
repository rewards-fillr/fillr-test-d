"use strict";

/**
 * Extracts order details from a Walmart order confirmation page and emits
 * the result as a CustomEvent named "order_details".
 */
function extractOrder() {
  try {
    const iframe = document.querySelector("iframe");
    const src = iframe ? iframe.getAttribute("src") || "" : "";
    const params = {};
    src
      .replace(/^[^?]*\?/, "")
      .split("&")
      .forEach((pair) => {
        const [key, val] = pair.split("=");
        if (key) params[key] = decodeURIComponent(val || "");
      });

    const prices = (params.item_prices || "").split(",").map(parseFloat);
    const quantities = (params.item_quantities || "")
      .split(",")
      .map((q) => parseInt(q, 10));

    // Product thumbnails have long, descriptive alt text; nav/promo icons
    // on this page use short alt text, so filtering by length picks out
    // just the product images.
    const nameImgs = Array.from(document.querySelectorAll("img[alt]")).filter(
      (img) => (img.getAttribute("alt") || "").length > 25
    );

    let subtotal = 0;
    const products = prices.map((price, i) => {
      const qty = quantities[i];
      const lineTotal = price * qty;
      subtotal += lineTotal;
      return {
        "Product Name": nameImgs[i].getAttribute("alt"),
        "Unit Price": price.toFixed(2),
        Quantity: String(qty),
        "Line Total": lineTotal.toFixed(2),
      };
    });

    // The payment network is shown as a small logo elsewhere on the page;
    // its alt text names the network directly (e.g. "Visa").
    const brands = ["Visa", "Mastercard", "Amex", "Discover", "PayPal"];
    let paymentType = null;
    for (const img of document.querySelectorAll("img[alt]")) {
      const alt = img.getAttribute("alt") || "";
      const match = brands.find((b) => alt.indexOf(b) !== -1);
      if (match) {
        paymentType = match;
        break;
      }
    }

    const grandTotal = parseFloat(params.cart_total);

    const order = {
      "Order Number": params.order_id,
      Products: products,
      Shipping: "0",
      Subtotal: subtotal.toFixed(2),
      "Grand Total": grandTotal.toFixed(2),
      Tax: (grandTotal - subtotal).toFixed(2),
      "Payment Type": paymentType,
    };

    document.dispatchEvent(new CustomEvent("order_details", { detail: order }));
  } catch (e) {
    document.dispatchEvent(new CustomEvent("order_details", { detail: null }));
  }
}

module.exports = extractOrder;
