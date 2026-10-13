const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Execute real application handlers with isolated database/mail adapters.
// No private .env, network calls, emails or database changes are used.
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

const validation = loadSource("libs/authValidation.ts");
const safeUsers = loadSource("libs/safeUser.ts");
const resetTokens = loadSource("libs/passwordReset.ts");
const rawToken = "a".repeat(64);
const tokenHash = resetTokens.hashPasswordResetToken(rawToken);

function fixture() {
  const users = new Map();
  const auditLogs = [];
  const buckets = new Map();
  const state = {
    databaseError: false,
    mailError: false,
    hashHook: null,
    duplicateCreate: false,
  };
  const emails = [];
  const hashes = [];
  const owner = {
    id: "owner",
    name: "Phong",
    email: "owner@example.test",
    image: null,
    address: "Delivery address",
    phoneNumber: "0901234567",
    role: "USER",
    hashedPassword: "existing-password-hash",
    resetPasswordToken: tokenHash,
    resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    emailVerified: null,
    status: "ACTIVE",
    sessionVersion: 0,
    pendingEmail: null,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    emailVerificationVersion: null,
    extraSecret: "must-never-be-returned",
  };
  users.set(owner.id, owner);
  const matches = (row, where) =>
    Object.entries(where).every(([key, value]) => {
      if (key === "OR") {
        return value.some((condition) => matches(row, condition));
      }
      if (key === "AND") {
        return value.every((condition) => matches(row, condition));
      }
      if (value && typeof value === "object" && !(value instanceof Date)) {
        if ("isSet" in value) return Object.hasOwn(row, key) === value.isSet;
        if ("gt" in value) return row[key] > value.gt;
        if ("lte" in value) return row[key] <= value.lte;
        if ("contains" in value)
          return String(row[key] || "")
            .toLowerCase()
            .includes(value.contains.toLowerCase());
      }
      return row[key] === value;
    });
  const find = (where) =>
    [...users.values()].find((row) => matches(row, where));
  const failIfNeeded = () => {
    if (state.databaseError)
      throw new Error("private-database-password-internal");
  };
  const prisma = {
    auditLog: {
      count: async () => auditLogs.length,
      create: async ({ data }) => {
        if (state.auditError) throw new Error("private-audit-database-error");
        const log = {
          id: `audit-${auditLogs.length + 1}`,
          createdAt: new Date(),
          ...structuredClone(data),
        };
        auditLogs.push(log);
        return structuredClone(log);
      },
      update: async ({ where, data }) => {
        const log = auditLogs.find((log) => log.id === where.id);
        Object.assign(log, structuredClone(data));
        return structuredClone(log);
      },
      findMany: async ({ skip = 0, take = 100 }) =>
        structuredClone(
          auditLogs
            .slice()
            .reverse()
            .slice(skip, skip + take),
        ),
    },
    user: {
      count: async ({ where = {} }) => {
        failIfNeeded();
        return [...users.values()].filter((row) => matches(row, where)).length;
      },
      findMany: async ({ where = {}, select, skip = 0, take = 100 }) => {
        failIfNeeded();
        const results = [...users.values()]
          .filter((row) => matches(row, where))
          .slice(skip, skip + take);
        return structuredClone(
          results.map((row) =>
            select
              ? Object.fromEntries(
                  Object.keys(select).map((key) => [key, row[key]]),
                )
              : row,
          ),
        );
      },
      findUnique: async ({ where }) => {
        failIfNeeded();
        return structuredClone(find(where) || null);
      },
      findFirst: async ({ where, select }) => {
        failIfNeeded();
        const row = find(where);
        return row
          ? select
            ? Object.fromEntries(
                Object.keys(select).map((key) => [key, row[key]]),
              )
            : structuredClone(row)
          : null;
      },
      create: async ({ data }) => {
        failIfNeeded();
        if (state.duplicateCreate)
          throw Object.assign(new Error("unique"), { code: "P2002" });
        const row = { ...owner, ...data, id: `user-${users.size + 1}` };
        users.set(row.id, row);
        return structuredClone(row);
      },
      update: async ({ where, data }) => {
        failIfNeeded();
        const row = find(where);
        if (!row) throw new Error("Missing user");
        Object.assign(row, data);
        return structuredClone(row);
      },
      updateMany: async ({ where, data }) => {
        failIfNeeded();
        if (state.updateHook) {
          await state.updateHook({ where, data });
        }
        let count = 0;
        for (const row of users.values()) {
          if (matches(row, where)) {
            if (
              data.email &&
              [...users.values()].some(
                (other) => other.id !== row.id && other.email === data.email,
              )
            ) {
              throw Object.assign(new Error("unique email"), { code: "P2002" });
            }
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      },
    },
    account: {
      findUnique: async () =>
        state.linkedAccount
          ? { user: structuredClone(find({ id: state.linkedAccount })) }
          : null,
    },
    authRateLimit: {
      deleteMany: async ({ where }) => {
        let count = 0;
        for (const [id, bucket] of buckets) {
          if (bucket.expiresAt < where.expiresAt.lt) {
            buckets.delete(id);
            count++;
          }
        }
        return { count };
      },
      updateMany: async ({ where, data }) => {
        failIfNeeded();
        const row = buckets.get(where.id);
        if (!row || row.expiresAt > where.expiresAt.lte) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      upsert: async ({ where, create, update }) => {
        failIfNeeded();
        let row = buckets.get(where.id);
        if (row) row.attempts += update.attempts.increment;
        else {
          row = structuredClone(create);
          buckets.set(row.id, row);
        }
        return structuredClone(row);
      },
      update: async ({ where, data }) => {
        const row = buckets.get(where.id);
        row.attempts += data.attempts.increment;
        return structuredClone(row);
      },
    },
  };
  const bcrypt = {
    hash: async (password, rounds) => {
      hashes.push({ password, rounds });
      if (state.hashHook) await state.hashHook();
      return "new-password-hash";
    },
    compare: async (password, hash) =>
      password === "Correct1!" && hash === "existing-password-hash",
  };
  const mocks = {
    "@/libs/prismadb": { __esModule: true, default: prisma },
    "@/libs/authValidation": validation,
    "@/libs/safeUser": safeUsers,
    "@/libs/passwordReset": resetTokens,
    bcrypt: { __esModule: true, default: bcrypt, ...bcrypt },
    "next/server": {
      NextResponse: { json: (body, options) => Response.json(body, options) },
    },
    nodemailer: {
      createTransport: () => ({
        sendMail: async (mail) => {
          if (state.mailHook) {
            await state.mailHook();
          }
          if (state.mailError) throw new Error("private-smtp-key");
          emails.push(mail);
        },
      }),
    },
  };
  const rate = loadSource("libs/authRateLimit.ts", mocks);
  mocks["@/libs/authRateLimit"] = rate;
  mocks["@/libs/adminAudit"] = loadSource("libs/adminAudit.ts", mocks);
  mocks["@/utils/adminOrders"] = loadSource("utils/adminOrders.ts", mocks);
  mocks["@/utils/adminPayment"] = loadSource("utils/adminPayment.ts", mocks);
  mocks["@/libs/adminActivity"] = loadSource("libs/adminActivity.ts", mocks);
  const sessions = loadSource("libs/authSession.ts", mocks);
  mocks["@/libs/authSession"] = sessions;
  const verification = loadSource("libs/emailVerification.ts", mocks);
  mocks["@/libs/emailVerification"] = verification;
  state.sessionUser = {
    id: owner.id,
    sessionVersion: 0,
    authenticatedAt: Date.now(),
  };
  const actions = {
    getSession: async () => ({ user: state.sessionUser }),
    getCurrentUser: async () => {
      if (state.currentUserOverride !== undefined)
        return state.currentUserOverride;
      const user = state.sessionUser?.id
        ? await sessions.getActiveSessionUser(
            state.sessionUser.id,
            state.sessionUser.sessionVersion ?? 0,
          )
        : null;
      return user ? safeUsers.getSafeUser(user) : null;
    },
  };
  mocks["@/actions/getCurrentUser"] = actions;
  const authenticate = loadSource("libs/authenticateUser.ts", mocks);
  mocks["@/libs/authenticateUser"] = authenticate;
  const routes = {
    register: loadSource("app/api/register/route.ts", mocks).POST,
    login: loadSource("app/api/login/route.ts", mocks).POST,
    forgot: loadSource("app/api/forgot-password/route.ts", mocks).POST,
    reset: loadSource("app/api/reset-password/route.ts", mocks).POST,
    profile: loadSource("app/api/profile/route.ts", mocks).PATCH,
    requestVerification: loadSource(
      "app/api/email-verification/request/route.ts",
      mocks,
    ).POST,
    confirmVerification: loadSource(
      "app/api/email-verification/confirm/route.ts",
      mocks,
    ).POST,
    revokeSessions: loadSource(
      "app/api/profile/revoke-sessions/route.ts",
      mocks,
    ).POST,
    users: loadSource("app/api/admin/users/route.ts", mocks).GET,
    audit: loadSource("app/api/admin/audit/route.ts", mocks).GET,
    accountStatus: loadSource(
      "app/api/admin/users/[userId]/status/route.ts",
      mocks,
    ).PATCH,
  };
  const request = (body) =>
    new Request("http://localhost/api/auth-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  return {
    users,
    auditLogs,
    buckets,
    state,
    emails,
    hashes,
    owner,
    prisma,
    mocks,
    rate,
    routes,
    request,
    authenticate,
    sessions,
    verification,
    actions,
  };
}

test("safe user allowlist excludes password, reset tokens and future private fields", () => {
  const f = fixture();
  const result = safeUsers.getSafeUser(f.owner);
  assert.equal(result.id, f.owner.id);
  assert.equal(result.hasPassword, true);
  assert.equal(result.createdAt, f.owner.createdAt.toISOString());
  for (const key of [
    "hashedPassword",
    "resetPasswordToken",
    "resetPasswordExpires",
    "extraSecret",
  ]) {
    assert.equal(key in result, false);
  }
});

test("registration normalizes email, ignores supplied role and returns a safe user", async () => {
  const f = fixture();
  const response = await f.routes.register(
    f.request({
      name: " New customer ",
      email: " NEW@EXAMPLE.TEST ",
      password: "Strong123!",
      role: "ADMIN",
    }),
  );
  assert.equal(response.status, 201);
  const { user } = await response.json();
  assert.equal(user.email, "new@example.test");
  assert.equal(user.name, "New customer");
  assert.equal(user.role, "USER");
  assert.equal("hashedPassword" in user, false);
  assert.equal("resetPasswordToken" in user, false);
});

test("registration handles duplicate insert races without exposing database errors", async () => {
  const f = fixture();
  f.state.duplicateCreate = true;
  const response = await f.routes.register(
    f.request({
      name: "New customer",
      email: "new@example.test",
      password: "Strong123!",
    }),
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Email already in use" });
});

test("registration rejects invalid types, weak/oversized passwords and malformed JSON", async () => {
  const f = fixture();
  const base = {
    name: "New customer",
    email: "new@example.test",
    password: "Strong123!",
  };
  for (const patch of [
    { name: {} },
    { email: [] },
    { password: 12345678 },
    { password: "abcdefgh" },
    { password: "A1!" + "x".repeat(70) },
  ]) {
    assert.equal(
      (await f.routes.register(f.request({ ...base, ...patch }))).status,
      400,
    );
  }
  const malformed = new Request("http://localhost/register", {
    method: "POST",
    body: "{",
  });
  assert.equal((await f.routes.register(malformed)).status, 400);
  assert.equal(f.users.size, 1);
});

test("forgot password gives identical responses for existing and missing accounts", async () => {
  const previousUrl = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  try {
    const f = fixture();
    const known = await f.routes.forgot(
      f.request({ email: " OWNER@EXAMPLE.TEST " }),
    );
    const unknown = await f.routes.forgot(
      f.request({ email: "missing@example.test" }),
    );
    assert.equal(known.status, 200);
    assert.equal(unknown.status, 200);
    assert.deepEqual(await known.json(), await unknown.json());
    const token = f.emails[0].html.match(/token=([a-f0-9]{64})/)[1];
    assert.equal(
      f.owner.resetPasswordToken,
      resetTokens.hashPasswordResetToken(token),
    );
    assert.notEqual(f.owner.resetPasswordToken, token);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previousUrl;
  }
});

test("reset token updates the password once, clears token and rejects reuse", async () => {
  const f = fixture();
  const body = { token: rawToken, password: "NewStrong1!" };
  assert.equal((await f.routes.reset(f.request(body))).status, 200);
  assert.equal(f.owner.hashedPassword, "new-password-hash");
  assert.equal(f.owner.resetPasswordToken, null);
  assert.equal(f.owner.resetPasswordExpires, null);
  assert.equal((await f.routes.reset(f.request(body))).status, 400);
});

test("two simultaneous reset requests consume the token only once", async () => {
  const f = fixture();
  let waiting = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  f.state.hashHook = async () => {
    if (++waiting === 2) release();
    await gate;
  };
  const responses = await Promise.all([
    f.routes.reset(f.request({ token: rawToken, password: "FirstStrong1!" })),
    f.routes.reset(f.request({ token: rawToken, password: "SecondStrong1!" })),
  ]);
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 400],
  );
});

test("token expiry during password hashing prevents the final write", async () => {
  const f = fixture();
  f.state.hashHook = async () => {
    f.owner.resetPasswordExpires = new Date(0);
  };
  const response = await f.routes.reset(
    f.request({ token: rawToken, password: "NewStrong1!" }),
  );
  assert.equal(response.status, 400);
  assert.equal(f.owner.hashedPassword, "existing-password-hash");
});

test("a newer reset link cannot be consumed by an older in-flight request", async () => {
  const f = fixture();
  f.state.hashHook = async () => {
    f.owner.resetPasswordToken = resetTokens.hashPasswordResetToken(
      "b".repeat(64),
    );
  };
  const response = await f.routes.reset(
    f.request({ token: rawToken, password: "NewStrong1!" }),
  );
  assert.equal(response.status, 400);
  assert.equal(f.owner.hashedPassword, "existing-password-hash");
});

test("plaintext legacy tokens, wrong tokens and expired links are not accepted", async () => {
  for (const state of ["plaintext", "wrong", "expired"]) {
    const f = fixture();
    if (state === "plaintext") f.owner.resetPasswordToken = rawToken;
    if (state === "wrong")
      f.owner.resetPasswordToken = resetTokens.hashPasswordResetToken(
        "b".repeat(64),
      );
    if (state === "expired") f.owner.resetPasswordExpires = new Date(0);
    assert.equal(
      (
        await f.routes.reset(
          f.request({ token: rawToken, password: "NewStrong1!" }),
        )
      ).status,
      400,
    );
    assert.equal(f.owner.hashedPassword, "existing-password-hash");
  }
});

test("reset enforces the same password policy as registration", async () => {
  const f = fixture();
  for (const password of ["abcdefgh", "A1!" + "x".repeat(70), {}, null]) {
    assert.equal(
      (await f.routes.reset(f.request({ token: rawToken, password }))).status,
      400,
    );
  }
  assert.equal(f.hashes.length, 0);
});

test("rate limit is shared between isolated application instances", async () => {
  const f = fixture();
  const second = loadSource("libs/authRateLimit.ts", f.mocks);
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, (_, index) => {
      const limiter = index % 2 ? f.rate : second;
      return limiter.checkAuthRateLimit("parallel", "same-account", 3, 60_000);
    }),
  );
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    3,
  );
  assert.equal(f.buckets.size, 1);
  assert.equal([...f.buckets.values()][0].attempts, 12);
  assert.equal([...f.buckets.keys()][0].includes("same-account"), false);
});

