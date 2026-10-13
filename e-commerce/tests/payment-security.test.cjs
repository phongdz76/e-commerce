const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { createHmac } = require("node:crypto");

Object.assign(process.env, {
  VNP_TMNCODE: "FIXTURE1",
  VNP_HASHSECRET: "fixture-vnp-secret",
  MOMO_PARTNER_CODE: "FIXTUREMOMO",
  MOMO_ACCESS_KEY: "fixture-access",
  MOMO_SECRET_KEY: "fixture-secret",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
});

function load(file, mocks = {}) {
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

const signatures = load("libs/paymentSignature.ts");
const vnpay = load("libs/vnpay.ts", { "@/libs/paymentSignature": signatures });
const momo = load("libs/momo.ts", { "@/libs/paymentSignature": signatures });

function fixture(method) {
  const state = {
    readError: false,
    writeError: false,
    race: null,
    writes: 0,
    user: { id: "owner", role: "USER" },
  };
  const rows = new Map();
  const attempts = new Map();
  const exceptions = new Map();
  const order = {
    id: "a".repeat(24),
    userId: "owner",
    paymentIntentId: "reference-1",
    amount: 10000,
    currency: "vnd",
    status: "pending",
    paymentMethod: method,
    deliveryStatus: "shipped",
    recipientName: "Customer",
    createDate: new Date(),
  };
  rows.set(order.id, order);
  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (key === "AND")
        return value.every((condition) => matches(row, condition));
      if (key === "OR")
        return value.some((condition) => matches(row, condition));
      if (value && typeof value === "object") {
        if (value.in) return value.in.includes(row[key]);
        if (value.notIn) return !value.notIn.includes(row[key]);
        if ("lt" in value) return row[key] < value.lt;
        if ("lte" in value) return row[key] <= value.lte;
        if ("gte" in value) return row[key] >= value.gte;
        if ("isSet" in value) return Object.hasOwn(row, key) === value.isSet;
        if ("not" in value) return row[key] !== value.not;
      }
      if (value === null) return row[key] == null;
      return row[key] === value;
    });
  }
  const prisma = {
    paymentAttempt: {
      create: async ({ data }) => {
        if (attempts.has(data.id))
          throw Object.assign(new Error("Duplicate"), { code: "P2002" });
        const row = {
          state: "CREATED",
          createDate: new Date(),
          checkCount: 0,
          merchantId: null,
          ...data,
        };
        attempts.set(row.id, row);
        if (
          data.state === "RESERVED" &&
          state.interruptRetryAt === "reserved"
        ) {
          state.interruptRetryAt = null;
          throw new Error("simulated process exit");
        }
        return structuredClone(row);
      },
      findUnique: async ({ where }) =>
        structuredClone(attempts.get(where.id) || null),
      findMany: async ({ where = {}, skip = 0, take = 100 }) =>
        structuredClone(
          [...attempts.values()]
            .filter((row) => matches(row, where))
            .slice(skip, skip + take),
        ),
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const row of attempts.values()) {
          if (matches(row, where)) {
            for (const [key, value] of Object.entries(data))
              row[key] =
                value && typeof value === "object" && "increment" in value
                  ? row[key] + value.increment
                  : value;
            count++;
          }
        }
        return { count };
      },
    },
    order: {
      findUnique: async ({ where }) => {
        if (state.readError) throw new Error("private-db-error");
        return structuredClone(
          [...rows.values()].find((row) => matches(row, where)) || null,
        );
      },
      updateMany: async ({ where, data }) => {
        if (state.writeError) throw new Error("private-db-error");
        if (state.race) {
          state.race();
          state.race = null;
        }
        let count = 0;
        for (const row of rows.values()) {
          if (matches(row, where)) {
            Object.assign(row, data);
            count++;
            state.writes++;
            if (
              data.activePaymentAttemptId &&
              state.interruptRetryAt === "activated"
            ) {
              state.interruptRetryAt = null;
              throw new Error("simulated process exit");
            }
          }
        }
        return { count };
      },
      findMany: async ({ where = {}, take = 100 }) =>
        structuredClone(
          [...rows.values()]
            .filter((row) => matches(row, where))
            .slice(0, take),
        ),
    },
  };
  class NextResponse extends Response {
    static redirect(url) {
      return new Response(null, {
        status: 307,
        headers: { Location: String(url) },
      });
    }
  }
  const mocks = {
    "@/libs/prismadb": { __esModule: true, default: prisma },
    "@/libs/vnpay": vnpay,
    "@/libs/momo": momo,
    "next/server": { NextResponse },
    "@/libs/paymentSignature": signatures,
    "@/actions/getCurrentUser": { getCurrentUser: async () => state.user },
    "@/libs/authRateLimit": {
      checkAuthRateLimit: async () => {},
      cleanupExpiredAuthRateLimits: async () => 0,
      AuthRateLimitError: class extends Error {},
    },
    "@/libs/syncStripeOrder": {
      syncStripeOrder: async (savedOrder) => savedOrder,
    },
    "@/libs/syncZaloPayOrder": {
      syncZaloPayOrder: async (savedOrder) => savedOrder,
    },
  };
  prisma.paymentException = {
    upsert: async ({ where, create }) => {
      if (state.exceptionError) throw new Error("private-exception-db-error");
      if (!exceptions.has(where.id))
        exceptions.set(where.id, {
          status: "OPEN",
          createdAt: new Date(),
          ...structuredClone(create),
        });
      return structuredClone(exceptions.get(where.id));
    },
    findUnique: async ({ where }) =>
      structuredClone(exceptions.get(where.id) || null),
    findMany: async ({ where, skip = 0, take = 100 }) =>
      structuredClone(
        [...exceptions.values()]
          .filter((row) => matches(row, where))
          .slice(skip, skip + take),
      ),
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of exceptions.values())
        if (matches(row, where)) {
          Object.assign(row, structuredClone(data));
          count++;
        }
      return { count };
    },
  };
  const auditLogs = [];
  prisma.auditLog = {
    create: async ({ data }) => {
      const log = { id: `audit-${auditLogs.length + 1}`, ...data };
      auditLogs.push(log);
      return structuredClone(log);
    },
    update: async ({ where, data }) =>
      Object.assign(
        auditLogs.find((log) => log.id === where.id),
        data,
      ),
  };
  mocks["@/libs/adminAudit"] = load("libs/adminAudit.ts", mocks);
  mocks["@/libs/paymentReference"] = load("libs/paymentReference.ts", mocks);
  mocks["@/libs/paymentStatus"] = load("libs/paymentStatus.ts", mocks);
  const queries = load("libs/queryOnlinePayment.ts", mocks);
  mocks["@/libs/zalopay"] = load("libs/zalopay.ts");
  mocks["@/libs/paymentConfiguration"] = load(
    "libs/paymentConfiguration.ts",
    mocks,
  );
  mocks["@/libs/queryOnlinePayment"] = queries;
  const reconciliation = load("libs/reconcilePayment.ts", mocks);
  mocks["@/libs/reconcilePayment"] = reconciliation;
  mocks["@/libs/orderItems"] = {};
  mocks["@/libs/orderDelivery"] = {};
  mocks["@/libs/checkoutRequest"] = load("libs/checkoutRequest.ts", mocks);
  mocks["@/libs/createVnpayPayment"] = load(
    "libs/createVnpayPayment.ts",
    mocks,
  );
  mocks["@/libs/createMomoPayment"] = load("libs/createMomoPayment.ts", mocks);
  mocks["@/libs/retryOnlinePayment"] = load(
    "libs/retryOnlinePayment.ts",
    mocks,
  );
  const retry = load(
    "app/api/order/[orderId]/retry-payment/route.ts",
    mocks,
  ).POST;
  const exceptionQueue = load(
    "app/api/admin/payment-exceptions/route.ts",
    mocks,
  ).GET;
  const reviewException = load(
    "app/api/admin/payment-exceptions/[exceptionId]/route.ts",
    mocks,
  ).PATCH;
  const jobs = load("app/api/jobs/reconcile-payments/route.ts", mocks).GET;
  const queue = load("app/api/admin/payments/route.ts", mocks).GET;
  const manual = load(
    "app/api/admin/payments/[orderId]/reconcile/route.ts",
    mocks,
  ).POST;
  const paymentStatus = load(
    "app/api/order/payment-status/route.ts",
    mocks,
  ).POST;
  const vnpIpn = load("app/api/vnpay/vnpay-ipn/route.ts", mocks).GET;
  const momoIpn = load("app/api/momo/momo-ipn/route.ts", mocks).POST;
  const returns = {
    VNPAY: load("app/api/vnpay/vnpay-return/route.ts", mocks).GET,
    MOMO: load("app/api/momo/momo-return/route.ts", mocks).GET,
  };
  const vnpParams = (patch = {}) => {
    const params = {
      vnp_Amount: String(order.amount * 100),
      vnp_TmnCode: "FIXTURE1",
      vnp_TxnRef: order.paymentIntentId,
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
      vnp_TransactionNo: "12345",
      vnp_OrderInfo: "SGTech order + payment",
      ...patch,
    };
    return new URLSearchParams({
      ...params,
      vnp_SecureHash: vnpay.getVnpaySignature(
        params,
        process.env.VNP_HASHSECRET,
      ),
    });
  };
  const momoPayload = (patch = {}) => {
    const params = {
      amount: order.amount,
      extraData: "",
      message: "Thành công",
      orderId: order.paymentIntentId,
      orderInfo: "SGTech order",
      orderType: "momo_wallet",
      partnerCode: "FIXTUREMOMO",
      payType: "qr",
      requestId: order.paymentIntentId,
      responseTime: 1700000000000,
      resultCode: 0,
      transId: 12345,
      ...patch,
    };
    const raw = [
      `accessKey=${process.env.MOMO_ACCESS_KEY}`,
      ...Object.entries(params).map(([key, value]) => `${key}=${value}`),
    ].join("&");
    return {
      ...params,
      signature: createHmac("sha256", process.env.MOMO_SECRET_KEY)
        .update(raw)
        .digest("hex"),
    };
  };
  const getRequest = (params) => new Request(`http://localhost/ipn?${params}`);
  const postRequest = (payload) =>
    new Request("http://localhost/ipn", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  const notify = (patch) =>
    method === "VNPAY"
      ? vnpIpn(getRequest(vnpParams(patch)))
      : momoIpn(postRequest(momoPayload(patch)));
  return {
    state,
    rows,
    order,
    attempts,
    queries,
    reconciliation,
    retry,
    exceptions,
    auditLogs,
    exceptionQueue,
    reviewException,
    jobs,
    queue,
    manual,
    paymentStatus,
    vnpIpn,
    momoIpn,
    returns,
    vnpParams,
    momoPayload,
    getRequest,
    postRequest,
    notify,
  };
}

