import { useState, useEffect } from 'react';
import { Player, GameRoom, GameStage } from '@/lib/types';
import { subscribeToGameState, unsubscribe } from '@/lib/realtime';
import { RealtimeChannel } from '@supabase/supabase-js';

interface GameViewProps {
  room: GameRoom;
  players: Player[];
  currentPlayer: Player | null;
  isHost: boolean;
}

interface PlayerAnswer {
  player_id: string;
  player_name: string;
  answer: string;
}

interface Voter {
  id: string;
  name: string;
}

interface VoterMap {
  [targetPlayerId: string]: Voter[];
}

export default function GameView({ room, players, currentPlayer, isHost }: GameViewProps) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [promptId, setPromptId] = useState<string | null>(null);
  const [role, setRole] = useState<'regular' | 'imposter' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [gameStage, setGameStage] = useState<GameStage>('waiting');
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [allAnswers, setAllAnswers] = useState<PlayerAnswer[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [voteResults, setVoteResults] = useState<Record<string, number>>({});
  const [voterMap, setVoterMap] = useState<VoterMap>({});
  const [majorityReached, setMajorityReached] = useState(false);
  const [imposterRevealed, setImposterRevealed] = useState<{ id: string, name: string } | null>(null);
  const [checkingVotesInterval, setCheckingVotesInterval] = useState<NodeJS.Timeout | null>(null);
  const [gameStateChannel, setGameStateChannel] = useState<RealtimeChannel | null>(null);
  
  // Determine game stage based on room state
  useEffect(() => {
    if (!room) return;
    
    console.log(`[GameView] Checking room state, round: ${room.round_number}`);
    
    if (room.round_number <= 0) {
      setGameStage('waiting');
    } else if (!prompt) {
      // We're still loading the prompt
      setGameStage('prompt');
    }
    
    // Reset submission state when round changes
    // Store the current round in a ref to detect changes
    if (room && typeof window !== 'undefined') {
      const lastRoundStr = localStorage.getItem('last_round_' + room.id);
      const lastRound = lastRoundStr ? parseInt(lastRoundStr) : null;
      
      if (lastRound !== room.round_number) {
        console.log(`[GameView] Round changed from ${lastRound} to ${room.round_number}, resetting submission state`);
        
        // Reset submission state for the new round
        setSubmitted(false);
        setAnswerText('');
        
        // Store the new round
        localStorage.setItem('last_round_' + room.id, room.round_number.toString());
      }
    }
  }, [room, prompt]);
  
  // Subscribe to game state changes
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    
    if (room?.id && room.round_number > 0) {
      console.log(`Subscribing to game state changes for room ${room.id}, round ${room.round_number}`);
      
      channel = subscribeToGameState(room.id, room.round_number, (gameState) => {
        console.log('Received game state update:', gameState);
        
        if (gameState?.current_stage) {
          if (gameState.current_stage !== gameStage) {
            console.log(`Updating game stage from ${gameStage} to ${gameState.current_stage}`);
            
            // Only update the state if it's valid
            if (['waiting', 'prompt', 'answering', 'reveal', 'discussion_voting', 'results'].includes(gameState.current_stage)) {
              const newStage = gameState.current_stage as GameStage;
              setGameStage(newStage);
              
              // If transitioning to discussion_voting, fetch all answers and set up vote check interval
              if (newStage === 'discussion_voting' && gameStage !== 'discussion_voting') {
                console.log('Transitioning to discussion_voting stage, fetching all answers');
                
                // Fetch all answers for the current round
                fetchAllAnswers();
                
                setVoteSubmitted(false);
                setSelectedPlayer(null);
                setMajorityReached(false);
                
                if (checkingVotesInterval) {
                  clearInterval(checkingVotesInterval);
                }
                
                const interval = setInterval(checkForMajorityVote, 5000);
                setCheckingVotesInterval(interval);
              }
            }
          }
        }
      });
      
      setGameStateChannel(channel);
    }
    
    // Clean up subscription
    return () => {
      if (channel) {
        console.log('Unsubscribing from game state changes');
        unsubscribe(channel);
      }
    };
  }, [room?.id, room?.round_number]);

  // Clean up checking votes interval on component unmount
  useEffect(() => {
    return () => {
      if (checkingVotesInterval) {
        clearInterval(checkingVotesInterval);
      }
      if (gameStateChannel) {
        unsubscribe(gameStateChannel);
      }
    };
  }, [checkingVotesInterval, gameStateChannel]);
  
  // Fetch the player's prompt when the component loads or on retry
  useEffect(() => {
    async function fetchPrompt() {
      // Enhanced logging for debugging the missing player/room issue
      console.log('GameView fetchPrompt - Current state:', { 
        currentPlayer: currentPlayer ? {
          id: currentPlayer.id,
          name: currentPlayer.name,
          room_id: currentPlayer.room_id
        } : 'missing', 
        room: room ? {
          id: room.id,
          code: room.code,
          round: room.round_number
        } : 'missing',
        players: players.length
      });
      
      // If currentPlayer is missing, try to get it from localStorage
      if (!currentPlayer && typeof window !== 'undefined') {
        const storedPlayerData = localStorage.getItem('player_data');
        if (storedPlayerData) {
          try {
            const storedPlayer = JSON.parse(storedPlayerData);
            console.log('Found player in localStorage:', storedPlayer);
            
            // Check if this player belongs to the current room
            if (storedPlayer.room_id === room?.id) {
              console.log('Player from localStorage belongs to this room, using it');
              // Use this player for this request
              await fetchPromptWithPlayer(storedPlayer);
              return;
            } else {
              console.log('Player from localStorage is for a different room');
            }
          } catch (e) {
            console.error('Error parsing stored player data:', e);
          }
        }
      }
      
      if (!currentPlayer || !room) {
        console.log('Missing currentPlayer or room data:', { 
          currentPlayer: currentPlayer ? 'exists' : 'missing', 
          room: room ? 'exists' : 'missing' 
        });
        setError('Missing player or room data. Try refreshing the page.');
        setLoading(false);
        return;
      }
      
      await fetchPromptWithPlayer(currentPlayer);
    }
    
    // Helper function to fetch prompt with a specific player
    async function fetchPromptWithPlayer(player: Player) {
      // Only fetch prompt if the game has actually started (round_number > 0)
      if (room.round_number <= 0) {
        console.log('Game has not started yet. Waiting for game to start...');
        setLoading(false);
        setError(null);
        setGameStage('waiting');
        return;
      }
      
      try {
        setLoading(true);
        console.log('Fetching prompt for player:', player.id, 'in room:', room.id);
        
        // Set a timeout for the fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch('/api/players/get-prompt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            playerId: player.id,
            roomId: room.id,
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('Prompt API response:', response.status, response.ok ? 'OK' : 'Failed');
        
        // Get raw response text first for debugging
        const responseText = await response.text();
        console.log('Raw response text:', responseText.substring(0, 200)); // First 200 chars
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Error parsing prompt response:', parseError);
          throw new Error('Invalid response from server. The response was not valid JSON.');
        }
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to get your prompt');
        }
        
        console.log('Received prompt data:', {
          round: data.round,
          hasPrompt: !!data.prompt,
          role: data.role
        });
        
        setPrompt(data.prompt);
        setPromptId(data.promptId);
        setRole(data.role);
        setError(null);
        setGameStage('answering');
        
        // Update the game state for all players
        await updateGameState('answering');
        
        // Check if player already submitted an answer
        await checkIfAnswerSubmitted();
        
      } catch (err: any) {
        console.error('Error fetching prompt:', err);
        
        // If it's an AbortError, we know it's a timeout
        if (err.name === 'AbortError') {
          setError('Request timed out. The server took too long to respond. Try again.');
        } else {
          setError(err.message || 'Failed to load your prompt. Try refreshing the page.');
        }
      } finally {
        setLoading(false);
      }
    }
    
    fetchPrompt();
  }, [currentPlayer, room, retryCount]);
  
  // Check if the player has already submitted an answer
  const checkIfAnswerSubmitted = async () => {
    if (!currentPlayer || !room) return;
    
    try {
      console.log('[GameView] Checking if player has submitted answer for round', room.round_number);
      const response = await fetch('/api/players/check-answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: room.id,
          round: room.round_number,
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to check answers');
      }
      
      const data = await response.json();
      console.log('[GameView] Check answers response:', data);
      
      // If player already submitted answer for this round
      const playerAnswer = data.answers?.find((a: any) => a.player_id === currentPlayer.id);
      if (playerAnswer) {
        console.log('[GameView] Found player answer for round', room.round_number, playerAnswer);
        setAnswerText(playerAnswer.answer);
        setSubmitted(true);
      } else {
        console.log('[GameView] No answer found for player in round', room.round_number);
        // Reset submission state if no answer found for this round
        setSubmitted(false);
        // Don't clear answer text here to avoid losing work in progress
      }
      
      // If all players submitted answers, update UI and fetch all answers
      if (data.allSubmitted && data.answers.length > 0) {
        console.log('[GameView] All players have submitted answers:', data.answers.length);
        setAllAnswers(data.answers);
        
        // Update local state to show appropriate screen
        if (gameStage === 'answering' || gameStage === 'waiting') {
          console.log('[GameView] All answers submitted, transitioning to discussion_voting');
          
          // Only the host or first player to discover all answers are in will update the game state
          if (isHost || !data.gameStateUpdated) {
            console.log('[GameView] Updating game state to discussion_voting');
            await updateGameState('discussion_voting');
          }
          
          // Force the game stage to discussion_voting without waiting for subscription
          // This ensures the current player sees the discussion screen
          setGameStage('discussion_voting');
          
          // Set up voting check interval
          if (checkingVotesInterval) {
            clearInterval(checkingVotesInterval);
          }
          
          const interval = setInterval(checkForMajorityVote, 5000);
          setCheckingVotesInterval(interval);
        }
      }
      
    } catch (err) {
      console.error('[GameView] Error checking submitted answers:', err);
    }
  };

  // Submit the player's answer
  const handleSubmitAnswer = async () => {
    if (!currentPlayer || !room || !promptId || !answerText.trim()) return;
    
    try {
      setSubmitting(true);
      console.log('[GameView] Submitting answer for player:', currentPlayer.id);
      
      const response = await fetch('/api/players/submit-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          roomId: room.id,
          promptId: promptId,
          answer: answerText.trim()
        })
      });
      
      const data = await response.json();
      console.log('[GameView] Submit answer response:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit answer');
      }
      
      setSubmitted(true);
      
      // If all answers are in, update the game state and UI
      if (data.allSubmitted) {
        console.log('[GameView] All answers are in after submission!');
        
        // Fetch all answers
        await fetchAllAnswers();
        
        // Update game state to discussion_voting
        console.log('[GameView] Updating game state to discussion_voting after all answers submitted');
        await updateGameState('discussion_voting');
        
        // Force game stage change without waiting for subscription
        setGameStage('discussion_voting');
        
        // Set up vote check interval
        if (checkingVotesInterval) {
          clearInterval(checkingVotesInterval);
        }
        
        const interval = setInterval(checkForMajorityVote, 5000);
        setCheckingVotesInterval(interval);
      } else {
        // If not all answers are in, poll for updates to see when all answers are submitted
        console.log('[GameView] Not all answers are in, polling for updates');
        setTimeout(checkIfAnswerSubmitted, 3000);
      }
      
    } catch (err: any) {
      console.error('[GameView] Error submitting answer:', err);
      setError(err.message || 'Failed to submit your answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Update the game state in the database
  const updateGameState = async (newStage: GameStage) => {
    if (!room) return;
    
    try {
      console.log(`[GameView] Updating game state to ${newStage} for room ${room.id}`);
      
      const response = await fetch('/api/rooms/update-game-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: room.id,
          gameStage: newStage
        })
      });
      
      if (!response.ok) {
        console.error('[GameView] Failed to update game state:', response.status);
        const errorText = await response.text();
        console.error('[GameView] Error response:', errorText);
        // Don't throw here - we don't want to break the flow if this fails
      } else {
        const data = await response.json();
        console.log('[GameView] Game state updated successfully:', data);
      }
    } catch (err) {
      console.error('[GameView] Error updating game state:', err);
      // Don't throw here - we don't want to break the flow if this fails
    }
  };
  
  // Fetch all answers for the current round
  const fetchAllAnswers = async () => {
    if (!room) return;
    
    try {
      console.log('[GameView] Fetching all answers for room', room.id, 'round', room.round_number);
      const response = await fetch('/api/players/check-answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: room.id,
          round: room.round_number,
        })
      });
      
      if (!response.ok) {
        console.error('[GameView] Failed to fetch answers, status:', response.status);
        const errorText = await response.text();
        console.error('[GameView] Error response:', errorText);
        throw new Error('Failed to fetch answers');
      }
      
      const data = await response.json();
      console.log('[GameView] Fetch all answers response:', data);
      
      if (data.answers && data.answers.length > 0) {
        console.log('[GameView] Setting all answers:', data.answers.length, 'answers');
        setAllAnswers(data.answers);
        
        // If all players have submitted, update the game state to discussion_voting
        if (data.allSubmitted) {
          console.log('[GameView] All players have submitted answers. Updating game state to discussion_voting');
          await updateGameState('discussion_voting');
          
          // Force the game stage to discussion_voting without waiting for subscription
          setGameStage('discussion_voting');
          
          // Set up vote check interval
          if (checkingVotesInterval) {
            clearInterval(checkingVotesInterval);
          }
          
          const interval = setInterval(checkForMajorityVote, 5000);
          setCheckingVotesInterval(interval);
        } else {
          // Otherwise, show the reveal stage if we have answers but not all
          await updateGameState('reveal');
          // Force the game stage to reveal without waiting for subscription
          setGameStage('reveal');
        }
      } else {
        console.log('[GameView] No answers returned from API or empty array');
        // If in discussion_voting stage but no answers, retry after a short delay
        if (gameStage === 'discussion_voting') {
          console.log('[GameView] In discussion_voting stage but no answers. Retrying in 2 seconds...');
          setTimeout(fetchAllAnswers, 2000);
        }
      }
      
    } catch (err) {
      console.error('[GameView] Error fetching all answers:', err);
      // Add retry logic for network errors
      setTimeout(fetchAllAnswers, 3000);
    }
  };
  
  // Start discussion and voting phase
  const handleStartDiscussionVoting = async () => {
    // Update the game state to discussion_voting for all players
    await updateGameState('discussion_voting');
  };
  
  // Check if a majority vote has been reached
  const checkForMajorityVote = async () => {
    if (!room) return;
    
    try {
      console.log('[GameView] Checking for majority vote...');
      const response = await fetch('/api/players/check-votes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: room.id,
          round: room.round_number,
        })
      });
      
      if (!response.ok) {
        console.error('[GameView] Failed to check votes:', response.status);
        return;
      }
      
      const data = await response.json();
      console.log('[GameView] Check votes response:', data);
      
      if (data.voteResults) {
        // Update the UI with the current vote counts
        setVoteResults(data.voteResults);
        
        // Update voter map
        if (data.voterMap) {
          setVoterMap(data.voterMap);
        }
        
        // Debug output for vote counting
        const totalPlayers = players.length;
        const majorityThreshold = Math.floor(totalPlayers / 2) + 1;
        console.log(`[GameView] Vote check - Total players: ${totalPlayers}, Majority threshold: ${majorityThreshold}`);
        
        // Log each player's vote count
        Object.entries(data.voteResults).forEach(([playerId, votes]) => {
          const playerName = players.find(p => p.id === playerId)?.name || 'Unknown';
          console.log(`[GameView] Player ${playerName} has ${votes} votes`);
        });
        
        // If a majority is reached or all players have voted, transition to results
        if (data.shouldTransitionToResults || data.majorityReached || data.gameAlreadyInResults) {
          console.log('[GameView] Majority reached or all players voted, transitioning to results');
          
          // Majority reached, reveal results
          setMajorityReached(true);
          setImposterRevealed(data.imposter);
          
          if (checkingVotesInterval) {
            clearInterval(checkingVotesInterval);
            setCheckingVotesInterval(null);
          }
          
          // Don't update the game state if the server indicates it's already in results
          // Just force the UI to show results
          if (!data.gameAlreadyInResults) {
            // Update the game state to results for all players
            await updateGameState('results');
          }
          
          // Force the game stage to results without waiting for subscription
          setGameStage('results');
        } else {
          console.log('[GameView] No majority reached yet, continuing vote checking');
        }
      } else {
        console.log('[GameView] No vote results in response');
      }
    } catch (err) {
      console.error('[GameView] Error checking for majority vote:', err);
    }
  };
  
  // Submit vote for who the player thinks is the impostor
  const handleSubmitVote = async (playerId: string) => {
    if (!currentPlayer || !room) {
      console.error('Cannot submit vote:', { 
        currentPlayer: currentPlayer ? 'exists' : 'missing', 
        room: room ? 'exists' : 'missing',
      });
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      setSelectedPlayer(playerId);
      
      console.log('Submitting vote:', {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        roomId: room.id,
        votedPlayerId: playerId,
        votedPlayerName: players.find(p => p.id === playerId)?.name,
        round: room.round_number,
        isHost: isHost
      });
      
      const response = await fetch('/api/players/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          roomId: room.id,
          votedPlayerId: playerId,
          round: room.round_number
        })
      });
      
      const responseText = await response.text();
      console.log('Vote API response status:', response.status);
      console.log('Vote API raw response:', responseText.substring(0, 500)); // Log first 500 chars

      let data;
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing vote response:', parseError, 'Raw response:', responseText);
        throw new Error('Failed to parse server response. Please try again.');
      }
      
      if (!response.ok) {
        console.error('Error response from vote API:', data);
        throw new Error(data.error || 'Failed to submit vote');
      }
      
      console.log('Vote submitted successfully:', data);
      setVoteSubmitted(true);
      
      // Update the vote results display
      if (data.voteResults) {
        setVoteResults(data.voteResults);
      }
      
      // Update voter mapping
      if (data.voterMap) {
        setVoterMap(data.voterMap);
      }
      
      // Run the check for majority votes immediately after submitting
      await checkForMajorityVote();
      
    } catch (err: any) {
      console.error('Error submitting vote:', err);
      setError(err.message || 'Failed to submit your vote. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Change vote 
  const handleChangeVote = () => {
    setVoteSubmitted(false);
    setSelectedPlayer(null);
  };
  
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };
  
  // Start a new round (only host can do this)
  const startNewRound = async () => {
    if (!room) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('[GameView] Starting new round for room:', room.id);
      
      const response = await fetch('/api/rooms/start-new-round', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: room.id,
          playerId: currentPlayer?.id
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start new round');
      }
      
      console.log('[GameView] New round started successfully');
      
      // Reset the game state to waiting
      setGameStage('waiting');
      setPrompt(null);
      setPromptId(null);
      setRole(null);
      setAnswerText('');
      setSubmitted(false); // Important to reset submission state
      setAllAnswers([]);
      setSelectedPlayer(null);
      setVoteSubmitted(false);
      setVoteResults({});
      setMajorityReached(false);
      setImposterRevealed(null);
      
      // Clear the previous round from local storage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('last_round_' + room.id);
        // Also store the new round number to prevent stale state
        localStorage.setItem('last_round_' + room.id, (room.round_number + 1).toString());
      }
      
      // Refetch prompt after slight delay to allow backend to update
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, 1000);
      
    } catch (err: any) {
      console.error('Error starting new round:', err);
      setError(err.message || 'Failed to start new round. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Add a useEffect to load answers when in discussion_voting stage
  useEffect(() => {
    // When game stage changes to discussion_voting, make sure we have all answers
    if (gameStage === 'discussion_voting' && room && allAnswers.length === 0) {
      console.log('[GameView] In discussion_voting stage but no answers loaded. Fetching answers...');
      fetchAllAnswers();
    }
  }, [gameStage, room?.id, room?.round_number]);
  
  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-gray-600">Loading your prompt...</p>
        </div>
      </div>
    );
  }
  
  // Special case for when the game is in the initialization phase
  if (gameStage === 'waiting') {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
          <p className="text-blue-700">Waiting for the game to start...</p>
          <p className="text-blue-700 mt-2">The host needs to press the "Start Game" button.</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <p className="text-red-700">{error}</p>
          <div className="mt-4">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (!prompt || !role) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
          <p className="text-yellow-700">Something went wrong. We received a response but no prompt was found.</p>
          <div className="mt-4">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Answer submission section update for answering stage
  if (gameStage === 'answering' as GameStage) {
    return (
      <div className="flex flex-col items-center w-full">
        <h1 className="text-2xl sm:text-4xl font-medium text-black font-heading mb-8">Answer Phase</h1>
        
        {role === 'imposter' && (
          <p className="text-red-600 font-regular mb-6">You are the Impostor!</p>
        )}
        
        <div className="w-full max-w-lg mb-6">
          <p className="text-xl text-black text-center mb-6">{prompt}</p>
          
          {!submitted ? (
            <div className="space-y-4">
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-black resize-none"
                rows={3}
                disabled={submitting}
              ></textarea>
              
              <div className="flex justify-center">
                <button
                  onClick={handleSubmitAnswer}
                  disabled={submitting || !answerText.trim()}
                  className={`px-16 py-4 rounded-md text-white ${
                    submitting || !answerText.trim() 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-primary hover:bg-primary/90'
                  }`}
                >
                  {submitting ? 'Submitting...' : 'Submit Answer'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-green-800 font-medium text-center">Your answer has been submitted!</p>
              <p className="mt-2 text-green-600 text-center">Waiting for other players to submit their answers...</p>
              <div className="mt-4 p-3 bg-white rounded border border-gray-100">
                <p className="text-black">{answerText}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Create a separate return for the discussion_voting stage (similar to answering stage)
  if (gameStage === 'discussion_voting' as GameStage) {
    return (
      <div className="flex flex-col items-center w-full">
        <h1 className="text-2xl sm:text-4xl font-medium text-black font-heading mb-8">Voting Phase</h1>
        
        {role === 'imposter' ? (
          <p className="text-red-600 font-regular mb-6">Tap on a player to vote and deflect suspicion</p>
        ) : (
          <p className="text-black font-regular mb-6">Tap on who you think is the Impostor to vote</p>
        )}
        
        {/* Players and answers in clickable cards */}
        <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {allAnswers.map((answer) => {
            const isOwnCard = answer.player_id === currentPlayer?.id;
            const isSelected = answer.player_id === selectedPlayer;
            const votesForThisPlayer = voteResults[answer.player_id] || 0;
            const votersForThisPlayer = voterMap[answer.player_id] || [];
            
            // Check if current player voted for this player
            const hasCurrentPlayerVotedForThis = selectedPlayer === answer.player_id;
            
            return (
              <button
                key={answer.player_id}
                onClick={() => !isOwnCard && !submitting && handleSubmitVote(answer.player_id)}
                disabled={isOwnCard || submitting}
                className={`relative text-left p-4 rounded-md transition text-center ${
                  isOwnCard 
                    ? 'bg-gray-100 cursor-not-allowed' 
                    : isSelected
                      ? 'bg-white border-2 border-primary'
                      : 'bg-white border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <h3 className="font-medium text-gray-900 mb-2">
                  {answer.player_name}
                </h3>
                <p className="text-black text-2xl">{answer.answer}</p>
                
                {/* Vote indicators */}
                {votesForThisPlayer > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    {/* Show who voted for this player */}
                    {votersForThisPlayer.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-center">
                        {votersForThisPlayer.map(voter => (
                          <span 
                            key={voter.id} 
                            className={`px-2 py-1 text-xs rounded-full ${
                              voter.id === currentPlayer?.id 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {voter.id === currentPlayer?.id ? 'You' : voter.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Hidden div for debug logging */}
      <div style={{ display: 'none' }}>
        {(() => {
          console.log('GameView rendering:', {
            gameStage,
            playerId: currentPlayer?.id,
            isHost,
            submitting,
            submitted,
            voteSubmitted,
            selectedPlayer: selectedPlayer ?? 'none',
            playersCount: players.length,
            answersCount: allAnswers.length,
            majorityReached
          });
          return null;
        })()}
      </div>
      
      {/* Prompt Card - only shown in non-answering and non-voting and non-results stages */}
      {gameStage !== ('answering' as GameStage) && 
       gameStage !== ('discussion_voting' as GameStage) && 
       gameStage !== ('results' as GameStage) && (
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Prompt</h2>
          <div className={`p-4 rounded-md ${role === 'imposter' ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            <p className="text-gray-800 font-medium">{prompt}</p>
            
            {role === 'imposter' && (
              <div className="mt-4">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  You are the Impostor!
                </span>
                <p className="mt-2 text-sm text-red-600">
                  Try to blend in! Your prompt is different from everyone else&apos;s.
                </p>
              </div>
            )}
            
            {role === 'regular' && (
              <div className="mt-4">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Regular Player
                </span>
                <p className="mt-2 text-sm text-green-600">
                  One player has a different prompt. Try to figure out who it is!
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Reveal All Answers Section */}
      {gameStage === 'reveal' && (
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">All Answers</h2>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
            <p className="text-yellow-800">
              Everyone has submitted their answers! Look at them carefully and try to figure out who the impostor is.
            </p>
            <button
              onClick={handleStartDiscussionVoting}
              className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600"
            >
              Begin Discussion & Voting
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {allAnswers.map((answer) => (
              <div key={answer.player_id} className="bg-white border rounded-md p-4 shadow-sm">
                <h3 className="font-medium text-gray-800">{answer.player_name}</h3>
                <p className="mt-2 text-gray-600">{answer.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Players List - only shown in non-voting and non-results stages */}
      {gameStage !== ('discussion_voting' as GameStage) && 
       gameStage !== ('results' as GameStage) && (
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Players ({players.length})</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => (
              <li 
                key={player.id}
                className={`flex items-center px-4 py-3 rounded-md shadow-sm ${
                  player.id === currentPlayer?.id ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {player.name}
                    {player.id === currentPlayer?.id && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        You
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Game Instructions - only shown in non-voting and non-results stages */}
      {gameStage !== ('discussion_voting' as GameStage) && 
       gameStage !== ('results' as GameStage) && (
        <div className="bg-primary-50 border-l-4 border-primary-500 p-4">
          <p className="text-primary-700">Round {room.round_number}</p>
          <p className="text-primary-700 mt-2">
            {gameStage === 'answering' && "Answer the prompt you were given. After everyone submits, you&apos;ll review all answers."}
            {gameStage === 'reveal' && "All answers are in! Review them carefully before discussion starts."}
            {gameStage === 'discussion_voting' && "Discuss with the group and vote for who you think is the impostor. Voting continues until a majority is reached."}
            {gameStage === 'results' && "The round is complete! A majority has decided, check who won."}
          </p>
        </div>
      )}
      
      {/* Results Section */}
      {gameStage === 'results' && (
        <div className="flex flex-col items-center w-full">
          <h1 className="text-2xl sm:text-4xl font-medium text-black font-heading mb-8">
            {imposterRevealed && Object.entries(voteResults).find(([playerId, votes]) => 
              playerId === imposterRevealed.id && votes >= Math.floor(players.length / 2) + 1) 
              ? "Majority Wins!" 
              : "Imposter Wins!"}
          </h1>
          
          {imposterRevealed && (
            <p className="text-black font-regular mb-6">
              {imposterRevealed.name} was the Imposter
            </p>
          )}
          
          {/* Player cards with answers and votes */}
          <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {allAnswers.map((answer) => {
              const isImposter = imposterRevealed?.id === answer.player_id;
              const votersForThisPlayer = voterMap[answer.player_id] || [];
              
              return (
                <div
                  key={answer.player_id}
                  className={`relative p-4 rounded-md text-center ${
                    isImposter 
                      ? 'bg-red-50 border border-red-200' 
                      : 'bg-green-50 border border-green-200'
                  }`}
                >
                  <h3 className="font-medium text-gray-900 mb-2">
                    {answer.player_name}
                    {isImposter && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Impostor
                      </span>
                    )}
                  </h3>
                  <p className="text-black text-2xl">{answer.answer}</p>
                  
                  {/* Show who voted for this player */}
                  {votersForThisPlayer.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {votersForThisPlayer.map(voter => (
                          <span 
                            key={voter.id} 
                            className={`px-2 py-1 text-xs rounded-full ${
                              voter.id === currentPlayer?.id 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {voter.id === currentPlayer?.id ? 'You' : voter.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {isHost && (
            <div className="mt-4">
              <button
                onClick={startNewRound}
                disabled={loading}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:bg-gray-300"
              >
                {loading ? 'Starting...' : 'Start New Round'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 