"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

export function productRequestError(error: unknown) {
  return axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error : "Unable to load or save your changes. Please retry.";
}

export function useProductResource<T>(url: string) {
  const [result, setResult] = useState<{ url: string; data: T } | null>(null);
  const [failure, setFailure] = useState<{ url: string; message: string } | null>(null);
  const [pending, setPending] = useState<string | null>(url);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPending(url);
    try {
      const response = await axios.get<T>(url, { signal: controller.signal, timeout: 15000 });
      if (!controller.signal.aborted) { setResult({ url, data: response.data }); setFailure(null); }
    } catch (error) {
      if (!controller.signal.aborted) setFailure({ url, message: productRequestError(error) });
    } finally {
      if (!controller.signal.aborted) setPending(null);
    }
  }, [url]);
  useEffect(() => {
    const fetchInitial = async () => { await refresh(); };
    void fetchInitial();
    return () => request.current?.abort();
  }, [refresh]);
  return { data: result?.url === url ? result.data : null,
    error: failure?.url === url ? failure.message : "",
    loading: pending === url || (result?.url !== url && failure?.url !== url), refresh };
}
