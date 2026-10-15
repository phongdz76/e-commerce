const { createHash } = require("node:crypto");

function matches(row, where = {}) {
  return Object.entries(where).every(([field, value]) => {
    if (field === "AND") return value.every((condition) => matches(row, condition));
    if (field === "OR") return value.some((condition) => matches(row, condition));
    if (value instanceof Date) return row[field]?.getTime() === value.getTime();
    if (value === null) return row[field] == null;
    if (value && typeof value === "object") {
      if ("is" in value) return value.is === null ? row[field] == null : !!row[field] && matches(row[field], value.is);
      if ("isSet" in value) return (row[field] !== undefined) === value.isSet;
      if ("in" in value) return value.in.includes(row[field]);
      if ("notIn" in value) return !value.notIn.includes(row[field]);
      if ("lte" in value) return row[field] != null && row[field] <= value.lte;
      if ("not" in value) return row[field] !== value.not;
    }
    return row[field] === value;
  });
}

function installStockDatabase(prisma, products, maps = []) {
  const variants = new Map(products.flatMap((product) => product.images.map((image, index) => {
    const id = createHash("sha256").update(product.id + ":" + index).digest("hex").slice(0, 24);
    return [id, { id, productId: product.id, sku: "FIXTURE-" + id.slice(-12), name: image.color, price: product.price, currency: "vnd",
      image: { ...image, colorCode: image.colorCode.trim() }, isActive: true, inStock: product.inStock,
      inventory: { onHand: 1000, reserved: 0, version: 1, updatedAt: new Date() }, updatedAt: new Date(),
      product: { id: product.id, name: product.name, description: product.description, status: "ACTIVE", category: { name: product.category, isVisible: true }, brand: { name: product.brand, isVisible: true } } }];
  })));
  const audits = new Map();
  function delegate(records) {
    return {
      findUnique: async ({ where }) => structuredClone([...records.values()].find((row) => matches(row, where)) || null),
      findMany: async ({ where = {}, take = 100 }) => structuredClone([...records.values()].filter((row) => matches(row, where)).slice(0, take)),
      create: async ({ data }) => {
        if (records.has(data.id)) throw Object.assign(new Error("Duplicate fixture key"), { code: "P2002" });
        const row = { createdAt: new Date(), ...structuredClone(data) }; records.set(row.id, row); return structuredClone(row);
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const row of records.values()) if (matches(row, where)) {
          for (const [field, value] of Object.entries(data)) row[field] = value && typeof value === "object" && "set" in value ? structuredClone(value.set) : structuredClone(value);
          count++;
        }
        return { count };
      },
      count: async ({ where = {} } = {}) => [...records.values()].filter((row) => matches(row, where)).length,
    };
  }
  prisma.productVariant = delegate(variants);
  prisma.auditLog = delegate(audits);
  if (!prisma.paymentException) prisma.paymentException = { upsert: async ({ create }) => structuredClone(create) };
  let queue = Promise.resolve();
  prisma.$transaction = (operation) => {
    if (Array.isArray(operation)) return Promise.all(operation);
    const next = queue.then(async () => {
      const all = [...maps, variants, audits];
      const snapshots = all.map((map) => structuredClone(map));
      try { return await operation(prisma); }
      catch (error) { all.forEach((map, index) => { map.clear(); for (const [id, value] of snapshots[index]) map.set(id, value); }); throw error; }
    });
    queue = next.catch(() => {});
    return next;
  };
  return { variants, audits };
}

module.exports = { installStockDatabase, matches };
