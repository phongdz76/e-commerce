"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { FiRefreshCw, FiAlertTriangle } from "react-icons/fi";
import ProductForm from "@/app/admin/products/ProductForm";
import type { AdminCatalogProduct, SafeCatalogGroup } from "@/types";
import { API_PATHS } from "@/utils/apiPaths";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";

async function loadGroups(path: string) {
  const groups: SafeCatalogGroup[] = [];
  for (let page = 1; page <= 40; page++) {
    const response = await axios.get(path, { params: { page } });
    groups.push(...response.data.groups);
    if (!response.data.hasMore) {
      return groups;
    }
  }
  throw new Error("Too many catalog groups");
}

export default function ProductEditorClient({
  productId,
}: {
  productId?: string;
}) {
  const [product, setProduct] = useState<AdminCatalogProduct | null>(null);
  const [categories, setCategories] = useState<SafeCatalogGroup[]>([]);
  const [brands, setBrands] = useState<SafeCatalogGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const loadEditor = async () => {
      setIsLoading(true);
      setError("");
      try {
        const [categories, brands, response] = await Promise.all([
          loadGroups(API_PATHS.ADMIN.CATEGORIES),
          loadGroups(API_PATHS.ADMIN.BRANDS),
          productId
            ? axios.get(API_PATHS.ADMIN.PRODUCT(productId))
            : Promise.resolve(null),
        ]);
        if (active) {
          setCategories(categories);
          setBrands(brands);
          setProduct(response?.data || null);
        }
      } catch {
        if (active) {
          setError(
            "Failed to load product catalog data. Please check connection and permissions.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadEditor();
    return () => {
      active = false;
    };
  }, [productId, refresh]);
  const canShowForm = !isLoading && !error && categories.length > 0 && brands.length > 0 && (!product || product.variants.length <= 20);

  return (
    <div className="space-y-5">
      {!canShowForm ? (
        <AdminPageHeader title={productId ? "Edit product" : "Add product"} description="Manage product information, images, variants and prices.">
          <Link href="/admin/products" className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-100">Back to products</Link>
        </AdminPageHeader>
      ) : null}
      {isLoading ? (
        <div className="p-14 text-center text-sm text-slate-500 font-medium rounded-md border border-slate-200 bg-white">
          Loading product editor data...
        </div>
      ) : error ? (
        <div className="p-6 rounded-md border border-rose-200 bg-rose-50 space-y-3">
          <p role="alert" className="text-sm font-medium text-rose-700">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setRefresh((previous) => previous + 1)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <FiRefreshCw className="text-sm" />
            <span>Try again</span>
          </button>
        </div>
      ) : categories.length === 0 || brands.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 space-y-4">
          <div className="flex items-start gap-2">
            <FiAlertTriangle className="text-base shrink-0" />
            <span>
              Please configure at least one category and one brand before creating or updating products.
            </span>
          </div>
          <div className="flex flex-wrap gap-4 font-semibold">
            <Link href="/admin/categories" className="inline-flex min-h-11 items-center underline">Manage categories</Link>
            <Link href="/admin/brands" className="inline-flex min-h-11 items-center underline">Manage brands</Link>
          </div>
        </div>
      ) : product && product.variants.length > 20 ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          This product has more than 20 variants and cannot be edited in this form. Contact your store administrator for help.
        </div>
      ) : (
        <ProductForm
          product={product}
          categories={categories}
          brands={brands}
        />
      )}
    </div>
  );
}
