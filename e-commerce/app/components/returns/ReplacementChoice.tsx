"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import type { ReturnExchangeOption } from "@/types/returnCase";
import { returnError } from "./useReturnResource";

interface ReplacementChoiceProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

export default function ReplacementChoice({
  id,
  value,
  onChange,
  disabled,
}: ReplacementChoiceProps) {
  const [items, setItems] = useState<ReturnExchangeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOptions() {
      setIsLoading(true);
      try {
        const response = await axios.get<{ items: ReturnExchangeOption[] }>(
          API_PATHS.ADMIN.RETURN_EXCHANGE_OPTIONS(id),
          {
            signal: controller.signal,
            timeout: 15000,
          },
        );

        if (!controller.signal.aborted) {
          setItems(response.data.items);
          setError("");
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(returnError(err));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadOptions();

    return () => {
      controller.abort();
    };
  }, [id, reload]);

  return (
    <div className="space-y-2 text-sm">
      <label className="block font-medium">
        Replacement SKU
        <select
          aria-label="Replacement SKU"
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || isLoading || Boolean(error)}
          className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white p-3 text-base focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
        >
          <option value="">Choose an available replacement</option>
          {items.map((item) => (
            <option key={item.variantId} value={item.variantId}>
              {item.sku} · {item.name} · {item.available} available
            </option>
          ))}
        </select>
      </label>

      {isLoading && (
        <p role="status">Loading replacement choices…</p>
      )}

      {error && (
        <p role="alert" className="text-rose-700">
          {error}
        </p>
      )}

      {!isLoading && !error && items.length === 0 && (
        <p className="text-amber-900">
          No replacement currently has enough stock at the original unit price. Keep the case open for support review.
        </p>
      )}

      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setReload((prev) => prev + 1)}
        className="min-h-11 font-semibold text-teal-700 disabled:opacity-50"
      >
        Refresh replacement choices
      </button>

      <p className="text-slate-500">
        Same product and original unit price, with no extra charge. Reserving holds the selected quantity until the customer accepts or support releases it. Suitable returned goods must be restocked first.
      </p>
    </div>
  );
}
