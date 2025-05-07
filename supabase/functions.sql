-- Function to execute SQL statements from the debug endpoint
-- Note: This is dangerous in production but useful for development
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT) RETURNS VOID AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql;

-- Function to check if an extension exists and is installed
CREATE OR REPLACE FUNCTION check_extensions(extension_name TEXT) RETURNS BOOLEAN AS $$
DECLARE
  ext_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = extension_name
  ) INTO ext_exists;
  
  RETURN ext_exists;
END;
$$ LANGUAGE plpgsql;

-- Function to create votes table if it doesn't exist
CREATE OR REPLACE FUNCTION create_votes_table_if_not_exists() RETURNS VOID AS $$
BEGIN
  -- Check if the votes table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'votes'
  ) THEN
    -- Create the votes table
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
    
    -- Create indexes for faster queries
    EXECUTE 'CREATE INDEX idx_votes_room_round ON votes(room_id, round)';
    EXECUTE 'CREATE INDEX idx_votes_voter ON votes(voter_id)';
  END IF;
END;
$$ LANGUAGE plpgsql; 