test("an expired rate bucket starts a new window", async () => {
  const f = fixture();
  await f.rate.checkAuthRateLimit("expiry", "customer", 1, 60_000);
  await assert.rejects(
    f.rate.checkAuthRateLimit("expiry", "customer", 1, 60_000),
    { name: "AuthRateLimitError" },
  );
  [...f.buckets.values()][0].expiresAt = new Date(0);
  await f.rate.checkAuthRateLimit("expiry", "customer", 1, 60_000);
  assert.equal([...f.buckets.values()][0].attempts, 1);
});

test("first bucket insert conflict increments the existing shared bucket", async () => {
  const f = fixture();
  const originalUpsert = f.prisma.authRateLimit.upsert;
  f.prisma.authRateLimit.upsert = async (args) => {
    await originalUpsert(args);
    throw Object.assign(new Error("concurrent insert"), { code: "P2002" });
  };
  await assert.rejects(
    f.rate.checkAuthRateLimit("insert", "customer", 1, 60_000),
    { name: "AuthRateLimitError" },
  );
  assert.equal([...f.buckets.values()][0].attempts, 2);
});

test("forgot throttling returns Retry-After without identifying account existence", async () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) {
    assert.equal(
      (await f.routes.forgot(f.request({ email: "missing@example.test" })))
        .status,
      200,
    );
  }
  const blocked = await f.routes.forgot(
    f.request({ email: "missing@example.test" }),
  );
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
});

