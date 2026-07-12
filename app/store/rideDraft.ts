import { create } from 'zustand';
import type { Place } from '../lib/maps';

// Holds the in-progress ride post so the location-picker modal can write back to
// the post screen (cleaner than passing objects through route params).
type RideDraft = {
  origin: Place | null;
  dest: Place | null;
  setPlace: (field: 'origin' | 'dest', place: Place) => void;
  reset: () => void;
};

export const useRideDraft = create<RideDraft>((set) => ({
  origin: null,
  dest: null,
  setPlace: (field, place) => set({ [field]: place }),
  reset: () => set({ origin: null, dest: null }),
}));
