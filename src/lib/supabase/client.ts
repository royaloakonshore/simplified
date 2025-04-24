'use client';

// This is a placeholder for the client-side Supabase client
// We'll use this in future steps when the full authentication flow is implemented

import { createClient } from '@supabase/supabase-js';

// Using regular supabase-js client instead of SSR client for now
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
); 