test("untrusted forwarded IP headers cannot bypass the shared network bucket", () => {
  const previous = process.env.AUTH_TRUST_PROXY;
  delete process.env.AUTH_TRUST_PROXY;
  assert.equal(
    fixture().rate.getAuthClientIp(
      new Headers({ "x-forwarded-for": "spoofed" }),
    ),
    "untrusted-network",
  );
  if (previous !== undefined) process.env.AUTH_TRUST_PROXY = previous;
});

test("login has a safe response and identical errors for missing account/wrong password", async () => {
  const f = fixture();
  const valid = await f.routes.login(
    f.request({
      emailOrUsername: " OWNER@EXAMPLE.TEST ",
      password: "Correct1!",
    }),
  );
  assert.equal(valid.status, 200);
  const { user } = await valid.json();
  assert.equal("resetPasswordToken" in user, false);
  assert.equal("hashedPassword" in user, false);
  const missing = await f.routes.login(
    f.request({ emailOrUsername: "missing@example.test", password: "Wrong1!" }),
  );
  const wrong = await f.routes.login(
    f.request({ emailOrUsername: "owner@example.test", password: "Wrong1!" }),
  );
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), await wrong.json());
});

test("database failures fail closed without leaking internal messages", async () => {
  const f = fixture();
  f.state.databaseError = true;
  for (const [route, body] of [
    ["register", {}],
    ["login", {}],
    ["forgot", {}],
    ["reset", {}],
  ]) {
    const response = await f.routes[route](f.request(body));
    assert.ok(response.status >= 500);
    assert.equal(
      (await response.text()).includes("private-database-password"),
      false,
    );
  }
});

