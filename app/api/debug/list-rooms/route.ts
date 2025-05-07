import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/debug/list-rooms - List all room codes in the database
export async function GET() {
  try {
    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Get all rooms
    const { data: rooms, error: roomsError } = await supabaseAdmin
      .from('rooms')
      .select('id, code, created_at, is_active')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (roomsError) {
      return NextResponse.json({
        success: false,
        error: roomsError.message,
        details: "Failed to fetch rooms"
      });
    }
    
    // Get room count
    const { count, error: countError } = await supabaseAdmin
      .from('rooms')
      .select('*', { count: 'exact', head: true });
    
    // Format room codes for easy viewing
    const formattedRooms = rooms?.map(room => ({
      id: room.id,
      code: room.code,
      created_at: room.created_at,
      is_active: room.is_active,
      created_ago: new Date(room.created_at).toLocaleString()
    }));
    
    return NextResponse.json({
      success: true,
      total_rooms: count || rooms?.length || 0,
      rooms: formattedRooms || []
    });
  } catch (error: any) {
    console.error('Error listing rooms:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 