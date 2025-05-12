import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Define result type for better type safety
type CleanupResult = {
  room_id: string;
  round: number;
  success: boolean;
  message?: string;
  error?: string;
};

// This endpoint specifically focuses on cleaning up duplicate game state records
export async function GET() {
  // Only allow in development or when explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_ENDPOINTS !== 'true') {
    return NextResponse.json({ error: 'This endpoint is disabled in production' }, { status: 403 });
  }
  
  try {
    // Create a Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase credentials'
      }, { status: 500 });
    }
    
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Get all duplicate game state entries
    const duplicateCheckSql = `
      SELECT room_id, round, COUNT(*) as count 
      FROM game_state 
      GROUP BY room_id, round 
      HAVING COUNT(*) > 1
    `;
    
    const { data: duplicateData, error: duplicateError } = await adminClient.rpc('system.sql', {
      query: duplicateCheckSql
    });
    
    if (duplicateError) {
      return NextResponse.json({
        success: false,
        error: `Error checking for duplicates: ${duplicateError.message}`,
        details: duplicateError
      }, { status: 500 });
    }
    
    if (!duplicateData || !Array.isArray(duplicateData) || duplicateData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No duplicate game state records found!',
        duplicates: 0
      });
    }
    
    console.log(`Found ${duplicateData.length} room/round combinations with duplicate records`);
    
    // Clean up duplicates
    const results: CleanupResult[] = [];
    for (const duplicate of duplicateData) {
      const roomId = duplicate.room_id;
      const round = duplicate.round;
      const count = duplicate.count;
      
      console.log(`Processing duplicates for room ${roomId}, round ${round}: ${count} records`);
      
      // Get all records for this room and round, ordered by most recent first
      const { data: records, error: recordsError } = await adminClient
        .from('game_state')
        .select('id, current_stage, last_updated')
        .eq('room_id', roomId)
        .eq('round', round)
        .order('last_updated', { ascending: false });
      
      if (recordsError) {
        results.push({
          room_id: roomId,
          round,
          success: false,
          error: recordsError.message
        });
        continue;
      }
      
      if (!records || records.length <= 1) {
        results.push({
          room_id: roomId,
          round,
          success: true,
          message: 'No duplicates found in this check'
        });
        continue;
      }
      
      // Keep the most recent record
      const keepId = records[0].id;
      const deleteIds = records.slice(1).map(r => r.id);
      
      // Delete all other records
      const { error: deleteError } = await adminClient
        .from('game_state')
        .delete()
        .in('id', deleteIds);
      
      if (deleteError) {
        results.push({
          room_id: roomId,
          round,
          success: false,
          error: deleteError.message
        });
      } else {
        results.push({
          room_id: roomId,
          round,
          success: true,
          message: `Deleted ${deleteIds.length} duplicate records, kept ID ${keepId}`
        });
      }
    }
    
    // Count successful cleanups
    const successCount = results.filter(r => r.success).length;
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up duplicates from ${successCount}/${duplicateData.length} room/round combinations`,
      details: results
    });
    
  } catch (error: any) {
    console.error('Error cleaning up game state duplicates:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error
    }, { status: 500 });
  }
} 