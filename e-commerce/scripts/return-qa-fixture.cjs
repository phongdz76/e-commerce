const { randomUUID } = require('node:crypto');

// Caller must supply a client already scoped to a disposable QA database.
async function seedReturnOrder(db, ownerId, productId) {
  const variant = await db.productVariant.create({ data: {
    productId, sku: 'QA-RETURN-' + randomUUID(), name: 'Return QA Black', price: 100000, inStock: true,
    image: { color: 'Black', colorCode: '#000000', image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' },
    inventory: { onHand: 4, reserved: 1, version: 1, updatedAt: new Date() },
  } });
  const order = await db.order.create({ data: {
    userId: ownerId, status: 'paid', amount: 200000, currency: 'vnd', deliveryStatus: 'delivered', paymentMethod: 'COD',
    paymentIntentId: 'COD_RETURN_QA_' + randomUUID(), management: { state: 'CONFIRMED', version: 1, updatedAt: new Date() },
    stockReservation: { state: 'CONSUMED', version: 2, updatedAt: new Date(), expiresAt: null, lines: [{ variantId: variant.id, sku: variant.sku, quantity: 2 }] },
    products: [{ id: productId, variantId: variant.id, sku: variant.sku, name: 'Purchased return QA phone', description: 'Isolated delivered fixture', category: 'QA phones', brand: 'QA brand', selectedImg: variant.image, quantity: 2, price: variant.price }],
  } });
  return { order, variant };
}
module.exports = { seedReturnOrder };
