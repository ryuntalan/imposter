import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getRoomById, getPlayerById } from '@/lib/rooms';
import { createClient } from '@supabase/supabase-js';

// Create a new votes table to store player votes
interface Vote {
  id: string;
  room_id: string;
  voter_id: string;
  voted_for_id: string;
  round: number;
  created_at: string;
}

interface Player {
  id: string;
  name: string;
  room_id: string;
  is_imposter: boolean;
}

// POST /api/players/vote - Submit a player's vote for the imposter
export async function POST(request: Request) {
  // Ensure response is always JSON
  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    const body = await request.json();
    const { playerId, roomId, votedPlayerId, round } = body;
    
    if (!playerId || !roomId || !votedPlayerId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400, headers });
    }
    
    console.log('Received vote:', { playerId, roomId, votedPlayerId, round });
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
    
    // Check if the room exists
    let room;
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, round_number')
        .eq('id', roomId)
        .single();
        
      if (error) {
        console.error('Error fetching room:', error);
        return NextResponse.json({
          success: false,
          error: `Room not found: ${error.message}`
        }, { status: 404, headers });
      }
      
      room = data;
    } catch (e) {
      console.error('Unexpected error fetching room:', e);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch room: ' + (e instanceof Error ? e.message : String(e))
      }, { status: 500, headers });
    }
    
    // Ensure the votes table exists
    let votesTableExists = true;
    try {
      const { error } = await supabase
        .from('votes')
        .select('id')
        .limit(1);
        
      if (error && error.code === '42P01') { // Table does not exist
        votesTableExists = false;
      }
    } catch (e) {
      console.error('Error checking votes table:', e);
      // Continue and try to create the table
      votesTableExists = false;
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
    
    // Check if player has already voted and update if so
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
    
    // Store vote ID for response
    let voteId;
    
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
        
        voteId = existingVote.id;
      } catch (e) {
        console.error('Unexpected error updating vote:', e);
        return NextResponse.json({
          success: false,
          error: 'Failed to update vote: ' + (e instanceof Error ? e.message : String(e))
        }, { status: 500, headers });
      }
    } else {
      // Insert a new vote
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
        
        voteId = data.id;
      } catch (e) {
        console.error('Unexpected error inserting vote:', e);
        return NextResponse.json({
          success: false,
          error: 'Failed to submit vote: ' + (e instanceof Error ? e.message : String(e))
        }, { status: 500, headers });
      }
    }
    
    // Get all players with names
    let players;
    try {
      const { data, error: playersError } = await supabase
        .from('players')
        .select('id, name')
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
    
    // Get all votes with voter and voted_for ids
    let votes;
    try {
      const { data, error: votesError } = await supabase
        .from('votes')
        .select('id, voter_id, voted_for_id')
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
    
    // Check if all players have voted
    const allVoted = players.length > 0 && votes.length === players.length;
    
    // Create player name lookup
    const playerMap = players.reduce((map, player) => {
      map[player.id] = player.name;
      return map;
    }, {} as Record<string, string>);
    
    // Count votes for each player
    const voteResults: { [playerId: string]: number } = {};
    
    // Create a mapping of who voted for whom
    const voterMap: { [targetPlayerId: string]: { id: string, name: string }[] } = {};
    
    // Initialize results and voter map with all players
    players.forEach(player => {
      voteResults[player.id] = 0;
      voterMap[player.id] = [];
    });
    
    // Process all votes
    if (votes && votes.length > 0) {
      votes.forEach(vote => {
        const votedForId = vote.voted_for_id;
        const voterId = vote.voter_id;
        
        // Increment vote count
        voteResults[votedForId] = (voteResults[votedForId] || 0) + 1;
        
        // Add to voter map if we have the player's name
        if (playerMap[voterId]) {
          voterMap[votedForId] = voterMap[votedForId] || [];
          voterMap[votedForId].push({
            id: voterId,
            name: playerMap[voterId]
          });
        }
      });
    }
    
    // Check if any player has a majority of votes
    const totalPlayers = players.length;
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
          voteId,
          allVoted,
          majorityReached,
          majorityPlayerId,
          voteResults,
          voterMap,
          imposter: imposter || null
        }, { headers });
      } catch (e) {
        console.error('Unexpected error fetching imposter:', e);
        // Continue without imposter data
      }
    }
    
    // No majority yet, just return the vote results
    return NextResponse.json({
      success: true,
      message: 'Vote submitted successfully',
      voteId,
      allVoted,
      majorityReached: false,
      voteResults,
      voterMap
    }, { headers });
    
  } catch (error: any) {
    console.error('Error submitting vote:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500, headers });
  }
} 