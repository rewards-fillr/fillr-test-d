const fs = require("fs");
const path = require("path");
const extractOrder = require("./extract_order.js");

describe("#extractOrder - Walmart", () => {
  let result;

  beforeEach((done) => {
    document.body.innerHTML = fs.readFileSync(
      path.join(__dirname, "orders", "walmart_order.html"),
      "utf-8"
    );

    document.addEventListener(
      "order_details",
      (event) => {
        result = event.detail;
        done();
      },
      { once: true }
    );

    extractOrder();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("should return complete Order object", () => {
    expect(result).toEqual({
      "Order Number": "200012623519520",
      Products: [
        {
          "Product Name":
            "Colgate Max Fresh Knockout Whitening Toothpaste, Mint Fusion, 6.3 oz, 3 Pack",
          "Unit Price": "7.96",
          Quantity: "1",
          "Line Total": "7.96",
        },
        {
          "Product Name":
            "Johnson's Moisturizing Pink Baby Body Lotion with Coconut Oil, 27.1 oz",
          "Unit Price": "8.97",
          Quantity: "1",
          "Line Total": "8.97",
        },
        {
          "Product Name":
            "Crest Premium Plus Scope Outlast Toothpaste, Long Lasting Mint Flavor, 5.2 oz, 3 Pack",
          "Unit Price": "5.72",
          Quantity: "2",
          "Line Total": "11.44",
        },
        {
          "Product Name":
            "Clorox Splash-Less Liquid Bleach Cleaner, Fresh Meadow Scent, 77 fl oz, quantity 2",
          "Unit Price": "7.68",
          Quantity: "1",
          "Line Total": "7.68",
        },
      ],
      Shipping: "0",
      Subtotal: "36.05",
      "Grand Total": "39.25",
      Tax: "3.20",
      "Payment Type": "Visa",
    });
  });
});
