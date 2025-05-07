-- Create game rooms table
CREATE TABLE IF NOT EXISTS game_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(6) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  host_id UUID,
  status VARCHAR(10) CHECK (status IN ('waiting', 'playing', 'ended')) DEFAULT 'waiting',
  max_players INTEGER DEFAULT 10,
  current_round INTEGER DEFAULT 0
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  role VARCHAR(10) CHECK (role IN ('host', 'player', 'impostor')) DEFAULT 'player',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Add foreign key constraint for host_id after both tables exist
ALTER TABLE game_rooms 
  ADD CONSTRAINT fk_host_player 
  FOREIGN KEY (host_id) REFERENCES players(id) ON DELETE SET NULL;

-- Create index for faster queries by room code
CREATE INDEX IF NOT EXISTS game_rooms_code_idx ON game_rooms(code);
CREATE INDEX IF NOT EXISTS players_room_id_idx ON players(room_id);

-- Create function to generate random room code
CREATE OR REPLACE FUNCTION generate_room_code() RETURNS VARCHAR(6) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(6) := '';
  i INTEGER := 0;
  pos INTEGER := 0;
BEGIN
  FOR i IN 1..6 LOOP
    pos := 1 + FLOOR(RANDOM() * LENGTH(chars))::INTEGER;
    result := result || SUBSTRING(chars FROM pos FOR 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE; 