import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/debug/cleanup-rooms - Delete all rooms for testing
export async function POST(request: Request) {
  try {
    // This is a dangerous operation, so require a confirmation
    const { confirm = false, code = null } = await request.json();
    
    if (!confirm) {
      return NextResponse.json({
        success: false,
        error: 'Confirmation required. Send { "confirm": true } to proceed.'
      }, { status: 400 });
    }
    
    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Stats for before deletion
    const { count: roomCount } = await supabaseAdmin
      .from('rooms')
      .select('*', { count: 'exact', head: true });
    
    const { count: playerCount } = await supabaseAdmin
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    let roomsDeleted = 0, playersDeleted = 0;
    
    // Delete specific room or all rooms
    if (code) {
      // First get the room ID
      const { data: roomData } = await supabaseAdmin
        .from('rooms')
        .select('id')
        .eq('code', code)
        .single();
        
      if (roomData) {
        // Delete players in this room
        const { error: playersError } = await supabaseAdmin
          .from('players')
          .delete()
          .eq('room_id', roomData.id);
          
        if (!playersError) {
          playersDeleted = 1; // Approximate since we don't have exact count
        }
        
        // Delete the room
        const { error: roomError } = await supabaseAdmin
          .from('rooms')
          .delete()
          .eq('id', roomData.id);
          
        if (!roomError) {
          roomsDeleted = 1;
        }
      }
    } else {
      // Delete all players
      const { error: playersError } = await supabaseAdmin
        .from('players')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Safety check
        
      if (!playersError) {
        playersDeleted = playerCount || 0;
      }
      
      // Delete all rooms
      const { error: roomsError } = await supabaseAdmin
        .from('rooms')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Safety check
        
      if (!roomsError) {
        roomsDeleted = roomCount || 0;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: code ? `Room ${code} deleted` : 'All rooms deleted',
      stats: {
        before: {
          rooms: roomCount || 0,
          players: playerCount || 0
        },
        deleted: {
          rooms: roomsDeleted,
          players: playersDeleted
        }
      }
    });
  } catch (error: any) {
    console.error('Error cleaning up rooms:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 