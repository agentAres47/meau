import { create } from 'zustand';

// Whether the current user has a live (published) ride token as a driver. Set
// by the Driver tab from its token state; read by the tab bar to lock the
// Passenger/Auto Pool tabs while live — otherwise a driver can hop to Passenger
// and request the very ride they just posted (self-match). The matching
// service's /request also rejects self-targets as the real data-layer guard;
// this is the UX lock on top so the driver can't even navigate there.
type DriverLive = { live: boolean; setLive: (v: boolean) => void };

export const useDriverLive = create<DriverLive>((set) => ({
  live: false,
  setLive: (live) => set({ live }),
}));
