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
    <main className="flex min-h-screen flex-col items-center justify-center bg-primary p-4">
      <div className="flex-grow flex flex-col justify-center items-center w-full space-y-6 p-4 sm:p-6 md:p-8 bg-white rounded-xl m-5 sm:m-10 md:m-20 lg:m-20 
                    max-h-[calc(100vh-40px)] sm:max-h-[calc(100vh-80px)] md:max-h-[calc(100vh-160px)]
                    max-w-[calc(100vw-40px)] sm:max-w-[calc(100vw-80px)] md:max-w-[calc(100vw-160px)]">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium text-black mb-4 font-heading">Join a Game</h1>
          <p className="text-gray-600 mb-6">Enter the room code to join the game</p>
        </div>

        <form className="mt-8 space-y-6 w-full max-w-md" onSubmit={handleSubmit}>
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
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
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
                className="appearance-none uppercase relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder="Enter room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                disabled={isLoading}
                maxLength={6}
              />
            </div>
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
              disabled={isLoading || !playerName.trim() || !roomCode.trim()}
              className="w-1/2 flex justify-center py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-primary/70 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Joining...' : 'Join Game'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
} 