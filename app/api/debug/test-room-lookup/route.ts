import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRoomByCode } from '@/lib/rooms';

// GET /api/debug/test-room-lookup?code=YOURCODE - Test room lookup with explicit code
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    
    if (!code) {
      return NextResponse.json({
        success: false,
        error: 'Room code parameter is required'
      }, { status: 400 });
    }
    
    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // First, direct DB lookup without our helper function
    const { data: directData, error: directError } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();
    
    // Then, use our helper function
    const roomData = await getRoomByCode(code);
    
    return NextResponse.json({
      success: true,
      direct_lookup: {
        success: !directError,
        error: directError ? directError.message : null,
        data: directData
      },
      helper_function: {
        success: !!roomData,
        data: roomData
      },
      debug_info: {
        code_provided: code,
        code_uppercase: code.toUpperCase(),
        direct_query_code_column_type: directData ? typeof directData.code : null,
        is_sensitive_check: directData ? directData.code === code : false,
        is_case_insensitive_check: directData ? directData.code.toUpperCase() === code.toUpperCase() : false
      }
    });
  } catch (error: any) {
    console.error('Error during test room lookup:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 