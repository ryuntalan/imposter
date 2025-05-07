import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

// Define types for our results objects
interface FileSystemInfo {
  join_api_exists?: boolean;
  file_path?: string;
  file_size?: number;
  created_at?: string;
  modified_at?: string;
  searched_path?: string;
  parent_directory_exists?: boolean;
  parent_directory_contents?: string[];
}

interface DatabaseInfo {
  connection_success?: boolean;
  connection_error?: string | null;
  tables_exist?: boolean;
  test_room?: {
    exists: boolean;
    error: string | null;
    data: any;
  };
}

// GET /api/debug/join-info - Check if the join endpoint exists and is working
export async function GET(request: Request) {
  try {
    const results = {
      success: true,
      environment: {},
      filesystem: {} as FileSystemInfo,
      api_routes: {},
      database: {} as DatabaseInfo
    };
    
    // Check environment
    results.environment = {
      node_env: process.env.NODE_ENV,
      next_runtime: process.env.NEXT_RUNTIME,
      next_version: process.env.NEXT_VERSION,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'exists' : 'missing',
      supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'exists' : 'missing',
      supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'exists' : 'missing'
    };
    
    // Check filesystem for the route file
    const projectRoot = process.cwd();
    const joinApiPath = join(projectRoot, 'app/api/rooms/join/route.ts');
    
    if (existsSync(joinApiPath)) {
      const stats = statSync(joinApiPath);
      results.filesystem = {
        join_api_exists: true,
        file_path: joinApiPath,
        file_size: stats.size,
        created_at: stats.birthtime.toISOString(),
        modified_at: stats.mtime.toISOString()
      };
    } else {
      results.filesystem = {
        join_api_exists: false,
        searched_path: joinApiPath
      };
      
      // Check parent directory
      const parentDir = join(projectRoot, 'app/api/rooms');
      if (existsSync(parentDir)) {
        results.filesystem.parent_directory_exists = true;
        
        // List files in parent directory
        const { readdirSync } = require('fs');
        results.filesystem.parent_directory_contents = readdirSync(parentDir);
      } else {
        results.filesystem.parent_directory_exists = false;
      }
    }
    
    // Check database
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Check tables
    const { data: tablesData, error: tablesError } = await supabaseAdmin
      .from('rooms')
      .select('count')
      .limit(1);
      
    results.database = {
      connection_success: !tablesError,
      connection_error: tablesError ? tablesError.message : null,
      tables_exist: !!tablesData
    };
    
    // Check if TEST12 room exists
    const { data: testRoom, error: testRoomError } = await supabaseAdmin
      .from('rooms')
      .select('*, players(*)')
      .eq('code', 'TEST12')
      .maybeSingle();
      
    results.database.test_room = {
      exists: !!testRoom,
      error: testRoomError ? testRoomError.message : null,
      data: testRoom
    };
    
    // Create HTML response with debug info and a form to test the join endpoint
    return new Response(`
      <html>
        <head>
          <title>Join API Debug Info</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
            h1, h2 { color: #4f46e5; }
            .success { color: green; }
            .error { color: #dc2626; }
            .warning { color: #d97706; }
            pre { background: #f5f5f5; padding: 1rem; border-radius: 0.5rem; overflow: auto; }
            .button { display: inline-block; background: #4f46e5; color: white; padding: 0.5rem 1rem; 
                     text-decoration: none; border-radius: 0.25rem; margin-top: 1rem; }
            form { background: #f9fafb; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; }
            input, button { padding: 0.5rem; margin: 0.5rem 0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
          </style>
        </head>
        <body>
          <h1>Join API Debug Information</h1>
          
          <div class="grid">
            <div>
              <h2>Environment</h2>
              <pre>${JSON.stringify(results.environment, null, 2)}</pre>
              
              <h2>Filesystem</h2>
              <pre>${JSON.stringify(results.filesystem, null, 2)}</pre>
            </div>
            
            <div>
              <h2>Database</h2>
              <pre>${JSON.stringify(results.database, null, 2)}</pre>
              
              <h2>Test Join Endpoint</h2>
              <form id="testForm">
                <div>
                  <label for="playerName">Player Name:</label><br>
                  <input type="text" id="playerName" name="playerName" value="TestPlayer" required>
                </div>
                <div>
                  <label for="roomCode">Room Code:</label><br>
                  <input type="text" id="roomCode" name="roomCode" value="TEST12" required maxlength="6">
                </div>
                <button type="submit">Test Join Endpoint</button>
              </form>
              
              <div id="result" style="display: none;">
                <h3>Test Result:</h3>
                <pre id="resultContent"></pre>
              </div>
            </div>
          </div>
          
          <div>
            <h2>Helpful Links</h2>
            <ul>
              <li><a href="/api/debug/reset-test-room" target="_blank">Reset Test Room</a></li>
              <li><a href="/join" target="_blank">Go to Join Page</a></li>
              <li><a href="/api/debug/test-dynamic-route/test" target="_blank">Test Dynamic Routes</a></li>
            </ul>
          </div>
          
          <script>
            document.getElementById('testForm').addEventListener('submit', async (e) => {
              e.preventDefault();
              const playerName = document.getElementById('playerName').value;
              const roomCode = document.getElementById('roomCode').value;
              
              try {
                const response = await fetch('/api/debug/test-join-api', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ playerName, roomCode }),
                });
                
                const data = await response.json();
                
                const resultDiv = document.getElementById('result');
                const resultContent = document.getElementById('resultContent');
                
                resultDiv.style.display = 'block';
                resultContent.textContent = JSON.stringify(data, null, 2);
                
                if (data.success) {
                  resultContent.style.color = 'green';
                } else {
                  resultContent.style.color = '#dc2626';
                }
              } catch (error) {
                const resultDiv = document.getElementById('result');
                const resultContent = document.getElementById('resultContent');
                
                resultDiv.style.display = 'block';
                resultContent.textContent = 'Error: ' + error.message;
                resultContent.style.color = '#dc2626';
              }
            });
          </script>
        </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error: any) {
    console.error('Error getting join info:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 