const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHmac } = require("node:crypto");
const ts = require("typescript");
const {
  installStockDatabase,
  matches: stockMatches,
} = require("./fixtures/stock-db.cjs");

// No real credentials, database, network calls or payments.
Object.assign(process.env, {
  ZALOPAY_APP_ID: "1234",
  ZALOPAY_KEY1: "fixture-key1",
  ZALOPAY_KEY2: "fixture-key2",
  NEXT_PUBLIC_APP_URL: "https://store.example.test",
  ZALOPAY_CALLBACK_URL: "https://store.example.test/api/zalopay/callback",
});
function load(file, mocks = {}) {
  const filename = path.join(__dirname, "..", file);
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, {
    filename,
  })(
    (name) =>
      name in mocks
        ? mocks[name]
        : name.startsWith("@/")
          ? (mocks[name] = load(name.slice(2) + ".ts", mocks))
          : require(name),
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}
const mac = (data, key) => createHmac("sha256", key).update(data).digest("hex");
const { products } = load("utils/products.tsx");
const orderDelivery = load("libs/orderDelivery.ts");
const zalo = load("libs/zalopay.ts");
const product = products.find((p) => p.inStock);
const payload = {
  items: [
    {
      id: product.id,
      quantity: 1,
      selectedImg: product.images[0],
      price: product.price,
    },
  ],
  amount: 1,
  address: "12 Example Street",
  phone: "0901234567",
  fullName: "Recipient",
  checkout_request_id: "stable-id",
};
function fixture(shippingFee = 0) {
  const rows = new Map();
  const requests = [];
  const state = {
    user: { id: "670000000000000000000099" },
    createResult: {
      return_code: 1,
      order_url: "https://qcgateway.zalopay.vn/openinapp?order=fixture",
    },
    queryResult: { return_code: 3, is_processing: false },
    offline: false,
    dbOffline: false,
    race: null,
  };
  const matches = (row, where) =>
    Object.entries(where).every(([key, value]) =>
      value && typeof value === "object" && value.notIn
        ? !value.notIn.includes(row[key])
        : value &&
            typeof value === "object" &&
            ("is" in value || "isSet" in value)
          ? stockMatches(row, { [key]: value })
          : row[key] === value,
    );
  const prisma = {
    order: {
      findUnique: async ({ where }) =>
        structuredClone(
          [...rows.values()].find((row) => matches(row, where)) || null,
        ),
      findFirst: async ({ where }) =>
        structuredClone(
          [...rows.values()].find((row) => matches(row, where)) || null,
        ),
      create: async ({ data }) => {
        if (
          [...rows.values()].some(
            (row) => row.paymentIntentId === data.paymentIntentId,
          )
        )
          throw Object.assign(new Error("Duplicate reference"), {
            code: "P2002",
          });
        const row = {
          id: (rows.size + 1).toString(16).padStart(24, "0"),
          createDate: new Date(),
          ...structuredClone(data),
        };
        rows.set(row.id, row);
        return structuredClone(row);
      },
      update: async ({ where, data }) => {
        const row = [...rows.values()].find((row) => matches(row, where));
        assert.ok(row);
        Object.assign(row, structuredClone(data));
        return structuredClone(row);
      },
      updateMany: async ({ where, data }) => {
        if (state.dbOffline) throw new Error("Database unavailable");
        if (state.race) {
          state.race();
          state.race = null;
        }
        let count = 0;
        for (const row of rows.values())
          if (matches(row, where)) {
            Object.assign(row, structuredClone(data));
            count++;
          }
        return { count };
      },
    },
  };
  const provider = {
    ...zalo,
    callZaloPay: async (operation, data) => {
      requests.push({ operation, data });
      if (state.offline) throw new Error("Provider timeout");
      return structuredClone(
        operation === "create" ? state.createResult : state.queryResult,
      );
    },
  };
  const checkoutRequests = new Map();
  const attempts = new Map();
  const model = (records) => ({
    findUnique: async ({ where }) =>
      structuredClone(records.get(where.id) || null),
    create: async ({ data }) => {
      if (records.has(data.id))
        throw Object.assign(new Error("Duplicate"), { code: "P2002" });
      const row = { state: "CREATED", ...structuredClone(data) };
      records.set(row.id, row);
      return structuredClone(row);
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of records.values())
        if (stockMatches(row, where)) {
          Object.assign(row, structuredClone(data));
          count++;
        }
      return { count };
    },
    findMany: async ({ where }) =>
      [...records.values()].filter((row) => stockMatches(row, where)),
  });
  prisma.checkoutRequest = model(checkoutRequests);
  prisma.paymentAttempt = model(attempts);
  installStockDatabase(prisma, products, [rows, checkoutRequests, attempts]);
  const mocks = {
    "@/libs/checkoutQuote": require("./fixtures/approved-checkout.cjs").withFee(shippingFee),
    "@/actions/getCurrentUser": { getCurrentUser: async () => state.user },
    "@/libs/prismadb": { __esModule: true, default: prisma },
    "@/libs/orderDelivery": orderDelivery,
    "@/libs/zalopay": provider,
    "./zalopay": provider,
    "next/server": {
      NextResponse: { json: (data, options) => Response.json(data, options) },
    },
  };
  const sync = load("libs/syncZaloPayOrder.ts", mocks);
  mocks["@/libs/syncZaloPayOrder"] = sync;
  const createRoute = load(
    "app/api/zalopay/create-payment-url/route.ts",
    mocks,
  ).POST;
  const callbackRoute = load("app/api/zalopay/callback/route.ts", mocks).POST;
  const statusRoute = load("app/api/zalopay/status/route.ts", mocks).POST;
  const request = (body) =>
    new Request("https://store.example.test/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const create = (extra = {}) => createRoute(request({ ...payload, ...extra }));
  const first = () => [...rows.values()][0];
  const callback = (extra = {}, options = {}) => {
    const order = first();
    const data = JSON.stringify({
      app_id: 1234,
      app_trans_id: order.paymentIntentId,
      app_user: order.userId,
      amount: order.amount,
      zp_trans_id: 1234567,
      ...extra,
    });
    return callbackRoute(
      request({ type: 1, data, mac: mac(data, "fixture-key2"), ...options }),
    );
  };
  return {
    state,
    rows,
    requests,
    create,
    first,
    callback,
    request,
    callbackRoute,
    status: (id) => statusRoute(request({ orderId: id })),
    sync: sync.syncZaloPayOrder,
  };
}

