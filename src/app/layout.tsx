import React from "react";
import "@/app/globals.css";
import "react-toastify/dist/ReactToastify.css";
import { TRPCReactProvider } from "@/lib/trpc/react";
import { Metadata } from "next";
import ClientProvider from "@/components/ClientProvider";
import { ThemeAwareToast } from "@/components/theme/ThemeAwareToast";

export const metadata: Metadata = {
  title: "Simplified ERP",
  description: "A modern ERP system for small to medium-sized businesses",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClientProvider>
          <TRPCReactProvider>
            {children}
            <ThemeAwareToast />
          </TRPCReactProvider>
        </ClientProvider>
      </body>
    </html>
  );
}
