const { createHash } = require("node:crypto");

const clone = (value) => structuredClone(value);

function matches(row, where = {}) {
  return Object.entries(where || {}).every(([key, value]) => {
    if (key === "AND") return value.every((condition) => matches(row, condition));
    if (key === "OR") return value.some((condition) => matches(row, condition));
    if (value === null) return row[key] == null;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return row[key] === value;
    }
    if ("is" in value) return !!row[key] && matches(row[key], value.is);
    if ("isSet" in value) return (row[key] !== undefined) === value.isSet;
    if ("in" in value) return value.in.includes(row[key]);
    if ("notIn" in value) return !value.notIn.includes(row[key]);
    if ("not" in value) return row[key] !== value.not;
    if ("lt" in value) return row[key] < value.lt;
    if ("lte" in value) return row[key] <= value.lte;
    if ("gt" in value) return row[key] > value.gt;
    if ("gte" in value) return row[key] >= value.gte;
    if ("contains" in value) {
      return typeof row[key] === "string" && row[key].includes(value.contains);
    }
    return matches(row[key] || {}, value);
  });
}

function normalizeWriteData(data = {}) {
  const next = {};
  for (const [key, value] of Object.entries(data)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 1 &&
      "set" in value
    ) {
      next[key] = clone(value.set);
      continue;
    }
    next[key] = value;
  }
  return next;
}

function wrapWrites(model) {
  for (const method of ["create", "update", "updateMany"]) {
    if (!model?.[method] || model[method].__stockWrapped) continue;
    const original = model[method].bind(model);
    const wrapped = async (args = {}) =>
      original(args.data ? { ...args, data: normalizeWriteData(args.data) } : args);
    wrapped.__stockWrapped = true;
    model[method] = wrapped;
  }
}

function defaultVariantId(productId, index) {
  return createHash("sha256")
    .update(`${productId}:${index}`)
    .digest("hex")
    .slice(0, 24);
}

