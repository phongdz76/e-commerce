"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { API_PATHS } from "@/utils/apiPaths";
import type { ServicePublication } from "@/types/customerService";

interface CustomerServiceContextValue {
  publication: ServicePublication | null;
  error: boolean;
  loading: boolean;
}

const CustomerServiceContext = createContext<CustomerServiceContextValue>({
  publication: null,
  error: false,
  loading: true,
});

export const useCustomerService = () => useContext(CustomerServiceContext);

export default function CustomerServiceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [publication, setPublication] = useState<ServicePublication | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetching = useRef(false);

  const loadService = useCallback(async () => {
    if (fetching.current) {
      return;
    }
    fetching.current = true;

    try {
      const response = await fetch(API_PATHS.CUSTOMER_SERVICE, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error("Failed to load customer service content");
      }

      const data: ServicePublication = await response.json();
      setPublication(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      fetching.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const fetchInitial = async () => {
      if (active) {
        await loadService();
      }
    };

    void fetchInitial();

    const handleRefresh = () => {
      if (!document.hidden && active) {
        void loadService();
      }
    };

    const timer = setInterval(handleRefresh, 60000);
    window.addEventListener("sgtech-service-published", handleRefresh);
    document.addEventListener("visibilitychange", handleRefresh);

    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("sgtech-service-published", handleRefresh);
      document.removeEventListener("visibilitychange", handleRefresh);
    };
  }, [loadService, pathname]);

  return (
    <CustomerServiceContext.Provider
      value={{
        publication,
        error,
        loading: isLoading,
      }}
    >
      {children}
    </CustomerServiceContext.Provider>
  );
}