function getAuthOptions(f) {
  const mocks = {
    ...f.mocks,
    "../../../libs/prismadb": { __esModule: true, default: f.prisma },
    "next-auth": { __esModule: true, default: (config) => config },
    "next-auth/providers/google": {
      __esModule: true,
      default: (options) => options,
    },
    "next-auth/providers/facebook": {
      __esModule: true,
      default: (options) => options,
    },
    "next-auth/providers/credentials": {
      __esModule: true,
      default: (options) => options,
    },
    "@next-auth/prisma-adapter": { PrismaAdapter: () => ({}) },
  };
  return loadSource("pages/api/auth/[...nextauth].ts", mocks).authOptions;
}

test("NextAuth JWT and session drop OAuth tokens, including legacy JWT fields", async () => {
  const f = fixture();
  const authOptions = getAuthOptions(f);
  assert.equal(authOptions.debug, false);
  const token = await authOptions.callbacks.jwt({
    token: {
      sub: "owner",
      name: "Phong",
      email: "owner@example.test",
      accessToken: "secret-access",
      idToken: "secret-id",
      hashedPassword: "private",
    },
  });
  assert.equal(token.userId, "owner");
  assert.equal("accessToken" in token, false);
  assert.equal("idToken" in token, false);
  const session = await authOptions.callbacks.session({
    session: {
      expires: "future",
      user: {
        name: "Phong",
        email: "owner@example.test",
        image: null,
        extraSecret: "private",
      },
      accessToken: "secret",
    },
    token,
  });
  assert.equal(session.user.id, "owner");
  assert.equal("accessToken" in session, false);
  assert.equal("extraSecret" in session.user, false);
  assert.equal("hashedPassword" in token, false);
});

test("email delivery failure stays generic and clears only the failed request token", async () => {
  const previousUrl = process.env.NEXTAUTH_URL;
  const previousLog = console.error;
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  console.error = () => {};
  try {
    const f = fixture();
    f.state.mailError = true;
    const known = await f.routes.forgot(
      f.request({ email: "owner@example.test" }),
    );
    const unknown = await f.routes.forgot(
      f.request({ email: "missing@example.test" }),
    );
    assert.equal(known.status, 200);
    assert.deepEqual(await known.json(), await unknown.json());
    assert.equal(f.owner.resetPasswordToken, null);

    const newerHash = resetTokens.hashPasswordResetToken("c".repeat(64));
    f.state.mailHook = async () => {
      f.owner.resetPasswordToken = newerHash;
    };
    assert.equal(
      (await f.routes.forgot(f.request({ email: "owner@example.test" })))
        .status,
      200,
    );
    assert.equal(f.owner.resetPasswordToken, newerHash);
  } finally {
    console.error = previousLog;
    if (previousUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previousUrl;
  }
});

test("login account limit blocks further password guesses with Retry-After", async () => {
  const f = fixture();
  for (let i = 0; i < 10; i++) {
    assert.equal(
      (
        await f.routes.login(
          f.request({
            emailOrUsername: "owner@example.test",
            password: "Wrong1!",
          }),
        )
      ).status,
      401,
    );
  }
  const blocked = await f.routes.login(
    f.request({ emailOrUsername: "owner@example.test", password: "Wrong1!" }),
  );
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
});

test("simultaneous requests reset an expired rate bucket only once", async () => {
  const f = fixture();
  await f.rate.checkAuthRateLimit("reset-window", "customer", 3, 60_000);
  [...f.buckets.values()][0].expiresAt = new Date(0);
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      f.rate.checkAuthRateLimit("reset-window", "customer", 3, 60_000),
    ),
  );
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    3,
  );
  assert.equal([...f.buckets.values()][0].attempts, 8);
});