test("VNPay IPN validates the signed payload, confirms once and preserves delivery details", async () => {
  const f = fixture("VNPAY");
  assert.equal((await (await f.notify()).json()).RspCode, "00");
  assert.equal(f.order.status, "paid");
  assert.equal((await (await f.notify()).json()).RspCode, "02");
  assert.equal(f.state.writes, 1);
  assert.equal(f.order.deliveryStatus, "shipped");
  assert.equal(f.order.recipientName, "Customer");
});

test("VNPay rejects invalid signatures, repeated fields and a foreign merchant", async () => {
  for (const condition of [
    "signature",
    "duplicate",
    "merchant",
    "missing-status",
  ]) {
    const f = fixture("VNPAY");
    const params = f.vnpParams(
      condition === "merchant"
        ? { vnp_TmnCode: "FOREIGN1" }
        : condition === "missing-status"
          ? { vnp_TransactionStatus: "" }
          : {},
    );
    if (condition === "signature")
      params.set("vnp_SecureHash", "a".repeat(128));
    if (condition === "duplicate") params.append("vnp_Amount", "100");
    assert.equal(
      (await (await f.vnpIpn(f.getRequest(params))).json()).RspCode,
      "97",
    );
    assert.equal(f.state.writes, 0);
  }
});

test("VNPay checks reference, method, amount and currency before confirming", async () => {
  for (const condition of ["reference", "method", "amount", "currency"]) {
    const f = fixture("VNPAY");
    if (condition === "method") f.order.paymentMethod = "COD";
    if (condition === "currency") f.order.currency = "usd";
    const patch =
      condition === "reference"
        ? { vnp_TxnRef: "missing-ref" }
        : condition === "amount"
          ? { vnp_Amount: "100" }
          : {};
    const expected = ["reference", "method"].includes(condition) ? "01" : "04";
    assert.equal((await (await f.notify(patch)).json()).RspCode, expected);
    assert.equal(f.order.status, "pending");
  }
});

