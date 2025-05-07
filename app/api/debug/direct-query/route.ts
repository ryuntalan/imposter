import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/debug/direct-query - Execute a direct SQL query against Supabase
export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { success: false, error: 'No query provided' },
        { status: 400 }
      );
    }
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Try to execute the query directly
    let result;
    let error;
    
    try {
      // Try the pgaudit.exec_sql RPC first
      const { data, error: rpcError } = await supabaseAdmin.rpc('pgaudit.exec_sql', {
        sql: query
      });
      
      if (rpcError) {
        // Fall back to system.sql
        const { data: sysData, error: sysError } = await supabaseAdmin.rpc('system.sql', {
          query: query
        });
        
        if (sysError) {
          throw new Error(`Failed to execute query: ${sysError.message}`);
        }
        
        result = sysData;
      } else {
        result = data;
      }
    } catch (err) {
      console.error('Error executing direct query:', err);
      error = err instanceof Error ? err.message : 'Unknown error executing query';
      
      // Try one more approach with raw REST API call
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`
          },
          body: JSON.stringify({
            sql: query
          })
        });
        
        if (!response.ok) {
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        result = await response.json();
        error = null; // Clear the error since this approach worked
      } catch (restErr) {
        console.error('REST API fallback failed:', restErr);
        // Keep the original error if the REST approach also fails
      }
    }
    
    return NextResponse.json({
      success: !error,
      result,
      error
    });
  } catch (error: any) {
    console.error('Direct query error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error',
        stack: error.stack
      },
      { status: 500 }
    );
  }
}

// GET version of the endpoint for simpler queries via URL params
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query');
  
  if (!query) {
    return NextResponse.json(
      { success: false, error: 'No query provided' },
      { status: 400 }
    );
  }
  
  // Convert to POST request body
  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ query })
  });
  
  return POST(mockRequest);
} 