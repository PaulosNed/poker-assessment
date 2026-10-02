export const SEATS = [0, 1, 2, 3, 4, 5] as const;
export type Seat = (typeof SEATS)[number];
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "T"
  | "J"
  | "Q"
  | "K"
  | "A";
export type Suit = "c" | "d" | "h" | "s";
export type Card = `${Rank}${Suit}`;
export type Street = "Preflop" | "Flop" | "Turn" | "River";
export type ActionType = "Fold" | "Check" | "Call" | "Bet" | "Raise" | "Allin";

export const SMALL_BLIND = 20;
export const BIG_BLIND = 40;
export const MAX_STARTING_STACK = Math.floor(Number.MAX_SAFE_INTEGER / 6);
export const MAX_CHIP_SUPPLY = MAX_STARTING_STACK * 6;

export interface PlayerSubmission {
  player: Seat;
  startingStack: number;
  cards: [Card, Card];
}

export interface ActionSubmission {
  player: Seat;
  actionType: ActionType;
  amountTo: number | null;
  street: Street;
  sequence: number;
}

export interface HandSubmission {
  submissionId: string;
  dealer: Seat;
  communityCards: Card[];
  players: PlayerSubmission[];
  actions: ActionSubmission[];
}

interface RecordMetadata {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedPlayer extends PlayerSubmission, RecordMetadata {
  handId: string;
  winLoss: number;
}

export interface SavedAction extends ActionSubmission, RecordMetadata {
  handId: string;
}

export interface SavedHand extends RecordMetadata {
  submissionId: string;
  dealer: Seat;
  communityCards: Card[];
  players: SavedPlayer[];
  actions: SavedAction[];
}

export interface LivePlayer {
  player: Seat;
  startingStack: number;
  currentStack: number;
  cards: Card[];
  folded: boolean;
  eliminated: boolean;
  streetCommitted: number;
  totalCommitted: number;
}

export type GameEventDetail =
  | { type: "hand_started"; dealer: Seat; smallBlind: Seat; bigBlind: Seat }
  | { type: "dealt"; player: Seat; cards: [Card, Card] }
  | { type: "blind"; player: Seat; blind: "SB" | "BB"; amount: number }
  | {
      type: "action";
      player: Seat;
      actionType: ActionType;
      amount: number;
      amountTo: number | null;
    }
  | { type: "street"; street: Street; cards: Card[] }
  | { type: "uncalled_return"; player: Seat; amount: number }
  | { type: "completed"; reason: "folds" | "showdown"; pot: number }
  | {
      type: "settled";
      handId: string;
      results: { player: Seat; winLoss: number; endingStack: number }[];
    }
  | { type: "game_over"; winner: Seat };

export type GameEvent = GameEventDetail & { handNumber: number };

export interface GameState {
  status: "playing" | "awaiting_settlement" | "hand_complete" | "game_over";
  handNumber: number;
  submissionId: string;
  players: LivePlayer[];
  dealer: Seat;
  smallBlind: Seat;
  bigBlind: Seat;
  actor: Seat | null;
  street: Street;
  communityCards: Card[];
  deck: Card[];
  burnedCards: Card[];
  pot: number;
  actions: ActionSubmission[];
  events: GameEvent[];
  /** Players still owed a decision on this street, in action order. */
  pendingActors: Seat[];
  /** Minimum full raise size, starting at one big blind on each street. */
  lastFullRaise: number;
  /** Last wager each player answered; null means they have not acted. */
  actedAtBet: (number | null)[];
}

export interface HandOptions {
  deck: readonly Card[];
  submissionId: string;
  handNumber?: number;
}

export type PlayerAction =
  | { type: "Bet" | "Raise"; amountTo: number }
  | { type: "Fold" | "Check" | "Call" | "Allin"; amountTo?: never };

export interface AmountRange {
  min: number;
  max: number;
}

export interface LegalActions {
  fold: boolean;
  check: boolean;
  call: number | null;
  bet: AmountRange | null;
  raise: AmountRange | null;
  /** Total commitment on this street, including chips already committed. */
  allin: number | null;
}
