import { supabase } from './supabase';
import { GameRoom, Player } from './types';

/**
 * Generate a random room code
 */
function generateRoomCode(): string {
  // Characters to use in the room code (easily readable, no ambiguous chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  
  // Generate a 6-character code
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars.charAt(randomIndex);
  }
  
  return code;
}

/**
 * Generate a random UUID-like string
 */
function generateUUID() {
  // Simple UUID v4 format generator (not cryptographically secure, but fine for our purpose)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Create a new game room
 */
export async function createRoom(hostName: string): Promise<{ 
  room: Pick<GameRoom, 'id' | 'code'>,
  player: Pick<Player, 'id' | 'name'>
} | null> {
  try {
    // Try to create room with retry for code collisions
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      // Generate room code - use our reliable custom function
      let roomCode = generateRoomCode();
      
      // Ensure we have a valid code
      if (!roomCode || roomCode.length !== 6) {
        console.error('Failed to generate valid room code, using fallback');
        roomCode = 'GAME' + Math.floor(Math.random() * 100).toString().padStart(2, '0');
      }
      
      console.log(`Creating room with code: ${roomCode} (attempt ${attempts}/${maxAttempts})`);
      
      // Step 1: Check if code already exists
      const { data: existingRoom, error: checkError } = await supabase
        .from('rooms')
        .select('code')
        .eq('code', roomCode)
        .maybeSingle();
        
      if (existingRoom) {
        console.log(`Room code ${roomCode} already exists, trying again...`);
        continue; // Try again with a new code
      }
      
      // Step 2: Create the game room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert([
          { 
            code: roomCode,
            round_number: 0,
            is_active: true
          }
        ])
        .select()
        .single();
      
      if (roomError) {
        // If it's a duplicate key error, try again
        if (roomError.code === '23505' && roomError.message?.includes('rooms_code_key')) {
          console.log(`Duplicate room code conflict: ${roomCode}, trying again...`);
          continue; // Try again with a new code
        }
        
        // Otherwise, it's a different error
        const errorMessage = roomError.message || JSON.stringify(roomError);
        console.error('Error creating room - Details:', {
          error: roomError,
          errorMessage,
          errorCode: roomError.code,
          details: roomError.details,
          hint: roomError.hint
        });
        throw new Error(`Failed to create game room: ${errorMessage || 'Unknown database error'}`);
      }
      
      if (!roomData) {
        console.error('No room data returned but no error either');
        throw new Error('Failed to create game room: No data returned');
      }
      
      console.log('Room created successfully, ID:', roomData.id);
      
      // Step 3: Create the host player 
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert([
          { 
            name: hostName,
            room_id: roomData.id,
            is_imposter: false
          }
        ])
        .select()
        .single();
      
      if (playerError) {
        console.error('Error creating host player:', playerError);
        // Attempt to rollback room creation
        await supabase.from('rooms').delete().eq('id', roomData.id);
        throw new Error(`Failed to create host player: ${playerError.message || JSON.stringify(playerError)}`);
      }
      
      if (!playerData) {
        console.error('No player data returned but no error either');
        // Attempt to rollback room creation
        await supabase.from('rooms').delete().eq('id', roomData.id);
        throw new Error('Failed to create host player: No data returned');
      }
      
      console.log('Player created successfully, ID:', playerData.id);
      
      return {
        room: {
          id: roomData.id,
          code: roomData.code,
        },
        player: {
          id: playerData.id,
          name: playerData.name
        }
      };
    }
    
    // If we get here, we've exceeded max attempts
    throw new Error('Failed to create game room: Maximum retry attempts exceeded for generating unique room code');
  } catch (error) {
    console.error('Unexpected error creating game room:', error);
    if (error instanceof Error) {
      throw error; // Rethrow to preserve the error message
    }
    throw new Error('Failed to create game room due to an unknown error');
  }
}

/**
 * Join an existing game room
 */
