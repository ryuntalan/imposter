-- Drop existing game_state table if it exists (be careful with this in production)
DROP TABLE IF EXISTS game_state;

-- Create game_state table with correct reference to rooms table
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

-- Create function to ensure game_state table exists and to update the game state
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