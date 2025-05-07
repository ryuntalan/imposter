import { NextResponse } from 'next/server';
import { getRoomByCode } from '@/lib/rooms';
import { GameRoom, Player } from '@/lib/types';

// GET /api/rooms/[code] - Get information about a room by its code
export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  // Ensure we always return JSON
  const headers = {
    'Content-Type': 'application/json'
  };
  
  try {
    const roomCode = params.code;
    
    if (!roomCode) {
      return NextResponse.json(
        { error: 'Room code is required' },
        { status: 400, headers }
      );
    }
    
    // Get room details using our utility function
    const room = await getRoomByCode(roomCode);
    
    if (!room) {
      return NextResponse.json(
        { error: 'Game room not found' },
        { status: 404, headers }
      );
    }
    
    // Pull out the room data for the response
    const { id, code, created_at, round_number, is_active } = room;
    // players is technically part of the query result
    const players = (room as any).players || [];
    
    return NextResponse.json({
      success: true,
      room: {
        id,
        code,
        created_at,
        round_number,
        is_active,
        players
      }
    }, { headers });
    
  } catch (error: any) {
    console.error('Unexpected error fetching game room:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers }
    );
  }
} 