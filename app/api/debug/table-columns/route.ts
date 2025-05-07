import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/debug/table-columns - Check columns in the rooms table
export async function GET() {
  try {
    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Get list of existing tables directly
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .limit(1);
    
    // Create a function to check if a column exists by attempting to use it
    const testColumn = async (columnName: string) => {
      try {
        // Try to use the column in a query
        const query = `select:${columnName}`;
        const { error } = await supabaseAdmin
          .from('rooms')
          .select(query)
          .limit(1);
        
        // If the column doesn't exist, it will error specifically about that column
        return {
          exists: !error || !error.message.includes(columnName),
          error: error ? error.message : null
        };
      } catch (e) {
        return {
          exists: false,
          error: e instanceof Error ? e.message : 'Unknown error'
        };
      }
    };
    
    // Check both column names
    const currentRoundCheck = await testColumn('current_round');
    const roundNumberCheck = await testColumn('round_number');
    
    return NextResponse.json({
      success: true,
      table_exists: !error,
      table_error: error ? error.message : null,
      columns: {
        current_round: currentRoundCheck,
        round_number: roundNumberCheck
      },
      recommendation: currentRoundCheck.exists ? 'current_round' : 'round_number'
    });
  } catch (error: any) {
    console.error('Column check error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 