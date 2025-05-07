import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getRoomById, getPlayerById } from '@/lib/rooms';

// Create a new votes table to store player votes
interface Vote {
  id: string;
  room_id: string;
  voter_id: string;
  voted_for_id: string;
  round: number;
  created_at: string;
}

// POST /api/players/vote - Submit a player's vote for the imposter
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
      console.error('Error parsing request body:', error);
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON in request body'
      }, { status: 400, headers });
    }

    console.log('Vote API received request body:', body);

    const { playerId, votedPlayerId, roomId, round } = body;
    
    if (!playerId || !votedPlayerId || !roomId) {
      console.error('Missing required fields:', { playerId, votedPlayerId, roomId });
      return NextResponse.json({
        success: false,
        error: 'Player ID, Voted Player ID, and Room ID are required'
      }, { status: 400, headers });
    }
    
    // Validate the voter exists and belongs to the room
    const voter = await getPlayerById(playerId);
    if (!voter) {
      console.error('Voter not found:', playerId);
      return NextResponse.json({
        success: false,
        error: 'Player not found'
      }, { status: 404, headers });
    }
    
    console.log('Found voter:', { id: voter.id, name: voter.name, roomId: voter.room_id });
    
    if (voter.room_id !== roomId) {
      console.error('Voter does not belong to room:', { 
        voterId: voter.id, 
        voterRoomId: voter.room_id, 
        requestRoomId: roomId 
      });
      return NextResponse.json({
        success: false,
        error: 'Player does not belong to this room'
      }, { status: 403, headers });
    }
    
    // Validate the voted-for player exists and belongs to the room
    const votedFor = await getPlayerById(votedPlayerId);
    if (!votedFor) {
      console.error('Voted player not found:', votedPlayerId);
      return NextResponse.json({
        success: false,
        error: 'Voted player not found'
      }, { status: 404, headers });
    }
    
    console.log('Found voted player:', { id: votedFor.id, name: votedFor.name, roomId: votedFor.room_id });
    
    if (votedFor.room_id !== roomId) {
      console.error('Voted player does not belong to room:', { 
        votedPlayerId: votedFor.id, 
        votedPlayerRoomId: votedFor.room_id, 
        requestRoomId: roomId 
      });
      return NextResponse.json({
        success: false,
        error: 'Voted player does not belong to this room'
      }, { status: 403, headers });
    }
    
    // Get the room to check the current round
    const room = await getRoomById(roomId);
    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Room not found'
      }, { status: 404, headers });
    }
    
    // Try to access votes table first to check if it exists
    let votesTableExists = false;
    
    try {
      const { data, error } = await supabase.from('votes').select('count(*)').limit(1);
      
      if (!error) {
        // Table exists
        votesTableExists = true;
      }
    } catch (e) {
      console.log('Votes table may not exist, will try to create it');
    }
    
    // If votes table doesn't exist, create it
    if (!votesTableExists) {
      try {
        // First try to call the stored function to create the table
        const { error: functionError } = await supabase.rpc('create_votes_table_if_not_exists');
        
        if (functionError) {
          console.error('Error calling create_votes_table_if_not_exists function:', functionError);
          
          // If RPC function fails, try to create the table directly
          try {
            // Use executeRaw for raw SQL queries
            await supabase.from('_sql').select(`
              CREATE TABLE IF NOT EXISTS votes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                voter_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                voted_for_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
                round INTEGER NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(voter_id, room_id, round)
              );
            `);
            console.log('Successfully created votes table directly');
            votesTableExists = true;
          } catch (createError) {
            console.error('Error creating votes table directly:', createError);
            return NextResponse.json({
              success: false,
              error: 'Failed to create votes table. Please try again.'
            }, { status: 500, headers });
          }
        } else {
          console.log('Successfully created votes table via RPC function');
          votesTableExists = true;
        }
      } catch (e) {
        console.error('Unexpected error creating votes table:', e);
        return NextResponse.json({
          success: false,
          error: 'Failed to create votes table: ' + (e instanceof Error ? e.message : String(e))
        }, { status: 500, headers });
      }
    }
    
    if (!votesTableExists) {
      return NextResponse.json({
        success: false,
        error: 'Failed to access or create votes table'
      }, { status: 500, headers });
    }
    
    // Check if player already submitted a vote for this round
    let existingVote;
    try {
      const { data, error } = await supabase
        .from('votes')
        .select('id')
        .eq('voter_id', playerId)
        .eq('room_id', roomId)
        .eq('round', room.round_number)
        .maybeSingle();
        
      if (error) {
        console.error('Error checking for existing vote:', error);
        return NextResponse.json({
          success: false,
          error: `Failed to check for existing vote: ${error.message}`
        }, { status: 500, headers });
      }
      
      existingVote = data;
    } catch (e) {
      console.error('Unexpected error checking for existing vote:', e);
      return NextResponse.json({
        success: false,
        error: 'Failed to check for existing vote: ' + (e instanceof Error ? e.message : String(e))
      }, { status: 500, headers });
    }
    
    if (existingVote) {
      // Update the existing vote
      try {
        const { error: updateError } = await supabase
          .from('votes')
          .update({ voted_for_id: votedPlayerId })
          .eq('id', existingVote.id);
          
        if (updateError) {
          console.error('Error updating vote:', updateError);
          return NextResponse.json({
            success: false,
            error: `Failed to update vote: ${updateError.message}`
          }, { status: 500, headers });
        }
      } catch (e) {
        console.error('Unexpected error updating vote:', e);
        return NextResponse.json({
          success: false,
          error: 'Failed to update vote: ' + (e instanceof Error ? e.message : String(e))
        }, { status: 500, headers });
      }
      
      // Get updated vote results after the update
      let votes;
      try {
        const { data, error: votesError } = await supabase
          .from('votes')
          .select('voted_for_id')
          .eq('room_id', roomId)
          .eq('round', room.round_number);
          
        if (votesError) {
          console.error('Error fetching votes after update:', votesError);
          return NextResponse.json({
            success: false, 
            error: `Failed to fetch updated votes: ${votesError.message}`
          }, { status: 500, headers });
        }
        
        votes = data || [];
      } catch (e) {
        console.error('Unexpected error fetching votes:', e);
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch updated votes: ' + (e instanceof Error ? e.message : String(e))
        }, { status: 500, headers });
      }
      
      // Calculate vote counts
      const voteResults: { [playerId: string]: number } = {};
      if (votes && votes.length > 0) {
        votes.forEach(vote => {
          const votedForId = vote.voted_for_id;
          voteResults[votedForId] = (voteResults[votedForId] || 0) + 1;
        });
      }
      
      return NextResponse.json({
        success: true,
        message: 'Vote updated successfully',
        voteId: existingVote.id,
        voteResults
      }, { headers });
    }
    
    // Insert a new vote
    let newVote;
    try {
      const { data, error: insertError } = await supabase
        .from('votes')
        .insert([{
          voter_id: playerId,
          voted_for_id: votedPlayerId,
          room_id: roomId,
          round: room.round_number
        }])
        .select()
        .single();
        
      if (insertError) {
        console.error('Error inserting vote:', insertError);
        return NextResponse.json({
          success: false,
          error: `Failed to submit vote: ${insertError.message}`
        }, { status: 500, headers });
      }
      
      if (!data) {
        console.error('No vote data returned after insert');
        return NextResponse.json({
          success: false,
          error: 'Failed to submit vote: No data returned'
        }, { status: 500, headers });
      }
      
      newVote = data;
    } catch (e) {
      console.error('Unexpected error inserting vote:', e);
      return NextResponse.json({
        success: false,
        error: 'Failed to submit vote: ' + (e instanceof Error ? e.message : String(e))
      }, { status: 500, headers });
    }
    
    // Check if all players have submitted votes
    let players;
    try {
      const { data, error: playersError } = await supabase
        .from('players')
        .select('id')
        .eq('room_id', roomId);
        
      if (playersError) {
        console.error('Error fetching players:', playersError);
        return NextResponse.json({
          success: false,
          error: `Failed to fetch players: ${playersError.message}`
        }, { status: 500, headers });
      }
      
      players = data || [];
    } catch (e) {
      console.error('Unexpected error fetching players:', e);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch players: ' + (e instanceof Error ? e.message : String(e))
      }, { status: 500, headers });
    }
    
    let votes;
    try {
      const { data, error: votesError } = await supabase
        .from('votes')
        .select('voted_for_id')
        .eq('room_id', roomId)
        .eq('round', room.round_number);
        
      if (votesError) {
        console.error('Error fetching votes:', votesError);
        return NextResponse.json({
          success: false,
          error: `Failed to fetch votes: ${votesError.message}`
        }, { status: 500, headers });
      }
      
      votes = data || [];
    } catch (e) {
      console.error('Unexpected error fetching votes:', e);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch votes: ' + (e instanceof Error ? e.message : String(e))
      }, { status: 500, headers });
    }
    
    const allVoted = players && votes && players.length === votes.length;
    
    // Count votes for each player
    const voteResults: { [playerId: string]: number } = {};
    
    if (votes && votes.length > 0) {
      votes.forEach(vote => {
        const votedForId = vote.voted_for_id;
        voteResults[votedForId] = (voteResults[votedForId] || 0) + 1;
      });
      
      // Check if any player has a majority of votes
      const totalPlayers = players?.length || 0;
      const majorityThreshold = Math.floor(totalPlayers / 2) + 1;
      
      let majorityReached = false;
      let majorityPlayerId = null;
      
      for (const [playerId, voteCount] of Object.entries(voteResults)) {
        if (voteCount >= majorityThreshold) {
          majorityReached = true;
          majorityPlayerId = playerId;
          break;
        }
      }
      
      // If majority reached or all have voted, get the imposter
      if (majorityReached || allVoted) {
        // Get the imposter
        try {
          const { data: imposter, error: imposterError } = await supabase
            .from('players')
            .select('id, name')
            .eq('room_id', roomId)
            .eq('is_imposter', true)
            .single();
            
          if (imposterError) {
            console.error('Error fetching imposter:', imposterError);
            // Don't return an error - we can still provide the voting results
          }
          
          return NextResponse.json({
            success: true,
            message: 'Vote submitted successfully',
            voteId: newVote.id,
            allVoted,
            majorityReached,
            majorityPlayerId,
            voteResults,
            imposter: imposter || null
          }, { headers });
        } catch (e) {
          console.error('Unexpected error fetching imposter:', e);
          // Continue without imposter data
        }
      }
    }
    
    // No majority yet, just return the vote results
    return NextResponse.json({
      success: true,
      message: 'Vote submitted successfully',
      voteId: newVote.id,
      allVoted: false,
      majorityReached: false,
      voteResults
    }, { headers });
    
  } catch (error: any) {
    console.error('Error submitting vote:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500, headers });
  }
} 