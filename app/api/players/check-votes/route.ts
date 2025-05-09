import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getRoomById } from '@/lib/rooms';
import { createClient } from '@supabase/supabase-js';

// POST /api/players/check-votes - Check votes for the current round
export async function POST(request: Request) {
  // Ensure response is always JSON
  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('Error parsing request body in check-votes:', error);
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON in request body'
      }, { status: 400, headers });
    }

    console.log('Check-votes API received request:', body);
    
    const { roomId, round } = body;
    
    if (!roomId) {
      console.error('Missing roomId in check-votes request');
      return NextResponse.json({
        success: false,
        error: 'Room ID is required'
      }, { status: 400, headers });
    }
    
    // Create admin client to bypass RLS for more reliable operations
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Get the room to check if it exists
    const room = await getRoomById(roomId);
    if (!room) {
      console.error('Room not found in check-votes:', roomId);
      return NextResponse.json({
        success: false,
        error: 'Room not found'
      }, { status: 404, headers });
    }
    
    // First check the current game state
    const { data: gameState, error: gameStateError } = await adminClient
      .from('game_state')
      .select('current_stage')
      .eq('room_id', roomId)
      .eq('round', room.round_number)
      .maybeSingle();
      
    if (!gameStateError && gameState && gameState.current_stage === 'results') {
      console.log('Game already in results stage, returning early with results data');
      // Game is already in results stage, just return the votes and imposter
      const resultsData = await getResultsData(roomId, room.round_number, adminClient);
      return NextResponse.json({
        success: true,
        ...resultsData,
        gameAlreadyInResults: true
      }, { headers });
    }
    
    // Get all players in this room
    const { data: players, error: playersError } = await adminClient
      .from('players')
      .select('id, name')
      .eq('room_id', roomId);
      
    if (playersError) {
      console.error('Error fetching players in check-votes:', playersError);
      return NextResponse.json({
        success: false,
        error: 'Error fetching players'
      }, { status: 500, headers });
    }
    
    console.log(`Found ${players?.length || 0} players in room`);
    
    // Get all votes for this room and round
    const { data: votes, error: votesError } = await adminClient
      .from('votes')
      .select(`
        id,
        voter_id,
        voted_for_id,
        round
      `)
      .eq('room_id', roomId)
      .eq('round', room.round_number);
      
    if (votesError) {
      console.error('Error fetching votes:', votesError);
      return NextResponse.json({
        success: false,
        error: 'Error fetching votes'
      }, { status: 500, headers });
    }
    
    console.log(`Found ${votes?.length || 0} votes for round ${room.round_number}`);
    
    // Count votes for each player
    const voteResults: { [playerId: string]: number } = {};
    
    // Create a mapping of who voted for whom
    const voterMap: { [targetPlayerId: string]: { id: string, name: string }[] } = {};

    // Create player name lookup map
    const playerMap = players.reduce((map, player) => {
      map[player.id] = player.name;
      return map;
    }, {} as Record<string, string>);

    // Initialize vote results and voter map for all players
    players.forEach(player => {
      voteResults[player.id] = 0;
      voterMap[player.id] = [];
    });

    if (votes && votes.length > 0) {
      votes.forEach((vote: { voted_for_id: string, voter_id: string }) => {
        const votedForId = vote.voted_for_id;
        const voterId = vote.voter_id;
        
        // Increment vote count
        voteResults[votedForId] = (voteResults[votedForId] || 0) + 1;
        
        // Add to voter map
        if (playerMap[voterId]) {
          voterMap[votedForId].push({
            id: voterId,
            name: playerMap[voterId]
          });
        }
      });
      
      console.log('Vote results:', voteResults);
    }
    
    // Check if all players have submitted votes
    const allVoted = players.length > 0 && votes.length === players.length;
    console.log(`All players voted: ${allVoted} (${votes?.length || 0}/${players.length})`);
    
    // Check if any player has a majority of votes
    const totalPlayers = players.length;
    const majorityThreshold = Math.floor(totalPlayers / 2) + 1;
    
    console.log(`Majority threshold: ${majorityThreshold} votes needed (${totalPlayers} players total)`);
    
    let majorityReached = false;
    let majorityPlayerId = null;
    let highestVoteCount = 0;
    let highestVotedPlayerId = null;
    
    // Find the player with the most votes
    for (const [playerId, voteCount] of Object.entries(voteResults)) {
      console.log(`Player ${playerId} has ${voteCount} votes`);
      
      // Track highest vote count
      if (voteCount > highestVoteCount) {
        highestVoteCount = voteCount;
        highestVotedPlayerId = playerId;
      }
      
      // Check if this player has a majority
      if (voteCount >= majorityThreshold) {
        majorityReached = true;
        majorityPlayerId = playerId;
        console.log(`Majority reached! Player ${playerId} has ${voteCount} votes (threshold: ${majorityThreshold})`);
        break;
      }
    }
    
    // If all players have voted but no majority, consider it complete if using the highest vote count
    const gameCanEnd = allVoted && votes.length >= 2;
    const forceEndWithHighestVotes = gameCanEnd && !majorityReached && highestVotedPlayerId && highestVoteCount > 0;
    
    if (forceEndWithHighestVotes) {
      console.log(`All players have voted but no majority reached. Using highest vote count.`);
      console.log(`Player ${highestVotedPlayerId} has the most votes: ${highestVoteCount}`);
      
      // Force majority to end the round if all have voted
      majorityReached = true;
      majorityPlayerId = highestVotedPlayerId;
    }
    
    // Get the imposter information
    let imposter = null;
    try {
      // Get the imposter regardless of majority status
      const { data: imposterData, error: imposterError } = await adminClient
        .from('players')
        .select('id, name')
        .eq('room_id', roomId)
        .eq('is_imposter', true)
        .single();
        
      if (!imposterError && imposterData) {
        imposter = imposterData;
        console.log('Imposter revealed:', imposter);
      } else {
        console.error('Error finding imposter:', imposterError);
      }
    } catch (err) {
      console.error('Exception getting imposter:', err);
    }
    
    // Update game state to results if majority reached or if all have voted
    if ((majorityReached || gameCanEnd) && imposter) {
      console.log(`Conditions met to end the game: majorityReached=${majorityReached}, allVoted=${allVoted}`);
      
      // Update game state to results 
      await updateGameStateToResults(roomId, room.round_number, adminClient);
      
      // Small delay to ensure all clients see the same state
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return NextResponse.json({
      success: true,
      voteResults,
      voterMap,
      allVoted,
      majorityReached,
      majorityPlayerId,
      highestVotedPlayerId,
      highestVoteCount,
      imposter,
      totalPlayers,
      totalVotes: votes?.length || 0,
      majorityThreshold,
      shouldTransitionToResults: majorityReached || gameCanEnd
    }, { headers });
    
  } catch (error: any) {
    console.error('Error checking votes:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500, headers });
  }
}

