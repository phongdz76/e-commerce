import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { startAdminAudit, finishAdminAudit } from "@/libs/adminAudit";
import { isCatalogImageUrl } from "@/utils/catalogImage";

const catalogInclude = {
  category: true,
  brand: true,
  variants: { orderBy: { id: "asc" as const }, take: 21 },
} as const;
type CatalogProduct = Prisma.ProductGetPayload<{
  include: typeof catalogInclude;
}>;

function serializeProduct(product: CatalogProduct) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    status: product.status,
    categoryId: product.categoryId,
    brandId: product.brandId,
    categoryName: product.category.name,
    brandName: product.brand.name,
    updatedAt: product.updatedAt.toISOString(),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      price: variant.price,
      image: variant.image,
      attributes: variant.attributes || {},
      isActive: variant.isActive,
      inStock: variant.inStock,
    })),
  };
}

function getProductInput(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const input = body as Record<string, unknown>;
  if (
    typeof input.name !== "string" ||
    input.name.trim().length < 2 ||
    input.name.trim().length > 200 ||
    typeof input.slug !== "string" ||
    input.slug.length > 150 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) ||
    typeof input.description !== "string" ||
    input.description.trim().length < 10 ||
    input.description.length > 10000 ||
    !["DRAFT", "ACTIVE", "ARCHIVED"].includes(String(input.status)) ||
    typeof input.categoryId !== "string" ||
    !/^[a-f0-9]{24}$/i.test(input.categoryId) ||
    typeof input.brandId !== "string" ||
    !/^[a-f0-9]{24}$/i.test(input.brandId) ||
    !Array.isArray(input.variants) ||
    input.variants.length < 1 ||
    input.variants.length > 20
  ) {
    return null;
  }
  const variants: {
    id?: string;
    sku: string;
    name: string;
    price: number;
    image: { color: string; colorCode: string; image: string };
    attributes: Prisma.InputJsonObject;
    isActive: boolean;
    inStock: boolean;
  }[] = [];
  const ids = new Set<string>();
  const skus = new Set<string>();
  for (const value of input.variants) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const row = value as Record<string, unknown>;
    const image = row.image as Record<string, unknown> | undefined;
    const attributes = row.attributes;
    if (
      (row.id !== undefined &&
        (typeof row.id !== "string" ||
          !/^[a-f0-9]{24}$/i.test(row.id) ||
          ids.has(row.id))) ||
      typeof row.sku !== "string" ||
      !/^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(row.sku) ||
      skus.has(row.sku) ||
      typeof row.name !== "string" ||
      row.name.trim().length < 1 ||
      row.name.length > 100 ||
      typeof row.price !== "number" ||
      !Number.isSafeInteger(row.price) ||
      row.price <= 0 ||
      row.price > 2147483647 ||
      typeof row.isActive !== "boolean" ||
      typeof row.inStock !== "boolean" ||
      !image ||
      typeof image.color !== "string" ||
      !image.color.trim() ||
      image.color.length > 60 ||
      typeof image.colorCode !== "string" ||
      !/^#[a-f0-9]{6}$/i.test(image.colorCode.trim()) ||
      !isCatalogImageUrl(image.image) ||
      !attributes ||
      typeof attributes !== "object" ||
      Array.isArray(attributes) ||
      Object.keys(attributes).length > 30 ||
      Object.entries(attributes).some(
        ([key, item]) =>
          !key.trim() ||
          key.length > 80 ||
          ["__proto__", "constructor", "prototype"].includes(key) ||
          typeof item !== "string" ||
          item.length > 500,
      )
    ) {
      return null;
    }
    if (row.id) {
      ids.add(row.id as string);
    }
    skus.add(row.sku);
    variants.push({
      ...(row.id ? { id: row.id as string } : {}),
      sku: row.sku,
      name: row.name.trim(),
      price: row.price,
      isActive: row.isActive,
      inStock: row.inStock,
      image: {
        color: image.color.trim(),
        colorCode: image.colorCode.trim(),
        image: image.image as string,
      },
      attributes: attributes as Prisma.InputJsonObject,
    });
  }
  if (
    input.status === "ACTIVE" &&
    !variants.some((variant) => variant.isActive)
  ) {
    return null;
  }
  return {
    name: input.name.trim(),
    slug: input.slug,
    description: input.description.trim(),
    status: input.status as "DRAFT" | "ACTIVE" | "ARCHIVED",
    categoryId: input.categoryId,
    brandId: input.brandId,
    variants,
  };
}

function getVariantData(
  variant: NonNullable<ReturnType<typeof getProductInput>>["variants"][number],
) {
  return {
    sku: variant.sku,
    name: variant.name,
    price: variant.price,
    currency: "vnd",
    image: variant.image,
    attributes: variant.attributes,
    isActive: variant.isActive,
    inStock: variant.inStock,
  };
}

