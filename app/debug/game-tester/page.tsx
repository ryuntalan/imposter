'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GameTester() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [playerCount, setPlayerCount] = useState(3);
  const [playerNamePrefix, setPlayerNamePrefix] = useState('TestPlayer');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Section expanded states
  const [createRoomExpanded, setCreateRoomExpanded] = useState(true);
  const [addPlayersExpanded, setAddPlayersExpanded] = useState(false);
  const [simulateGameExpanded, setSimulateGameExpanded] = useState(false);
  const [viewResultsExpanded, setViewResultsExpanded] = useState(false);
  
  // Run test operations
  const createTestRoom = async () => {
    try {
      setLoading(true);
      setStatus('Creating test room...');
      
      const response = await fetch('/api/debug/create-test-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: roomCode || generateRandomCode(),
          hostName: 'HostPlayer'
        })
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        setStatus(`Room created successfully: ${data.room.code}`);
        setRoomCode(data.room.code);
        // Auto-expand the next section
        setCreateRoomExpanded(false);
        setAddPlayersExpanded(true);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const addTestPlayers = async () => {
    try {
      setLoading(true);
      setStatus('Adding test players...');
      
      const response = await fetch('/api/debug/add-test-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          count: playerCount,
          namePrefix: playerNamePrefix
        })
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        setStatus(`Added ${data.addedPlayers?.length || 0} test players`);
        // Auto-expand the next section
        setAddPlayersExpanded(false);
        setSimulateGameExpanded(true);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const simulateGame = async (action: string) => {
    try {
      setLoading(true);
      setStatus(`Simulating game action: ${action}...`);
      
      const response = await fetch('/api/debug/simulate-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          action
        })
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        setStatus(`Simulated ${action} successfully`);
        // Auto-expand results
        setViewResultsExpanded(true);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const viewGameResults = async () => {
    try {
      setLoading(true);
      setStatus('Getting game results...');
      
      // First, get the room data to find the room ID
      const roomResponse = await fetch('/api/debug/fix-join-issue', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const roomData = await roomResponse.json();
      const roomId = roomData.steps?.[0]?.room?.id;
      
      if (!roomId) {
        setStatus('Error: Could not find room ID');
        setLoading(false);
        return;
      }
      
      // Then get vote results
      const voteResponse = await fetch('/api/rooms/get-vote-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId })
      });
      
      const voteData = await voteResponse.json();
      setResult(voteData);
      
      if (voteData.success) {
        setStatus('Retrieved game results successfully');
      } else {
        setStatus(`Error: ${voteData.error}`);
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const goToRoom = () => {
    if (roomCode) {
      router.push(`/room/${roomCode}`);
    }
  };
  
  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };
  
  const startNewRound = async () => {
    try {
      setLoading(true);
      setStatus('Starting new round...');
      
      const response = await fetch('/api/debug/start-new-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode
        })
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        setStatus(`Started round ${data.room.round_number} successfully`);
        // Auto-expand the simulation section
        setSimulateGameExpanded(true);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Game Tester</h1>
      
      <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-6">
        <p className="text-yellow-800">
          This page is for testing only. Use it to quickly simulate a game with test players.
        </p>
      </div>
      
      <div className="bg-slate-100 p-4 rounded-md mb-4 border border-slate-300">
        <p className="text-slate-900"><strong>Status:</strong> {status || 'Ready'}</p>
        {loading && <p className="text-blue-800 font-medium">Loading...</p>}
      </div>
      
      {/* Create Room Section */}
      <div className="border border-slate-300 rounded-lg mb-4 overflow-hidden">
        <div 
          className="bg-slate-300 p-3 font-medium cursor-pointer flex justify-between items-center text-slate-900"
          onClick={() => setCreateRoomExpanded(!createRoomExpanded)}
        >
          <span>Step 1: Create Test Room</span>
          <span>{createRoomExpanded ? '▼' : '▶'}</span>
        </div>
        
        {createRoomExpanded && (
          <div className="p-4">
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Room Code (optional)
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Leave empty for random code"
                  maxLength={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 bg-white"
                />
              </div>
            </div>
            
            <button
              onClick={createTestRoom}
              disabled={loading}
              className="bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-800 disabled:bg-slate-600 disabled:text-slate-200"
            >
              Create Test Room
            </button>
          </div>
        )}
      </div>
      
      {/* Add Players Section */}
      <div className="border border-slate-300 rounded-lg mb-4 overflow-hidden">
        <div 
          className="bg-slate-300 p-3 font-medium cursor-pointer flex justify-between items-center text-slate-900"
          onClick={() => setAddPlayersExpanded(!addPlayersExpanded)}
        >
          <span>Step 2: Add Test Players</span>
          <span>{addPlayersExpanded ? '▼' : '▶'}</span>
        </div>
        
        {addPlayersExpanded && (
          <div className="p-4">
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Room Code
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter room code"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 bg-white"
                />
              </div>
              
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Number of Players
                </label>
                <input
                  type="number"
                  value={playerCount}
                  onChange={(e) => setPlayerCount(parseInt(e.target.value))}
                  min={1}
                  max={10}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 bg-white"
                />
              </div>
              
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Name Prefix
                </label>
                <input
                  type="text"
                  value={playerNamePrefix}
                  onChange={(e) => setPlayerNamePrefix(e.target.value)}
                  placeholder="TestPlayer"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 bg-white"
                />
              </div>
            </div>
            
            <button
              onClick={addTestPlayers}
              disabled={loading || !roomCode}
              className="bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-800 disabled:bg-slate-600 disabled:text-slate-200"
            >
              Add Test Players
            </button>
          </div>
        )}
      </div>
      
      {/* Simulate Game Section */}
      <div className="border border-slate-300 rounded-lg mb-4 overflow-hidden">
        <div 
          className="bg-slate-300 p-3 font-medium cursor-pointer flex justify-between items-center text-slate-900"
          onClick={() => setSimulateGameExpanded(!simulateGameExpanded)}
        >
          <span>Step 3: Simulate Game</span>
          <span>{simulateGameExpanded ? '▼' : '▶'}</span>
        </div>
        
        {simulateGameExpanded && (
          <div className="p-4">
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Room Code
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter room code"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 bg-white"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => simulateGame('start_game')}
                disabled={loading || !roomCode}
                className="bg-green-700 text-white px-4 py-2 rounded-md hover:bg-green-800 disabled:bg-slate-600 disabled:text-slate-200"
              >
                1. Start Game
              </button>
              
              <button
                onClick={() => simulateGame('submit_answers')}
                disabled={loading || !roomCode}
                className="bg-purple-700 text-white px-4 py-2 rounded-md hover:bg-purple-800 disabled:bg-slate-600 disabled:text-slate-200"
              >
                2. Submit Answers
              </button>
              
              <button
                onClick={() => simulateGame('submit_votes')}
                disabled={loading || !roomCode}
                className="bg-orange-700 text-white px-4 py-2 rounded-md hover:bg-orange-800 disabled:bg-slate-600 disabled:text-slate-200"
              >
                3. Submit Random Votes
              </button>
              
              <button
                onClick={() => simulateGame('majority_vote')}
                disabled={loading || !roomCode}
                className="bg-red-700 text-white px-4 py-2 rounded-md hover:bg-red-800 disabled:bg-slate-600 disabled:text-slate-200"
              >
                3. Submit Majority Vote (Find Impostor)
              </button>
              
              <button
                onClick={() => simulateGame('simulate_all')}
                disabled={loading || !roomCode}
                className="bg-indigo-700 text-white px-4 py-2 rounded-md hover:bg-indigo-800 disabled:bg-slate-600 disabled:text-slate-200"
              >
                Run Entire Game Simulation
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* View Results Section */}
      <div className="border border-slate-300 rounded-lg mb-4 overflow-hidden">
        <div 
          className="bg-slate-300 p-3 font-medium cursor-pointer flex justify-between items-center text-slate-900"
          onClick={() => setViewResultsExpanded(!viewResultsExpanded)}
        >
          <span>Results & Actions</span>
          <span>{viewResultsExpanded ? '▼' : '▶'}</span>
        </div>
        
        {viewResultsExpanded && (
          <div className="p-4">
            <div className="flex gap-2 mb-4">
              <button
                onClick={goToRoom}
                disabled={!roomCode}
                className="bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-800 disabled:bg-slate-600 disabled:text-slate-200"
              >
                Go to Room
              </button>
              
              <button
                onClick={viewGameResults}
                disabled={loading || !roomCode}
                className="bg-green-700 text-white px-4 py-2 rounded-md hover:bg-green-800 disabled:bg-slate-600 disabled:text-slate-200"
              >
                View Results
              </button>
              
              <button
                onClick={() => startNewRound()}
                disabled={loading || !roomCode}
                className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 disabled:bg-slate-600 disabled:text-slate-200"
              >
                Start New Round
              </button>
            </div>
            
            {result && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2 text-slate-900">Result:</h3>
                <div className="bg-slate-100 p-4 rounded overflow-auto max-h-96 border border-slate-300">
                  <pre className="whitespace-pre-wrap break-words text-slate-900">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 