test("password changes revoke existing JWTs and never accept client session updates", async () => {
  const f = fixture();
  const options = getAuthOptions(f);
  const oldToken = await options.callbacks.jwt({ token: { sub: f.owner.id } });
  const response = await f.routes.profile(
    f.request({ currentPassword: "Correct1!", newPassword: "NewStrong1!" }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sessionRevoked, true);
  assert.equal(f.owner.sessionVersion, 1);
  assert.equal(await f.actions.getCurrentUser(), null);
  const revoked = await options.callbacks.jwt({
    token: oldToken,
    trigger: "update",
    session: { sessionVersion: 1 },
  });
  assert.deepEqual(revoked, { sessionRevoked: true });
  f.owner.sessionVersion = 0;
  assert.deepEqual(await options.callbacks.jwt({ token: revoked }), revoked);
  const session = await options.callbacks.session({
    session: { expires: "future" },
    token: revoked,
  });
  assert.equal(session.user, undefined);
});

test("password reset invalidates other devices and pending email links", async () => {
  const f = fixture();
  f.owner.pendingEmail = "pending@example.test";
  f.owner.emailVerificationToken = "private-hash";
  const result = await f.routes.reset(
    f.request({ token: rawToken, password: "NewStrong1!" }),
  );
  assert.equal(result.status, 200);
  assert.equal(f.owner.sessionVersion, 1);
  assert.equal(f.owner.pendingEmail, null);
  assert.equal(f.owner.emailVerificationToken, null);
  assert.equal(await f.sessions.getActiveSessionUser(f.owner.id, 0), null);
});

test("a reset between credential verification and JWT issuance cannot mint a new session", async () => {
  const f = fixture();
  const authenticated = await f.authenticate.authenticateUser(
    "owner@example.test",
    "Correct1!",
    "test-network",
  );
  f.owner.sessionVersion++;
  const options = getAuthOptions(f);
  const user = {
    ...authenticated.user,
    sessionVersion: authenticated.sessionVersion,
  };
  assert.equal(
    await options.callbacks.signIn({
      user,
      account: { provider: "credentials" },
    }),
    false,
  );
  assert.deepEqual(
    await options.callbacks.jwt({
      token: {},
      user,
      account: { provider: "credentials" },
    }),
    { sessionRevoked: true },
  );
  const freshOAuth = await options.callbacks.jwt({
    token: {},
    user: { id: f.owner.id },
    account: { provider: "google" },
  });
  assert.equal(freshOAuth.sessionVersion, 1);
  assert.ok(freshOAuth.authenticatedAt > 0);
});

test("legacy missing and null account fields work until sessions are revoked", async () => {
  for (const legacy of ["missing", "null"]) {
    const f = fixture();
    if (legacy === "missing") {
      delete f.owner.sessionVersion;
      delete f.owner.status;
    } else {
      f.owner.sessionVersion = null;
      f.owner.status = null;
    }
    const options = getAuthOptions(f);
    const token = await options.callbacks.jwt({ token: { sub: f.owner.id } });
    assert.equal(token.sessionVersion, 0);
    assert.equal((await f.routes.revokeSessions()).status, 200);
    assert.equal(f.owner.sessionVersion, 1);
    assert.deepEqual(await options.callbacks.jwt({ token }), {
      sessionRevoked: true,
    });
    assert.equal((await f.routes.revokeSessions()).status, 401);
  }
});

test("removed users and invalid token versions cannot regain access", async () => {
  const f = fixture();
  const options = getAuthOptions(f);
  for (const version of ["0", -1, 0.5, NaN, Infinity]) {
    assert.deepEqual(
      await options.callbacks.jwt({
        token: { sub: f.owner.id, sessionVersion: version },
      }),
      { sessionRevoked: true },
    );
  }
  f.users.delete(f.owner.id);
  f.users.set("replacement", { ...f.owner, id: "replacement" });
  assert.deepEqual(
    await options.callbacks.jwt({
      token: { sub: f.owner.id, email: f.owner.email },
    }),
    { sessionRevoked: true },
  );
  const actions = loadSource("actions/getCurrentUser.ts", {
    ...f.mocks,
    "@/pages/api/auth/[...nextauth]": { authOptions: {} },
    "next-auth": {
      getServerSession: async () => ({
        user: { id: f.owner.id, email: f.owner.email },
      }),
    },
  });
  assert.equal(await actions.getCurrentUser(), null);
  f.state.databaseError = true;
  await assert.rejects(
    options.callbacks.jwt({ token: { sub: "replacement" } }),
  );
});

test("blocked accounts cannot use passwords, OAuth or old protected sessions", async () => {
  const f = fixture();
  f.owner.status = "BLOCKED";
  f.state.linkedAccount = f.owner.id;
  assert.equal(
    await f.authenticate.authenticateUser(
      f.owner.email,
      "Correct1!",
      "test-network",
    ),
    null,
  );
  assert.equal(await f.actions.getCurrentUser(), null);
  const options = getAuthOptions(f);
  for (const provider of ["google", "facebook"]) {
    assert.equal(
      await options.callbacks.signIn({
        user: { id: "oauth", email: f.owner.email },
        account: { provider, providerAccountId: "external" },
      }),
      false,
    );
  }
  assert.equal(
    (
      await f.routes.reset(
        f.request({ token: rawToken, password: "NewStrong1!" }),
      )
    ).status,
    400,
  );
  assert.equal(f.owner.hashedPassword, "existing-password-hash");
});

test("only admins can change customer status and unblocking does not restore old sessions", async () => {
  const f = fixture();
  const userId = "a".repeat(24);
  const target = { ...f.owner, id: userId, email: "target@example.test" };
  f.users.set(userId, target);
  const context = { params: Promise.resolve({ userId }) };
  assert.equal(
    (await f.routes.accountStatus(f.request({ status: "BLOCKED" }), context))
      .status,
    403,
  );
  f.state.currentUserOverride = {
    ...safeUsers.getSafeUser(f.owner),
    role: "ADMIN",
  };
  assert.equal(
    (
      await f.routes.accountStatus(
        f.request({ status: "BLOCKED", role: "ADMIN" }),
        context,
      )
    ).status,
    200,
  );
  assert.equal(target.status, "BLOCKED");
  assert.equal(target.role, "USER");
  assert.equal(target.sessionVersion, 1);
  assert.equal(f.users.size, 2);
  assert.equal(
    (await f.routes.accountStatus(f.request({ status: "ACTIVE" }), context))
      .status,
    200,
  );
  assert.equal(target.sessionVersion, 2);
  assert.equal(await f.sessions.getActiveSessionUser(userId, 0), null);
  target.role = "ADMIN";
  assert.equal(
    (await f.routes.accountStatus(f.request({ status: "BLOCKED" }), context))
      .status,
    400,
  );
});

test("Google verifies matching verified emails only and OAuth linking remains explicit", async () => {
  for (const [provider, emailVerified, email, expected] of [
    ["google", true, "owner@example.test", true],
    ["google", false, "owner@example.test", false],
    ["google", true, "other@example.test", false],
    ["facebook", true, "owner@example.test", false],
  ]) {
    const f = fixture();
    const options = getAuthOptions(f);
    assert.equal(options.providers[0].allowDangerousEmailAccountLinking, false);
    assert.equal(options.providers[1].allowDangerousEmailAccountLinking, false);
    await options.events.linkAccount({
      user: { id: f.owner.id },
      account: { provider },
      profile: { email, email_verified: emailVerified },
    });
    assert.equal(Boolean(f.owner.emailVerified), expected);
  }
});

test("passwordless setup requires a recent sign-in and ignores role/status injection", async () => {
  const f = fixture();
  f.owner.hashedPassword = null;
  f.state.sessionUser.authenticatedAt = Date.now() - 10 * 60 * 1000;
  const rejected = await f.routes.profile(
    f.request({ newPassword: "NewStrong1!" }),
  );
  assert.equal(rejected.status, 401);
  assert.equal((await rejected.json()).code, "AUTH_REAUTH_REQUIRED");
  f.state.sessionUser.authenticatedAt = Date.now();
  const accepted = await f.routes.profile(
    f.request({ newPassword: "NewStrong1!", role: "ADMIN", status: "BLOCKED" }),
  );
  assert.equal(accepted.status, 200);
  assert.equal(f.owner.role, "USER");
  assert.equal(f.owner.status, "ACTIVE");
  assert.equal(f.owner.sessionVersion, 1);
});

async function withVerificationUrl(callback) {
  const previous = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  try {
    await callback();
  } finally {
    if (previous === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previous;
  }
}

function getVerificationToken(f, index = f.emails.length - 1) {
  return f.emails[index].text.match(/token=([a-f0-9]{64})/)[1];
}

test("email changes require the current password and keep old login until confirmation", async () => {
  await withVerificationUrl(async () => {
    const f = fixture();
    const body = { email: "NEW@EXAMPLE.TEST" };
    assert.equal((await f.routes.profile(f.request(body))).status, 400);
    assert.equal(
      (
        await f.routes.profile(
          f.request({ ...body, currentPassword: "Wrong1!" }),
        )
      ).status,
      401,
    );
    const response = await f.routes.profile(
      f.request({ ...body, currentPassword: "Correct1!" }),
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.email, "owner@example.test");
    assert.equal(result.pendingEmail, "new@example.test");
    assert.equal(result.verificationSent, true);
    const token = getVerificationToken(f);
    assert.equal(
      f.owner.emailVerificationToken,
      f.verification.hashEmailVerificationToken(token),
    );
    assert.equal("emailVerificationToken" in result, false);
    assert.equal(
      (await f.routes.confirmVerification(f.request({ token }))).status,
      200,
    );
    assert.equal(f.owner.email, "new@example.test");
    assert.ok(f.owner.emailVerified instanceof Date);
    assert.equal(f.owner.sessionVersion, 1);
    assert.equal(f.owner.pendingEmail, null);
    assert.equal(f.owner.resetPasswordToken, null);
    assert.equal(await f.actions.getCurrentUser(), null);
    assert.equal(
      (await f.routes.confirmVerification(f.request({ token }))).status,
      400,
    );
  });
});

test("simultaneous confirmations consume the email token once", async () => {
  await withVerificationUrl(async () => {
    const f = fixture();
    await f.verification.requestEmailVerification(f.owner, "new@example.test");
    const token = getVerificationToken(f);
    const responses = await Promise.all([
      f.routes.confirmVerification(f.request({ token })),
      f.routes.confirmVerification(f.request({ token })),
    ]);
    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [200, 400],
    );
    assert.equal(f.owner.sessionVersion, 1);
  });
});

test("expired, replaced, blocked and revoked email links cannot change the address", async () => {
  await withVerificationUrl(async () => {
    for (const condition of [
      "expired",
      "replaced",
      "blocked",
      "revoked",
      "expired-at-write",
    ]) {
      const f = fixture();
      await f.verification.requestEmailVerification(
        f.owner,
        "new@example.test",
      );
      const token = getVerificationToken(f);
      if (condition === "expired")
        f.owner.emailVerificationExpires = new Date(0);
      if (condition === "replaced")
        await f.verification.requestEmailVerification(
          f.owner,
          "newer@example.test",
        );
      if (condition === "blocked") f.owner.status = "BLOCKED";
      if (condition === "revoked") f.owner.sessionVersion++;
      if (condition === "expired-at-write")
        f.state.updateHook = async () => {
          f.owner.emailVerificationExpires = new Date(0);
        };
      assert.equal(
        (await f.routes.confirmVerification(f.request({ token }))).status,
        400,
      );
      assert.equal(f.owner.email, "owner@example.test");
    }
  });
});

test("two customers claiming one email cannot both complete verification", async () => {
  await withVerificationUrl(async () => {
    const f = fixture();
    const other = { ...f.owner, id: "other", email: "other@example.test" };
    f.users.set(other.id, other);
    await f.verification.requestEmailVerification(
      f.owner,
      "shared@example.test",
    );
    const firstToken = getVerificationToken(f);
    await f.verification.requestEmailVerification(other, "shared@example.test");
    const secondToken = getVerificationToken(f);
    const results = await Promise.all([
      f.routes.confirmVerification(f.request({ token: firstToken })),
      f.routes.confirmVerification(f.request({ token: secondToken })),
    ]);
    assert.deepEqual(
      results.map((response) => response.status).sort(),
      [200, 409],
    );
    assert.equal(
      [...f.users.values()].filter(
        (user) => user.email === "shared@example.test",
      ).length,
      1,
    );
  });
});

test("verification email failure clears only its own token and preserves committed profile changes", async () => {
  await withVerificationUrl(async () => {
    const f = fixture();
    f.state.mailError = true;
    const response = await f.routes.profile(
      f.request({
        username: "New name",
        email: "new@example.test",
        currentPassword: "Correct1!",
      }),
    );
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.verificationSent, false);
    assert.ok(result.emailVerificationError);
    assert.equal(f.owner.name, "New name");
    assert.equal(f.owner.email, "owner@example.test");
    assert.equal(f.owner.emailVerificationToken, null);
    assert.equal(f.owner.pendingEmail, "new@example.test");
    const newerHash = f.verification.hashEmailVerificationToken("c".repeat(64));
    f.state.mailHook = async () => {
      f.owner.emailVerificationToken = newerHash;
    };
    await assert.rejects(
      f.verification.requestEmailVerification(f.owner, "new@example.test"),
      { status: 502 },
    );
    assert.equal(f.owner.emailVerificationToken, newerHash);
  });
});

