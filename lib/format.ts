// Display an event date like "Jun 15, 2026" (fixed locale for stable SSR).
export function formatEventDate(d: Date | null): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

// Value for <input type="date"> (yyyy-mm-dd).
export function toDateInputValue(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
