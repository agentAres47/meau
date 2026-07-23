export function formatDepart(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const day =
    d.toDateString() === now.toDateString()
      ? 'Today'
      : d.toDateString() === tomorrow.toDateString()
        ? 'Tomorrow'
        : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}

// F1 ETA — "~6 min", optionally "~6 min · 1.8 km". Rounds up to at least 1 min
// so a nearby pickup never reads "~0 min". The "~" carries the estimate.
export function formatEta(seconds: number, meters?: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  const base = `~${min} min`;
  return meters == null ? base : `${base} · ${(meters / 1000).toFixed(1)} km`;
}
