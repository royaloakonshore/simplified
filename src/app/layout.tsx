import React from "react";
import "@/app/globals.css";
// import "react-toastify/dist/ReactToastify.css"; // Remove react-toastify CSS
import { TRPCReactProvider } from "@/lib/trpc/react";
import { Metadata } from "next";
import ClientProvider from "@/components/ClientProvider";
// import { ThemeAwareToast } from "@/components/theme/ThemeAwareToast"; // Remove old Toaster
import { Toaster } from "@/components/ui/sonner"; // Import Sonner Toaster
import { cookies } from 'next/headers';

export const metadata: Metadata = {
      title: "Gerby - Base Test",
  description: "Minimal root layout test",
  // Optionally, keep icons if not suspect, or remove for extreme minimality
  // icons: {
  //   icon: "/favicon.ico",
  // },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieJar = cookies();
  const cookieString = Object.entries(cookieJar)
    .map(([name, value]) => `${name}=${typeof value === 'string' ? value : value.value}`)
    .join('; ');

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <TRPCReactProvider cookies={cookieString}>
          <ClientProvider>
            {/* <ThemeAwareToast /> */}
            {children}
            <Toaster richColors closeButton /> {/* Add Sonner Toaster here */}
          </ClientProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
