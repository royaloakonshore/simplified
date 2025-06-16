"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building, User, Mail, Lock, AlertCircle, CheckCircle } from "lucide-react";

interface BootstrapFormProps {
  onSuccess?: () => void;
}

export function BootstrapForm({ onSuccess }: BootstrapFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    adminEmail: "",
    adminPassword: "",
    adminName: "",
    companyName: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Bootstrap failed");
      }

      setSuccess(true);
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Redirect to login page after short delay
      setTimeout(() => {
        router.push("/auth/signin");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-green-600">Bootstrap Complete!</CardTitle>
          <CardDescription>
            Your admin user and company have been created successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Redirecting to login page...
          </p>
          <Button 
            onClick={() => router.push("/auth/signin")}
            className="w-full"
          >
            Go to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <Building className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle>System Bootstrap</CardTitle>
        <CardDescription>
          Create the first admin user and company to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Company Information */}
          <div className="space-y-2">
            <Label htmlFor="companyName" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Company Name
            </Label>
            <Input
              id="companyName"
              type="text"
              placeholder="Enter your company name"
              value={formData.companyName}
              onChange={(e) => handleInputChange("companyName", e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          {/* Admin User Information */}
          <div className="space-y-2">
            <Label htmlFor="adminName" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Admin Name
            </Label>
            <Input
              id="adminName"
              type="text"
              placeholder="Enter admin user full name"
              value={formData.adminName}
              onChange={(e) => handleInputChange("adminName", e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminEmail" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Admin Email
            </Label>
            <Input
              id="adminEmail"
              type="email"
              placeholder="Enter admin email address"
              value={formData.adminEmail}
              onChange={(e) => handleInputChange("adminEmail", e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminPassword" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Admin Password
            </Label>
            <Input
              id="adminPassword"
              type="password"
              placeholder="Enter admin password (min 8 characters)"
              value={formData.adminPassword}
              onChange={(e) => handleInputChange("adminPassword", e.target.value)}
              required
              minLength={8}
              disabled={isLoading}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? "Creating..." : "Bootstrap System"}
          </Button>

          <div className="text-xs text-muted-foreground text-center">
            This will create the first admin user and company. 
            This action is only available when the database is empty.
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 