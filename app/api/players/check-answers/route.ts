import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getRoomById } from '@/lib/rooms';
import { createClient } from '@supabase/supabase-js';

// POST /api/players/check-answers - Check if all players have submitted answers
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

    const { roomId, round } = body;
    
    if (!roomId || !round) {
      return NextResponse.json({
        success: false,
        error: 'Room ID and round number are required'
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
    
    // Get all players in this room
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name')
      .eq('room_id', roomId);
      
    if (playersError) {
      console.error('Error fetching players:', playersError);
      return NextResponse.json({
        success: false,
        error: 'Error fetching players'
      }, { status: 500, headers });
    }
    
    // Get all answers for this room and round
    const { data: answers, error: answersError } = await supabase
      .from('answers')
      .select(`
        id,
        player_id,
        answer,
        players (
          id,
          name
        )
      `)
      .eq('room_id', roomId)
      .eq('round', round);
      
    if (answersError) {
      console.error('Error fetching answers:', answersError);
      return NextResponse.json({
        success: false,
        error: 'Error fetching answers'
      }, { status: 500, headers });
    }
    
    // Check if all players have submitted answers
    const allSubmitted = players.length > 0 && answers.length === players.length;
    
    // Format answers to include player name
    const formattedAnswers = answers.map(answer => ({
      id: answer.id,
      player_id: answer.player_id,
      player_name: answer.players ? (answer.players as any).name : 'Unknown Player',
      answer: answer.answer
    }));
    
    // Check if the game state is already set to discussion_voting
    let gameStateUpdated = false;
    let currentGameStage = 'waiting';
    
    try {
      // Use admin client to avoid RLS issues
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      );
      
      const { data: gameState, error: gameStateError } = await adminClient
        .from('game_state')
        .select('current_stage')
        .eq('room_id', roomId)
        .eq('round', parseInt(round.toString()))
        .maybeSingle();
      
      if (!gameStateError && gameState) {
        currentGameStage = gameState.current_stage;
        gameStateUpdated = gameState.current_stage === 'discussion_voting';
        console.log(`Current game stage: ${currentGameStage}, Discussion voting stage: ${gameStateUpdated}`);
      } else {
        console.log('No game state found or error:', gameStateError);
      }
    } catch (gameStateErr) {
      console.error('Error checking game state:', gameStateErr);
    }
    
    // If all players submitted and game state isn't updated, update it
    if (allSubmitted && !gameStateUpdated && answers.length >= 2) {
      try {
        // Only update if there are at least 2 players who have submitted
        console.log('All answers submitted but game state not updated to discussion_voting. Updating now...');
        
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );
        
        const { error: updateError } = await adminClient
          .from('game_state')
          .upsert({
            room_id: roomId,
            round: parseInt(round.toString()),
            current_stage: 'discussion_voting',
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'room_id, round'
          });
          
        if (!updateError) {
          console.log('Successfully updated game state to discussion_voting');
          gameStateUpdated = true;
          currentGameStage = 'discussion_voting';
        } else {
          console.error('Error updating game state:', updateError);
        }
      } catch (updateErr) {
        console.error('Exception updating game state:', updateErr);
      }
    }
    
    return NextResponse.json({
      success: true,
      answers: formattedAnswers,
      allSubmitted,
      totalPlayers: players.length,
      totalAnswers: answers.length,
      gameStateUpdated,
      currentGameStage
    }, { headers });
  } catch (error: any) {
    console.error('Error checking answers:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500, headers });
  }
} 