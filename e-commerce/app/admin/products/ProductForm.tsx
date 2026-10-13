"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import Image from "next/image";
import {
  FiBox,
  FiPlus,
  FiTrash2,
  FiCheck,
  FiX,
  FiLayers,
  FiTag,
  FiArrowLeft,
  FiSave,
} from "react-icons/fi";
import ImageUpload from "@/app/components/inputs/ImageUpload";
import { API_PATHS } from "@/utils/apiPaths";
import { isCatalogImageUrl } from "@/utils/catalogImage";
import type {
  AdminCatalogProduct,
  AdminCatalogVariant,
  SafeCatalogGroup,
} from "@/types";

type VariantForm = Omit<AdminCatalogVariant, "attributes"> & {
  specifications: string;
};

const inputClassName =
  "w-full rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:opacity-60 transition";

function newVariant(): VariantForm {
  return {
    sku: "",
    name: "",
    price: 0,
    image: { color: "", colorCode: "#334155", image: "" },
    specifications: "",
    isActive: true,
    inStock: true,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getAttributes(value: string) {
  const attributes: Record<string, string> = {};
  for (const line of value.split("\n").filter((l) => l.trim())) {
    const separator = line.indexOf(":");
    const name = line.slice(0, separator).trim();
    if (
      separator <= 0 ||
      !name ||
      Object.hasOwn(attributes, name) ||
      ["__proto__", "constructor", "prototype"].includes(name)
    ) {
      throw new Error(
        "Attributes must be formatted as 'Name: value' per line with unique names.",
      );
    }
    attributes[name] = line.slice(separator + 1).trim();
  }
  return attributes;
}

export default function ProductForm({
  product,
  categories,
  brands: initialBrands,
}: {
  product: AdminCatalogProduct | null;
  categories: SafeCatalogGroup[];
  brands: SafeCatalogGroup[];
}) {
  const router = useRouter();
  const [name, setName] = useState(product?.name || "");
  const [slug, setSlug] = useState(product?.slug || "");
  const [description, setDescription] = useState(product?.description || "");
  const [status, setStatus] = useState<AdminCatalogProduct["status"]>(
    product?.status || "DRAFT",
  );
  const [categoryId, setCategoryId] = useState(product?.categoryId || "");
  const [brandId, setBrandId] = useState(product?.brandId || "");

  // Brand quick select vs instant add
  const [brandsList, setBrandsList] = useState<SafeCatalogGroup[]>(initialBrands);
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [isSavingBrand, setIsSavingBrand] = useState(false);

  const [variants, setVariants] = useState<VariantForm[]>(
    product?.variants.length
      ? product.variants.map(({ attributes, ...v }) => ({
          ...v,
          specifications: Object.entries(attributes)
            .map(([k, val]) => `${k}: ${val}`)
            .join("\n"),
        }))
      : [newVariant()],
  );
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!product) {
      setSlug(slugify(val));
    }
  };

  const handleCreateNewBrand = async () => {
    const trimmed = newBrandName.trim();
    if (!trimmed || trimmed.length < 2) {
      toast.error("Brand name must be at least 2 characters.");
      return;
    }
    const brandSlug = slugify(trimmed);
    setIsSavingBrand(true);
    try {
      const response = await axios.post(API_PATHS.ADMIN.BRANDS, {
        name: trimmed,
        slug: brandSlug,
        isVisible: true,
      });
      const newBrand: SafeCatalogGroup = {
        id: response.data.id,
        name: trimmed,
        slug: brandSlug,
        isVisible: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        productCount: 0,
      };
      setBrandsList((prev) => [...prev, newBrand]);
      setBrandId(newBrand.id);
      setNewBrandName("");
      setIsCreatingBrand(false);
      toast.success(`Brand "${trimmed}" created and selected!`);
    } catch (err: unknown) {
      toast.error(
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : "Failed to create new brand.",
      );
    } finally {
      setIsSavingBrand(false);
    }
  };

  const handleVariantChange = (index: number, data: Partial<VariantForm>) => {
    setVariants((previous) =>
      previous.map((v, pos) => (pos === index ? { ...v, ...data } : v)),
    );
  };

  const handleImageChange = (
    index: number,
    data: Partial<VariantForm["image"]>,
  ) => {
    setVariants((previous) =>
      previous.map((v, pos) =>
        pos === index ? { ...v, image: { ...v.image, ...data } } : v,
      ),
    );
  };

  const handleAddVariant = () => {
    if (variants.length < 20) {
      setVariants((previous) => [...previous, newVariant()]);
    }
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) {
      toast.error("Product must have at least one variant.");
      return;
    }
    setVariants((previous) =>
      previous.filter((v, pos) => pos !== index || v.id),
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving.current) {
      return;
    }
    if (!categoryId) {
      toast.error("Please select a category.");
      return;
    }
    if (!brandId) {
      toast.error("Please select or add a brand.");
      return;
    }

    const preparedVariants = variants.map((v, i) => {
      const generatedSku =
        v.sku.trim() ||
        `${slug.toUpperCase().slice(0, 15)}-${(v.image.color || "DEF").toUpperCase().slice(0, 6)}-${i + 1}`;
      const generatedName =
        v.name.trim() || `${name} - ${v.image.color || "Standard"}`;
      return {
        ...v,
        sku: generatedSku.replace(/[^A-Z0-9_-]/g, ""),
        name: generatedName,
      };
    });

    let data;
    try {
      data = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        status,
        categoryId,
        brandId,
        variants: preparedVariants.map(({ specifications, ...variant }) => ({
          ...variant,
          attributes: getAttributes(specifications),
        })),
        ...(product ? { updatedAt: product.updatedAt } : {}),
      };
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invalid variant specifications.",
      );
      return;
    }

    saving.current = true;
    setIsSaving(true);
    try {
      if (product) {
        await axios.patch(API_PATHS.ADMIN.PRODUCT(product.id), data);
      } else {
        await axios.post(API_PATHS.ADMIN.PRODUCTS, data);
      }
      toast.success("Product saved successfully.");
      router.push("/admin/products");
      router.refresh();
    } catch (error: unknown) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.error || "Failed to save product."
          : "Failed to save product.",
      );
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-6xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <button
            type="button"
            onClick={() => router.push("/admin/products")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-teal-600 mb-1"
          >
            <FiArrowLeft />
            <span>Back to Products</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-800 ">
            {product ? "Edit Catalog Item" : "Create New Product"}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => router.push("/admin/products")}
            className="px-4 py-2 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-slate-700 hover:bg-slate-800 text-sm font-bold text-white shadow-xs transition disabled:opacity-70"
          >
            <FiSave className="text-sm" />
            <span>{isSaving ? "Saving..." : "Save Product"}</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid gap-8 lg:grid-cols-3 items-start">
        {/* Left Column (2 cols): General & Variants */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Information Card */}
          <div className="rounded-md border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <h2 className="text-sm font-bold text-slate-700 uppercase pb-3 border-b border-slate-100">
              General Product Information
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-semibold text-slate-700 block">
                <span>Product Name *</span>
                <input
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  minLength={2}
                  maxLength={200}
                  placeholder="e.g. MacBook Pro 14 M3 Max"
                  className={inputClassName}
                />
              </label>

              <label className="space-y-1.5 text-sm font-semibold text-slate-700 block">
                <span>URL Slug *</span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  maxLength={150}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  placeholder="e.g. macbook-pro-14-m3-max"
                  className={inputClassName}
                />
              </label>
            </div>

            <label className="space-y-1.5 text-sm font-semibold text-slate-700 block">
              <span>Detailed Description *</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={10}
                maxLength={10000}
                rows={5}
                placeholder="Write compelling features, technical specs, warranty details..."
                className={inputClassName}
              />
            </label>
          </div>

          {/* Variants Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Product Variants & SKUs ({variants.length}/20)
                </h2>
                <p className="text-sm text-slate-500">
                  Manage each sellable option with its distinct color, image, and price.
                </p>
              </div>

              <button
                type="button"
                disabled={isSaving || variants.length >= 20}
                onClick={handleAddVariant}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition shadow-xs"
              >
                <FiPlus className="text-teal-600" />
                <span>Add Variant</span>
              </button>
            </div>

            {variants.map((variant, index) => (
              <div
                key={variant.id || `variant-${index}`}
                className="rounded-md border border-slate-200 bg-white p-5 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-md bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center border border-slate-200">
                      {index + 1}
                    </span>
                    <strong className="text-sm font-bold text-slate-900">
                      {variant.name || `Variant #${index + 1}`}
                    </strong>
                  </div>

                  {variants.length > 1 && !variant.id && (
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(index)}
                      className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-800 font-semibold"
                    >
                      <FiTrash2 />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1 text-sm font-semibold text-slate-700 block">
                    <span>SKU Code *</span>
                    <input
                      value={variant.sku}
                      onChange={(e) =>
                        handleVariantChange(index, {
                          sku: e.target.value.toUpperCase(),
                        })
                      }
                      required
                      maxLength={80}
                      pattern="[A-Z0-9][A-Z0-9_-]{1,79}"
                      placeholder="e.g. MBP14-M3-BLK"
                      className={inputClassName}
                    />
                  </label>

                  <label className="space-y-1 text-sm font-semibold text-slate-700 block">
                    <span>Variant Name *</span>
                    <input
                      value={variant.name}
                      onChange={(e) =>
                        handleVariantChange(index, { name: e.target.value })
                      }
                      required
                      maxLength={100}
                      placeholder="e.g. Space Black 512GB"
                      className={inputClassName}
                    />
                  </label>

                  <label className="space-y-1 text-sm font-semibold text-slate-700 block">
                    <span>Price (VND) *</span>
                    <input
                      type="number"
                      value={variant.price || ""}
                      onChange={(e) =>
                        handleVariantChange(index, {
                          price: Math.max(0, Number(e.target.value)),
                        })
                      }
                      required
                      min={1}
                      max={2147483647}
                      placeholder="e.g. 49990000"
                      className={inputClassName}
                    />
                  </label>
                </div>

                {/* Color and Image Info */}
                <div className="p-4 rounded-md bg-slate-50 border border-slate-200 grid gap-4 sm:grid-cols-3">
                  <label className="space-y-1 text-sm font-semibold text-slate-700 block">
                    <span>Color Name *</span>
                    <input
                      value={variant.image.color}
                      onChange={(e) =>
                        handleImageChange(index, { color: e.target.value })
                      }
                      required
                      maxLength={60}
                      placeholder="e.g. Space Black"
                      className={inputClassName}
                    />
                  </label>

                  <label className="space-y-1 text-sm font-semibold text-slate-700 block">
                    <span>Color Code (Hex) *</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={variant.image.colorCode}
                        onChange={(e) =>
                          handleImageChange(index, { colorCode: e.target.value })
                        }
                        className="h-8 w-10 cursor-pointer rounded border border-slate-300 p-0.5 bg-white shrink-0"
                      />
                      <input
                        value={variant.image.colorCode}
                        onChange={(e) =>
                          handleImageChange(index, { colorCode: e.target.value })
                        }
                        required
                        pattern="#[a-fA-F0-9]{6}"
                        placeholder="#334155"
                        className={inputClassName}
                      />
                    </div>
                  </label>

                  <div className="space-y-1 text-sm font-semibold text-slate-700">
                    <span>Image Preview *</span>
                    <div className="flex items-center gap-2">
                      <input
                        value={variant.image.image}
                        onChange={(e) =>
                          handleImageChange(index, { image: e.target.value })
                        }
                        required
                        placeholder="Image HTTPS URL..."
                        className={inputClassName}
                      />
                      {variant.image.image &&
                      isCatalogImageUrl(variant.image.image) ? (
                        <div className="relative h-8 w-8 shrink-0 rounded border border-slate-300 overflow-hidden bg-white">
                          <Image
                            src={variant.image.image}
                            alt={variant.image.color}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-1">
                      <ImageUpload
                        value={variant.image.image}
                        uploadPreset="ecommerce_product"
                        onChange={(url) =>
                          handleImageChange(index, { image: url })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Specs and stock */}
                <div className="grid gap-3 sm:grid-cols-3 items-start">
                  <label className="space-y-1 text-sm font-semibold text-slate-700 sm:col-span-2 block">
                    <span>Specifications (Optional: RAM: 18GB per line)</span>
                    <textarea
                      value={variant.specifications}
                      onChange={(e) =>
                        handleVariantChange(index, {
                          specifications: e.target.value,
                        })
                      }
                      rows={2}
                      placeholder={"RAM: 18GB\nStorage: 512GB SSD"}
                      className={inputClassName}
                    />
                  </label>

                  <div className="space-y-2 pt-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={variant.inStock}
                        onChange={(e) =>
                          handleVariantChange(index, { inStock: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span>In Stock</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={variant.isActive}
                        onChange={(e) =>
                          handleVariantChange(index, { isActive: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span>Sellable (Active)</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (1 col): Organization & Brand Inline Add */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-700 uppercase ">
              Catalog Visibility
            </h2>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as AdminCatalogProduct["status"])
              }
              className={inputClassName}
            >
              <option value="DRAFT">Draft (Not displayed publicly)</option>
              <option value="ACTIVE">Active (Live in storefront)</option>
              <option value="ARCHIVED">Archived (Discontinued)</option>
            </select>
            <p className="text-xs text-slate-500">
              Active items require at least one active variant with an in-stock tag.
            </p>
          </div>

          {/* Fixed Categories Card */}
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase ">
              <FiLayers />
              <span>Category (Taxonomy) *</span>
            </div>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className={inputClassName}
            >
              <option value="">-- Select Category --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isVisible ? "" : " (Hidden)"}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Choose from the verified category taxonomy.
            </p>
          </div>

          {/* Brand Quick Select + Inline Add */}
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase ">
                <FiTag />
                <span>Brand / Manufacturer *</span>
              </div>
              {!isCreatingBrand && (
                <button
                  type="button"
                  onClick={() => setIsCreatingBrand(true)}
                  className="text-sm font-semibold text-teal-600 hover:text-teal-800 hover:underline"
                >
                  + Add New
                </button>
              )}
            </div>

            {isCreatingBrand ? (
              <div className="p-3.5 rounded-md border border-teal-200 bg-teal-50/40 space-y-2.5">
                <span className="text-sm font-bold text-slate-800 block">
                  Add Brand Instantly
                </span>
                <input
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="e.g. Sony, Anker..."
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-teal-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isSavingBrand}
                    onClick={handleCreateNewBrand}
                    className="flex-1 py-1.5 rounded-md bg-slate-700 text-white font-bold text-sm hover:bg-slate-800 transition disabled:opacity-60 shadow-xs"
                  >
                    {isSavingBrand ? "Saving..." : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingBrand(false);
                      setNewBrandName("");
                    }}
                    className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={brandId}
                onChange={(e) => {
                  if (e.target.value === "ADD_NEW") {
                    setIsCreatingBrand(true);
                  } else {
                    setBrandId(e.target.value);
                  }
                }}
                required
                className={inputClassName}
              >
                <option value="">-- Quick Select Brand --</option>
                {brandsList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.isVisible ? "" : " (Hidden)"}
                  </option>
                ))}
                <option value="ADD_NEW">+ Add New Brand...</option>
              </select>
            )}
            <p className="text-xs text-slate-500">
              Select an existing brand or create a new one instantly without leaving this form.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
