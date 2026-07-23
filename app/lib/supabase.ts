import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Unique Realtime channel topic. A stable name (e.g. `request-<id>`) collides
// when the same entity is subscribed twice — two screens at once, or a
// freezeOnBlur tab un-freezing and re-running its subscribe effect. Supabase
// then throws "cannot add postgres_changes callbacks ... after subscribe()", an
// UNHANDLED error that crashes the app (Android relaunches it to home). A
// per-subscription suffix keeps every channel object distinct; the topic name
// is just a client-side id, so uniqueness doesn't affect the postgres filter.
let channelSeq = 0;
export function channelTopic(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${channelSeq++}`;
}
