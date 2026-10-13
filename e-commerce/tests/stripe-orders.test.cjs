const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { Readable } = require("node:stream");
const { createHmac, randomUUID } = require("node:crypto");
const ts = require("typescript");
const Stripe = require("stripe");

// Isolated test-process configuration; never load the app's private credentials.
process.env.VNP_TMNCODE = "FIXTURE1";
process.env.VNP_HASHSECRET = "fixture-vnp-secret";
process.env.MOMO_PARTNER_CODE = "MOMO";
process.env.MOMO_ACCESS_KEY = "fixture-momo-access";
process.env.MOMO_SECRET_KEY = "fixture-momo-secret";

// Execute the real route/service code with in-memory provider and database adapters.
// No credentials, network requests, orders or payments are created by these tests.
function loadSource(file, mocks = {}) {
  const filename = path.join(__dirname, "..", file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, {
    filename,
  })(
    (name) => (name in mocks ? mocks[name] : require(name)),
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

const { products } = loadSource("utils/products.tsx");
const orderItems = loadSource("libs/orderItems.ts", {
  "@/utils/products": { products },
});
const orderDelivery = loadSource("libs/orderDelivery.ts");
const product = products.find((p) => p.inStock);
const cart = [{ ...product, selectedImg: product.images[0], quantity: 1 }];
const copy = (value) => structuredClone(value);

function fixture() {
  const rows = new Map();
  const intents = new Map();
  const requestKeys = new Map();
  const checkoutRequests = new Map();
  const paymentAttempts = new Map();
  let created = 0;
  const state = {
    user: { id: "owner", role: "USER" },
    offline: false,
    race: null,
    uniqueConflict: false,
  };
  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (key === "AND")
        return value.every((condition) => matches(row, condition));
      if (key === "OR")
        return value.some((condition) => matches(row, condition));
      if (value === null) return row[key] == null;
      if (value && typeof value === "object") {
        if ("isSet" in value) return (row[key] !== undefined) === value.isSet;
        if (value.in) return value.in.includes(row[key]);
        if (value.notIn) return !value.notIn.includes(row[key]);
      }
      return row[key] === value;
    });
  }
  const prisma = {
    order: {
      create: async ({ data }) => {
        if (
          [...rows.values()].some(
            (row) => row.paymentIntentId === data.paymentIntentId,
          )
        ) {
          throw Object.assign(new Error("Duplicate reference"), {
            code: "P2002",
          });
        }
        const row = {
          id: `order-${rows.size + 1}`,
          createDate: new Date(),
          ...copy(data),
        };
        rows.set(row.id, row);
        return copy(row);
      },
      update: async ({ where, data }) => {
        const row = [...rows.values()].find((row) => matches(row, where));
        if (!row) throw new Error("Order missing");
        Object.assign(row, copy(data));
        return copy(row);
      },
      findFirst: async ({ where }) =>
        copy([...rows.values()].find((row) => matches(row, where)) || null),
      findUnique: async ({ where, include }) => {
        const row = [...rows.values()].find((row) => matches(row, where));
        return row
          ? {
              ...copy(row),
              ...(include?.user
                ? {
                    user: {
                      id: row.userId,
                      name: "Customer",
                      email: "customer@example.test",
                      image: null,
                    },
                  }
                : {}),
            }
          : null;
      },
      findMany: async ({ where = {}, take }) =>
        copy(
          [...rows.values()]
            .filter((row) => matches(row, where))
            .reverse()
            .slice(0, take),
        ),
      updateMany: async ({ where, data }) => {
        if (state.race) {
          state.race();
          state.race = null;
        }
        let count = 0;
        for (const row of rows.values())
          if (matches(row, where)) {
            Object.assign(row, copy(data));
            count++;
          }
        return { count };
      },
      upsert: async ({ where, create, update }) => {
        let row = [...rows.values()].find((row) => matches(row, where));
        if (row) Object.assign(row, copy(update));
        else {
          row = {
            id: `order-${rows.size + 1}`,
            createDate: new Date(),
            ...copy(create),
          };
          rows.set(row.id, row);
        }
        if (state.uniqueConflict) {
          state.uniqueConflict = false;
          throw Object.assign(new Error("Concurrent insert"), {
            code: "P2002",
          });
        }
        return copy(row);
      },
    },
  };
  const createModel = (records) => ({
    create: async ({ data }) => {
      if (records.has(data.id)) {
        throw Object.assign(new Error("Duplicate ID"), { code: "P2002" });
      }
      const row = {
        state: "CREATED",
        checkCount: 0,
        createDate: new Date(),
        merchantId: null,
        ...copy(data),
      };
      records.set(row.id, row);
      return copy(row);
    },
    findUnique: async ({ where }) => copy(records.get(where.id) || null),
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of records.values()) {
        if (matches(row, where)) {
          Object.assign(row, copy(data));
          count++;
        }
      }
      return { count };
    },
  });
  prisma.checkoutRequest = createModel(checkoutRequests);
  prisma.paymentAttempt = createModel(paymentAttempts);
  const stripe = {
    webhooks: new Stripe("sk_test_fixture").webhooks,
    paymentIntents: {
      retrieve: async (id) => {
        if (state.offline) throw new Error("Provider temporarily unavailable");
        if (!intents.has(id)) throw new Error("Intent missing");
        return copy(intents.get(id));
      },
      create: async (data, { idempotencyKey }) => {
        if (!requestKeys.has(idempotencyKey)) {
          const intent = {
            id: `pi_${++created}`,
            client_secret: "test-secret",
            status: "requires_payment_method",
            amount_received: 0,
            ...copy(data),
          };
          requestKeys.set(idempotencyKey, intent.id);
          intents.set(intent.id, intent);
        }
        return copy(intents.get(requestKeys.get(idempotencyKey)));
      },
      update: async (id, data) => {
        Object.assign(intents.get(id), copy(data));
        return copy(intents.get(id));
      },
    },
  };
  const mocks = {
    "@/actions/getCurrentUser": { getCurrentUser: async () => state.user },
    "@/libs/prismadb": { __esModule: true, default: prisma },
    "@/libs/stripe": { getStripe: () => stripe },
    "./stripe": { getStripe: () => stripe },
    "@/utils/products": { products },
    "@/libs/orderItems": orderItems,
    "@/libs/orderDelivery": orderDelivery,
    "@/libs/syncZaloPayOrder": { syncZaloPayOrder: async (order) => order },
    "next/server": {
      NextResponse: {
        json: (data, options) => Response.json(data, options),
        redirect: (url) =>
          new Response(null, {
            status: 307,
            headers: { Location: String(url) },
          }),
      },
    },
  };
  const sync = loadSource("libs/syncStripeOrder.ts", mocks);
  mocks["@/libs/paymentSignature"] = loadSource(
    "libs/paymentSignature.ts",
    mocks,
  );
  mocks["@/libs/vnpay"] = loadSource("libs/vnpay.ts", mocks);
  mocks["@/libs/momo"] = loadSource("libs/momo.ts", mocks);
  mocks["@/libs/paymentReference"] = loadSource(
    "libs/paymentReference.ts",
    mocks,
  );
  mocks["@/libs/paymentStatus"] = loadSource("libs/paymentStatus.ts", mocks);
  mocks["@/libs/checkoutRequest"] = loadSource(
    "libs/checkoutRequest.ts",
    mocks,
  );
  mocks["@/libs/syncStripeOrder"] = sync;
  const prepare = loadSource(
    "app/api/create-payment-intent/route.ts",
    mocks,
  ).POST;
  const verify = loadSource("app/api/order/stripe-status/route.ts", mocks).POST;
  const list = loadSource("app/api/order/route.ts", mocks).GET;
  const detail = loadSource("app/api/order/[orderId]/route.ts", mocks).GET;
  const webhook = loadSource("pages/api/stripe-webhook.ts", mocks).default;
  mocks["@/libs/createVnpayPayment"] = loadSource(
    "libs/createVnpayPayment.ts",
    mocks,
  );
  mocks["@/libs/createMomoPayment"] = loadSource(
    "libs/createMomoPayment.ts",
    mocks,
  );
  const deliveryRoutes = {
    COD: loadSource("app/api/order/create-cod/route.ts", mocks).POST,
    VNPAY: loadSource("app/api/vnpay/create-payment-url/route.ts", mocks).POST,
    MOMO: loadSource("app/api/momo/create-payment-url/route.ts", mocks).POST,
  };
  const providerReturns = {
    VNPAY: loadSource("app/api/vnpay/vnpay-return/route.ts", mocks).GET,
    MOMO: loadSource("app/api/momo/momo-return/route.ts", mocks).GET,
  };
  const request = (body) =>
    new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkout_request_id: randomUUID(), ...body }),
    });
  const create = (body = {}) =>
    prepare(
      request({ items: cart, checkout_request_id: "stable-request", ...body }),
    );
  const pay = (id) =>
    Object.assign(intents.get(id), {
      status: "succeeded",
      amount_received: intents.get(id).amount,
    });
  return {
    state,
    rows,
    checkoutRequests,
    paymentAttempts,
    intents,
    stripe,
    sync,
    verify,
    list,
    detail,
    webhook,
    request,
    create,
    pay,
    deliveryRoutes,
    providerReturns,
    created: () => created,
  };
}

