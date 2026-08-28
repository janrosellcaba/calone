/** Apple Calendar–style event colors */
export const APPLE_CALENDAR_COLORS = [
  "#007AFF",
  "#34C759",
  "#FF9F0A",
  "#AF52DE",
  "#FF375F",
  "#64D2FF",
  "#5E5CE6",
  "#30D158",
  "#FFD60A",
  "#FF453A",
  "#40C8E0",
  "#BF5AF2",
] as const;

export function appleColorAt(index: number): string {
  const color = APPLE_CALENDAR_COLORS[index % APPLE_CALENDAR_COLORS.length];
  return color ?? "#007AFF";
}
