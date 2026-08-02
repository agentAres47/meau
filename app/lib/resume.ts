import { getMyActiveToken } from './rides';
import { resumeHref as autopoolResumeHref } from './autopool';

// Where a cold start should land a signed-in user.
//
// index.tsx previously only asked autopool where to go, so a driver who posted
// a ride and then killed the app relaunched onto the Passenger tab as if
// nothing was happening — their ride was still live, but nothing on screen said
// so, and the Passenger/Auto Pool tabs were still unlocked because the lock
// (store/driverLive) is in-memory and starts false on every launch.
//
// Order is most-specific-first: being IN a pool or a match is a stronger claim
// on the screen than having a ride posted, which in turn beats the default.
export async function resolveResumeHref(profileId: string): Promise<string | null> {
  const pool = await autopoolResumeHref(profileId);
  if (pool) return pool;

  const token = await getMyActiveToken(profileId);
  if (token) return '/(tabs)/driver';

  return null;
}