test("resend uses a pending email only for the current session version and is throttled", async () => {
  await withVerificationUrl(async () => {
    const f = fixture();
    await f.verification.requestEmailVerification(
      f.owner,
      "pending@example.test",
    );
    f.owner.emailVerificationExpires = new Date(0);
    assert.equal((await f.routes.requestVerification()).status, 200);
    assert.equal(f.emails.at(-1).to, "pending@example.test");
    f.owner.emailVerificationVersion = -1;
    assert.equal((await f.routes.requestVerification()).status, 200);
    assert.equal(f.emails.at(-1).to, f.owner.email);
    assert.equal((await f.routes.requestVerification()).status, 200);
    const blocked = await f.routes.requestVerification();
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
  });
});

test("profile updates cannot overwrite a password reset that wins the race", async () => {
  const f = fixture();
  f.state.hashHook = async () => {
    f.owner.sessionVersion++;
  };
  const response = await f.routes.profile(
    f.request({ currentPassword: "Correct1!", newPassword: "NewStrong1!" }),
  );
  assert.equal(response.status, 409);
  assert.equal(f.owner.hashedPassword, "existing-password-hash");
});

test("email verification requires explicit POST and rejects invalid token input", async () => {
  const f = fixture();
  const route = loadSource(
    "app/api/email-verification/confirm/route.ts",
    f.mocks,
  );
  assert.equal(route.GET, undefined);
  for (const token of [null, {}, "a", "../unsafe", "G".repeat(64)]) {
    assert.equal(
      (await f.routes.confirmVerification(f.request({ token }))).status,
      400,
    );
  }
  f.state.sessionUser = null;
  assert.equal((await f.routes.requestVerification()).status, 401);
});

