import { validateDeck } from "./cards";
import { getPositions, seatsAfter } from "./positions";
import {
  BIG_BLIND,
  MAX_CHIP_SUPPLY,
  MAX_STARTING_STACK,
  SEATS,
  SMALL_BLIND,
  type AmountRange,
  type Card,
  type GameEventDetail,
  type GameState,
  type HandOptions,
  type HandSubmission,
  type LegalActions,
  type LivePlayer,
  type PlayerAction,
  type SavedHand,
  type Seat,
  type Street,
} from "./types";

const STREETS: Street[] = ["Preflop", "Flop", "Turn", "River"];

export function validateStartingStack(stack: number): void {
  if (
    !Number.isSafeInteger(stack) ||
    stack < BIG_BLIND ||
    stack > MAX_STARTING_STACK
  ) {
    throw new Error(
      `Starting stack must be a whole number from 40 to ${MAX_STARTING_STACK}.`,
    );
  }
}

export function createGame(
  startingStack: number,
  options: HandOptions,
): GameState {
  validateStartingStack(startingStack);
  return createHand(
    SEATS.map(() => startingStack),
    0,
    options,
  );
}

/** Creates a hand from six permanent seats, including any eliminated seats. */
export function createHand(
  stacks: readonly number[],
  dealer: Seat,
  options: HandOptions,
): GameState {
  if (
    stacks.length !== SEATS.length ||
    stacks.some((stack) => !Number.isSafeInteger(stack) || stack < 0) ||
    stacks.reduce((sum, stack) => sum + stack, 0) > MAX_CHIP_SUPPLY
  ) {
    throw new Error(
      "Player stacks must be nonnegative safe integers within the chip supply limit.",
    );
  }
  validateDeck(options.deck);
  const activeSeats = SEATS.filter((seat) => stacks[seat] > 0);
  const positions = getPositions(dealer, activeSeats);
  const game: GameState = {
    status: "playing",
    handNumber: options.handNumber ?? 1,
    submissionId: options.submissionId,
    players: SEATS.map((player) => ({
      player,
      startingStack: stacks[player],
      currentStack: stacks[player],
      cards: [],
      folded: false,
      eliminated: stacks[player] === 0,
      streetCommitted: 0,
      totalCommitted: 0,
    })),
    ...positions,
    actor: null,
    street: "Preflop",
    communityCards: [],
    deck: [...options.deck],
    burnedCards: [],
    pot: 0,
    actions: [],
    events: [],
    pendingActors: [],
    lastFullRaise: BIG_BLIND,
    actedAtBet: SEATS.map(() => null),
  };
  addEvent(game, { type: "hand_started", ...positions });
  const dealOrder = seatsAfter(dealer, activeSeats);
  for (let round = 0; round < 2; round += 1) {
    for (const seat of dealOrder) game.players[seat].cards.push(drawCard(game));
  }
  for (const seat of dealOrder) {
    addEvent(game, {
      type: "dealt",
      player: seat,
      cards: [...game.players[seat].cards] as [Card, Card],
    });
  }
  for (const [seat, blind, requested] of [
    [game.smallBlind, "SB", SMALL_BLIND],
    [game.bigBlind, "BB", BIG_BLIND],
  ] as const) {
    const amount = Math.min(requested, game.players[seat].currentStack);
    commitChips(game, game.players[seat], amount);
    addEvent(game, { type: "blind", player: seat, blind, amount });
  }

  // PokerKit starts after the largest actual posted blind, including short blinds.
  const largestBlind = dealOrder.reduce((largest, seat) =>
    game.players[seat].streetCommitted >= game.players[largest].streetCommitted
      ? seat
      : largest,
  );
  game.pendingActors = seatsAfter(largestBlind, decisionSeats(game));
  addEvent(game, { type: "street", street: "Preflop", cards: [] });
  advance(game);
  return game;
}

