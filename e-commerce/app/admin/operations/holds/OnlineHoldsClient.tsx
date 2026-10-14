"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import Link from "next/link";
import toast from "react-hot-toast";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";
import AdminPagination from "@/app/admin/components/AdminPagination";
import AdminFeedback from "@/app/admin/components/AdminFeedback";
import { API_PATHS } from "@/utils/apiPaths";
import { getAdminErrorMessage } from "@/utils/adminError";

interface Hold {
  id: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  ageMinutes: number;
  units: number;
  reason: string;
  recovery: string;
  canCheck: boolean;
  version: number;
  canRecoverCard: boolean;
}
export default function OnlineHoldsClient() {
  const router = useRouter();
  const params = useSearchParams();
  const page = Number(params?.get("page") || 1);
  const [data, setData] = useState<{
    holds: Hold[];
    total: number;
    totalPages: number;
    hasMore: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [checking, setChecking] = useState<string | null>(null);
  const pending = useRef(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await axios.get(API_PATHS.ADMIN.ONLINE_HOLDS, {
          params: { page },
        });
        if (active) setData(response.data);
      } catch {
        if (active)
          setError(
            "Unable to load online holds. Check the selected page and retry.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, refresh]);
  const reload = () => setRefresh((value) => value + 1);
  const recheck = async (hold: Hold) => {
    if (pending.current) return;
    pending.current = true;
    setChecking(hold.id);
    try {
      const response = await axios.post(
        API_PATHS.ADMIN.RECONCILE_PAYMENT(hold.id),
      );
      toast(
        response.data.skipped
          ? "A payment check is already in progress."
          : "Payment check completed. Review the latest order and hold state.",
      );
      reload();
    } catch (error) {
      toast.error(
        getAdminErrorMessage(
          error,
          "Unable to confirm this payment. The held stock has been kept.",
        ),
      );
    } finally {
      pending.current = false;
      setChecking(null);
    }
  };
  const recover = async (hold: Hold) => {
    if (pending.current) return;
    const reason = reasons[hold.id]?.trim() || "";
    if (reason.length < 10) {
      toast.error("Enter a recovery reason of at least 10 characters.");
      return;
    }
    if (
      !window.confirm(
        "Recover the original Stripe test request using its original key? This keeps the stock hold and does not confirm a payment.",
      )
    )
      return;
    pending.current = true;
    setChecking(hold.id);
    try {
      await axios.post(API_PATHS.ADMIN.RECOVER_CARD_HOLD(hold.id), {
        version: hold.version,
        confirmed: true,
        reason,
      });
      toast.success(
        "Original card reference recovered. Check the payment history.",
      );
      reload();
    } catch (error) {
      toast.error(
        getAdminErrorMessage(
          error,
          "Card recovery could not be confirmed. The held stock has been kept.",
        ),
      );
    } finally {
      pending.current = false;
      setChecking(null);
    }
  };
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Online stock holds"
        description="Review online holds older than one hour. Age is a review threshold; uncertain payments keep their stock."
      >
        <AdminRefreshButton isLoading={loading} onRefresh={reload} />
      </AdminPageHeader>
      <Link
        href="/admin/operations"
        className="inline-flex min-h-10 items-center text-sm font-semibold text-teal-700"
      >
        Back to operations
      </Link>
      {loading ? (
        <AdminFeedback title="Loading online holds..." />
      ) : error ? (
        <AdminFeedback title={error} isError onRetry={reload} />
      ) : data?.holds.length ? (
        <div className="space-y-4">
          {data.holds.map((hold) => (
            <article
              key={hold.id}
              className="min-w-0 space-y-3 rounded-lg border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <Link
                  href={`/admin/orders/${hold.id}`}
                  className="break-all text-sm font-semibold text-teal-700"
                >
                  Order #{hold.id.slice(-8).toUpperCase()}
                </Link>
                <span className="text-sm text-slate-600">
                  {hold.paymentMethod} · {hold.status}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Held {hold.ageMinutes} minutes · {hold.units} units ·{" "}
                {new Date(hold.createdAt).toLocaleString("en-GB", {
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </p>
              <p className="text-sm leading-6 text-slate-700">
                {hold.recovery}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/admin/payments?orderId=${hold.id}&state=ALL`}
                  className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-3 text-sm font-semibold"
                >
                  Payment history
                </Link>
                {hold.canCheck && (
                  <button
                    type="button"
                    disabled={Boolean(checking)}
                    onClick={() => void recheck(hold)}
                    className="min-h-11 rounded-md bg-slate-700 px-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {checking === hold.id
                      ? "Checking..."
                      : "Check original payment"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <AdminFeedback
          title="No overdue online holds"
          description="There are no uncertain online holds older than one hour."
        />
      )}
      {!loading &&
        !error &&
        data?.holds
          .filter((hold) => hold.canRecoverCard)
          .map((hold) => (
            <div
              key={hold.id}
              className="min-w-0 space-y-3 rounded-lg border border-slate-200 bg-white p-5"
            >
              <label className="block space-y-2 text-sm font-semibold">
                Recovery reason for #{hold.id.slice(-8).toUpperCase()}
                <textarea
                  aria-label={`Card recovery reason ${hold.id}`}
                  value={reasons[hold.id] || ""}
                  onChange={(event) =>
                    setReasons((previous) => ({
                      ...previous,
                      [hold.id]: event.target.value,
                    }))
                  }
                  maxLength={500}
                  rows={2}
                  disabled={Boolean(checking)}
                  className="w-full rounded-md border border-slate-300 p-3 font-normal"
                />
              </label>
              <button
                type="button"
                disabled={Boolean(checking)}
                onClick={() => void recover(hold)}
                className="min-h-11 rounded-md bg-slate-700 px-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {checking === hold.id
                  ? "Recovering..."
                  : "Recover original card reference"}
              </button>
            </div>
          ))}
      {data && (
        <AdminPagination
          currentPage={page}
          totalPages={data.totalPages}
          totalItems={data.total}
          pageSize={10}
          hasMore={data.hasMore}
          isLoading={loading || Boolean(checking)}
          onPageChange={(next) =>
            router.push(`/admin/operations/holds?page=${next}`)
          }
        />
      )}
    </div>
  );
}
