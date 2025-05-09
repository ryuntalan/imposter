'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RealtimeChannel } from '@supabase/supabase-js';
import { subscribeToRoomPlayers, subscribeToRoom, unsubscribe } from '@/lib/realtime';
import { Player, GameRoom as GameRoomType } from '@/lib/types';
import { useGameState } from '@/lib/context';
import { use } from 'react';
import GameView from './GameView';

export default function GameRoom({ params }: { params: { code: string } }) {
  // Unwrap params to access code (future-proof for Next.js updates)
  const unwrappedParams = use(params as unknown as Promise<{ code: string }>);
  const { code } = unwrappedParams;
  const [room, setRoom] = useState<Partial<GameRoomType> | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingGame, setStartingGame] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const router = useRouter();
  const { currentPlayer } = useGameState();

  // Load room data on initial load and set up real-time subscriptions
  useEffect(() => {
    let roomChannel: RealtimeChannel;
    let playersChannel: RealtimeChannel;
    
    async function setupRealtime() {
      try {
        setLoading(true);
        
        // Check for player data in localStorage
        let validLocalPlayer = false;
        if (typeof window !== 'undefined' && !currentPlayer) {
          const storedPlayerData = localStorage.getItem('player_data');
          if (storedPlayerData) {
            try {
              const storedPlayer = JSON.parse(storedPlayerData);
              console.log('Found stored player data:', storedPlayer);
            } catch (e) {
              console.error('Error parsing stored player:', e);
            }
          }
        }
        
        // First, fetch the initial data
        const response = await fetch(`/api/rooms/${code}`);
        
        // Get the raw text first to ensure we get proper error messages
        const responseText = await response.text();
        let data;
        
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Error parsing room data response:', parseError);
          console.log('Raw response:', responseText.substring(0, 200)); // Log first 200 chars
          setError('Failed to parse server response. Try refreshing the page.');
          setLoading(false);
          return; // Exit early instead of throwing
        }
        
        if (!response.ok) {
          setError(data.error || `Failed to load game room: ${response.status}`);
          setLoading(false);
          return; // Exit early instead of throwing
        }
        
        const roomData = data.room;
        console.log('Room data loaded:', roomData);
        setRoom(roomData);
        
        // Check if the game is already in progress
        if (roomData.round_number > 0) {
          setGameStarted(true);
        }
        
        if (roomData.players) {
          console.log('Initial players:', roomData.players);
          setPlayers(roomData.players);
        }
        
        // Set up real-time subscriptions with error handling
        try {
          roomChannel = subscribeToRoom(roomData.id, (updatedRoom) => {
            console.log('Room updated:', updatedRoom);
            setRoom(prev => {
              const newRoom = { ...prev, ...updatedRoom };
              
              // Check if the game just started - use explicit check for round_number
              if (!gameStarted && newRoom.round_number && newRoom.round_number > 0) {
                console.log('Game state changed - starting game!');
                setGameStarted(true);
              }
              
              // Check if round number changed
              if (prev && prev.round_number !== undefined && 
                  newRoom.round_number !== undefined && 
                  prev.round_number !== newRoom.round_number) {
                console.log(`Round changed from ${prev.round_number} to ${newRoom.round_number}`);
                // Force a refresh of players data when round changes
                refreshPlayersData(roomData.id);
              }
              
              return newRoom;
            });
          });
          
          playersChannel = subscribeToRoomPlayers(roomData.id, (updatedPlayers) => {
            console.log('Players updated:', updatedPlayers);
            setPlayers(updatedPlayers);
          });
        } catch (realtimeError) {
          console.error('Error setting up real-time subscriptions:', realtimeError);
          console.log('Continuing without real-time updates');
          
          // We'll set up polling as a fallback
          const pollInterval = setInterval(async () => {
            try {
              // Poll for room data
              const roomResponse = await fetch(`/api/rooms/${code}`);
              const roomData = await roomResponse.json();
              
              if (roomResponse.ok && roomData.room) {
                setRoom(roomData.room);
                
                // Check if game started
                if (!gameStarted && roomData.room.round_number > 0) {
                  setGameStarted(true);
                }
                
                // Also update players
                if (roomData.room.players) {
                  setPlayers(roomData.room.players);
                }
              }
            } catch (pollError) {
              console.error('Error polling for updates:', pollError);
            }
          }, 5000); // Poll every 5 seconds
          
          // Clean up polling when component unmounts
          return () => clearInterval(pollInterval);
        }
        
        setError(null);
      } catch (err: any) {
        console.error('Error setting up real-time:', err);
        setError(err.message || 'An error occurred loading the game room. Please try refreshing.');
      } finally {
        setLoading(false);
      }
    }
    
    setupRealtime();
    
    // Clean up subscriptions when unmounting
    return () => {
      if (roomChannel) unsubscribe(roomChannel);
      if (playersChannel) unsubscribe(playersChannel);
    };
  }, [code, currentPlayer]);

  // Copy room code to clipboard
  const copyRoomCode = () => {
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    
    // Reset the copied state after 2 seconds
    setTimeout(() => {
      setCodeCopied(false);
    }, 2000);
  };
  
  // Start the game
  const handleStartGame = async () => {
    if (!room || !isHost || startingGame || players.length < 2) return;
    
    try {
      setStartingGame(true);
      
      // Set a timeout for the fetch to prevent it from hanging indefinitely
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      // Try up to 3 times
      let attempt = 0;
      let success = false;
      let lastError = null;
      let responseData = null;
      
      while (attempt < 3 && !success) {
        attempt++;
        try {
          console.log(`Attempt ${attempt} to start game`);
          
          const response = await fetch('/api/rooms/start-game', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ roomCode: code }),
            signal: controller.signal
          });
          
          // Log the full response details for debugging
          console.log('Start game response status:', response.status);
          console.log('Response headers:', Object.fromEntries([...response.headers.entries()]));
          
          // Get the raw text first to see what's being returned
          const responseText = await response.text();
          console.log('Raw response:', responseText);
          
          // Try to parse as JSON if it looks like JSON
          try {
            responseData = JSON.parse(responseText);
            success = true;
          } catch (parseError) {
            console.error('Error parsing response as JSON:', parseError);
            lastError = new Error(`Server returned invalid JSON. Status: ${response.status}, Content: ${responseText.substring(0, 100)}...`);
            
            // Wait a bit before retrying
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          if (!response.ok) {
            success = false;
            lastError = new Error(responseData?.error || `Failed to start game: ${response.status}`);
            
            // Wait a bit before retrying
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (fetchError) {
          console.error(`Fetch error on attempt ${attempt}:`, fetchError);
          lastError = fetchError;
          
          // Wait a bit before retrying
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      if (!success) {
        throw lastError || new Error('Failed to start game after multiple attempts');
      }
      
      console.log('Game started successfully:', responseData);
      setGameStarted(true);
      
      // If we needed to, we could force a refresh of the room data here
      const roomId = room.id;
      if (roomId) {
        subscribeToRoomPlayers(roomId, (updatedPlayers) => {
          console.log('Players refreshed after game start:', updatedPlayers);
          setPlayers(updatedPlayers);
        });
      }
      
    } catch (err: any) {
      console.error('Error starting game:', err);
      setError(err.message || 'Failed to start game');
    } finally {
      setStartingGame(false);
    }
  };

  // Add helper function to refresh players data
  const refreshPlayersData = async (roomId: string) => {
    try {
      console.log('Manually refreshing players data for room:', roomId);
      const response = await fetch(`/api/rooms/${code}/players`);
      
      if (!response.ok) {
        console.error('Failed to refresh players data:', response.status);
        return;
      }
      
      const data = await response.json();
      
      if (data.players) {
        console.log('Refreshed players data:', data.players);
        setPlayers(data.players);
      }
    } catch (err) {
      console.error('Error refreshing players data:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary">
        <div className="text-center p-8 bg-white rounded-xl">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-gray-600">Loading game room...</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-primary p-4">
        <div className="flex-grow flex flex-col justify-center items-center w-full space-y-6 p-4 sm:p-6 md:p-8 bg-white rounded-xl m-5 sm:m-10 md:m-20 lg:m-20 
                      max-h-[calc(100vh-40px)] sm:max-h-[calc(100vh-80px)] md:max-h-[calc(100vh-160px)]
                      max-w-[calc(100vw-40px)] sm:max-w-[calc(100vw-80px)] md:max-w-[calc(100vw-160px)]">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error || 'Game room not found'}</p>
          <Link
            href="/"
            className="inline-flex justify-center py-2 px-4 border border-primary rounded-md text-sm font-medium text-primary bg-white hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const playerId = currentPlayer?.id;
  const isHost = players.length > 0 && players[0].id === playerId;

  return (
    <div className="flex min-h-screen flex-col bg-primary">
      {/* Contained layout */}
      <div className="flex flex-col flex-grow h-full w-full max-w-[calc(100vw-40px)] sm:max-w-[calc(100vw-80px)] md:max-w-[calc(100vw-160px)]
                    max-h-[calc(100vh-40px)] sm:max-h-[calc(100vh-80px)] md:max-h-[calc(100vh-160px)]
                    m-5 sm:m-10 md:m-20 lg:m-20 bg-white rounded-xl overflow-hidden">
        {/* Header */}
        <header className="p-4 sm:p-6 flex flex-col items-center">
          {!gameStarted && (
            <>
              <h1 className="text-2xl sm:text-6xl font-medium text-black font-heading m-8">Lobby</h1>
              <div className="flex flex-col items-center">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-500">Room Code:</span>
                  <button 
                    onClick={copyRoomCode}
                    className="bg-gray-100 px-3 py-1 rounded-md text-primary font-mono font-bold hover:bg-gray-200"
                    title="Click to copy"
                  >
                    {code}
                  </button>
                </div>
                {codeCopied && (
                  <span className="text-xs text-green-600 mt-1">Code copied to clipboard!</span>
                )}
              </div>
            </>
          )}
        </header>

        {/* Main content */}
        <main className="flex-grow p-4 sm:p-6 overflow-y-auto">
          {gameStarted ? (
            <GameView 
              room={room as GameRoomType} 
              players={players} 
              currentPlayer={currentPlayer}
              isHost={isHost}
            />
          ) : (
            <div className="flex flex-col items-center">
              <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mb-6 w-full max-w-2xl">
                {players.length === 0 ? (
                  <p className="text-gray-500 text-center">No players have joined yet.</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-3">
                    {players.map((player) => (
                      <li 
                        key={player.id}
                        className={`flex items-center px-4 py-3 rounded-md ${
                          player.id === playerId ? 'bg-primary/10' : 'bg-white'
                        }`}
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {player.name}
                            {player.id === playerId && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                You
                              </span>
                            )}
                            {players[0].id === player.id && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-black">
                                Host
                              </span>
                            )}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {isHost && (
                <button
                  onClick={handleStartGame}
                  disabled={startingGame || players.length < 2}
                  className="px-16 py-4 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-primary/50 disabled:cursor-not-allowed mb-6"
                >
                  {startingGame ? 'Starting...' : 'Start Game'}
                </button>
              )}

              <div className="text-center text-gray-500">
                {players.length < 2 ? (
                  <p>You need at least 2 players to start. Share the room code with your friends to invite them!</p>
                ) : isHost ? (
                  <p>You can start the game when ready!</p>
                ) : (
                  <p>Waiting for the host to start the game...</p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
} 