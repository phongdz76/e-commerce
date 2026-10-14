const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, mocks) {
  const filename = path.join(__dirname, "..", file);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, {
    filename,
  })(
    (name) => (name in mocks ? mocks[name] : name.startsWith("@/") ? load(name.slice(2) + ".ts", mocks) : require(name)),
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

function fixture(kind) {
  const records = new Map();
  const catalogProducts = new Map();
  const auditLogs = [];
  const state = {
    user: { id: "owner", role: "ADMIN" },
    offline: false,
    race: null,
    auditOffline: false,
    insertRace: false,
  };
  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (value instanceof Date) return row[key]?.getTime() === value.getTime();
      if (value && typeof value === "object" && value.contains !== undefined)
        return row[key].toLowerCase().includes(value.contains.toLowerCase());
      return row[key] === value;
    });
  }
  const delegate = {
    count: async ({ where }) => {
      if (state.offline) throw new Error("private database password");
      return [...records.values()].filter((row) => matches(row, where)).length;
    },
    findUnique: async ({ where }) => {
      if (state.offline) throw new Error("private database password");
      return structuredClone(
        [...records.values()].find((row) => matches(row, where)) || null,
      );
    },
    findMany: async ({ where, skip, take }) => {
      if (state.offline) throw new Error("private database password");
      return structuredClone(
        [...records.values()]
          .filter((row) => matches(row, where))
          .slice(skip, skip + take)
          .map((row) => ({ ...row, _count: { products: 2 } })),
      );
    },
    create: async ({ data }) => {
      assert.equal(auditLogs.at(-1).status, "STARTED");
      if (state.insertRace) {
        state.insertRace = false;
        throw Object.assign(new Error("private duplicate detail"), {
          code: "P2002",
        });
      }
      if ([...records.values()].some((row) => row.slug === data.slug))
        throw Object.assign(new Error("duplicate"), { code: "P2002" });
      const row = {
        id: (records.size + 1).toString(16).padStart(24, "0"),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...structuredClone(data),
      };
      records.set(row.id, row);
      return structuredClone(row);
    },
    updateMany: async ({ where, data }) => {
      assert.equal(auditLogs.at(-1).status, "STARTED");
      if (state.race) {
        state.race();
        state.race = null;
      }
      const row = [...records.values()].find((row) => matches(row, where));
      if (!row) return { count: 0 };
      if (
        [...records.values()].some(
          (other) => other.id !== row.id && other.slug === data.slug,
        )
      )
        throw Object.assign(new Error("duplicate"), { code: "P2002" });
      Object.assign(row, structuredClone(data));
      return { count: 1 };
    },
  };
  const prisma = {
    category: delegate,
    brand: delegate,
    auditLog: {
      create: async ({ data }) => {
        if (state.auditOffline) throw new Error("private audit detail");
        const row = { id: "audit-" + auditLogs.length, ...data };
        auditLogs.push(row);
        return structuredClone(row);
      },
      update: async ({ where, data }) =>
        Object.assign(
          auditLogs.find((row) => row.id === where.id),
          data,
        ),
    },
  };
  const relationData = (row) => ({
    ...structuredClone(row),
    category: structuredClone(records.get(row.categoryId)),
    brand: structuredClone(records.get(row.brandId)),
  });
  let variantSequence = 0;
  const assertUniqueSku = (variants, productId) => {
    const other = [...catalogProducts.values()]
      .filter((row) => row.id !== productId)
      .flatMap((row) => row.variants);
    const all = [...other, ...variants].map((row) => row.sku);
    if (new Set(all).size !== all.length)
      throw Object.assign(new Error("private SKU conflict"), { code: "P2002" });
  };
  prisma.product = {
    count: async ({ where }) => [...catalogProducts.values()].filter((row) => matches(row, where)).length,
    findUnique: async ({ where }) => {
      const row = catalogProducts.get(where.id);
      return row ? relationData(row) : null;
    },
    findMany: async ({ where, skip, take }) =>
      [...catalogProducts.values()]
        .filter((row) => matches(row, where))
        .slice(skip, skip + take)
        .map(relationData),
    create: async ({ data }) => {
      assert.equal(auditLogs.at(-1).status, "STARTED");
      const { variants, ...fields } = structuredClone(data);
      if ([...catalogProducts.values()].some((row) => row.slug === fields.slug))
        throw Object.assign(new Error("duplicate slug"), { code: "P2002" });
      assertUniqueSku(variants.create);
      const id = (catalogProducts.size + 100).toString(16).padStart(24, "0");
      const row = {
        id,
        updatedAt: new Date(),
        ...fields,
        variants: variants.create.map((variant) => ({
          id: (++variantSequence + 500).toString(16).padStart(24, "0"),
          productId: id,
          ...variant,
        })),
      };
      catalogProducts.set(id, row);
      return relationData(row);
    },
    update: async ({ where, data }) => {
      assert.equal(auditLogs.at(-1).status, "STARTED");
      if (state.productRace) {
        state.productRace();
        state.productRace = null;
      }
      const row = catalogProducts.get(where.id);
      if (!row || !matches(row, where))
        throw Object.assign(new Error("changed"), { code: "P2025" });
      const { variants, ...fields } = structuredClone(data);
      const next = { ...structuredClone(row), ...fields };
      for (const change of variants.update)
        Object.assign(
          next.variants.find(
            (variant) =>
              variant.id === change.where.id &&
              variant.productId === change.where.productId,
          ),
          change.data,
        );
      for (const variant of variants.create)
        next.variants.push({
          id: (++variantSequence + 500).toString(16).padStart(24, "0"),
          productId: row.id,
          ...variant,
        });
      assertUniqueSku(next.variants, row.id);
      if (
        [...catalogProducts.values()].some(
          (other) => other.id !== row.id && other.slug === next.slug,
        )
      )
        throw Object.assign(new Error("duplicate slug"), { code: "P2002" });
      catalogProducts.set(row.id, next);
      return relationData(next);
    },
  };
  const mocks = {
    "@/libs/prismadb": { __esModule: true, default: prisma },
    "@/actions/getCurrentUser": { getCurrentUser: async () => state.user },
    "next/server": { NextResponse: { json: Response.json } },
  };
  mocks["@/libs/adminAudit"] = load("libs/adminAudit.ts", mocks);
  mocks["@/libs/catalogGroup"] = load("libs/catalogGroup.ts", mocks);
  mocks["@/utils/catalogImage"] = load("utils/catalogImage.ts", mocks);
  mocks["@/utils/adminInventory"] = load("utils/adminInventory.ts", mocks);
  mocks["@/libs/adminCatalog"] = load("libs/adminCatalog.ts", mocks);
  const productRoutes = load("app/api/admin/products/route.ts", mocks);
  const editProduct = load(
    "app/api/admin/products/[productId]/route.ts",
    mocks,
  ).PATCH;
  const routes = load(`app/api/admin/${kind}/route.ts`, mocks);
  const update = load(`app/api/admin/${kind}/[groupId]/route.ts`, mocks).PATCH;
  const request = (body) =>
    new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify(body),
    });
  const create = (body = {}) =>
    routes.POST(
      request({
        name: "Điện thoại",
        slug: "dien-thoai",
        isVisible: true,
        ...body,
      }),
    );
  const edit = (row, body = {}) =>
    update(
      request({
        name: row.name,
        slug: row.slug,
        isVisible: row.isVisible,
        updatedAt: row.updatedAt.toISOString(),
        ...body,
      }),
      { params: Promise.resolve({ groupId: row.id }) },
    );
  return {
    records,
    auditLogs,
    state,
    create,
    edit,
    routes,
    request,
    catalogProducts,
    productRoutes,
    editProduct,
  };
}

