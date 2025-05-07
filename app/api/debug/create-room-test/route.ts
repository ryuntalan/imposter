import { NextResponse } from 'next/server';
import { createRoom } from '@/lib/rooms';
import { createClient } from '@supabase/supabase-js';

// POST /api/debug/create-room-test - Test the complete room creation workflow
export async function POST(request: Request) {
  try {
    const { hostName = 'TestUser' } = await request.json();
    const results = {
      steps: [] as any[],
      success: false,
      finalResult: null as any
    };
    
    // Step 1: Create room using the normal function
    try {
      results.steps.push({
        step: 'Creating room with hostName: ' + hostName,
        timestamp: new Date().toISOString()
      });
      
      const roomResult = await createRoom(hostName);
      
      results.steps.push({
        step: 'Room creation result',
        success: !!roomResult,
        data: roomResult
      });
      
      if (!roomResult) {
        throw new Error('Room creation returned null');
      }
      
      // Step 2: Verify the room exists in the database
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      );
      
      results.steps.push({
        step: 'Verifying room in database',
        roomId: roomResult.room.id,
        roomCode: roomResult.room.code
      });
      
      const { data: roomData, error: roomError } = await supabaseAdmin
        .from('rooms')
        .select('*, players(*)')
        .eq('id', roomResult.room.id)
        .single();
      
      results.steps.push({
        step: 'Database verification',
        success: !roomError && !!roomData,
        error: roomError ? roomError.message : null,
        data: roomData
      });
      
      if (roomError || !roomData) {
        throw new Error('Room verification failed: ' + (roomError?.message || 'No data returned'));
      }
      
      // Step 3: Verify the API endpoint works for fetching this room
      results.steps.push({
        step: 'Testing API endpoint',
        url: `/api/rooms/${roomResult.room.code}`
      });
      
      const apiResponse = await fetch(`${request.headers.get('origin')}/api/rooms/${roomResult.room.code}`);
      const apiData = await apiResponse.json();
      
      results.steps.push({
        step: 'API response',
        status: apiResponse.status,
        success: apiResponse.ok,
        data: apiData
      });
      
      if (!apiResponse.ok) {
        throw new Error(`API endpoint failed with status ${apiResponse.status}: ${JSON.stringify(apiData)}`);
      }
      
      // Success!
      results.success = true;
      results.finalResult = {
        room: roomResult.room,
        player: roomResult.player,
        accessURL: `/room/${roomResult.room.code}`
      };
      
    } catch (stepError: any) {
      results.steps.push({
        step: 'Error occurred',
        error: stepError.message,
        stack: stepError.stack
      });
    }
    
    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Create room test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 