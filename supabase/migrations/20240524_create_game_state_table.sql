-- Create game_state table to track the current state of each room's game
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