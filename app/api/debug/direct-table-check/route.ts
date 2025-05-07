import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/debug/direct-table-check - Direct check of tables with admin privileges
export async function GET() {
  try {
    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Check all tables
    const checks = {
      tables_exist: await checkTablesExist(supabaseAdmin),
      prompts_data: await getPromptsData(supabaseAdmin),
      tables_info: await getTablesInfo(supabaseAdmin)
    };
    
    return NextResponse.json({
      success: true,
      checks
    });
  } catch (error: any) {
    console.error('Table check error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}

async function checkTablesExist(supabase: any) {
  // Direct SQL query to check if tables exist
  try {
    const { data, error } = await supabase.rpc('system.sql', {
      query: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `
    });
    
    if (!error) {
      return data;
    }
    // If there's an error, fall through to the fallback approach
  } catch (e) {
    console.error('SQL query failed:', e);
    // Fall through to fallback
  }
  
  // Fallback to a different approach
  const results: Record<string, { exists: boolean; error: string | null }> = {};
  
  for (const table of ['rooms', 'players', 'prompts', 'answers']) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('count(*)', { count: 'exact', head: true });
      
      results[table] = {
        exists: !error,
        error: error ? error.message : null
      };
    } catch (tableError) {
      results[table] = {
        exists: false,
        error: 'Failed to query table'
      };
    }
  }
  
  return results;
}

async function getPromptsData(supabase: any) {
  try {
    // Direct query of prompts table
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .limit(10);
    
    return {
      success: !error,
      count: data?.length || 0,
      data: data || [],
      error: error ? error.message : null
    };
  } catch (e) {
    console.error('Error fetching prompts data:', e);
    return {
      success: false,
      count: 0,
      data: [],
      error: e instanceof Error ? e.message : 'Error fetching prompts'
    };
  }
}

async function getTablesInfo(supabase: any) {
  // Get row counts and column info for all tables
  const tables = ['rooms', 'players', 'prompts', 'answers'];
  const results: Record<string, { exists: boolean; count: number; error: string | null }> = {};
  
  for (const table of tables) {
    try {
      // Try direct count query for each table
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      results[table] = {
        exists: !countError,
        count: count || 0,
        error: countError ? countError.message : null
      };
    } catch (e) {
      // If query fails, mark table as not existing
      results[table] = { 
        exists: false, 
        count: 0, 
        error: e instanceof Error ? e.message : 'Unknown error' 
      };
    }
  }
  
  return results;
} 