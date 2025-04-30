"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "react-toastify";
import { Skeleton } from "@/components/ui/skeleton";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/dashboard";
  const error = searchParams?.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isCredentialsLoading, setIsCredentialsLoading] = useState(false);

  // Handle Email link sign-in
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEmailLoading(true);
    try {
      const res = await signIn("email", {
        email: email,
        redirect: false, // Prevent NextAuth default redirect
        callbackUrl: callbackUrl,
      });
      
      if (res?.error) {
        toast.error(`Email Sign-In Error: ${res.error}`);
      } else if (res?.ok) {
        // Redirect to a verification page or show message
        toast.success("Check your email for a sign-in link!");
        // router.push('/auth/verify-request'); // Optional: redirect to a page telling user to check email
      } else {
         toast.error("An unknown error occurred during email sign-in.");
      }
    } catch (err) {
       toast.error("An unexpected error occurred.");
       console.error(err);
    } finally {
       setIsEmailLoading(false);
    }
  };

  // Handle Credentials (email/password) sign-in
  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCredentialsLoading(true);
     try {
        const res = await signIn("credentials", {
            email: email,
            password: password,
            redirect: false, // Handle redirect manually
            callbackUrl: callbackUrl,
        });

        if (res?.error) {
            // Map common errors to user-friendly messages
            if (res.error === "CredentialsSignin") {
               toast.error("Invalid email or password.");
            } else {
               toast.error(`Login Error: ${res.error}`);
            }
        } else if (res?.ok) {
             // Successful sign-in, redirect
             router.push(callbackUrl);
             router.refresh(); // Refresh server components
        } else {
           toast.error("An unknown error occurred during login.");
        }
     } catch (err) {
        toast.error("An unexpected error occurred.");
        console.error(err);
     } finally {
        setIsCredentialsLoading(false);
     }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your email below to login or receive a magic link.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCredentialsSignIn}>
          <CardContent className="grid gap-4">
            {error && (
              <p className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
                {error === "CredentialsSignin" ? "Invalid email or password." : 
                 error === "EmailSignin" ? "Could not send magic link. Try again." :
                 "An authentication error occurred."}
              </p>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isEmailLoading || isCredentialsLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isEmailLoading || isCredentialsLoading} 
              />
            </div>
             <Button type="submit" className="w-full" disabled={isCredentialsLoading || !email || !password}>
               {isCredentialsLoading ? "Signing In..." : "Sign in with Password"}
             </Button>
          </CardContent>
        </form>
         <CardFooter className="flex flex-col gap-4">
            <div className="relative w-full">
               <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
               </div>
               <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                     Or continue with
                  </span>
               </div>
            </div>
             <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleEmailSignIn} 
                disabled={isEmailLoading || !email}
             >
              {isEmailLoading ? "Sending Link..." : "Sign in with Email Link"}
             </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Loading Skeleton for the form
function SignInSkeleton() {
  return (
     <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
           <CardHeader>
             <Skeleton className="h-7 w-1/4 mb-1" />
             <Skeleton className="h-4 w-3/4" />
           </CardHeader>
           <CardContent className="grid gap-4">
              <div className="grid gap-2">
                 <Skeleton className="h-4 w-12"/>
                 <Skeleton className="h-10 w-full"/>
              </div>
              <div className="grid gap-2">
                 <Skeleton className="h-4 w-16"/>
                 <Skeleton className="h-10 w-full"/>
              </div>
              <Skeleton className="h-10 w-full"/>
           </CardContent>
            <CardFooter className="flex flex-col gap-4">
               <Skeleton className="h-5 w-full"/>
               <Skeleton className="h-10 w-full"/>
           </CardFooter>
        </Card>
     </div>
  );
}

// New default export Server Component
export default function SignInPage() {
  // This outer component is a Server Component by default
  // We wrap the client component that uses useSearchParams in Suspense
  return (
    <Suspense fallback={<SignInSkeleton />}>
      <SignInForm />
    </Suspense>
  );
}