test("VNPay requires both response code and transaction status to succeed", async () => {
  for (const patch of [
    { vnp_ResponseCode: "24" },
    { vnp_TransactionStatus: "02" },
  ]) {
    const f = fixture("VNPAY");
    assert.equal((await (await f.notify(patch)).json()).RspCode, "00");
    assert.equal(f.order.status, "failed");
  }
});

test("MoMo IPN acknowledges only after a valid matching payment is persisted", async () => {
  const f = fixture("MOMO");
  const first = await f.notify();
  assert.equal(first.status, 204);
  assert.equal(await first.text(), "");
  assert.equal(f.order.status, "paid");
  assert.equal((await f.notify()).status, 204);
  assert.equal(f.state.writes, 1);
  assert.equal(f.order.deliveryStatus, "shipped");
});

test("MoMo rejects signed payments for another partner, reference, request, method or amount", async () => {
  for (const condition of [
    "partner",
    "reference",
    "request",
    "method",
    "amount",
    "currency",
    "type",
  ]) {
    const f = fixture("MOMO");
    if (condition === "method") f.order.paymentMethod = "COD";
    if (condition === "currency") f.order.currency = "usd";
    const patch =
      condition === "partner"
        ? { partnerCode: "FOREIGN" }
        : condition === "reference"
          ? { orderId: "missing", requestId: "missing" }
          : condition === "request"
            ? { requestId: "other-request" }
            : condition === "amount"
              ? { amount: 1 }
              : condition === "type"
                ? { amount: {} }
                : {};
    const response = await f.notify(patch);
    assert.equal(response.status, condition === "reference" ? 503 : 400);
    assert.equal(f.state.writes, 0);
  }
});

test("MoMo rejects tampering, invalid JSON and malformed signature", async () => {
  const f = fixture("MOMO");
  const payload = f.momoPayload();
  payload.amount++;
  assert.equal((await f.momoIpn(f.postRequest(payload))).status, 400);
  payload.signature = "z".repeat(64);
  assert.equal((await f.momoIpn(f.postRequest(payload))).status, 400);
  assert.equal(
    (
      await f.momoIpn(
        new Request("http://localhost/ipn", { method: "POST", body: "{" }),
      )
    ).status,
    400,
  );
  assert.equal(f.state.writes, 0);
});

test("MoMo pending, authorization and unknown results never imply settlement or failure", async () => {
  for (const resultCode of [1000, 7000, 7002, 9000, 10, 5555]) {
    const f = fixture("MOMO");
    assert.equal((await f.notify({ resultCode })).status, 204);
    assert.equal(f.order.status, "processing");
  }
  const f = fixture("MOMO");
  assert.equal((await f.notify({ resultCode: 1006 })).status, 204);
  assert.equal(f.order.status, "failed");
  await f.notify({ resultCode: 7000 });
  assert.equal(f.order.status, "failed");
  await f.notify();
  assert.equal(f.order.status, "paid");
});

test("late failures and simultaneous callbacks cannot downgrade settled payments", async () => {
  for (const method of ["VNPAY", "MOMO"]) {
    const f = fixture(method);
    const failed =
      method === "VNPAY" ? { vnp_ResponseCode: "24" } : { resultCode: 1006 };
    await Promise.all([f.notify(), f.notify(failed), f.notify()]);
    assert.equal(f.order.status, "paid");
    await f.notify(failed);
    assert.equal(f.order.status, "paid");
    const raced = fixture(method);
    raced.state.race = () => {
      raced.order.status = "paid";
    };
    await raced.notify(failed);
    assert.equal(raced.order.status, "paid");
  }
});

test("provider acknowledgements request retry for database failures and deleted orders", async () => {
  for (const method of ["VNPAY", "MOMO"]) {
    for (const condition of ["read", "write", "deleted"]) {
      const f = fixture(method);
      if (condition === "read") f.state.readError = true;
      if (condition === "write") f.state.writeError = true;
      if (condition === "deleted") f.state.race = () => f.rows.clear();
      const response = await f.notify();
      if (method === "VNPAY")
        assert.equal((await response.json()).RspCode, "99");
      else assert.equal(response.status, 503);
    }
  }
});

test("browser returns are read-only and cannot change pending, failed or paid orders", async () => {
  for (const method of ["VNPAY", "MOMO"]) {
    for (const status of ["pending", "failed", "paid"]) {
      const f = fixture(method);
      f.order.status = status;
      const params =
        method === "VNPAY"
          ? f.vnpParams()
          : new URLSearchParams(f.momoPayload());
      const response = await f.returns[method](f.getRequest(params));
      const target = new URL(response.headers.get("Location"));
      assert.equal(target.searchParams.get(method.toLowerCase()), "return");
      assert.equal(target.searchParams.get("order"), f.order.id);
      assert.equal(f.state.writes, 0);
      assert.equal(f.order.status, status);
    }
  }
});

