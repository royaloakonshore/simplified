"use client";

import { useState } from 'react';
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

// Schema for profile update (excluding password initially)
const profileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  firstName: z.string().min(1, "First name is required").optional(),
  // email: z.string().email().optional(), // Usually email change requires verification
});
type ProfileUpdateValues = z.infer<typeof profileUpdateSchema>;

// Schema for password change
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").optional(), // Optional if setting for first time
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"], // path of error
});
type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;


export default function SettingsPage() {
  const { data: session, status, update: updateSession } = useSession();

  // Profile Form
  const profileForm = useForm<ProfileUpdateValues>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      name: session?.user?.name ?? '',
      firstName: session?.user?.firstName ?? '',
    },
  });

  // Password Form
  const passwordForm = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // tRPC Mutations
  const updateProfileMutation = api.user.updateProfile.useMutation({
    onSuccess: async (data) => {
      toast.success('Profile updated successfully!');
      // Update the session with new details (excluding firstName for now)
      await updateSession({ name: data.name /*, firstName: data.firstName */ }); 
      profileForm.reset({ name: data.name ?? '' /*, firstName: data.firstName ?? '' */}); // Reset form (excluding firstName for now)
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

  // Submit Handlers
  const onProfileSubmit: SubmitHandler<ProfileUpdateValues> = (data) => {
    updateProfileMutation.mutate(data);
  };

  const onPasswordSubmit: SubmitHandler<PasswordChangeValues> = (data) => {
    // Check if user has an existing password (via session or maybe a separate query)
    // This check is simplified; ideally, the backend determines if currentPassword is required
    const needsCurrentPassword = session?.user && true; // Placeholder: Check if user logged in via credentials or has hash

    if (needsCurrentPassword && !data.currentPassword) {
       passwordForm.setError("currentPassword", { type: "manual", message: "Current password is required to change." });
       return;
    }
    changePasswordMutation.mutate(data);
  };

  // Loading State
  if (status === 'loading') {
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
      </div>
    );
  }

  // Unauthenticated State (shouldn't happen due to middleware, but good practice)
  if (status === 'unauthenticated') {
    return <p>Access Denied. Please sign in.</p>;
  }

  // Set default values once session is loaded
  if (status === 'authenticated' && !profileForm.formState.isDirty) {
     profileForm.reset({
       name: session.user.name ?? '',
       firstName: session.user.firstName ?? '',
     });
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
             {/* Add email field here if needed, handle verification flow */} 
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
            {/* Only show current password if user potentially has one */}
            {true && ( // Replace with actual check based on session/user state
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
    </div>
  );
} 