function addEvent(game: GameState, event: GameEventDetail): void {
  game.events.push({ ...event, handNumber: game.handNumber });
}

function drawCard(game: GameState): Card {
  const card = game.deck.shift();
  if (!card) throw new Error("The deck ran out of cards.");
  return card;
}

function livePlayers(game: GameState): LivePlayer[] {
  return game.players.filter((player) => !player.eliminated && !player.folded);
}

function currentBet(game: GameState): number {
  return Math.max(...game.players.map((player) => player.streetCommitted));
}

function decisionSeats(game: GameState): Seat[] {
  const live = livePlayers(game);
  const stacks = live
    .map((player) => player.currentStack + player.streetCommitted)
    .sort((a, b) => b - a);
  const secondStack = stacks[1];
  return live
    .filter(
      (player) =>
        player.currentStack > 0 && secondStack > player.streetCommitted,
    )
    .map((player) => player.player);
}

function commitChips(
  game: GameState,
  player: LivePlayer,
  amount: number,
): void {
  player.currentStack -= amount;
  player.streetCommitted += amount;
  player.totalCommitted += amount;
  game.pot += amount;
}

function copyGame(game: GameState): GameState {
  return {
    ...game,
    players: game.players.map((player) => ({
      ...player,
      cards: [...player.cards],
    })),
    communityCards: [...game.communityCards],
    deck: [...game.deck],
    burnedCards: [...game.burnedCards],
    actions: [...game.actions],
    events: [...game.events],
    pendingActors: [...game.pendingActors],
    actedAtBet: [...game.actedAtBet],
  };
}

export function legalActions(game: GameState): LegalActions {
  const legal: LegalActions = {
    fold: false,
    check: false,
    call: null,
    bet: null,
    raise: null,
    allin: null,
  };
  if (game.status !== "playing" || game.actor === null) return legal;
  const player = game.players[game.actor];
  const bet = currentBet(game);
  const toCall = Math.min(player.currentStack, bet - player.streetCommitted);
  legal.fold = toCall > 0;
  legal.check = toCall === 0;
  legal.call = toCall > 0 ? toCall : null;

  const maximum = player.currentStack + player.streetCommitted;
  // Reopening belongs to each player. Someone who called a short raise
  // midway through several all-ins may still face less than a full raise.
  const lastActedBet = game.actedAtBet[player.player];
  const reopened =
    lastActedBet === null || bet - lastActedBet >= game.lastFullRaise;
  const hasOpponent = livePlayers(game).some(
    (other) =>
      other.player !== player.player &&
      other.currentStack + other.streetCommitted > bet,
  );
  if (player.currentStack > toCall && reopened && hasOpponent) {
    const range = {
      min: Math.min(maximum, bet + Math.max(BIG_BLIND, game.lastFullRaise)),
      max: maximum,
    };
    if (bet === 0) legal.bet = range;
    else legal.raise = range;
    legal.allin = maximum;
  } else if (toCall > 0 && toCall === player.currentStack) {
    legal.allin = maximum;
  }
  return legal;
}

/** A disabled step never clamps to a smaller-than-40 movement. */
export function stepAmount(
  value: number,
  direction: -1 | 1,
  range: AmountRange,
): number {
  const next = value + direction * BIG_BLIND;
  return next >= range.min && next <= range.max ? next : value;
}

