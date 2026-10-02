// Seats stay zero-based in game state and API payloads; names are for display.
export function playerName(seat: number) {
  return `Player ${seat + 1}`;
}

export function chipChange(amount: number) {
  return `${amount > 0 ? "+" : ""}${amount.toLocaleString("en-US")}`;
}

// Stable player colors connect the log, table, and results without replacing labels.
export const PLAYER_COLORS = [
  {
    row: "border-l-blue-400 bg-blue-50/60",
    badge: "border-blue-200 bg-blue-50 text-blue-800",
    dot: "bg-blue-500",
  },
  {
    row: "border-l-violet-400 bg-violet-50/60",
    badge: "border-violet-200 bg-violet-50 text-violet-800",
    dot: "bg-violet-500",
  },
  {
    row: "border-l-amber-400 bg-amber-50/60",
    badge: "border-amber-200 bg-amber-50 text-amber-900",
    dot: "bg-amber-500",
  },
  {
    row: "border-l-teal-400 bg-teal-50/60",
    badge: "border-teal-200 bg-teal-50 text-teal-800",
    dot: "bg-teal-500",
  },
  {
    row: "border-l-rose-400 bg-rose-50/60",
    badge: "border-rose-200 bg-rose-50 text-rose-800",
    dot: "bg-rose-500",
  },
  {
    row: "border-l-slate-400 bg-slate-100/70",
    badge: "border-slate-300 bg-slate-100 text-slate-700",
    dot: "bg-slate-500",
  },
] as const;
