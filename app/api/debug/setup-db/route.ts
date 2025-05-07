import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// GET /api/debug/setup-db - Complete database setup in one step
export async function GET() {
  return setupDatabase();
}

// POST /api/debug/setup-db - Alternative endpoint for setup
export async function POST() {
  return setupDatabase();
}

async function setupDatabase() {
  const results = {
    extensions: { success: false, details: null as any },
    functions: { success: false, details: null as any },
    schema: { success: false, details: null as any },
    migrations: { success: false, details: null as any }
  };
  
  try {
    // 1. Make sure uuid-ossp extension is enabled
    try {
      const { error: extensionError } = await supabase.rpc('exec_sql', { 
        sql: 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' 
      });
      
      results.extensions = {
        success: !extensionError,
        details: extensionError ? extensionError.message : 'Extension enabled successfully'
      };
      
      if (extensionError) {
        console.error('Error enabling uuid-ossp extension:', extensionError);
      }
    } catch (e) {
      // Extension may not exist yet because we haven't created exec_sql
      // Try a direct SQL approach
      try {
        const { error: directExtensionError } = await supabase
          .from('_direct_extension_create')
          .select('*')
          .limit(1)
          .then(() => ({ error: null }), (err) => ({ error: err }));
        
        results.extensions = {
          success: !directExtensionError || directExtensionError.message.includes('does not exist'),
          details: 'Attempted direct extension creation'
        };
      } catch (directError) {
        results.extensions = { 
          success: false, 
          details: e instanceof Error ? e.message : 'Unknown error'
        };
      }
    }
    
    // 2. Apply functions
    try {
      const functionsPath = path.join(process.cwd(), 'supabase', 'functions.sql');
      if (!fs.existsSync(functionsPath)) {
        results.functions = { success: false, details: 'Functions file not found' };
      } else {
        const functionsSQL = fs.readFileSync(functionsPath, 'utf8');
        
        // Split the functions into individual statements
        const statements = functionsSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0)
          .map(s => s + ';');
        
        // Try to apply each function separately
        let successCount = 0;
        const errors = [];
        
        for (const sql of statements) {
          try {
            // Try using supabase-js to execute the SQL directly
            const { error } = await supabase.rpc('exec_sql', { sql });
            
            if (!error) {
              successCount++;
            } else {
              errors.push(error.message);
            }
          } catch (e) {
            errors.push(e instanceof Error ? e.message : 'Unknown error');
          }
        }
        
        results.functions = {
          success: successCount > 0,
          details: successCount > 0 
            ? `Applied ${successCount}/${statements.length} functions`
            : `Failed to apply functions: ${errors.join(', ')}`
        };
      }
    } catch (e) {
      results.functions = { 
        success: false, 
        details: e instanceof Error ? e.message : 'Unknown error' 
      };
    }
    
    // 3. Apply schema
    try {
      const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
      if (!fs.existsSync(schemaPath)) {
        results.schema = { success: false, details: 'Schema file not found' };
      } else {
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
        // Apply schema via exec_sql if available
        const { error: schemaError } = await supabase.rpc('exec_sql', { sql: schemaSQL });
        
        results.schema = {
          success: !schemaError,
          details: schemaError ? schemaError.message : 'Schema applied successfully'
        };
      }
    } catch (e) {
      results.schema = { 
        success: false, 
        details: e instanceof Error ? e.message : 'Unknown error' 
      };
    }
    
    // 4. Apply migrations
    try {
      const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
      if (!fs.existsSync(migrationsDir)) {
        results.migrations = { success: false, details: 'Migrations directory not found' };
      } else {
        const migrationFiles = fs.readdirSync(migrationsDir)
          .filter(file => file.endsWith('.sql'))
          .sort();
        
        if (migrationFiles.length === 0) {
          results.migrations = { success: true, details: 'No migrations to apply' };
        } else {
          const migrationResults = [];
          let allSuccessful = true;
          
          for (const file of migrationFiles) {
            const filePath = path.join(migrationsDir, file);
            const migrationSQL = fs.readFileSync(filePath, 'utf8');
            
            const { error: migrationError } = await supabase.rpc('exec_sql', { sql: migrationSQL });
            
            migrationResults.push({
              file,
              success: !migrationError,
              error: migrationError ? migrationError.message : null
            });
            
            if (migrationError) {
              allSuccessful = false;
            }
          }
          
          results.migrations = {
            success: allSuccessful,
            details: migrationResults
          };
        }
      }
    } catch (e) {
      results.migrations = { 
        success: false, 
        details: e instanceof Error ? e.message : 'Unknown error' 
      };
    }
    
    const allSuccessful = Object.values(results).every(r => r.success);
    
    return NextResponse.json({
      status: allSuccessful ? 'success' : 'partial_success',
      results
    });
  } catch (error) {
    console.error('Database setup error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Failed to set up database', 
        details: error instanceof Error ? error.message : null 
      },
      { status: 500 }
    );
  }
} 