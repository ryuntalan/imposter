'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useGameState } from '@/lib/context';

export default function JoinGame() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { setCurrentPlayer } = useGameState();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerName, roomCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join game');
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
      setError(err.message || 'An error occurred');
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div>
          <h1 className="text-center text-3xl font-extrabold text-gray-900 mb-2">Join a Game</h1>
          <p className="text-center text-gray-600 mb-6">Enter the room code to join the game</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                id="playerName"
                name="playerName"
                type="text"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="roomCode" className="block text-sm font-medium text-gray-700 mb-1">
                Room Code
              </label>
              <input
                id="roomCode"
                name="roomCode"
                type="text"
                required
                className="appearance-none uppercase relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Enter room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                disabled={isLoading}
                maxLength={6}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
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
              disabled={isLoading || !playerName.trim() || !roomCode.trim()}
              className="w-1/2 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Joining...' : 'Join Game'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
} 