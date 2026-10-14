import { cache } from "react";
import type { Prisma } from "@prisma/client";
import prisma from "@/libs/prismadb";
import type { BrandOption, CatalogProduct, ProductFilters } from "@/utils/productFilters";
import { PRODUCTS_PER_PAGE } from "@/utils/productFilters";
import { getCatalogSearchPatterns, resolveCatalogGroup } from "@/utils/catalogQuery";
import type { CatalogAttributeFacet, CatalogGroup, CatalogPage, CatalogSuggestion } from "@/types/catalog";

type Stage = Record<string, Prisma.InputJsonValue | undefined>;
const number = (field: string) => ({ $convert: { input: field, to: "long", onError: -1, onNull: -1 } });
const validInteger = (field: string, minimum: number) => ({ $and: [{ $in: [{ $type: field }, ["int", "long", "double", "decimal"]] }, { $eq: [number(field), field] }, { $gte: [number(field), minimum] }, { $lte: [number(field), 2000000000] }] });
const attributePairs = (field: string) => ({ $objectToArray: { $cond: [{ $eq: [{ $type: field }, "object"] }, field, {}] } });
const available = (prefix: string) => {
  const field = (name: string) => prefix === "$" ? "$" + name : prefix + "." + name;
  return { $cond: [{ $and: [
    { $eq: [field("inStock"), true] }, validInteger(field("inventory.onHand"), 0), validInteger(field("inventory.reserved"), 0), validInteger(field("inventory.version"), 1),
    { $eq: [{ $type: field("inventory.updatedAt") }, "date"] }, { $lte: [number(field("inventory.reserved")), number(field("inventory.onHand"))] },
  ] }, { $subtract: [number(field("inventory.onHand")), number(field("inventory.reserved"))] }, 0] };
};

export const getCatalogGroups = cache(async () => {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ where: { isVisible: true }, select: { id: true, slug: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
    prisma.brand.findMany({ where: { isVisible: true }, select: { id: true, slug: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
  ]);
  const map = (groups: typeof categories): CatalogGroup[] => groups.map(group => ({ id: group.id, value: group.slug, label: group.name }));
  return { categories: map(categories), brands: map(brands) };
});

function eligibleVariants(filters: ProductFilters, includeAttributes = true) {
  const conditions: Prisma.InputJsonValue[] = [];
  if (filters.minPrice) conditions.push({ $gte: ["$$variant.price", Number(filters.minPrice)] });
  if (filters.maxPrice) conditions.push({ $lte: ["$$variant.price", Number(filters.maxPrice)] });
  if (filters.stock) conditions.push({ $gt: ["$$variant.available", 0] });
  if (includeAttributes) for (const [name, value] of Object.entries(filters.attributes || {})) conditions.push({ $in: [{ $literal: { k: name, v: value } }, attributePairs("$$variant.attributes")] });
  return { $filter: { input: "$variants", as: "variant", cond: conditions.length ? { $and: conditions } : true } };
}

function filterStages(filters: ProductFilters, withBrands = true, withAttributes = true): Stage[] {
  const match: Stage = {};
  if (filters.category) match["category.slug"] = filters.category;
  if (withBrands && filters.brand) match["brand.slug"] = { $in: filters.brand.split(",") };
  return [
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $set: { eligible: eligibleVariants(filters, withAttributes) } },
    { $match: { "eligible.0": { $exists: true } } },
    { $set: { price: { $min: "$eligible.price" } } },
  ];
}

export function buildCatalogPipeline(filters: ProductFilters, page = 1, pageSize = PRODUCTS_PER_PAGE): Stage[] {
  const patterns = getCatalogSearchPatterns(filters.q);
  const sort: Stage = filters.sort === "price-asc" ? { price: 1, _id: 1 } : filters.sort === "price-desc" ? { price: -1, _id: 1 } : filters.sort === "name" ? { name: 1, _id: 1 } : { createdAt: -1, _id: 1 };
  const base: Stage[] = [
    { $match: { status: "ACTIVE" } },
    { $lookup: { from: "Category", localField: "categoryId", foreignField: "_id", as: "category" } }, { $unwind: "$category" },
    { $lookup: { from: "Brand", localField: "brandId", foreignField: "_id", as: "brand" } }, { $unwind: "$brand" },
    { $match: { "category.isVisible": true, "brand.isVisible": true } },
    { $lookup: { from: "ProductVariant", localField: "_id", foreignField: "productId", pipeline: [
      { $match: { isActive: true, currency: "vnd", $expr: validInteger("$price", 1) } }, { $sort: { sku: 1, _id: 1 } },
      { $project: { _id: 0, id: { $toString: "$_id" }, sku: 1, name: 1, price: 1, image: 1, attributes: 1, available: available("$") } },
    ], as: "variants" } },
    { $match: { "variants.0": { $exists: true } } },
  ];
  const searched: Stage[] = patterns.length ? [{ $set: { searchText: { $concat: ["$name", " ", "$category.name", " ", "$brand.name", " ", { $reduce: { input: "$variants", initialValue: "", in: { $concat: ["$$value", " ", "$$this.sku", " ", "$$this.name"] } } }] } } }, { $match: { $and: patterns.map(pattern => ({ searchText: { $regex: pattern, $options: "i" } })) } }] : [];
  return [...base, { $facet: {
    products: [...searched, ...filterStages(filters), { $sort: sort }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }, { $project: {
      _id: 0, id: { $toString: "$_id" }, name: 1, description: 1, category: "$category.name", categorySlug: "$category.slug", brand: "$brand.name", brandSlug: "$brand.slug", price: 1,
      inStock: { $anyElementTrue: [{ $map: { input: "$eligible", as: "variant", in: { $gt: ["$$variant.available", 0] } } }] },
      images: { $let: { vars: { cheapest: { $arrayElemAt: [{ $filter: { input: "$eligible", as: "variant", cond: { $eq: ["$$variant.price", "$price"] } } }, 0] } }, in: ["$$cheapest.image"] } },
    } }],
    totals: [...searched, ...filterStages(filters), { $count: "count" }],
    catalogTotals: [{ $count: "count" }],
    categoryCounts: [{ $group: { _id: "$category.slug", count: { $sum: 1 } } }],
    brandCounts: [...searched, ...filterStages(filters, false), { $group: { _id: "$brand.slug", count: { $sum: 1 } } }],
    specifications: filters.category ? [...searched, ...filterStages(filters, true, false), { $unwind: "$eligible" }, { $project: { pairs: attributePairs("$eligible.attributes") } }, { $unwind: "$pairs" },
      { $match: { "pairs.v": { $type: "string" }, "pairs.k": { $not: { $in: ["__proto__", "constructor", "prototype"] } } } },
      { $match: { $expr: { $and: [{ $lte: [{ $strLenCP: "$pairs.k" }, 60] }, { $gt: [{ $strLenCP: "$pairs.v" }, 0] }, { $lte: [{ $strLenCP: "$pairs.v" }, 100] }] } } },
      { $group: { _id: { product: "$_id", name: "$pairs.k", value: "$pairs.v" } } },
      { $group: { _id: { name: "$_id.name", value: "$_id.value" }, count: { $sum: 1 } } }, { $sort: { count: -1, "_id.name": 1, "_id.value": 1 } }, { $limit: 600 },
    ] : [{ $limit: 1 }, { $match: { _id: { $exists: false } } }],
  } }];
}

