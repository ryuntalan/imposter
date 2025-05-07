import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getRoomById, getPlayerById } from '@/lib/rooms';
import { createClient } from '@supabase/supabase-js';

// POST /api/players/submit-answer - Submit a player's answer to the current prompt
export async function POST(request: Request) {
  // Ensure response is always JSON
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
    
    const { playerId, roomId, promptId, answer } = body;
    
    console.log(`Submitting answer for player ${playerId} in room ${roomId}`);
    
    if (!playerId || !roomId || !promptId || !answer) {
      return NextResponse.json({
        success: false,
        error: 'Player ID, Room ID, Prompt ID, and answer are required'
      }, { status: 400, headers });
    }
    
    // Validate the player exists and belongs to the room
    const player = await getPlayerById(playerId);
    if (!player) {
      console.log(`Player not found: ${playerId}`);
      return NextResponse.json({
        success: false,
        error: 'Player not found'
      }, { status: 404, headers });
    }
    
    if (player.room_id !== roomId) {
      console.log(`Player ${playerId} does not belong to room ${roomId}`);
      return NextResponse.json({
        success: false,
        error: 'Player does not belong to this room'
      }, { status: 403, headers });
    }
    
    // Get the room to check the current round
    const room = await getRoomById(roomId);
    if (!room) {
      console.log(`Room not found: ${roomId}`);
      return NextResponse.json({
        success: false,
        error: 'Room not found'
      }, { status: 404, headers });
    }
    
    console.log(`Submitting answer for round ${room.round_number}`);
    
    // Create admin client to bypass RLS
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Check if player already submitted an answer for this round
    const { data: existingAnswer, error: checkError } = await adminClient
      .from('answers')
      .select('id')
      .eq('player_id', playerId)
      .eq('room_id', roomId)
      .eq('round', room.round_number)
      .maybeSingle();
      
    if (checkError) {
      console.error('Error checking for existing answer:', checkError);
    }
      
    if (existingAnswer) {
      console.log(`Updating existing answer ${existingAnswer.id} for player ${playerId}`);
      
      // Update the existing answer
      const { error: updateError } = await adminClient
        .from('answers')
        .update({ answer })
        .eq('id', existingAnswer.id);
        
      if (updateError) {
        console.error('Error updating answer:', updateError);
        return NextResponse.json({
          success: false,
          error: `Failed to update answer: ${updateError.message}`
        }, { status: 500, headers });
      }
      
      return NextResponse.json({
        success: true,
        message: 'Answer updated successfully',
        answerId: existingAnswer.id
      }, { headers });
    }
    
    console.log(`Inserting new answer for player ${playerId}, round ${room.round_number}`);
    
    // Insert a new answer with timestamp for better synchronization
    const { data: newAnswer, error: insertError } = await adminClient
      .from('answers')
      .insert([{
        player_id: playerId,
        room_id: roomId,
        prompt_id: promptId,
        round: room.round_number,
        answer,
        created_at: new Date().toISOString() // Add timestamp to ensure sync
      }])
      .select()
      .single();
      
    if (insertError) {
      console.error('Error inserting answer:', insertError);
      return NextResponse.json({
        success: false,
        error: `Failed to submit answer: ${insertError.message}`
      }, { status: 500, headers });
    }
    
    console.log(`Answer submitted successfully: ${newAnswer.id}`);
    
    // Check if all players have submitted answers
    const { data: players, error: playersError } = await adminClient
      .from('players')
      .select('id')
      .eq('room_id', roomId);
      
    if (playersError) {
      console.error('Error fetching players:', playersError);
    }
      
    const { data: answers, error: answersError } = await adminClient
      .from('answers')
      .select('id')
      .eq('room_id', roomId)
      .eq('round', room.round_number);
      
    if (answersError) {
      console.error('Error fetching answers:', answersError);
    }
      
    const allSubmitted = players && answers && players.length === answers.length;
    
    console.log(`All answers submitted: ${allSubmitted} (${answers?.length || 0}/${players?.length || 0})`);
    
    // If all players have submitted answers, update the game state
    if (allSubmitted && players?.length >= 2) {
      console.log('All players have submitted answers, updating game state to discussion_voting');
      
      try {
        // Add a short delay to ensure all clients have processed the answer submission
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const timestamp = new Date().toISOString();
        const { error: gameStateError } = await adminClient
          .from('game_state')
          .upsert({
            room_id: roomId,
            round: room.round_number,
            current_stage: 'discussion_voting',
            last_updated: timestamp
          }, {
            onConflict: 'room_id, round'
          });
          
        if (gameStateError) {
          console.error('Error updating game state:', gameStateError);
        } else {
          console.log(`Game state updated to discussion_voting successfully at ${timestamp}`);
        }
      } catch (err) {
        console.error('Error updating game state:', err);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Answer submitted successfully',
      answerId: newAnswer.id,
      allSubmitted,
      round: room.round_number
    }, { headers });
  } catch (error: any) {
    console.error('Error submitting answer:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500, headers });
  }
} 