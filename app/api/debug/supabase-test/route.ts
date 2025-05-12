import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createServerSupabaseClient } from '@/lib/server-supabase';

// Define error type
type ConnectionError = {
  message: string;
  code?: string;
  details?: string;
  name?: string;
  stack?: string;
} | null;

// GET /api/debug/supabase-test - Test Supabase connection and return diagnostic info
export async function GET() {
  // For security, only enable this endpoint in development or when explicitly allowed
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_ENDPOINTS !== 'true') {
    return NextResponse.json({ error: 'This endpoint is disabled in production' }, { status: 403 });
  }
  
  let clientSuccess = false;
  let serverSuccess = false;
  let clientError: ConnectionError = null;
  let serverError: ConnectionError = null;
  let clientInfo = {};
  let serverInfo = {};
  
  // Test client-side Supabase connection
  try {
    const startTime = Date.now();
    const { data, error } = await supabase.from('rooms').select('count').limit(1);
    const endTime = Date.now();
    
    if (error) {
      clientError = {
        message: error.message,
        code: error.code,
        details: error.details
      };
    } else {
      clientSuccess = true;
      clientInfo = {
        responseTime: `${endTime - startTime}ms`,
        data
      };
    }
  } catch (err: any) {
    clientError = {
      message: err.message,
      name: err.name,
      stack: err.stack ? err.stack.split('\n')[0] : undefined
    };
  }
  
  // Test server-side Supabase connection
  try {
    const serverSupabase = createServerSupabaseClient();
    const startTime = Date.now();
    const { data, error } = await serverSupabase.from('rooms').select('count').limit(1);
    const endTime = Date.now();
    
    if (error) {
      serverError = {
        message: error.message,
        code: error.code,
        details: error.details
      };
    } else {
      serverSuccess = true;
      serverInfo = {
        responseTime: `${endTime - startTime}ms`,
        data
      };
    }
  } catch (err: any) {
    serverError = {
      message: err.message,
      name: err.name,
      stack: err.stack ? err.stack.split('\n')[0] : undefined
    };
  }
  
  // Gather environment info (without exposing full keys)
  const envInfo = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL ? 
      process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 10) + '...' : 'not set'
  };
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: envInfo,
    clientConnection: {
      success: clientSuccess,
      error: clientError,
      info: clientInfo
    },
    serverConnection: {
      success: serverSuccess,
      error: serverError,
      info: serverInfo
    }
  });
} 