for (const kind of ["categories", "brands"]) {
  test(
    kind + " APIs require an active ADMIN for reads and writes",
    async () => {
      const f = fixture(kind);
      for (const role of [null, "USER"]) {
        f.state.user = role ? { id: "owner", role } : null;
        assert.equal((await f.create()).status, role ? 403 : 401);
        assert.equal(
          (await f.routes.GET(new Request("http://localhost/test"))).status,
          role ? 403 : 401,
        );
        assert.equal(
          (
            await f.edit({
              id: "a".repeat(24),
              name: "Phone",
              slug: "phone",
              isVisible: true,
              updatedAt: new Date(),
            })
          ).status,
          role ? 403 : 401,
        );
      }
      assert.equal(f.records.size, 0);
      assert.equal(f.auditLogs.length, 0);
    },
  );

  test(
    kind +
      " create/update/visibility use validated fields and leave attached products intact",
    async () => {
      const f = fixture(kind);
      assert.equal(
        (
          await f.create({
            name: "  Điện   thoại  ",
            products: { deleteMany: {} },
            id: "evil",
            role: "ADMIN",
          })
        ).status,
        201,
      );
      const row = [...f.records.values()][0];
      assert.equal(row.name, "Điện thoại");
      assert.equal(row.products, undefined);
      assert.notEqual(row.id, "evil");
      assert.equal(f.auditLogs[0].status, "SUCCEEDED");
      assert.equal(
        (await f.edit(row, { isVisible: false, name: "Điện thoại mới" }))
          .status,
        200,
      );
      assert.equal(row.isVisible, false);
      assert.equal(row.name, "Điện thoại mới");
      const list = await (
        await f.routes.GET(new Request("http://localhost/?q=ĐIỆN"))
      ).json();
      assert.equal(list.groups.length, 1);
      assert.equal(list.groups[0].productCount, 2);
      assert.equal(typeof list.groups[0].updatedAt, "string");
      assert.equal(list.groups[0].products, undefined);
      assert.equal(f.auditLogs.at(-1).status, "SUCCEEDED");
    },
  );

  test(
    kind +
      " reject malformed input and duplicate slugs including database insert races",
    async () => {
      const f = fixture(kind);
      for (const patch of [
        { name: 3 },
        { name: " " },
        { name: "x".repeat(81) },
        { slug: "Invalid Slug" },
        { slug: "--phone" },
        { slug: "phone/../../" },
        { isVisible: "false" },
      ]) {
        assert.equal((await f.create(patch)).status, 400);
      }
      assert.equal(f.auditLogs.length, 0);
      assert.equal((await f.create()).status, 201);
      assert.equal((await f.create()).status, 409);
      f.state.insertRace = true;
      assert.equal(
        (await f.create({ slug: "laptop", name: "Laptop" })).status,
        409,
      );
      assert.equal(f.auditLogs.at(-1).status, "FAILED");
    },
  );

  test(
    kind +
      " stale updates and changes between read/write do not overwrite newer edits",
    async () => {
      const f = fixture(kind);
      await f.create();
      const row = [...f.records.values()][0];
      const old = structuredClone(row);
      assert.equal((await f.edit(row, { name: "Changed" })).status, 200);
      assert.equal((await f.edit(old, { name: "Stale" })).status, 409);
      f.state.race = () => {
        row.name = "Concurrent";
        row.updatedAt = new Date(row.updatedAt.getTime() + 1000);
      };
      assert.equal((await f.edit(row, { name: "Overwrite" })).status, 409);
      assert.equal(row.name, "Concurrent");
      assert.equal(f.auditLogs.at(-1).status, "FAILED");
    },
  );

  test(
    kind +
      " pagination is bounded and audit/database errors cannot leak or perform unaudited changes",
    async () => {
      const f = fixture(kind);
      for (let i = 0; i < 27; i++)
        await f.create({ name: "Group " + i, slug: "group-" + i });
      const first = await (
        await f.routes.GET(new Request("http://localhost/?page=1"))
      ).json();
      const second = await (
        await f.routes.GET(new Request("http://localhost/?page=2"))
      ).json();
      assert.equal(first.groups.length, 10);
      assert.equal(first.hasMore, true);
      assert.equal(second.groups.length, 10);
      assert.equal(second.hasMore, true);
      const third = await (await f.routes.GET(new Request("http://localhost/?page=3"))).json();
      assert.equal(third.groups.length, 7);
      assert.equal(third.hasMore, false);
      assert.equal(third.total, 27);
      assert.equal(
        (await f.routes.GET(new Request("http://localhost/?page=0"))).status,
        400,
      );
      f.state.auditOffline = true;
      const response = await f.create({ slug: "new-group" });
      assert.equal(response.status, 503);
      assert.equal(f.records.size, 27);
      assert.doesNotMatch(
        JSON.stringify(await response.json()),
        /private|password/,
      );
      f.state.offline = true;
      const list = await f.routes.GET(new Request("http://localhost/test"));
      assert.equal(list.status, 503);
      assert.doesNotMatch(
        JSON.stringify(await list.json()),
        /private|password/,
      );
    },
  );
}

