import React from "react";
import "@/app/globals.css";
import "react-toastify/dist/ReactToastify.css";
import { TRPCReactProvider } from "@/lib/trpc/react";
import { Metadata } from "next";
import ClientProvider from "@/components/ClientProvider";
import { ThemeAwareToast } from "@/components/theme/ThemeAwareToast";

export const metadata: Metadata = {
  title: "Simplified ERP - Base Test",
  description: "Minimal root layout test",
  // Optionally, keep icons if not suspect, or remove for extreme minimality
  // icons: {
  //   icon: "/favicon.ico",
  // },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <TRPCReactProvider>
          <ClientProvider>
            <ThemeAwareToast />
            {children}
          </ClientProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
