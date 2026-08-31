# Candidate Review Exercise

A ~10-minute code review exercise for testing a candidate's ability to spot
issues in AI-generated code, even when the tests pass.

## Running it with a candidate

1. Share `extract_order.js`, `test.js`, and `orders/walmart_order.html` with
   the candidate. **Do not share `ANSWER_KEY.md`.**
2. Prompt: "An AI assistant wrote this order extractor for a Walmart order
   confirmation page, and the test passes. Review it like you would a
   teammate's PR — what would you flag, even though it's green?"
3. Optionally let them run `npx jest review-exercise/test.js` to confirm it
   passes, then ask them to keep reviewing anyway.
4. Give ~10 minutes. See `ANSWER_KEY.md` for the planted issues and a scoring
   guide.