test("ZaloPay references use Vietnam date around UTC midnight", () => {
  assert.equal(zalo.zaloPayDate(new Date("2026-10-11T18:00:00Z")), "261012");
  assert.equal(zalo.zaloPayDate(new Date("2026-12-31T18:00:00Z")), "270101");
});

test("ZaloPay create, MAC, response and stored attempt use the delivery-inclusive total", async () => {
  const f = fixture(15000);
  const response = await f.create(); assert.equal(response.status, 200);
  const body = await response.json(), order = f.first();
  const request = f.requests.find(row => row.operation === 'create').data;
  assert.equal(request.amount, product.price + 15000);
  assert.equal(body.amount, request.amount); assert.equal(order.amount, request.amount);
  assert.equal(request.mac, mac(`${request.app_id}|${request.app_trans_id}|${request.app_user}|${request.amount}|${request.app_time}|${request.embed_data}|${request.item}`, 'fixture-key1'));
});
test("MAC validation checks exact data and rejects malformed signatures", () => {
  assert.equal(zalo.verifyZaloPayMac("data", mac("data", "key"), "key"), true);
  for (const value of ["", null, "g".repeat(64), mac("tampered", "key")])
    assert.equal(zalo.verifyZaloPayMac("data", value, "key"), false);
});
test("provider adapter always uses Sandbox POST endpoints and rejects HTTP/invalid responses", async () => {
  const original = global.fetch;
  const requests = [];
  try {
    global.fetch = async (url, options) => {
      requests.push({ url, options });
      return Response.json({ return_code: 3 });
    };
    await zalo.callZaloPay("query", {
      app_id: 1234,
      app_trans_id: "fixture",
      mac: "signed",
    });
    assert.equal(requests[0].url, "https://sb-openapi.zalopay.vn/v2/query");
    assert.equal(requests[0].options.method, "POST");
    assert.equal(requests[0].options.cache, "no-store");
    global.fetch = async () => new Response("", { status: 503 });
    await assert.rejects(zalo.callZaloPay("create", {}));
    global.fetch = async () => Response.json({ return_code: "1" });
    await assert.rejects(zalo.callZaloPay("create", {}));
  } finally {
    global.fetch = original;
  }
});
test("payment URL rejects untrusted hosts, credentials and non-HTTPS URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "https://zalopay.vn.evil.test",
    "http://qcgateway.zalopay.vn",
    "https://user:pass@qcgateway.zalopay.vn",
  ])
    assert.equal(zalo.safeZaloPayPaymentUrl(url), null);
});
test("missing merchant keys return 503 without creating an order or contacting provider", async () => {
  const f = fixture();
  const saved = process.env.ZALOPAY_KEY1;
  delete process.env.ZALOPAY_KEY1;
  try {
    assert.equal((await f.create()).status, 503);
    assert.equal(f.rows.size, 0);
    assert.equal(f.requests.length, 0);
  } finally {
    process.env.ZALOPAY_KEY1 = saved;
  }
});
test("localhost callback is rejected before creating an order", async () => {
  const f = fixture();
  const saved = process.env.ZALOPAY_CALLBACK_URL;
  process.env.ZALOPAY_CALLBACK_URL =
    "http://localhost:3000/api/zalopay/callback";
  try {
    assert.equal((await f.create()).status, 503);
    assert.equal(f.rows.size, 0);
  } finally {
    process.env.ZALOPAY_CALLBACK_URL = saved;
  }
});
test("create uses catalog amount, preserves recipient and signs request with Key1", async () => {
  const f = fixture();
  const result = await (await f.create()).json();
  const order = f.first();
  const sent = f.requests[0].data;
  assert.equal(result.amount, product.price);
  assert.equal(order.amount, product.price);
  assert.equal(order.status, "pending");
  assert.equal(order.deliveryStatus, "pending");
  assert.equal(order.recipientName, payload.fullName);
  assert.equal(order.recipientPhone, payload.phone);
  assert.equal(order.address.line1, payload.address);
  assert.match(sent.app_trans_id, /^\d{6}_[a-f0-9]{24}$/);
  assert.equal(sent.amount, product.price);
  assert.equal(
    sent.mac,
    mac(
      `${sent.app_id}|${sent.app_trans_id}|${sent.app_user}|${sent.amount}|${sent.app_time}|${sent.embed_data}|${sent.item}`,
      "fixture-key1",
    ),
  );
  assert.equal(sent.callback_url, process.env.ZALOPAY_CALLBACK_URL);
  assert.equal(sent.expire_duration_seconds, 900);
  assert.equal(
    JSON.parse(sent.embed_data).redirecturl,
    `https://store.example.test/checkout?zalopay=return&order=${order.id}`,
  );
  assert.equal(order.paymentUrl, result.url);
});
test("invalid cart or recipient creates no order", async () => {
  const f = fixture();
  for (const extra of [
    { items: [] },
    { phone: "x" },
    { fullName: "" },
    { items: [{ ...payload.items[0], quantity: -1 }] },
  ])
    assert.equal((await f.create(extra)).status, 400);
  assert.equal(f.rows.size, 0);
  assert.equal(f.requests.length, 0);
});
test("repeated and concurrent checkout requests create one order and provider transaction", async () => {
  const f = fixture();
  const responses = await Promise.all(
    Array.from({ length: 6 }, () => f.create()),
  );
  assert.ok(responses.every((r) => [200, 409].includes(r.status)));
  assert.equal(f.rows.size, 1);
  assert.equal(f.requests.length, 1);
  const resumed = await (await f.create()).json();
  assert.equal(resumed.url, f.first().paymentUrl);
  assert.equal(f.requests.length, 1);
});
test("explicit create rejection marks failed; timeout remains pending without duplicate retry", async () => {
  const f = fixture();
  f.state.createResult = { return_code: 2 };
  assert.equal((await f.create()).status, 502);
  assert.equal(f.first().status, "failed");
  const g = fixture();
  g.state.offline = true;
  assert.equal((await g.create()).status, 502);
  assert.equal(g.first().status, "pending");
  assert.equal((await g.create()).status, 409);
  assert.equal(g.requests.length, 1);
});
test("invalid callback signature/type/payload does not mark paid", async () => {
  const f = fixture();
  await f.create();
  for (const options of [
    { mac: "bad" },
    { type: 2 },
    { data: "{", mac: mac("{", "fixture-key2") },
  ])
    assert.equal(
      (await (await f.callback({}, options)).json()).return_code,
      -1,
    );
  assert.equal(f.first().status, "pending");
});
test("signed callback must match app, user, amount, currency and payment method", async () => {
  const f = fixture();
  await f.create();
  for (const data of [
    { app_id: 5678 },
    { app_user: "someone-else" },
    { amount: 1 },
    { amount: "7197600" },
  ])
    assert.equal((await (await f.callback(data)).json()).return_code, -1);
  f.first().paymentMethod = "MOMO";
  assert.equal((await (await f.callback()).json()).return_code, -1);
  f.first().paymentMethod = "ZALOPAY";
  f.first().currency = "usd";
  assert.equal((await (await f.callback()).json()).return_code, -1);
});
test("callback repeats acknowledge once-paid order and do not alter delivery", async () => {
  const f = fixture();
  await f.create();
  for (let i = 0; i < 3; i++)
    assert.equal((await (await f.callback()).json()).return_code, 1);
  assert.equal(f.first().status, "paid");
  assert.equal(f.first().deliveryStatus, "pending");
  const resumed = await (await f.create()).json();
  assert.equal(resumed.alreadyPaid, true);
  assert.equal(f.requests.length, 1);
});
test("callback database failure asks provider to retry rather than acknowledging success", async () => {
  const f = fixture();
  await f.create();
  f.state.dbOffline = true;
  assert.equal((await (await f.callback()).json()).return_code, 0);
  assert.equal(f.first().status, "pending");
  f.state.dbOffline = false;
  assert.equal((await (await f.callback()).json()).return_code, 1);
});
test("missing callback order requests retry", async () => {
  const f = fixture();
  await f.create();
  const response = f.callback({ app_trans_id: "261012_missing" });
  assert.equal((await (await response).json()).return_code, 0);
});
test("status query recovers a missed callback using Key1 and exact amount", async () => {
  const f = fixture();
  await f.create();
  f.state.queryResult = { return_code: 1, amount: product.price };
  const result = await (await f.status(f.first().id)).json();
  assert.equal(result.order.status, "paid");
  const sent = f.requests[1].data;
  assert.equal(
    sent.mac,
    mac(`1234|${sent.app_trans_id}|fixture-key1`, "fixture-key1"),
  );
});
test("query pending, timeout, error and wrong amount never mark paid", async () => {
  const f = fixture();
  await f.create();
  const id = f.first().id;
  assert.equal((await (await f.status(id)).json()).order.status, "pending");
  for (const result of [
    { return_code: 2 },
    { return_code: 1, amount: 1 },
    { return_code: 1 },
  ]) {
    f.state.queryResult = result;
    assert.equal((await f.status(id)).status, 502);
    assert.equal(f.first().status, "pending");
  }
  f.state.offline = true;
  assert.equal((await f.status(id)).status, 502);
  assert.equal(f.first().status, "pending");
});
test("paid order stays paid when query is offline or an old response races with callback", async () => {
  const f = fixture();
  await f.create();
  const snapshot = structuredClone(f.first());
  await f.callback();
  f.state.offline = true;
  assert.equal((await f.sync(f.first())).status, "paid");
  f.state.offline = false;
  f.state.queryResult = { return_code: 3 };
  assert.equal((await f.sync(snapshot)).status, "paid");
});
test("expired unpaid link becomes retryable only after a nonprocessing provider response", async () => {
  const f = fixture();
  await f.create();
  f.first().paymentExpiresAt = new Date(Date.now() - 1000);
  f.state.queryResult = { return_code: 3, is_processing: true };
  assert.equal((await (await f.create()).json()).code, "ZALOPAY_PENDING");
  assert.equal(f.first().status, "pending");
  f.state.queryResult = { return_code: 3, is_processing: false };
  assert.equal((await (await f.create()).json()).code, "ZALOPAY_CREATE_FAILED");
  assert.equal(f.first().status, "failed");
  assert.equal(
    (await f.create({ checkout_request_id: "new-request" })).status,
    200,
  );
  assert.equal(f.rows.size, 2);
});
test("a concurrent successful callback wins over expiry reconciliation", async () => {
  const f = fixture();
  await f.create();
  f.first().paymentExpiresAt = new Date(Date.now() - 1000);
  f.state.race = () => {
    f.first().status = "paid";
  };
  assert.equal((await f.sync(structuredClone(f.first()))).status, "paid");
});
test("anonymous users and other owners cannot create or query payments", async () => {
  const f = fixture();
  await f.create();
  const id = f.first().id;
  f.state.user = null;
  assert.equal((await f.create()).status, 401);
  assert.equal((await f.status(id)).status, 401);
  f.state.user = { id: "670000000000000000000088" };
  assert.equal((await f.status(id)).status, 404);
  assert.equal((await f.status("bad")).status, 400);
});

