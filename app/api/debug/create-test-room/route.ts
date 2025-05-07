import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/debug/create-test-room - Create a room with a specific code for testing
export async function POST(request: Request) {
  try {
    const { code = 'TEST01', hostName = 'TestUser' } = await request.json();
    
    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Step 1: Create the game room with fixed code
    const { data: roomData, error: roomError } = await supabaseAdmin
      .from('rooms')
      .insert([
        { 
          code: code.toUpperCase(),
          round_number: 1,
          is_active: true
        }
      ])
      .select()
      .single();
    
    if (roomError) {
      return NextResponse.json({
        success: false,
        error: roomError.message
      }, { status: 500 });
    }
    
    // Step 2: Create the host player
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
      return NextResponse.json({
        success: false,
        error: playerError.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      room: roomData,
      player: playerData,
      accessURL: `/room/${roomData.code}`
    });
  } catch (error: any) {
    console.error('Error creating test room:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 