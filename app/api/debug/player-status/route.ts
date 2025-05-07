import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getPlayerById } from '@/lib/rooms';

// GET /api/debug/player-status?playerId=PLAYER_ID
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId');
    
    if (!playerId) {
      return NextResponse.json({
        success: false,
        error: 'Player ID is required'
      }, { status: 400 });
    }
    
    // Fetch player data from database
    const player = await getPlayerById(playerId);
    
    if (!player) {
      return NextResponse.json({
        success: false,
        error: 'Player not found',
        playerId
      }, { status: 404 });
    }
    
    // Get the room this player belongs to
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', player.room_id)
      .single();
    
    if (roomError) {
      return NextResponse.json({
        success: false,
        error: 'Error fetching room data',
        playerExists: true,
        player,
        roomError: roomError.message
      }, { status: 500 });
    }
    
    // Check other players in the same room
    const { data: roomPlayers, error: playersError } = await supabase
      .from('players')
      .select('id, name, is_imposter')
      .eq('room_id', player.room_id);
    
    // Get player answers in this room
    const { data: playerAnswers, error: answersError } = await supabase
      .from('answers')
      .select('*')
      .eq('room_id', player.room_id)
      .eq('round', room.round_number);
    
    // Get the game state for this room
    const { data: gameState, error: gameStateError } = await supabase
      .from('game_state')
      .select('*')
      .eq('room_id', player.room_id)
      .eq('round', room.round_number)
      .single();
    
    return NextResponse.json({
      success: true,
      player,
      room,
      roomPlayers: roomPlayers || [],
      playerAnswers: playerAnswers || [],
      gameState: gameState || null,
      errors: {
        playersError: playersError ? playersError.message : null,
        answersError: answersError ? answersError.message : null,
        gameStateError: gameStateError ? gameStateError.message : null
      }
    });
    
  } catch (error: any) {
    console.error('Error checking player status:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/debug/player-status
// Use this to fix missing game state for a specific room
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, round } = body;
    
    if (!roomId) {
      return NextResponse.json({
        success: false,
        error: 'Room ID is required'
      }, { status: 400 });
    }
    
    // Check if room exists
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    
    if (roomError) {
      return NextResponse.json({
        success: false,
        error: 'Room not found',
        details: roomError.message
      }, { status: 404 });
    }
    
    // Use the provided round or the room's current round
    const roundNumber = round || room.round_number || 1;
    
    // Create or update game state for this room
    const { data: gameState, error: gameStateError } = await supabase
      .from('game_state')
      .upsert({
        room_id: roomId,
        round: roundNumber,
        current_stage: 'discussion_voting', // Default to discussion_voting
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'room_id, round'
      });
    
    if (gameStateError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create game state',
        details: gameStateError.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Game state created successfully',
      room,
      roundNumber,
      gameState
    });
    
  } catch (error: any) {
    console.error('Error fixing game state:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 