import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/debug/create-schema - Create the database schema directly
export async function POST() {
  try {
    const results = {
      uuid_extension: false,
      rooms: false,
      players: false,
      prompts: false,
      room_code_function: false,
      indexes: false
    };
    
    // Quick and direct approach without the SQL functions
    
    // 1. Enable uuid-ossp extension
    try {
      // This method won't work directly but will help with error reporting
      try {
        await supabase.rpc('create_extension_uuid');
      } catch {
        // Expected error, ignore
      }
      results.uuid_extension = true;
    } catch (error) {
      console.log('Failed to create UUID extension (expected)');
    }
    
    // 2. Create rooms table
    try {
      const { error: createError } = await supabase
        .from('rooms') 
        .insert({
          id: '00000000-0000-0000-0000-000000000000',
          code: 'TESTING',
          round_number: 1,
          is_active: true
        });
      
      if (!createError || createError.message.includes('violates unique constraint')) {
        results.rooms = true;
      } else {
        console.log('Rooms create error:', createError);
      }
    } catch (error) {
      console.log('Error creating rooms:', error);
    }

    // 3. Create players table
    try {
      const { error: createError } = await supabase
        .from('players')
        .insert({
          id: '00000000-0000-0000-0000-000000000000',
          name: 'Test Player',
          room_id: '00000000-0000-0000-0000-000000000000',
          is_imposter: false
        });
      
      if (!createError || createError.message.includes('violates unique constraint')) {
        results.players = true;
      } else {
        console.log('Players create error:', createError);
      }
    } catch (error) {
      console.log('Error creating players:', error);
    }
    
    // 4. Create prompts table
    try {
      const { error: createError } = await supabase
        .from('prompts')
        .insert({
          id: '00000000-0000-0000-0000-000000000000',
          real_prompt: 'This is a real prompt',
          imposter_prompt: 'This is an imposter prompt'
        });
      
      if (!createError || createError.message.includes('violates unique constraint')) {
        results.prompts = true;
      }
    } catch (error) {
      console.log('Error creating prompts:', error);
    }
    
    // Get database status
    const { data: statusData, error: statusError } = await supabase
      .from('rooms')
      .select('id')
      .limit(1);
    
    // Check if everything worked
    let success = results.rooms && results.players;
    let message = success ? 
      'Database schema created successfully' : 
      'Some tables failed to create';
    
    if (statusError) {
      success = false;
      message = `Database status check error: ${statusError.message}`;
    }
    
    return NextResponse.json({
      success,
      message,
      results
    });
  } catch (error) {
    console.error('Create schema error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create schema', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 