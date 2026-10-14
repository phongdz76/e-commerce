const { loadEnvConfig } = require("@next/env");
const { loadSource } = require("./source-loader.cjs");
class AdminSetupError extends Error {}

async function main() {
  const emailArgument = process.argv.indexOf("--email");
  const { EMAIL_REGEX, normalizeAuthEmail } = loadSource(
    "libs/authValidation.ts",
  );
  const email = normalizeAuthEmail(
    emailArgument >= 0 ? process.argv[emailArgument + 1] : undefined,
  );
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new AdminSetupError(
      "Usage: npm run admin:promote -- --email owner@example.com",
    );
  }
  loadEnvConfig(process.cwd());
  const prisma = loadSource("libs/prismadb.ts").default;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AdminSetupError(
        "Create the administrator's account through registration first",
      );
    }
    if ((user.status || "ACTIVE") !== "ACTIVE") {
      throw new AdminSetupError("A blocked account cannot be promoted");
    }
    if (user.role === "ADMIN") {
      console.info("This account already has administrator access.");
      return;
    }
    const sessionVersion = user.sessionVersion || 0;
    const versionConditions = [{ sessionVersion }];
    if (sessionVersion === 0) {
      versionConditions.push(
        { sessionVersion: null },
        { sessionVersion: { isSet: false } },
      );
    }
    const result = await prisma.user.updateMany({
      where: {
        id: user.id,
        role: "USER",
        AND: [
          { OR: versionConditions },
          {
            OR: [
              { status: "ACTIVE" },
              { status: null },
              { status: { isSet: false } },
            ],
          },
        ],
      },
      data: {
        role: "ADMIN",
        sessionVersion: sessionVersion + 1,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        pendingEmail: null,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        emailVerificationVersion: null,
      },
    });
    if (result.count !== 1) {
      throw new AdminSetupError(
        "The account changed during promotion. Run the command again.",
      );
    }
    console.info("Administrator access granted. Sign in again to open /admin.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    error instanceof AdminSetupError
      ? error.message
      : "Administrator setup failed. Check database configuration.",
  );
  process.exitCode = 1;
});