test("admin account listing enforces permissions and omits every private authentication field", async () => {
  const f = fixture();
  const request = new Request("http://localhost/api/admin/users");
  assert.equal((await f.routes.users(request)).status, 403);
  f.state.sessionUser = null;
  assert.equal((await f.routes.users(request)).status, 401);
  f.state.currentUserOverride = { id: "admin", role: "ADMIN" };
  const response = await f.routes.users(request);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.users.length, 1);
  for (const key of [
    "hashedPassword",
    "resetPasswordToken",
    "sessionVersion",
    "emailVerificationToken",
    "pendingEmail",
    "extraSecret",
  ]) {
    assert.equal(key in body.users[0], false);
  }
  assert.equal(
    (await f.routes.users(new Request("http://localhost/users?search=missing")))
      .status,
    200,
  );
  assert.equal(
    (
      await (
        await f.routes.users(new Request("http://localhost/users?search=OWNER"))
      ).json()
    ).users.length,
    1,
  );
  assert.equal(
    (await f.routes.users(new Request("http://localhost/users?page=-1")))
      .status,
    400,
  );
});

test("admin account listing paginates on the server instead of returning the full user collection", async () => {
  const f = fixture();
  f.state.currentUserOverride = { id: "admin", role: "ADMIN" };
  for (let index = 0; index < 30; index++)
    f.users.set(`customer-${index}`, {
      ...f.owner,
      id: `customer-${index}`,
      email: `customer-${index}@example.test`,
    });
  const first = await (
    await f.routes.users(new Request("http://localhost/users"))
  ).json();
  const second = await (
    await f.routes.users(new Request("http://localhost/users?page=2"))
  ).json();
  assert.equal(first.users.length, 10);
  assert.equal(first.hasMore, true);
  assert.equal(second.users.length, 10);
  assert.equal(second.hasMore, true);
  const third = await (await f.routes.users(new Request("http://localhost/users?page=3"))).json();
  const fourth = await (await f.routes.users(new Request("http://localhost/users?page=4"))).json();
  assert.equal(third.users.length, 10);
  assert.equal(fourth.users.length, 1);
  assert.equal(fourth.hasMore, false);
  assert.equal(fourth.total, 31);
  assert.equal(
    new Set([...first.users, ...second.users, ...third.users, ...fourth.users].map((user) => user.id)).size,
    31,
  );
});

