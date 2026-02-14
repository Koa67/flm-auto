"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ConversationContext {
  lastVehicles: string[];
  preferences: {
    budget?: { min: number; max: number };
    fuelTypes?: string[];
    childSeats?: number;
    priorities?: string[];
    usage?: string[];
  };
  searchHistory: string[];
}

interface ConversationStore {
  messages: Message[];
  context: ConversationContext;

  addMessage: (msg: Omit<Message, "id" | "timestamp">) => void;
  clearMessages: () => void;
  updateContext: (partial: Partial<ConversationContext>) => void;
  addToSearchHistory: (query: string) => void;
  addViewedVehicle: (vehicleSlug: string) => void;
}

const MAX_MESSAGES = 50;
const MAX_VEHICLES = 10;
const MAX_SEARCHES = 20;

const DEFAULT_CONTEXT: ConversationContext = {
  lastVehicles: [],
  preferences: {},
  searchHistory: [],
};

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set) => ({
      messages: [],
      context: { ...DEFAULT_CONTEXT },

      addMessage: (msg) =>
        set((state) => {
          const newMessage: Message = {
            ...msg,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
          };
          const updated = [...state.messages, newMessage];
          // Keep only the last MAX_MESSAGES
          return {
            messages:
              updated.length > MAX_MESSAGES
                ? updated.slice(updated.length - MAX_MESSAGES)
                : updated,
          };
        }),

      clearMessages: () => set({ messages: [] }),

      updateContext: (partial) =>
        set((state) => ({
          context: { ...state.context, ...partial },
        })),

      addToSearchHistory: (query) =>
        set((state) => {
          const trimmed = query.trim();
          if (!trimmed) return state;
          // Deduplicate: remove existing occurrence, add at end
          const filtered = state.context.searchHistory.filter(
            (q) => q.toLowerCase() !== trimmed.toLowerCase()
          );
          const updated = [...filtered, trimmed];
          return {
            context: {
              ...state.context,
              searchHistory:
                updated.length > MAX_SEARCHES
                  ? updated.slice(updated.length - MAX_SEARCHES)
                  : updated,
            },
          };
        }),

      addViewedVehicle: (vehicleSlug) =>
        set((state) => {
          if (!vehicleSlug) return state;
          // Deduplicate: remove existing, add at end
          const filtered = state.context.lastVehicles.filter(
            (v) => v !== vehicleSlug
          );
          const updated = [...filtered, vehicleSlug];
          return {
            context: {
              ...state.context,
              lastVehicles:
                updated.length > MAX_VEHICLES
                  ? updated.slice(updated.length - MAX_VEHICLES)
                  : updated,
            },
          };
        }),
    }),
    { name: "alain-conversation" }
  )
);
