const test = require('node:test');
const assert = require('node:assert/strict');
const sourceLoader = require('./fixtures/load-source.cjs');
const { matches } = require('./fixtures/stock-db.cjs');
const { hookRuntime, findElement } = require('./fixtures/react-hooks.cjs');
const id = 'a'.repeat(24), variantId = 'b'.repeat(24);
const image = { color: 'Black', colorCode: '#000000', image: '/products/phone.webp' };
const item = { id, variantId, name: 'Saved phone', price: 10000, quantity: 2, selectedImg: image, description: '', category: '', brand: '' };
function fixture() {
  const state = { reads: 0, user: { id: 'owner' }, offline: false };
  const variant = { id: variantId, productId: id, sku: 'PHONE-8', price: 10000, currency: 'vnd', image, inStock: true, isActive: true,
    inventory: { onHand: 10, reserved: 1, version: 1, updatedAt: new Date() },
    product: { name: 'Current phone', description: 'Description', status: 'ACTIVE', category: { name: 'Phones', isVisible: true }, brand: { name: 'Brand', isVisible: true } } };
  const variants = [variant];
  const db = { productVariant: { findMany: async ({ where, take }) => { state.reads++; if (state.offline) throw new Error('private-database-secret'); return variants.filter(row => matches(row, where)).slice(0, take); } } };
  const load = sourceLoader({ '@/libs/prismadb': { __esModule: true, default: db }, '@/actions/getCurrentUser': { getCurrentUser: async () => state.user }, 'next/server': { NextResponse: { json: Response.json } } });
  const review = load('libs/reviewCart.ts').reviewCart;
  return { state, variant, variants, review, checkout: load('libs/orderItems.ts').getOrderItems,
    quote: body => load('app/api/cart/quote/route.ts').POST(new Request('http://localhost/api/cart/quote', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })) };
}

test('cart review isolates unavailable and malformed rows while preserving every requested line', async () => {
  const f = fixture();
  const input = [item, { ...item, id: 'c'.repeat(24) }, null, { ...item, quantity: 0 }];
  const before = structuredClone(input);
  const result = await f.review(input);
  assert.deepEqual(result.lines.map(line => line.issues), [[], ['UNAVAILABLE'], ['INVALID_ITEM'], ['INVALID_ITEM']]);
  assert.equal(result.lines[0].current.name, 'Current phone');
  assert.equal(result.canCheckout, false);
  assert.equal(result.amount, null);
  assert.deepEqual(input, before);
});

test('legacy options remain ambiguous even when only one matching configuration has stock', async () => {
  const f = fixture();
  f.variants.push({ ...f.variant, id: 'c'.repeat(24), inStock: false });
  const legacy = { ...item }; delete legacy.variantId;
  assert.deepEqual((await f.review([legacy])).lines[0].issues, ['OPTION_REQUIRED']);
  await assert.rejects(f.checkout([legacy]), error => error.code === 'SKU_UNAVAILABLE');
  f.variants[1].isActive = false;
  assert.deepEqual((await f.review([legacy])).lines[0].issues, ['OPTION_REQUIRED']);
  await assert.rejects(f.checkout([legacy]), error => error.code === 'SKU_UNAVAILABLE');
  assert.equal((await f.review([item])).canCheckout, true);
});

test('price and available quantity changes are proposals until explicitly accepted and rechecked', async () => {
  const f = fixture();
  f.variant.price = 12000;
  f.variant.inventory = { ...f.variant.inventory, onHand: 3, reserved: 2 };
  const result = await f.review([item]);
  assert.deepEqual(result.lines[0].issues, ['QUANTITY_REDUCED', 'PRICE_CHANGED']);
  assert.equal(result.lines[0].current.quantity, 1);
  assert.equal(item.quantity, 2);
  const accepted = await f.review([result.lines[0].current]);
  assert.equal(accepted.canCheckout, true);
  assert.equal(accepted.amount, 12000);
  assert.equal(f.variant.inventory.reserved, 2); // A review never reserves units.
});

test('hidden, uncounted, out-of-stock and duplicated options cannot proceed or leak balances', async () => {
  const f = fixture();
  for (const hide of [() => { f.variant.isActive = false; }, () => { f.variant.product.category.isVisible = false; }, () => { f.variant.product.brand.isVisible = false; }, () => { f.variant.product.status = 'ARCHIVED'; }]) {
    const fresh = structuredClone(f.variant); hide();
    assert.deepEqual((await f.review([item])).lines[0].issues, ['UNAVAILABLE']);
    Object.assign(f.variant, fresh);
  }
  f.variant.inventory.reserved = f.variant.inventory.onHand;
  assert.deepEqual((await f.review([item])).lines[0].issues, ['OUT_OF_STOCK']);
  f.variant.inventory = null;
  assert.deepEqual((await f.review([item])).lines[0].issues, ['STOCK_NOT_COUNTED']);
  f.variant.inventory = { onHand: 5, reserved: 0, version: 1, updatedAt: new Date() };
  const legacy = { ...item }; delete legacy.variantId;
  const result = await f.review([item, legacy]);
  assert.ok(result.lines.every(line => line.issues.includes('DUPLICATE_ITEM')));
  assert.doesNotMatch(JSON.stringify(result), /onHand|reserved|inventory|version|updatedAt/);
});

