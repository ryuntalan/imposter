import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { joinRoom } from '@/lib/rooms';

// GET /api/debug/fix-join-issue - Debug and fix the join room issue
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code') || 'TEST12';
    const playerName = url.searchParams.get('name') || 'TestPlayer';
    let roomToJoin = null;
    
    const steps = [];
    
    // Use admin client for debugging operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Step 1: Check if the room exists with exact match
    const { data: exactRoom, error: exactError } = await supabaseAdmin
      .from('rooms')
      .select('*, players(*)')
      .eq('code', code)
      .maybeSingle();
      
    steps.push({
      step: 'Exact match lookup',
      code: code,
      found: !!exactRoom,
      error: exactError ? exactError.message : null,
      room: exactRoom
    });
    
    // Step 2: Try case-insensitive lookup
    const { data: caseInsensitiveRooms, error: caseError } = await supabaseAdmin
      .from('rooms')
      .select('*, players(*)')
      .ilike('code', code)
      .limit(5);
      
    steps.push({
      step: 'Case-insensitive lookup',
      code: code,
      found: caseInsensitiveRooms && caseInsensitiveRooms.length > 0,
      count: caseInsensitiveRooms ? caseInsensitiveRooms.length : 0,
      rooms: caseInsensitiveRooms,
      error: caseError ? caseError.message : null
    });
    
    // Step 3: Check if the room exists but is not active
    const { data: inactiveRoom, error: inactiveError } = await supabaseAdmin
      .from('rooms')
      .select('*, players(*)')
      .eq('code', code)
      .eq('is_active', false)
      .maybeSingle();
      
    steps.push({
      step: 'Inactive room lookup',
      code: code,
      found: !!inactiveRoom,
      error: inactiveError ? inactiveError.message : null,
      room: inactiveRoom
    });
    
    // Step 4: Create or use found room
    if (exactRoom) {
      roomToJoin = exactRoom;
      steps.push({
        step: 'Using existing room',
        room: roomToJoin
      });
    } else if (caseInsensitiveRooms && caseInsensitiveRooms.length > 0) {
      roomToJoin = caseInsensitiveRooms[0];
      steps.push({
        step: 'Using case-insensitive match',
        room: roomToJoin
      });
      
      // Fix the code to match exactly what was provided
      const { data: updatedRoom, error: updateError } = await supabaseAdmin
        .from('rooms')
        .update({ code: code })
        .eq('id', roomToJoin.id)
        .select()
        .single();
        
      if (!updateError) {
        roomToJoin = updatedRoom;
        steps.push({
          step: 'Updated room code to match exactly',
          room: updatedRoom
        });
      } else {
        steps.push({
          step: 'Failed to update room code',
          error: updateError.message
        });
      }
    } else {
      // Create a new room if none exists
      const { data: newRoom, error: createError } = await supabaseAdmin
        .from('rooms')
        .insert([{
          code: code,
          round_number: 1,
          is_active: true
        }])
        .select('*')
        .single();
        
      if (createError) {
        steps.push({
          step: 'Failed to create room',
          error: createError.message
        });
      } else {
        roomToJoin = newRoom;
        steps.push({
          step: 'Created new room',
          room: newRoom
        });
        
        // Create host player
        const { data: hostPlayer, error: hostError } = await supabaseAdmin
          .from('players')
          .insert([{
            name: 'Host',
            room_id: newRoom.id,
            is_imposter: false
          }])
          .select()
          .single();
          
        if (hostError) {
          steps.push({
            step: 'Failed to create host player',
            error: hostError.message
          });
        } else {
          steps.push({
            step: 'Created host player',
            player: hostPlayer
          });
        }
      }
    }
    
    // Step 5: Try the joinRoom function
    if (roomToJoin) {
      const result = await joinRoom(playerName, code);
      
      steps.push({
        step: 'Join room result',
        success: !!result,
        result: result
      });
      
      if (!result) {
        // Check what happens inside joinRoom
        const { data: lookupResult, error: lookupError } = await supabaseAdmin
          .from('rooms')
          .select('*, players(*)')
          .eq('code', code.toUpperCase())
          .eq('is_active', true)
          .single();
          
        steps.push({
          step: 'Manual joinRoom lookup check',
          query: `code=${code.toUpperCase()}, is_active=true`,
          found: !!lookupResult,
          result: lookupResult,
          error: lookupError ? lookupError.message : null
        });
      }
    }
    
    return new Response(`
      <html>
        <head>
          <title>Join Room Debug</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 960px; margin: 0 auto; padding: 2rem; }
            h1, h2 { color: #4f46e5; }
            .success { color: green; }
            .error { color: #dc2626; }
            .warning { color: #d97706; }
            pre { background: #f5f5f5; padding: 1rem; border-radius: 0.5rem; overflow: auto; }
            .button { display: inline-block; background: #4f46e5; color: white; padding: 0.5rem 1rem; 
                     text-decoration: none; border-radius: 0.25rem; margin-top: 1rem; }
            .step { border: 1px solid #e5e7eb; margin-bottom: 1rem; padding: 1rem; border-radius: 0.5rem; }
            .step-title { font-weight: bold; margin-bottom: 0.5rem; }
            .step pre { margin-top: 0.5rem; }
          </style>
        </head>
        <body>
          <h1>Join Room Debug</h1>
          <p>Debugging room join issue for code: <strong>${code}</strong> and player: <strong>${playerName}</strong></p>
          
          <h2>Steps & Results</h2>
          <div class="steps">
            ${steps.map((step, index) => `
              <div class="step">
                <div class="step-title">${index + 1}. ${step.step}</div>
                <pre>${JSON.stringify(step, null, 2)}</pre>
              </div>
            `).join('')}
          </div>
          
          <h2>Actions</h2>
          <div>
            <a href="/api/debug/reset-test-room" class="button">Reset Test Room</a>
            <a href="/api/debug/join-info" class="button">View Join Debug Info</a>
            <a href="/join" class="button">Go to Join Page</a>
          </div>
        </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error: any) {
    console.error('Error diagnosing join issue:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 