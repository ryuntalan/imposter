export interface GameRoom {
  id: string;
  code: string;
  created_at: string;
  round_number: number;
  is_active: boolean;
}

export interface Player {
  id: string;
  name: string;
  room_id: string;
  is_imposter: boolean;
  is_host?: boolean;
  joined_at: string;
}

export interface Prompt {
  id: string;
  real_prompt: string;
  imposter_prompt: string;
}

export interface Answer {
  id: string;
  player_id: string;
  room_id: string;
  prompt_id: string;
  round: number;
  answer: string;
}

export interface Vote {
  id: string;
  voter_id: string;
  voted_for_id: string;
  room_id: string;
  round: number;
  created_at: string;
}

export type GameStage = 'waiting' | 'prompt' | 'answering' | 'reveal' | 'discussion_voting' | 'results';

export interface GameState {
  id: string;
  room_id: string;
  current_stage: GameStage;
  round: number;
  last_updated: string;
}

// Extend environment variables with our custom ones
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_SUPABASE_URL: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
    }
  }
} 