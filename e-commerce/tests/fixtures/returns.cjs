const { randomUUID } = require('node:crypto');
const { fixture: supportFixture } = require('./support-tickets.cjs');

function fixture() {
  const cases = new Map(), events = new Map(), f = supportFixture([cases, events]);
  const delegate = f.notifications.delegate;
  f.db.returnCase = delegate(cases, { state: 'REQUESTED', version: 1, updatedAt: new Date() });
  f.db.returnCaseEvent = delegate(events);
  const order = f.orders.get('e'.repeat(24)), productId = 'f'.repeat(24), variantId = '1'.repeat(24);
  Object.assign(order, { status: 'paid', deliveryStatus: 'delivered', management: { state: 'CONFIRMED' },
    stockReservation: { state: 'CONSUMED' }, products: [{ id: productId, variantId, sku: 'QA-RETURN', name: 'Purchased phone', quantity: 2, price: 100000, selectedImg: { color: 'Black' } }] });
  f.stock.variants.set(variantId, { id: variantId, productId, sku: 'QA-RETURN', name: 'Black', product: { id: productId, name: 'Current phone name' }, updatedAt: new Date(), inventory: { onHand: 4, reserved: 1, version: 1, updatedAt: new Date() } });
  const service = f.load('libs/returnCases.ts'), parse = f.load('utils/returnCases.ts').parseReturnCreate;
  const input = (extra = {}) => parse({ orderId: order.id, lineIndex: 0, quantity: 1, reason: 'DAMAGED', preference: 'REFUND', description: 'Please inspect the item received in my order.', requestId: randomUUID(), ...extra });
  const create = (extra = {}, actor = f.owner) => service.createReturnCase(actor, input(extra));
  const change = (id, action, actor = f.admin, extra = {}) => service.changeReturnCase(id, actor, { action, version: cases.get(id).version, requestId: randomUUID(), text: 'Public instructions or recorded inspection findings.', reference: 'QA-RECEIPT-001', ...extra });
  const inspect = async (id, suitable = true) => { await f.claim(); await change(id, 'ACCEPT'); await change(id, 'RECEIVE'); await change(id, suitable ? 'INSPECT_RESTOCKABLE' : 'INSPECT_OTHER'); };
  return { ...f, cases, events, order, variantId, service, input, create, change, inspect };
}
module.exports = { fixture };