export function applyAction(game: GameState, action: PlayerAction): GameState {
  if (game.status !== "playing" || game.actor === null) {
    throw new Error("This hand is not waiting for a player action.");
  }
  const legal = legalActions(game);
  let amountTo: number | null = null;
  switch (action.type) {
    case "Fold":
      if (!legal.fold)
        throw new Error("Fold is unavailable when checking is possible.");
      break;
    case "Check":
      if (!legal.check)
        throw new Error("Check is unavailable while facing a wager.");
      break;
    case "Call":
      if (legal.call === null) throw new Error("There is no wager to call.");
      break;
    case "Bet":
    case "Raise": {
      const range = action.type === "Bet" ? legal.bet : legal.raise;
      if (
        !range ||
        !Number.isSafeInteger(action.amountTo) ||
        action.amountTo < range.min ||
        action.amountTo > range.max
      ) {
        throw new Error(`${action.type} amount is outside the legal range.`);
      }
      amountTo = action.amountTo;
      break;
    }
    case "Allin":
      if (legal.allin === null)
        throw new Error("All-in is unavailable in this betting state.");
      amountTo = legal.allin;
      break;
    default:
      throw new Error("Unknown poker action.");
  }

  const next = copyGame(game);
  const player = next.players[game.actor];
  const previousBet = currentBet(next);
  const amount =
    amountTo !== null
      ? amountTo - player.streetCommitted
      : action.type === "Call"
        ? legal.call!
        : 0;
  next.pendingActors = next.pendingActors.filter(
    (seat) => seat !== player.player,
  );
  if (action.type === "Fold") player.folded = true;
  else commitChips(next, player, amount);
  next.actedAtBet[player.player] = player.streetCommitted;

  if (amountTo !== null && amountTo > previousBet) {
    const increase = amountTo - previousBet;
    next.lastFullRaise = Math.max(next.lastFullRaise, increase);
    next.pendingActors = seatsAfter(
      player.player,
      livePlayers(next)
        .filter((other) => other.currentStack > 0)
        .map((other) => other.player),
    ).filter((seat) => seat !== player.player);
  }

  const submittedAmount =
    action.type === "Bet" || action.type === "Raise" ? amountTo : null;
  next.actions.push({
    player: player.player,
    actionType: action.type,
    amountTo: submittedAmount,
    street: next.street,
    sequence: next.actions.length,
  });
  addEvent(next, {
    type: "action",
    player: player.player,
    actionType: action.type,
    amount,
    amountTo: submittedAmount,
  });
  advance(next);
  return next;
}

function collectStreet(game: GameState): void {
  const byCommitment = [...game.players].sort(
    (a, b) => b.streetCommitted - a.streetCommitted,
  );
  const unmatched =
    byCommitment[0].streetCommitted - byCommitment[1].streetCommitted;
  if (unmatched > 0) {
    const player = byCommitment[0];
    player.currentStack += unmatched;
    player.totalCommitted -= unmatched;
    game.pot -= unmatched;
    addEvent(game, {
      type: "uncalled_return",
      player: player.player,
      amount: unmatched,
    });
  }
  for (const player of game.players) player.streetCommitted = 0;
}

function complete(game: GameState, reason: "folds" | "showdown"): void {
  collectStreet(game);
  game.status = "awaiting_settlement";
  game.actor = null;
  game.pendingActors = [];
  addEvent(game, { type: "completed", reason, pot: game.pot });
}

/** Runs forced transitions until the next real decision or terminal state. */
function advance(game: GameState): void {
  while (game.status === "playing") {
    const live = livePlayers(game);
    if (live.length === 1) {
      complete(game, "folds");
      return;
    }
    const funded = live.filter((player) => player.currentStack > 0);
    game.pendingActors = game.pendingActors.filter(
      (seat) =>
        !game.players[seat].folded && game.players[seat].currentStack > 0,
    );
    // One funded player must still answer an outstanding wager before runout.
    if (
      funded.length <= 1 &&
      (!funded.length || funded[0].streetCommitted >= currentBet(game))
    ) {
      // PokerKit still expects an unspent blind option after opponents fold
      // or call all-in. Record that forced check before automatically running
      // out the board; it offers no choice because no opponent can bet.
      if (
        funded.length === 1 &&
        game.pendingActors.includes(funded[0].player)
      ) {
        const player = funded[0].player;
        game.actions.push({
          player,
          actionType: "Check",
          amountTo: null,
          street: game.street,
          sequence: game.actions.length,
        });
        addEvent(game, {
          type: "action",
          player,
          actionType: "Check",
          amount: 0,
          amountTo: null,
        });
      }
      game.pendingActors = [];
    }
    if (game.pendingActors.length > 0) {
      game.actor = game.pendingActors[0];
      return;
    }
    if (game.street === "River") {
      complete(game, "showdown");
      return;
    }
    collectStreet(game);
    game.street = STREETS[STREETS.indexOf(game.street) + 1];
    game.burnedCards.push(drawCard(game));
    const cards = Array.from({ length: game.street === "Flop" ? 3 : 1 }, () =>
      drawCard(game),
    );
    game.communityCards.push(...cards);
    addEvent(game, { type: "street", street: game.street, cards });
    game.lastFullRaise = BIG_BLIND;
    game.actedAtBet = SEATS.map(() => null);
    game.pendingActors = seatsAfter(game.dealer, decisionSeats(game));
  }
}