export async function joinRoom(playerName: string, roomCode: string): Promise<{
  room: Pick<GameRoom, 'id' | 'code'>,
  player: Pick<Player, 'id' | 'name'>
} | null> {
  try {
    console.log(`[joinRoom] Attempting to join room with code: "${roomCode}"`);
    
    // Find the room by code - add detailed logging
    console.log(`[joinRoom] Looking up room with: code=${roomCode.toUpperCase()}, is_active=true`);
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('*, players(*)')
      .eq('code', roomCode.toUpperCase())
      .eq('is_active', true)
      .single();
    
    if (roomError) {
      console.error('[joinRoom] Room lookup error:', roomError);
      // Try a case-insensitive search to debug
      const { data: caseInsensitiveRooms } = await supabase
        .from('rooms')
        .select('code, is_active')
        .ilike('code', roomCode)
        .limit(5);
      
      console.log('[joinRoom] Case-insensitive search results:', caseInsensitiveRooms);
      throw new Error(`Game room not found: ${roomError.message}`);
    }
    
    if (!roomData) {
      console.error('[joinRoom] No room data returned but no error either');
      throw new Error('Game room not found: No data returned');
    }
    
    console.log(`[joinRoom] Found room: ${roomData.id} (${roomData.code})`);
    
    // Check if room is full
    if (roomData.players && roomData.players.length >= 10) {
      console.log(`[joinRoom] Room is full (${roomData.players.length} players)`);
      throw new Error('Game room is full');
    }
    
    // Create a new player for this room
    console.log(`[joinRoom] Creating player ${playerName} for room ${roomData.id}`);
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .insert([
        { 
          name: playerName,
          room_id: roomData.id,
          is_imposter: false
        }
      ])
      .select()
      .single();
    
    if (playerError) {
      console.error('[joinRoom] Error creating player:', playerError);
      throw new Error(`Failed to join game room: ${playerError.message}`);
    }
    
    if (!playerData) {
      console.error('[joinRoom] No player data returned but no error either');
      throw new Error('Failed to join game room: No player data returned');
    }
    
    console.log(`[joinRoom] Successfully joined room: Player ID=${playerData.id}`);
    
    return {
      room: {
        id: roomData.id,
        code: roomData.code,
      },
      player: {
        id: playerData.id,
        name: playerData.name
      }
    };
    
  } catch (error: any) {
    console.error('[joinRoom] Error joining room:', error);
    return null;
  }
}

/**
 * Get room by code
 */
export async function getRoomByCode(code: string): Promise<GameRoom & { players: Player[] } | null> {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select(`
        id, 
        code, 
        created_at, 
        round_number,
        is_active,
        players (
          id, 
          name, 
          is_imposter,
          joined_at
        )
      `)
      .eq('code', code.toUpperCase())
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as any;
  } catch (error) {
    console.error('Error fetching room by code:', error);
    return null;
  }
}

/**
 * Get room by ID
 */
export async function getRoomById(id: string): Promise<GameRoom & { players: Player[] } | null> {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select(`
        id, 
        code, 
        created_at, 
        round_number,
        is_active,
        players (
          id, 
          name, 
          is_imposter,
          joined_at
        )
      `)
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as any;
  } catch (error) {
    console.error('Error fetching room by ID:', error);
    return null;
  }
}

/**
 * Get player by ID
 */
export async function getPlayerById(id: string): Promise<Player | null> {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as Player;
  } catch (error) {
    console.error('Error fetching player:', error);
    return null;
  }
}

/**
 * Get a random prompt for a game
 */
