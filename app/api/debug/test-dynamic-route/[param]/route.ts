import { NextResponse } from 'next/server';

// GET /api/debug/test-dynamic-route/[param] - Test if dynamic routes are working
export async function GET(
  request: Request,
  { params }: { params: { param: string } }
) {
  try {
    // Simply echo back the parameter
    return NextResponse.json({
      success: true,
      param: params.param,
      message: 'Dynamic route is functioning correctly'
    });
  } catch (error: any) {
    console.error('Error in test dynamic route:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 