/**
 * Get results data for a room/round that's already in the results stage
 */
async function getResultsData(roomId: string, round: number, adminClient: any) {
  try {
    // Get all players
    const { data: players, error: playersError } = await adminClient
      .from('players')
      .select('id, name')
      .eq('room_id', roomId);
      
    if (playersError) {
      console.error('Error fetching players for results:', playersError);
      return { error: 'Error fetching players' };
    }
    
    // Get all votes
    const { data: votes, error: votesError } = await adminClient
      .from('votes')
      .select('voter_id, voted_for_id')
      .eq('room_id', roomId)
      .eq('round', round);
      
    if (votesError) {
      console.error('Error fetching votes for results:', votesError);
      return { error: 'Error fetching votes' };
    }
    
    // Get the imposter
    const { data: imposter, error: imposterError } = await adminClient
      .from('players')
      .select('id, name')
      .eq('room_id', roomId)
      .eq('is_imposter', true)
      .single();
      
    if (imposterError) {
      console.error('Error fetching imposter for results:', imposterError);
    }
    
    // Create player name lookup map
    const playerMap = players.reduce((map, player) => {
      map[player.id] = player.name;
      return map;
    }, {} as Record<string, string>);
    
    // Count votes
    const voteResults: { [playerId: string]: number } = {};
    
    // Create a mapping of who voted for whom
    const voterMap: { [targetPlayerId: string]: { id: string, name: string }[] } = {};
    
    // Initialize vote results and voter map for all players
    players.forEach(player => {
      voteResults[player.id] = 0;
      voterMap[player.id] = [];
    });
    
    if (votes && votes.length > 0) {
      votes.forEach((vote: { voter_id: string, voted_for_id: string }) => {
        const votedForId = vote.voted_for_id;
        const voterId = vote.voter_id;
        
        // Increment vote count
        voteResults[votedForId] = (voteResults[votedForId] || 0) + 1;
        
        // Add to voter map
        if (playerMap[voterId]) {
          voterMap[votedForId].push({
            id: voterId,
            name: playerMap[voterId]
          });
        }
      });
    }
    
    // Calculate majority
    const totalPlayers = players?.length || 0;
    const majorityThreshold = Math.floor(totalPlayers / 2) + 1;
    
    // Find highest votes
    let highestVoteCount = 0;
    let highestVotedPlayerId = null;
    
    for (const [playerId, voteCount] of Object.entries(voteResults)) {
      if (voteCount > highestVoteCount) {
        highestVoteCount = voteCount;
        highestVotedPlayerId = playerId;
      }
    }
    
    // Check if majority was reached
    const majorityReached = highestVoteCount >= majorityThreshold;
    
    return {
      voteResults,
      voterMap,
      allVoted: players && votes && players.length === votes.length,
      majorityReached,
      majorityPlayerId: majorityReached ? highestVotedPlayerId : null,
      highestVotedPlayerId,
      highestVoteCount,
      imposter,
      totalPlayers,
      totalVotes: votes?.length || 0,
      majorityThreshold,
      shouldTransitionToResults: true
    };
  } catch (err) {
    console.error('Error getting results data:', err);
    return { error: 'Error fetching results data' };
  }
}

/**
 * Update the game state to results
 */
async function updateGameStateToResults(roomId: string, round: number, adminClient: any) {
  try {
    console.log(`Updating game state to results for room ${roomId}, round ${round}`);
    
    // Check if game state already exists
    const { data: existingState, error: checkError } = await adminClient
      .from('game_state')
      .select('id, current_stage')
      .eq('room_id', roomId)
      .eq('round', round)
      .maybeSingle();
      
    if (!checkError && existingState) {
      if (existingState.current_stage === 'results') {
        console.log('Game state is already in results stage, no update needed');
        return;
      }
      
      console.log(`Current game stage: ${existingState.current_stage}, updating to results`);
    }
    
    // Update the game state with a timestamp to ensure all clients detect the change
    const timestamp = new Date().toISOString();
    const { error } = await adminClient
      .from('game_state')
      .upsert({
        room_id: roomId,
        round: round,
        current_stage: 'results',
        last_updated: timestamp
      }, {
        onConflict: 'room_id, round'
      });
      
    if (error) {
      console.error('Error updating game state to results:', error);
    } else {
      console.log(`Successfully updated game state to results with timestamp ${timestamp}`);
    }
  } catch (err) {
    console.error('Exception updating game state to results:', err);
  }
} 