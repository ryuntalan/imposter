-- First drop any existing constraint on host_id if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_host_player' 
    AND table_name = 'game_rooms'
  ) THEN
    ALTER TABLE game_rooms DROP CONSTRAINT fk_host_player;
  END IF;
END $$;

-- Make sure host_id can be NULL
ALTER TABLE game_rooms ALTER COLUMN host_id DROP NOT NULL;

-- Add the constraint back properly (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_host_player' 
    AND table_name = 'game_rooms'
  ) THEN
    ALTER TABLE game_rooms 
      ADD CONSTRAINT fk_host_player 
      FOREIGN KEY (host_id) REFERENCES players(id) ON DELETE SET NULL;
  END IF;
END $$; 