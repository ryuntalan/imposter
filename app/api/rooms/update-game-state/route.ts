import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getRoomById } from '@/lib/rooms';
import { createClient } from '@supabase/supabase-js';

// POST /api/rooms/update-game-state - Update the current game state for a room
export async function POST(request: Request) {
  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('Error parsing request body:', error);
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON in request body'
      }, { status: 400, headers });
    }

    console.log('Update game state API received request:', body);
    
    const { roomId, gameStage } = body;
    
    if (!roomId || !gameStage) {
      console.error('Missing required fields:', { roomId, gameStage });
      return NextResponse.json({
        success: false,
        error: 'Room ID and game stage are required'
      }, { status: 400, headers });
    }
    
    // Get the room to check if it exists
    const room = await getRoomById(roomId);
    if (!room) {
      console.error('Room not found:', roomId);
      return NextResponse.json({
        success: false,
        error: 'Room not found'
      }, { status: 404, headers });
    }
    
    console.log(`Updating game state for room ${roomId}, round ${room.round_number} to ${gameStage}`);
    
    // Create an admin client
    const adminClient = createSupabaseAdminClient();

    // First ensure the game_state table exists
    // Use admin client to ensure proper permissions
    const { data: tableCheckData, error: tableCheckError } = await adminClient
      .from('game_state')
      .select('id')
      .limit(1);
    
    let tableExists = !tableCheckError;
    console.log('Game state table exists:', tableExists);
    
    // If table doesn't exist, try to create it
    if (!tableCheckError) {
      // Table exists, proceed with update
      console.log('Game state table exists, proceeding with update');
    } else {
      // Table might not exist, try to create it
      if (tableCheckError.message.toLowerCase().includes('does not exist')) {
        console.log('Game state table does not exist, attempting to create it');
        
        // Create the game_state table
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
          const { error: createError } = await adminClient.rpc('system.sql', {
            query: createTableSql
          });
          
          if (createError) {
            console.error('Error creating game_state table:', createError);
            throw new Error(`Failed to create game_state table: ${createError.message}`);
          }
          
          console.log('Successfully created game_state table');
          tableExists = true;
        } catch (createTableError) {
          console.error('Error trying to create game_state table:', createTableError);
          
          // If we can't create the table, try to use the debug API endpoint as a fallback
          try {
            console.log('Trying debug endpoint fallback to create game state...');
            const debugResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/debug/create-game-state-direct`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ room_id: roomId, round: room.round_number })
            });
            
            if (debugResponse.ok) {
              const debugResult = await debugResponse.json();
              console.log('Debug endpoint result:', debugResult);
              tableExists = debugResult.success;
            } else {
              console.error('Debug endpoint failed:', await debugResponse.text());
            }
          } catch (debugError) {
            console.error('Error calling debug endpoint:', debugError);
          }
          
          if (!tableExists) {
            throw new Error(`Failed to create game_state table: ${createTableError instanceof Error ? createTableError.message : 'Unknown error'}`);
          }
        }
      } else {
        // Some other error with the table
        console.error('Unexpected error checking game_state table:', tableCheckError);
        throw new Error(`Error accessing game_state table: ${tableCheckError.message}`);
      }
    }
    
    // Update the game state for this room and round
    try {
      // Use upsert to either insert or update as needed
      const { data: gameStateData, error: gameStateError } = await adminClient
        .from('game_state')
        .upsert({
          room_id: roomId,
          round: room.round_number,
          current_stage: gameStage,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'room_id, round'
        });
      
      if (gameStateError) {
        console.error('Error upserting game state:', gameStateError);
        throw gameStateError;
      }
      
      console.log('Game state updated successfully');
      
      return NextResponse.json({
        success: true,
        message: 'Game state updated successfully',
        roomId,
        round: room.round_number,
        gameStage
      }, { headers });
      
    } catch (e) {
      console.error('Unexpected error updating game state:', e);
      return NextResponse.json({
        success: false,
        error: 'Failed to update game state: ' + (e instanceof Error ? e.message : String(e))
      }, { status: 500, headers });
    }
  } catch (error: any) {
    console.error('Error updating game state:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500, headers });
  }
}

// Helper function to create a Supabase admin client
function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
} 