function installStockDatabase(prisma, products, stores = []) {
  const auditLogs = new Map();
  const exceptions = new Map();
  const orderRows = stores.find((store) => store instanceof Map) || new Map();
  const variants = new Map();
  const terminalStatuses = new Set(["complete", "paid", "done", "cancelled"]);
  for (const product of products || []) {
    const images = Array.isArray(product.images) && product.images.length ? product.images : [{ color: "Default", colorCode: "#000000", image: "" }];
    images.forEach((image, index) => {
      const id = defaultVariantId(String(product.id).toLowerCase(), index);
      variants.set(id, {
        id,
        productId: String(product.id).toLowerCase(),
        sku: `${String(product.id).slice(-6).toUpperCase()}-${index + 1}`,
        name: image.color || `Option ${index + 1}`,
        isActive: true,
        inStock: product.inStock !== false,
        price: product.price,
        currency: "vnd",
        image: clone(image),
        inventory: {
          onHand: 1,
          reserved: 0,
          version: 1,
          updatedAt: new Date(),
        },
        updatedAt: new Date(),
        product: {
          id: String(product.id).toLowerCase(),
          name: product.name,
          description: product.description,
          status: "ACTIVE",
          category: { name: product.category || "General", isVisible: true },
          brand: { name: product.brand || "Generic", isVisible: true },
        },
      });
    });
  }

  if (!prisma.$transaction) {
    const trackedStores = [variants, auditLogs, exceptions, ...stores].filter(
      (store) => store instanceof Map,
    );
    let queue = Promise.resolve();
    prisma.$transaction = (operation) => {
      const execute = async () => {
        const snapshots = trackedStores.map((store) => [
          store,
          [...store.entries()].map(([key, value]) => [key, clone(value)]),
        ]);
        try {
          return await operation(prisma);
        } catch (error) {
          for (const [store, entries] of snapshots) {
            store.clear();
            for (const [key, value] of entries) store.set(key, clone(value));
          }
          throw error;
        }
      };
      const result = queue.then(execute, execute);
      queue = result.catch(() => {});
      return result;
    };
  }

  if (!prisma.productVariant) {
    prisma.productVariant = {
      findUnique: async ({ where, include } = {}) => {
        const row =
          [...variants.values()].find((variant) => matches(variant, where || {})) ||
          null;
        if (!row) return null;
        const next = clone(row);
        if (!include?.product) delete next.product;
        return next;
      },
      findMany: async ({ where = {}, include, take } = {}) => {
        const rows = [...variants.values()].filter((row) => matches(row, where));
        const limited = typeof take === "number" ? rows.slice(0, take) : rows;
        return clone(
          limited.map((row) => {
            const next = { ...row };
            if (!include?.product) delete next.product;
            return next;
          }),
        );
      },
      updateMany: async ({ where = {}, data = {} } = {}) => {
        let count = 0;
        const update = normalizeWriteData(data);
        for (const variant of variants.values()) {
          if (!matches(variant, where)) continue;
          Object.assign(variant, clone(update));
          if (update.inventory?.updatedAt) variant.updatedAt = update.inventory.updatedAt;
          count++;
        }
        return { count };
      },
    };
  }

  if (!prisma.auditLog) {
    prisma.auditLog = {
      create: async ({ data }) => {
        if (auditLogs.has(data.id)) {
          throw Object.assign(new Error("Duplicate ID"), { code: "P2002" });
        }
        const row = { ...clone(data), createDate: new Date() };
        auditLogs.set(row.id, row);
        return clone(row);
      },
    };
  }

  if (!prisma.paymentException) {
    prisma.paymentException = {
      upsert: async ({ where, create, update }) => {
        if (exceptions.has(where.id)) {
          const row = exceptions.get(where.id);
          Object.assign(row, clone(normalizeWriteData(update || {})));
          return clone(row);
        }
        const row = {
          status: "OPEN",
          createdAt: new Date(),
          ...clone(normalizeWriteData(create || {})),
        };
        exceptions.set(where.id, row);
        return clone(row);
      },
      findUnique: async ({ where }) => clone(exceptions.get(where.id) || null),
      findMany: async ({ where = {} } = {}) =>
        clone([...exceptions.values()].filter((row) => matches(row, where))),
    };
  }

  prisma.order ??= {};
  if (!prisma.order.findMany) {
    prisma.order.findMany = async ({ where = {}, take } = {}) =>
      clone(
        [...orderRows.values()]
          .filter((row) => matches(row, where))
          .slice(0, typeof take === "number" ? take : undefined),
      );
  }
  if (!prisma.order.findUnique) {
    prisma.order.findUnique = async ({ where = {} } = {}) =>
      clone([...orderRows.values()].find((row) => matches(row, where)) || null);
  }
  wrapWrites(prisma.order);
  if (prisma.checkoutRequest) wrapWrites(prisma.checkoutRequest);
  if (prisma.paymentAttempt) wrapWrites(prisma.paymentAttempt);

  if (orderRows instanceof Map && prisma.order?.updateMany && !prisma.order.updateMany.__stockReservationReleaseWrapped) {
    const originalUpdateMany = prisma.order.updateMany.bind(prisma.order);
    prisma.order.updateMany = async (args = {}) => {
      const where = args.where || {};
      const before = [...orderRows.values()]
        .filter((row) => matches(row, where))
        .map((row) => ({ row, stockReservation: clone(row.stockReservation), status: row.status }));
      const result = await originalUpdateMany(args);
      for (const item of before) {
        const previous = item.stockReservation;
        if (
          previous?.state !== "HELD" ||
          !terminalStatuses.has(String(item.row.status || "").toLowerCase())
        ) {
          continue;
        }
        for (const line of previous.lines || []) {
          const variant = variants.get(line.variantId);
          if (!variant?.inventory) continue;
          variant.inventory = {
            ...variant.inventory,
            reserved: Math.max(0, variant.inventory.reserved - line.quantity),
            version: variant.inventory.version + 1,
            updatedAt: new Date(),
          };
          variant.updatedAt = variant.inventory.updatedAt;
        }
        item.row.stockReservation = {
          ...previous,
          state: "RELEASED",
          version: previous.version + 1,
          updatedAt: new Date(),
          expiresAt: null,
        };
      }
      return result;
    };
    prisma.order.updateMany.__stockReservationReleaseWrapped = true;
  }

  return {
    variants,
    audits: auditLogs,
    exceptions,
    orders: orderRows,
  };
}

module.exports = {
  installStockDatabase,
  matches,
};
