"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import React, { Suspense } from "react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");

  const errorMessages: Record<string, string> = {
    default: "An error occurred during authentication",
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The verification token has expired or has already been used.",
    "CredentialsSignin": "Invalid email or password.",
  };

  const message = error ? errorMessages[error] || errorMessages.default : errorMessages.default;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto max-w-sm space-y-6 rounded-lg border p-6 shadow-lg text-center">
        <h1 className="text-2xl font-bold text-destructive">Authentication Error</h1>
        <p className="text-muted-foreground">{message}</p>
        <div className="space-y-4">
          <Button asChild className="w-full">
            <Link href="/auth/signin">Try Again</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div>Loading error information...</div>}>
      <AuthErrorContent />
    </Suspense>
  );
}
