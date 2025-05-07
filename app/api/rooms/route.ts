import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createRoom } from '@/lib/rooms';

// POST /api/rooms - Create a new game room
export async function POST(request: Request) {
  try {
    const { hostName } = await request.json();
    
    if (!hostName) {
      return NextResponse.json(
        { error: 'Host name is required' },
        { status: 400 }
      );
    }
    
    // Create a new room using our utility function
    try {
      console.log('Creating room with host name:', hostName);
      const result = await createRoom(hostName);
      
      if (!result) {
        console.error('createRoom returned null result');
        return NextResponse.json(
          { error: 'Failed to create game room - null result' },
          { status: 500 }
        );
      }
      
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
    } catch (roomError: any) {
      console.error('Error in createRoom:', roomError);
      
      // Get detailed error info
      const errorDetails = {
        message: roomError.message || 'Unknown error',
        stack: roomError.stack,
        name: roomError.name,
        ...(roomError.cause ? { cause: roomError.cause } : {})
      };
      
      console.error('Detailed error:', errorDetails);
      
      return NextResponse.json(
        { 
          error: `Error creating room: ${roomError.message}`,
          details: errorDetails
        },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error('Unexpected error creating game room:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        details: {
          name: error.name,
          stack: error.stack ? error.stack.split('\n')[0] : undefined
        }
      },
      { status: 500 }
    );
  }
}

// GET /api/rooms - Get list of active rooms (for debugging)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, players(*)')
      .eq('is_active', true);
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch rooms' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ rooms: data });
  } catch (error) {
    console.error('Unexpected error fetching rooms:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 