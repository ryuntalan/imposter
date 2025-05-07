import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// POST /api/debug/run-migration?migration=create_game_state_table
export async function POST(request: Request) {
  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    const url = new URL(request.url);
    const migrationName = url.searchParams.get('migration') || 'create_game_state_table';
    
    // Path to migration file
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', `${migrationName}.sql`);
    
    // Check if migration file exists
    if (!fs.existsSync(migrationPath)) {
      return NextResponse.json({
        success: false,
        error: `Migration file ${migrationName}.sql not found`
      }, { status: 404 });
    }
    
    // Read migration file
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the SQL
    const { error } = await supabaseAdmin.rpc('system.sql', {
      query: migrationSql
    });
    
    if (error) {
      console.error('Error executing migration:', error);
      
      return NextResponse.json({
        success: false,
        error: `Failed to execute migration: ${error.message}`,
        details: error
      }, { status: 500 });
    }
    
    // Check if game_state table exists now
    const { data: checkData, error: checkError } = await supabaseAdmin
      .from('game_state')
      .select('count(*)')
      .single();
    
    // Try to insert a test record for the problematic room
    let insertResult;
    try {
      const { data: insertData, error: insertError } = await supabaseAdmin
        .from('game_state')
        .upsert({
          room_id: '2b261041-18f4-4906-9985-36ec28a5f2b2', // The problematic room ID
          round: 1,
          current_stage: 'discussion_voting'
        }, {
          onConflict: 'room_id, round'
        });
      
      insertResult = {
        success: !insertError,
        data: insertData,
        error: insertError ? insertError.message : null
      };
    } catch (insertErr) {
      insertResult = {
        success: false,
        error: insertErr instanceof Error ? insertErr.message : String(insertErr)
      };
    }
    
    return NextResponse.json({
      success: true,
      message: 'Migration executed successfully',
      tableCheck: {
        exists: !checkError,
        data: checkData,
        error: checkError ? checkError.message : null
      },
      insertResult
    });
    
  } catch (error: any) {
    console.error('Unexpected error executing migration:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error.stack
    }, { status: 500 });
  }
} 