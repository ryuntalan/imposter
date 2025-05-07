import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// POST /api/debug/direct-setup-db - Set up database using direct SQL
export async function POST() {
  const results = {
    uuid_extension: { success: false, error: null as string | null },
    schema: { success: false, error: null as string | null },
    migrations: { success: false, error: null as string | null }
  };
  
  try {
    // Enable UUID extension
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
      const extensionResult = await fetch(`${baseUrl}/api/debug/execute-sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sql: 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' 
        })
      });
      
      if (extensionResult.ok) {
        results.uuid_extension.success = true;
      } else {
        const error = await extensionResult.json();
        results.uuid_extension.error = error.error || 'Failed to enable UUID extension';
      }
    } catch (e) {
      results.uuid_extension.error = e instanceof Error ? e.message : 'Unknown error';
    }
    
    // Apply schema
    try {
      const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
      if (!fs.existsSync(schemaPath)) {
        results.schema.error = 'Schema file not found';
      } else {
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute schema SQL
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
        const schemaResult = await fetch(`${baseUrl}/api/debug/execute-sql`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql: schemaSQL })
        });
        
        if (schemaResult.ok) {
          results.schema.success = true;
        } else {
          const error = await schemaResult.json();
          results.schema.error = error.error || 'Failed to apply schema';
        }
      }
    } catch (e) {
      results.schema.error = e instanceof Error ? e.message : 'Unknown error';
    }
    
    // Apply migrations
    try {
      const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
      if (!fs.existsSync(migrationsDir)) {
        results.migrations.error = 'Migrations directory not found';
      } else {
        const migrationFiles = fs.readdirSync(migrationsDir)
          .filter(file => file.endsWith('.sql'))
          .sort();
        
        if (migrationFiles.length === 0) {
          results.migrations.success = true; // No migrations to apply
        } else {
          const migrationErrors = [];
          
          for (const file of migrationFiles) {
            const filePath = path.join(migrationsDir, file);
            const migrationSQL = fs.readFileSync(filePath, 'utf8');
            
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
            const migrationResult = await fetch(`${baseUrl}/api/debug/execute-sql`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sql: migrationSQL })
            });
            
            if (!migrationResult.ok) {
              const error = await migrationResult.json();
              migrationErrors.push(`${file}: ${error.error || 'Unknown error'}`);
            }
          }
          
          if (migrationErrors.length === 0) {
            results.migrations.success = true;
          } else {
            results.migrations.error = migrationErrors.join('; ');
          }
        }
      }
    } catch (e) {
      results.migrations.error = e instanceof Error ? e.message : 'Unknown error';
    }
    
    const allSuccessful = Object.values(results).every(r => r.success);
    
    return NextResponse.json({
      status: allSuccessful ? 'success' : 'partial_success',
      results
    });
  } catch (error) {
    console.error('Direct database setup error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Failed to set up database', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 