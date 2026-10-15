// Provider/stock unit suites use approved, zero-fee QA pricing to isolate their existing
// scenarios. checkout-pricing.test.cjs and HTTP/MongoDB suites verify the real quote boundary.
const sourceLoader = require('./load-source.cjs');
const load = sourceLoader({ '@/libs/prismadb': { __esModule: true, default: {} } });
const actual = load('libs/checkoutQuote.ts');
const { calculateCheckoutTotals, DEMO_SHIPPING_POLICY } = load('utils/checkoutTotals.ts');
module.exports = {
  ...actual,
  verifyCheckoutQuote(_token, _userId, cart, delivery) {
    return { fingerprint: actual.checkoutFingerprint(cart, delivery), expiresAt: new Date(Date.now() + 600000).toISOString(),
      totals: calculateCheckoutTotals(cart.items, { ...DEMO_SHIPPING_POLICY, fee: 0 }, new Date('2026-10-15T00:00:00Z')) };
  },
  validateNewCheckoutQuote: async () => {},
};
module.exports.withFee = fee => ({ ...module.exports, verifyCheckoutQuote(_token, _userId, cart, delivery) {
  return { fingerprint: actual.checkoutFingerprint(cart, delivery), expiresAt: new Date(Date.now() + 600000).toISOString(),
    totals: calculateCheckoutTotals(cart.items, { ...DEMO_SHIPPING_POLICY, fee, freeShippingThreshold: null }, new Date('2026-10-15T00:00:00Z')) };
} });
