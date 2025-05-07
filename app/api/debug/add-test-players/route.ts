import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRoomByCode } from '@/lib/rooms';

// POST /api/debug/add-test-players - Add test players to a game room
export async function POST(request: Request) {
  try {
    const { roomCode, count = 3, namePrefix = 'TestPlayer' } = await request.json();
    
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
    const room = await getRoomByCode(roomCode);
    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Room not found'
      }, { status: 404 });
    }
    
    // Get existing players to avoid duplicates
    const { data: existingPlayers, error: playerError } = await supabaseAdmin
      .from('players')
      .select('name')
      .eq('room_id', room.id);
      
    if (playerError) {
      return NextResponse.json({
        success: false,
        error: `Failed to get existing players: ${playerError.message}`
      }, { status: 500 });
    }
    
    const existingNames = existingPlayers ? existingPlayers.map(p => p.name) : [];
    
    // Create test players
    const playersToCreate = [];
    const addedPlayers = [];
    
    for (let i = 1; i <= count; i++) {
      const playerName = `${namePrefix}${i}`;
      
      // Skip if player with this name already exists in the room
      if (existingNames.includes(playerName)) {
        continue;
      }
      
      playersToCreate.push({
        name: playerName,
        room_id: room.id,
        is_imposter: false
      });
      
      addedPlayers.push(playerName);
    }
    
    if (playersToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new players to add (all already exist)',
        existingNames
      });
    }
    
    // Insert the players
    const { data: newPlayers, error: insertError } = await supabaseAdmin
      .from('players')
      .insert(playersToCreate)
      .select();
      
    if (insertError) {
      return NextResponse.json({
        success: false,
        error: `Failed to add test players: ${insertError.message}`
      }, { status: 500 });
    }
    
    // Get all players in the room now
    const { data: allPlayers, error: allPlayersError } = await supabaseAdmin
      .from('players')
      .select('id, name')
      .eq('room_id', room.id)
      .order('name');
      
    return NextResponse.json({
      success: true,
      message: `Added ${playersToCreate.length} test players`,
      addedPlayers,
      newPlayers,
      allPlayers,
      room: {
        id: room.id,
        code: room.code
      }
    });
  } catch (error: any) {
    console.error('Error adding test players:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 