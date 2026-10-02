import type { Card, Rank, Suit } from "./types";

export function createDeck(): Card[] {
  return [..."23456789TJQKA"].flatMap((rank) =>
    [..."cdhs"].map((suit) => `${rank as Rank}${suit as Suit}` as Card),
  );
}

export function validateDeck(deck: readonly Card[]): void {
  const canonical = new Set(createDeck());
  if (
    deck.length !== 52 ||
    new Set(deck).size !== 52 ||
    deck.some((card) => !canonical.has(card))
  ) {
    throw new Error("A deck must contain all 52 unique cards.");
  }
}

/** Randomness stays outside game transitions; tests pass an ordered deck. */
export function shuffleDeck(): Card[] {
  const deck = createDeck();
  const random = new Uint32Array(1);
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const size = i + 1;
    // Rejection sampling gives every card the same chance of selection.
    const limit = Math.floor(2 ** 32 / size) * size;
    do {
      crypto.getRandomValues(random);
    } while (random[0] >= limit);
    const j = random[0] % size;
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
