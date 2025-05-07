'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DebugPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testName, setTestName] = useState<string>('Test User');
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM pg_tables WHERE schemaname = \'public\';');
  
  const runDebugAction = async (endpoint: string, label: string, method: string = 'GET', body?: any) => {
    setLoading(label);
    setError(null);
    
    try {
      const options: RequestInit = {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      };
      
      if (body && method === 'POST') {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(`/api/debug/${endpoint}`, options);
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(`Error running ${label}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(null);
    }
  };
  
  const testCreateRoom = async () => {
    setLoading('Create Room Test');
    setError(null);
    
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hostName: testName }),
      });
      
      const data = await response.json();
      setResults({ 
        status: response.ok ? 'success' : 'error',
        statusCode: response.status,
        data 
      });
      
      if (!response.ok) {
        setError(`Error: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError(`Error testing room creation: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(null);
    }
  };
  
  const runDirectQuery = async () => {
    if (!sqlQuery.trim()) {
      setError('Please enter a SQL query');
      return;
    }
    
    setLoading('Direct Query');
    setError(null);
    
    try {
      const response = await fetch('/api/debug/direct-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sqlQuery }),
      });
      
      const data = await response.json();
      setResults(data);
      
      if (!data.success) {
        setError(`Query error: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError(`Error executing query: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(null);
    }
  };
  
  const prettyPrintResults = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return `[Error formatting results: ${e instanceof Error ? e.message : 'Unknown error'}]`;
    }
  };
  
  return (
    <main className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Database Debug Tools</h1>
          <Link 
            href="/"
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 transition-colors font-medium"
          >
            Back to Home
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Database Tools</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => runDebugAction('check-db', 'Check Database')}
              disabled={loading !== null}
              className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 disabled:bg-gray-400 font-medium"
            >
              {loading === 'Check Database' ? 'Checking...' : 'Check Database Status'}
            </button>
            
            <button
              onClick={() => runDebugAction('test-connection', 'Test Connection')}
              disabled={loading !== null}
              className="px-4 py-2 bg-teal-700 text-white rounded hover:bg-teal-800 disabled:bg-gray-400 font-medium"
            >
              {loading === 'Test Connection' ? 'Testing...' : 'Test Supabase Connection'}
            </button>
            
            <button
              onClick={() => runDebugAction('init-db', 'Initialize Database')}
              disabled={loading !== null}
              className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 disabled:bg-gray-400 font-medium"
            >
              {loading === 'Initialize Database' ? 'Initializing...' : 'Initialize Database'}
            </button>
            
            <button
              onClick={() => runDebugAction('sql-init', 'SQL Initialize')}
              disabled={loading !== null}
              className="px-4 py-2 bg-purple-700 text-white rounded hover:bg-purple-800 disabled:bg-gray-400 font-medium"
            >
              {loading === 'SQL Initialize' ? 'Running SQL...' : 'Initialize with SQL'}
            </button>
            
            <button
              onClick={() => runDebugAction('tables-info', 'Table Info')}
              disabled={loading !== null}
              className="px-4 py-2 bg-yellow-700 text-white rounded hover:bg-yellow-800 disabled:bg-gray-400 font-medium"
            >
              {loading === 'Table Info' ? 'Fetching...' : 'Get Table Details'}
            </button>
            
            <button
              onClick={() => runDebugAction('direct-create-tables', 'Create Tables', 'POST')}
              disabled={loading !== null}
              className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 disabled:bg-gray-400 font-medium"
            >
              {loading === 'Create Tables' ? 'Creating...' : 'Create Tables Directly'}
            </button>
            
            <button
              onClick={() => runDebugAction('create-schema', 'Create Schema', 'POST')}
              disabled={loading !== null}
              className="px-4 py-2 bg-pink-700 text-white rounded hover:bg-pink-800 disabled:bg-gray-400 font-medium"
            >
              {loading === 'Create Schema' ? 'Creating...' : 'Create Schema (Simplified)'}
            </button>
            
            <button
              onClick={() => runDebugAction('fix-schema', 'Fix Schema', 'POST')}
              disabled={loading !== null}
              className="px-4 py-2 bg-emerald-700 text-white rounded hover:bg-emerald-800 disabled:bg-gray-400 font-medium"
            >
              {loading === 'Fix Schema' ? 'Fixing...' : 'Fix Schema (Circular Dependency)'}
            </button>
            
            <button
              onClick={() => runDebugAction('direct-table-check', 'Check Tables')}
              disabled={loading !== null}
              className="px-4 py-2 bg-orange-700 text-white rounded hover:bg-orange-800 disabled:bg-gray-400 font-medium"
            >
              {loading === 'Check Tables' ? 'Checking...' : 'Check Tables (Admin)'}
            </button>
            
            <button
              onClick={() => runDebugAction('create-answers-table', 'Create Answers Table', 'POST')}
              disabled={loading !== null}
              className="px-4 py-2 bg-violet-700 text-white rounded hover:bg-violet-800 disabled:bg-gray-400 font-medium"
            >
              {loading === 'Create Answers Table' ? 'Creating...' : 'Create Answers Table'}
            </button>
          </div>
        </div>
        
        <div className="mb-8 p-6 bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 text-white">Test Room Creation</h2>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label htmlFor="testName" className="block text-base font-medium text-gray-200 mb-2">
                Host Name
              </label>
              <input
                id="testName"
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white text-base"
                disabled={loading !== null}
              />
            </div>
            <button
              onClick={testCreateRoom}
              disabled={loading !== null || !testName.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-500 font-medium text-base"
            >
              {loading === 'Create Room Test' ? 'Creating...' : 'Test Create Room'}
            </button>
          </div>
        </div>
        
        <div className="mb-8 p-6 bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 text-white">Direct SQL Query</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="sqlQuery" className="block text-base font-medium text-gray-200 mb-2">
                SQL Query
              </label>
              <textarea
                id="sqlQuery"
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white text-base font-mono"
                disabled={loading !== null}
                placeholder="Enter SQL query..."
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={runDirectQuery}
                disabled={loading !== null || !sqlQuery.trim()}
                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:bg-gray-500 font-medium text-base"
              >
                {loading === 'Direct Query' ? 'Running Query...' : 'Execute SQL Query'}
              </button>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="mb-8 p-5 bg-red-700 border border-red-900 text-white rounded-md font-medium text-base">
            {error}
          </div>
        )}
        
        {results && (
          <div className="p-6 bg-white shadow-md rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Results</h2>
            <pre className="bg-gray-900 text-white p-4 rounded-md overflow-auto max-h-[600px] text-base font-mono">
              {prettyPrintResults(results)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
} 