import { NextResponse } from 'next/server';
import { startGame } from '@/lib/rooms';

// POST /api/rooms/start-game - Start a game by assigning roles and selecting a prompt
export async function POST(request: Request) {
  // Set proper content type to ensure response is treated as JSON and add CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers });
  }
  
  try {
    const body = await request.json().catch(e => {
      console.error('Error parsing request body:', e);
      return null;
    });
    
    if (!body || !body.roomCode) {
      console.error('Missing room code in request:', body);
      return NextResponse.json({
        success: false,
        error: 'Room code is required'
      }, { status: 400, headers });
    }
    
    const { roomCode } = body;
    console.log('Starting game for room code:', roomCode);
    
    // Start the game by assigning roles and selecting a prompt
    const result = await startGame(roomCode);
    console.log('Start game result:', {
      success: result.success,
      error: result.error,
      roomId: result.roomData?.id
    });
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to start game'
      }, { status: 400, headers });
    }
    
    // Return success with minimal data (we don't want to expose who the imposter is)
    return NextResponse.json({
      success: true,
      room: {
        id: result.roomData?.id,
        code: result.roomData?.code,
        round_number: result.roomData?.round_number || 1
      },
      playerCount: result.roomData?.players?.length || 0,
      message: 'Game started successfully'
    }, { headers });
  } catch (error: any) {
    console.error('Error starting game:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500, headers });
  }
}

// Support OPTIONS requests for CORS
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
} 