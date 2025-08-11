"use client";

import { useEffect, Suspense } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/trpc/react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { toast as sonnerToast } from "sonner";

// Import the Zod schema for settings
import { settingsSchema, type SettingsInput } from "@/lib/schemas/settings.schema";

// Import UserRole for admin check and role assignment
import { UserRole } from "@/lib/auth"; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageBanner, BannerTitle } from "@/components/ui/page-banner";
import { CustomerLanguage } from "@prisma/client";

// Schema for profile update (including language preference)
const profileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  firstName: z.string().min(1, "First name is required").optional(),
  preferredLanguage: z.nativeEnum(CustomerLanguage).optional(),
});
type ProfileUpdateValues = z.infer<typeof profileUpdateSchema>;

// Schema for password change
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").optional(),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"], 
});
type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;

// New Zod schema for the Create User form
const createUserFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().optional(),
  firstName: z.string().optional(),
  role: z.nativeEnum(UserRole),
});
type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

function SettingsPageContent() {
  // Use session hook directly
  const { data: session, status, update: updateSession } = useSession();
  
  const utils = api.useUtils();

  // Settings Form for Company/Finvoice details
  const settingsForm = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      companyName: "",
      vatId: "",
      domicile: "",
      streetAddress: "",
      postalCode: "",
      city: "",
      countryCode: "",
      countryName: "",
      bankAccountIBAN: "",
      bankAccountBIC: "",
      website: "",
      sellerIdentifier: "",
      sellerIntermediatorAddress: "",
      bankName: "",
    },
  });

  // Profile Form
  const profileForm = useForm<ProfileUpdateValues>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      name: ' ',
      firstName: ' ',
    },
  });

  // Password Form
  const passwordForm = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: ' ',
      newPassword: ' ',
      confirmPassword: ' ',
    },
  });

  // New form for Create User
  const createUserForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      email: "",
      name: "",
      firstName: "",
      role: UserRole.user,
    },
  });

  const { 
    data: currentSettings, 
    isLoading: isLoadingSettings, 
    error: settingsError
  } = api.settings.get.useQuery(
    undefined, 
    {
      enabled: status === 'authenticated',
    }
  );

  const updateSettingsMutation = api.settings.update.useMutation({
    onSuccess: () => {
      sonnerToast.success('Company settings updated successfully!');
      utils.settings.get.invalidate();
    },
    onError: (error) => {
      sonnerToast.error(`Company settings update failed: ${error.message}`);
    },
  });

  const updateProfileMutation = api.user.updateProfile.useMutation({
    onSuccess: async (updatedUser) => {
      sonnerToast.success('Profile updated successfully!');
      await updateSession({ 
        name: updatedUser.name, 
        firstName: updatedUser.firstName,
        preferredLanguage: updatedUser.preferredLanguage,
      }); 
      profileForm.reset({ 
        name: updatedUser.name ?? '', 
        firstName: updatedUser.firstName ?? '',
        preferredLanguage: updatedUser.preferredLanguage ?? CustomerLanguage.FI,
      }); 
    },
    onError: (error) => {
      sonnerToast.error(`Profile update failed: ${error.message}`);
    },
  });

  const changePasswordMutation = api.user.changePassword.useMutation({
    onSuccess: () => {
      sonnerToast.success('Password changed successfully!');
      passwordForm.reset();
    },
    onError: (error) => {
      sonnerToast.error(`Password change failed: ${error.message}`);
    },
  });

  const createUserMutation = api.user.createUserInActiveCompany.useMutation({
    onSuccess: (data) => {
      sonnerToast.success(`User ${data.email} created successfully!`);
      createUserForm.reset();
      // Potentially invalidate a user list query if one exists elsewhere
    },
    onError: (error) => {
      sonnerToast.error(`Failed to create user: ${error.message}`);
    },
  });

  // Debug logging to help identify session issues
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Settings Debug] Session status:', status);
      console.log('[Settings Debug] Session data:', session);
      console.log('[Settings Debug] Session user:', session?.user);
      console.log('[Settings Debug] Session type:', typeof session);
      console.log('[Settings Debug] Session keys:', session ? Object.keys(session) : 'No session');
      console.log('[Settings Debug] useSession hook result:', { data: session, status, update: !!updateSession });
      console.log('[Settings Debug] Component render timestamp:', new Date().toISOString());
    }
  }, [session, status, updateSession]);

  useEffect(() => {
    if (currentSettings) {
      const defaultValuesFromData = {
        companyName: currentSettings.companyName ?? "",
        vatId: currentSettings.vatId ?? "",
        domicile: currentSettings.domicile ?? "",
        streetAddress: currentSettings.streetAddress ?? "",
        postalCode: currentSettings.postalCode ?? "",
        city: currentSettings.city ?? "",
        countryCode: currentSettings.countryCode ?? "",
        countryName: currentSettings.countryName ?? "",
        bankAccountIBAN: currentSettings.bankAccountIBAN ?? "",
        bankAccountBIC: currentSettings.bankAccountBIC ?? "",
        website: currentSettings.website ?? "",
        sellerIdentifier: currentSettings.sellerIdentifier ?? "",
        sellerIntermediatorAddress: currentSettings.sellerIntermediatorAddress ?? "",
        bankName: currentSettings.bankName ?? "",
        defaultInvoicePaymentTermsDays: currentSettings.defaultInvoicePaymentTermsDays ?? null,
        defaultVatRatePercent: (() => {
          try {
            if (currentSettings.defaultVatRatePercent && typeof currentSettings.defaultVatRatePercent === 'object' && 'toNumber' in currentSettings.defaultVatRatePercent) {
              return currentSettings.defaultVatRatePercent.toNumber();
            } else if (typeof currentSettings.defaultVatRatePercent === 'number') {
              return currentSettings.defaultVatRatePercent;
            }
            return null;
          } catch (error) {
            console.warn('Error converting defaultVatRatePercent:', error);
            return null;
          }
        })(),
      };
      settingsForm.reset(defaultValuesFromData);
    } else if (!isLoadingSettings && status === 'authenticated' && !currentSettings && !settingsError) {
      // If no settings exist, reset form to empty values
      settingsForm.reset({
        companyName: "",
        vatId: "",
        domicile: "",
        streetAddress: "",
        postalCode: "",
        city: "",
        countryCode: "FI", // Default to Finland
        countryName: "Finland", // Default to Finland
        bankAccountIBAN: "",
        bankAccountBIC: "",
        website: "",
        sellerIdentifier: "",
        sellerIntermediatorAddress: "",
        bankName: "",
        defaultInvoicePaymentTermsDays: 30, // Default to 30 days
        defaultVatRatePercent: null,
      });
    }
  }, [currentSettings, settingsForm, isLoadingSettings, status, settingsError]);

  useEffect(() => {
    if (settingsError) {
      sonnerToast.error(`Failed to load company settings: ${settingsError.message}`);
    }
  }, [settingsError]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
     profileForm.reset({
       name: session.user.name ?? ' ',
       firstName: session.user.firstName ?? ' ',
       preferredLanguage: session.user.preferredLanguage ?? CustomerLanguage.FI,
     });
    }
  }, [status, session, profileForm]);

  const onSettingsSubmit: SubmitHandler<SettingsInput> = (data) => {
    updateSettingsMutation.mutate(data);
  };

  const onProfileSubmit: SubmitHandler<ProfileUpdateValues> = (data) => {
    updateProfileMutation.mutate(data);
  };

  const onPasswordSubmit: SubmitHandler<PasswordChangeValues> = (data) => {
    const needsCurrentPassword = session?.user && true; 

    if (needsCurrentPassword && !data.currentPassword) {
       passwordForm.setError("currentPassword", { type: "manual", message: "Current password is required to change." });
       return;
    }
    changePasswordMutation.mutate(data);
  };

  const onCreateUserSubmit: SubmitHandler<CreateUserFormValues> = (data) => {
    createUserMutation.mutate(data);
  };

  // Enhanced error handling for session issues
  if (status === 'loading') {
    console.log('[Settings Debug] Status is loading, showing skeleton');
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-8 w-1/4" />
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
          <CardFooter><Skeleton className="h-10 w-24 ml-auto" /></CardFooter>
        </Card>
         <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
             <Skeleton className="h-10 w-full" />
          </CardContent>
          <CardFooter><Skeleton className="h-10 w-24 ml-auto" /></CardFooter>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
             <Skeleton className="h-10 w-full" />
          </CardContent>
          <CardFooter><Skeleton className="h-10 w-24 ml-auto" /></CardFooter>
        </Card>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    console.log('[Settings Debug] Status is unauthenticated');
    return (
      <div className="w-full space-y-6">
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Authentication Error</AlertTitle>
          <AlertDescription>
            You are not authenticated. Please sign in to access the settings page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Additional safety check for session data
  if (!session || !session.user) {
    console.log('[Settings Debug] No session or session.user, showing error');
    return (
      <div className="w-full space-y-6">
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Session Error</AlertTitle>
          <AlertDescription>
            Session data is missing or invalid. Please try refreshing the page or signing in again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show loading state while settings are being fetched
  if (isLoadingSettings) {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-8 w-1/4" />
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
          <CardFooter><Skeleton className="h-10 w-24 ml-auto" /></CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageBanner>
        <BannerTitle>Settings</BannerTitle>
      </PageBanner>

      {/* Profile Update Form */}
      <Card>
         <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="grid gap-2">
                <Label htmlFor="firstName">First Name</Label>
                 <Input
                    id="firstName"
                    {...profileForm.register('firstName')}
                    disabled={updateProfileMutation.isPending}
                 />
                 {profileForm.formState.errors.firstName && (
                   <p className="text-sm text-destructive">{profileForm.formState.errors.firstName.message}</p>
                 )}
             </div>
             <div className="grid gap-2">
                <Label htmlFor="name">Last Name / Display Name</Label>
                 <Input
                    id="name"
                    {...profileForm.register('name')}
                    disabled={updateProfileMutation.isPending}
                 />
                 {profileForm.formState.errors.name && (
                   <p className="text-sm text-destructive">{profileForm.formState.errors.name.message}</p>
                 )}
             </div>
             <div className="grid gap-2">
                <Label htmlFor="preferredLanguage">Preferred Language</Label>
                <Select 
                  value={profileForm.watch('preferredLanguage') || CustomerLanguage.FI}
                  onValueChange={(value) => profileForm.setValue('preferredLanguage', value as CustomerLanguage)}
                  disabled={updateProfileMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CustomerLanguage.FI}>Finnish (Suomi)</SelectItem>
                    <SelectItem value={CustomerLanguage.EN}>English</SelectItem>
                    <SelectItem value={CustomerLanguage.SE}>Swedish (Svenska)</SelectItem>
                  </SelectContent>
                </Select>
                {profileForm.formState.errors.preferredLanguage && (
                  <p className="text-sm text-destructive">{profileForm.formState.errors.preferredLanguage.message}</p>
                )}
              </div>
          </CardContent>
          <CardFooter>
             <Button type="submit" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
             </Button>
          </CardFooter>
         </form>
      </Card>

      {/* Password Change Form */}
      <Card>
         <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Change your password. Requires current password if already set.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {true && ( 
               <div className="grid gap-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                     id="currentPassword"
                     type="password"
                     {...passwordForm.register('currentPassword')}
                     disabled={changePasswordMutation.isPending}
                  />
                  {passwordForm.formState.errors.currentPassword && (
                     <p className="text-sm text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
                  )}
               </div>
            )}
             <div className="grid gap-2">
                <Label htmlFor="newPassword">New Password</Label>
                 <Input
                    id="newPassword"
                    type="password"
                    {...passwordForm.register('newPassword')}
                    disabled={changePasswordMutation.isPending}
                 />
                 {passwordForm.formState.errors.newPassword && (
                   <p className="text-sm text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
                 )}
             </div>
             <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                 <Input
                    id="confirmPassword"
                    type="password"
                    {...passwordForm.register('confirmPassword')}
                    disabled={changePasswordMutation.isPending}
                 />
                 {passwordForm.formState.errors.confirmPassword && (
                   <p className="text-sm text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
                 )}
             </div>
          </CardContent>
          <CardFooter>
             <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
             </Button>
          </CardFooter>
         </form>
      </Card>

      {/* Company Settings Form */}
      {!isLoadingSettings && !currentSettings && status === 'authenticated' && (
        <Alert variant="default" className="mb-6">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Company Settings Not Configured</AlertTitle>
          <AlertDescription>
            It looks like the company settings have not been configured yet. 
            You can fill out the form below and save to create the initial settings.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)}>
          <CardHeader>
            <CardTitle>Company & Finvoice Settings</CardTitle>
            <CardDescription>Manage your company details for invoicing and Finvoice export.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Company Name */}
            <div className="grid gap-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input id="companyName" {...settingsForm.register('companyName')} disabled={updateSettingsMutation.isPending} />
              {settingsForm.formState.errors.companyName && <p className="text-sm text-destructive">{settingsForm.formState.errors.companyName.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="vatId">VAT ID *</Label>
                <Input id="vatId" {...settingsForm.register('vatId')} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.vatId && <p className="text-sm text-destructive">{settingsForm.formState.errors.vatId.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="domicile">Domicile (Kotipaikka)</Label>
                <Input id="domicile" {...settingsForm.register('domicile')} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.domicile && <p className="text-sm text-destructive">{settingsForm.formState.errors.domicile.message}</p>}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="streetAddress">Street Address *</Label>
              <Input id="streetAddress" {...settingsForm.register('streetAddress')} disabled={updateSettingsMutation.isPending} />
              {settingsForm.formState.errors.streetAddress && <p className="text-sm text-destructive">{settingsForm.formState.errors.streetAddress.message}</p>}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="postalCode">Postal Code *</Label>
                <Input id="postalCode" {...settingsForm.register('postalCode')} disabled={updateSettingsMutation.isPending} />
                    {settingsForm.formState.errors.postalCode && <p className="text-sm text-destructive">{settingsForm.formState.errors.postalCode.message}</p>}
                </div>
              <div className="grid gap-2">
                <Label htmlFor="city">City *</Label>
                <Input id="city" {...settingsForm.register('city')} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.city && <p className="text-sm text-destructive">{settingsForm.formState.errors.city.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                    <Label htmlFor="countryCode">Country Code *</Label>
                    <Input id="countryCode" {...settingsForm.register('countryCode')} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.countryCode && <p className="text-sm text-destructive">{settingsForm.formState.errors.countryCode.message}</p>}
              </div>
              <div className="grid gap-2">
                    <Label htmlFor="countryName">Country Name</Label>
                    <Input id="countryName" {...settingsForm.register('countryName')} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.countryName && <p className="text-sm text-destructive">{settingsForm.formState.errors.countryName.message}</p>}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bankAccountIBAN">Bank Account IBAN *</Label>
                    <Input id="bankAccountIBAN" {...settingsForm.register('bankAccountIBAN')} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.bankAccountIBAN && <p className="text-sm text-destructive">{settingsForm.formState.errors.bankAccountIBAN.message}</p>}
              </div>
              <div className="grid gap-2">
                    <Label htmlFor="bankAccountBIC">Bank Account BIC *</Label>
                    <Input id="bankAccountBIC" {...settingsForm.register('bankAccountBIC')} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.bankAccountBIC && <p className="text-sm text-destructive">{settingsForm.formState.errors.bankAccountBIC.message}</p>}
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="bankName">Bank Name</Label>
                    <Input id="bankName" {...settingsForm.register('bankName')} disabled={updateSettingsMutation.isPending} />
              {settingsForm.formState.errors.bankName && <p className="text-sm text-destructive">{settingsForm.formState.errors.bankName.message}</p>}
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="website">Website URL</Label>
                    <Input id="website" {...settingsForm.register('website')} disabled={updateSettingsMutation.isPending} />
                    {settingsForm.formState.errors.website && <p className="text-sm text-destructive">{settingsForm.formState.errors.website.message}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="grid gap-2">
                    <Label htmlFor="sellerIdentifier">Seller Identifier (OVT)</Label>
                    <Input id="sellerIdentifier" {...settingsForm.register('sellerIdentifier')} disabled={updateSettingsMutation.isPending} />
                    {settingsForm.formState.errors.sellerIdentifier && <p className="text-sm text-destructive">{settingsForm.formState.errors.sellerIdentifier.message}</p>}
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="sellerIntermediatorAddress">Seller Intermediator Address</Label>
                    <Input id="sellerIntermediatorAddress" {...settingsForm.register('sellerIntermediatorAddress')} disabled={updateSettingsMutation.isPending} />
                    {settingsForm.formState.errors.sellerIntermediatorAddress && <p className="text-sm text-destructive">{settingsForm.formState.errors.sellerIntermediatorAddress.message}</p>}
                </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="defaultInvoicePaymentTermsDays">Default Invoice Payment Terms (Days)</Label>
                <Input type="number" id="defaultInvoicePaymentTermsDays" {...settingsForm.register('defaultInvoicePaymentTermsDays', { valueAsNumber: true })} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.defaultInvoicePaymentTermsDays && <p className="text-sm text-destructive">{settingsForm.formState.errors.defaultInvoicePaymentTermsDays.message}</p>}
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="ml-auto" 
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? "Saving Settings..." : "Save Settings"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Create New User Form (Visible to Admins Only) */}
      {session?.user?.role === UserRole.admin && (
        <Card>
          <form onSubmit={createUserForm.handleSubmit(onCreateUserSubmit)}>
            <CardHeader>
              <CardTitle>Create New User</CardTitle>
              <CardDescription>
                Create a new user account. They will be associated with your currently active company.
                An initial password will not be set; the user will need to use the &quot;Forgot Password&quot; flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={createUserForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="user@example.com" {...field} disabled={createUserMutation.isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createUserForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} disabled={createUserMutation.isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createUserForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} disabled={createUserMutation.isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Global Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={createUserMutation.isPending}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={UserRole.user}>User</SelectItem>
                        <SelectItem value={UserRole.admin}>Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" className="ml-auto" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading settings...</div>}>
        <SettingsPageContent />
    </Suspense>
  );
} 