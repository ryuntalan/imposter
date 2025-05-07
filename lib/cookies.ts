import { NextResponse } from 'next/server';
import { RequestCookies } from 'next/dist/server/web/spec-extension/cookies';

/**
 * Utility function to set a cookie on a NextResponse object
 */
export function setResponseCookie(
  response: NextResponse,
  name: string,
  value: string,
  maxAge = 60 * 60 * 24 // Default: 24 hours
) {
  response.cookies.set({
    name,
    value,
    path: '/',
    maxAge,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  });
}

/**
 * Utility function to get a cookie from a Request object
 */
export function getRequestCookie(cookies: RequestCookies, name: string): string | undefined {
  const cookie = cookies.get(name);
  return cookie?.value;
}

/**
 * Utility function to delete a cookie from a NextResponse object
 */
export function deleteResponseCookie(response: NextResponse, name: string) {
  response.cookies.delete(name);
} 