import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRoomByCode } from '@/lib/rooms';

// POST /api/debug/start-new-round - Start a new round in an existing room
export async function POST(request: Request) {
  try {
    const { roomCode } = await request.json();
    
    if (!roomCode) {
      return NextResponse.json({
        success: false,
        error: 'Room code is required'
      }, { status: 400 });
    }
    
    // Use admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Get the room
    const { data: roomData, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('id, code, round_number')
      .eq('code', roomCode)
      .single();
      
    if (roomError || !roomData) {
      return NextResponse.json({
        success: false,
        error: roomError ? roomError.message : 'Room not found'
      }, { status: 404 });
    }
    
    // Get players in the room
    const { data: players, error: playersError } = await supabaseAdmin
      .from('players')
      .select('id, name')
      .eq('room_id', roomData.id);
      
    if (playersError) {
      return NextResponse.json({
        success: false,
        error: `Failed to get players: ${playersError.message}`
      }, { status: 500 });
    }
    
    if (!players || players.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Not enough players to start a new round (minimum 2 required)'
      }, { status: 400 });
    }
    
    // Randomly select one player to be the imposter
    const imposterIndex = Math.floor(Math.random() * players.length);
    
    // Reset all players' imposter status
    const { error: resetError } = await supabaseAdmin
      .from('players')
      .update({ is_imposter: false })
      .eq('room_id', roomData.id);
      
    if (resetError) {
      return NextResponse.json({
        success: false,
        error: `Failed to reset player roles: ${resetError.message}`
      }, { status: 500 });
    }
    
    // Set the selected player as imposter
    const { error: imposterError } = await supabaseAdmin
      .from('players')
      .update({ is_imposter: true })
      .eq('id', players[imposterIndex].id);
      
    if (imposterError) {
      return NextResponse.json({
        success: false,
        error: `Failed to set imposter: ${imposterError.message}`
      }, { status: 500 });
    }
    
    // Clean up answers and votes from the previous round
    try {
      // Delete previous answers
      const { error: deleteAnswersError } = await supabaseAdmin
        .from('answers')
        .delete()
        .eq('room_id', roomData.id)
        .lte('round', roomData.round_number);
        
      if (deleteAnswersError) {
        console.error('Error deleting previous answers:', deleteAnswersError);
      }
      
      // Delete previous votes
      const { error: deleteVotesError } = await supabaseAdmin
        .from('votes')
        .delete()
        .eq('room_id', roomData.id)
        .lte('round', roomData.round_number);
        
      if (deleteVotesError) {
        console.error('Error deleting previous votes:', deleteVotesError);
      }
    } catch (error) {
      console.error('Error cleaning up previous round data:', error);
    }
    
    // Increment round number
    const newRoundNumber = (roomData.round_number || 0) + 1;
    
    // Update the room with the new round number
    const { data: updatedRoom, error: updateError } = await supabaseAdmin
      .from('rooms')
      .update({ round_number: newRoundNumber })
      .eq('id', roomData.id)
      .select('id, code, round_number')
      .single();
      
    if (updateError) {
      return NextResponse.json({
        success: false,
        error: `Failed to update round number: ${updateError.message}`
      }, { status: 500 });
    }
    
    // Get the updated player list with the new imposter
    const { data: updatedPlayers, error: getPlayersError } = await supabaseAdmin
      .from('players')
      .select('id, name, is_imposter')
      .eq('room_id', roomData.id);
      
    if (getPlayersError) {
      return NextResponse.json({
        success: false,
        error: `Failed to get updated players: ${getPlayersError.message}`
      }, { status: 500 });
    }
    
    // Return success
    return NextResponse.json({
      success: true,
      message: `Started round ${newRoundNumber} successfully`,
      room: updatedRoom,
      players: updatedPlayers,
      imposter: updatedPlayers.find(p => p.is_imposter)
    });
    
  } catch (error: any) {
    console.error('Error starting new round:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 