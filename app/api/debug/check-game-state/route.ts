import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/debug/check-game-state?room_id=xxx&round=1 - Check game state for a room
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const roomId = url.searchParams.get('room_id');
    const round = url.searchParams.get('round') || '1';
    
    if (!roomId) {
      return NextResponse.json({
        success: false,
        error: 'Missing room_id parameter'
      }, { status: 400 });
    }
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Check if room exists
    const { data: roomData, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('id, code, round_number, is_active')
      .eq('id', roomId)
      .maybeSingle();
    
    // Check for game state
    const { data: gameStateData, error: gameStateError } = await supabaseAdmin
      .from('game_state')
      .select('*')
      .eq('room_id', roomId)
      .eq('round', parseInt(round))
      .maybeSingle();
    
    // Get players in the room
    const { data: playersData, error: playersError } = await supabaseAdmin
      .from('players')
      .select('id, name, is_imposter')
      .eq('room_id', roomId);
    
    // Prepare response
    return NextResponse.json({
      success: true,
      room: {
        exists: !roomError && roomData !== null,
        data: roomData,
        error: roomError ? roomError.message : null
      },
      gameState: {
        exists: !gameStateError && gameStateData !== null,
        data: gameStateData,
        error: gameStateError ? gameStateError.message : null
      },
      players: {
        count: playersData?.length || 0,
        data: playersData,
        error: playersError ? playersError.message : null
      }
    });
    
  } catch (error: any) {
    console.error('Error checking game state:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/debug/check-game-state - Create game state for a room
export async function POST(request: Request) {
  try {
    const { room_id, round = 1, current_stage = 'waiting' } = await request.json();
    
    if (!room_id) {
      return NextResponse.json({
        success: false,
        error: 'Missing room_id parameter'
      }, { status: 400 });
    }
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Check if room exists
    const { data: roomData, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .eq('id', room_id)
      .maybeSingle();
    
    if (roomError || !roomData) {
      return NextResponse.json({
        success: false,
        error: roomError ? roomError.message : 'Room not found'
      }, { status: 400 });
    }
    
    // Create or update game state
    const { data: gameStateData, error: gameStateError } = await supabaseAdmin
      .from('game_state')
      .upsert({
        room_id,
        round,
        current_stage,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'room_id, round'
      });
    
    return NextResponse.json({
      success: !gameStateError,
      data: gameStateData,
      error: gameStateError ? gameStateError.message : null
    });
    
  } catch (error: any) {
    console.error('Error creating game state:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 