test("parallel initialization, reload and retry reuse one intent and one draft order", async () => {
  const f = fixture();
  const responses = await Promise.all(
    Array.from({ length: 6 }, () => f.create()),
  );
  for (const response of responses) assert.equal(response.status, 200);
  assert.equal(f.created(), 1);
  assert.equal(f.rows.size, 1);
  assert.equal([...f.rows.values()][0].status, "draft");
  assert.deepEqual(await (await f.list()).json(), []);
  await f.create({ checkout_request_id: "another-tab" });
  assert.equal(f.created(), 1);
  f.state.uniqueConflict = true;
  assert.equal((await f.create({ payment_intent_id: "pi_1" })).status, 200);
  assert.equal(f.rows.size, 1);
});

test("server catalog determines the amount, name and image instead of client data", async () => {
  const f = fixture();
  const result = await (
    await f.create({
      items: [
        {
          ...cart[0],
          price: 1,
          name: "Tampered",
          selectedImg: {
            ...cart[0].selectedImg,
            image: "https://invalid.test/fake",
          },
        },
      ],
    })
  ).json();
  assert.equal(result.order.amount, product.price);
  assert.equal(result.order.products[0].name, product.name);
  assert.equal(
    result.order.products[0].selectedImg.image,
    product.images[0].image,
  );
});

