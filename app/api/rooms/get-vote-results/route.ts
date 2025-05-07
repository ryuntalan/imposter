import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getRoomById } from '@/lib/rooms';

// POST /api/rooms/get-vote-results - Get voting results for the current round
export async function POST(request: Request) {
  try {
    const { roomId } = await request.json();
    
    if (!roomId) {
      return NextResponse.json({
        success: false,
        error: 'Room ID is required'
      }, { status: 400 });
    }
    
    // Get the room with players to check the current round
    const room = await getRoomById(roomId);
    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Room not found'
      }, { status: 404 });
    }
    
    // Get all players in the room, noting who is the imposter
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name, is_imposter')
      .eq('room_id', roomId);
      
    if (playersError || !players) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch players: ${playersError?.message || 'No players found'}`
      }, { status: 500 });
    }
    
    // Get all votes for this room and round
    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select(`
        id,
        voter_id,
        voted_for_id,
        round,
        voters:voter_id(id, name),
        voted_for:voted_for_id(id, name, is_imposter)
      `)
      .eq('room_id', roomId)
      .eq('round', room.round_number);
      
    if (votesError) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch votes: ${votesError.message}`
      }, { status: 500 });
    }
    
    // Check if all players have voted
    const allVoted = players.length === votes?.length;
    
    if (!allVoted) {
      return NextResponse.json({
        success: true,
        round: room.round_number,
        playerCount: players.length,
        voteCount: votes?.length || 0,
        waitingForVotes: true,
        allVoted: false
      });
    }
    
    // Find the imposter
    const imposter = players.find(player => player.is_imposter);
    
    if (!imposter) {
      return NextResponse.json({
        success: false,
        error: 'No imposter found for this round'
      }, { status: 500 });
    }
    
    // Count votes for each player
    const voteCounts: Record<string, number> = {};
    
    players.forEach(player => {
      voteCounts[player.id] = 0;
    });
    
    votes?.forEach(vote => {
      if (vote.voted_for_id) {
        voteCounts[vote.voted_for_id] = (voteCounts[vote.voted_for_id] || 0) + 1;
      }
    });
    
    // Find player with most votes
    let mostVotedPlayerId = "";
    let maxVotes = 0;
    let isTie = false;
    
    Object.entries(voteCounts).forEach(([playerId, voteCount]) => {
      if (voteCount > maxVotes) {
        mostVotedPlayerId = playerId;
        maxVotes = voteCount;
        isTie = false;
      } else if (voteCount === maxVotes && voteCount > 0) {
        isTie = true;
      }
    });
    
    const mostVotedPlayer = players.find(player => player.id === mostVotedPlayerId);
    
    // Determine the result
    const imposterCaught = mostVotedPlayerId === imposter.id && !isTie;
    const regularPlayersWon = imposterCaught;
    const imposterWon = !imposterCaught;
    
    // Format the vote data for display
    const formattedVotes = votes?.map(vote => {
      const voter = players.find(p => p.id === vote.voter_id);
      const votedFor = players.find(p => p.id === vote.voted_for_id);
      
      return {
        voterName: voter?.name || 'Unknown',
        votedForName: votedFor?.name || 'Unknown',
        isImposter: votedFor?.is_imposter || false
      };
    });
    
    // Prepare the vote tally for display
    const voteTally = players.map(player => ({
      id: player.id,
      name: player.name,
      isImposter: player.is_imposter,
      votes: voteCounts[player.id] || 0
    })).sort((a, b) => b.votes - a.votes);
    
    return NextResponse.json({
      success: true,
      round: room.round_number,
      playerCount: players.length,
      voteCount: votes?.length || 0,
      waitingForVotes: false,
      allVoted: true,
      imposter: {
        id: imposter.id,
        name: imposter.name
      },
      mostVotedPlayer: mostVotedPlayer ? {
        id: mostVotedPlayer.id,
        name: mostVotedPlayer.name,
        isImposter: mostVotedPlayer.is_imposter,
        votes: maxVotes
      } : null,
      isTie,
      imposterCaught,
      regularPlayersWon,
      imposterWon,
      voteTally,
      votes: formattedVotes
    });
  } catch (error: any) {
    console.error('Error getting vote results:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 