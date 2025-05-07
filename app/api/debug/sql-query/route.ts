import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/debug/sql-query - Run custom SQL
export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json({
        success: false,
        error: 'No query provided'
      }, { status: 400 });
    }
    
    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Use raw query to get table information
    const { data, error } = await supabaseAdmin.rpc('pg_execute', { 
      query_text: query 
    });
    
    if (error) {
      // Try an alternative approach with regular query
      try {
        const result = await supabaseAdmin.from('pg_execute').select().is('query_text', query);
        return NextResponse.json({
          success: false,
          error: error.message,
          alternative_attempt: result
        });
      } catch (altError) {
        return NextResponse.json({
          success: false,
          error: error.message,
          alternative_error: altError instanceof Error ? altError.message : 'Unknown error'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('SQL query error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 