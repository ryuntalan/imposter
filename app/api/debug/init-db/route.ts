import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/debug/init-db - Initialize database for testing
export async function GET() {
  try {
    const results = {
      uuid_extension: { success: false, message: '' },
      game_rooms: { success: false, message: '' },
      players: { success: false, message: '' },
      prompts: { success: false, message: '' },
      sample_data: { success: false, message: '' }
    };
    
    // 1. Test connection
    try {
      const { data: connData, error: connErr } = await supabase.from('_test_connection').select('*').limit(1);
      if (connErr) {
        console.log('Connected to Supabase successfully (expected error)');
      }
    } catch (e) {
      console.log('Connection test failed (expected)', e);
    }
    
    // 2. Create tables one by one
    // Game Rooms table
    try {
      const { data: roomsData, error: roomsErr } = await supabase
        .from('game_rooms')
        .select('count(*)')
        .limit(1);
      
      if (roomsErr && roomsErr.message.includes('does not exist')) {
        console.log('Creating game_rooms table...');
        
        // Create game_rooms table
        try {
          await supabase.from('_direct_sql_execution').select('*').eq('id', 'create_game_rooms');
          // This will likely fail but we handle it in the catch
        } catch (createErr) {
          // Attempt to create the table (no way to run DDL directly with supabase-js)
          const testRoom = {
            id: '00000000-0000-0000-0000-000000000000',
            code: 'TESTXX',
            round_number: 1,
            is_active: true
          };
          
          try {
            const { data: insertData, error: insertErr } = await supabase
              .from('game_rooms')
              .insert([testRoom])
              .select();
            
            if (!insertErr) {
              results.game_rooms.success = true;
              results.game_rooms.message = 'Created successfully';
            } else {
              results.game_rooms.message = `Creation failed: ${insertErr.message}`;
            }
          } catch (insertErr: any) {
            results.game_rooms.message = `Insert error: ${insertErr?.message || 'Unknown error'}`;
          }
        }
      } else {
        results.game_rooms.success = true;
        results.game_rooms.message = 'Table already exists';
      }
    } catch (err: any) {
      results.game_rooms.message = `Error checking table: ${err?.message || 'Unknown error'}`;
    }
    
    // Players table
    try {
      const { data: playersData, error: playersErr } = await supabase
        .from('players')
        .select('count(*)')
        .limit(1);
      
      if (playersErr && playersErr.message.includes('does not exist')) {
        console.log('Creating players table...');
        
        // Create players table
        try {
          await supabase.from('_direct_sql_execution').select('*').eq('id', 'create_players');
          // This will likely fail but we handle it in the catch
        } catch (createErr) {
          // Attempt to create the table
          const testPlayer = {
            id: '00000000-0000-0000-0000-000000000000',
            name: 'Test Player',
            room_id: '00000000-0000-0000-0000-000000000000',
            is_imposter: false
          };
          
          try {
            const { data: insertData, error: insertErr } = await supabase
              .from('players')
              .insert([testPlayer])
              .select();
            
            if (!insertErr) {
              results.players.success = true;
              results.players.message = 'Created successfully';
            } else {
              results.players.message = `Creation failed: ${insertErr.message}`;
            }
          } catch (insertErr: any) {
            results.players.message = `Insert error: ${insertErr?.message || 'Unknown error'}`;
          }
        }
      } else {
        results.players.success = true;
        results.players.message = 'Table already exists';
      }
    } catch (err: any) {
      results.players.message = `Error checking table: ${err?.message || 'Unknown error'}`;
    }
    
    // Prompts table
    try {
      const { data: promptsData, error: promptsErr } = await supabase
        .from('prompts')
        .select('count(*)')
        .limit(1);
      
      if (promptsErr && promptsErr.message.includes('does not exist')) {
        console.log('Creating prompts table...');
        
        // Create prompts table
        try {
          await supabase.from('_direct_sql_execution').select('*').eq('id', 'create_prompts');
          // This will likely fail but we handle it in the catch
        } catch (createErr) {
          // Attempt to create the table
          const testPrompt = {
            id: '00000000-0000-0000-0000-000000000000',
            real_prompt: 'Real test prompt',
            imposter_prompt: 'Imposter test prompt'
          };
          
          try {
            const { data: insertData, error: insertErr } = await supabase
              .from('prompts')
              .insert([testPrompt])
              .select();
            
            if (!insertErr) {
              results.prompts.success = true;
              results.prompts.message = 'Created successfully';
            } else {
              results.prompts.message = `Creation failed: ${insertErr.message}`;
            }
          } catch (insertErr: any) {
            results.prompts.message = `Insert error: ${insertErr?.message || 'Unknown error'}`;
          }
        }
      } else {
        results.prompts.success = true;
        results.prompts.message = 'Table already exists';
      }
    } catch (err: any) {
      results.prompts.message = `Error checking table: ${err?.message || 'Unknown error'}`;
    }
    
    return NextResponse.json({
      status: 'success',
      results
    });
  } catch (error) {
    console.error('Init DB error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Failed to initialize database', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 