'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Player, GameRoom } from './types';
import { getPlayerById } from './rooms';

// Define the context types
type GameStateContextType = {
  currentPlayer: Player | null;
  setCurrentPlayer: (player: Player | null) => void;
  isLoading: boolean;
  checkPlayerCookie: () => Promise<Player | null>;
};

// Create the contexts
const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

// Context Provider component
export function GameStateProvider({ children }: { children: ReactNode }) {
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Store player data in localStorage whenever it changes
  useEffect(() => {
    if (currentPlayer) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('player_data', JSON.stringify(currentPlayer));
      }
    }
  }, [currentPlayer]);

  useEffect(() => {
    // On initial load, check if the player ID is in cookies or localStorage
    checkPlayerCookie().finally(() => {
      setIsLoading(false);
    });
  }, []);

  // Function to get player ID from cookie
  const getPlayerIdFromCookie = (): string | null => {
    if (typeof document === 'undefined') return null; // SSR check

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'player_id') {
        return value;
      }
    }
    return null;
  };

  // Function to load player data from local storage
  const getPlayerFromLocalStorage = (): Player | null => {
    if (typeof window === 'undefined') return null; // SSR check
    
    const storedPlayer = localStorage.getItem('player_data');
    if (storedPlayer) {
      try {
        return JSON.parse(storedPlayer) as Player;
      } catch (e) {
        console.error('Error parsing stored player data:', e);
      }
    }
    return null;
  };

  // Function to load player data from the server
  const checkPlayerCookie = async (): Promise<Player | null> => {
    // First try to get from localStorage (faster)
    const localPlayer = getPlayerFromLocalStorage();
    if (localPlayer) {
      console.log('Found player in localStorage:', localPlayer.id);
      setCurrentPlayer(localPlayer);
      return localPlayer;
    }
    
    // Otherwise try to get from cookie + backend
    const playerId = getPlayerIdFromCookie();
    if (!playerId) return null;

    try {
      console.log('Fetching player from server:', playerId);
      const player = await getPlayerById(playerId);
      if (player) {
        console.log('Player fetched successfully:', player);
        setCurrentPlayer(player);
        return player;
      }
    } catch (error) {
      console.error('Error fetching player data:', error);
    }
    return null;
  };

  return (
    <GameStateContext.Provider
      value={{
        currentPlayer,
        setCurrentPlayer,
        isLoading,
        checkPlayerCookie
      }}
    >
      {children}
    </GameStateContext.Provider>
  );
}

// Custom hooks to use the contexts
export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
} 