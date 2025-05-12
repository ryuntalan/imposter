import { createClient } from '@supabase/supabase-js';
import type { GameRoom, Player, Prompt, Answer, Vote, GameState } from './types';

// Define database schema types for Supabase
export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: GameRoom;
        Insert: Omit<GameRoom, 'id' | 'created_at'>;
        Update: Partial<Omit<GameRoom, 'id' | 'created_at'>>;
      };
      players: {
        Row: Player;
        Insert: Omit<Player, 'id' | 'joined_at'>;
        Update: Partial<Omit<Player, 'id' | 'joined_at'>>;
      };
      prompts: {
        Row: Prompt;
        Insert: Omit<Prompt, 'id' | 'created_at'>;
        Update: Partial<Omit<Prompt, 'id' | 'created_at'>>;
      };
      answers: {
        Row: Answer;
        Insert: Omit<Answer, 'id' | 'created_at'>;
        Update: Partial<Omit<Answer, 'id' | 'created_at'>>;
      };
      votes: {
        Row: Vote;
        Insert: Omit<Vote, 'id' | 'created_at'>;
        Update: Partial<Omit<Vote, 'id' | 'created_at'>>;
      };
      game_state: {
        Row: GameState;
        Insert: Omit<GameState, 'id' | 'last_updated'>;
        Update: Partial<Omit<GameState, 'id' | 'last_updated'>>;
      };
    };
    Views: {
      // Views are not implemented in this example but would go here
    };
    Functions: {
      generate_room_code: {
        Args: Record<string, never>;
        Returns: string;
      };
      create_votes_table_if_not_exists: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
  };
};

// Provide fallback values for environment variables during build
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MTM0MDcyMDAsImV4cCI6MTkyODk4MzIwMH0.placeholder';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Log warning if using fallback values
if (process.env.NODE_ENV !== 'production') {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn('Warning: NEXT_PUBLIC_SUPABASE_URL is not set. Using fallback value for development.');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Warning: NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Using fallback value for development.');
  }
} 