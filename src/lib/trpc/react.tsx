"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  loggerLink,
  httpBatchLink,
  createWSClient,
  wsLink,
  splitLink,
} from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState, useCallback, useMemo } from "react";
import SuperJSON from "superjson";
import React from "react";

import { type AppRouter } from "@/lib/api/root";

// Enhanced QueryClient configuration for better performance
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes - data stays fresh longer
      gcTime: 10 * 60 * 1000,          // 10 minutes - cache kept longer in background (renamed from cacheTime)
      refetchOnWindowFocus: false,      // Prevent excessive refetching
      refetchOnReconnect: true,         // Refetch when connection restored
      refetchOnMount: true,             // Refetch on component mount
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors, but retry on network errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 2; // Retry max 2 times
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false, // Don't retry mutations by default
      onError: (error: any) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  }
  // Browser: use singleton pattern to keep the same query client
  return (clientQueryClientSingleton ??= createQueryClient());
};

export const api = createTRPCReact<AppRouter>();

/**
 * Custom hook for intelligent cache invalidation
 * Reduces unnecessary refetches by only invalidating related queries
 */
export function useOptimizedMutations() {
  const utils = api.useUtils();

  // Customer operations
  const invalidateCustomerData = useCallback((customerId?: string) => {
    utils.customer.list.invalidate();
    if (customerId) {
      try {
        (utils.customer as any).getById?.invalidate({ id: customerId });
      } catch (e) {
        // Silently handle if getById doesn't exist
      }
    }
    // Only invalidate dashboard stats if needed (avoid excessive refetching)
    setTimeout(() => {
      utils.dashboard.getStats.invalidate();
    }, 500);
  }, [utils]);

  // Order operations  
  const invalidateOrderData = useCallback((orderId?: string, skipDashboard = false) => {
    utils.order.list.invalidate();
    if (orderId) {
      try {
        (utils.order as any).getById?.invalidate({ id: orderId });
      } catch (e) {
        // Silently handle if getById doesn't exist
      }
    }
    
    // Only invalidate heavy dashboard queries after a delay
    if (!skipDashboard) {
      setTimeout(() => {
        utils.dashboard.getStats.invalidate();
        utils.dashboard.getRecentOrders.invalidate();
      }, 1000);
    }
  }, [utils]);

  // Invoice operations
  const invalidateInvoiceData = useCallback((invoiceId?: string, skipDashboard = false) => {
    utils.invoice.list.invalidate();
    if (invoiceId) {
      try {
        (utils.invoice as any).getById?.invalidate({ id: invoiceId });
      } catch (e) {
        // Silently handle if getById doesn't exist
      }
    }
    
    // Only invalidate heavy dashboard queries after a delay  
    if (!skipDashboard) {
      setTimeout(() => {
        utils.dashboard.getStats.invalidate();
      }, 1000);
    }
  }, [utils]);

  // Inventory operations
  const invalidateInventoryData = useCallback((itemId?: string, skipAlerts = false) => {
    utils.inventory.list.invalidate();
    if (itemId) {
      try {
        (utils.inventory as any).getById?.invalidate({ id: itemId });
      } catch (e) {
        // Silently handle if getById doesn't exist
      }
    }
    
    // Only invalidate alerts if stock levels might have changed
    if (!skipAlerts) {
      setTimeout(() => {
        utils.inventory.getReplenishmentAlerts.invalidate();
      }, 500);
    }
  }, [utils]);

  // BOM operations
  const invalidateBOMData = useCallback((bomId?: string) => {
    utils.bom.list.invalidate();
    if (bomId) {
      try {
        (utils.bom as any).getById?.invalidate({ id: bomId });
      } catch (e) {
        // Silently handle if getById doesn't exist
      }
    }
  }, [utils]);

  return useMemo(() => ({
    invalidateCustomerData,
    invalidateOrderData, 
    invalidateInvoiceData,
    invalidateInventoryData,
    invalidateBOMData,
  }), [
    invalidateCustomerData,
    invalidateOrderData,
    invalidateInvoiceData, 
    invalidateInventoryData,
    invalidateBOMData,
  ]);
}

// create persistent WebSocket connection
const wsClient =
  typeof window !== "undefined"
    ? createWSClient({
        url:
          process.env.NODE_ENV === "development"
            ? "ws://localhost:3001"
            : `wss://${window.location.host}`,
      })
    : undefined;

export function TRPCReactProvider(props: { children: React.ReactNode, cookies: string }) {
  // Use the optimized query client
  const [queryClient] = React.useState(() => createQueryClient());
  const [trpcClient] = React.useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        (() => {
          if (typeof window === 'undefined') {
            // Server-side rendering or RSC
            return httpBatchLink({
              url: getBaseUrl() + "/api/trpc",
              headers() {
                return {
                  cookie: props.cookies,
                  "x-trpc-source": "rsc",
                };
              },
              transformer: SuperJSON,
            });
          }
          // Client-side rendering
          const wsClient = createWSClient({
            url: getWSBaseUrl() + "/api/trpc",
          });
          return splitLink({
            condition: (op) => op.type === 'subscription',
            true: wsLink({
              client: wsClient,
              transformer: SuperJSON,
            }),
            false: httpBatchLink({
              url: getBaseUrl() + "/api/trpc",
              // Enhanced batching configuration
              maxURLLength: 2000,
              headers() {
                return {
                  "x-trpc-source": "nextjs-react",
                };
              },
              transformer: SuperJSON,
            }),
          });
        })(),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

function getWSBaseUrl() {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}`;
  }
  return "ws://localhost:3001";
}