test("tampered browser returns and storage mismatches redirect to an error", async () => {
  for (const method of ["VNPAY", "MOMO"]) {
    const f = fixture(method);
    const params =
      method === "VNPAY" ? f.vnpParams() : new URLSearchParams(f.momoPayload());
    params.set(method === "VNPAY" ? "vnp_Amount" : "amount", "1");
    assert.match(
      (await f.returns[method](f.getRequest(params))).headers.get("Location"),
      /invalid_signature/,
    );
    const mismatch =
      method === "VNPAY"
        ? f.vnpParams({ vnp_Amount: "100" })
        : new URLSearchParams(f.momoPayload({ amount: 1 }));
    assert.match(
      (await f.returns[method](f.getRequest(mismatch))).headers.get("Location"),
      /error/,
    );
    assert.equal(f.order.status, "pending");
  }
});

test("callback authentication has no fallback merchant credentials", async () => {
  for (const [method, key] of [
    ["VNPAY", "VNP_HASHSECRET"],
    ["MOMO", "MOMO_SECRET_KEY"],
  ]) {
    const f = fixture(method);
    const request =
      method === "VNPAY"
        ? f.getRequest(f.vnpParams())
        : f.postRequest(f.momoPayload());
    const saved = process.env[key];
    delete process.env[key];
    try {
      const response =
        method === "VNPAY" ? await f.vnpIpn(request) : await f.momoIpn(request);
      if (method === "VNPAY")
        assert.equal((await response.json()).RspCode, "99");
      else assert.equal(response.status, 503);
      assert.equal(f.state.writes, 0);
    } finally {
      process.env[key] = saved;
    }
  }
});

const queryResponseFields = [
  "vnp_ResponseId",
  "vnp_Command",
  "vnp_ResponseCode",
  "vnp_Message",
  "vnp_TmnCode",
  "vnp_TxnRef",
  "vnp_Amount",
  "vnp_BankCode",
  "vnp_PayDate",
  "vnp_TransactionNo",
  "vnp_TransactionType",
  "vnp_TransactionStatus",
  "vnp_OrderInfo",
  "vnp_PromotionCode",
  "vnp_PromotionAmount",
];

function vnpQueryResponse(request, patch = {}) {
  const result = {
    vnp_ResponseId: "query-response",
    vnp_Command: "querydr",
    vnp_ResponseCode: "00",
    vnp_Message: "Success",
    vnp_TmnCode: "FIXTURE1",
    vnp_TxnRef: request.vnp_TxnRef,
    vnp_Amount: "1000000",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261013120000",
    vnp_TransactionNo: "12345",
    vnp_TransactionType: "01",
    vnp_TransactionStatus: "00",
    vnp_OrderInfo: request.vnp_OrderInfo,
    ...patch,
  };
  result.vnp_SecureHash = createHmac("sha512", process.env.VNP_HASHSECRET)
    .update(queryResponseFields.map((key) => result[key] || "").join("|"))
    .digest("hex");
  return result;
}

async function withQueryProvider(callback, responder) {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) =>
    responder(new URL(url), JSON.parse(options.body));
  try {
    await callback();
  } finally {
    global.fetch = originalFetch;
  }
}

test("VNPay querydr request and response use the distinct pipe-separated signature", async () => {
  const f = fixture("VNPAY");
  const attempt = await f.reconciliation.ensurePaymentAttempt(f.order);
  let sent;
  await withQueryProvider(
    async () => {
      const result = await f.queries.queryVnpayOrder(f.order, attempt);
      assert.equal(result.status, "paid");
      assert.equal(f.attempts.get(attempt.id).providerTransactionId, "12345");
    },
    async (_url, request) => {
      sent = request;
      return Response.json(vnpQueryResponse(request));
    },
  );
  const fields = [
    "vnp_RequestId",
    "vnp_Version",
    "vnp_Command",
    "vnp_TmnCode",
    "vnp_TxnRef",
    "vnp_TransactionDate",
    "vnp_CreateDate",
    "vnp_IpAddr",
    "vnp_OrderInfo",
  ];
  assert.equal(
    sent.vnp_SecureHash,
    createHmac("sha512", process.env.VNP_HASHSECRET)
      .update(fields.map((key) => sent[key]).join("|"))
      .digest("hex"),
  );
});

test("VNPay query rejects tampering, foreign references, wrong amounts and refund responses", async () => {
  for (const mode of [
    "signature",
    "reference",
    "amount",
    "merchant",
    "refund",
    "query-error",
  ]) {
    const f = fixture("VNPAY");
    const attempt = await f.reconciliation.ensurePaymentAttempt(f.order);
    await withQueryProvider(
      async () => {
        await assert.rejects(f.queries.queryVnpayOrder(f.order, attempt));
        assert.equal(f.order.status, "pending");
      },
      async (_url, request) => {
        const patch =
          mode === "reference"
            ? { vnp_TxnRef: "foreign" }
            : mode === "amount"
              ? { vnp_Amount: "100" }
              : mode === "merchant"
                ? { vnp_TmnCode: "FOREIGN" }
                : mode === "refund"
                  ? { vnp_TransactionType: "02" }
                  : mode === "query-error"
                    ? { vnp_ResponseCode: "91" }
                    : {};
        const result = vnpQueryResponse(request, patch);
        if (mode === "signature") result.vnp_SecureHash = "a".repeat(128);
        return Response.json(result);
      },
    );
  }
});

test("MoMo query validates HTTPS response correlation and full amount", async () => {
  for (const mode of [
    "success",
    "request",
    "reference",
    "amount",
    "partner",
    "pending",
  ]) {
    const f = fixture("MOMO");
    const attempt = await f.reconciliation.ensurePaymentAttempt(f.order);
    await withQueryProvider(
      async () => {
        if (["success", "pending"].includes(mode)) {
          const result = await f.queries.queryMomoOrder(f.order, attempt);
          assert.equal(
            result.status,
            mode === "success" ? "paid" : "processing",
          );
        } else {
          await assert.rejects(f.queries.queryMomoOrder(f.order, attempt));
          assert.equal(f.order.status, "pending");
        }
      },
      async (_url, request) => {
        const raw = `accessKey=${process.env.MOMO_ACCESS_KEY}&orderId=${request.orderId}&partnerCode=${request.partnerCode}&requestId=${request.requestId}`;
        assert.equal(
          request.signature,
          createHmac("sha256", process.env.MOMO_SECRET_KEY)
            .update(raw)
            .digest("hex"),
        );
        return Response.json({
          partnerCode: mode === "partner" ? "foreign" : request.partnerCode,
          orderId: mode === "reference" ? "foreign" : request.orderId,
          requestId: mode === "request" ? "foreign" : request.requestId,
          amount: mode === "amount" ? 1 : 10000,
          transId: 12345,
          resultCode: mode === "pending" ? 7000 : 0,
        });
      },
    );
  }
});

