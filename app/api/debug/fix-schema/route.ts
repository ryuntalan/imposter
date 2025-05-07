import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This function will apply the migration directly to fix the circular dependency issue
export async function POST() {
  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // The SQL to fix the circular dependency issue
    const fixMigrationSql = `
      -- First drop any existing constraint on host_id if it exists
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'fk_host_player' 
          AND table_name = 'rooms'
        ) THEN
          ALTER TABLE rooms DROP CONSTRAINT fk_host_player;
        END IF;
      END $$;

      -- Make sure host_id can be NULL
      ALTER TABLE rooms ALTER COLUMN host_id DROP NOT NULL;

      -- Add the constraint back properly (if it doesn't exist)
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'fk_host_player' 
          AND table_name = 'rooms'
        ) THEN
          ALTER TABLE rooms 
            ADD CONSTRAINT fk_host_player 
            FOREIGN KEY (host_id) REFERENCES players(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    // Execute the SQL
    const { error } = await supabaseAdmin.rpc('pgaudit.exec_sql', {
      sql: fixMigrationSql
    });

    if (error) {
      console.error('Error applying migration:', error);

      // Try direct SQL if RPC fails
      const { error: directError } = await supabaseAdmin.rpc('system.sql', {
        query: fixMigrationSql
      });

      if (directError) {
        return NextResponse.json(
          { 
            success: false, 
            error: directError.message,
            note: 'Failed to apply migration - please manually apply through Supabase dashboard'
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Schema fixed successfully' 
    });
  } catch (error: any) {
    console.error('Unexpected error applying migration:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error',
        details: error.stack
      },
      { status: 500 }
    );
  }
} 