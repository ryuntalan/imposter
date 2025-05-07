import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRoomByCode, startGame } from '@/lib/rooms';

// Define result types
interface GameActionResult {
  success: boolean;
  error?: string;
  [key: string]: any;
}

// POST /api/debug/simulate-game - Simulate game actions with test players
export async function POST(request: Request) {
  try {
    const { 
      roomCode,
      action = 'simulate_all', // options: 'start_game', 'submit_answers', 'submit_votes', 'majority_vote', 'simulate_all'
      targetPlayer = null, // Used for majority_vote to target a specific player
    } = await request.json();
    
    if (!roomCode) {
      return NextResponse.json({
        success: false,
        error: 'Room code is required'
      }, { status: 400 });
    }
    
    // Use admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Get the room with players
    const { data: roomData, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('*, players(*)')
      .eq('code', roomCode)
      .single();
      
    if (roomError || !roomData) {
      return NextResponse.json({
        success: false,
        error: roomError ? roomError.message : 'Room not found'
      }, { status: 404 });
    }
    
    // Check if there are enough players
    if (!roomData.players || roomData.players.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Not enough players to simulate game (minimum 2 required)',
        playerCount: roomData.players?.length || 0
      }, { status: 400 });
    }
    
    // Results to return
    const results: Record<string, GameActionResult | null> = {
      startGame: null,
      submitAnswers: null,
      submitVotes: null,
      majorityVote: null
    };
    
    // 1. Start the game if requested
    if (action === 'start_game' || action === 'simulate_all') {
      const startResult = await startGame(roomCode);
      results.startGame = startResult;
      
      if (!startResult.success) {
        return NextResponse.json({
          success: false,
          error: `Failed to start game: ${startResult.error}`,
          results
        }, { status: 500 });
      }
    }
    
    // 2. Submit player answers if requested
    if (action === 'submit_answers' || action === 'simulate_all') {
      try {
        results.submitAnswers = { success: true, answers: [] };
        
        // Get a random prompt to use
        const { data: prompt, error: promptError } = await supabaseAdmin
          .from('prompts')
          .select('id, real_prompt, imposter_prompt')
          .limit(1)
          .single();
          
        if (promptError || !prompt) {
          return NextResponse.json({
            success: false,
            error: 'Failed to get a prompt for answers',
            results
          }, { status: 500 });
        }
        
        // Refreshing players data to get the imposter
        const { data: players, error: playersError } = await supabaseAdmin
          .from('players')
          .select('id, name, is_imposter')
          .eq('room_id', roomData.id);
          
        if (playersError || !players) {
          return NextResponse.json({
            success: false,
            error: 'Failed to get players',
            results
          }, { status: 500 });
        }
        
        // Submit an answer for each player
        for (const player of players) {
          // Generate a plausible answer based on if they're the imposter
          const simulatedAnswer = player.is_imposter 
            ? `Imposter Answer: ${Math.floor(Math.random() * 1000)}`
            : `Regular Answer: ${Math.floor(Math.random() * 1000)}`;
          
          // Check if the player already submitted an answer
          const { data: existingAnswer } = await supabaseAdmin
            .from('answers')
            .select('id')
            .eq('player_id', player.id)
            .eq('room_id', roomData.id)
            .eq('round', roomData.round_number)
            .maybeSingle();
            
          if (existingAnswer) {
            // Update the existing answer
            const { data: updatedAnswer, error: updateError } = await supabaseAdmin
              .from('answers')
              .update({ answer: simulatedAnswer })
              .eq('id', existingAnswer.id)
              .select()
              .single();
              
            if (!updateError && results.submitAnswers) {
              results.submitAnswers.answers.push({
                player: player.name,
                answer: simulatedAnswer,
                isImposter: player.is_imposter,
                updated: true
              });
            }
          } else {
            // Insert a new answer
            const { data: newAnswer, error: insertError } = await supabaseAdmin
              .from('answers')
              .insert([{
                player_id: player.id,
                room_id: roomData.id,
                prompt_id: prompt.id,
                round: roomData.round_number,
                answer: simulatedAnswer
              }])
              .select()
              .single();
              
            if (!insertError && results.submitAnswers) {
              results.submitAnswers.answers.push({
                player: player.name,
                answer: simulatedAnswer,
                isImposter: player.is_imposter,
                added: true
              });
            }
          }
        }
      } catch (error) {
        console.error('Error submitting answers:', error);
        results.submitAnswers = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          answers: []
        };
      }
    }
    
    // 3. Submit random player votes if requested
    if (action === 'submit_votes' || action === 'simulate_all') {
      try {
        results.submitVotes = { success: true, votes: [] };
        
        // Ensure votes table exists
        try {
          await supabaseAdmin.rpc('create_votes_table_if_not_exists');
        } catch (error) {
          // Ignore errors here - table might already exist
          console.log('Votes table may already exist:', error);
        }
        
        // Get latest player data
        const { data: players, error: playersError } = await supabaseAdmin
          .from('players')
          .select('id, name, is_imposter')
          .eq('room_id', roomData.id);
          
        if (playersError || !players) {
          return NextResponse.json({
            success: false,
            error: 'Failed to get players for voting',
            results
          }, { status: 500 });
        }
        
        // Each player votes for a random other player
        for (const voter of players) {
          // Choose a random player to vote for (who is not themselves)
          const votablePlayers = players.filter(p => p.id !== voter.id);
          const votedFor = votablePlayers[Math.floor(Math.random() * votablePlayers.length)];
          
          // Check if player already submitted a vote
          const { data: existingVote } = await supabaseAdmin
            .from('votes')
            .select('id')
            .eq('voter_id', voter.id)
            .eq('room_id', roomData.id)
            .eq('round', roomData.round_number)
            .maybeSingle();
            
          if (existingVote) {
            // Update the existing vote
            const { error: updateError } = await supabaseAdmin
              .from('votes')
              .update({ voted_for_id: votedFor.id })
              .eq('id', existingVote.id);
              
            if (!updateError && results.submitVotes) {
              results.submitVotes.votes.push({
                voter: voter.name,
                votedFor: votedFor.name,
                isImposter: votedFor.is_imposter,
                updated: true
              });
            }
          } else {
            // Insert a new vote
            const { error: insertError } = await supabaseAdmin
              .from('votes')
              .insert([{
                voter_id: voter.id,
                voted_for_id: votedFor.id,
                room_id: roomData.id,
                round: roomData.round_number
              }]);
              
            if (!insertError && results.submitVotes) {
              results.submitVotes.votes.push({
                voter: voter.name,
                votedFor: votedFor.name,
                isImposter: votedFor.is_imposter,
                added: true
              });
            }
          }
        }
      } catch (error) {
        console.error('Error submitting votes:', error);
        results.submitVotes = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          votes: []
        };
      }
    }
    
    // 4. Submit majority vote targeting a specific player (or the imposter by default)
    if (action === 'majority_vote') {
      try {
        results.majorityVote = { success: true, votes: [] };
        
        // Ensure votes table exists
        try {
          await supabaseAdmin.rpc('create_votes_table_if_not_exists');
        } catch (error) {
          // Ignore errors here - table might already exist
          console.log('Votes table may already exist:', error);
        }
        
        // Get latest player data
        const { data: players, error: playersError } = await supabaseAdmin
          .from('players')
          .select('id, name, is_imposter')
          .eq('room_id', roomData.id);
          
        if (playersError || !players) {
          return NextResponse.json({
            success: false,
            error: 'Failed to get players for voting',
            results
          }, { status: 500 });
        }
        
        // Find the target player (either a specific player or the imposter)
        let targetPlayerObj;
        
        if (targetPlayer) {
          // Find the specified target player
          targetPlayerObj = players.find(p => p.id === targetPlayer || p.name === targetPlayer);
          
          if (!targetPlayerObj) {
            return NextResponse.json({
              success: false,
              error: 'Target player not found',
              results
            }, { status: 404 });
          }
        } else {
          // Default to the imposter
          targetPlayerObj = players.find(p => p.is_imposter);
          
          if (!targetPlayerObj) {
            return NextResponse.json({
              success: false,
              error: 'No imposter found in the game',
              results
            }, { status: 404 });
          }
        }
        
        console.log('Creating majority vote targeting:', targetPlayerObj.name);
        
        // Calculate how many votes are needed for a majority
        const totalPlayers = players.length;
        const majorityThreshold = Math.floor(totalPlayers / 2) + 1;
        
        // Clear any existing votes first
        const { error: clearError } = await supabaseAdmin
          .from('votes')
          .delete()
          .eq('room_id', roomData.id)
          .eq('round', roomData.round_number);
          
        if (clearError) {
          console.error('Error clearing existing votes:', clearError);
        }
        
        // Assign votes to create a majority
        let votesAssigned = 0;
        
        for (const voter of players) {
          // Skip self-voting
          if (voter.id === targetPlayerObj.id) {
            // If the target is voting, have them vote for someone else
            const otherPlayer = players.find(p => p.id !== targetPlayerObj.id);
            if (otherPlayer) {
              const { error: insertError } = await supabaseAdmin
                .from('votes')
                .insert([{
                  voter_id: voter.id,
                  voted_for_id: otherPlayer.id,
                  room_id: roomData.id,
                  round: roomData.round_number
                }]);
                
              if (!insertError && results.majorityVote) {
                results.majorityVote.votes.push({
                  voter: voter.name,
                  votedFor: otherPlayer.name,
                  added: true
                });
              }
            }
            continue;
          }
          
          // If we need more votes for majority, vote for the target
          if (votesAssigned < majorityThreshold) {
            const { error: insertError } = await supabaseAdmin
              .from('votes')
              .insert([{
                voter_id: voter.id,
                voted_for_id: targetPlayerObj.id,
                room_id: roomData.id,
                round: roomData.round_number
              }]);
              
            if (!insertError && results.majorityVote) {
              results.majorityVote.votes.push({
                voter: voter.name,
                votedFor: targetPlayerObj.name,
                added: true
              });
              votesAssigned++;
            }
          } else {
            // If we have enough votes for majority, distribute remaining votes
            // Find another player to vote for
            const otherPlayers = players.filter(p => p.id !== voter.id && p.id !== targetPlayerObj.id);
            if (otherPlayers.length > 0) {
              const randomPlayer = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
              
              const { error: insertError } = await supabaseAdmin
                .from('votes')
                .insert([{
                  voter_id: voter.id,
                  voted_for_id: randomPlayer.id,
                  room_id: roomData.id,
                  round: roomData.round_number
                }]);
                
              if (!insertError && results.majorityVote) {
                results.majorityVote.votes.push({
                  voter: voter.name,
                  votedFor: randomPlayer.name,
                  added: true
                });
              }
            }
          }
        }
        
        // Get vote counts for the result
        const voteResults: Record<string, number> = {};
        
        for (const vote of results.majorityVote.votes) {
          voteResults[vote.votedFor] = (voteResults[vote.votedFor] || 0) + 1;
        }
        
        results.majorityVote.voteCounts = voteResults;
        results.majorityVote.targetPlayer = {
          id: targetPlayerObj.id,
          name: targetPlayerObj.name,
          is_imposter: targetPlayerObj.is_imposter
        };
        results.majorityVote.majorityThreshold = majorityThreshold;
        results.majorityVote.votesForTarget = votesAssigned;
        
      } catch (error) {
        console.error('Error creating majority vote:', error);
        results.majorityVote = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          votes: []
        };
      }
    }
    
    // Get the room data after all operations
    const { data: updatedRoom } = await supabaseAdmin
      .from('rooms')
      .select('id, code, round_number')
      .eq('id', roomData.id)
      .single();
    
    return NextResponse.json({
      success: true,
      message: `Simulated ${action} successfully`,
      room: updatedRoom,
      results
    });
  } catch (error: any) {
    console.error('Error simulating game:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 