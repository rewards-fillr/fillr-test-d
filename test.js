const fs = require("fs");
const path = require("path");
const Order = require("./extract_order.js");

const testCases = [
  {
    site: "Walmart",
    file: "walmart_order.html",
    expected: {
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
    },
  },
  {
    site: "Target",
    file: "target_order.html",
    expected: {
      "Order Number": "102003702233176",
      Products: [
        {
          "Product Name":
            "Large Chunky Weave Basket - Threshold™ designed with Studio McGee",
          "Unit Price": "69.99",
          Quantity: "1",
          "Line Total": "69.99",
        },
        {
          "Product Name":
            "Brightech Leaf Modern Dimmable Integrated LED Swing Arm Arc Floor Lamp Antiqued Brass: Swingarm, 3-Way Touch Sensor, UL Listed",
          "Unit Price": "60.00",
          Quantity: "1",
          "Line Total": "60.00",
        },
      ],
      Shipping: "0",
      Subtotal: "129.99",
      "Grand Total": "129.99",
      Tax: "0",
      "Payment Type": null,
    },
  },
  {
    site: "Macy's",
    file: "macys_order.html",
    expected: {
      "Order Number": "4784457221",
      Products: [
        {
          "Product Name":
            "I.N.C. International Concepts Women's Sleeveless Cowl Neck Tank, Macy's Exclusive",
          "Unit Price": "26.70",
          Quantity: "1",
          "Line Total": "26.70",
        },
        {
          "Product Name":
            "I.N.C. International Concepts Women's Sleeveless Cowl Neck Tank, Macy's Exclusive",
          "Unit Price": "26.70",
          Quantity: "1",
          "Line Total": "26.70",
        },
        {
          "Product Name":
            "I.N.C. International Concepts Women's Sleeveless Cowl Neck Tank, Macy's Exclusive",
          "Unit Price": "26.70",
          Quantity: "1",
          "Line Total": "26.70",
        },
      ],
      Shipping: "0",
      Subtotal: "80.10",
      "Grand Total": "80.10",
      Tax: "0",
      "Payment Type": "Store Card",
    },
  },
];

testCases.forEach(({ site, file, expected }) => {
  describe(`#extractOrder - ${site}`, () => {
    let result;

    beforeEach((done) => {
      document.body.innerHTML = fs.readFileSync(
        path.join(__dirname, "orders", file),
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

      Order();
    });

    afterEach(() => {
      document.body.innerHTML = "";
    });

    test("should return complete Order object", () => {
      expect(result).toEqual(expected);
    });
  });
});
