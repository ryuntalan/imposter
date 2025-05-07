import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/debug/test-connection - Test Supabase connection
export async function GET() {
  try {
    // Test basic connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('prompts')
      .select('count')
      .limit(1)
      .maybeSingle();
    
    // Try to get a list of tables - wrapped in try/catch
    let tablesData = null;
    let tablesError = null;
    try {
      const result = await supabase.rpc('dbms_meta.get_tables');
      tablesData = result.data;
      tablesError = result.error;
    } catch (e) {
      tablesError = { message: 'Failed to get tables (expected in some plans)' };
    }
    
    // Try to directly check connection with simple query - wrapped in try/catch
    let versionData = null;
    let versionError = null;
    try {
      const result = await supabase.rpc('postgrest_version');
      versionData = result.data;
      versionError = result.error;
    } catch (e) {
      versionError = { message: 'Failed to get version (expected in some plans)' };
    }
    
    // Check if prompts table exists
    const { data: promptsData, error: promptsError } = await supabase
      .from('prompts')
      .select('*')
      .limit(5);
    
    // Check if rooms table exists
    const { data: roomsData, error: roomsError } = await supabase
      .from('rooms')
      .select('*')
      .limit(5);
    
    // Check if players table exists
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .limit(5);
    
    // Try to retrieve configuration info - wrapped in try/catch
    let configData = null;
    let configError = null;
    try {
      const result = await supabase.rpc('get_project_settings');
      configData = result.data;
      configError = result.error;
    } catch (e) {
      configError = { message: 'Failed to get project settings (expected in some plans)' };
    }
    
    // Get Supabase configuration (only public data)
    const config = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anon_key_exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      service_role_key_exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    };
    
    return NextResponse.json({
      success: !connectionError,
      message: connectionError ? `Connection test failed: ${connectionError.message}` : 'Connection test successful',
      supabase_config: config,
      tables: {
        prompts: {
          exists: !promptsError,
          count: promptsData?.length || 0,
          data: promptsData || [],
          error: promptsError?.message
        },
        rooms: {
          exists: !roomsError,
          count: roomsData?.length || 0,
          data: roomsData || [],
          error: roomsError?.message
        },
        players: {
          exists: !playersError,
          count: playersData?.length || 0,
          data: playersData || [],
          error: playersError?.message
        }
      },
      version_info: versionData,
      version_error: versionError?.message,
      meta_data: tablesData,
      meta_error: tablesError?.message,
      config_data: configData,
      config_error: configError?.message
    });
  } catch (error: any) {
    console.error('Test connection error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error', 
        stack: error.stack
      },
      { status: 500 }
    );
  }
} 