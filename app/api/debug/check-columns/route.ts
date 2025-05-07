import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/debug/check-columns - Check which columns exist in rooms table
export async function GET() {
  try {
    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Just try to get a room and see what columns it has
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .limit(1);
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        details: "Couldn't query rooms table"
      });
    }
    
    // Get column names from the data
    const columnNames = data && data.length > 0 
      ? Object.keys(data[0]) 
      : [];
    
    // If no data, try to create a room
    if (columnNames.length === 0) {
      try {
        const randomCode = 'T' + Math.random().toString(36).substring(2, 7).toUpperCase();
        const { data: insertData, error: insertError } = await supabaseAdmin
          .from('rooms')
          .insert({
            code: randomCode,
            round_number: 1,
            is_active: true
          })
          .select();
        
        if (insertError) {
          return NextResponse.json({
            success: false,
            error: insertError.message,
            details: "Failed to insert test room"
          });
        }
        
        // Get column names from the inserted data
        const insertedColumnNames = insertData && insertData.length > 0 
          ? Object.keys(insertData[0]) 
          : [];
        
        return NextResponse.json({
          success: true,
          columns: insertedColumnNames,
          sample_data: insertData && insertData.length > 0 ? insertData[0] : null
        });
      } catch (e) {
        return NextResponse.json({
          success: false,
          error: e instanceof Error ? e.message : "Unknown error",
          details: "Failed to create test room"
        });
      }
    }
    
    // Also check player table columns
    try {
      const { data: playerData, error: playerError } = await supabaseAdmin
        .from('players')
        .select('*')
        .limit(1);
        
      const playerColumns = playerData && playerData.length > 0
        ? Object.keys(playerData[0])
        : [];
        
      // Check prompt table columns
      const { data: promptData, error: promptError } = await supabaseAdmin
        .from('prompts')
        .select('*')
        .limit(1);
        
      const promptColumns = promptData && promptData.length > 0
        ? Object.keys(promptData[0])
        : [];
        
      // Check answers table columns
      const { data: answerData, error: answerError } = await supabaseAdmin
        .from('answers')
        .select('*')
        .limit(1);
        
      const answerColumns = answerData && answerData.length > 0
        ? Object.keys(answerData[0])
        : [];
    
      return NextResponse.json({
        success: true,
        tables: {
          rooms: {
            columns: columnNames,
            sample_data: data[0] || null
          },
          players: {
            columns: playerColumns,
            error: playerError?.message || null
          },
          prompts: {
            columns: promptColumns,
            error: promptError?.message || null
          },
          answers: {
            columns: answerColumns,
            error: answerError?.message || null
          }
        }
      });
    } catch (e) {
      return NextResponse.json({
        success: true,
        rooms: {
          columns: columnNames,
          sample_data: data[0] || null
        },
        other_tables_error: e instanceof Error ? e.message : "Error checking other tables"
      });
    }
  } catch (error: any) {
    console.error('Column check error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 