import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/debug/tables-info - Get information about tables and their columns
export async function GET() {
  try {
    // SQL query to get table information
    const tablesQuery = `
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count,
             obj_description(('"public"."' || table_name || '"')::regclass) as description,
             (SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.table_name AND schemaname = 'public') as index_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      AND table_name IN ('rooms', 'players', 'prompts', 'answers')
      ORDER BY table_name;
    `;
    
    // Execute query
    const { data: tableInfo, error: tableInfoError } = await supabase.rpc('exec_sql', { 
      sql: tablesQuery 
    });
    
    if (tableInfoError) {
      return NextResponse.json(
        { error: 'Failed to get table information', details: tableInfoError.message },
        { status: 500 }
      );
    }
    
    // Group results by table
    const tables: Record<string, any[]> = {};
    
    if (Array.isArray(tableInfo)) {
      tableInfo.forEach((column: any) => {
        if (!tables[column.table_name]) {
          tables[column.table_name] = [];
        }
        
        tables[column.table_name].push({
          column_name: column.column_name,
          data_type: column.data_type,
          is_nullable: column.is_nullable,
          column_default: column.column_default
        });
      });
    }
    
    return NextResponse.json({
      status: 'success',
      tables
    });
  } catch (error) {
    console.error('Error getting table information:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Failed to get table information', 
        details: error instanceof Error ? error.message : null 
      },
      { status: 500 }
    );
  }
} 