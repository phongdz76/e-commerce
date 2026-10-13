const { loadEnvConfig } = require("@next/env");
const { loadSource } = require("./source-loader.cjs");

async function main() {
  const { products } = loadSource("utils/products.tsx");
  const { buildCatalogSeed } = loadSource("libs/catalogSeed.ts");
  const seed = buildCatalogSeed(products);
  console.info(
    `Catalog preview: ${seed.products.length} products, ${seed.variants.length} variants, ${seed.categories.length} categories, ${seed.brands.length} brands.`,
  );
  if (!process.argv.includes("--apply")) {
    console.info(
      "Preview complete. Use --apply to insert missing catalog records into the configured database.",
    );
    return;
  }
  loadEnvConfig(process.cwd());
  const prisma = loadSource("libs/prismadb.ts").default;
  try {
    for (const [model, records] of [
      ["category", seed.categories],
      ["brand", seed.brands],
      ["product", seed.products],
      ["productVariant", seed.variants],
    ]) {
      for (const record of records) {
        await prisma[model].upsert({
          where: { id: record.id },
          create: record,
          update: {},
        });
      }
    }
    console.info(
      "Missing catalog records inserted. Existing catalog records, orders and accounts were retained.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error(
    "Catalog seed failed. Check source validation, database configuration and unique catalog indexes.",
  );
  process.exitCode = 1;
});
