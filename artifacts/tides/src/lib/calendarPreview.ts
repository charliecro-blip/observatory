/** Intersect a candidate with the visible local day; never change its actual interval. */
export function previewHours(
  start: string,
  end: string,
  day: string,
): { start: number; end: number } | null {
  const floor = new Date(`${day}T00:00:00`);
  const ceiling = new Date(floor);
  ceiling.setDate(ceiling.getDate() + 1);
  const a = new Date(Math.max(Date.parse(start), +floor));
  const b = new Date(Math.min(Date.parse(end), +ceiling));
  if (!(+a < +b)) return null;
  const from = Math.max(5, a.getHours() + a.getMinutes() / 60);
  const to = Math.min(
    23,
    +b === +ceiling ? 24 : b.getHours() + b.getMinutes() / 60,
  );
  return to > from ? { start: from, end: to } : null;
}