function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error("Invalid catalog count");
  return Number(value);
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid catalog record");
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error("Invalid catalog data"); return value; }
function text(value: unknown) { if (typeof value !== "string") throw new Error("Invalid catalog text"); return value; }
function readProduct(value: unknown): CatalogProduct {
  const row = record(value);
  const images = array(row.images).map(value => { const image = record(value); return { color: text(image.color), colorCode: text(image.colorCode), image: text(image.image) }; });
  if (!/^[a-f\d]{24}$/i.test(text(row.id)) || !images.length || !Number.isSafeInteger(row.price) || Number(row.price) < 1 || typeof row.inStock !== "boolean") throw new Error("Invalid public product");
  return { id: text(row.id), name: text(row.name), description: text(row.description), category: text(row.category), categorySlug: text(row.categorySlug), categoryLabel: text(row.category), brand: text(row.brand), brandSlug: text(row.brandSlug), price: Number(row.price), images, inStock: row.inStock, reviews: [] };
}

export async function getCatalogPage(input: ProductFilters, page = 1, pageSize = PRODUCTS_PER_PAGE): Promise<CatalogPage> {
  const groups = await getCatalogGroups();
  const filters = { ...input, category: resolveCatalogGroup(input.category, groups.categories), brand: [...new Set(input.brand.split(",").filter(Boolean).map(value => resolveCatalogGroup(value, groups.brands)))].join(",") };
  const result = await prisma.product.aggregateRaw({ pipeline: buildCatalogPipeline(filters, page, pageSize), options: { maxTimeMS: 5000 } });
  const summary = record(array(result)[0]);
  const total = array(summary.totals).length ? count(record(array(summary.totals)[0]).count) : 0;
  const catalogTotal = array(summary.catalogTotals).length ? count(record(array(summary.catalogTotals)[0]).count) : 0;
  const counts = (value: unknown) => new Map(array(value).map(value => { const row = record(value); return [text(row._id), count(row.count)] as const; }));
  const categoryCounts = counts(summary.categoryCounts);
  const brandCounts = counts(summary.brandCounts);
  const brands: BrandOption[] = groups.brands.map(group => ({ value: group.value, label: group.label, count: brandCounts.get(group.value) || 0 }));
  for (const value of filters.brand.split(",").filter(Boolean)) if (!brands.some(brand => brand.value === value)) brands.push({ value, label: value, count: 0 });
  brands.sort((a, b) => Number(b.count > 0) - Number(a.count > 0) || a.label.localeCompare(b.label));
  const facets = new Map<string, CatalogAttributeFacet>();
  for (const value of array(summary.specifications)) {
    const row = record(value), key = record(row._id), name = text(key.name), specification = text(key.value);
    if (!facets.has(name)) facets.set(name, { name, values: [] });
    const facet = facets.get(name)!;
    if (facet.values.length < 20) facet.values.push({ value: specification, count: count(row.count) });
  }
  return { products: array(summary.products).map(readProduct), filters, total, catalogTotal, page, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    categories: groups.categories.map(group => ({ ...group, count: categoryCounts.get(group.value) || 0 })), brands,
    attributes: [...facets.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8),
    attributesLimited: facets.size > 8 };
}

export async function getCatalogSuggestions(query: string): Promise<CatalogSuggestion[]> {
  const filters: ProductFilters = { q: query, category: "", brand: "", minPrice: "", maxPrice: "", stock: false, sort: "" };
  const result = await getCatalogPage(filters, 1, 4);
  return result.products.map(product => ({ id: product.id, name: product.name, price: product.price, image: product.images[0].image, inStock: product.inStock }));
}
