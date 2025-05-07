import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/debug/execute-sql - Execute SQL statements directly
export async function POST(request: Request) {
  try {
    const { sql } = await request.json();
    
    if (!sql) {
      return NextResponse.json({ 
        success: false, 
        error: 'SQL statement is required' 
      }, { status: 400 });
    }
    
    // Execute SQL directly using Supabase REST API
    const result = await executeSql(sql);
    
    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Execute SQL error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// Execute SQL directly through REST API
async function executeSql(sql: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase URL or key not found');
  }
  
  // Add the ability to fetch the query result if it's a SELECT
  const isSelect = sql.trim().toLowerCase().startsWith('select');
  
  const headers = {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Prefer': isSelect ? 'return=representation' : 'return=minimal'
  };
  
  const endpoint = `${url}/rest/v1/`;
  
  // For CREATE/ALTER/DROP statements, use the "rpc" endpoint
  // This is a hack but works for many DDL statements
  if (!isSelect) {
    const response = await fetch(`${endpoint}rpc/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'direct_sql',
        sql: sql
      })
    });
    
    if (!response.ok) {
      // If RPC fails, try direct SQL through regular endpoint
      // This approach doesn't work for most DDL statements but let's try
      const regularResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'text/plain'
        },
        body: sql
      });
      
      if (!regularResponse.ok) {
        const error = await regularResponse.json();
        throw new Error(`SQL execution failed: ${JSON.stringify(error)}`);
      }
      
      return await regularResponse.json();
    }
    
    return await response.json();
  } else {
    // For SELECT statements, use regular endpoint
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'text/plain'
      },
      body: sql
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`SQL execution failed: ${JSON.stringify(error)}`);
    }
    
    return await response.json();
  }
} 