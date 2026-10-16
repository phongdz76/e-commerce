"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import {
  RETURN_ACTIONS,
  RETURN_STATES,
  RETURN_REASONS,
  RETURN_PREFERENCES,
  EXCHANGE_STATES,
} from "@/utils/returnCases";
import { formatPrice } from "@/utils/formatPrice";
import ReplacementChoice from "./ReplacementChoice";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import type { ReturnCaseDetail } from "@/types/returnCase";
import SupportThreadClient from "@/app/components/support/SupportThreadClient";
import OrderPolicySnapshot from "@/app/components/orders/OrderPolicySnapshot";
import { useReturnResource, returnError } from "./useReturnResource";

const fieldClassName =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50";

interface ReturnCaseDetailClientProps {
  id: string;
  adminId?: string;
}

export default function ReturnCaseDetailClient({
  id,
  adminId,
}: ReturnCaseDetailClientProps) {
  const isAdmin = Boolean(adminId);
  const root = isAdmin ? "/admin" : "";
  const endpoint = isAdmin
    ? API_PATHS.ADMIN.RETURN(id)
    : API_PATHS.RETURNS.DETAIL(id);

  const [page, setPage] = useState(1);
  const { data, loading: isLoading, error, refresh } =
    useReturnResource<ReturnCaseDetail>(`${endpoint}?page=${page}`);

  const [action, setAction] = useState("");
  const [actionVersion, setActionVersion] = useState(0);
  const [variantId, setVariantId] = useState("");
  const [carrier, setCarrier] = useState("");
  const [text, setText] = useState("");
  const [reference, setReference] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");

  const isBusyRef = useRef(false);
  const retryRef = useRef<{ key: string; id: string } | null>(null);

  const row = data?.case;
  const needsReference = [
    "DISPATCH",
    "RECEIVE",
    "RETURN_TO_CUSTOMER",
    "EXCHANGE_SHIP",
    "EXCHANGE_DELIVER",
  ].includes(action);
  const actionChanged = Boolean(action) && row?.version !== actionVersion;

  const hasValidText = text.trim().length >= 10;
  const hasValidReference = !needsReference || reference.trim().length >= 3;
  const hasValidVariant = action !== "EXCHANGE_RESERVE" || Boolean(variantId);
  const hasValidCarrier = action !== "EXCHANGE_SHIP" || carrier.trim().length >= 2;

  const isActionSubmittable =
    !isSubmitting &&
    !isLoading &&
    Boolean(row) &&
    !actionChanged &&
    Boolean(row?.actions.includes(action)) &&
    isConfirmed &&
    hasValidText &&
    hasValidReference &&
    hasValidVariant &&
    hasValidCarrier;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isBusyRef.current || !isActionSubmittable || !row) {
      return;
    }

    isBusyRef.current = true;
    setIsSubmitting(true);
    setActionError("");
    setMessage("");

    const body = {
      action,
      version: actionVersion,
      text: text.trim(),
      reference: reference.trim() || null,
      confirmed: isConfirmed,
      ...(action === "EXCHANGE_RESERVE" ? { variantId } : {}),
      ...(action === "EXCHANGE_SHIP" ? { carrier: carrier.trim() } : {}),
    };

    const key = JSON.stringify(body);
    if (retryRef.current?.key !== key) {
      retryRef.current = { key, id: crypto.randomUUID() };
    }

    try {
      await axios.post(
        endpoint,
        { ...body, requestId: retryRef.current.id },
        { timeout: 20000 },
      );

      retryRef.current = null;
      setText("");
      setReference("");
      setIsConfirmed(false);
      setAction("");
      setVariantId("");
      setCarrier("");

      if (["EXCHANGE_DELIVER", "EXCHANGE_RECEIVE"].includes(action)) {
        setMessage(
          "Return record saved. Exchange completed and linked request resolved.",
        );
      } else {
        setMessage("Return record saved.");
      }

      if (page !== 1) {
        setPage(1);
      } else {
        await refresh();
      }
    } catch (err) {
      setActionError(returnError(err));
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        await refresh();
      }
    } finally {
      isBusyRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link
        href={`${root}/returns`}
        className="inline-flex min-h-11 items-center font-semibold text-teal-700"
      >
        ← All return requests
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="break-all text-2xl font-bold">
          {row?.reference || "Return request"}
        </h1>

        <button
          type="button"
          disabled={isSubmitting || isLoading}
          onClick={() => void refresh()}
          className="min-h-11 rounded-lg border border-slate-300 px-4 font-semibold text-teal-700 disabled:opacity-50"
        >
          Refresh return
        </button>
      </div>

      {isLoading && (
        <p role="status" className="text-sm text-slate-500">
          Loading return request…
        </p>
      )}

      {(error || actionError) && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {actionError || error}
        </p>
      )}

      {message && (
        <p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">
          {message}
        </p>
      )}

      {row && (
        <>
          <section
            aria-label="Return summary"
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
          >
            <p className="font-semibold text-teal-800">
              {RETURN_STATES[row.state]}
            </p>

            <h2 className="break-words text-lg font-semibold">
              {row.item.name} · {row.item.option}
            </h2>

            <p className="break-words text-sm text-slate-600">
              {row.item.sku} · Return quantity {row.quantity} of{" "}
              {row.item.purchasedQuantity} purchased
            </p>

            <p className="text-sm">
              {RETURN_REASONS[row.reason]} · {RETURN_PREFERENCES[row.preference]}
            </p>

            <p className="whitespace-pre-wrap break-words text-sm">
              {row.description}
            </p>

            <p className="text-xs text-slate-500">
              Created {formatAdminOrderDate(row.createdAt)} · Updated{" "}
              {formatAdminOrderDate(row.updatedAt)}
            </p>

            <div className="flex flex-wrap gap-4 text-sm font-semibold text-teal-700">
              <Link
                href={`${root}/orders/${row.orderId}`}
                className="inline-flex min-h-11 items-center hover:underline"
              >
                View {row.orderReference}
              </Link>
              <Link
                href={`${root}/support${isAdmin ? "-requests" : "/requests"}/${row.ticketId}`}
                className="inline-flex min-h-11 items-center hover:underline"
              >
                Linked support request
              </Link>
            </div>

            {data.imageUrl && (
              <a href={data.imageUrl} target="_blank" rel="noreferrer">
                <Image
                  src={data.imageUrl}
                  unoptimized
                  alt="Return request attachment"
                  width={600}
                  height={450}
                  className="max-h-64 w-auto max-w-full rounded-lg object-contain"
                />
              </a>
            )}

            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {row.state === "EXCHANGED"
                ? "The replacement delivery has been confirmed. This exchange did not issue a refund or change the original payment."
                : "Goods receipt and inspection do not confirm a refund or replacement delivery. Follow the exchange record and support instructions for the next step."}
            </p>

            <OrderPolicySnapshot value={row.policy} />
          </section>

          {row.exchange && (
            <section
              aria-label="Replacement exchange"
              className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4 sm:p-6"
            >
              <h2 className="text-lg font-semibold">Replacement exchange</h2>
              <p className="font-semibold text-teal-900">
                {EXCHANGE_STATES[row.exchange.state]}
              </p>

              <p className="break-words">
                {row.exchange.name} · {row.exchange.option}
              </p>

              <p className="break-all text-sm">
                SKU: {row.exchange.sku} · Quantity {row.exchange.quantity}
              </p>

              <p className="text-sm">
                Original unit price {formatPrice(row.exchange.unitPrice)} · No additional payment
              </p>

              <div className="space-y-1 text-sm">
                <p className="font-semibold">
                  Delivery destination saved with this offer
                </p>
                <p className="break-words">
                  {row.exchange.destination.name} · {row.exchange.destination.phone}
                </p>
                <p className="break-words">
                  {row.exchange.destination.address}
                </p>
              </div>

              {row.exchange.trackingNumber && (
                <p className="break-words text-sm">
                  Carrier: {row.exchange.carrier} · Tracking:{" "}
                  {row.exchange.trackingNumber}
                </p>
              )}

              {row.exchange.state === "OFFERED" && (
                <p className="text-sm">
                  Stock is held while you review this SKU, quantity and destination. Accept before dispatch, or decline to release the reservation. Contact support if these details need to change.
                </p>
              )}

              {row.exchange.state === "SHIPPED" && (
                <p className="text-sm">
                  Confirm receipt only after you have received and checked the replacement. A tracking reference alone does not confirm delivery.
                </p>
              )}
            </section>
          )}

          {isAdmin && !row.canManage && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Accept or reopen the shared conversation below before managing this return, then use Refresh return.
            </p>
          )}

          {row.actions.length > 0 && (
            <form
              aria-label="Update return"
              onSubmit={handleSubmit}
              className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
            >
              <h2 className="text-lg font-semibold">Record next step</h2>

              <label className="block text-sm font-medium">
                Action
                <select
                  aria-label="Return action"
                  required
                  className={fieldClassName}
                  value={action}
                  disabled={isSubmitting || isLoading}
                  onChange={(event) => {
                    setAction(event.target.value);
                    setActionVersion(row.version);
                    setIsConfirmed(false);
                    setVariantId("");
                  }}
                >
                  <option value="">Choose an action</option>
                  {row.actions.map((value) => (
                    <option key={value} value={value}>
                      {RETURN_ACTIONS[value]}
                    </option>
                  ))}
                </select>
              </label>

              {actionChanged && (
                <p role="alert" className="text-sm text-amber-900">
                  This request changed while you were editing. Select the action again and review the latest details before confirming.
                </p>
              )}

              {action === "EXCHANGE_RESERVE" && (
                <ReplacementChoice
                  key={row.version}
                  id={id}
                  value={variantId}
                  onChange={setVariantId}
                  disabled={isSubmitting || isLoading || actionChanged}
                />
              )}

              {action === "EXCHANGE_SHIP" && (
                <label className="block text-sm font-medium">
                  Replacement carrier
                  <input
                    aria-label="Replacement carrier"
                    required
                    minLength={2}
                    maxLength={80}
                    value={carrier}
                    onChange={(event) => setCarrier(event.target.value)}
                    disabled={isSubmitting || isLoading}
                    className={fieldClassName}
                  />
                </label>
              )}

              <label className="block text-sm font-medium">
                {action === "ACCEPT"
                  ? "Return instructions for the customer"
                  : "Public note / inspection findings"}
                <textarea
                  aria-label="Return action note"
                  required
                  minLength={10}
                  maxLength={1000}
                  value={text}
                  disabled={isSubmitting || isLoading}
                  onChange={(event) => setText(event.target.value)}
                  className={`${fieldClassName} min-h-28`}
                />
                <span className="mt-1 block text-xs text-slate-500">
                  {text.length}/1,000 characters · visible to the customer. Keep private notes in the linked support request.
                </span>
              </label>

              <label className="block text-sm font-medium">
                {action === "EXCHANGE_SHIP"
                  ? "Replacement tracking number"
                  : "Receipt or evidence reference"}{" "}
                {needsReference ? "(required)" : "(optional)"}
                <input
                  aria-label="Return receipt reference"
                  required={needsReference}
                  minLength={needsReference ? 3 : undefined}
                  maxLength={120}
                  value={reference}
                  disabled={isSubmitting || isLoading}
                  onChange={(event) => setReference(event.target.value)}
                  className={fieldClassName}
                />
              </label>

              {action === "RESTOCK" && (
                <p className="text-sm text-amber-900">
                  This adds {row.quantity} inspected units to sellable stock. Confirm their condition and count before proceeding.
                </p>
              )}

              {action === "INSPECT_OTHER" && (
                <p className="text-sm text-amber-900">
                  These goods remain outside sellable stock while the support team reviews the resolution.
                </p>
              )}

              <label className="flex items-start gap-3 text-sm">
                <input
                  aria-label="Confirm return action"
                  type="checkbox"
                  required
                  checked={isConfirmed}
                  disabled={isSubmitting || isLoading}
                  onChange={(event) => setIsConfirmed(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span>
                  I confirm the recorded facts, quantity and instructions for this step.
                </span>
              </label>

              <button
                type="submit"
                disabled={!isActionSubmittable}
                className="min-h-11 rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {isSubmitting ? "Saving…" : "Save return step"}
              </button>
            </form>
          )}

          <section
            aria-label="Return history"
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
          >
            <h2 className="text-lg font-semibold">Return history</h2>
            <ol className="space-y-3">
              {data.events.map((event) => (
                <li
                  key={event.id}
                  className="rounded-lg bg-slate-50 p-3 text-sm"
                >
                  <p className="font-semibold">
                    {event.action === "CREATE"
                      ? "Return request received"
                      : RETURN_ACTIONS[event.action]} · {RETURN_STATES[event.state]}
                  </p>

                  <p className="mt-2 whitespace-pre-wrap break-words">
                    {event.text}
                  </p>

                  {event.exchange && (
                    <p className="mt-2 break-words text-teal-900">
                      {event.exchange.sku} · {event.exchange.option} · Quantity{" "}
                      {event.exchange.quantity} · {EXCHANGE_STATES[event.exchange.state]}
                    </p>
                  )}

                  {event.reference && (
                    <p className="mt-2 break-all text-slate-600">
                      Reference: {event.reference}
                    </p>
                  )}

                  <time className="mt-2 block text-xs text-slate-500">
                    {formatAdminOrderDate(event.createdAt)}
                  </time>
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <button
                type="button"
                disabled={page <= 1 || isLoading || isSubmitting}
                onClick={() => setPage((value) => value - 1)}
                className="min-h-11 font-semibold text-teal-700 disabled:opacity-40"
              >
                Newer history
              </button>
              <span>Page {page}</span>
              <button
                type="button"
                disabled={!data.hasOlder || isLoading || isSubmitting}
                onClick={() => setPage((value) => value + 1)}
                className="min-h-11 font-semibold text-teal-700 disabled:opacity-40"
              >
                Older history
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              Shared support conversation
            </h2>
            <p className="text-sm text-slate-500">
              Your return and other support requests share this conversation. Return decisions are recorded separately above.
            </p>
            <SupportThreadClient
              conversationId={data.conversationId}
              adminId={adminId}
            />
          </section>
        </>
      )}
    </div>
  );
}
