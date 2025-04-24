// This is a placeholder for the server-side Supabase client
// We'll use this in future steps when the full authentication flow is implemented

import { cache } from 'react';

// Simple placeholder to be replaced with the actual client later
export const createServerSupabaseClient = cache(() => {
  return {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
    }
  };
}); 