test("simultaneous reconciliation workers acquire one database lease and one query", async () => {
  const f = fixture("MOMO");
  let calls = 0;
  await withQueryProvider(
    async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          f.reconciliation.reconcilePayment(f.order),
        ),
      );
      assert.equal(calls, 1);
      assert.equal(results.filter((result) => result.skipped).length, 4);
      assert.equal(f.order.status, "paid");
      const attempt = [...f.attempts.values()][0];
      assert.equal(attempt.state, "SUCCEEDED");
      assert.equal(attempt.checkCount, 1);
      assert.equal(attempt.leaseToken, null);
    },
    async (_url, request) => {
      calls++;
      return Response.json({
        ...request,
        amount: 10000,
        transId: 12345,
        resultCode: 0,
      });
    },
  );
});

test("query outages use backoff and reach manual review without marking orders failed", async () => {
  const f = fixture("MOMO");
  await withQueryProvider(
    async () => {
      const first = await f.reconciliation.reconcilePayment(f.order);
      assert.equal(first.state, "UNKNOWN");
      const attempt = [...f.attempts.values()][0];
      assert.ok(attempt.nextCheckAt > new Date());
      assert.equal(
        (await f.reconciliation.reconcilePayment(f.order)).skipped,
        true,
      );
      attempt.checkCount = f.reconciliation.AUTOMATIC_PAYMENT_CHECK_LIMIT - 1;
      attempt.nextCheckAt = new Date(0);
      const final = await f.reconciliation.reconcilePayment(f.order);
      assert.equal(final.state, "REVIEW");
      assert.equal(attempt.nextCheckAt, null);
      assert.equal(f.order.status, "pending");
      assert.equal(
        (await f.reconciliation.reconcilePayment(f.order)).skipped,
        true,
      );
    },
    async () => {
      throw new Error("private-api-secret-and-timeout");
    },
  );
  assert.equal(
    [...f.attempts.values()][0].lastError.includes("private-api"),
    false,
  );
});

test("an expired worker lease can be recovered after a process crash", async () => {
  const f = fixture("MOMO");
  await f.reconciliation.ensurePaymentAttempt(f.order);
  const attempt = [...f.attempts.values()][0];
  attempt.leaseToken = "dead-process";
  attempt.leaseExpiresAt = new Date(Date.now() + 60000);
  assert.equal(
    (await f.reconciliation.reconcilePayment(f.order)).skipped,
    true,
  );
  attempt.leaseExpiresAt = new Date(0);
  await withQueryProvider(
    async () => {
      assert.equal(
        (await f.reconciliation.reconcilePayment(f.order)).state,
        "SUCCEEDED",
      );
    },
    async (_url, request) =>
      Response.json({
        ...request,
        amount: 10000,
        transId: 12345,
        resultCode: 0,
      }),
  );
});

test("a successful callback wins over an in-flight failed query and preserves its receipt", async () => {
  const f = fixture("MOMO");
  await withQueryProvider(
    async () => {
      const result = await f.reconciliation.reconcilePayment(f.order);
      assert.equal(result.state, "SUCCEEDED");
      assert.equal(f.order.status, "paid");
      assert.equal([...f.attempts.values()][0].providerTransactionId, "12345");
      assert.equal([...f.attempts.values()][0].resultCode, "0");
    },
    async (_url, request) => {
      await f.notify();
      return Response.json({
        ...request,
        amount: 10000,
        transId: 0,
        resultCode: 1006,
      });
    },
  );
  await f.notify({ transId: 0, resultCode: 1006 });
  assert.equal([...f.attempts.values()][0].providerTransactionId, "12345");
});

