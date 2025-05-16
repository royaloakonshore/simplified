"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";

export default function LogoutPage() { // Renamed from SignOutPage
  useEffect(() => {
    console.log("[LogoutPage] EFFECT TRIGGERED. Attempting signOut()...");
    signOut({ redirect: false }) // Keep redirect false for now
      .then((result) => {
        console.log("[LogoutPage] signOut() promise resolved:", result);
        window.location.href = "/auth/signin"; // Manually redirect
      })
      .catch((error) => {
        console.error("[LogoutPage] signOut() promise rejected:", error);
        // window.location.href = "/auth/signin?error=logout_failed";
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Processing logout...</p>
    </div>
  );
} 