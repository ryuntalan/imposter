import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/debug/create-game-state-direct - Create the game_state table directly
export async function POST(request: Request) {
  try {
    // Get room_id and round from request
    const { room_id, round = 1 } = await request.json();
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // First check if the rooms table exists
    const { data: roomsData, error: roomsError } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .limit(1);
    
    const roomsTableExists = !roomsError;
    
    // Check if game_state table exists
    const { data: gameStateData, error: gameStateError } = await supabaseAdmin
      .from('game_state')
      .select('id')
      .limit(1);
    
    const gameStateTableExists = !gameStateError;
    
    let createTableResult = null;
    let insertResult = null;
    
    // If game_state table doesn't exist, create it
    if (!gameStateTableExists) {
      // Create the game_state table using raw SQL
      const createTableSql = `
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
      
      try {
        // Execute raw SQL using Supabase's system.sql RPC function
        const { data, error } = await supabaseAdmin.rpc('system.sql', {
          query: createTableSql
        });
        
        createTableResult = {
          success: !error,
          error: error ? error.message : null
        };
      } catch (err: any) {
        createTableResult = {
          success: false,
          error: err.message || 'Unknown error executing SQL'
        };
      }
    }
    
    // If we have a room_id, insert or update the game state for this room
    if (room_id) {
      try {
        const { data, error } = await supabaseAdmin
          .from('game_state')
          .upsert({
            room_id,
            round,
            current_stage: 'waiting'
          }, {
            onConflict: 'room_id, round'
          });
        
        insertResult = {
          success: !error,
          error: error ? error.message : null,
          data
        };
      } catch (err: any) {
        insertResult = {
          success: false,
          error: err.message || 'Unknown error inserting game state'
        };
      }
    }
    
    return NextResponse.json({
      success: gameStateTableExists || (createTableResult && createTableResult.success),
      roomsTableExists,
      gameStateTableExists,
      createTableResult,
      insertResult
    });
    
  } catch (error: any) {
    console.error('Error creating game_state table:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 