export async function getRandomPrompt(): Promise<{ 
  id: string,
  real_prompt: string,
  imposter_prompt: string
} | null> {
  try {
    console.log('[getRandomPrompt] Fetching random prompt...');
    
    // Get all prompts
    const { data, error } = await supabase
      .from('prompts')
      .select('id, real_prompt, imposter_prompt');
    
    if (error) {
      console.error('[getRandomPrompt] Error fetching prompts:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.error('[getRandomPrompt] No prompts found in database');
      return null;
    }
    
    // Get a random prompt from the results
    const randomIndex = Math.floor(Math.random() * data.length);
    const randomPrompt = data[randomIndex];
    
    console.log(`[getRandomPrompt] Selected prompt: ${randomPrompt.id}`);
    return randomPrompt;
  } catch (error) {
    console.error('[getRandomPrompt] Error fetching random prompt:', error);
    return null;
  }
}

/**
 * Start the game by assigning imposter and selecting a prompt
 */
export async function startGame(roomCode: string): Promise<{
  success: boolean;
  error?: string;
  roomData?: GameRoom & { players: Player[] };
  imposter?: Player;
  prompt?: {
    id: string;
    real_prompt: string;
    imposter_prompt: string;
  };
}> {
  try {
    console.log(`[startGame] Starting game for room code: ${roomCode}`);
    
    // 1. Get the room with players
    const room = await getRoomByCode(roomCode);
    if (!room) {
      console.log(`[startGame] Room not found for code: ${roomCode}`);
      return { success: false, error: 'Room not found' };
    }
    console.log(`[startGame] Room found: ${room.id}, players: ${room.players?.length || 0}`);

    if (!room.players || room.players.length < 2) {
      console.log(`[startGame] Not enough players: ${room.players?.length || 0}`);
      return { success: false, error: 'Not enough players to start the game (minimum 2)' };
    }

    // 2. Reset any existing imposters (in case this is a new round)
    console.log(`[startGame] Resetting existing imposters for room: ${room.id}`);
    const resetResponse = await supabase
      .from('players')
      .update({ is_imposter: false })
      .eq('room_id', room.id);

    if (resetResponse.error) {
      console.error('[startGame] Error resetting imposters:', resetResponse.error);
      return { success: false, error: `Failed to reset player roles: ${resetResponse.error.message}` };
    }
    console.log(`[startGame] Imposters reset`);

    // 3. Randomly select one player to be the imposter
    const randomPlayerIndex = Math.floor(Math.random() * room.players.length);
    const imposter = room.players[randomPlayerIndex];
    console.log(`[startGame] Selected imposter: ${imposter.id} (${imposter.name})`);

    // 4. Update the imposter in the database
    console.log(`[startGame] Setting imposter flag for player: ${imposter.id}`);
    const updateResponse = await supabase
      .from('players')
      .update({ is_imposter: true })
      .eq('id', imposter.id);

    if (updateResponse.error) {
      console.error('[startGame] Error setting imposter:', updateResponse.error);
      return { success: false, error: `Failed to assign imposter role: ${updateResponse.error.message}` };
    }
    console.log(`[startGame] Imposter set successfully`);

    // 5. Select a random prompt
    console.log(`[startGame] Getting a random prompt`);
    const prompt = await getRandomPrompt();
    if (!prompt) {
      console.error('[startGame] No prompts found in database');
      
      // Create a fallback prompt
      const fallbackPrompt = {
        id: 'fallback-prompt-id',
        real_prompt: 'Draw a smiling face',
        imposter_prompt: 'Draw a frowning face'
      };
      
      console.log(`[startGame] Using fallback prompt`);
      
      // 6. Update room to set it to the first round
      console.log(`[startGame] Updating room ${room.id} to round 1 (with fallback prompt)`);
      const roomUpdateResponse = await supabase
        .from('rooms')
        .update({ round_number: 1 })
        .eq('id', room.id);

      if (roomUpdateResponse.error) {
        console.error('[startGame] Error updating room round:', roomUpdateResponse.error);
        return { success: false, error: `Failed to update room status: ${roomUpdateResponse.error.message}` };
      }

      // 7. Get updated room data
      const updatedRoom = await getRoomById(room.id);
      if (!updatedRoom) {
        console.error('[startGame] Failed to get updated room data after setting round');
        return { success: false, error: 'Failed to get updated room data' };
      }

      console.log(`[startGame] Game started successfully with fallback prompt`);
      return {
        success: true,
        roomData: updatedRoom,
        imposter: { ...imposter, is_imposter: true },
        prompt: fallbackPrompt
      };
    }
    
    console.log(`[startGame] Got prompt: ${prompt.id}`);

    // 6. Update room to set it to the current round
    console.log(`[startGame] Updating room ${room.id} to round 1`);
    const roomUpdateResponse = await supabase
      .from('rooms')
      .update({ round_number: 1 })
      .eq('id', room.id);

    if (roomUpdateResponse.error) {
      console.error('[startGame] Error updating room round:', roomUpdateResponse.error);
      return { success: false, error: `Failed to update room status: ${roomUpdateResponse.error.message}` };
    }
    console.log(`[startGame] Room updated to round 1`);

    // 7. Get updated room data
    console.log(`[startGame] Getting updated room data`);
    const updatedRoom = await getRoomById(room.id);
    if (!updatedRoom) {
      console.error('[startGame] Failed to get updated room data');
      return { success: false, error: 'Failed to get updated room data' };
    }
    console.log(`[startGame] Updated room data retrieved, round: ${updatedRoom.round_number}`);

    // Return success with all the needed data
    console.log(`[startGame] Game started successfully`);
    return {
      success: true,
      roomData: updatedRoom,
      imposter: { ...imposter, is_imposter: true },
      prompt
    };
  } catch (error) {
    console.error('[startGame] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error starting game'
    };
  }
} 