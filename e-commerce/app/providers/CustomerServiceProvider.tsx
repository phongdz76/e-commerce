"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { API_PATHS } from "@/utils/apiPaths";
import type { ServicePublication } from "@/types/customerService";
const Context = createContext<{ publication: ServicePublication | null; error: boolean; loading: boolean }>({ publication: null, error: false, loading: true });
export const useCustomerService = () => useContext(Context);
export default function CustomerServiceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(), [publication, setPublication] = useState<ServicePublication | null>(null), [error, setError] = useState(false), [loading, setLoading] = useState(true);
  const generation = useRef(0), fetching = useRef(false);
  const invalidate = useCallback(() => { generation.current++; fetching.current = false; }, []);
  const load = useCallback(async () => { if (fetching.current) return; fetching.current = true; const request = ++generation.current; try { const response = await fetch(API_PATHS.CUSTOMER_SERVICE, { cache: "no-store", signal: AbortSignal.timeout(15000) }); if (!response.ok) throw Error(); const data: ServicePublication = await response.json(); if (request === generation.current) { setPublication(data); setError(false); } } catch { if (request === generation.current) setError(true); } finally { if (request === generation.current) { fetching.current = false; setLoading(false); } } }, []);
  useEffect(() => { void Promise.resolve().then(load); const refresh = () => { if (!document.hidden) void load(); }; const timer = setInterval(refresh, 60000); window.addEventListener("sgtech-service-published", refresh); document.addEventListener("visibilitychange", refresh); return () => { invalidate(); clearInterval(timer); window.removeEventListener("sgtech-service-published", refresh); document.removeEventListener("visibilitychange", refresh); }; }, [load, invalidate, pathname]);
  return <Context.Provider value={{ publication, error, loading }}>{children}</Context.Provider>;
}
