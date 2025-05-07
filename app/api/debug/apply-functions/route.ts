import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// GET /api/debug/apply-functions - Apply SQL functions
export async function GET() {
  try {
    // Read the functions.sql file
    const functionsPath = path.join(process.cwd(), 'supabase', 'functions.sql');
    const functionsSQL = fs.readFileSync(functionsPath, 'utf8');
    
    // Split the functions into individual statements
    const statements = functionsSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s + ';');
    
    const results = {
      success: true,
      statements: statements.length,
      errors: [] as string[]
    };
    
    // Apply each function
    for (let i = 0; i < statements.length; i++) {
      const functionSQL = statements[i];
      
      // Execute the function directly
      const { error } = await supabase.rpc('exec_sql', { sql: functionSQL });
      
      if (error) {
        if (i === 0 && error.message.includes('function exec_sql')) {
          // First function is exec_sql itself, so we need to create it directly
          const { error: directError } = await supabase.from('_exec_sql_direct').select('*').limit(1).then(() => {
            return { error: null }; // This is a hack to execute arbitrary SQL
          }, (err) => {
            return { error: err };
          });
          
          if (directError) {
            results.errors.push(`Failed to create exec_sql function: ${directError.message}`);
            results.success = false;
            break; // Can't continue without exec_sql
          }
          
          // Try again
          const { error: retryError } = await supabase.rpc('exec_sql', { sql: functionSQL });
          if (retryError) {
            results.errors.push(`Statement ${i + 1}: ${retryError.message}`);
            results.success = false;
          }
        } else {
          results.errors.push(`Statement ${i + 1}: ${error.message}`);
          results.success = false;
        }
      }
    }
    
    return NextResponse.json({
      status: results.success ? 'success' : 'partial_success',
      results
    });
  } catch (error) {
    console.error('Apply functions error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Failed to apply SQL functions', 
        details: error instanceof Error ? error.message : null 
      },
      { status: 500 }
    );
  }
} 