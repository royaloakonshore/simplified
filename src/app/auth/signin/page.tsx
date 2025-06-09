"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoginForm } from "@/components/login-form"; // Import the new LoginForm
import { Skeleton } from "@/components/ui/skeleton"; // Keep Skeleton for fallback
import { BackgroundPaths } from "@/components/ui/background-paths";
import { ModeToggle } from "@/components/theme/ModeToggle";

// This component contains the actual sign-in logic and state
function SignInPageClientContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/dashboard";
  
  // Extract error from URL query params, which NextAuth.js might add on redirect
  const urlError = searchParams?.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isCredentialsLoading, setIsCredentialsLoading] = useState(false);

  // Combine URL error with any potential direct error messages for display
  // This ensures errors passed via URL (e.g. OAuth errors) are shown
  const displayError = urlError ? 
    (urlError === "OAuthAccountNotLinked" ? "This email is already linked with another provider." : 
     urlError === "CredentialsSignin" ? "Invalid email or password." :
     `Authentication Error: ${urlError}`) 
    : null;

  const handleEmailSignIn = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsEmailLoading(true);
    if (!email) {
      toast.info("Please enter your email address.");
      setIsEmailLoading(false);
      return;
    }
    try {
      const res = await signIn("email", {
        email: email,
        redirect: false, 
        callbackUrl: callbackUrl,
      });

      if (res?.error) {
        toast.error(`Email Sign-In Error: ${res.error}`);
      } else if (res?.ok) {
        toast.success("Check your email for a sign-in link!");
        // Optionally, redirect to a page like /auth/verify-request
        // router.push("/auth/verify-request"); 
      } else {
         toast.error("An unknown error occurred during email sign-in.");
      }
    } catch (err) {
       toast.error("An unexpected error occurred while trying to send the email link.");
       console.error("Email sign-in catch:", err);
    } finally {
       setIsEmailLoading(false);
    }
  };

  const handleCredentialsSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCredentialsLoading(true);
    if (!email || !password) {
      toast.info("Please enter both email and password.");
      setIsCredentialsLoading(false);
      return;
    }
     try {
        const res = await signIn("credentials", {
            email: email,
            password: password,
            redirect: false, 
            callbackUrl: callbackUrl,
        });

        if (res?.error) {
            if (res.error === "CredentialsSignin") {
               toast.error("Invalid email or password.");
            } else {
               toast.error(`Login Error: ${res.error}`);
            }
        } else if (res?.ok) {
             router.push(callbackUrl);
             router.refresh(); 
        } else {
           toast.error("An unknown error occurred during login.");
        }
     } catch (err) {
        toast.error("An unexpected error occurred during login.");
        console.error("Credentials sign-in catch:", err);
     } finally {
        setIsCredentialsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Theme Toggle Button - Fixed to page upper right corner */}
      <div 
        className="fixed z-50" 
        style={{ 
          top: '1rem', 
          right: '1rem' 
        }}
      >
        <ModeToggle />
      </div>

      <BackgroundPaths title="Simplified ERP">
        <LoginForm 
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          isCredentialsLoading={isCredentialsLoading}
          isEmailLoading={isEmailLoading}
          handleCredentialsSignIn={handleCredentialsSignIn}
          handleEmailSignIn={handleEmailSignIn}
          error={displayError} // Pass the error to be displayed by LoginForm
          appName="Simplified ERP" // Customize app name
        />
      </BackgroundPaths>
    </div>
  );
}

// Skeleton for the new layout (can be simpler or more detailed)
function SignInPageSkeleton() {
  return (
    <div className="relative min-h-screen">
      {/* Theme Toggle Button - Fixed to page upper right corner */}
      <div 
        className="fixed z-50" 
        style={{ 
          top: '1rem', 
          right: '1rem' 
        }}
      >
        <ModeToggle />
      </div>

      <BackgroundPaths title="Simplified ERP">
        <div className="flex flex-col gap-6">
          <div className="overflow-hidden shadow-lg rounded-lg"> {/* Mimic Card */}
            <div className="grid p-0 md:grid-cols-2">
              {/* Form Side Skeleton */}
              <div className="p-6 md:p-8">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col items-center text-center">
                    <Skeleton className="h-7 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-12"/>
                    <Skeleton className="h-10 w-full"/>
                  </div>
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-16"/>
                    <Skeleton className="h-10 w-full"/>
                  </div>
                  <Skeleton className="h-10 w-full mt-2"/> {/* Credentials Sign In Button */}
                  <div className="h-8 mt-2"></div> {/* Spacer for separator */}
                  <Skeleton className="h-10 w-full"/> {/* Email Sign In Button */}
                </div>
              </div>
              {/* Image Side Skeleton (hidden on md) */}
              <div className="relative hidden bg-muted md:block dark:bg-neutral-800">
                 <Skeleton className="absolute inset-0 h-full w-full" />
              </div>
            </div>
          </div>
        </div>
      </BackgroundPaths>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInPageSkeleton />}>
      <SignInPageClientContent />
    </Suspense>
  );
}
