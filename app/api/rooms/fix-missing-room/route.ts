import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/rooms/fix-missing-room - Create a new room specifically for joins
export async function POST(request: Request) {
  try {
    const { code = 'TEST12', playerName = 'TestPlayer' } = await request.json();
    
    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // 1. Check if room exists with exact match
    const { data: existingRoom, error: checkError } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('code', code)
      .maybeSingle();
      
    // 2. If found, use it, otherwise create a new one
    let roomId;
    
    if (existingRoom) {
      console.log(`Room with code ${code} already exists, ensuring it's active`);
      roomId = existingRoom.id;
      
      // Make sure it's active
      await supabaseAdmin
        .from('rooms')
        .update({ is_active: true })
        .eq('id', roomId);
    } else {
      console.log(`Creating new room with code ${code}`);
      // Create a new room
      const { data: newRoom, error: roomError } = await supabaseAdmin
        .from('rooms')
        .insert([
          {
            code: code, 
            round_number: 1,
            is_active: true
          }
        ])
        .select()
        .single();
        
      if (roomError) {
        return NextResponse.json({
          success: false,
          error: `Failed to create room: ${roomError.message}`
        }, { status: 500 });
      }
      
      roomId = newRoom.id;
      
      // Create a host player
      const { error: hostError } = await supabaseAdmin
        .from('players')
        .insert([
          {
            name: 'Host',
            room_id: roomId,
            is_imposter: false
          }
        ]);
        
      if (hostError) {
        console.error('Failed to create host player:', hostError);
      }
    }
    
    // 3. Add the requested player
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .insert([
        {
          name: playerName,
          room_id: roomId,
          is_imposter: false
        }
      ])
      .select()
      .single();
      
    if (playerError) {
      return NextResponse.json({
        success: false,
        error: `Failed to create player: ${playerError.message}`
      }, { status: 500 });
    }
    
    // 4. Get the room with all players
    const { data: completeRoom, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('*, players(*)')
      .eq('id', roomId)
      .single();
      
    if (roomError) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch room: ${roomError.message}`
      }, { status: 500 });
    }
    
    // Make sure all info is cleared from log
    console.log('completeRoom', { 
      id: completeRoom.id,
      code: completeRoom.code,
      is_active: completeRoom.is_active,
      player_count: completeRoom.players ? completeRoom.players.length : 0
    });
    
    return NextResponse.json({
      success: true,
      room: {
        id: completeRoom.id,
        code: completeRoom.code
      },
      player: {
        id: player.id,
        name: player.name
      },
      debug: {
        completeRoom
      }
    });
  } catch (error: any) {
    console.error('Error fixing missing room:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 