test('quote authenticates first, bounds requests and returns a sanitized retryable outage', async () => {
  const f = fixture(); f.state.user = null;
  assert.equal((await f.quote({ items: [item] })).status, 401);
  assert.equal(f.state.reads, 0);
  f.state.user = { id: 'owner' };
  for (const body of ['{', {}, { items: [] }, { items: Array(51).fill(item) }]) assert.equal((await f.quote(body)).status, 400);
  assert.equal(f.state.reads, 0);
  const success = await f.quote({ items: [item], amount: 1 });
  assert.equal(success.headers.get('cache-control'), 'private, no-store');
  assert.equal((await success.json()).amount, 20000);
  f.state.offline = true;
  const outage = await f.quote({ items: [item] });
  assert.equal(outage.status, 503);
  assert.doesNotMatch(await outage.text(), /private-database-secret/);
});

test('versioned cache recovers legacy rows without guessing SKU and marks invalid or future data for reselection', () => {
  const cache = sourceLoader()('utils/cartCache.ts');
  assert.deepEqual(cache.decodeCartCache(cache.encodeCartCache([item])).items, [item]);
  const legacy = { ...item }; delete legacy.variantId;
  const recovered = cache.decodeCartCache(JSON.stringify([legacy, null, { ...item, quantity: '2' }]));
  assert.equal(recovered.items.length, 3);
  assert.equal(recovered.items[0].variantId, undefined);
  assert.equal(recovered.items[1].needsSelection, true);
  assert.equal(recovered.items[2].needsSelection, true);
  assert.equal(cache.decodeCartCache(JSON.stringify({ version: 99, items: [item] })).items[0].needsSelection, true);
  assert.match(cache.decodeCartCache('{').message, /could not be read/);
  assert.equal(cache.decodeCartCache(JSON.stringify([{ ...item, selectedImg: { ...image, image: 'javascript:alert(1)' } }])).items[0].selectedImg.image, '');
});

test('cart hydration keeps items when the payment cache is broken; stale replacements and duplicate removals are safe', async () => {
  const h = hookRuntime();
  const previous = global.localStorage;
  const memory = new Map([['CartItems', JSON.stringify([item, { ...item }])], ['savedPaymentIntent', '{']]);
  global.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  const load = sourceLoader({ react: h.react, 'react-hot-toast': { __esModule: true, default: { error() {}, success() {} } } });
  const Provider = load('app/hooks/useCart.tsx').CartContextProvider;
  const render = () => h.render(Provider, {}).props.value;
  try {
    render(); await h.flush();
    let context = render();
    assert.equal(context.cartProducts.length, 2);
    assert.equal(context.paymentIntent, null);
    const snapshot = JSON.stringify(context.cartProducts);
    context.handleRemoveProductFromCart(context.cartProducts[0]);
    context = render();
    assert.equal(context.cartProducts.length, 1);
    assert.equal(context.handleReplaceCart([], snapshot), false);
    assert.equal(render().cartProducts.length, 1);
    assert.equal(JSON.parse(memory.get('CartItems')).version, 1);
    global.localStorage.setItem = () => { throw new Error('Storage disabled'); };
    context.handleQtyIncreaser(context.cartProducts[0]);
    assert.equal(render().cartProducts[0].quantity, 3);
  } finally { global.localStorage = previous; }
});

function cartUI() {
  const h = hookRuntime(), calls = [], navigations = [];
  const context = { cartProducts: [structuredClone(item)], cartTotalQtyAmount: 20000, handleClearCart() {}, cartCacheMessage: '',
    isCurrentCart: snapshot => JSON.stringify(context.cartProducts) === snapshot,
    handleReplaceCart(items, expected) { if (JSON.stringify(context.cartProducts) !== expected) return false; context.cartProducts = items; return true; } };
  let complete;
  const Button = () => null;
  const load = sourceLoader({ react: h.react, '../hooks/useCart': { useCart: () => ({ context }) },
    '../components/Headinng': { __esModule: true, default: () => null }, '../components/Button': { __esModule: true, default: Button }, './ItemContent': { __esModule: true, default: () => null },
    'next/link': { __esModule: true, default: () => null }, 'next/navigation': { useRouter: () => ({ push: url => navigations.push(url) }) },
    axios: { __esModule: true, default: { post: (...args) => { calls.push(args); return new Promise(resolve => { complete = resolve; }); }, isAxiosError: () => false } } });
  const Cart = load('app/cart/CartClient.tsx').CartClient;
  const render = () => h.render(Cart, { currentUser: { id: 'owner' } });
  return { context, calls, navigations, render, complete: data => complete({ data }), button: (tree, label) => findElement(tree, element => element.type === Button && element.props.label === label) };
}

test('cart checkout waits for row review and preserves changed prices until the shopper accepts', async () => {
  const ui = cartUI();
  const pending = ui.button(ui.render(), 'Proceed to Checkout').props.onClick();
  const f = fixture(); f.variant.price = 12000;
  ui.complete(await f.review(ui.context.cartProducts));
  await pending; await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.context.cartProducts[0].price, 10000);
  assert.equal(ui.navigations.length, 0);
  const accept = findElement(ui.render(), element => element.type === 'button' && element.props.children?.[0] === 'Accept ');
  assert.ok(accept);
  accept.props.onClick();
  assert.equal(ui.context.cartProducts[0].price, 12000);
});

test('a late cart review cannot overwrite edits or navigate to checkout', async () => {
  const ui = cartUI();
  ui.button(ui.render(), 'Proceed to Checkout').props.onClick();
  ui.context.cartProducts = [{ ...item, quantity: 3 }]; ui.render();
  ui.complete(await fixture().review([item]));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.context.cartProducts[0].quantity, 3);
  assert.equal(ui.navigations.length, 0);
});

test('a verified unchanged cart proceeds without changing the shopper quantity', async () => {
  const ui = cartUI(); ui.button(ui.render(), 'Proceed to Checkout').props.onClick();
  ui.complete(await fixture().review([item]));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(ui.navigations, ['/checkout']);
  assert.equal(ui.context.cartProducts[0].quantity, 2);
});
