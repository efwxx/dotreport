// Client-safe colors for /schedule. No node imports here.

export const PLAYER_COLORS: readonly string[] = [
  "#ef6464",
  "#f08a3a",
  "#f0c93a",
  "#a3d44d",
  "#5cd087",
  "#5cd0c0",
  "#5ca8d0",
  "#6b7fd4",
  "#a07fd4",
  "#c977d4",
  "#d47ba6",
  "#8c97a8",
];

export function colorForPlayer(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}