export async function readAdminCatalog(request: Request, productId?: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (productId) {
      if (!/^[a-f0-9]{24}$/i.test(productId)) {
        return NextResponse.json({ error: "Invalid product" }, { status: 400 });
      }
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: catalogInclude,
      });
      return product
        ? NextResponse.json(serializeProduct(product))
        : NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const params = new URL(request.url).searchParams;
    const query = (params.get("q") || "").trim();
    const status = params.get("status") || "ALL";
    const page = Number(params.get("page") || "1");
    if (
      query.length > 100 ||
      !["ALL", "DRAFT", "ACTIVE", "ARCHIVED"].includes(status) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 1000
    ) {
      return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
    }
    const whereClause: Prisma.ProductWhereInput = {
      ...(status !== "ALL"
        ? { status: status as "DRAFT" | "ACTIVE" | "ARCHIVED" }
        : {}),
      ...(query
        ? { name: { contains: query, mode: "insensitive" as const } }
        : {}),
    };
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        orderBy: [{ updatedAt: "desc" as const }, { id: "desc" as const }],
        skip: (page - 1) * 10,
        take: 10,
        include: catalogInclude,
      }),
      prisma.product.count({ where: whereClause }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / 10));
    return NextResponse.json({
      total,
      totalPages,
      page,
      pageSize: 10,
      hasMore: page < totalPages,
      products: products.map(serializeProduct),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load catalog." },
      { status: 503 },
    );
  }
}

export async function saveAdminProduct(request: Request, productId?: string) {
  let auditId: string | undefined;
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (productId && !/^[a-f0-9]{24}$/i.test(productId)) {
      return NextResponse.json({ error: "Invalid product" }, { status: 400 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const input = getProductInput(body);
    if (!input) {
      return NextResponse.json(
        {
          error:
            "Check the name, URL slug, description and SKUs. Prices must be positive whole VND amounts. Use an allowed product image URL.",
        },
        { status: 400 },
      );
    }
    const [category, brand] = await Promise.all([
      prisma.category.findUnique({ where: { id: input.categoryId } }),
      prisma.brand.findUnique({ where: { id: input.brandId } }),
    ]);
    if (
      !category ||
      !brand ||
      (input.status === "ACTIVE" && (!category.isVisible || !brand.isVisible))
    ) {
      return NextResponse.json(
        {
          error:
            "Select a valid, visible category and brand before activating this product.",
        },
        { status: 400 },
      );
    }
    const { variants, ...data } = input;
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { variants: true },
      });
      if (!product) {
        return NextResponse.json(
          { error: "Product not found" },
          { status: 404 },
        );
      }
      if (
        typeof body.updatedAt !== "string" ||
        product.updatedAt.toISOString() !== body.updatedAt ||
        product.variants.some((existing) => existing.currency !== "vnd") ||
        product.variants.some(
          (existing) => !variants.some((variant) => variant.id === existing.id),
        ) ||
        variants.some(
          (variant) =>
            variant.id &&
            !product.variants.some((existing) => existing.id === variant.id),
        )
      ) {
        return NextResponse.json(
          {
            error:
              "This product has changed or a variant does not belong to it. Reload before saving. Disable existing variants instead of removing them.",
          },
          { status: 409 },
        );
      }
      const audit = await startAdminAudit(
        currentUser.id,
        "PRODUCT_UPDATED",
        "PRODUCT",
        productId,
        {
          before: {
            name: product.name,
            status: product.status,
            variants: product.variants.map((variant) => ({
              sku: variant.sku,
              price: variant.price,
              isActive: variant.isActive,
              inStock: variant.inStock,
            })),
          },
          after: {
            ...data,
            variants: variants.map((variant) => ({
              sku: variant.sku,
              price: variant.price,
              isActive: variant.isActive,
              inStock: variant.inStock,
            })),
          },
        },
      );
      auditId = audit.id;
      await prisma.product.update({
        where: { id: product.id, updatedAt: product.updatedAt },
        data: {
          ...data,
          updatedAt: new Date(
            Math.max(Date.now(), product.updatedAt.getTime() + 1),
          ),
          variants: {
            create: variants
              .filter((variant) => !variant.id)
              .map(getVariantData),
            update: variants
              .filter((variant) => variant.id)
              .map(({ id, ...variant }) => ({
                where: { id: id!, productId },
                data: { ...variant, currency: "vnd" },
              })),
          },
        },
      });
      await finishAdminAudit(audit.id, "SUCCEEDED");
      return NextResponse.json({ success: true, id: productId });
    }
    if (variants.some((variant) => variant.id)) {
      return NextResponse.json(
        { error: "New variants must not use an existing variant ID." },
        { status: 400 },
      );
    }
    const audit = await startAdminAudit(
      currentUser.id,
      "PRODUCT_CREATED",
      "PRODUCT",
      data.slug,
      { after: { ...data, skus: variants.map((variant) => variant.sku) } },
    );
    auditId = audit.id;
    const product = await prisma.product.create({
      data: {
        ...data,
        variants: {
          create: variants.map(getVariantData),
        },
      },
    });
    await finishAdminAudit(audit.id, "SUCCEEDED", { productId: product.id });
    return NextResponse.json(
      { success: true, id: product.id },
      { status: 201 },
    );
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error ? error.code : null;
    if (auditId) {
      await finishAdminAudit(
        auditId,
        ["P2002", "P2025"].includes(String(code)) ? "FAILED" : "UNKNOWN",
      );
    }
    const conflict = ["P2002", "P2025"].includes(String(code));
    return NextResponse.json(
      {
        error: conflict
          ? "The URL slug or SKU is already in use, or the product has changed. Reload before saving."
          : "Unable to save the product. Reload the list before trying again.",
        ...(code === "P2002" ? { code: "DUPLICATE_CATALOG_KEY" } : {}),
      },
      { status: conflict ? 409 : 503 },
    );
  }
}