export function toSubmission(game: GameState): HandSubmission {
  if (game.status !== "awaiting_settlement") {
    throw new Error("Only a completed hand can be submitted.");
  }
  return {
    submissionId: game.submissionId,
    dealer: game.dealer,
    communityCards: [...game.communityCards],
    players: game.players
      .filter((player) => !player.eliminated)
      .map((player) => ({
        player: player.player,
        startingStack: player.startingStack,
        cards: [...player.cards] as [Card, Card],
      })),
    actions: game.actions.map((action) => ({ ...action })),
  };
}

function settlementStacks(game: GameState, saved: SavedHand): number[] {
  const expected = toSubmission(game);
  const submitted: HandSubmission = {
    submissionId: saved.submissionId,
    dealer: saved.dealer,
    communityCards: saved.communityCards,
    players: [...saved.players]
      .sort((a, b) => a.player - b.player)
      .map((player) => ({
        player: player.player,
        startingStack: player.startingStack,
        cards: player.cards,
      })),
    actions: [...saved.actions]
      .sort((a, b) => a.sequence - b.sequence)
      .map((action) => ({
        player: action.player,
        actionType: action.actionType,
        amountTo: action.amountTo,
        street: action.street,
        sequence: action.sequence,
      })),
  };
  if (JSON.stringify(expected) !== JSON.stringify(submitted)) {
    throw new Error(
      "The saved hand does not match the completed hand being settled.",
    );
  }
  const stacks = SEATS.map(() => 0);
  let totalWinLoss = 0;
  for (const player of saved.players) {
    const endingStack = player.startingStack + player.winLoss;
    if (
      !Number.isSafeInteger(player.winLoss) ||
      !Number.isSafeInteger(endingStack) ||
      endingStack < 0
    ) {
      throw new Error("The settlement contains an invalid player payoff.");
    }
    stacks[player.player] = endingStack;
    totalWinLoss += player.winLoss;
  }
  if (totalWinLoss !== 0)
    throw new Error("The settlement did not conserve chips.");
  return stacks;
}

export function applySettlement(
  game: GameState,
  saved: SavedHand,
  options: HandOptions,
): GameState {
  const stacks = settlementStacks(game, saved);
  const settled = copyGame(game);
  addEvent(settled, {
    type: "settled",
    handId: saved.id,
    results: saved.players.map((player) => ({
      player: player.player,
      winLoss: player.winLoss,
      endingStack: stacks[player.player],
    })),
  });
  const active = SEATS.filter((seat) => stacks[seat] > 0);
  if (active.length === 1) {
    settled.status = "game_over";
    settled.pot = 0;
    for (const player of settled.players) {
      player.currentStack = stacks[player.player];
      player.eliminated = stacks[player.player] === 0;
    }
    addEvent(settled, { type: "game_over", winner: active[0] });
    return settled;
  }
  const dealer = seatsAfter(game.dealer, active)[0];
  const next = createHand(stacks, dealer, {
    ...options,
    handNumber: game.handNumber + 1,
  });
  next.events = [...settled.events, ...next.events];
  return next;
}
