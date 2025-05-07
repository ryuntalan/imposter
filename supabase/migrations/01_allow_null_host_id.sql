-- Allow NULL values for host_id in game_rooms
ALTER TABLE IF EXISTS game_rooms ALTER COLUMN host_id DROP NOT NULL; 