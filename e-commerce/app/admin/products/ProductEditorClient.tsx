"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { FiArrowLeft, FiRefreshCw, FiAlertTriangle } from "react-icons/fi";
import ProductForm from "@/app/admin/products/ProductForm";
import type { AdminCatalogProduct, SafeCatalogGroup } from "@/types";
import { API_PATHS } from "@/utils/apiPaths";

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

  return (
    <div className="space-y-5">
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
            <span>Try Again</span>
          </button>
        </div>
      ) : categories.length === 0 || brands.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 flex items-center gap-2">
          <FiAlertTriangle className="text-base shrink-0" />
          <span>
            Please configure at least one category and one brand before creating or updating products.
          </span>
        </div>
      ) : product && product.variants.length > 20 ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          This product contains over 20 SKUs. Please contact system engineering before adjusting bulk variants.
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