async function productFixture() {
  const f = fixture("categories");
  await f.create();
  await f.create({ name: "Brand", slug: "brand" });
  const groups = [...f.records.values()];
  f.productBody = {
    name: "Test Phone",
    slug: "test-phone",
    description: "Phone description",
    status: "ACTIVE",
    categoryId: groups[0].id,
    brandId: groups[1].id,
    variants: [
      {
        sku: "PHONE-BLACK",
        name: "Black 128 GB",
        price: 100000,
        isActive: true,
        inStock: true,
        image: {
          color: "Black",
          colorCode: "#000000",
          image: "https://res.cloudinary.com/test/image/upload/phone.png",
        },
        attributes: { RAM: "8 GB" },
      },
    ],
  };
  f.createProduct = (body = f.productBody) =>
    f.productRoutes.POST(f.request(body));
  f.updateProduct = (product, patch = {}) =>
    f.editProduct(
      f.request({
        ...f.productBody,
        variants: product.variants,
        updatedAt: product.updatedAt.toISOString(),
        ...patch,
      }),
      { params: Promise.resolve({ productId: product.id }) },
    );
  return f;
}

test("product APIs independently reject unauthenticated and non-admin requests", async () => {
  const f = await productFixture();
  for (const user of [null, { id: "owner", role: "USER" }]) {
    f.state.user = user;
    assert.equal((await f.createProduct()).status, user ? 403 : 401);
    assert.equal(
      (await f.productRoutes.GET(new Request("http://localhost/test"))).status,
      user ? 403 : 401,
    );
  }
  assert.equal(f.catalogProducts.size, 0);
});

