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
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hostName }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Log the error for debugging
        try {
          await fetch('/api/debug/log-error', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              error: data, 
              context: 'Create Room Form' 
            }),
          });
        } catch (logErr) {
          console.error('Error logging error:', logErr);
        }
        
        throw new Error(data.error || 'Failed to create game');
      }

      // Update the current player in the game state
      setCurrentPlayer({
        id: data.player.id,
        name: data.player.name,
        room_id: data.room.id,
        is_imposter: false,
        joined_at: new Date().toISOString()
      });

      // Redirect to the game room
      router.push(`/room/${data.room.code}`);
    } catch (err: any) {
      console.error('Error creating game:', err);
      setError(err.message || 'An error occurred');
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div>
          <h1 className="text-center text-3xl font-extrabold text-gray-900 mb-2">Create a Game</h1>
          <p className="text-center text-gray-600 mb-6">Host a new game for your friends to join</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="hostName" className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              id="hostName"
              name="hostName"
              type="text"
              required
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
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
              className="w-1/2 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading || !hostName.trim()}
              className="w-1/2 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Game'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
} 