import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/debug/reset-test-room - Reset test room (browser-friendly version)
export async function GET(request: Request) {
  try {
    const code = 'TEST12';
    const hostName = 'TestHost';
    
    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Step 1: Check if the room already exists
    const { data: existingRoom } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .eq('code', code)
      .maybeSingle();
      
    // Step 2: If it exists, delete players and room
    if (existingRoom) {
      // Delete players
      await supabaseAdmin
        .from('players')
        .delete()
        .eq('room_id', existingRoom.id);
      
      // Delete room
      await supabaseAdmin
        .from('rooms')
        .delete()
        .eq('id', existingRoom.id);
    }
    
    // Step 3: Create a new room
    const { data: roomData, error: roomError } = await supabaseAdmin
      .from('rooms')
      .insert([
        { 
          code: code,
          round_number: 1,
          is_active: true
        }
      ])
      .select()
      .single();
    
    if (roomError) {
      throw new Error(`Failed to create room: ${roomError.message}`);
    }
    
    // Step 4: Create a host player
    const { data: playerData, error: playerError } = await supabaseAdmin
      .from('players')
      .insert([
        { 
          name: hostName,
          room_id: roomData.id,
          is_imposter: false
        }
      ])
      .select()
      .single();
    
    if (playerError) {
      throw new Error(`Failed to create player: ${playerError.message}`);
    }
    
    // Create a human-readable HTML response
    return new Response(`
      <html>
        <head>
          <title>Test Room Reset</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
            h1 { color: #4f46e5; }
            .success { color: green; }
            .info { color: #4f46e5; }
            pre { background: #f5f5f5; padding: 1rem; border-radius: 0.5rem; overflow: auto; }
            .button { display: inline-block; background: #4f46e5; color: white; padding: 0.5rem 1rem; 
                     text-decoration: none; border-radius: 0.25rem; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <h1>Test Room Created Successfully</h1>
          <p class="success">✅ Test room with code <strong>${code}</strong> has been reset.</p>
          
          <h2>Room Details:</h2>
          <pre>${JSON.stringify(roomData, null, 2)}</pre>
          
          <h2>Player Details:</h2>
          <pre>${JSON.stringify(playerData, null, 2)}</pre>
          
          <h2>Next Steps:</h2>
          <p class="info">To join this room, use code <strong>${code}</strong> on the join page.</p>
          
          <a href="/join" class="button">Go to Join Page</a>
        </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error: any) {
    console.error('Error resetting test room:', error);
    return new Response(`
      <html>
        <head>
          <title>Error</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
            h1 { color: #dc2626; }
            .error { color: #dc2626; }
            pre { background: #f5f5f5; padding: 1rem; border-radius: 0.5rem; overflow: auto; }
            .button { display: inline-block; background: #4f46e5; color: white; padding: 0.5rem 1rem; 
                     text-decoration: none; border-radius: 0.25rem; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <h1>Error Resetting Test Room</h1>
          <p class="error">${error.message || 'Unknown error'}</p>
          
          <a href="/" class="button">Go to Home Page</a>
        </body>
      </html>
    `, {
      status: 500,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
} 