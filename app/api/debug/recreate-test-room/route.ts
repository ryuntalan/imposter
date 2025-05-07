import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/debug/recreate-test-room - Ensure a test room exists with code TEST123
export async function POST(request: Request) {
  try {
    const code = 'TEST12';
    const hostName = 'TestHost';
    const results = {
      steps: [] as any[],
      success: false
    };
    
    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Step 1: Check if the room already exists
    results.steps.push({ step: 'Checking if room exists' });
    
    const { data: existingRoom, error: checkError } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('code', code)
      .maybeSingle();
      
    if (checkError) {
      results.steps.push({ 
        step: 'Error checking for existing room', 
        error: checkError.message 
      });
      throw new Error(`Failed to check for existing room: ${checkError.message}`);
    }
    
    if (existingRoom) {
      results.steps.push({ 
        step: 'Room already exists', 
        room: existingRoom 
      });
      
      // Delete the existing room and its players
      results.steps.push({ step: 'Deleting existing room and players' });
      
      const { error: deletePlayersError } = await supabaseAdmin
        .from('players')
        .delete()
        .eq('room_id', existingRoom.id);
        
      if (deletePlayersError) {
        results.steps.push({ 
          step: 'Error deleting players', 
          error: deletePlayersError.message 
        });
      }
      
      const { error: deleteRoomError } = await supabaseAdmin
        .from('rooms')
        .delete()
        .eq('id', existingRoom.id);
        
      if (deleteRoomError) {
        results.steps.push({ 
          step: 'Error deleting room', 
          error: deleteRoomError.message 
        });
        throw new Error(`Failed to delete existing room: ${deleteRoomError.message}`);
      }
    }
    
    // Step 2: Create a new room
    results.steps.push({ step: 'Creating new room' });
    
    const { data: roomData, error: roomError } = await supabaseAdmin
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
      results.steps.push({ 
        step: 'Error creating room', 
        error: roomError.message 
      });
      throw new Error(`Failed to create room: ${roomError.message}`);
    }
    
    results.steps.push({ 
      step: 'Room created successfully', 
      room: roomData 
    });
    
    // Step 3: Create a host player
    results.steps.push({ step: 'Creating host player' });
    
    const { data: playerData, error: playerError } = await supabaseAdmin
      .from('players')
      .insert([
        { 
          name: hostName,
          room_id: roomData.id,
          is_imposter: false
        }
      ])
      .select()
      .single();
    
    if (playerError) {
      results.steps.push({ 
        step: 'Error creating player', 
        error: playerError.message 
      });
      throw new Error(`Failed to create player: ${playerError.message}`);
    }
    
    results.steps.push({ 
      step: 'Player created successfully', 
      player: playerData 
    });
    
    results.success = true;
    
    return NextResponse.json({
      success: true,
      message: 'Test room created or recreated successfully',
      room: roomData,
      player: playerData,
      steps: results.steps,
      access: {
        roomUrl: `/room/${code}`,
        joinUrl: `/join?code=${code}`,
        apiUrl: `/api/rooms/${code}`
      }
    });
  } catch (error: any) {
    console.error('Error recreating test room:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 