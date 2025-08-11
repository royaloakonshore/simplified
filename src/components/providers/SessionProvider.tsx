"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { type Session } from "next-auth";
import React from "react";

interface SessionProviderProps {
  children: React.ReactNode;
  session?: Session | null;
}

export function SessionProvider({ children, session }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider 
      session={session}
      // Optimize session handling to prevent conflicts
      refetchInterval={5 * 60} // 5 minutes instead of default 1 minute
      refetchOnWindowFocus={false} // Disable refetch on window focus
      refetchWhenOffline={false} // Disable refetch when offline
    >
      {children}
    </NextAuthSessionProvider>
  );
}
