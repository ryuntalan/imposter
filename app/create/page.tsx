'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useGameState } from '@/lib/context';

export default function CreateGame() {
  const [hostName, setHostName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { setCurrentPlayer } = useGameState();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Enhanced error tracking
      console.log('Submitting create room request with host name:', hostName);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // Increase timeout to 20 seconds
      
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hostName }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      let data;
      let responseText;
      
      if (isJson) {
        data = await response.json();
        responseText = JSON.stringify(data);
      } else {
        responseText = await response.text();
        console.error('Non-JSON response:', responseText);
        data = { error: 'Unexpected response format from server' };
      }
      
      console.log('Create room response:', response.status, response.ok ? 'OK' : 'Failed', 
                  'Content-Type:', contentType, 'Data:', responseText.substring(0, 500));

      if (!response.ok) {
        // Log the error for debugging
        try {
          await fetch('/api/debug/client-log', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              error: data, 
              context: 'Create Room Form',
              response: {
                status: response.status,
                statusText: response.statusText,
                contentType,
                responseText: responseText.substring(0, 1000)
              }
            }),
          });
        } catch (logErr) {
          console.error('Error logging error:', logErr);
        }
        
        throw new Error(data.error || `Server error: ${response.status} ${response.statusText}`);
      }

      // Update the current player in the game state
      setCurrentPlayer({
        id: data.player.id,
        name: data.player.name,
        room_id: data.room.id,
        is_imposter: false,
        joined_at: new Date().toISOString()
      });

      // Store player data in localStorage as a backup
      try {
        localStorage.setItem('player_data', JSON.stringify({
          id: data.player.id,
          name: data.player.name,
          room_id: data.room.id,
          is_imposter: false,
          joined_at: new Date().toISOString()
        }));
      } catch (storageErr) {
        console.warn('Failed to store player data in localStorage:', storageErr);
      }

      // Redirect to the game room
      router.push(`/room/${data.room.code}`);
    } catch (err: any) {
      console.error('Error creating game:', err);
      
      let errorMessage = 'An unknown error occurred';
      
      if (err.name === 'AbortError') {
        errorMessage = 'Request timed out. The server took too long to respond. Please try again.';
      } else if (err.message) {
        errorMessage = err.message;
        
        // Add additional context if it's a fetch error
        if (err.message === 'Failed to fetch' || err.message.includes('fetch failed')) {
          errorMessage = 'Network error: Could not connect to the server. Please check your internet connection and try again.';
        } else if (err.message.includes('Database configuration error')) {
          errorMessage = 'Database configuration error: The game server is not properly configured. Please contact the game administrator.';
        } else if (err.message.includes('Network error')) {
          // This is from our improved server-side error handling
          errorMessage = err.message + '\n\nTroubleshooting tips:\n1. Check your internet connection\n2. Try again in a few moments\n3. If the problem persists, the database server might be down';
        }
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-primary p-4">
      <div className="flex-grow flex flex-col justify-center items-center w-full space-y-6 p-4 sm:p-6 md:p-8 bg-white rounded-xl m-5 sm:m-10 md:m-20 lg:m-20 
                    max-h-[calc(100vh-40px)] sm:max-h-[calc(100vh-80px)] md:max-h-[calc(100vh-160px)]
                    max-w-[calc(100vw-40px)] sm:max-w-[calc(100vw-80px)] md:max-w-[calc(100vw-160px)]">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium text-black mb-4 font-heading">Create a Game</h1>
          <p className="text-gray-600 mb-6">Host a new game for your friends to join</p>
        </div>

        <form className="mt-8 space-y-6 w-full max-w-md" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="hostName" className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              id="hostName"
              name="hostName"
              type="text"
              required
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
              placeholder="Enter your name"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="bg-red-50 p-4 rounded-md border border-red-200 text-red-700 text-sm mb-4">
              <div className="font-bold mb-1">Error:</div>
              <div>{error}</div>
            </div>
          )}

          <div className="flex gap-4">
            <Link
              href="/"
              className="w-1/2 flex justify-center py-2 px-4 border border-primary rounded-md text-sm font-medium text-primary bg-white hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading || !hostName.trim()}
              className="w-1/2 flex justify-center py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-primary/70 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Game'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
} 