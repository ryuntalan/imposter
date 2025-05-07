import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/debug/create-game-state-table - Create the game_state table if it doesn't exist
export async function POST() {
  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Check if game_state table exists
    const { data: checkData, error: checkError } = await supabaseAdmin
      .from('game_state')
      .select('id')
      .limit(1);
    
    if (!checkError) {
      console.log('Game state table already exists');
      // Try to insert a record for debugging
      const testRoomId = '2b261041-18f4-4906-9985-36ec28a5f2b2';  // The problematic room ID
      const { error: insertError } = await supabaseAdmin
        .from('game_state')
        .upsert({
          room_id: testRoomId,
          round: 1,
          current_stage: 'discussion_voting'
        }, {
          onConflict: 'room_id, round'
        });
        
      return NextResponse.json({
        success: true,
        message: 'Game state table already exists',
        existingTable: true,
        testInsert: insertError ? `Failed: ${insertError.message}` : 'Success'
      });
    }
    
    // Create the game_state table
    const createSql = `
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
      
      CREATE OR REPLACE FUNCTION update_game_state(
        p_room_id UUID,
        p_round INTEGER,
        p_current_stage TEXT
      )
      RETURNS void AS $$
      DECLARE
        existing_state_id UUID;
      BEGIN
        -- Check if a state already exists for this room and round
        SELECT id INTO existing_state_id
        FROM game_state
        WHERE room_id = p_room_id AND round = p_round;
        
        IF existing_state_id IS NOT NULL THEN
          -- Update existing state
          UPDATE game_state
          SET current_stage = p_current_stage,
              last_updated = NOW()
          WHERE id = existing_state_id;
        ELSE
          -- Insert new state
          INSERT INTO game_state (room_id, round, current_stage)
          VALUES (p_room_id, p_round, p_current_stage);
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    // Execute the SQL
    const { error: createError } = await supabaseAdmin.rpc('system.sql', {
      query: createSql
    });
    
    if (createError) {
      throw new Error(`Failed to create game_state table: ${createError.message}`);
    }
    
    // Try to insert initial data for the problematic room
    const testRoomId = '2b261041-18f4-4906-9985-36ec28a5f2b2';  // The problematic room ID
    const { error: insertError } = await supabaseAdmin
      .from('game_state')
      .insert({
        room_id: testRoomId,
        round: 1,
        current_stage: 'discussion_voting'
      });
    
    return NextResponse.json({
      success: true,
      message: 'Game state table created successfully',
      testInsert: insertError ? `Failed: ${insertError.message}` : 'Success'
    });
    
  } catch (error: any) {
    console.error('Unexpected error creating game_state table:', error);
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