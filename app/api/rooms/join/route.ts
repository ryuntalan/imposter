import { NextResponse } from 'next/server';
import { joinRoom } from '@/lib/rooms';

// POST /api/rooms/join - Join an existing game room
export async function POST(request: Request) {
  console.log('Join API endpoint called');
  try {
    const { playerName, roomCode } = await request.json();
    
    if (!playerName || !roomCode) {
      return NextResponse.json(
        { error: 'Player name and room code are required' },
        { status: 400 }
      );
    }
    
    console.log(`Attempting to join room: ${roomCode} with player: ${playerName}`);
    
    // Join an existing room using our utility function
    const result = await joinRoom(playerName, roomCode);
    
    if (!result) {
      console.log(`Failed to join room: ${roomCode}`);
      return NextResponse.json(
        { error: 'Game room not found or no longer accepting players' },
        { status: 404 }
      );
    }
    
    console.log(`Successfully joined room: ${result.room.code}`);
    
    // Create response with player ID cookie
    const response = NextResponse.json({
      success: true,
      room: result.room,
      player: result.player
    });
    
    // Set cookie with player ID for authentication in subsequent requests
    response.cookies.set({
      name: 'player_id',
      value: result.player.id,
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax'
    });
    
    return response;
    
  } catch (error: any) {
    console.error('Unexpected error joining game room:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 