import type { Seat } from "./types";

/** Seats remain permanent; only the participating order changes. */
export function seatsAfter(seat: Seat, seats: readonly Seat[]): Seat[] {
  return [...seats].sort((a, b) => ((a - seat + 5) % 6) - ((b - seat + 5) % 6));
}

export function getPositions(dealer: Seat, activeSeats: readonly Seat[]) {
  if (activeSeats.length < 2 || !activeSeats.includes(dealer)) {
    throw new Error("A hand needs at least two active players and a dealer.");
  }
  const order = seatsAfter(dealer, activeSeats);
  return {
    dealer,
    smallBlind: activeSeats.length === 2 ? dealer : order[0],
    bigBlind: activeSeats.length === 2 ? order[0] : order[1],
  };
}
