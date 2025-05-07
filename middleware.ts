import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware adds proper CORS and content-type headers to all responses
export function middleware(request: NextRequest) {
  // For OPTIONS requests (CORS preflight)
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400', // 24 hours
      },
    });
  }
  
  // Get the response
  const response = NextResponse.next();
  
  // Add the CORS headers to all responses
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Set content type for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Content-Type', 'application/json');
  }
  
  return response;
}

// Configure which paths this middleware runs on
export const config = {
  matcher: ['/api/:path*'],
}; 