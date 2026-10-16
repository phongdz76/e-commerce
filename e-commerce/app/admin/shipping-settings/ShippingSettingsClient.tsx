"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import Button from "@/app/components/Button";
import { API_PATHS } from "@/utils/apiPaths";
import type { ShippingPolicyInput } from "@/types/checkout";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500 disabled:opacity-60";

export default function ShippingSettingsClient() {
  const [policy, setPolicy] = useState<ShippingPolicyInput | null>(null);
  const [codes, setCodes] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reload, setReload] = useState(0);

  const request = useRef<{ fingerprint: string; id: string } | null>(null);

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const response = await axios.get<{ policy: ShippingPolicyInput }>(
          API_PATHS.ADMIN.SHIPPING_POLICY
        );
        if (active) {
          setPolicy(response.data.policy);
          setCodes(response.data.policy.provinceCodes.join(", "));
          setError("");
        }
      } catch {
        if (active) {
          setError("Unable to load delivery settings. Try again.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      active = false;
    };
  }, [reload]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!policy || isSaving) {
      return;
    }

    const data = {
      ...policy,
      provinceCodes: policy.nationwide
        ? []
        : codes
            .split(",")
            .map((code) => code.trim())
            .filter(Boolean),
      reason,
    };

    const fingerprint = JSON.stringify(data);
    if (request.current?.fingerprint !== fingerprint) {
      request.current = { fingerprint, id: crypto.randomUUID() };
    }

    setIsSaving(true);
    setError("");

    try {
      const response = await axios.put<{ policy: ShippingPolicyInput }>(
        API_PATHS.ADMIN.SHIPPING_POLICY,
        { ...data, requestId: request.current.id }
      );
      setPolicy(response.data.policy);
      setCodes(response.data.policy.provinceCodes.join(", "));
      setReason("");
      request.current = null;
      toast.success("Delivery settings saved. Existing orders keep their original fees.");
    } catch (failure) {
      const message = axios.isAxiosError(failure) ? failure.response?.data?.error : null;
      setError(
        typeof message === "string"
          ? message
          : "Unable to save delivery settings. Your input has been kept."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Delivery settings"
        description="Set the customer delivery fee and service area. Confirmed orders retain their saved pricing."
      />

      {isLoading && <p role="status">Loading delivery settings...</p>}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <p>{error}</p>
          <button
            type="button"
            disabled={isSaving}
            className="mt-2 min-h-11 underline"
            onClick={() => {
              setIsLoading(true);
              setReload((value) => value + 1);
            }}
          >
            Reload saved settings
          </button>
        </div>
      )}

      {policy && (
        <form
          onSubmit={handleSave}
          className="max-w-2xl space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-7"
        >
          <p className="text-sm text-slate-500">
            This fee is charged by SGTech. Carrier booking and carrier-calculated rates are separate
            integrations.
          </p>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={policy.enabled}
              disabled={isSaving}
              onChange={(event) =>
                setPolicy({ ...policy, enabled: event.target.checked })
              }
            />
            Accept deliveries
          </label>

          <label className="block space-y-2 text-sm font-medium">
            <span>Delivery service label</span>
            <input
              required
              minLength={2}
              maxLength={80}
              className={inputClass}
              value={policy.label}
              disabled={isSaving}
              onChange={(event) =>
                setPolicy({ ...policy, label: event.target.value })
              }
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium">
              <span>Delivery fee (VND)</span>
              <input
                type="number"
                required
                min={0}
                max={2000000000}
                step={1}
                className={inputClass}
                value={policy.fee}
                disabled={isSaving}
                onChange={(event) =>
                  setPolicy({ ...policy, fee: Number(event.target.value) })
                }
              />
            </label>

            <label className="block space-y-2 text-sm font-medium">
              <span>Free delivery from (VND)</span>
              <input
                type="number"
                min={1}
                max={2000000000}
                step={1}
                placeholder="No free-delivery threshold"
                className={inputClass}
                value={policy.freeShippingThreshold ?? ""}
                disabled={isSaving}
                onChange={(event) =>
                  setPolicy({
                    ...policy,
                    freeShippingThreshold:
                      event.target.value === "" ? null : Number(event.target.value),
                  })
                }
              />
            </label>
          </div>

          <p className="text-xs text-slate-500">
            The threshold uses the merchandise subtotal. A blank threshold disables free delivery.
          </p>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={policy.nationwide}
              disabled={isSaving}
              onChange={(event) =>
                setPolicy({ ...policy, nationwide: event.target.checked })
              }
            />
            Serve all provinces and cities
          </label>

          {!policy.nationwide && (
            <label className="block space-y-2 text-sm font-medium">
              <span>Served province codes (comma separated)</span>
              <input
                required
                className={inputClass}
                value={codes}
                disabled={isSaving}
                onChange={(event) => setCodes(event.target.value)}
              />
              <span className="block text-xs font-normal text-slate-500">
                Use the province codes from the checkout address list.
              </span>
            </label>
          )}

          <label className="block space-y-2 text-sm font-medium">
            <span>Reason for the change</span>
            <textarea
              required
              minLength={10}
              maxLength={500}
              className={inputClass}
              value={reason}
              disabled={isSaving}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          <Button
            type="submit"
            label={isSaving ? "Saving..." : "Save delivery settings"}
            disabled={isSaving}
            onClick={() => {}}
          />
        </form>
      )}
    </div>
  );
}
