import { NextResponse } from 'next/server';

// GET /api/debug/sql-init - Initialize database with SQL
export async function GET() {
  try {
    // Get Supabase credentials from environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase credentials not found' },
        { status: 500 }
      );
    }
    
    // SQL statements to execute
    const queries = [
      // Add UUID extension
      `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
      
      // Create rooms table
      `
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(6) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        round_number INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE
      );
      `,
      
      // Create players table
      `
      CREATE TABLE IF NOT EXISTS players (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(50) NOT NULL,
        room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
        is_imposter BOOLEAN DEFAULT FALSE,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      `,
      
      // Create prompts table
      `
      CREATE TABLE IF NOT EXISTS prompts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        real_prompt TEXT NOT NULL,
        imposter_prompt TEXT NOT NULL
      );
      `,
      
      // Create answers table
      `
      CREATE TABLE IF NOT EXISTS answers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
        answer TEXT NOT NULL,
        round SMALLINT NOT NULL
      );
      `,
      
      // Create indexes
      `CREATE INDEX IF NOT EXISTS rooms_code_idx ON rooms(code);`,
      `CREATE INDEX IF NOT EXISTS players_room_id_idx ON players(room_id);`,
      
      // Create room code function
      `
      CREATE OR REPLACE FUNCTION generate_room_code() RETURNS VARCHAR(6) AS $$
      DECLARE
        chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        result VARCHAR(6) := '';
        i INTEGER := 0;
        pos INTEGER := 0;
      BEGIN
        FOR i IN 1..6 LOOP
          pos := 1 + FLOOR(RANDOM() * LENGTH(chars))::INTEGER;
          result := result || SUBSTRING(chars FROM pos FOR 1);
        END LOOP;
        RETURN result;
      END;
      $$ LANGUAGE plpgsql VOLATILE;
      `,
      
      // Add foreign key constraint
      `
      ALTER TABLE rooms 
      ADD CONSTRAINT fk_host_player 
      FOREIGN KEY (host_id) REFERENCES players(id) ON DELETE SET NULL;
      `
    ];
    
    const results = [];
    let success = true;
    
    // Execute each SQL statement
    for (const query of queries) {
      try {
        // Execute SQL directly with Supabase REST API
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            query: query
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          results.push({
            success: false,
            error: errorData.message || 'Unknown error',
            sql: query.substring(0, 50) + '...'
          });
          success = false;
        } else {
          results.push({
            success: true,
            sql: query.substring(0, 50) + '...'
          });
        }
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          sql: query.substring(0, 50) + '...'
        });
        success = false;
      }
    }
    
    return NextResponse.json({
      status: success ? 'success' : 'partial_success',
      results
    });
  } catch (error) {
    console.error('SQL init error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Failed to initialize database with SQL', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}