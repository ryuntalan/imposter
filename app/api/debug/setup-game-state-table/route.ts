import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This is a debug endpoint to set up the game_state table correctly
export async function GET() {
  // Only allow in development or when explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_ENDPOINTS !== 'true') {
    return NextResponse.json({ error: 'This endpoint is disabled in production' }, { status: 403 });
  }
  
  try {
    // Create a Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase credentials'
      }, { status: 500 });
    }
    
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Check if the table exists
    const { error: tableCheckError } = await adminClient
      .from('game_state')
      .select('id')
      .limit(1);
    
    // Create the game_state table with proper constraints
    let createTableSql = '';
    
    if (tableCheckError && tableCheckError.message.toLowerCase().includes('does not exist')) {
      // Table doesn't exist, create it
      createTableSql = `
        CREATE TABLE IF NOT EXISTS game_state (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          current_stage TEXT NOT NULL DEFAULT 'waiting',
          round INTEGER NOT NULL DEFAULT 0,
          last_updated TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(room_id, round)
        );
        
        CREATE INDEX IF NOT EXISTS idx_game_state_room_id ON game_state(room_id);
        CREATE INDEX IF NOT EXISTS idx_game_state_room_round ON game_state(room_id, round);
      `;
    } else {
      // Table exists but might not have the constraint
      // Check if the constraint exists
      const { data: constraintData, error: constraintError } = await adminClient.rpc('system.sql', {
        query: "SELECT * FROM pg_constraint WHERE conname = 'game_state_room_id_round_key'"
      });
      
      if (constraintError || (Array.isArray(constraintData) && constraintData.length === 0)) {
        // Drop and recreate the table
        createTableSql = `
          -- First back up existing data
          CREATE TEMP TABLE game_state_backup AS SELECT * FROM game_state;
          
          -- Drop and recreate the table with the constraint
          DROP TABLE IF EXISTS game_state;
          
          CREATE TABLE game_state (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
            current_stage TEXT NOT NULL DEFAULT 'waiting',
            round INTEGER NOT NULL DEFAULT 0,
            last_updated TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(room_id, round)
          );
          
          -- Restore data
          INSERT INTO game_state (id, room_id, current_stage, round, last_updated)
          SELECT id, room_id, current_stage, round, last_updated
          FROM game_state_backup;
          
          -- Clean up
          DROP TABLE game_state_backup;
          
          -- Create indexes
          CREATE INDEX IF NOT EXISTS idx_game_state_room_id ON game_state(room_id);
          CREATE INDEX IF NOT EXISTS idx_game_state_room_round ON game_state(room_id, round);
        `;
      } else {
        // Constraint already exists, no action needed
        return NextResponse.json({
          success: true,
          message: 'Table already has the required constraint'
        });
      }
    }
    
    // Execute the SQL
    if (createTableSql) {
      const { error: createError } = await adminClient.rpc('system.sql', {
        query: createTableSql
      });
      
      if (createError) {
        return NextResponse.json({
          success: false,
          error: `Error creating/updating table: ${createError.message}`,
          details: createError
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Game state table set up successfully'
    });
    
  } catch (error: any) {
    console.error('Error setting up game state table:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error
    }, { status: 500 });
  }
} 