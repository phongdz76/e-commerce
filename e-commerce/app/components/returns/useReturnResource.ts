"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { createRequestScope } from "@/utils/requestScope";

export function returnError(error: unknown) {
  return axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error
    : "Unable to confirm this request. Your draft has been kept; refresh and retry.";
}

export function useReturnResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const requests = useRef(createRequestScope());
  const refresh = useCallback(async (foreground = true) => {
    const request = requests.current.begin(foreground);
    if (!request) return;
    if (foreground) setLoading(true);
    try {
      const result = await axios.get<T>(url, { signal: request.signal, timeout: 15000 });
      if (request.signal.aborted) return;
      setData(result.data);
      setError("");
    } catch (error) {
      if (!request.signal.aborted) setError(returnError(error));
    } finally {
      if (requests.current.finish(request)) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    const scope = requests.current;
    const fetchInitial = async () => { await refresh(); };
    void fetchInitial();
    const poll = () => { if (!document.hidden) void refresh(false); };
    const timer = window.setInterval(poll, 10000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      scope.cancel();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [refresh]);
  return { data, error, loading, refresh };
}
