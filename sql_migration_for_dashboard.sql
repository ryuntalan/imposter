-- This file contains SQL that you can run directly in the Supabase dashboard SQL editor
-- It will create the game_state table and the update_game_state function

-- Create game_state table
CREATE TABLE IF NOT EXISTS game_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  current_stage TEXT NOT NULL DEFAULT 'waiting',
  round INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, round)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_game_state_room_id ON game_state(room_id);
CREATE INDEX IF NOT EXISTS idx_game_state_room_round ON game_state(room_id, round);

-- Create function to update game state
CREATE OR REPLACE FUNCTION update_game_state(
  p_room_id UUID,
  p_round INTEGER,
  p_current_stage TEXT
)
RETURNS void AS $$
DECLARE
  existing_state_id UUID;
BEGIN
  -- Check if a state already exists for this room and round
  SELECT id INTO existing_state_id
  FROM game_state
  WHERE room_id = p_room_id AND round = p_round;
  
  IF existing_state_id IS NOT NULL THEN
    -- Update existing state
    UPDATE game_state
    SET current_stage = p_current_stage,
        last_updated = NOW()
    WHERE id = existing_state_id;
  ELSE
    -- Insert new state
    INSERT INTO game_state (room_id, round, current_stage)
    VALUES (p_room_id, p_round, p_current_stage);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add a test record for your problematic room
-- Replace the room ID with your actual room ID if different
INSERT INTO game_state (room_id, round, current_stage)
VALUES (
  '2b261041-18f4-4906-9985-36ec28a5f2b2',
  1,
  'discussion_voting'
)
ON CONFLICT (room_id, round) 
DO UPDATE SET 
  current_stage = 'discussion_voting',
  last_updated = NOW(); 