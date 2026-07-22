import { create } from 'zustand';
import type { Place } from '../lib/maps';

// Mirrors store/rideDraft.ts exactly, but separate: Driver and Passenger now
// both pick origin/dest via the same modal/location-picker, and with tabs
// staying mounted (freezeOnBlur, not unmount) a shared store would let one
// role's in-progress pickup/drop silently wipe the other's on first visit to
// the other tab. Kept as its own store rather than namespacing the existing
// one to avoid touching passenger's already-working call sites.
type DriverRideDraft = {
  origin: Place | null;
  dest: Place | null;
  setPlace: (field: 'origin' | 'dest', place: Place) => void;
  reset: () => void;
};

export const useDriverRideDraft = create<DriverRideDraft>((set) => ({
  origin: null,
  dest: null,
  setPlace: (field, place) => set({ [field]: place }),
  reset: () => set({ origin: null, dest: null }),
}));