test("empty, duplicated, unavailable products and invalid quantities create nothing", async () => {
  const f = fixture();
  for (const items of [
    [],
    [cart[0], cart[0]],
    [{ ...cart[0], quantity: 0 }],
    [{ ...cart[0], quantity: 21 }],
    [{ ...cart[0], quantity: 1.5 }],
    [{ ...cart[0], id: "missing" }],
    [{ ...cart[0], selectedImg: { color: "missing" } }],
  ]) {
    assert.equal((await f.create({ items })).status, 400);
  }
  assert.equal(f.created(), 0);
});

test("successful payment reconciles the existing row, persists shipping and appears once", async () => {
  const f = fixture();
  const { order } = await (await f.create()).json();
  f.pay("pi_1");
  f.intents.get("pi_1").shipping = {
    name: "Recipient",
    phone: "+84901234567",
    address: { line1: "Example address", country: "VN" },
  };
  const response = await f.verify(f.request({ payment_intent_id: "pi_1" }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).order.status, "complete");
  assert.equal(f.rows.get(order.id).address.line1, "Example address");
  assert.equal(f.rows.get(order.id).recipientName, "Recipient");
  assert.equal(f.rows.get(order.id).recipientPhone, "+84901234567");
  assert.equal((await (await f.list()).json()).length, 1);
  const repeated = await (await f.create({ payment_intent_id: "pi_1" })).json();
  assert.equal(repeated.alreadyPaid, true);
  assert.equal(f.created(), 1);
  assert.equal(f.rows.size, 1);
});

test("recipient validation rejects missing, invalid and oversized delivery details", () => {
  const valid = {
    fullName: " Recipient ",
    phone: "+84 901234567",
    address: " Example address ",
  };
  const delivery = orderDelivery.getOrderDelivery(valid);
  assert.equal(delivery.recipientName, "Recipient");
  assert.equal(delivery.recipientPhone, "+84901234567");
  assert.equal(delivery.address.line1, "Example address");
  for (const body of [
    null,
    {},
    { ...valid, fullName: " " },
    { ...valid, fullName: "x".repeat(101) },
    { ...valid, phone: "123" },
    { ...valid, phone: "+84abc123456" },
    { ...valid, address: "" },
    { ...valid, address: "x".repeat(501) },
  ])
    assert.equal(orderDelivery.getOrderDelivery(body), null);
});

