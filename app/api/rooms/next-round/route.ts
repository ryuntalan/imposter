import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getRoomById, startGame } from '@/lib/rooms';

// POST /api/rooms/next-round - Start the next round of the game
export async function POST(request: Request) {
  try {
    const { roomId } = await request.json();
    
    if (!roomId) {
      return NextResponse.json({
        success: false,
        error: 'Room ID is required'
      }, { status: 400 });
    }
    
    // Get the current room
    const room = await getRoomById(roomId);
    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Room not found'
      }, { status: 404 });
    }
    
    // Increment the round number
    const nextRound = (room.round_number || 1) + 1;
    
    // Update the room with the new round number
    const { error: updateError } = await supabase
      .from('rooms')
      .update({ round_number: nextRound })
      .eq('id', roomId);
      
    if (updateError) {
      return NextResponse.json({
        success: false,
        error: `Failed to update room: ${updateError.message}`
      }, { status: 500 });
    }
    
    // Reset all players' is_imposter status
    const { error: resetError } = await supabase
      .from('players')
      .update({ is_imposter: false })
      .eq('room_id', roomId);
      
    if (resetError) {
      return NextResponse.json({
        success: false,
        error: `Failed to reset player roles: ${resetError.message}`
      }, { status: 500 });
    }
    
    // Start the new game round (assign roles and prompts)
    const startResult = await startGame(room.code);
    
    if (!startResult.success) {
      return NextResponse.json({
        success: false,
        error: startResult.error || 'Failed to start new round'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'New round started successfully',
      round: nextRound,
      room: {
        id: room.id,
        code: room.code
      }
    });
  } catch (error: any) {
    console.error('Error starting next round:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 