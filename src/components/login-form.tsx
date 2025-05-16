"use client"; // Ensure this is a client component as it will handle form events

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import React from "react"; // Import React for types like React.FormEvent

// Define the props the LoginForm will accept
interface LoginFormProps extends React.HTMLAttributes<HTMLDivElement> {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  isCredentialsLoading: boolean;
  isEmailLoading: boolean;
  handleCredentialsSignIn: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  handleEmailSignIn: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void>; // Changed from FormEvent to MouseEvent for button
  error?: string | null; // To display auth errors
  appName?: string; // Optional app name for customization
}

export function LoginForm({
  className,
  email,
  setEmail,
  password,
  setPassword,
  isCredentialsLoading,
  isEmailLoading,
  handleCredentialsSignIn,
  handleEmailSignIn,
  error,
  appName = "your app", // Default app name
  ...props
}: LoginFormProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden shadow-lg"> {/* Added shadow for better appearance */}
        <CardContent className="grid p-0 md:grid-cols-2">
          {/* Form Section */}
          <form onSubmit={handleCredentialsSignIn} className="p-6 md:p-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-balance text-muted-foreground"> {/* Changed to muted-foreground */}
                  Login to your {appName} account
                </p>
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
                  {error === "CredentialsSignin"
                    ? "Invalid email or password."
                    : error === "EmailSignin"
                    ? "Could not send magic link. Try again."
                    : "An authentication error occurred."}
                </p>
              )}

              <div className="grid gap-2">
                <Label htmlFor="email-input">Email</Label> {/* Changed id to avoid conflict if multiple forms exist */}
                <Input
                  id="email-input"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isCredentialsLoading || isEmailLoading}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password-input">Password</Label> {/* Changed id */}
                  {/* 
                  <a
                    href="#" // TODO: Implement forgot password
                    className="ml-auto text-sm underline-offset-2 hover:underline"
                  >
                    Forgot your password?
                  </a>
                  */}
                </div>
                <Input
                  id="password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isCredentialsLoading || isEmailLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isCredentialsLoading || !email || !password}>
                {isCredentialsLoading ? "Signing In..." : "Sign in"}
              </Button>
              
              {/* Separator */}
              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-neutral-200 dark:after:border-neutral-800">
                <span className="relative z-10 bg-card px-2 text-muted-foreground"> {/* Changed bg to card, text to muted */}
                  Or continue with
                </span>
              </div>

              {/* Email Sign In Button */}
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleEmailSignIn} 
                disabled={isEmailLoading || !email}
              >
                {isEmailLoading ? "Sending Link..." : "Sign in with Email Link"}
              </Button>

              {/* Removed Social Login Buttons */}
              
              {/* Sign Up Link - TODO: Implement or remove */}
              {/* 
              <div className="text-center text-sm">
                Don&apos;t have an account?{\\" \\"}
                <a href="#" className="underline underline-offset-4">
                  Sign up
                </a>
              </div>
              */}
            </div>
          </form>

          {/* Image Section */}
          <div className="relative hidden bg-muted md:block dark:bg-neutral-800"> {/* Changed bg to muted */}
            {/* You can use a specific image for your app here */}
            {/* Using a generic placeholder for now. Consider aspect ratio and content. */}
            <img
              // TODO: Replace with a relevant, high-quality image for your application
              // src="/placeholder.svg" // Original placeholder
              // Using a more abstract placeholder from unDraw or similar could be good
              src="https://images.unsplash.com/photo-1593640408182-31c70c8268f5?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80"
              alt="Login illustration"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.7]" // Adjusted brightness
            />
          </div>
        </CardContent>
      </Card>
      {/* 
      <div className="text-balance text-center text-xs text-neutral-500 [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-neutral-900 dark:text-neutral-400 dark:hover:[&_a]:text-neutral-50">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{\\" \\"}
        and <a href="#">Privacy Policy</a>.
      </div>
      */}
    </div>
  )
}
