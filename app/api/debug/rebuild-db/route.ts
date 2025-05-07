import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// GET /api/debug/rebuild-db - Rebuild database schema
export async function GET() {
  try {
    // Read the schema.sql file
    const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the schema into individual statements
    const statements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s + ';');
    
    const results = {
      success: true,
      statements: statements.length,
      errors: [] as string[]
    };
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const sql = statements[i];
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql });
        
        if (error) {
          results.errors.push(`Statement ${i + 1}: ${error.message}`);
          results.success = false;
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        results.errors.push(`Statement ${i + 1}: ${errorMessage}`);
        results.success = false;
      }
    }
    
    return NextResponse.json({
      status: results.success ? 'success' : 'partial_success',
      results
    });
  } catch (error) {
    console.error('Rebuild DB error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Failed to rebuild database', 
        details: error instanceof Error ? error.message : null 
      },
      { status: 500 }
    );
  }
} 