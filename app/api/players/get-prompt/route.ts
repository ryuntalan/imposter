import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRoomById, getPlayerById } from '@/lib/rooms';

// POST /api/players/get-prompt - Get the player's assigned prompt for the current round
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

    const { playerId, roomId } = body;
    console.log('Get prompt request for player:', playerId, 'in room:', roomId);
    
    if (!playerId || !roomId) {
      console.log('Missing playerId or roomId in request');
      return NextResponse.json({
        success: false,
        error: 'Player ID and Room ID are required'
      }, { status: 400, headers });
    }
    
    // Get the player to check if they're an imposter
    const player = await getPlayerById(playerId);
    if (!player) {
      console.log('Player not found:', playerId);
      return NextResponse.json({
        success: false,
        error: 'Player not found'
      }, { status: 404, headers });
    }
    console.log('Found player:', player.name, 'is_imposter:', player.is_imposter);
    
    // Get the room to confirm the player belongs to it
    const room = await getRoomById(roomId);
    if (!room) {
      console.log('Room not found:', roomId);
      return NextResponse.json({
        success: false,
        error: 'Room not found'
      }, { status: 404, headers });
    }
    console.log('Found room:', room.code, 'round:', room.round_number);
    
    // Verify player belongs to this room
    if (player.room_id !== roomId) {
      console.log('Player does not belong to room. Player room_id:', player.room_id, 'Request room_id:', roomId);
      return NextResponse.json({
        success: false,
        error: 'Player does not belong to this room'
      }, { status: 403, headers });
    }
    
    // Use admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Get prompts with admin client to ensure we bypass any RLS
    console.log('Fetching prompts from database');
    const { data: prompts, error: promptsError } = await supabaseAdmin
      .from('prompts')
      .select('id, real_prompt, imposter_prompt')
      .order('id', { ascending: true }) // Ensure consistent ordering
      .limit(100); // Increase limit for more variety
      
    if (promptsError || !prompts || prompts.length === 0) {
      console.log('Error fetching prompts:', promptsError || 'No prompts found');
      
      // Fallback to hardcoded prompt if no prompts in database
      const fallbackPrompt = {
        id: 'fallback-prompt-id',
        real_prompt: 'Draw a smiling face',
        imposter_prompt: 'Draw a frowning face'
      };
      
      console.log('Using fallback prompt');
      return NextResponse.json({
        success: true,
        round: room.round_number,
        prompt: player.is_imposter ? fallbackPrompt.imposter_prompt : fallbackPrompt.real_prompt,
        promptId: fallbackPrompt.id,
        role: player.is_imposter ? 'imposter' : 'regular'
      }, { headers });
    }
    
    console.log(`Found ${prompts.length} prompts in database`);
    
    // First, try to get the pre-selected prompt from round_prompts table
    let selectedPrompt;
    try {
      const { data: roundPrompt, error: roundPromptError } = await supabaseAdmin
        .from('round_prompts')
        .select('prompt_id')
        .eq('room_id', roomId)
        .eq('round', room.round_number)
        .maybeSingle();
      
      if (!roundPromptError && roundPrompt && roundPrompt.prompt_id) {
        console.log(`Found pre-selected prompt for room ${roomId}, round ${room.round_number}: ${roundPrompt.prompt_id}`);
        
        // Find the full prompt details from the prompts list
        selectedPrompt = prompts.find(p => p.id === roundPrompt.prompt_id);
        
        if (selectedPrompt) {
          console.log('Using pre-selected prompt:', selectedPrompt.id);
        } else {
          console.log('Pre-selected prompt not found in available prompts, will select a new one');
        }
      } else {
        console.log('No pre-selected prompt found, will select a new one');
      }
    } catch (err) {
      console.error('Error fetching pre-selected prompt:', err);
      // Will fallback to other selection methods
    }
    
    // If no pre-selected prompt was found or it doesn't exist anymore
    if (!selectedPrompt) {
      // Check if any answers already exist for this round to maintain consistency
      const { data: existingAnswer, error: existingAnswerError } = await supabaseAdmin
        .from('answers')
        .select('prompt_id')
        .eq('room_id', roomId)
        .eq('round', room.round_number)
        .limit(1);
        
      if (!existingAnswerError && existingAnswer && existingAnswer.length > 0) {
        // An answer already exists, use the same prompt
        const existingPromptId = existingAnswer[0].prompt_id;
        console.log(`Found existing answer with prompt ${existingPromptId}, using it for consistency`);
        
        selectedPrompt = prompts.find(p => p.id === existingPromptId);
        
        if (!selectedPrompt) {
          console.log('Prompt from existing answer not found, falling back to random selection');
          selectedPrompt = selectRandomPrompt(prompts, roomId, room.round_number);
        }
      } else {
        // Select a random prompt with a deterministic algorithm
        console.log('No existing answers, selecting random prompt');
        selectedPrompt = selectRandomPrompt(prompts, roomId, room.round_number);
        
        // Store this selection in round_prompts for future players
        try {
          const { error: insertError } = await supabaseAdmin
            .from('round_prompts')
            .upsert({
              room_id: roomId,
              round: room.round_number,
              prompt_id: selectedPrompt.id
            }, {
              onConflict: 'room_id, round'
            });
            
          if (insertError) {
            console.error('Error storing prompt selection:', insertError);
          } else {
            console.log('Prompt selection stored for future players');
          }
        } catch (err) {
          console.error('Error storing prompt selection:', err);
        }
      }
    }
    
    console.log('Final selected prompt:', selectedPrompt.id);
    console.log('Returning prompt based on player role');
    
    // Return the appropriate prompt based on player's role
    return NextResponse.json({
      success: true,
      round: room.round_number,
      prompt: player.is_imposter ? selectedPrompt.imposter_prompt : selectedPrompt.real_prompt,
      promptId: selectedPrompt.id,
      role: player.is_imposter ? 'imposter' : 'regular'
    }, { headers });
  } catch (error: any) {
    console.error('Error getting player prompt:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500, headers });
  }
}

/**
 * Select a random prompt using a deterministic algorithm based on room and round
 * This ensures all players in the same room/round get the same prompt,
 * but different rounds get different (and random) prompts
 */
function selectRandomPrompt(prompts: any[], roomId: string, round: number) {
  // Create a deterministic seed using room ID and round number
  // This ensures all players in the same room and round get the same "random" prompt
  const seed = hashStringToNumber(`${roomId}_${round}`);
  
  // Use the seed to select a random index
  const randomIndex = seed % prompts.length;
  
  return prompts[randomIndex];
}

/**
 * Generate a numeric hash from a string
 * This creates a deterministic number from a string that can be used as a seed
 */
function hashStringToNumber(str: string): number {
  let hash = 0;
  if (str.length === 0) return hash;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  
  // Make sure the hash is positive
  return Math.abs(hash);
} 