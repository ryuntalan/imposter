import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { GameState, GameStage } from './types';

// Add a custom interface for the Window object
declare global {
  interface Window {
    playersPollInterval?: NodeJS.Timeout;
    roomPollInterval?: NodeJS.Timeout;
    gameStatePollInterval?: NodeJS.Timeout;
  }
}

// Add a debug flag for verbose logging
const DEBUG = true;

/**
 * Subscribe to players in a room to get real-time updates
 */
export function subscribeToRoomPlayers(
  roomId: string,
  callback: (players: any[]) => void
): RealtimeChannel {
  // Get initial players
  fetchRoomPlayers(roomId).then(players => {
    callback(players);
  }).catch(err => {
    console.error('Failed to fetch initial players:', err);
    // Return empty array if initial fetch fails
    callback([]);
  });

  // Set up real-time subscription to the PLAYERS table (not just the room)
  try {
    const channel = supabase
      .channel(`room-players:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('Players changed:', payload);
          fetchRoomPlayers(roomId).then(players => {
            callback(players);
          }).catch(err => {
            console.error('Failed to fetch players after change:', err);
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to players changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Failed to subscribe to players changes');
          // Fallback to polling
          startPlayerPolling(roomId, callback);
        }
      });

    return channel;
  } catch (err) {
    console.error('Error setting up players subscription:', err);
    // Create a dummy channel that can be unsubscribed from
    const dummyChannel = supabase.channel('dummy');
    
    // Start polling as fallback
    startPlayerPolling(roomId, callback);
    
    return dummyChannel;
  }
}

/**
 * Subscribe to room changes
 */
export function subscribeToRoom(
  roomId: string,
  callback: (room: any) => void
): RealtimeChannel {
  // Get initial room data
  fetchRoom(roomId).then(room => {
    if (room) callback(room);
  }).catch(err => {
    console.error('Failed to fetch initial room data:', err);
  });

  // Set up real-time subscription with error handling
  try {
    const channel = supabase
      .channel(`room-details:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`
        },
        () => {
          // When we get an update, fetch the room
          fetchRoom(roomId).then(room => {
            if (room) callback(room);
          }).catch(err => {
            console.error('Failed to fetch room after change:', err);
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to room changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Failed to subscribe to room changes');
          // Fallback to polling
          startRoomPolling(roomId, callback);
        }
      });

    return channel;
  } catch (err) {
    console.error('Error setting up room subscription:', err);
    // Create a dummy channel that can be unsubscribed from
    const dummyChannel = supabase.channel('dummy');
    
    // Start polling as fallback
    startRoomPolling(roomId, callback);
    
    return dummyChannel;
  }
}

/**
 * Subscribe to the game state to get real-time updates on the current stage
 */
export function subscribeToGameState(
  roomId: string,
  round: number,
  callback: (gameState: GameState) => void
): RealtimeChannel {
  // Initial fetch
  fetchGameState(roomId, round).then(gameState => {
    if (gameState) {
      if (DEBUG) console.log('[realtime] Initial game state:', gameState);
      callback(gameState);
    }
  }).catch(err => {
    console.error('[realtime] Failed to fetch initial game state:', err);
  });
  
  // Clear existing interval if it exists
  if (typeof window !== 'undefined' && window.gameStatePollInterval) {
    clearInterval(window.gameStatePollInterval);
    window.gameStatePollInterval = undefined;
  }

  // Subscribe to changes in game_state table
  const channel = supabase
    .channel(`game-state-${roomId}-${round}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'game_state',
        filter: `room_id=eq.${roomId}`,
      },
      (payload: any) => {
        if (DEBUG) console.log('[realtime] Game state change detected:', payload);
        
        // Extract the game state from the payload
        const { new: newGameState, old: oldGameState } = payload;
        
        // If the payload contains valid game state and matches the current round
        if (newGameState && newGameState.round === round) {
          const gameState: GameState = {
            id: newGameState.id,
            room_id: newGameState.room_id,
            round: newGameState.round,
            current_stage: newGameState.current_stage as GameStage,
            last_updated: newGameState.last_updated || new Date().toISOString()
          };
          
          if (DEBUG) {
            console.log(`[realtime] Game state updated for room ${roomId}, round ${round}:`);
            console.log(`[realtime] Stage: ${oldGameState?.current_stage || 'unknown'} -> ${gameState.current_stage}`);
            
            // Log specifically when transitioning to discussion_voting stage
            if (gameState.current_stage === 'discussion_voting' && oldGameState?.current_stage !== 'discussion_voting') {
              console.log('[realtime] 🚨 IMPORTANT: Transitioning to discussion_voting stage');
            }
          }
          
          callback(gameState);
        }
      }
    )
    .subscribe((status) => {
      if (DEBUG) console.log(`[realtime] Game state subscription status: ${status}`);
      
      if (status !== 'SUBSCRIBED') {
        console.warn(`[realtime] Game state subscription failed with status: ${status}`);
        
        // If subscription fails, fall back to polling
        console.log('[realtime] Falling back to polling for game state updates');
        setupGameStatePolling(roomId, round, callback);
      }
    });

  return channel;
}

