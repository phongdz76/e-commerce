"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import axios from "axios";
import SupportThreadClient from "./SupportThreadClient";
import SupportHours from "./SupportHours";
import type { SupportContext } from "@/types/support";

interface SupportChatPanelProps {
  enabled: boolean;
}

export default function SupportChatPanel({ enabled }: SupportChatPanelProps) {
  const pathname = usePathname();
  const [status, setStatus] = useState<"loading" | "guest" | "ready" | "error">("loading");

  const [context] = useState<SupportContext | null>(() => {
    const product = /^\/product\/([a-f\d]{24})$/.exec(pathname || "");
    const order = /^\/orders\/([a-f\d]{24})$/.exec(pathname || "");
    const variant =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("variant")
        : null;

    if (product) {
      return {
        kind: "PRODUCT",
        id: product[1],
        ...(variant && /^[a-f\d]{24}$/.test(variant) ? { variantId: variant } : {}),
      };
    }

    if (order) {
      return {
        kind: "ORDER",
        id: order[1],
      };
    }

    return null;
  });

  const check = useCallback(async () => {
    try {
      await axios.get("/api/support");
      setStatus("ready");
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setStatus("guest");
      } else {
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (enabled && status === "loading") {
      void Promise.resolve().then(async () => {
        if (active) {
          await check();
        }
      });
    }

    return () => {
      active = false;
    };
  }, [enabled, status, check]);

  if (status === "ready") {
    return (
      <div className="space-y-3">
        <div className="px-4 pt-4">
          <SupportHours enabled={enabled} />
        </div>
        <SupportThreadClient initialContext={context} enabled={enabled} />
      </div>
    );
  }

  if (status === "guest") {
    return (
      <div className="space-y-3 p-4 text-sm">
        <p>Sign in to send messages and keep your conversation history.</p>
        <Link
          href={"/login?callbackUrl=" + encodeURIComponent(pathname || "/support")}
          className="inline-flex min-h-11 items-center rounded-md bg-teal-700 px-4 font-semibold text-white"
        >
          Sign in to message support
        </Link>
        <p>Quick answers are available without signing in.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-4 text-sm">
        <p role="alert">Unable to open support. Please retry.</p>
        <button
          type="button"
          onClick={() => void check()}
          className="min-h-11 font-semibold text-teal-700"
        >
          Retry support
        </button>
      </div>
    );
  }

  return <p role="status" className="p-4 text-sm">Opening your conversation…</p>;
}
