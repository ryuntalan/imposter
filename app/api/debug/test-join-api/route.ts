import { NextResponse } from 'next/server';

// POST /api/debug/test-join-api - Test if the join API endpoint is accessible
export async function POST(request: Request) {
  try {
    const { playerName = 'TestPlayer', roomCode = 'TEST12' } = await request.json();
    
    // Try to call the join API endpoint directly
    const joinResponse = await fetch(`${request.headers.get('origin')}/api/rooms/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ playerName, roomCode }),
    });
    
    // Get the response data
    let responseData = null;
    try {
      responseData = await joinResponse.json();
    } catch (jsonError) {
      // If we can't parse JSON, just get the text
      responseData = await joinResponse.text();
    }
    
    return NextResponse.json({
      success: joinResponse.ok,
      status: joinResponse.status,
      statusText: joinResponse.statusText,
      endpoint: '/api/rooms/join',
      requestBody: { playerName, roomCode },
      responseData
    });
  } catch (error: any) {
    console.error('Error testing join API:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      errorStack: error.stack
    }, { status: 500 });
  }
} 