import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with the service role key for admin access
// This should only be used in server contexts (API routes, Server Components)
export function createServerSupabaseClient() {
  // Provide fallback values for build time only
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTYxMzQwNzIwMCwiZXhwIjoxOTI4OTgzMjAwfQ.placeholder';
  
  // In runtime, validate environment variables
  if (process.env.NODE_ENV === 'production' && (!supabaseUrl || supabaseUrl === 'https://example.supabase.co' || !supabaseServiceKey || supabaseServiceKey.includes('placeholder'))) {
    console.error('Supabase URL and service role key are required in production');
    // In production runtime, this will throw if the actual variables are missing
    if (typeof window === 'undefined') {
      throw new Error('Supabase URL and service role key are required');
    }
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
} 