/**
 * Set up a polling mechanism as a fallback for game state updates
 */
function setupGameStatePolling(
  roomId: string,
  round: number,
  callback: (gameState: GameState) => void
) {
  if (typeof window === 'undefined') return;
  
  // Set up an interval to poll for room state
  if (window.gameStatePollInterval) {
    clearInterval(window.gameStatePollInterval);
  }
  
  // Poll every 3 seconds
  window.gameStatePollInterval = setInterval(() => {
    if (DEBUG) console.log('[realtime] Polling for game state updates');
    
    fetchGameState(roomId, round).then(gameState => {
      if (gameState) {
        if (DEBUG) console.log('[realtime] Polled game state:', gameState);
        callback(gameState);
      }
    }).catch(err => {
      console.error('[realtime] Failed to poll game state:', err);
    });
  }, 3000);
}

/**
 * Fetch the current game state from the server
 */
async function fetchGameState(roomId: string, round: number): Promise<GameState | null> {
  try {
    if (DEBUG) console.log(`[realtime] Fetching game state for room ${roomId}, round ${round}`);
    
    const { data, error } = await supabase
      .from('game_state')
      .select('id, room_id, round, current_stage, last_updated')
      .eq('room_id', roomId)
      .eq('round', round)
      .maybeSingle();
      
    if (error) {
      console.error('[realtime] Error fetching game state:', error);
      return null;
    }
    
    if (!data) {
      if (DEBUG) console.log('[realtime] No game state found, returning null');
      return null;
    }
    
    const gameState: GameState = {
      id: data.id,
      room_id: data.room_id,
      round: data.round,
      current_stage: data.current_stage as GameStage,
      last_updated: data.last_updated
    };
    
    if (DEBUG) console.log('[realtime] Found game state:', gameState);
    return gameState;
  } catch (err) {
    console.error('[realtime] Error in fetchGameState:', err);
    return null;
  }
}

/**
 * Fallback polling function for players
 */
function startPlayerPolling(roomId: string, callback: (players: any[]) => void) {
  const interval = setInterval(() => {
    fetchRoomPlayers(roomId).then(players => {
      callback(players);
    }).catch(err => {
      console.error('Error polling players:', err);
    });
  }, 3000);
  
  // Store the interval ID in the window object so it can be cleared later
  if (typeof window !== 'undefined') {
    window.playersPollInterval = interval;
  }
  
  return interval;
}

/**
 * Fallback polling function for room
 */
function startRoomPolling(roomId: string, callback: (room: any) => void) {
  const interval = setInterval(() => {
    fetchRoom(roomId).then(room => {
      if (room) callback(room);
    }).catch(err => {
      console.error('Error polling room:', err);
    });
  }, 3000);
  
  // Store the interval ID in the window object so it can be cleared later
  if (typeof window !== 'undefined') {
    window.roomPollInterval = interval;
  }
  
  return interval;
}

/**
 * Fetch all players in a room
 */
async function fetchRoomPlayers(roomId: string) {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, room_id, is_imposter, joined_at')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching players:', error);
      return [];
    }
    
    console.log(`Fetched ${data?.length || 0} players for room ${roomId}:`, data);
    return data || [];
  } catch (err) {
    console.error('Exception fetching players:', err);
    return [];
  }
}

/**
 * Fetch a single room
 */
async function fetchRoom(roomId: string) {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    
    if (error) {
      console.error('Error fetching room:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Exception fetching room:', err);
    return null;
  }
}

/**
 * Clean up a subscription and any polling intervals
 */
export function unsubscribe(channel: RealtimeChannel) {
  // Clean up Supabase channel
  supabase.removeChannel(channel);
  
  // Clean up any polling intervals
  if (typeof window !== 'undefined') {
    if (window.playersPollInterval) {
      clearInterval(window.playersPollInterval);
      window.playersPollInterval = undefined;
    }
    if (window.roomPollInterval) {
      clearInterval(window.roomPollInterval);
      window.roomPollInterval = undefined;
    }
    if (window.gameStatePollInterval) {
      clearInterval(window.gameStatePollInterval);
      window.gameStatePollInterval = undefined;
    }
  }
} 