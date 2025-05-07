import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/debug/room-connection - Test database connection and tables
export async function GET(request: Request) {
  try {
    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Test basic connection by querying all tables
    const { data: roomsData, error: roomsError } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .limit(10);
    
    const { data: playersData, error: playersError } = await supabaseAdmin
      .from('players')
      .select('*')
      .limit(10);
    
    const { data: promptsData, error: promptsError } = await supabaseAdmin
      .from('prompts')
      .select('*')
      .limit(10);
    
    const { data: answersData, error: answersError } = await supabaseAdmin
      .from('answers')
      .select('*')
      .limit(10);
    
    return NextResponse.json({
      success: true,
      connection: 'Connected to Supabase',
      tables: {
        rooms: {
          success: !roomsError,
          error: roomsError ? roomsError.message : null,
          count: roomsData ? roomsData.length : 0,
          data: roomsData
        },
        players: {
          success: !playersError,
          error: playersError ? playersError.message : null,
          count: playersData ? playersData.length : 0,
          data: playersData
        },
        prompts: {
          success: !promptsError,
          error: promptsError ? promptsError.message : null,
          count: promptsData ? promptsData.length : 0
        },
        answers: {
          success: !answersError,
          error: answersError ? answersError.message : null,
          count: answersData ? answersData.length : 0
        }
      }
    });
  } catch (error: any) {
    console.error('Debug connection error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 