// Render the real checkout with a tiny hook runtime. Exercise actual effects and
// submit handlers, with provider/Stripe/browser adapters replaced, without a DOM.
function hooks() {
  const slots = [];
  let cursor = 0;
  const effects = [];
  return {
    reset: () => {
      cursor = 0;
      effects.length = 0;
    },
    effects,
    react: {
      useState: (initial) => {
        const index = cursor++;
        if (!(index in slots))
          slots[index] = typeof initial === "function" ? initial() : initial;
        return [
          slots[index],
          (value) => {
            slots[index] =
              typeof value === "function" ? value(slots[index]) : value;
          },
        ];
      },
      useRef: (initial) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { current: initial };
        return slots[index];
      },
      useCallback: (callback) => callback,
      useEffect: (effect) => {
        effects.push(effect);
      },
    },
  };
}
function findElement(tree, predicate) {
  if (!tree || typeof tree !== "object") return null;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (predicate(tree)) return tree;
  return findElement(tree.props?.children, predicate);
}
test("checkout renders COD/ZaloPay without initializing Stripe and verifies the return on server", async () => {
  const h = hooks();
  const requests = [];
  let query = new URLSearchParams();
  let clearCount = 0;
  const Form = () => null;
  const card = () => null;
  const context = {
    cartProducts: payload.items,
    paymentIntent: null,
    handleClearCart: () => clearCount++,
    handleSetPaymentIntent: () => {},
  };
  const paths = load("utils/apiPaths.ts");
  const Client = load("app/checkout/CheckoutClient.tsx", {
    react: h.react,
    "@stripe/stripe-js/pure": {
      loadStripe: () => {
        throw new Error("Stripe must not load for wallets");
      },
    },
    "@stripe/react-stripe-js": { Elements: card },
    "./StripePaymentElement": { __esModule: true, default: card },
    "../hooks/useCart": { useCart: () => ({ context }) },
    "../checkout/CheckoutForm": { __esModule: true, default: Form },
    "next/navigation": {
      useRouter: () => ({ push() {} }),
      useSearchParams: () => query,
    },
    "react-hot-toast": { __esModule: true, default: { error() {} } },
    "../components/Button": { __esModule: true, default: () => null },
    "next/link": { __esModule: true, default: () => null },
    "@/utils/formatPrice": { formatPrice: String },
    "../../utils/apiPaths": paths,
  }).default;
  const previousFetch = global.fetch;
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return Response.json({
      order: {
        id: "000000000000000000000001",
        paymentMethod: "ZALOPAY",
        amount: product.price,
        status: "pending",
      },
    });
  };
  try {
    h.reset();
    const tree = Client({ currentUser: { id: "owner" } });
    const form = findElement(tree, (e) => e.type === Form);
    assert.ok(form);
    assert.equal(form.props.paymentMethod, "COD");
    for (const effect of h.effects) effect();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(requests.length, 0);
    form.props.onPaymentMethodChange("ZALOPAY");
    h.reset();
    Client({ currentUser: { id: "owner" } });
    for (const effect of h.effects) effect();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(requests.length, 0);
    query = new URLSearchParams(
      "zalopay=return&order=000000000000000000000001&status=1",
    );
    h.reset();
    Client({ currentUser: { id: "owner" } });
    for (const effect of h.effects) effect();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(requests[0].url, paths.API_PATHS.PAYMENT.ZALOPAY_STATUS);
    assert.equal(clearCount, 0);
  } finally {
    global.fetch = previousFetch;
  }
});
for (const [paymentMethod, outcome] of [
  ["ZALOPAY", "redirect"],
  ["MOMO", "redirect"],
  ["MOMO", "missing-url"],
  ["MOMO", "navigation-failure"],
  ["MOMO", "already-paid"],
  ["MOMO", "return-back"],
]) {
  test(`${paymentMethod} checkout ${outcome}: direct redirect, verified receipt or retry without losing cart`, async () => {
    const h = hooks();
    const calls = [];
    let clearCount = 0;
    let successCount = 0;
    const navigations = [];
    const memory = new Map();
    const oldStorage = global.localStorage;
    const oldWindow = global.window;
    const oldFetch = global.fetch;
    const listeners = new Map();
    const cleanups = [];
    global.localStorage = {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value),
      removeItem: (key) => memory.delete(key),
    };
    global.window = {
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name) => listeners.delete(name),
      location: {
        assign: (value) => {
          if (outcome === "navigation-failure")
            throw new Error("Navigation blocked");
          navigations.push(value);
        },
      },
    };
    global.fetch = async () => Response.json([{ code: 79, name: "Ho Chi Minh City" }]);
    let resolvePayment;
    const waiting = new Promise((resolve) => {
      resolvePayment = resolve;
    });
    const Form = load("app/checkout/CheckoutForm.tsx", {
      react: h.react,
      "../hooks/useCart": {
        useCart: () => ({
          context: {
            cartProducts: payload.items,
            cartTotalQtyAmount: product.price,
            handleClearCart: () => clearCount++,
            handleSetPaymentIntent() {},
          },
        }),
      },
      "@/utils/formatPrice": { formatPrice: String },
      axios: {
        __esModule: true,
        default: {
          post: async (url, body) => {
            if (url === "/api/checkout/quote") return { data: { token: "signed-fixture-quote", expiresAt: new Date(Date.now() + 600000).toISOString(), totals: { subtotal: product.price, shippingFee: 0, discountTotal: 0, grandTotal: product.price, shippingPolicyLabel: "QA delivery" } } };
            calls.push({ url, body });
            return waiting;
          },
          patch: async () => ({}),
          isAxiosError: () => false,
        },
      },
      "react-hot-toast": {
        __esModule: true,
        default: { error() {}, success() {} },
      },
      "../components/Headinng": { __esModule: true, default: () => null },
      "../components/Button": { __esModule: true, default: () => null },
      "next/link": { __esModule: true, default: () => null },
      "../../utils/apiPaths": load("utils/apiPaths.ts"),
      "../../utils/externalApiPaths": load("utils/externalApiPaths.ts"),
      "./MoMoPayment": { __esModule: true, default: () => null },
    }).default;
    try {
      h.reset();
      const formProps = {
        paymentMethod,
        onPaymentMethodChange() {},
        stripeContext: { stripe: null, elements: null },
        cardPayment: null,
        handleSetPaymentSuccess: () => successCount++,
        currentUser: {
          name: payload.fullName,
          address: payload.address,
          phoneNumber: payload.phone,
        },
      };
      let tree = Form(formProps);
      for (const effect of h.effects) cleanups.push(effect());
      await new Promise((resolve) => setImmediate(resolve));
      h.reset(); tree = Form(formProps);
      findElement(tree, (e) => e.props?.id === "deliveryCity").props.onChange({
        target: { value: "79" },
      });
      h.reset();
      tree = Form(formProps);
      findElement(tree, (e) => e.type === "button" && e.props.children === "Get delivery quote").props.onClick();
      await new Promise((resolve) => setImmediate(resolve));
      h.reset(); tree = Form(formProps);
      if (outcome === "return-back") {
        for (const effect of h.effects) cleanups.push(effect());
        await new Promise((resolve) => setImmediate(resolve));
      }
      const submit = findElement(tree, (e) => e.type === "form").props.onSubmit;
      const first = submit({ preventDefault() {} });
      await submit({ preventDefault() {} });
      assert.equal(calls.length, 1);
      assert.equal(
        calls[0].url,
        paymentMethod === "MOMO"
          ? "/api/momo/create-payment-url"
          : "/api/zalopay/create-payment-url",
      );
      assert.equal(calls[0].body.address, payload.address);
      assert.equal(calls[0].body.phone, payload.phone);
      assert.equal(calls[0].body.city, "Ho Chi Minh City");
      assert.ok(calls[0].body.checkout_request_id);
      assert.equal(clearCount, 0);
      assert.equal(successCount, 0);
      resolvePayment({
        data: {
          orderId: "000000000000000000000001",
          url:
            outcome === "missing-url"
              ? undefined
              : paymentMethod === "MOMO"
                ? "https://test-payment.momo.vn/gateway/pay?t=fixture"
                : "https://qcgateway.zalopay.vn/openinapp?order=fixture",
          alreadyPaid: outcome === "already-paid",
          amount: product.price,
        },
      });
      await first;
      assert.equal(
        navigations.length,
        ["redirect", "return-back"].includes(outcome) ? 1 : 0,
      );
      if (["redirect", "return-back"].includes(outcome))
        assert.equal(
          navigations[0],
          paymentMethod === "MOMO"
            ? "https://test-payment.momo.vn/gateway/pay?t=fixture"
            : "https://qcgateway.zalopay.vn/openinapp?order=fixture",
        );
      assert.equal(clearCount, outcome === "already-paid" ? 1 : 0);
      assert.equal(successCount, outcome === "already-paid" ? 1 : 0);
      if (paymentMethod === "MOMO" && outcome !== "already-paid") {
        if (outcome === "return-back") {
          await submit({ preventDefault() {} });
          assert.equal(calls.length, 1);
          listeners.get("pageshow")({ persisted: false });
          await submit({ preventDefault() {} });
          assert.equal(calls.length, 1);
          listeners.get("pageshow")({ persisted: true });
        }
        await submit({ preventDefault() {} });
        assert.equal(calls.length, outcome === "redirect" ? 1 : 2);
        if (calls.length === 2)
          assert.equal(
            calls[1].body.checkout_request_id,
            calls[0].body.checkout_request_id,
          );
        h.reset();
        assert.ok(findElement(Form(formProps), (e) => e.type === "form"));
      }
    } finally {
      for (const cleanup of cleanups)
        if (typeof cleanup === "function") cleanup();
      global.localStorage = oldStorage;
      global.window = oldWindow;
      global.fetch = oldFetch;
    }
  });
}

