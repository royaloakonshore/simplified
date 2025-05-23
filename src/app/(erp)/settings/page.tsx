"use client";

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/trpc/react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'react-toastify';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';

// Import the Zod schema for settings
import { settingsSchema, type SettingsInput } from "@/lib/schemas/settings.schema";

// Schema for profile update (excluding password initially)
const profileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  firstName: z.string().min(1, "First name is required").optional(),
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


export default function SettingsPage() {
  const { data: session, status, update: updateSession } = useSession();

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

  const { 
    data: currentSettings, 
    isLoading: isLoadingSettings, 
    refetch: refetchSettings, 
    error: settingsError
  } = api.settings.get.useQuery(
    undefined, 
    {
      enabled: status === 'authenticated',
    }
  );

  useEffect(() => {
    if (currentSettings) {
      // Manually construct an object with all keys from SettingsInput to avoid partial resets
      const defaultValuesFromData: SettingsInput = {
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
      };
      settingsForm.reset(defaultValuesFromData);
    }
  }, [currentSettings, settingsForm]);

  useEffect(() => {
    if (settingsError) {
      toast.error(`Failed to load company settings: ${settingsError.message}`);
    }
  }, [settingsError]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
     profileForm.reset({
       name: session.user.name ?? ' ',
       firstName: session.user.firstName ?? ' ',
     });
  }
  }, [status, session, profileForm]);

  const updateSettingsMutation = api.settings.update.useMutation({
    onSuccess: async (data) => {
      toast.success('Company settings updated successfully!');
      settingsForm.reset(data); 
      await refetchSettings(); 
    },
    onError: (error) => {
      toast.error(`Company settings update failed: ${error.message}`);
    },
  });

  const updateProfileMutation = api.user.updateProfile.useMutation({
    onSuccess: async (data) => {
      toast.success('Profile updated successfully!');
      await updateSession({ name: data.name, firstName: data.firstName }); 
      profileForm.reset({ name: data.name ?? '', firstName: data.firstName ?? '' }); 
    },
    onError: (error) => {
      toast.error(`Profile update failed: ${error.message}`);
    },
  });

  const changePasswordMutation = api.user.changePassword.useMutation({
     onSuccess: () => {
       toast.success('Password changed successfully!');
       passwordForm.reset();
     },
     onError: (error) => {
        toast.error(`Password change failed: ${error.message}`);
     },
  });

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

  if (status === 'loading' || isLoadingSettings) {
    return (
      <div className="container mx-auto py-8 space-y-6">
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
    return <p>Access Denied. Please sign in.</p>;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

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
          </CardContent>
          <CardFooter>
             <Button type="submit" disabled={updateProfileMutation.isPending} className="ml-auto">
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
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
             <Button type="submit" disabled={changePasswordMutation.isPending} className="ml-auto">
                {changePasswordMutation.isPending ? 'Saving...' : 'Change Password'}
             </Button>
          </CardFooter>
         </form>
      </Card>

      {/* Company Settings Form */}
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

            <div className="grid md:grid-cols-2 gap-4">
              {/* VAT ID (Y-tunnus) */}
              <div className="grid gap-2">
                <Label htmlFor="vatId">VAT ID / Y-tunnus *</Label>
                <Input id="vatId" {...settingsForm.register('vatId')} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.vatId && <p className="text-sm text-destructive">{settingsForm.formState.errors.vatId.message}</p>}
              </div>
              {/* Domicile */}
              <div className="grid gap-2">
                <Label htmlFor="domicile">Domicile (Kotipaikka) *</Label>
                <Input id="domicile" {...settingsForm.register('domicile')} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.domicile && <p className="text-sm text-destructive">{settingsForm.formState.errors.domicile.message}</p>}
              </div>
            </div>

            {/* Seller Identifier (OVT for Finvoice sender) */}
            <div className="grid gap-2">
              <Label htmlFor="sellerIdentifier">Seller OVT Identifier (Verkkolaskuosoite)</Label>
              <Input id="sellerIdentifier" {...settingsForm.register('sellerIdentifier')} placeholder="Optional: Your company's OVT for sending e-invoices" disabled={updateSettingsMutation.isPending} />
              {settingsForm.formState.errors.sellerIdentifier && <p className="text-sm text-destructive">{settingsForm.formState.errors.sellerIdentifier.message}</p>}
            </div>
            
            <div className="grid md:grid-cols-3 gap-4">
                {/* Street Address */}
                <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor="streetAddress">Street Address *</Label>
                    <Input id="streetAddress" {...settingsForm.register('streetAddress')} disabled={updateSettingsMutation.isPending} />
                    {settingsForm.formState.errors.streetAddress && <p className="text-sm text-destructive">{settingsForm.formState.errors.streetAddress.message}</p>}
                </div>
                {/* Postal Code */}
                <div className="grid gap-2">
                    <Label htmlFor="postalCode">Postal Code *</Label>
                    <Input id="postalCode" {...settingsForm.register('postalCode')} disabled={updateSettingsMutation.isPending} />
                    {settingsForm.formState.errors.postalCode && <p className="text-sm text-destructive">{settingsForm.formState.errors.postalCode.message}</p>}
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {/* City */}
              <div className="grid gap-2">
                <Label htmlFor="city">City *</Label>
                <Input id="city" {...settingsForm.register('city')} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.city && <p className="text-sm text-destructive">{settingsForm.formState.errors.city.message}</p>}
              </div>
              {/* Country Code */}
              <div className="grid gap-2">
                <Label htmlFor="countryCode">Country Code (e.g., FI) *</Label>
                <Input id="countryCode" {...settingsForm.register('countryCode')} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.countryCode && <p className="text-sm text-destructive">{settingsForm.formState.errors.countryCode.message}</p>}
              </div>
              {/* Country Name */}
              <div className="grid gap-2">
                <Label htmlFor="countryName">Country Name (e.g., Finland) *</Label>
                <Input id="countryName" {...settingsForm.register('countryName')} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.countryName && <p className="text-sm text-destructive">{settingsForm.formState.errors.countryName.message}</p>}
              </div>
            </div>
            
            {/* Website */}
            <div className="grid gap-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" {...settingsForm.register('website')} placeholder="Optional: https://company.com" disabled={updateSettingsMutation.isPending} />
              {settingsForm.formState.errors.website && <p className="text-sm text-destructive">{settingsForm.formState.errors.website.message}</p>}
            </div>

            <hr className="my-4" />
            <h3 className="text-lg font-medium">Bank Details</h3>

            <div className="grid md:grid-cols-2 gap-4">
              {/* IBAN */}
              <div className="grid gap-2">
                <Label htmlFor="bankAccountIBAN">Bank Account IBAN *</Label>
                <Input id="bankAccountIBAN" {...settingsForm.register('bankAccountIBAN')} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.bankAccountIBAN && <p className="text-sm text-destructive">{settingsForm.formState.errors.bankAccountIBAN.message}</p>}
              </div>
              {/* BIC */}
              <div className="grid gap-2">
                <Label htmlFor="bankAccountBIC">BIC *</Label>
                <Input id="bankAccountBIC" {...settingsForm.register('bankAccountBIC')} disabled={updateSettingsMutation.isPending} />
                {settingsForm.formState.errors.bankAccountBIC && <p className="text-sm text-destructive">{settingsForm.formState.errors.bankAccountBIC.message}</p>}
              </div>
            </div>
            {/* Bank Name */}
            <div className="grid gap-2">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input id="bankName" {...settingsForm.register('bankName')} placeholder="Optional: Name of the bank" disabled={updateSettingsMutation.isPending} />
              {settingsForm.formState.errors.bankName && <p className="text-sm text-destructive">{settingsForm.formState.errors.bankName.message}</p>}
            </div>


            <hr className="my-4" />
            <h3 className="text-lg font-medium">Finvoice Operator (for sending e-invoices)</h3>
            
            {/* Seller Intermediator Address (OVT for Finvoice operator) */}
            <div className="grid gap-2">
              <Label htmlFor="sellerIntermediatorAddress">E-invoice Operator Address (Välittäjän OVT-tunnus)</Label>
              <Input id="sellerIntermediatorAddress" {...settingsForm.register('sellerIntermediatorAddress')} placeholder="Optional: Your e-invoice operator's OVT" disabled={updateSettingsMutation.isPending} />
              {settingsForm.formState.errors.sellerIntermediatorAddress && <p className="text-sm text-destructive">{settingsForm.formState.errors.sellerIntermediatorAddress.message}</p>}
            </div>

          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={updateSettingsMutation.isPending} className="ml-auto">
              {updateSettingsMutation.isPending ? 'Saving Settings...' : 'Save Company Settings'}
            </Button>
          </CardFooter>
        </form>
      </Card>

    </div>
  );
} 