test("product validation rejects unsafe images, forged IDs, invalid money and duplicate SKUs", async () => {
  const f = await productFixture();
  for (const price of [0, -1, 1.5, "100", 2147483648]) {
    const body = structuredClone(f.productBody);
    body.variants[0].price = price;
    assert.equal((await f.createProduct(body)).status, 400);
  }
  for (const url of [
    "http://res.cloudinary.com/test.png",
    "https://evil.test/phone.png",
    "https://owner:secret@res.cloudinary.com/test.png",
    "javascript:alert(1)",
  ]) {
    const body = structuredClone(f.productBody);
    body.variants[0].image.image = url;
    assert.equal((await f.createProduct(body)).status, 400);
  }
  for (const mode of [
    "foreign-id",
    "duplicate-sku",
    "nested-attributes",
    "missing-category",
    "no-active-sku",
  ]) {
    const body = structuredClone(f.productBody);
    if (mode === "foreign-id") body.variants[0].id = "a".repeat(24);
    if (mode === "duplicate-sku")
      body.variants.push(structuredClone(body.variants[0]));
    if (mode === "nested-attributes")
      body.variants[0].attributes = { RAM: { value: "8 GB" } };
    if (mode === "missing-category") body.categoryId = "a".repeat(24);
    if (mode === "no-active-sku") body.variants[0].isActive = false;
    assert.equal((await f.createProduct(body)).status, 400, mode);
  }
  assert.equal(f.catalogProducts.size, 0);
  assert.equal(f.auditLogs.length, 2);
});

test("nested catalog writes set VND, preserve variant identity, audit prices and leave order snapshots unchanged", async () => {
  const f = await productFixture();
  const orderSnapshot = structuredClone(f.productBody.variants);
  assert.equal(
    (
      await f.createProduct({
        ...f.productBody,
        userId: "foreign",
        role: "ADMIN",
        currency: "usd",
      })
    ).status,
    201,
  );
  const product = [...f.catalogProducts.values()][0];
  assert.equal(product.userId, undefined);
  assert.equal(product.variants[0].currency, "vnd");
  const variant = {
    ...product.variants[0],
    price: 150000,
    image: { ...product.variants[0].image, color: "New Black" },
  };
  assert.equal(
    (await f.updateProduct(product, { variants: [variant] })).status,
    200,
  );
  const saved = f.catalogProducts.get(product.id);
  assert.equal(saved.variants[0].id, product.variants[0].id);
  assert.equal(saved.variants[0].price, 150000);
  assert.equal(f.auditLogs.at(-1).details.after.variants[0].price, 150000);
  assert.equal(f.auditLogs.at(-1).details.before.variants[0].price, 100000);
  assert.deepEqual(orderSnapshot, f.productBody.variants);
  assert.equal((await f.updateProduct(product)).status, 409);
  const list = await (
    await f.productRoutes.GET(new Request("http://localhost/?status=ACTIVE"))
  ).json();
  assert.equal(list.products.length, 1);
  assert.equal(list.products[0].variants[0].price, 150000);
  assert.equal(typeof list.products[0].updatedAt, "string");
});

