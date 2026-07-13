import { create } from 'zustand';
import type { Place } from '../lib/maps';
import type { Match } from '../lib/passenger';

// Carries the passenger search + its results into the results screen.
type SearchState = {
  requestId: string | null;
  pickup: Place | null;
  drop: Place | null;
  offer: number;
  matches: Match[];
  setResults: (r: {
    requestId: string;
    pickup: Place;
    drop: Place;
    offer: number;
    matches: Match[];
  }) => void;
  reset: () => void;
};

export const useSearch = create<SearchState>((set) => ({
  requestId: null,
  pickup: null,
  drop: null,
  offer: 0,
  matches: [],
  setResults: (r) => set(r),
  reset: () => set({ requestId: null, pickup: null, drop: null, offer: 0, matches: [] }),
}));
