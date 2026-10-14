"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import Image from "next/image";
import Link from "next/link";
import {
  FiPlus,
  FiTrash2,
  FiLayers,
  FiTag,
  FiArrowLeft,
  FiSave,
  FiChevronDown,
} from "react-icons/fi";
import ImageUpload from "@/app/components/inputs/ImageUpload";
import { API_PATHS } from "@/utils/apiPaths";
import { isCatalogImageUrl } from "@/utils/catalogImage";
import { getAdminErrorMessage } from "@/utils/adminError";
import { getCatalogSlug } from "@/utils/catalogSlug";
import { formatPrice } from "@/utils/formatPrice";
import OrderProductImage from "@/app/admin/orders/OrderProductImage";
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
  const [hasCustomSlug, setHasCustomSlug] = useState(Boolean(product));
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
          image: { ...v.image, colorCode: v.image.colorCode.trim() },
          specifications: Object.entries(attributes)
            .map(([k, val]) => `${k}: ${val}`)
            .join("\n"),
        }))
      : [newVariant()],
  );
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const [formError, setFormError] = useState("");
  const [hasConflict, setHasConflict] = useState(false);
  const [variantErrors, setVariantErrors] = useState<Record<number, string>>({});
  const snapshot = JSON.stringify({ name, slug, description, status, categoryId, brandId, variants });
  const [original] = useState(snapshot);
  const isDirty = snapshot !== original;

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleCancel = () => {
    if (isDirty && !window.confirm("Discard your unsaved product changes?")) {
      return;
    }
    router.push("/admin/products");
  };

  const handleGenerateSku = (index: number) => {
    const variant = variants[index];
    const base = (slug || "PRODUCT").toUpperCase().slice(0, 30);
    const color = (variant.image.color || "STANDARD").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    handleVariantChange(index, { sku: base + "-" + color + "-" + (index + 1) });
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!product && !hasCustomSlug) {
      setSlug(getCatalogSlug(val));
    }
  };

  const handleCreateNewBrand = async () => {
    const trimmed = newBrandName.trim();
    if (!trimmed || trimmed.length < 2) {
      toast.error("Brand name must be at least 2 characters.");
      return;
    }
    const brandSlug = getCatalogSlug(trimmed, 100);
    setIsSavingBrand(true);
    try {
      const response = await axios.post(API_PATHS.ADMIN.BRANDS, {
        name: trimmed,
        slug: brandSlug,
        isVisible: true,
      });
      const newBrand: SafeCatalogGroup = response.data;
      setBrandsList((prev) => [...prev, newBrand]);
      setBrandId(newBrand.id);
      setNewBrandName("");
      setIsCreatingBrand(false);
      toast.success(`Brand "${trimmed}" created and selected!`);
    } catch (err: unknown) {
      toast.error(getAdminErrorMessage(err, "Unable to create this brand. Check its name and URL slug, then try again."));
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

  const handleRevealField = (field: HTMLElement | null) => {
    if (!field) {
      return;
    }
    let parent = field.parentElement;
    while (parent && parent !== form.current) {
      if (parent instanceof HTMLDetailsElement) {
        parent.open = true;
      }
      parent = parent.parentElement;
    }
    field.scrollIntoView({ block: "center" });
    field.focus({ preventScroll: true });
  };

  const handleInvalid = (event: FormEvent<HTMLFormElement>) => {
    let parent = (event.target as HTMLElement).parentElement;
    while (parent && parent !== form.current) {
      if (parent instanceof HTMLDetailsElement) {
        parent.open = true;
      }
      parent = parent.parentElement;
    }
    setFormError("Review the required fields and highlighted inputs before saving.");
  };

  const handleReviewFields = () => {
    handleRevealField(form.current?.querySelector<HTMLElement>("input:invalid, select:invalid, textarea:invalid") || null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving.current) {
      return;
    }
    setFormError("");
    setHasConflict(false);
    setVariantErrors({});
    if (!categoryId) {
      toast.error("Please select a category.");
      return;
    }
    if (!brandId) {
      toast.error("Please select or add a brand.");
      return;
    }
    if (status === "ACTIVE" && (
      !categories.find((category) => category.id === categoryId)?.isVisible ||
      !brandsList.find((brand) => brand.id === brandId)?.isVisible ||
      !variants.some((variant) => variant.isActive)
    )) {
      setFormError("An active product needs a visible category, a visible brand and at least one enabled variant.");
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
        variants: preparedVariants.map(({ specifications, ...variant }, index) => {
          try {
            const catalogVariant = { ...variant };
            delete catalogVariant.inventory;
            return { ...catalogVariant, attributes: getAttributes(specifications) };
          } catch (error: unknown) {
            setVariantErrors({ [index]: "Use one Name: value per line, with unique specification names." });
            const specifications = document.getElementById("variant-spec-" + index);
            handleRevealField(specifications);
            throw error;
          }
        }),
        ...(product ? { updatedAt: product.updatedAt } : {}),
      };
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Check the variant specifications.");
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
      router.push("/admin/products?updated=" + Date.now());
      router.refresh();
    } catch (error: unknown) {
      const message = getAdminErrorMessage(error, "Unable to save this product. Check the name, URL slug, description and variants. Prices must be positive whole VND amounts and each SKU must be unique.");
      setFormError(message);
      setHasConflict(axios.isAxiosError(error) && error.response?.status === 409 && error.response?.data?.code !== "DUPLICATE_CATALOG_KEY");
      toast.error(message);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  return (
    <form
      ref={form}
      onSubmit={handleSubmit}
      onInvalidCapture={handleInvalid}
      className="space-y-6 max-w-6xl mx-auto"
    >
      {/* Header bar */}
      <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 py-4">
        <div>
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-teal-600 mb-1"
          >
            <FiArrowLeft />
            <span>Back to Products</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-800 ">
            {product ? "Edit product" : "Add product"}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleCancel}
            className="px-4 py-2 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-slate-700 hover:bg-slate-800 text-sm font-bold text-white shadow-xs transition disabled:opacity-70"
          >
            <FiSave className="text-sm" />
            <span>{isSaving ? "Saving..." : "Save changes"}</span>
          </button>
        </div>
      </div>

      {formError ? (
        <div role="alert" className="space-y-2 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">Check the product details</p>
          <p>{formError}</p>
          {hasConflict ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Reload the latest product? Unsaved input will be discarded.")) {
                  window.location.reload();
                }
              }}
              className="mr-4 font-semibold underline"
            >
              Reload product
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleReviewFields}
            className="font-semibold underline"
          >
            Review required fields
          </button>
        </div>
      ) : null}
      <fieldset disabled={isSaving} className="min-w-0 space-y-6">
      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 items-start">
        {/* Left Column (2 cols): General & Variants */}
        <div className="min-w-0 lg:col-span-2 space-y-6">
          {/* General Information Card */}
          <div className="rounded-md border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <h2 className="text-sm font-bold text-slate-700 uppercase pb-3 border-b border-slate-100">
              Basic information
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
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setHasCustomSlug(true);
                  }}
                  required
                  maxLength={150}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  placeholder="e.g. macbook-pro-14-m3-max"
                  className={inputClassName}
                />
                <span className="block text-xs font-normal leading-5 text-slate-500">Generated from the name. A custom URL slug is kept when the name changes.</span>
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Variants & SKUs ({variants.length}/20)
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
                <span>Add variant</span>
              </button>
            </div>

            {variants.map((variant, index) => (
              <details
                key={variant.id || `variant-${index}`}
                open={index === 0 || !variant.id || Boolean(variantErrors[index]) || undefined}
                className="group/variant min-w-0 rounded-md border border-slate-200 bg-white shadow-xs"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 marker:content-none [&::-webkit-details-marker]:hidden sm:p-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <OrderProductImage
                      key={variant.image.image}
                      image={isCatalogImageUrl(variant.image.image) ? variant.image.image : null}
                      name={variant.name || "Variant " + (index + 1)}
                    />
                    <div className="min-w-0">
                      <strong className="block break-words text-sm font-semibold text-slate-900">{variant.name || "Variant " + (index + 1)}</strong>
                      <p className="mt-1 break-all text-xs text-slate-500">{variant.sku || "SKU not entered"}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className={"rounded-full px-2 py-0.5 " + (variant.isActive ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-600")}>{variant.isActive ? "Enabled" : "Disabled"}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{variant.inStock ? "In stock" : "Out of stock"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold text-slate-800">{variant.price > 0 ? formatPrice(variant.price) : "Price required"}</span>
                    <FiChevronDown className="text-slate-400 transition-transform group-open/variant:rotate-180" aria-hidden="true" />
                  </div>
                </summary>
                <div className="space-y-4 border-t border-slate-100 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-medium text-slate-500">Variant {index + 1} · Edit SKU, price, image and availability</p>
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
                    <button
                      type="button"
                      onClick={() => handleGenerateSku(index)}
                      className="text-xs font-semibold text-teal-700 hover:underline"
                    >
                      Generate SKU
                    </button>
                  </label>

                  <label className="space-y-1 text-sm font-semibold text-slate-700 block">
                    <span>Variant name *</span>
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
                        aria-label={"Image URL for variant " + (index + 1)}
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
                            className="object-contain"
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
                  <details className="sm:col-span-2 rounded-md border border-slate-200 p-3" open={Boolean(variantErrors[index]) || undefined}>
                    <summary className="cursor-pointer text-sm font-semibold">Specifications (optional)</summary>
                    <label className="mt-3 block space-y-1 text-sm text-slate-700">
                    <span>One specification per line, for example RAM: 18GB.</span>
                    <textarea
                      id={"variant-spec-" + index}
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
                    {variantErrors[index] ? <p className="text-xs text-rose-700">{variantErrors[index]}</p> : null}
                  </label>
                  </details>

                  <div className="space-y-2 pt-4">
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                      <p className="font-semibold text-slate-700">Stock quantity</p>
                      <p className="mt-1 text-slate-600">{variant.inventory ? `${variant.inventory.onHand.toLocaleString("en-US")} on hand · ${variant.inventory.available.toLocaleString("en-US")} available` : "Not counted"}</p>
                      {variant.id ? <Link href={"/admin/inventory/" + variant.id} className="mt-1 inline-flex min-h-11 items-center font-semibold text-teal-700">Manage stock →</Link> : <p className="mt-1 text-xs text-slate-500">Save this variant before recording its opening count.</p>}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={variant.inStock}
                        onChange={(e) =>
                          handleVariantChange(index, { inStock: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span>Catalog availability</span>
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
                      <span>Enable variant</span>
                    </label>
                  </div>
                </div>
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Right Column (1 col): Organization & Brand Inline Add */}
        <div className="min-w-0 space-y-6">
          {/* Status Card */}
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-700 uppercase ">
              Product status
            </h2>
            <select
              aria-label="Product status"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as AdminCatalogProduct["status"])
              }
              className={inputClassName}
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <p className="text-xs text-slate-500">
              Active requires a visible category, visible brand and at least one enabled variant. In stock is a separate availability flag, not a stock quantity.
            </p>
          </div>

          {/* Fixed Categories Card */}
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase ">
              <FiLayers />
              <span>Category *</span>
            </div>
            <select
              aria-label="Category"
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
              Choose the group this product belongs to.
            </p>
          </div>

          {/* Brand Quick Select + Inline Add */}
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase ">
                <FiTag />
                <span>Brand *</span>
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
                  aria-label="New brand name"
                  value={newBrandName}
                  maxLength={80}
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
                    disabled={isSavingBrand}
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
                aria-label="Brand"
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
      </fieldset>
    </form>
  );
}
