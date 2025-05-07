import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// GET /api/debug/apply-migrations - Apply database migrations
export async function GET() {
  try {
    // Read migrations directory
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    
    // Check if the directory exists
    if (!fs.existsSync(migrationsDir)) {
      return NextResponse.json({
        status: 'error',
        error: 'Migrations directory not found'
      }, { status: 404 });
    }
    
    // Get all migration files
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort by name for proper ordering
    
    const results = {
      success: true,
      migrations: [] as { file: string; success: boolean; error: string | null }[]
    };
    
    // Apply each migration
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(filePath, 'utf8');
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
        
        if (error) {
          results.migrations.push({
            file,
            success: false,
            error: error.message
          });
          results.success = false;
        } else {
          results.migrations.push({
            file,
            success: true,
            error: null
          });
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        results.migrations.push({
          file,
          success: false,
          error: errorMessage
        });
        results.success = false;
      }
    }
    
    return NextResponse.json({
      status: results.success ? 'success' : 'partial_success',
      results
    });
  } catch (error) {
    console.error('Apply migrations error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Failed to apply migrations', 
        details: error instanceof Error ? error.message : null 
      },
      { status: 500 }
    );
  }
} 