test("scheduled jobs require the configured bearer token", async () => {
  const f = fixture("MOMO");
  const previous = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  assert.equal((await f.jobs(new Request("http://localhost/job"))).status, 503);
  process.env.CRON_SECRET = "fixture-cron-secret";
  try {
    assert.equal(
      (await f.jobs(new Request("http://localhost/job"))).status,
      401,
    );
    assert.equal(
      (
        await f.jobs(
          new Request("http://localhost/job", {
            headers: { authorization: "Bearer wrong" },
          }),
        )
      ).status,
      401,
    );
    await withQueryProvider(
      async () => {
        const response = await f.jobs(
          new Request("http://localhost/job", {
            headers: { authorization: "Bearer fixture-cron-secret" },
          }),
        );
        assert.equal(response.status, 200);
        assert.equal((await response.json()).processed, 1);
        assert.equal(f.order.paymentAttemptTracked, true);
      },
      async (_url, request) =>
        Response.json({
          ...request,
          amount: 10000,
          transId: 12345,
          resultCode: 0,
        }),
    );
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("worker moves crash-exhausted attempts and missing orders into review", async () => {
  const f = fixture("MOMO");
  await f.reconciliation.ensurePaymentAttempt(f.order);
  const attempt = [...f.attempts.values()][0];
  attempt.checkCount = f.reconciliation.AUTOMATIC_PAYMENT_CHECK_LIMIT;
  attempt.leaseExpiresAt = new Date(0);
  await f.reconciliation.reconcilePendingPayments();
  assert.equal(attempt.state, "REVIEW");
  attempt.checkCount = 0;
  attempt.state = "UNKNOWN";
  attempt.nextCheckAt = new Date(0);
  f.rows.clear();
  await f.reconciliation.reconcilePendingPayments();
  assert.equal(attempt.state, "REVIEW");
  assert.match(attempt.lastError, /Order missing/);
});

test("payment queue and manual reconciliation enforce ADMIN permissions", async () => {
  const f = fixture("MOMO");
  const context = { params: Promise.resolve({ orderId: f.order.id }) };
  const req = new Request("http://localhost/admin/payments");
  assert.equal((await f.queue(req)).status, 403);
  assert.equal((await f.manual(req, context)).status, 403);
  f.state.user = null;
  assert.equal((await f.queue(req)).status, 401);
  f.state.user = { id: "admin", role: "ADMIN" };
  await f.reconciliation.ensurePaymentAttempt(f.order);
  const attempt = [...f.attempts.values()][0];
  attempt.state = "REVIEW";
  attempt.privateSecret = "must-not-leak";
  const queued = await (await f.queue(req)).json();
  assert.equal(queued.attempts.length, 1);
  assert.equal("privateSecret" in queued.attempts[0], false);
  assert.equal(
    (await f.queue(new Request("http://localhost/queue?state=invalid"))).status,
    400,
  );
  await withQueryProvider(
    async () => {
      const response = await f.manual(req, context);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).state, "SUCCEEDED");
    },
    async (_url, request) =>
      Response.json({
        ...request,
        amount: 10000,
        transId: 12345,
        resultCode: 0,
      }),
  );
});

test("the checkout status API verifies ownership and never trusts browser success flags", async () => {
  const f = fixture("MOMO");
  f.state.user.id = "other";
  assert.equal(
    (
      await f.paymentStatus(
        f.postRequest({ orderId: f.order.id, status: "paid" }),
      )
    ).status,
    404,
  );
  f.state.user.id = "owner";
  await withQueryProvider(
    async () => {
      const response = await f.paymentStatus(
        f.postRequest({ orderId: f.order.id, status: "paid" }),
      );
      assert.equal(response.status, 200);
      assert.equal((await response.json()).order.status, "pending");
      assert.equal(f.order.status, "pending");
    },
    async () => {
      throw new Error("Provider offline");
    },
  );
});

function retryFixture(method) {
  const f = fixture(method);
  f.order.deliveryStatus = "pending";
  f.order.products = [
    {
      id: "b".repeat(24),
      name: "Phone",
      category: "Phone",
      brand: "SGTech",
      price: 10000,
      quantity: 1,
      selectedImg: {
        color: "Black",
        colorCode: "#000000",
        image: "https://example.test/phone.png",
      },
    },
  ];
  f.order.address = {
    line1: "1 Test Street",
    city: "Test City",
    state: "Test State",
    country: "VN",
    postal_code: "700000",
  };
  f.order.recipientPhone = "0900000000";
  f.submitRetry = (key = "stable-retry") =>
    f.retry(f.postRequest({ retry_request_id: key }), {
      params: Promise.resolve({ orderId: f.order.id }),
    });
  return f;
}

function failedQuery(method, request, patch = {}) {
  return method === "VNPAY"
    ? Response.json(
        vnpQueryResponse(request, {
          vnp_TransactionStatus: "02",
          vnp_TransactionNo: "0",
          ...patch,
        }),
      )
    : Response.json({
        partnerCode: "FIXTUREMOMO",
        requestId: request.requestId,
        orderId: request.orderId,
        amount: 10000,
        resultCode: 1005,
        transId: 0,
        ...patch,
      });
}

for (const method of ["VNPAY", "MOMO"]) {
  test(
    method +
      " retry keeps one order and immutable snapshots, reuses the attempt after reload",
    async () => {
      const f = retryFixture(method);
      const original = structuredClone(f.order);
      let creations = 0;
      let queries = 0;
      await withQueryProvider(
        async () => {
          const first = await f.submitRetry();
          assert.equal(first.status, 200);
          const body = await first.json();
          const reference = f.order.activePaymentAttemptId;
          assert.notEqual(reference, original.paymentIntentId);
          assert.equal(f.order.paymentIntentId, original.paymentIntentId);
          assert.equal(f.order.status, "pending");
          assert.equal(f.rows.size, 1);
          assert.equal(f.attempts.size, 2);
          assert.equal(
            f.attempts.get(original.paymentIntentId).state,
            "FAILED",
          );
          assert.ok(f.attempts.get(original.paymentIntentId).failureVerifiedAt);
          for (const key of [
            "amount",
            "products",
            "address",
            "recipientName",
            "recipientPhone",
            "deliveryStatus",
          ])
            assert.deepEqual(f.order[key], original[key]);
          assert.equal((await f.submitRetry()).status, 200);
          const resumed = await (await f.submitRetry()).json();
          assert.equal(resumed.url, body.url);
          assert.equal(f.order.activePaymentAttemptId, reference);
          assert.equal(queries, 1);
          assert.equal(creations, method === "MOMO" ? 1 : 0);
        },
        async (url, request) => {
          if (url.pathname.endsWith("/create")) {
            creations++;
            return Response.json({
              resultCode: 0,
              payUrl:
                "https://test-payment.momo.vn/pay?order=" + request.orderId,
              orderId: request.orderId,
              requestId: request.requestId,
              partnerCode: request.partnerCode,
            });
          }
          queries++;
          return failedQuery(method, request);
        },
      );
    },
  );

  test(
    method +
      " retry rejects pending, unknown, tampered and offline responses even if an old failed proof exists",
    async () => {
      for (const mode of ["pending", "offline", "amount", "not-found"]) {
        const f = retryFixture(method);
        f.order.status = "failed";
        const attempt = await f.reconciliation.ensurePaymentAttempt(f.order);
        Object.assign(f.attempts.get(attempt.id), {
          state: "FAILED",
          failureVerifiedAt: new Date(Date.now() + 60000),
        });
        await withQueryProvider(
          async () => {
            assert.equal((await f.submitRetry()).status, 409, mode);
            assert.equal(f.attempts.size, 1);
            assert.equal(f.order.activePaymentAttemptId, undefined);
          },
          async (_url, request) => {
            if (mode === "offline") throw new Error("timeout");
            if (method === "VNPAY")
              return failedQuery(
                method,
                request,
                mode === "pending"
                  ? { vnp_TransactionStatus: "01" }
                  : mode === "amount"
                    ? { vnp_Amount: "100" }
                    : { vnp_ResponseCode: "91" },
              );
            return failedQuery(
              method,
              request,
              mode === "pending"
                ? { resultCode: 9000 }
                : mode === "amount"
                  ? { amount: 1 }
                  : { resultCode: 100 },
            );
          },
        );
      }
    },
  );

  test(
    method + " concurrent retries create only one active provider attempt",
    async () => {
      const f = retryFixture(method);
      let creations = 0;
      await withQueryProvider(
        async () => {
          const results = await Promise.all([
            f.submitRetry("tab-one"),
            f.submitRetry("tab-two"),
          ]);
          assert.equal(
            results.filter((response) => response.status === 200).length,
            1,
          );
          assert.equal(
            results.filter((response) => response.status === 409).length,
            1,
          );
          assert.equal(f.rows.size, 1);
          assert.equal(f.attempts.size, 2);
          assert.equal(creations, method === "MOMO" ? 1 : 0);
        },
        async (url, request) => {
          if (url.pathname.endsWith("/create")) {
            creations++;
            return Response.json({
              resultCode: 0,
              payUrl: "https://test-payment.momo.vn/pay",
            });
          }
          return failedQuery(method, request);
        },
      );
    },
  );

  test(
    method +
      " late callbacks settle the same order, flag duplicates once and preserve successful receipts",
    async () => {
      const f = retryFixture(method);
      await withQueryProvider(
        async () => {
          assert.equal((await f.submitRetry()).status, 200);
        },
        async (url, request) =>
          url.pathname.endsWith("/create")
            ? Response.json({
                resultCode: 0,
                payUrl: "https://test-payment.momo.vn/pay",
              })
            : failedQuery(method, request),
      );
      const newReference = f.order.activePaymentAttemptId;
      await f.notify();
      assert.equal(f.order.status, "paid");
      assert.equal(f.order.paidPaymentAttemptId, f.order.paymentIntentId);
      assert.equal([...f.exceptions.values()][0].reason, "LATE_SUCCESS");
      const callback =
        method === "VNPAY"
          ? { vnp_TxnRef: newReference, vnp_TransactionNo: "999" }
          : { orderId: newReference, requestId: newReference, transId: 999 };
      await f.notify(callback);
      await f.notify(callback);
      assert.equal(f.exceptions.size, 2);
      assert.equal(
        [...f.exceptions.values()].filter(
          (row) => row.reason === "DUPLICATE_PAYMENT",
        ).length,
        1,
      );
      assert.equal(f.order.paidPaymentAttemptId, f.order.paymentIntentId);
      assert.equal(f.attempts.get(newReference).state, "SUCCEEDED");
      assert.equal(f.attempts.get(newReference).providerTransactionId, "999");
      await f.notify(
        method === "VNPAY"
          ? {
              ...callback,
              vnp_ResponseCode: "24",
              vnp_TransactionStatus: "02",
              vnp_TransactionNo: "0",
            }
          : { ...callback, resultCode: 1005, transId: 0 },
      );
      assert.equal(f.order.status, "paid");
      assert.equal(f.attempts.get(newReference).providerTransactionId, "999");
      assert.equal(f.order.deliveryStatus, "pending");
    },
  );

  test(
    method + " failed callbacks from an old attempt cannot fail a new attempt",
    async () => {
      const f = retryFixture(method);
      await withQueryProvider(
        async () => assert.equal((await f.submitRetry()).status, 200),
        async (url, request) =>
          url.pathname.endsWith("/create")
            ? Response.json({
                resultCode: 0,
                payUrl: "https://test-payment.momo.vn/pay",
              })
            : failedQuery(method, request),
      );
      await f.notify(
        method === "VNPAY"
          ? {
              vnp_ResponseCode: "24",
              vnp_TransactionStatus: "02",
              vnp_TransactionNo: "0",
            }
          : { resultCode: 1005, transId: 0 },
      );
      assert.equal(f.order.status, "pending");
      assert.equal(
        f.attempts.get(f.order.activePaymentAttemptId).state,
        "READY",
      );
    },
  );
}

test("retry ownership, invalid keys, shipped/cancelled/paid/COD orders are rejected before provider calls", async () => {
  for (const mode of [
    "anonymous",
    "foreign",
    "invalid-key",
    "shipped",
    "cancelled",
    "paid",
    "COD",
  ]) {
    const f = retryFixture("VNPAY");
    if (mode === "anonymous") f.state.user = null;
    if (mode === "foreign") f.state.user.id = "another-user";
    if (mode === "shipped") f.order.deliveryStatus = "dispatched";
    if (["cancelled", "paid"].includes(mode)) f.order.status = mode;
    if (mode === "COD") f.order.paymentMethod = "COD";
    await withQueryProvider(
      async () => {
        const response = await f.submitRetry(
          mode === "invalid-key" ? "bad key!" : "stable-retry",
        );
        assert.equal(
          response.status,
          mode === "anonymous"
            ? 401
            : mode === "foreign"
              ? 404
              : mode === "invalid-key"
                ? 400
                : 409,
        );
        assert.equal(f.attempts.size, 0);
      },
      async () => {
        throw new Error("must not contact provider");
      },
    );
  }
});

test("retry stops if success arrives while the failure query is in flight", async () => {
  const f = retryFixture("VNPAY");
  await withQueryProvider(
    async () => {
      assert.equal((await f.submitRetry()).status, 409);
      assert.equal(f.order.status, "paid");
      assert.equal(f.attempts.size, 1);
      assert.equal(f.order.activePaymentAttemptId, undefined);
    },
    async (_url, request) => {
      await f.notify();
      return failedQuery("VNPAY", request);
    },
  );
});

test("MoMo retry timeout remains unknown and replay never makes a second create call", async () => {
  const f = retryFixture("MOMO");
  let creations = 0;
  await withQueryProvider(
    async () => {
      assert.equal((await f.submitRetry()).status, 502);
      assert.equal(
        f.attempts.get(f.order.activePaymentAttemptId).state,
        "UNKNOWN",
      );
      assert.equal((await f.submitRetry()).status, 409);
      assert.equal(creations, 1);
      assert.equal(f.attempts.size, 2);
    },
    async (url, request) => {
      if (url.pathname.endsWith("/create")) {
        creations++;
        throw new Error("timeout");
      }
      return failedQuery("MOMO", request);
    },
  );
});

test("exception persistence failure asks the provider to retry and recovers idempotently", async () => {
  const f = retryFixture("VNPAY");
  await withQueryProvider(
    async () => assert.equal((await f.submitRetry()).status, 200),
    async (_url, request) => failedQuery("VNPAY", request),
  );
  f.state.exceptionError = true;
  assert.equal((await (await f.notify()).json()).RspCode, "99");
  assert.equal(f.order.status, "paid");
  f.state.exceptionError = false;
  assert.equal((await (await f.notify()).json()).RspCode, "02");
  assert.equal(f.exceptions.size, 1);
});

test("administrators review exceptions once with a note and durable audit without changing payments", async () => {
  const f = retryFixture("VNPAY");
  await withQueryProvider(
    async () => assert.equal((await f.submitRetry()).status, 200),
    async (_url, request) => failedQuery("VNPAY", request),
  );
  await f.notify();
  const exception = [...f.exceptions.values()][0];
  const params = { params: Promise.resolve({ exceptionId: exception.id }) };
  assert.equal(
    (await f.exceptionQueue(new Request("http://localhost/?status=OPEN")))
      .status,
    403,
  );
  assert.equal(
    (
      await f.reviewException(
        f.postRequest({
          status: "REFUND_REQUIRED",
          note: "Need provider refund",
        }),
        params,
      )
    ).status,
    403,
  );
  f.state.user.role = "ADMIN";
  assert.equal(
    (
      await (
        await f.exceptionQueue(new Request("http://localhost/?status=OPEN"))
      ).json()
    ).exceptions.length,
    1,
  );
  assert.equal(
    (
      await f.reviewException(
        f.postRequest({ status: "REFUNDED", note: "Need provider refund" }),
        params,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.reviewException(
        f.postRequest({ status: "REFUND_REQUIRED", note: "short" }),
        params,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.reviewException(
        f.postRequest({
          status: "REFUND_REQUIRED",
          note: "Need provider refund",
        }),
        params,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await f.reviewException(
        f.postRequest({ status: "REVIEWED", note: "Overwrite review" }),
        params,
      )
    ).status,
    409,
  );
  assert.equal(exception.status, "REFUND_REQUIRED");
  assert.equal(f.order.status, "paid");
  assert.equal(f.auditLogs.at(-1).status, "SUCCEEDED");
});

for (const stage of ["reserved", "activated"]) {
  test(
    "retry recovers a process interruption after " +
      stage +
      " without another attempt",
    async () => {
      const f = retryFixture("VNPAY");
      f.state.interruptRetryAt = stage;
      await withQueryProvider(
        async () => {
          assert.equal((await f.submitRetry()).status, 503);
          assert.equal(f.attempts.size, 2);
          if (stage === "activated") {
            const before = f.attempts.get(f.order.activePaymentAttemptId).state;
            assert.equal(
              (await f.reconciliation.reconcilePayment(f.order, true)).skipped,
              true,
            );
            assert.equal(
              f.attempts.get(f.order.activePaymentAttemptId).state,
              before,
            );
          }
          assert.equal((await f.submitRetry()).status, 200);
          assert.equal(f.attempts.size, 2);
          assert.equal(
            f.attempts.get(f.order.activePaymentAttemptId).state,
            "READY",
          );
        },
        async (_url, request) => failedQuery("VNPAY", request),
      );
    },
  );
}

test("retry returns after a provider redirect still resolve the original order and never mutate it", async () => {
  for (const method of ["VNPAY", "MOMO"]) {
    const f = retryFixture(method);
    await withQueryProvider(
      async () => assert.equal((await f.submitRetry()).status, 200),
      async (url, request) =>
        url.pathname.endsWith("/create")
          ? Response.json({
              resultCode: 0,
              payUrl: "https://test-payment.momo.vn/pay",
            })
          : failedQuery(method, request),
    );
    const reference = f.order.activePaymentAttemptId;
    const params =
      method === "VNPAY"
        ? f.vnpParams({ vnp_TxnRef: reference })
        : new URLSearchParams(
            f.momoPayload({ orderId: reference, requestId: reference }),
          );
    const response = await f.returns[method](f.getRequest(params));
    assert.equal(
      new URL(response.headers.get("Location")).searchParams.get("order"),
      f.order.id,
    );
    assert.equal(f.order.status, "pending");
  }
});

test("worker recovers a pending exception even after the successful attempt leaves the normal query queue", async () => {
  const f = retryFixture("VNPAY");
  await withQueryProvider(
    async () => assert.equal((await f.submitRetry()).status, 200),
    async (_url, request) => failedQuery("VNPAY", request),
  );
  f.state.exceptionError = true;
  await f.notify();
  const attempt = f.attempts.get(f.order.paymentIntentId);
  assert.equal(attempt.state, "SUCCEEDED");
  assert.equal(attempt.exceptionPending, true);
  f.state.exceptionError = false;
  // Future dates keep unrelated READY payments out of this recovery test.
  f.attempts.get(f.order.activePaymentAttemptId).nextCheckAt = new Date(
    Date.now() + 3600000,
  );
  await withQueryProvider(
    async () => {
      await f.reconciliation.reconcilePendingPayments();
      assert.equal(f.exceptions.size, 1);
      assert.equal(attempt.exceptionPending, false);
      assert.equal(f.order.status, "paid");
    },
    async () => {
      throw new Error("recovery does not query provider");
    },
  );
});
