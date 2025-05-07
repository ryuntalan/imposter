import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/debug/create-votes-table - Create the votes table
export async function POST() {
  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Create the function to create votes table
    const createVotesFunction = `
      CREATE OR REPLACE FUNCTION create_votes_table_if_not_exists()
      RETURNS void AS $$
      BEGIN
        CREATE TABLE IF NOT EXISTS votes (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          voter_id UUID REFERENCES players(id) ON DELETE CASCADE,
          voted_for_id UUID REFERENCES players(id) ON DELETE CASCADE,
          room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
          round INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS votes_voter_id_idx ON votes(voter_id);
        CREATE INDEX IF NOT EXISTS votes_voted_for_id_idx ON votes(voted_for_id);
        CREATE INDEX IF NOT EXISTS votes_room_id_idx ON votes(room_id);
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    // Create the function to create prompts table
    const createPromptsFunction = `
      CREATE OR REPLACE FUNCTION create_prompts_table_if_not_exists()
      RETURNS void AS $$
      BEGIN
        CREATE TABLE IF NOT EXISTS prompts (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          real_prompt TEXT NOT NULL,
          imposter_prompt TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    // Execute function creation
    const { error: functionError } = await supabaseAdmin
      .rpc('exec_sql', { sql: createVotesFunction });
      
    if (functionError) {
      console.error('Error creating votes table function:', functionError);
      return NextResponse.json({
        success: false,
        error: `Failed to create votes table function: ${functionError.message}`
      }, { status: 500 });
    }
    
    // Execute prompts function creation
    const { error: promptsFunctionError } = await supabaseAdmin
      .rpc('exec_sql', { sql: createPromptsFunction });
      
    if (promptsFunctionError) {
      console.error('Error creating prompts table function:', promptsFunctionError);
      // Don't return here - we'll still try to create the votes table
    }
    
    // Execute the function to create the votes table
    const { error: execError } = await supabaseAdmin
      .rpc('create_votes_table_if_not_exists');
      
    if (execError) {
      console.error('Error creating votes table:', execError);
      return NextResponse.json({
        success: false,
        error: `Failed to create votes table: ${execError.message}`
      }, { status: 500 });
    }
    
    // Try to execute the function to create the prompts table
    try {
      await supabaseAdmin.rpc('create_prompts_table_if_not_exists');
      console.log('Prompts table created or already exists');
    } catch (promptsExecError) {
      console.error('Error creating prompts table:', promptsExecError);
      // Continue anyway
    }
    
    return NextResponse.json({
      success: true,
      message: 'Tables creation functions created successfully'
    });
  } catch (error: any) {
    console.error('Error creating votes table:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 