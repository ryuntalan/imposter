-- Create votes table to track player votes
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  voted_for_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(voter_id, room_id, round)
);

-- Create function to ensure votes table exists
CREATE OR REPLACE FUNCTION create_votes_table_if_not_exists()
RETURNS void AS $$
BEGIN
  -- Create the votes table if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'votes'
  ) THEN
    EXECUTE '
      CREATE TABLE votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voter_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        voted_for_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        round INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(voter_id, room_id, round)
      )
    ';
  END IF;
END;
$$ LANGUAGE plpgsql; 