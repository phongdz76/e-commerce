"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import { FiEdit2, FiSearch, FiRefreshCw, FiCheck, FiX } from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import type { SafeCatalogGroup } from "@/types";
import AdminPagination from "@/app/admin/components/AdminPagination";
import { getAdminErrorMessage } from "@/utils/adminError";
import { getCatalogSlug } from "@/utils/catalogSlug";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import SpecificationTemplateEditor from "./SpecificationTemplateEditor";
import type { SpecificationDefinition } from "@/types/productContent";
import { parseSpecificationDefinitions } from "@/utils/productContent";

interface CatalogGroupsClientProps {
  kind: "categories" | "brands";
}

const inputClassName =
  "w-full rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm outline-none focus:border-teal-500 text-slate-800 disabled:opacity-70 transition";

export default function CatalogGroupsClient({
  kind,
}: CatalogGroupsClientProps) {
  const [groups, setGroups] = useState<SafeCatalogGroup[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<SafeCatalogGroup | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [hasCustomSlug, setHasCustomSlug] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [specifications, setSpecifications] = useState<SpecificationDefinition[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const saving = useRef(false);

  const title = kind === "categories" ? "Categories" : "Brands";
  const singularTitle = kind === "categories" ? "Category" : "Brand";
  const listPath =
    kind === "categories" ? API_PATHS.ADMIN.CATEGORIES : API_PATHS.ADMIN.BRANDS;

  useEffect(() => {
    let active = true;
    const loadGroups = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get(listPath, {
          params: { q: query, page },
        });
        if (active) {
          setGroups(response.data.groups);
          setTotal(response.data.total ?? 0);
          setTotalPages(response.data.totalPages ?? 1);
          setHasMore(response.data.hasMore);
        }
      } catch {
        if (active) {
          setError(`Failed to load ${title.toLowerCase()} list. Please try again.`);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadGroups();
    return () => {
      active = false;
    };
  }, [listPath, query, page, refresh, title]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery(search.trim());
    setPage(1);
    setRefresh((previous) => previous + 1);
  };

  const handleReset = () => {
    setSaveError("");
    setSelected(null);
    setName("");
    setSlug("");
    setHasCustomSlug(false);
    setIsVisible(true);
    setSpecifications([]);
  };

  const handleEdit = (group: SafeCatalogGroup) => {
    setSaveError("");
    setSelected(group);
    setName(group.name);
    setSlug(group.slug);
    setHasCustomSlug(true);
    setIsVisible(group.isVisible);
    setSpecifications(group.specifications || []);
    document.getElementById("catalog-group-name")?.focus();
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving.current) {
      return;
    }
    saving.current = true;
    setSaveError("");
    setIsSaving(true);
    try {
      const data = { name, slug, isVisible, ...(kind === "categories" ? { specifications: parseSpecificationDefinitions(specifications.map(field => ({ ...field, choices: field.choices.map(choice => choice.trim()).filter(Boolean) }))) } : {}) };
      if (selected) {
        const path =
          kind === "categories"
            ? API_PATHS.ADMIN.CATEGORY(selected.id)
            : API_PATHS.ADMIN.BRAND(selected.id);
        await axios.patch(path, { ...data, updatedAt: selected.updatedAt });
      } else {
        await axios.post(listPath, data);
      }
      toast.success(selected ? "Record updated successfully." : "Record created successfully.");
      handleReset();
      setRefresh((previous) => previous + 1);
    } catch (error: unknown) {
      const message = error instanceof Error && !axios.isAxiosError(error) ? error.message : getAdminErrorMessage(error, "Unable to save. Check the catalog fields and unique URL slug.");
      setSaveError(message);
      toast.error(message);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Section Header */}
      <AdminPageHeader title={title} description="Manage catalog groups, visibility and their linked products.">
        {/* Quick switcher between Categories and Brands */}
        <div className="flex items-center gap-2 bg-slate-200 p-1 rounded-md">
          <Link
            href="/admin/categories"
            className={`px-3 py-1.5 rounded text-sm font-semibold transition ${
              kind === "categories"
                ? "bg-slate-700 text-white shadow-xs"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            Categories
          </Link>
          <Link
            href="/admin/brands"
            className={`px-3 py-1.5 rounded text-sm font-semibold transition ${
              kind === "brands"
                ? "bg-slate-700 text-white shadow-xs"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            Brands
          </Link>
        </div>
      </AdminPageHeader>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Form Column */}
        <form
          onSubmit={handleSave}
          className="min-w-0 space-y-4 rounded-md border border-slate-200 bg-white p-5 shadow-xs lg:sticky lg:top-20"
        >
          <div className="border-b border-slate-100 pb-2">
            <h2 className="font-bold text-sm text-slate-800">
              {selected ? `Edit ${singularTitle}` : `Add New ${singularTitle}`}
            </h2>
            <p className="text-xs text-slate-400">
              {selected
                ? `Updating slug and visibility for ${selected.name}`
                : "Create a catalog group. Visibility controls eligibility for active products."}
            </p>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="catalog-group-name"
              className="block text-sm font-semibold text-slate-700"
            >
              Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="catalog-group-name"
              value={name}
              onChange={(event) => {
                const value = event.target.value;
                setName(value);
                if (!selected && !hasCustomSlug) {
                  setSlug(getCatalogSlug(value, 100));
                }
              }}
              required
              minLength={2}
              maxLength={80}
              placeholder={`Enter ${singularTitle.toLowerCase()} name...`}
              disabled={isSaving}
              className={inputClassName}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="catalog-group-slug"
              className="block text-sm font-semibold text-slate-700"
            >
              URL Slug <span className="text-rose-500">*</span>
            </label>
            <input
              id="catalog-group-slug"
              value={slug}
              onChange={(event) => {
                setSlug(event.target.value);
                setHasCustomSlug(true);
              }}
              required
              maxLength={100}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="e.g. phones, smart-watches"
              disabled={isSaving}
              className={inputClassName}
              aria-describedby="catalog-group-slug-help"
            />
            <p
              id="catalog-group-slug-help"
              className="text-xs text-slate-400"
            >
              Generated from the name. Use lowercase letters, numbers and hyphens. Custom slugs are kept.
            </p>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(event) => setIsVisible(event.target.checked)}
              disabled={isSaving}
              className="h-4 w-4 rounded accent-teal-600"
            />
            <span>Visible catalog group</span>
          </label>

          {kind === "categories" && <SpecificationTemplateEditor value={specifications} onChange={setSpecifications} disabled={isSaving} />}
          {saveError ? <p role="alert" className="text-sm leading-6 text-rose-700">{saveError}</p> : null}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-700 hover:bg-slate-800 px-4 py-2 text-sm font-bold text-white transition shadow-xs disabled:opacity-70"
            >
              <FiCheck className="text-sm" />
              <span>{isSaving ? "Saving..." : selected ? "Save changes" : `Create ${singularTitle.toLowerCase()}`}</span>
            </button>

            {selected && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition shadow-xs"
              >
                <FiX className="text-sm" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        </form>

        {/* Table Column */}
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {/* Search bar */}
          <div className="rounded-md border border-slate-200 bg-white p-3.5 shadow-xs">
            <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[200px]">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                <input
                  id="catalog-group-search"
                  aria-label={"Search " + title.toLowerCase()}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  maxLength={80}
                  placeholder={`Search ${title.toLowerCase()} by name...`}
                  className="w-full rounded-md border border-slate-300 pl-8 pr-3 py-1.5 text-sm outline-none focus:border-teal-500 text-slate-800 transition"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-slate-700 hover:bg-slate-800 px-3.5 py-1.5 text-sm font-bold text-white transition shadow-xs disabled:opacity-70"
              >
                Search
              </button>

              <button
                type="button"
                disabled={isLoading || isSaving}
                onClick={() => setRefresh((previous) => previous + 1)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition shadow-xs"
              >
                <FiRefreshCw className={`text-sm ${isLoading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </form>
          </div>

          {error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
              {error}
            </div>
          ) : null}

          {/* Table Card */}
          <div className="rounded-md border border-slate-200 bg-white shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="p-14 text-center text-sm text-slate-500 font-medium">
                Loading {title.toLowerCase()} list...
              </div>
            ) : error ? (
              <div className="p-6 text-center text-sm">
                <button type="button" onClick={() => setRefresh((previous) => previous + 1)} className="font-semibold text-teal-700 underline">Try again</button>
              </div>
            ) : groups.length === 0 ? (
              <div className="p-14 text-center text-sm text-slate-500 font-medium">
                No {title.toLowerCase()} records found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-left border-collapse text-sm">
                  <thead className="bg-slate-200 border-b border-slate-300 text-xs font-bold text-slate-700 uppercase ">
                    <tr>
                      <th className="py-3 px-4">Name & Slug</th>
                      <th className="py-3 px-4 text-center">Linked products</th>
                      <th className="py-3 px-4">Visibility</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groups.map((group) => (
                      <tr key={group.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{group.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {group.slug}
                          </p>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className="font-semibold text-slate-800 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-sm">
                            {group.productCount} products
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-semibold border ${
                              group.isVisible
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                group.isVisible ? "bg-emerald-600" : "bg-slate-400"
                              }`}
                            />
                            {group.isVisible ? "Visible" : "Hidden"}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleEdit(group)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:border-teal-500 hover:text-teal-700 text-sm font-semibold text-slate-700 transition shadow-xs"
                          >
                            <FiEdit2 className="text-sm" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-5 pb-4">
              <AdminPagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={10}
                hasMore={hasMore}
                isLoading={isLoading}
                onPageChange={(newPage) => setPage(newPage)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