test("catalog edits preserve stock and cannot forge inventory through variant metadata", async () => {
  const f = await productFixture();
  assert.equal((await f.createProduct()).status, 201);
  const product = [...f.catalogProducts.values()][0];
  const inventory = { onHand: 12, reserved: 2, version: 1, updatedAt: new Date() };
  product.variants[0].inventory = structuredClone(inventory);
  assert.equal((await f.updateProduct(product, { variants: [{ ...product.variants[0], price: 150000,
    inventory: { onHand: 999999, reserved: 0, version: 99, updatedAt: new Date() } }] })).status, 200);
  const saved = f.catalogProducts.get(product.id);
  assert.deepEqual(saved.variants[0].inventory, inventory);
  const list = await (await f.productRoutes.GET(new Request("http://localhost/?status=ACTIVE"))).json();
  assert.equal(list.products[0].variants[0].inventory.onHand, 12);
  assert.equal(list.products[0].variants[0].inventory.available, 10);
  assert.equal(list.products[0].variants[0].inventory.reserved, 2);
});

test("SKU omission/foreign IDs are rejected, new SKUs can be added and existing SKUs can be deactivated", async () => {
  const f = await productFixture();
  await f.createProduct();
  let product = [...f.catalogProducts.values()][0];
  const added = {
    ...structuredClone(f.productBody.variants[0]),
    sku: "PHONE-WHITE",
    name: "White 128 GB",
  };
  assert.equal(
    (await f.updateProduct(product, { variants: [added] })).status,
    409,
  );
  assert.equal(
    (
      await f.updateProduct(product, {
        variants: [{ ...product.variants[0], id: "f".repeat(24) }],
      })
    ).status,
    409,
  );
  assert.equal(
    (await f.updateProduct(product, { variants: [...product.variants, added] }))
      .status,
    200,
  );
  product = f.catalogProducts.get(product.id);
  assert.equal(product.variants.length, 2);
  assert.equal(
    (
      await f.updateProduct(product, {
        variants: product.variants.map((variant) => ({
          ...variant,
          isActive: false,
        })),
        status: "ARCHIVED",
      })
    ).status,
    200,
  );
  assert.equal(f.catalogProducts.get(product.id).status, "ARCHIVED");
  assert.equal(f.catalogProducts.get(product.id).variants.length, 2);
});

test("hidden groups block publishing and nested unique-key conflicts preserve the previous product", async () => {
  const f = await productFixture();
  const category = f.records.get(f.productBody.categoryId);
  category.isVisible = false;
  assert.equal((await f.createProduct()).status, 400);
  assert.equal(
    (await f.createProduct({ ...f.productBody, status: "DRAFT" })).status,
    201,
  );
  category.isVisible = true;
  const product = [...f.catalogProducts.values()][0];
  assert.equal(
    (await f.createProduct({ ...f.productBody, slug: "another-phone" })).status,
    409,
  );
  assert.equal(f.catalogProducts.size, 1);
  f.state.productRace = () => {
    product.updatedAt = new Date(product.updatedAt.getTime() + 1000);
  };
  assert.equal(
    (await f.updateProduct(product, { name: "Stale edit" })).status,
    409,
  );
  assert.equal(f.catalogProducts.get(product.id).name, "Test Phone");
  assert.equal(f.auditLogs.at(-1).status, "FAILED");
});

test("seeded local product images and whitespace color codes remain editable while traversal paths are rejected", async () => {
  const f = await productFixture();
  const body = structuredClone(f.productBody);
  body.variants[0].image.image = "/products/iphone14-white.webp";
  body.variants[0].image.colorCode = " #0000FF";
  assert.equal((await f.createProduct(body)).status, 201);
  const product = [...f.catalogProducts.values()][0];
  assert.equal(product.variants[0].image.colorCode, "#0000FF");
  for (const image of [
    "/products/../private.png",
    "/products/%2e%2e/private.png",
    "//evil.test/phone.png",
    "/api/private.png",
  ]) {
    const invalid = structuredClone(body);
    invalid.variants[0].image.image = image;
    assert.equal((await f.createProduct(invalid)).status, 400);
  }
});
