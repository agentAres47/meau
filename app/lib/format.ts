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
