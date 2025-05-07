import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface DebugResults {
  tables: {
    rooms?: { exists: boolean; error: string | null };
    players?: { exists: boolean; error: string | null };
    prompts?: { exists: boolean; error: string | null };
    answers?: { exists: boolean; error: string | null };
    [key: string]: any;
  };
  functions: {
    generate_room_code?: { 
      exists: boolean; 
      result?: any; 
      error: string | null 
    };
    [key: string]: any;
  };
  extensions: {
    error?: string;
    data?: any[];
    has_uuid_ossp?: boolean;
    uuid_ossp?: { exists: boolean; error: string | null };
    [key: string]: any;
  };
}

// GET /api/debug/check-db - Check database setup
export async function GET() {
  const results: DebugResults = {
    tables: {},
    functions: {},
    extensions: {}
  };
  
  try {
    // Check UUID extension
    try {
      const { data: extensions, error } = await supabase
        .from('pg_extension')
        .select('extname')
        .eq('extname', 'uuid-ossp')
        .maybeSingle();
      
      results.extensions.uuid_ossp = {
        exists: !error && extensions !== null,
        error: error ? error.message : null
      };
    } catch (e) {
      results.extensions.uuid_ossp = {
        exists: false,
        error: e instanceof Error ? e.message : 'Unknown error'
      };
    }
    
    // Check if generate_room_code function exists
    try {
      const { data: roomCodeData, error: roomCodeError } = await supabase.rpc('generate_room_code');
      
      results.functions.generate_room_code = {
        exists: !roomCodeError,
        result: roomCodeData,
        error: roomCodeError ? roomCodeError.message : null
      };
    } catch (e) {
      results.functions.generate_room_code = {
        exists: false,
        error: e instanceof Error ? e.message : 'Unknown error'
      };
    }
    
    // Check rooms table
    const { data: roomsData, error: roomsError } = await supabase
      .from('rooms')
      .select('count(*)')
      .limit(1);
      
    results.tables.rooms = {
      exists: !roomsError,
      error: roomsError ? roomsError.message : null
    };
    
    // Check players table
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('count(*)')
      .limit(1);
      
    results.tables.players = {
      exists: !playersError,
      error: playersError ? playersError.message : null
    };
    
    // Check prompts table
    const { data: promptsData, error: promptsError } = await supabase
      .from('prompts')
      .select('count(*)')
      .limit(1);
      
    results.tables.prompts = {
      exists: !promptsError,
      error: promptsError ? promptsError.message : null
    };
    
    // Check answers table
    const { data: answersData, error: answersError } = await supabase
      .from('answers')
      .select('count(*)')
      .limit(1);
      
    results.tables.answers = {
      exists: !answersError,
      error: answersError ? answersError.message : null
    };
    
    return NextResponse.json({
      status: 'success',
      results
    });
  } catch (error) {
    console.error('Debug check-db error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : null },
      { status: 500 }
    );
  }
} 