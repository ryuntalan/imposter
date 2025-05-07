import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getRoomByCode } from '@/lib/rooms';

// GET /api/debug/troubleshoot-room?code=3L5G9R - Troubleshoot specific room code
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code') || '3L5G9R'; // Default to the problematic code
    
    // 1. Check if the API endpoint exists
    const apiEndpoint = `/api/rooms/${code}`;
    const endpointInfo = {
      url: apiEndpoint,
      message: 'This should match the URL that is returning 404'
    };
    
    // 2. Direct database query (admin)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    const { data: adminRoomData, error: adminRoomError } = await supabaseAdmin
      .from('rooms')
      .select('*, players(*)')
      .eq('code', code)
      .maybeSingle();
      
    // 3. Direct database query (public)  
    const { data: publicRoomData, error: publicRoomError } = await supabase
      .from('rooms')
      .select('*, players(*)')
      .eq('code', code)
      .maybeSingle();
      
    // 4. Use the helper function  
    const helperResult = await getRoomByCode(code);
    
    // 5. Try a case-insensitive search
    const { data: caseInsensitiveData, error: caseInsensitiveError } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .ilike('code', code)
      .maybeSingle();
      
    // 6. List all active rooms for comparison  
    const { data: allRooms, error: allRoomsError } = await supabaseAdmin
      .from('rooms')
      .select('code')
      .eq('is_active', true)
      .limit(50);
    
    return NextResponse.json({
      success: true,
      endpoint: endpointInfo,
      adminQuery: {
        success: !adminRoomError,
        error: adminRoomError ? adminRoomError.message : null,
        found: !!adminRoomData,
        data: adminRoomData
      },
      publicQuery: {
        success: !publicRoomError,
        error: publicRoomError ? publicRoomError.message : null,
        found: !!publicRoomData,
        data: publicRoomData
      },
      helperFunction: {
        success: !!helperResult,
        found: !!helperResult,
        data: helperResult
      },
      caseInsensitiveSearch: {
        success: !caseInsensitiveError,
        error: caseInsensitiveError ? caseInsensitiveError.message : null,
        found: !!caseInsensitiveData,
        data: caseInsensitiveData
      },
      allRooms: {
        success: !allRoomsError,
        count: allRooms ? allRooms.length : 0,
        codes: allRooms ? allRooms.map(r => r.code) : []
      }
    });
  } catch (error: any) {
    console.error('Error troubleshooting room:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 