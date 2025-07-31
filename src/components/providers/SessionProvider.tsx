"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { type Session } from "next-auth";
import React, { createContext, useContext, ReactNode } from "react";

// Extended session context for better performance
interface ExtendedSessionContextType {
  session: Session | null;
  status: "loading" | "authenticated" | "unauthenticated";
}

const ExtendedSessionContext = createContext<ExtendedSessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
  session?: Session | null;
}

export function SessionProvider({ children, session }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider 
      session={session}
      // Reduce refetch frequency to improve performance
      refetchInterval={5 * 60} // 5 minutes instead of default 1 minute
      refetchOnWindowFocus={false} // Disable refetch on window focus
      refetchWhenOffline={false} // Disable refetch when offline
    >
      {children}
    </NextAuthSessionProvider>
  );
}

// Custom hook for optimized session usage
export function useOptimizedSession() {
  const context = useContext(ExtendedSessionContext);
  if (context === undefined) {
    throw new Error('useOptimizedSession must be used within a SessionProvider');
  }
  return context;
}
