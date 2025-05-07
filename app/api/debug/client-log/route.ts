import { NextResponse } from 'next/server';

// Client-side error logging endpoint
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Log the client-side error to server logs
    console.error('[CLIENT ERROR LOG]', {
      timestamp: new Date().toISOString(),
      ...data
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Error logged successfully' 
    });
  } catch (error: any) {
    console.error('Error in client-log API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
} 