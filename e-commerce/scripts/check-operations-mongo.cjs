const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const sourceLoader = require("../tests/fixtures/load-source.cjs");
const { verifyBackupRestore } = require("./mongo-backup-qa.cjs");
require("@next/env").loadEnvConfig(path.resolve(__dirname, ".."));

async function main() {
  const suffix =
    Date.now() + "_" + randomUUID().replaceAll("-", "").slice(0, 4);
  const database = "sgtech_ops_qa_" + suffix;
  const restoredDatabase = "sgtech_restore_qa_" + suffix;
  const appUrl = process.env.DATABASE_URL;
  const sourceUrl = new URL(appUrl),
    restoreUrl = new URL(appUrl);
  sourceUrl.pathname = "/" + database;
  restoreUrl.pathname = "/" + restoredDatabase;
  assert.notEqual(sourceUrl.pathname, new URL(appUrl).pathname);
  assert.notEqual(restoreUrl.pathname, new URL(appUrl).pathname);
  const prisma = new PrismaClient({
    datasources: { db: { url: sourceUrl.toString() } },
  });
  const restorePrisma = new PrismaClient({
    datasources: { db: { url: restoreUrl.toString() } },
  });
  const rateInstances = Array.from(
    { length: 4 },
    () =>
      new PrismaClient({ datasources: { db: { url: sourceUrl.toString() } } }),
  );
  const actor = { id: "e".repeat(24), role: "ADMIN" };
  let providerCalls = 0;
  const load = sourceLoader({
    "@/libs/prismadb": { __esModule: true, default: prisma },
    "@/actions/getCurrentUser": { getCurrentUser: async () => actor },
    "@/libs/stripe": {
      getStripe: () => ({
        paymentIntents: {
          create: async (data) => {
            providerCalls++;
            return {
              id: "pi_qa_recovered",
              livemode: false,
              amount: data.amount,
              currency: data.currency,
              metadata: data.metadata,
            };
          },
        },
      }),
    },
    "next/server": { NextResponse: { json: Response.json } },
  });
  const job = load("libs/operationalJobs.ts");
  const stock = load("libs/orderStock.ts");
  const checkout = load("libs/checkoutRequest.ts");
  const items = load("libs/orderItems.ts");
  const checks = [];
  try {
    for (const collection of [
      "User",
      "Category",
      "Brand",
      "Product",
      "ProductVariant",
      "Order",
      "PaymentAttempt",
      "PaymentException",
      "OperationalJob",
      "OperationalIncident",
      "AuditLog",
      "ShippingPolicy",
      "CheckoutRequest",
      "AuthRateLimit",
      "SupportConversation",
      "SupportMessage",
      "SupportAttachment",
      "NotificationEvent",
      "NotificationInbox",
      "Notification",
      "NotificationDelivery",
      "SupportTicket",
      "SupportTicketNote",
      "SupportSettings",
      "CustomerServiceSettings",
      "CustomerServiceRevision",
    ])
      await prisma.$runCommandRaw({ create: collection });
    await prisma.$runCommandRaw({
      createIndexes: "AuthRateLimit",
      indexes: [{ key: { expiresAt: 1 }, name: "qa_expiry" }],
    });
    await prisma.user.create({
      data: {
        id: actor.id,
        name: "Private QA administrator",
        email: "qa-ops@example.invalid",
        role: "ADMIN",
        sessionVersion: 0,
      },
    });
    const claimResults = await Promise.all(
      Array.from({ length: 20 }, () => job.claimOperationalJob()),
    );
    assert.equal(claimResults.filter(Boolean).length, 1);
    const firstToken = claimResults.find(Boolean);
    await prisma.operationalJob.update({
      where: { id: "payment-reconciliation" },
      data: { leaseExpiresAt: new Date(0) },
    });
    const secondToken = await job.claimOperationalJob();
    assert.ok(secondToken);
    assert.equal(
      await job.finishOperationalJob(firstToken, { processed: 999 }),
      false,
    );
    assert.equal(
      await job.finishOperationalJob(secondToken, { processed: 0 }),
      true,
    );
    checks.push(
      "twenty real concurrent job claims; stale owner cannot finish; restart lease recovery",
    );
    const category = await prisma.category.create({
      data: { name: "QA category", slug: "qa-category" },
    });
    const brand = await prisma.brand.create({
      data: { name: "QA brand", slug: "qa-brand" },
    });
    const product = await prisma.product.create({
      data: {
        name: "QA product",
        slug: "qa-product",
        description: "Disposable operations fixture",
        status: "ACTIVE",
        categoryId: category.id,
        brandId: brand.id,
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: "QA-OPS",
        name: "Black",
        price: 10000,
        isActive: true,
        inStock: true,
        image: {
          color: "Black",
          colorCode: "#000000",
          image: "/products/iphone14-white.webp",
        },
        inventory: {
          onHand: 100,
          reserved: 0,
          version: 1,
          updatedAt: new Date(),
        },
      },
    });
    const cart = await items.getOrderItems([
      { id: product.id, variantId: variant.id, quantity: 1 },
    ]);
    const delivery = {
      recipientName: "QA receiver",
      recipientPhone: "0900000000",
      address: {
        country: "VN",
        city: "QA city",
        line1: "QA Street",
        postal_code: "",
        state: "",
      },
    };
    const expiredIds = [];
    await prisma.shippingPolicy.create({ data: { id: "default", version: 1, label: "QA operations pricing", enabled: true, fee: 0, freeShippingThreshold: null, nationwide: true, provinceCodes: [] } });
    const prepare = checkout.prepareCheckoutRequest;
    checkout.prepareCheckoutRequest = async (key, userId, method, selectedCart, selectedDelivery, merchant, options) => {
      const address = { ...(selectedDelivery || delivery), address: { ...(selectedDelivery || delivery).address, provinceCode: "79" } };
      const quote = await load("libs/checkoutQuote.ts").createCheckoutQuote(userId, selectedCart, address);
      return prepare(key, userId, method, selectedCart, address, merchant, options, quote.token);
    };
    for (let index = 0; index < 61; index++) {
      const { order } = await checkout.prepareCheckoutRequest(
        randomUUID(),
        actor.id,
        "COD",
        cart,
        delivery,
      );
      expiredIds.push(order.id);
      await prisma.order.update({
        where: { id: order.id },
        data: {
          stockReservation: {
            set: { ...order.stockReservation, expiresAt: new Date(0) },
          },
        },
      });
    }
    assert.equal(
      (await prisma.productVariant.findUnique({ where: { id: variant.id } }))
        .inventory.reserved,
      61,
    );
    assert.equal(await stock.expireUnconfirmedCodStock(), 50);
    assert.equal(await stock.expireUnconfirmedCodStock(), 11);
    assert.equal(await stock.expireUnconfirmedCodStock(), 0);
    assert.equal(
      await prisma.order.count({
        where: { id: { in: expiredIds }, status: "cancelled" },
      }),
      61,
    );
    assert.equal(
      (await prisma.productVariant.findUnique({ where: { id: variant.id } }))
        .inventory.reserved,
      0,
    );
    checks.push(
      "backlog exceeds one batch: 61 COD holds expire across runs, each released once",
    );
    for (const code of ["7000", "1005"]) {
      const { order, attempt } = await checkout.prepareCheckoutRequest(
        randomUUID(),
        actor.id,
        "MOMO",
        cart,
        delivery,
      );
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "failed" },
      });
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          state: "FAILED",
          resultCode: code,
          failureVerifiedAt: new Date(),
        },
      });
      await stock.releaseVerifiedFailedStock(order.id, attempt.id);
      assert.equal(
        (await prisma.order.findUnique({ where: { id: order.id } }))
          .stockReservation.state,
        code === "1005" ? "RELEASED" : "HELD",
      );
      if (code === "7000")
        await stock.withStockTransaction(async (tx) =>
          stock.releaseOrderStock(
            tx,
            await tx.order.findUnique({ where: { id: order.id } }),
            actor.id,
            "Private fixture cleanup, not an operational release of uncertain payments.",
          ),
        );
    }
    checks.push(
      "MoMo terminal query closure releases stock without guessed expiry; pending result keeps stock",
    );
    const expiredMomo = await checkout.prepareCheckoutRequest(
      randomUUID(),
      actor.id,
      "MOMO",
      cart,
      delivery,
    );
    await prisma.paymentAttempt.update({
      where: { id: expiredMomo.attempt.id },
      data: { state: "READY", startedAt: new Date() },
    });
    const momo = load("libs/momo.ts");
    const query = sourceLoader({
      "@/libs/prismadb": { __esModule: true, default: prisma },
      "@/libs/momo": {
        ...momo,
        getMomoConfig: () => ({
          partnerCode: "PRIVATE_QA",
          accessKey: "qa-only",
          secretKey: "qa-only",
        }),
      },
    })("libs/queryOnlinePayment.ts");
    const originalFetch = global.fetch;
    try {
      global.fetch = async (_url, options) => {
        const request = JSON.parse(options.body);
        return Response.json({
          partnerCode: request.partnerCode,
          orderId: request.orderId,
          requestId: request.requestId,
          resultCode: 1005,
        });
      };
      const confirmed = await query.queryMomoOrder(
        expiredMomo.order,
        expiredMomo.attempt,
      );
      assert.equal(confirmed.verifiedFailure, true);
    } finally {
      global.fetch = originalFetch;
    }
    const verifiedMomo = await prisma.paymentAttempt.findUnique({
      where: { id: expiredMomo.attempt.id },
    });
    assert.equal(verifiedMomo.state, "FAILED");
    assert.ok(verifiedMomo.failureVerifiedAt);
    await stock.releaseVerifiedFailedStock(
      expiredMomo.order.id,
      expiredMomo.attempt.id,
    );
    await stock.releaseVerifiedFailedStock(
      expiredMomo.order.id,
      expiredMomo.attempt.id,
    );
    assert.equal(
      (await prisma.order.findUnique({ where: { id: expiredMomo.order.id } }))
        .stockReservation.state,
      "RELEASED",
    );
    assert.equal(
      (await prisma.productVariant.findUnique({ where: { id: variant.id } }))
        .inventory.reserved,
      0,
    );
    checks.push(
      "MoMo expired query omitting amount verifies closure in MongoDB and releases once; no provider network request",
    );
    const prepared = await checkout.prepareCheckoutRequest(
      randomUUID(),
      actor.id,
      "STRIPE",
      cart,
      null,
    );
    await prisma.order.update({
      where: { id: prepared.order.id },
      data: { createDate: new Date(Date.now() - 2 * 3600000) },
    });
    const recover = load("libs/recoverCardHold.ts").recoverCardHold;
    await recover(
      prepared.order.id,
      1,
      actor.id,
      "Recover original private test intent",
    );
    await recover(
      prepared.order.id,
      1,
      actor.id,
      "Repeat original private test intent",
    );
    assert.equal(providerCalls, 1);
    assert.equal(
      (await prisma.order.findUnique({ where: { id: prepared.order.id } }))
        .paymentIntentId,
      "pi_qa_recovered",
    );
    assert.equal(
      (await prisma.productVariant.findUnique({ where: { id: variant.id } }))
        .inventory.reserved,
      1,
    );
    checks.push(
      "card hold recovery attaches original test intent once without releasing reserved inventory",
    );
    await stock.withStockTransaction(async (tx) =>
      stock.releaseOrderStock(
        tx,
        await tx.order.findUnique({ where: { id: prepared.order.id } }),
        actor.id,
        "Private fixture cleanup before the next test.",
      ),
    );
    const limiters = rateInstances.map((client) =>
      sourceLoader({
        "@/libs/prismadb": { __esModule: true, default: client },
      })("libs/authRateLimit.ts"),
    );
    const attempts = await Promise.allSettled(
      Array.from({ length: 30 }, (_, index) =>
        limiters[index % limiters.length].checkAuthRateLimit(
          "qa-distributed",
          "same-subject",
          5,
          60000,
        ),
      ),
    );
    assert.equal(
      attempts.filter((result) => result.status === "fulfilled").length,
      5,
    );
    const unexpected = attempts.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason.name !== "AuthRateLimitError",
    );
    if (unexpected.length)
      console.log(
        "Unexpected rate-limit error codes:",
        unexpected
          .map((result) => result.reason.code || result.reason.name)
          .join(","),
      );
    assert.equal(
      attempts.filter(
        (result) =>
          result.status === "rejected" &&
          result.reason.name === "AuthRateLimitError",
      ).length,
      25,
    );
    checks.push(
      "thirty concurrent auth attempts across four independent Prisma clients share one MongoDB counter; exactly five pass",
    );
    const operations = await load("libs/operations.ts").getOperationsReport();
    assert.equal(operations.counts.overdueOnlineHolds, 0);
    assert.equal(operations.job.status, "SUCCEEDED");
    const backupMessageId = "backup-message-" + randomUUID();
    await load("libs/supportStorage.ts").ensureSupportStorage();
    await load("libs/notificationStorage.ts").ensureNotificationStorage();
    const backupImageId = randomUUID().replaceAll("-", "").slice(0, 24);
    await prisma.supportConversation.create({ data: { id: actor.id, ownerId: actor.id, sequence: 1, adminUnread: 1, assignedTo: null } });
    await prisma.supportAttachment.create({ data: { id: backupImageId, conversationId: actor.id, uploadedBy: actor.id, contentType: "image/png", size: 8, bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), fingerprint: "private-backup-fixture", messageId: backupMessageId } });
    await prisma.supportMessage.create({ data: { id: backupMessageId, conversationId: actor.id, authorId: actor.id, senderRole: "CUSTOMER", sequence: 1, text: "Private backup fixture message", fingerprint: "private-backup-fixture", attachmentId: backupImageId } });
    await prisma.$transaction(tx => load("libs/notifications.ts").publishNotification(tx, { key: "backup-event", kind: "SUPPORT_MESSAGE", entityId: actor.id }, [{ id: actor.id, audience: "ADMIN", title: "Private notification fixture", href: "/admin/support/" + actor.id }]));
    const backupNotification = await prisma.notification.findFirst({ where: { recipientId: actor.id } });
    await load("libs/notifications.ts").readNotifications(actor.id, "ADMIN", { id: backupNotification.id });
    await prisma.notificationDelivery.create({data:{id:'b'.repeat(64),eventId:backupNotification.eventId,recipientId:actor.id,orderId:backupNotification.entityId,subject:'Private queued email fixture',href:'/orders/'+backupNotification.entityId,amount:10000,currency:'vnd',state:'UNKNOWN',version:3,attempts:1,autoAttempts:1,toEmail:'qa-ops@example.invalid',resultCode:'SMTP_OUTCOME_UNCONFIRMED',nextAttemptAt:null,leaseToken:null,leaseExpiresAt:null,startedAt:new Date(),finishedAt:new Date()}});
    await load('libs/supportTicketStorage.ts').ensureSupportTicketStorage();
    await prisma.supportTicket.create({data:{id:actor.id,ownerId:actor.id,conversationId:actor.id,initialMessageId:backupMessageId,category:'GENERAL',subject:'Private backup support request',fingerprint:'qa-ticket-backup'}});
    await prisma.supportTicketNote.create({data:{id:'c'.repeat(64),ticketId:actor.id,actorId:actor.id,text:'Private backup internal note',fingerprint:'qa-note-backup'}});
    const schedule=load('utils/supportHours.ts').blankSupportSchedule();schedule.week[1].enabled=true;
    await prisma.supportSettings.create({data:{id:'default',version:3,draft:{...schedule,message:'Private unpublished backup draft'},published:schedule,publishedAt:new Date()}});
    await load('libs/customerServiceStorage.ts').ensureCustomerServiceStorage();
    const serviceContent=load('utils/customerServiceStarter.ts').starterServiceContent(),serviceRevision=await prisma.customerServiceRevision.create({data:{id:'d'.repeat(24),revision:2,content:serviceContent,publishedBy:actor.id}});
    await prisma.customerServiceSettings.create({data:{id:'default',version:3,draft:{...serviceContent,contact:{...serviceContent.contact,storeName:'Private unpublished draft'}},publishedRevisionId:serviceRevision.id}});
    // Populate a saved policy snapshot only in this disposable BSON backup fixture.
    await prisma.order.update({where:{id:expiredIds[0]},data:{servicePolicies:{id:serviceRevision.id,revision:2,publishedAt:serviceRevision.publishedAt.toISOString(),pages:{shipping:serviceContent.pages.shipping,returns:serviceContent.pages.returns,warranty:serviceContent.pages.warranty}}}});
    const backup = await verifyBackupRestore({
      sourceUrl: sourceUrl.toString(),
      targetUrl: restoreUrl.toString(),
      applicationUrl: appUrl,
      sourcePrisma: prisma,
      targetPrisma: restorePrisma,
    });
    checks.push(
      "mongodump/mongorestore round trip verifies all fixture documents, BSON types and indexes in a separate database",
    );
    fs.mkdirSync(".artifacts", { recursive: true });
    fs.writeFileSync(
      ".artifacts/p0-mongo-results.json",
      JSON.stringify(
        {
          checks,
          backup,
          applicationDatabaseWrites: 0,
          providerNetworkCalls: 0,
          liveMoneyTransactions: 0,
        },
        null,
        2,
      ),
    );
    console.log(
      "Operations MongoDB passed: " +
        checks.length +
        " groups; backup collections: " +
        backup.collections,
    );
  } finally {
    assert.equal(sourceUrl.pathname, "/" + database);
    assert.equal(restoreUrl.pathname, "/" + restoredDatabase);
    assert.match(database, /^sgtech_ops_qa_\d+_[a-f0-9]+$/);
    assert.match(restoredDatabase, /^sgtech_restore_qa_\d+_[a-f0-9]+$/);
    await prisma.$runCommandRaw({ dropDatabase: 1 });
    await restorePrisma.$runCommandRaw({ dropDatabase: 1 });
    await prisma.$disconnect();
    await restorePrisma.$disconnect();
    await Promise.all(rateInstances.map((client) => client.$disconnect()));
  }
}
main().catch((error) => {
  console.error("Operations MongoDB QA failed:", error.code || error.name);
  if (["AssertionError", "PrismaClientValidationError"].includes(error.name))
    console.error(
      String(error.message).replace(
        /mongodb(?:\+srv)?:\/\/[^\s'"`]+/g,
        "[REDACTED]",
      ),
    );
  process.exitCode = 1;
});
