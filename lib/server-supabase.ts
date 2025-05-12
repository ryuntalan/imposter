import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with the service role key for admin access
// This should only be used in server contexts (API routes, Server Components)
export function createServerSupabaseClient() {
  // Provide fallback values for build time only
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTYxMzQwNzIwMCwiZXhwIjoxOTI4OTgzMjAwfQ.placeholder';
  
  // Additional debug logging in production
  const debugLogging = process.env.NODE_ENV === 'production' || process.env.DEBUG_SUPABASE === 'true';
  
  if (debugLogging) {
    // Mask most of the key but show first/last few characters
    const maskKey = (key: string) => {
      if (!key || key.length < 10) return '(not set or invalid)';
      return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
    };
    
    console.log(`[SERVER] Initializing Supabase with URL: ${supabaseUrl}`);
    console.log(`[SERVER] Using service key: ${maskKey(supabaseServiceKey)}`);
  }
  
  // Validate environment variables at runtime
  if (process.env.NODE_ENV === 'production') {
    // Check URL
    if (!supabaseUrl || supabaseUrl === 'https://example.supabase.co') {
      console.error('[SERVER] Supabase URL is missing or invalid');
      throw new Error('Configuration error: NEXT_PUBLIC_SUPABASE_URL is not properly set. ' +
                     'Check your environment variables in Vercel.');
    }
    
    // Check service role key
    if (!supabaseServiceKey || supabaseServiceKey.includes('placeholder')) {
      console.error('[SERVER] Supabase service role key is missing or invalid');
      throw new Error('Configuration error: SUPABASE_SERVICE_ROLE_KEY is not properly set. ' +
                     'This key is required for admin operations. Check your environment variables in Vercel.');
    }
  }
  
  try {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'x-application-name': 'impostor-game-server'
        }
      }
    });
  } catch (error) {
    // Enhance error with additional context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const enhancedError = new Error(
      `[SERVER] Failed to initialize Supabase client: ${errorMessage}. ` +
      `Check your Supabase configuration and network connectivity.`
    );
    
    console.error(enhancedError);
    console.error('[SERVER] Supabase URL used:', supabaseUrl.substring(0, 10) + '...');
    console.error('[SERVER] Environment:', process.env.NODE_ENV);
    
    throw enhancedError;
  }
} 