test("account moderation writes a durable audit before changing status and records its outcome", async () => {
  const f = fixture();
  f.state.currentUserOverride = { id: "admin", role: "ADMIN" };
  const targetId = "b".repeat(24);
  const target = { ...f.owner, id: targetId, email: "target@example.test" };
  f.users.set(targetId, target);
  const context = { params: Promise.resolve({ userId: targetId }) };
  f.state.updateHook = async () => {
    assert.equal(f.auditLogs.length, 1);
    assert.equal(f.auditLogs[0].status, "STARTED");
  };
  const response = await f.routes.accountStatus(
    f.request({ status: "BLOCKED", password: "must-not-be-logged" }),
    context,
  );
  assert.equal(response.status, 200);
  assert.equal(f.auditLogs[0].status, "SUCCEEDED");
  assert.equal(f.auditLogs[0].actorId, "admin");
  assert.equal(f.auditLogs[0].entityId, targetId);
  assert.equal(
    JSON.stringify(f.auditLogs).includes("must-not-be-logged"),
    false,
  );
  assert.equal(
    (await f.routes.audit(new Request("http://localhost/audit"))).status,
    200,
  );
  f.state.currentUserOverride = { id: "customer", role: "USER" };
  assert.equal(
    (await f.routes.audit(new Request("http://localhost/audit"))).status,
    403,
  );
});

test("unavailable audit storage prevents an unrecorded account moderation write", async () => {
  const f = fixture();
  f.state.currentUserOverride = { id: "admin", role: "ADMIN" };
  f.state.auditError = true;
  const targetId = "b".repeat(24);
  const target = { ...f.owner, id: targetId, email: "target@example.test" };
  f.users.set(targetId, target);
  const response = await f.routes.accountStatus(
    f.request({ status: "BLOCKED" }),
    { params: Promise.resolve({ userId: targetId }) },
  );
  assert.equal(response.status, 503);
  assert.equal(target.status, "ACTIVE");
  assert.equal(target.sessionVersion, 0);
  assert.equal((await response.text()).includes("private-audit"), false);
});

test("catalog seed preserves product IDs and assigns stable, separate SKUs to each color", () => {
  const source = loadSource("utils/products.tsx").products;
  const { buildCatalogSeed } = loadSource("libs/catalogSeed.ts");
  const first = buildCatalogSeed(source);
  const second = buildCatalogSeed(structuredClone(source));
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.products.map((product) => product.id),
    source.map((product) => product.id),
  );
  assert.equal(
    first.variants.length,
    source.reduce((sum, product) => sum + product.images.length, 0),
  );
  assert.equal(
    new Set(first.variants.map((variant) => variant.id)).size,
    first.variants.length,
  );
  assert.equal(
    new Set(first.variants.map((variant) => variant.sku)).size,
    first.variants.length,
  );
  for (const variant of first.variants) {
    const original = source.find((product) => product.id === variant.productId);
    assert.equal(variant.price, original.price);
    assert.equal(variant.inStock, original.inStock);
    assert.equal(variant.currency, "vnd");
  }
  assert.equal(
    first.products.some((product) => "reviews" in product),
    false,
  );
});

test("catalog seed merges brand casing and rejects duplicate products/colors or invalid prices", () => {
  const { buildCatalogSeed } = loadSource("libs/catalogSeed.ts");
  const product = {
    id: "a".repeat(24),
    name: "Product",
    description: "Description",
    category: "Phone",
    brand: "Apple",
    price: 10000,
    inStock: true,
    images: [
      { color: "White", colorCode: "#ffffff", image: "/products/white.webp" },
    ],
  };
  const merged = buildCatalogSeed([
    product,
    { ...product, id: "b".repeat(24), brand: "apple" },
  ]);
  assert.equal(merged.brands.length, 1);
  for (const value of [
    [product, product],
    [{ ...product, price: 1.5 }],
    [{ ...product, price: -1 }],
    [{ ...product, images: [product.images[0], product.images[0]] }],
    [{ ...product, id: "invalid" }],
  ]) {
    assert.throws(() => buildCatalogSeed(value));
  }
});

test("auth housekeeping deletes old expired counters while preserving active and recently expired limits", async () => {
  const f = fixture();
  await f.rate.checkAuthRateLimit("cleanup", "active", 1, 60000);
  await f.rate.checkAuthRateLimit("cleanup", "recent", 1, 60000);
  await f.rate.checkAuthRateLimit("cleanup", "old", 1, 60000);
  const rows = [...f.buckets.values()];
  rows[1].expiresAt = new Date(Date.now() - 60000);
  rows[2].expiresAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  assert.equal(await f.rate.cleanupExpiredAuthRateLimits(), 1);
  assert.equal(f.buckets.size, 2);
  await assert.rejects(
    f.rate.checkAuthRateLimit("cleanup", "active", 1, 60000),
    { name: "AuthRateLimitError" },
  );
});
