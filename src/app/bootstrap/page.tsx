"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BootstrapForm } from "@/components/bootstrap/BootstrapForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface BootstrapStatus {
  needsBootstrap: boolean;
  userCount: number;
  companyCount: number;
}

export default function BootstrapPage() {
  const router = useRouter();
  const [status, setStatus] = useState<BootstrapStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkBootstrapStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch("/api/bootstrap");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to check bootstrap status");
      }

      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkBootstrapStatus();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Checking system status...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={checkBootstrapStatus} className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!status?.needsBootstrap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-green-600">System Already Initialized</CardTitle>
            <CardDescription>
              The system has already been set up with {status?.userCount} user(s) and {status?.companyCount} company/companies.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Bootstrap is only available for empty databases.
            </p>
            <div className="space-y-2">
              <Button onClick={() => router.push("/auth/signin")} className="w-full">
                Go to Login
              </Button>
              <Button 
                onClick={() => router.push("/")} 
                variant="outline" 
                className="w-full"
              >
                Go to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <BootstrapForm onSuccess={checkBootstrapStatus} />
    </div>
  );
} 