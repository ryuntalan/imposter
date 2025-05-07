import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getRoomById, getPlayerById } from '@/lib/rooms';
import { createClient } from '@supabase/supabase-js';

// POST /api/rooms/start-new-round - Start a new round of the game (host only)
export async function POST(request: Request) {
  // Ensure response is always JSON
  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    const { roomId, playerId } = await request.json();
    
    if (!roomId) {
      return NextResponse.json({
        success: false,
        error: 'Room ID is required'
      }, { status: 400, headers });
    }
    
    // Get the room to check if it exists
    const room = await getRoomById(roomId);
    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Room not found'
      }, { status: 404, headers });
    }
    
    // If a player ID is provided, check if they're the host
    if (playerId) {
      const player = await getPlayerById(playerId);
      if (!player || player.room_id !== roomId) {
        return NextResponse.json({
          success: false,
          error: 'Player not found or not in this room'
        }, { status: 403, headers });
      }
      
      // In a real app, you'd check if the player is the host
      // For now, we'll allow any player to start a new round
    }
    
    // Create admin client to bypass RLS
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    console.log(`Starting new round for room ${roomId}, current round: ${room.round_number}`);
    
    // Increment the round number
    const newRoundNumber = room.round_number + 1;
    
    // Update the room with the new round number
    const { error: updateError } = await adminClient
      .from('rooms')
      .update({ round_number: newRoundNumber })
      .eq('id', roomId);
      
    if (updateError) {
      console.error('Error updating room round number:', updateError);
      return NextResponse.json({
        success: false,
        error: `Failed to start new round: ${updateError.message}`
      }, { status: 500, headers });
    }
    
    // Clear old game state records for this room to start fresh
    await clearPreviousRoundData(roomId, adminClient);
    
    // Reset game state to waiting
    const { error: gameStateError } = await adminClient
      .from('game_state')
      .upsert({
        room_id: roomId,
        round: newRoundNumber,
        current_stage: 'waiting',
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'room_id, round'
      });
      
    if (gameStateError) {
      console.error('Error setting initial game state:', gameStateError);
      // Not critical, continue
    }
    
    // Pre-select a random prompt for this round
    await selectPromptForRound(roomId, newRoundNumber, adminClient);
    
    // Assign a new impostor randomly
    await assignNewImpostor(roomId, adminClient);
    
    return NextResponse.json({
      success: true,
      message: 'New round started',
      round: newRoundNumber
    }, { headers });
  } catch (error: any) {
    console.error('Error starting new round:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500, headers });
  }
}

/**
 * Clear data from previous rounds
 */
async function clearPreviousRoundData(roomId: string, adminClient: any) {
  try {
    console.log(`Clearing previous round data for room ${roomId}`);
    
    // Clear any votes from the previous round
    const { error: votesError } = await adminClient
      .from('votes')
      .delete()
      .eq('room_id', roomId);
      
    if (votesError) {
      console.error('Error clearing votes:', votesError);
      // Not critical, continue
    } else {
      console.log('Votes cleared successfully');
    }
    
    // Clear any answers from the previous round
    const { error: answersError } = await adminClient
      .from('answers')
      .delete()
      .eq('room_id', roomId);
      
    if (answersError) {
      console.error('Error clearing answers:', answersError);
      // Not critical, continue
    } else {
      console.log('Answers cleared successfully');
    }
    
    // Clear any round prompts from the previous round
    const { error: promptsError } = await adminClient
      .from('round_prompts')
      .delete()
      .eq('room_id', roomId);
      
    if (promptsError) {
      console.error('Error clearing round prompts:', promptsError);
      // If the table doesn't exist yet, that's okay
    } else {
      console.log('Round prompts cleared successfully');
    }
    
  } catch (err) {
    console.error('Error clearing previous round data:', err);
    // Not critical, continue
  }
}

/**
 * Select a random prompt for the round
 */
async function selectPromptForRound(roomId: string, round: number, adminClient: any) {
  try {
    console.log(`Selecting prompt for room ${roomId}, round ${round}`);
    
    // First check if the round_prompts table exists
    const { error: checkError } = await adminClient
      .from('round_prompts')
      .select('id')
      .limit(1);
      
    // If the table doesn't exist yet, try to create it
    if (checkError && checkError.code === '42P01') { // "relation does not exist"
      console.log('round_prompts table does not exist, creating it');
      
      // Create the round_prompts table
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS round_prompts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          round INTEGER NOT NULL,
          prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(room_id, round)
        );
      `;
      
      const { error: createError } = await adminClient.rpc('execute_sql', { sql: createTableSQL });
      
      if (createError) {
        console.error('Error creating round_prompts table:', createError);
        return;
      }
      
      console.log('round_prompts table created successfully');
    }
    
    // Get all available prompts
    const { data: prompts, error: promptsError } = await adminClient
      .from('prompts')
      .select('id')
      .order('id', { ascending: true });
      
    if (promptsError || !prompts || prompts.length === 0) {
      console.error('Error fetching prompts:', promptsError || 'No prompts found');
      return;
    }
    
    console.log(`Found ${prompts.length} prompts to choose from`);
    
    // Generate a deterministic but random index based on room ID and round
    const seed = hashStringToNumber(`${roomId}_${round}`);
    const randomIndex = seed % prompts.length;
    const selectedPromptId = prompts[randomIndex].id;
    
    console.log(`Selected prompt ${selectedPromptId} for room ${roomId}, round ${round}`);
    
    // Store the selected prompt
    const { error: insertError } = await adminClient
      .from('round_prompts')
      .upsert({
        room_id: roomId,
        round: round,
        prompt_id: selectedPromptId
      }, {
        onConflict: 'room_id, round'
      });
      
    if (insertError) {
      console.error('Error storing selected prompt:', insertError);
    } else {
      console.log('Prompt selection stored successfully');
    }
    
  } catch (err) {
    console.error('Error selecting prompt for round:', err);
  }
}

/**
 * Generate a numeric hash from a string
 */
function hashStringToNumber(str: string): number {
  let hash = 0;
  if (str.length === 0) return hash;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  
  // Make sure the hash is positive
  return Math.abs(hash);
}

/**
 * Randomly assign a new impostor for the room
 */
async function assignNewImpostor(roomId: string, adminClient: any) {
  try {
    console.log(`Assigning new impostor for room ${roomId}`);
    
    // First, reset all players to non-impostor
    const { error: resetError } = await adminClient
      .from('players')
      .update({ is_imposter: false })
      .eq('room_id', roomId);
      
    if (resetError) {
      console.error('Error resetting impostor status:', resetError);
      return;
    }
    
    // Get all players in the room
    const { data: players, error: playersError } = await adminClient
      .from('players')
      .select('id')
      .eq('room_id', roomId);
      
    if (playersError || !players || players.length === 0) {
      console.error('Error getting players or no players found:', playersError);
      return;
    }
    
    // Select a random player to be the impostor
    const randomIndex = Math.floor(Math.random() * players.length);
    const newImpostorId = players[randomIndex].id;
    
    console.log(`Selected player ${newImpostorId} as the new impostor`);
    
    // Update the selected player to be the impostor
    const { error: updateError } = await adminClient
      .from('players')
      .update({ is_imposter: true })
      .eq('id', newImpostorId);
      
    if (updateError) {
      console.error('Error setting new impostor:', updateError);
    } else {
      console.log('New impostor assigned successfully');
    }
  } catch (err) {
    console.error('Error assigning new impostor:', err);
  }
} 