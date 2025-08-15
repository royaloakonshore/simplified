import React from "react";
import "@/app/globals.css";
// import "react-toastify/dist/ReactToastify.css"; // Remove react-toastify CSS
import { TRPCReactProvider } from "@/lib/trpc/react";
import { Metadata } from "next";
import ClientProvider from "@/components/ClientProvider";
// import { ThemeAwareToast } from "@/components/theme/ThemeAwareToast"; // Remove old Toaster
import { Toaster } from "@/components/ui/sonner"; // Import Sonner Toaster
import { cookies } from 'next/headers';
import { getServerAuthSession } from "@/lib/auth";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { GlobalLoadingIndicator } from "@/components/common/GlobalLoadingIndicator";

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

  // Get the session at the root level
  const session = await getServerAuthSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <TRPCReactProvider cookies={cookieString}>
          <AuthProvider session={session}>
            <ClientProvider>
              {/* <ThemeAwareToast /> */}
              {children}
              <GlobalLoadingIndicator />
              <Toaster richColors closeButton /> {/* Add Sonner Toaster here */}
            </ClientProvider>
          </AuthProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