test("COD, VNPay and MoMo persist the entered recipient and use server prices", async () => {
  const originalFetch = global.fetch;
  const gatewayAmounts = [];
  global.fetch = async (_url, options) => {
    gatewayAmounts.push(JSON.parse(options.body).amount);
    return Response.json({
      resultCode: 0,
      payUrl: "https://test-payment.momo.vn/gateway/pay",
    });
  };
  try {
    for (const method of ["COD", "VNPAY", "MOMO"]) {
      const f = fixture();
      const body = {
        fullName: " Delivery recipient ",
        phone: "+84 901234567",
        address: " Example address ",
        items: [{ ...cart[0], price: 1, name: "Tampered" }],
        amount: 1,
      };
      const invalid = await f.deliveryRoutes[method](
        f.request({ ...body, phone: "invalid" }),
      );
      assert.equal(invalid.status, 400);
      assert.equal(f.rows.size, 0);
      const response = await f.deliveryRoutes[method](f.request(body));
      assert.equal(response.status, 200);
      const saved = [...f.rows.values()][0];
      assert.equal(saved.recipientName, "Delivery recipient");
      assert.equal(saved.recipientPhone, "+84901234567");
      assert.equal(saved.address.line1, "Example address");
      assert.equal(saved.amount, product.price);
      assert.equal(saved.products[0].name, product.name);
      assert.equal(saved.status, "pending");
      f.state.user.name = "Updated account name";
      const detail = await f.detail(new Request("http://localhost/test"), {
        params: Promise.resolve({ orderId: saved.id }),
      });
      const data = await detail.json();
      assert.equal(data.recipientName, "Delivery recipient");
      assert.equal(data.recipientPhone, "+84901234567");
      if (method === "VNPAY")
        assert.equal(
          new URL((await response.json()).url).searchParams.get("vnp_Amount"),
          String(product.price * 100),
        );
    }
    assert.deepEqual(gatewayAmounts, [product.price]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("VNPay rejects missing or placeholder credentials before creating an order", async () => {
  const previous = {
    VNP_TMNCODE: process.env.VNP_TMNCODE,
    VNP_HASHSECRET: process.env.VNP_HASHSECRET,
  };
  try {
    for (const [tmnCode, secretKey] of [
      [undefined, "fixture-secret"],
      ["FIXTURE1", undefined],
      [" ", "fixture-secret"],
      ["TEST", "fixture-secret"],
      ["FIXTURE1", "TEST"],
    ]) {
      if (tmnCode === undefined) delete process.env.VNP_TMNCODE;
      else process.env.VNP_TMNCODE = tmnCode;
      if (secretKey === undefined) delete process.env.VNP_HASHSECRET;
      else process.env.VNP_HASHSECRET = secretKey;
      const f = fixture();
      const response = await f.deliveryRoutes.VNPAY(
        f.request({
          fullName: "Recipient",
          phone: "0901234567",
          address: "Example address",
          items: cart,
        }),
      );
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "VNPAY_NOT_CONFIGURED");
      assert.equal(f.rows.size, 0);
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("VNPay uses GMT+7 on a UTC server and includes the forwarded customer IP", async () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "UTC";
  try {
    const f = fixture();
    const request = f.request({
      fullName: "Recipient",
      phone: "0901234567",
      address: "Example address",
      items: cart,
    });
    request.headers.set("x-forwarded-for", "203.0.113.24, 10.0.0.1");
    const response = await f.deliveryRoutes.VNPAY(request);
    const params = new URL((await response.json()).url).searchParams;
    const formatted = params.get("vnp_CreateDate");
    const asUtc = Date.parse(
      `${formatted.slice(0, 4)}-${formatted.slice(4, 6)}-${formatted.slice(6, 8)}T${formatted.slice(8, 10)}:${formatted.slice(10, 12)}:${formatted.slice(12, 14)}Z`,
    );
    assert.ok(Math.abs(asUtc - 7 * 60 * 60 * 1000 - Date.now()) < 10000);
    assert.equal(params.get("vnp_IpAddr"), "203.0.113.24");
    assert.equal(params.get("vnp_Locale"), "en");
  } finally {
    previousTimezone === undefined
      ? delete process.env.TZ
      : (process.env.TZ = previousTimezone);
  }
});

test("MoMo app and browser links belong to the same pending order and carry catalog products", async () => {
  const originalFetch = global.fetch;
  try {
    for (const deeplink of [
      "momo://app?action=payWithApp&sid=fixture",
      undefined,
      "javascript:alert(1)",
      "not a url",
    ]) {
      let sent;
      global.fetch = async (_url, options) => {
        sent = JSON.parse(options.body);
        return Response.json({
          resultCode: 0,
          payUrl: "https://test-payment.momo.vn/gateway/pay?t=fixture",
          deeplink,
        });
      };
      const f = fixture();
      const response = await f.deliveryRoutes.MOMO(
        f.request({
          fullName: "Recipient",
          phone: "0901234567",
          address: "Example address",
          items: [{ ...cart[0], name: "Tampered", price: 1 }],
          amount: 1,
        }),
      );
      assert.equal(response.status, 200);
      const links = await response.json();
      const saved = [...f.rows.values()][0];
      assert.equal(f.rows.size, 1);
      assert.equal(links.orderId, saved.id);
      assert.equal(links.amount, saved.amount);
      assert.equal(
        links.deeplink,
        deeplink?.startsWith("momo:") ? deeplink : null,
      );
      assert.equal(
        links.url,
        "https://test-payment.momo.vn/gateway/pay?t=fixture",
      );
      assert.equal(saved.status, "pending");
      assert.equal(sent.orderId, saved.paymentIntentId);
      assert.equal(sent.items[0].name, product.name);
      assert.equal(sent.items[0].price, product.price);
      assert.equal(sent.items[0].quantity, 1);
      assert.equal(sent.items[0].totalPrice, links.amount);
      assert.equal(sent.lang, "en");
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test("a cart above the MoMo limit is rejected before creating an order or contacting the provider", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("Provider must not be called");
  };
  try {
    const f = fixture();
    const expensive = products.find(
      (p) => p.inStock && p.price * 20 > 50000000,
    );
    const response = await f.deliveryRoutes.MOMO(
      f.request({
        fullName: "Recipient",
        phone: "0901234567",
        address: "Example address",
        items: [
          { ...expensive, selectedImg: expensive.images[0], quantity: 20 },
        ],
        amount: 1,
      }),
    );
    assert.equal(response.status, 400);
    assert.equal(f.rows.size, 0);
    assert.match((await response.json()).error, /50,000,000 VND/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("signed VNPay/MoMo returns include the internal order ID without changing payment state", async () => {
  const previous = {
    VNP_HASHSECRET: process.env.VNP_HASHSECRET,
    MOMO_ACCESS_KEY: process.env.MOMO_ACCESS_KEY,
    MOMO_SECRET_KEY: process.env.MOMO_SECRET_KEY,
  };
  process.env.VNP_HASHSECRET = "fixture-vnp-secret";
  process.env.MOMO_ACCESS_KEY = "fixture-momo-access";
  process.env.MOMO_SECRET_KEY = "fixture-momo-secret";
  try {
    for (const method of ["VNPAY", "MOMO"]) {
      const f = fixture();
      f.rows.set("order-fixture", {
        id: "order-fixture",
        userId: "owner",
        paymentIntentId: "gateway-ref",
        status: "pending",
        paymentMethod: method,
        amount: product.price,
        currency: "vnd",
      });
      let params;
      if (method === "VNPAY") {
        params = new URLSearchParams({
          vnp_Amount: String(product.price * 100),
          vnp_ResponseCode: "00",
          vnp_TmnCode: "FIXTURE1",
          vnp_TransactionNo: "12345",
          vnp_TransactionStatus: "00",
          vnp_TxnRef: "gateway-ref",
        });
        params.set(
          "vnp_SecureHash",
          createHmac("sha512", "fixture-vnp-secret")
            .update(params.toString())
            .digest("hex"),
        );
      } else {
        const fields = {
          amount: String(product.price),
          extraData: "",
          message: "Success",
          orderId: "gateway-ref",
          orderInfo: "SGTech order",
          orderType: "momo_wallet",
          partnerCode: "MOMO",
          payType: "qr",
          requestId: "gateway-ref",
          responseTime: "1700000000000",
          resultCode: "0",
          transId: "12345",
        };
        const raw = [
          "accessKey=fixture-momo-access",
          ...Object.entries(fields).map(([key, value]) => `${key}=${value}`),
        ].join("&");
        params = new URLSearchParams(fields);
        params.set(
          "signature",
          createHmac("sha256", "fixture-momo-secret").update(raw).digest("hex"),
        );
      }
      const invalidParams = new URLSearchParams(params);
      invalidParams.set(
        method === "VNPAY" ? "vnp_SecureHash" : "signature",
        "invalid",
      );
      const invalid = await f.providerReturns[method](
        new Request(`http://localhost/callback?${invalidParams}`),
      );
      assert.match(invalid.headers.get("Location"), /invalid_signature/);
      assert.equal(f.rows.get("order-fixture").status, "pending");
      const response = await f.providerReturns[method](
        new Request(`http://localhost/callback?${params}`),
      );
      assert.equal(response.status, 307);
      assert.equal(
        new URL(response.headers.get("Location")).searchParams.get("order"),
        "order-fixture",
      );
      assert.equal(f.rows.get("order-fixture").status, "pending");
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("two actual successful payments stay as distinct paid orders", async () => {
  const f = fixture();
  await f.create();
  f.pay("pi_1");
  await f.list();
  await f.create({ checkout_request_id: "new-purchase" });
  f.pay("pi_2");
  const orders = await (await f.list()).json();
  assert.equal(orders.length, 2);
  assert.ok(orders.every((order) => order.status === "complete"));
});

function checkoutBody(patch = {}) {
  return {
    checkout_request_id: "repeat-checkout",
    items: cart,
    fullName: "Recipient",
    phone: "0901234567",
    address: "Example address",
    ...patch,
  };
}

test("repeated and concurrent COD/VNPay checkout requests create one order and one attempt", async () => {
  for (const method of ["COD", "VNPAY"]) {
    const f = fixture();
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        f.deliveryRoutes[method](f.request(checkoutBody())),
      ),
    );
    assert.ok(responses.every((response) => response.status === 200));
    assert.equal(f.rows.size, 1);
    assert.equal(f.checkoutRequests.size, 1);
    assert.equal(f.paymentAttempts.size, 1);
    const bodies = await Promise.all(
      responses.map((response) => response.json()),
    );
    if (method === "VNPAY") {
      assert.equal(new Set(bodies.map((body) => body.url)).size, 1);
      assert.match(
        new URL(bodies[0].url).searchParams.get("vnp_TxnRef"),
        /^[a-z0-9]+$/i,
      );
    } else {
      assert.equal(new Set(bodies.map((body) => body.order.id)).size, 1);
    }
    assert.equal(
      (await f.deliveryRoutes[method](f.request(checkoutBody()))).status,
      200,
    );
    assert.equal(f.rows.size, 1);
  }
});

test("same checkout key rejects changed delivery, products, bank or payment method", async () => {
  const f = fixture();
  assert.equal(
    (await f.deliveryRoutes.VNPAY(f.request(checkoutBody()))).status,
    200,
  );
  for (const [method, patch] of [
    ["COD", {}],
    ["VNPAY", { fullName: "Someone else" }],
    ["VNPAY", { items: [{ ...cart[0], quantity: 2 }] }],
    ["VNPAY", { bankCode: "VISA" }],
  ]) {
    const response = await f.deliveryRoutes[method](
      f.request(checkoutBody(patch)),
    );
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "CHECKOUT_REQUEST_CONFLICT");
  }
  assert.equal(f.rows.size, 1);
  assert.equal(
    (
      await f.deliveryRoutes.VNPAY(
        f.request(
          checkoutBody({ amount: 1, items: [{ ...cart[0], price: 1 }] }),
        ),
      )
    ).status,
    200,
  );
});

test("checkout keys are scoped to the authenticated user and missing keys create no orders", async () => {
  const f = fixture();
  for (const method of ["COD", "VNPAY", "MOMO"]) {
    const rejected = await f.deliveryRoutes[method](
      f.request(checkoutBody({ checkout_request_id: undefined })),
    );
    assert.equal(rejected.status, 400);
  }
  assert.equal(f.rows.size, 0);
  await f.deliveryRoutes.COD(f.request(checkoutBody()));
  f.state.user = { id: "other-user", role: "USER" };
  await f.deliveryRoutes.COD(f.request(checkoutBody()));
  assert.equal(f.rows.size, 2);
  assert.equal(f.checkoutRequests.size, 2);
});

test("concurrent and reloaded MoMo checkout requests call the provider exactly once", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return Response.json({
      resultCode: 0,
      payUrl: "https://test-payment.momo.vn/pay",
      deeplink: "momo://pay",
    });
  };
  try {
    const f = fixture();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        f.deliveryRoutes.MOMO(f.request(checkoutBody())),
      ),
    );
    assert.equal(
      responses.filter((response) => response.status === 200).length,
      1,
    );
    assert.equal(
      responses.filter((response) => response.status === 409).length,
      4,
    );
    const retry = await f.deliveryRoutes.MOMO(f.request(checkoutBody()));
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).url, "https://test-payment.momo.vn/pay");
    assert.equal(calls, 1);
    assert.equal(f.rows.size, 1);
    assert.equal(f.paymentAttempts.size, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("MoMo timeouts and ambiguous responses retain the same attempt and block new provider calls", async () => {
  const originalFetch = global.fetch;
  try {
    for (const mode of [
      "timeout",
      "invalid-link",
      "rejected",
      "wrong-reference",
    ]) {
      let calls = 0;
      global.fetch = async () => {
        calls++;
        if (mode === "timeout") throw new Error("timeout");
        return Response.json(
          mode === "rejected"
            ? { resultCode: 99 }
            : {
                resultCode: 0,
                payUrl:
                  mode === "invalid-link"
                    ? "https://attacker.test/pay"
                    : "https://test-payment.momo.vn/pay",
                ...(mode === "wrong-reference" ? { orderId: "foreign" } : {}),
              },
        );
      };
      const f = fixture();
      const first = await f.deliveryRoutes.MOMO(f.request(checkoutBody()));
      assert.equal(first.status, 502);
      assert.ok((await first.json()).orderId);
      assert.equal(
        (await f.deliveryRoutes.MOMO(f.request(checkoutBody()))).status,
        409,
      );
      assert.equal(calls, 1);
      assert.equal(f.rows.size, 1);
      assert.equal([...f.paymentAttempts.values()][0].state, "UNKNOWN");
      assert.equal([...f.rows.values()][0].status, "pending");
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test("VNPay expired links and changed merchant configurations cannot generate a second attempt", async () => {
  const f = fixture();
  await f.deliveryRoutes.VNPAY(f.request(checkoutBody()));
  const attempt = [...f.paymentAttempts.values()][0];
  attempt.expiresAt = new Date(0);
  assert.equal(
    (await f.deliveryRoutes.VNPAY(f.request(checkoutBody()))).status,
    409,
  );
  const previous = process.env.VNP_TMNCODE;
  process.env.VNP_TMNCODE = "DIFFERENT";
  try {
    const response = await f.deliveryRoutes.VNPAY(f.request(checkoutBody()));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "PAYMENT_ATTEMPT_CONFLICT");
  } finally {
    process.env.VNP_TMNCODE = previous;
  }
  assert.equal(f.rows.size, 1);
});

test("a persisted checkout request recovers if the process stopped before order creation", async () => {
  const f = fixture();
  await f.deliveryRoutes.COD(f.request(checkoutBody()));
  f.rows.clear();
  f.paymentAttempts.clear();
  const response = await f.deliveryRoutes.COD(f.request(checkoutBody()));
  assert.equal(response.status, 200);
  assert.equal(f.checkoutRequests.size, 1);
  assert.equal(f.rows.size, 1);
});

test("retrying a settled checkout returns the receipt instead of a payable link", async () => {
  const f = fixture();
  await f.deliveryRoutes.VNPAY(f.request(checkoutBody()));
  const order = [...f.rows.values()][0];
  order.status = "paid";
  const response = await f.deliveryRoutes.VNPAY(f.request(checkoutBody()));
  const body = await response.json();
  assert.equal(body.alreadyPaid, true);
  assert.equal(body.orderId, order.id);
  assert.equal(body.url, undefined);
  assert.equal(f.rows.size, 1);
});

test("processing and authentication-required payments block a new charge", async () => {
  for (const status of ["processing", "requires_capture", "requires_action"]) {
    const f = fixture();
    await f.create();
    f.intents.get("pi_1").status = status;
    assert.equal((await f.create({ payment_intent_id: "pi_1" })).status, 409);
    assert.equal(
      (await f.create({ checkout_request_id: "another-tab" })).status,
      409,
    );
    assert.equal(f.created(), 1);
  }
});

test("cancelled cached payment prompts a fresh attempt instead of reusing a dead secret", async () => {
  const f = fixture();
  await f.create();
  f.intents.get("pi_1").status = "canceled";
  const response = await f.create({ payment_intent_id: "pi_1" });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "INVALID_PAYMENT_REFERENCE");
  assert.equal([...f.rows.values()][0].status, "failed");
  assert.equal(
    (await f.create({ checkout_request_id: "fresh-attempt" })).status,
    200,
  );
  assert.equal(f.created(), 2);
});

test("legacy unpaid duplicate rows are drafts; the succeeded row becomes complete on read", async () => {
  const f = fixture();
  await f.create();
  await f.create({
    items: [{ ...cart[0], quantity: 2 }],
    checkout_request_id: "second",
  });
  for (const row of f.rows.values()) row.status = "pending";
  f.pay("pi_1");
  const orders = await (await f.list()).json();
  assert.equal(orders.length, 1);
  assert.equal(orders[0].status, "complete");
  assert.equal(f.rows.size, 2);
});

test("anonymous and other users cannot retrieve, update or claim an intent", async () => {
  const f = fixture();
  const { order } = await (await f.create()).json();
  f.state.user = null;
  assert.equal((await f.create()).status, 401);
  assert.equal(
    (await f.verify(f.request({ payment_intent_id: "pi_1" }))).status,
    401,
  );
  f.state.user = { id: "other", role: "USER" };
  assert.equal((await f.create({ payment_intent_id: "pi_1" })).status, 400);
  assert.equal(
    (
      await f.verify(
        f.request({ payment_intent_id: "pi_1", status: "complete" }),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await f.detail(new Request("http://localhost/test"), {
        params: Promise.resolve({ orderId: order.id }),
      })
    ).status,
    403,
  );
  assert.equal(f.intents.get("pi_1").amount, product.price);
  assert.equal(f.created(), 1);
});

test("client success flags, provider outage, wrong amount/currency and partial receipts never mark paid", async () => {
  const f = fixture();
  await f.create();
  const verify = () =>
    f.verify(
      f.request({
        payment_intent_id: "pi_1",
        status: "complete",
        redirect_status: "succeeded",
      }),
    );
  assert.equal((await (await verify()).json()).order.status, "draft");
  f.state.offline = true;
  assert.equal((await verify()).status, 502);
  f.state.offline = false;
  f.pay("pi_1");
  for (const change of [
    { currency: "usd" },
    { amount: 1 },
    { amount_received: 1 },
  ]) {
    const original = copy(f.intents.get("pi_1"));
    Object.assign(f.intents.get("pi_1"), change);
    assert.equal((await verify()).status, 502);
    assert.equal([...f.rows.values()][0].status, "draft");
    f.intents.set("pi_1", original);
  }
});

test("a stale processing update cannot overwrite a concurrent successful webhook", async () => {
  const f = fixture();
  const { order } = await (await f.create()).json();
  f.intents.get("pi_1").status = "processing";
  f.state.race = () => {
    f.rows.get(order.id).status = "complete";
  };
  const result = await f.sync.syncStripeOrder(order);
  assert.equal(result.status, "complete");
  assert.equal(f.rows.get(order.id).status, "complete");
  f.intents.get("pi_1").status = "requires_payment_method";
  assert.equal((await f.sync.syncStripeOrder(result)).status, "complete");
});

test("signed webhook retries and out-of-order events update an existing order once", async () => {
  const f = fixture();
  await f.create();
  f.pay("pi_1");
  const previous = process.env.STRIPE_WEBHOOK_SECRET;
  const secret = "whsec_unit_test_only";
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  async function event(type, id = "pi_1", invalid = false) {
    const payload = JSON.stringify({
      id: "evt_fixture",
      object: "event",
      type,
      data: { object: { id, payment_intent: "pi_1", status: "processing" } },
    });
    const req = Readable.from([Buffer.from(payload)]);
    req.method = "POST";
    req.headers = {
      "stripe-signature": invalid
        ? "invalid"
        : f.stripe.webhooks.generateTestHeaderString({ payload, secret }),
    };
    const res = {
      code: 200,
      status(code) {
        this.code = code;
        return this;
      },
      send() {
        return this;
      },
      end() {
        return this;
      },
      json() {
        return this;
      },
    };
    await f.webhook(req, res);
    return res.code;
  }
  try {
    assert.equal(await event("payment_intent.succeeded", "pi_1", true), 400);
    assert.equal([...f.rows.values()][0].status, "draft");
    for (const type of [
      "payment_intent.succeeded",
      "payment_intent.succeeded",
      "payment_intent.processing",
      "charge.succeeded",
    ])
      assert.equal(await event(type), 200);
    assert.equal([...f.rows.values()][0].status, "complete");
    assert.equal(f.rows.size, 1);
    assert.equal(await event("payment_intent.succeeded", "pi_not_ready"), 503);
  } finally {
    if (previous === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previous;
  }
});
