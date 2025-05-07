import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/debug/create-answers-table - Create the answers table if it doesn't exist
export async function POST() {
  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Check if answers table exists
    const { data: checkData, error: checkError } = await supabaseAdmin
      .from('answers')
      .select('id')
      .limit(1);
    
    // If no error, table exists - return early
    if (!checkError) {
      return NextResponse.json({
        success: true,
        message: 'Answers table already exists',
        existingTable: true
      });
    }
    
    // Create the answers table
    const createSql = `
      CREATE TABLE IF NOT EXISTS answers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
        round INTEGER,
        answer_text TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS answers_player_id_idx ON answers(player_id);
      CREATE INDEX IF NOT EXISTS answers_room_id_idx ON answers(room_id);
    `;
    
    try {
      // Try using system.sql RPC first
      const { error: createError } = await supabaseAdmin.rpc('system.sql', {
        query: createSql
      });
      
      if (createError) {
        throw new Error(`Failed to create answers table: ${createError.message}`);
      }
      
      return NextResponse.json({
        success: true,
        message: 'Answers table created successfully'
      });
    } catch (error) {
      console.error('Error creating answers table with system.sql:', error);
      
      // Fallback: try using REST API
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            query: createSql
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to create table via REST: ${errorData.message || response.statusText}`);
        }
        
        return NextResponse.json({
          success: true,
          message: 'Answers table created successfully via REST API'
        });
      } catch (restError) {
        console.error('Error creating answers table via REST:', restError);
        throw restError; // Let the outer catch handle it
      }
    }
  } catch (error: any) {
    console.error('Unexpected error creating answers table:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error',
        details: error.stack
      },
      { status: 500 }
    );
  }
} 