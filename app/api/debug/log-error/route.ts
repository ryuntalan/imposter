import { NextResponse } from 'next/server';

// POST /api/debug/log-error - Log error details for debugging
export async function POST(request: Request) {
  try {
    const { error, context } = await request.json();
    
    // Log error details to server console
    console.error('\n==== DEBUG ERROR LOG ====');
    console.error('Context:', context);
    console.error('Error:', error);
    
    if (error instanceof Object) {
      try {
        console.error('Stringified error:', JSON.stringify(error, null, 2));
      } catch (e) {
        console.error('Error stringifying error object:', e);
      }
    }
    
    console.error('========================\n');
    
    return NextResponse.json({
      success: true,
      message: 'Error logged successfully'
    });
  } catch (e) {
    console.error('Error in error logging endpoint:', e);
    return NextResponse.json(
      { error: 'Failed to log error' },
      { status: 500 }
    );
  }
} 