test("inline Stripe checkout retains the cart until the server confirms receipt of payment", async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => Response.json([{ code: 79, name: "Ho Chi Minh City" }]);
  const previousWindow = global.window;
  global.window = { location: { origin: "http://localhost:3000" } };
  try {
    for (const status of ["complete", "processing", "offline"]) {
      const h = hooks();
      let clearCount = 0;
      let successCount = 0;
      const notify = Object.assign(() => {}, { success() {}, error() {} });
      const Form = load("app/checkout/CheckoutForm.tsx", {
        react: h.react,
        "../hooks/useCart": {
          useCart: () => ({
            context: {
              cartProducts: payload.items,
              cartTotalQtyAmount: product.price,
              handleClearCart: () => clearCount++,
              handleSetPaymentIntent() {},
            },
          }),
        },
        "@/utils/formatPrice": { formatPrice: String },
        axios: {
          __esModule: true,
          default: {
            post: async (url) => {
              if (url === "/api/checkout/quote") return { data: { token: "signed-fixture-quote", expiresAt: new Date(Date.now() + 600000).toISOString(), totals: { subtotal: product.price, shippingFee: 0, discountTotal: 0, grandTotal: product.price, shippingPolicyLabel: "QA delivery" } } };
              if (status === "offline") throw new Error("Verification offline");
              return {
                data: {
                  order: {
                    id: "000000000000000000000001",
                    amount: product.price,
                    status,
                  },
                },
              };
            },
          },
        },
        "react-hot-toast": { __esModule: true, default: notify },
        "../components/Headinng": { __esModule: true, default: () => null },
        "../components/Button": { __esModule: true, default: () => null },
        "next/link": { __esModule: true, default: () => null },
        "../../utils/apiPaths": load("utils/apiPaths.ts"),
        "../../utils/externalApiPaths": load("utils/externalApiPaths.ts"),
        "./MoMoPayment": { __esModule: true, default: () => null },
      }).default;
      h.reset();
      const formProps = {
        paymentMethod: "STRIPE",
        onPaymentMethodChange() {},
        stripeContext: {
          elements: {},
          stripe: {
            confirmPayment: async () => ({
              paymentIntent: { id: "pi_fixture", status: "succeeded" },
            }),
          },
        },
        cardPayment: null,
        handleSetPaymentSuccess: () => successCount++,
        currentUser: {
          name: payload.fullName,
          address: payload.address,
          phoneNumber: payload.phone,
        },
      };
      let tree = Form(formProps);
      for (const effect of h.effects) effect();
      await new Promise((resolve) => setImmediate(resolve));
      h.reset(); tree = Form(formProps);
      findElement(tree, (e) => e.props?.id === "deliveryCity").props.onChange({
        target: { value: "79" },
      });
      h.reset();
      tree = Form(formProps);
      findElement(tree, (e) => e.type === "button" && e.props.children === "Get delivery quote").props.onClick();
      await new Promise((resolve) => setImmediate(resolve));
      h.reset(); tree = Form(formProps);
      findElement(tree, (element) => element.type === "form").props.onSubmit({
        preventDefault() {},
      });
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(clearCount, status === "complete" ? 1 : 0);
      assert.equal(successCount, status === "complete" ? 1 : 0);
    }
  } finally {
    global.window = previousWindow;
    global.fetch = previousFetch;
  }
});

test("ZaloPay does not acknowledge a payment when its order disappears or changes during confirmation", async () => {
  for (const condition of ["deleted", "amount-changed"]) {
    const f = fixture();
    await f.create();
    const order = f.first();
    f.state.race = () => {
      if (condition === "deleted") f.rows.clear();
      else order.amount++;
    };
    const result = await (await f.callback()).json();
    assert.equal(result.return_code, 0);
    assert.notEqual(order.status, "paid");
  }
});
