import { describe, expect, it } from "vitest";

import {
  applyAction,
  applySettlement,
  compactHistory,
  createDeck,
  createGame,
  createHand,
  legalActions,
  MAX_STARTING_STACK,
  shuffleDeck,
  startNextHand,
  stepAmount,
  toSubmission,
  type Card,
  type GameState,
  type PlayerAction,
  type SavedHand,
  type Seat,
} from "../domain";

const FIRST_SUBMISSION = "5cd6e5de-c702-4d21-b33d-5e53aa7cb75b";
const NEXT_SUBMISSION = "825e5b92-3ecb-4a0e-b90e-289ef70f0057";
const SAVED_HAND = "6d81b154-73fd-4df0-92b7-05bb1c4ad951";

// A known deck makes both dealing order and burn/board transitions observable.
const ORDERED_DECK = (
  "2c 2d 2h 2s 3c 3d 3h 3s 4c 4d 4h 4s 5c 5d 5h 5s " +
  "6c 6d 6h 6s 7c 7d 7h 7s 8c 8d 8h 8s 9c 9d 9h 9s " +
  "Tc Td Th Ts Jc Jd Jh Js Qc Qd Qh Qs Kc Kd Kh Ks Ac Ad Ah As"
).split(" ") as Card[];

function deckStartingWith(cards: string): Card[] {
  const first = cards.split(" ") as Card[];
  return [...first, ...ORDERED_DECK.filter((card) => !first.includes(card))];
}

function options(deck: Card[] = ORDERED_DECK) {
  return { deck, submissionId: FIRST_SUBMISSION };
}

function act(game: GameState, ...actions: PlayerAction[]): GameState {
  return actions.reduce(applyAction, game);
}

function expectActor(game: GameState, actor: Seat, street = "Preflop") {
  expect(game.status).toBe("playing");
  expect(game.actor).toBe(actor);
  expect(game.street).toBe(street);
}

function expectCardConservation(game: GameState) {
  const cards = [
    ...game.players.flatMap((player) => player.cards),
    ...game.communityCards,
    ...game.burnedCards,
    ...game.deck,
  ];
  expect(cards).toHaveLength(52);
  expect(new Set(cards).size).toBe(52);
  expect([...cards].sort()).toEqual([...ORDERED_DECK].sort());
}

// Settlement is an external input to the domain. These explicit payoffs come
// from the backend's PokerKit contract; the frontend must not invent winners.
function settlement(
  game: GameState,
  payoffs: Partial<Record<Seat, number>>,
): SavedHand {
  const payload = toSubmission(game);
  const timestamp = "2026-10-02T12:00:00Z";
  const metadata = {
    id: SAVED_HAND,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    ...payload,
    ...metadata,
    players: payload.players.map((player) => ({
      ...player,
      ...metadata,
      id: `00000000-0000-4000-a000-${String(player.player).padStart(12, "0")}`,
      handId: SAVED_HAND,
      winLoss: payoffs[player.player]!,
    })),
    actions: payload.actions.map((action) => ({
      ...action,
      ...metadata,
      id: `00000000-0000-4000-b000-${String(action.sequence).padStart(12, "0")}`,
      handId: SAVED_HAND,
    })),
  };
}

describe("live poker hands", () => {
  it("starts six permanent seats with equal stacks, blinds and deterministic cards", () => {
    const game = createGame(1000, options());

    expect(game.dealer).toBe(0);
    expect(game.smallBlind).toBe(1);
    expect(game.bigBlind).toBe(2);
    expectActor(game, 3);
    expect(game.players.map((player) => player.player)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(game.players.map((player) => player.startingStack)).toEqual([
      1000, 1000, 1000, 1000, 1000, 1000,
    ]);
    expect(game.players.map((player) => player.currentStack)).toEqual([
      1000, 980, 960, 1000, 1000, 1000,
    ]);
    expect(game.pot).toBe(60);
    expect(game.players[1].cards).toEqual(["2c", "3h"]);
    expect(game.players[0].cards).toEqual(["3d", "4s"]);
    expect(createGame(1000, options())).toEqual(game);
    expectCardConservation(game);
  });

  it("finishes a checked-down hand only after every actor responds on every street", () => {
    let game = createGame(1000, options());
    for (const seat of [3, 4, 5, 0, 1] as Seat[]) {
      expectActor(game, seat);
      game = applyAction(game, { type: "Call" });
    }

    // Matching the blinds does not remove the big blind's option to act.
    expectActor(game, 2);
    expect(legalActions(game).check).toBe(true);
    game = applyAction(game, { type: "Check" });
    expect(game.communityCards).toEqual(["5d", "5h", "5s"]);

    for (const street of ["Flop", "Turn", "River"]) {
      for (const seat of [1, 2, 3, 4, 5, 0] as Seat[]) {
        expectActor(game, seat, street);
        game = applyAction(game, { type: "Check" });
      }
    }

    expect(game.status).toBe("awaiting_settlement");
    expect(game.actor).toBeNull();
    expect(game.communityCards).toEqual(["5d", "5h", "5s", "6d", "6s"]);
    expect(game.burnedCards).toEqual(["5c", "6c", "6h"]);
    expect(game.players.every((player) => player.currentStack === 960)).toBe(
      true,
    );
    expect(game.actions).toHaveLength(24);
    expect(game.pot).toBe(240);
    expectCardConservation(game);
    const payload = toSubmission(game);
    expect(payload.players[0]).toMatchObject({
      player: 0,
      startingStack: 1000,
    });
    expect(payload).not.toHaveProperty("startingStack");
    expect(payload.players[0]).not.toHaveProperty("winLoss");
    expect(payload.actions.map((action) => action.sequence)).toEqual(
      Array.from({ length: 24 }, (_, sequence) => sequence),
    );
  });

  it("reopens action after full raises and uses total street commitment", () => {
    let game = createHand([500, 0, 500, 0, 0, 500], 5, options());
    game = applyAction(game, { type: "Raise", amountTo: 100 });
    expectActor(game, 0);
    expect(legalActions(game).raise).toEqual({ min: 160, max: 500 });
    game = act(game, { type: "Raise", amountTo: 160 }, { type: "Fold" });
    expectActor(game, 5);
    expect(legalActions(game).raise).toEqual({ min: 220, max: 500 });
    game = act(game, { type: "Raise", amountTo: 220 }, { type: "Call" });

    expectActor(game, 0, "Flop");
    expect(game.players[0].currentStack).toBe(280);
    expect(game.players[5].currentStack).toBe(280);
    expect(game.pot).toBe(480);
    expect(legalActions(game).bet).toEqual({ min: 40, max: 280 });
    game = act(game, { type: "Check" }, { type: "Bet", amountTo: 40 });
    expectActor(game, 0, "Flop");
    expect(legalActions(game).call).toBe(40);
    game = applyAction(game, { type: "Fold" });

    expect(game.status).toBe("awaiting_settlement");
    expect(game.communityCards).toHaveLength(3);
    expect(game.actions.map((action) => action.amountTo)).toEqual([
      100,
      160,
      null,
      220,
      null,
      null,
      40,
      null,
    ]);
    expect(compactHistory(toSubmission(game))).toBe(
      "r100:r160:f:r220:c:3s4c4d:x:b40:f",
    );
  });

  it("keeps calls pending after a short all-in, then runs out when betting stops", () => {
    let game = createHand([500, 0, 130, 0, 0, 500], 5, options());
    game = act(
      game,
      { type: "Raise", amountTo: 100 },
      { type: "Call" },
      { type: "Allin" },
    );

    expectActor(game, 5);
    expect(legalActions(game).call).toBe(30);
    expect(legalActions(game).raise).toBeNull();
    expect(legalActions(game).allin).toBeNull();
    game = applyAction(game, { type: "Call" });
    expectActor(game, 0);
    game = applyAction(game, { type: "Call" });
    expectActor(game, 0, "Flop");
    expect(game.players[2].currentStack).toBe(0);
    game = act(game, { type: "Bet", amountTo: 40 }, { type: "Fold" });

    expect(game.status).toBe("awaiting_settlement");
    expect(game.communityCards).toHaveLength(5);
    expect(game.burnedCards).toHaveLength(3);
    expect(
      game.actions.filter((action) => action.street !== "Preflop"),
    ).toHaveLength(2);
    expectCardConservation(game);
  });

  it("keeps a player's raise reopened after successive short all-ins exceed a full raise", () => {
    let game = createHand([1040, 1040, 165, 240, 265, 1040], 0, options());
    for (let index = 0; index < 5; index++) {
      game = applyAction(game, { type: "Call" });
    }
    game = applyAction(game, { type: "Check" });
    expectActor(game, 1, "Flop");
    game = act(
      game,
      { type: "Bet", amountTo: 100 },
      { type: "Allin" }, // Seat 2: 125 total on the flop.
      { type: "Allin" }, // Seat 3: 200 total on the flop.
      { type: "Allin" }, // Seat 4: 225 total on the flop.
      { type: "Call" },
      { type: "Fold" },
    );

    // Seat 1 now faces 125 more than its earlier bet of 100. That exceeds
    // the full 100-chip raise, even though no individual all-in did so.
    expectActor(game, 1, "Flop");
    expect(legalActions(game).call).toBe(125);
    expect(legalActions(game).raise).toEqual({ min: 325, max: 1000 });
    game = applyAction(game, { type: "Raise", amountTo: 325 });
    expectActor(game, 5, "Flop");
    expect(legalActions(game).call).toBe(100);
    game = applyAction(game, { type: "Call" });
    for (const street of ["Turn", "River"]) {
      expectActor(game, 1, street);
      game = applyAction(game, { type: "Check" });
      expectActor(game, 5, street);
      game = applyAction(game, { type: "Check" });
    }
    expect(game.status).toBe("awaiting_settlement");
    expect(game.players[1].currentStack).toBe(675);
    expect(game.players[5].currentStack).toBe(675);
    expect(game.pot).toBe(1440);
    expectCardConservation(game);
  });

  it("caps an all-in call at the remaining stack and never asks an all-in player to act", () => {
    let game = createHand([100, 0, 200, 0, 0, 300], 5, options());
    game = applyAction(game, { type: "Allin" });
    expectActor(game, 0);
    expect(legalActions(game).call).toBe(80);
    expect(legalActions(game).raise).toBeNull();
    game = applyAction(game, { type: "Call" });
    expect(game.players[0].currentStack).toBe(0);
    expect(game.players[0].totalCommitted).toBe(100);
    expectActor(game, 2);
    expect(legalActions(game).call).toBe(160);
    game = applyAction(game, { type: "Allin" });

    expect(game.status).toBe("awaiting_settlement");
    expect(game.communityCards).toHaveLength(5);
    expect(game.players.every((player) => player.currentStack >= 0)).toBe(true);
    expect(game.actions).toHaveLength(3);
    expectCardConservation(game);
  });

  it("uses the dealer as small blind heads-up, then reverses action order after the flop", () => {
    let game = createHand([0, 100, 0, 0, 200, 0], 1, options());
    expect(game.smallBlind).toBe(1);
    expect(game.bigBlind).toBe(4);
    expectActor(game, 1);
    game = applyAction(game, { type: "Call" });
    expectActor(game, 4);
    game = applyAction(game, { type: "Check" });
    for (const street of ["Flop", "Turn", "River"]) {
      expectActor(game, 4, street);
      game = applyAction(game, { type: "Check" });
      expectActor(game, 1, street);
      game = applyAction(game, { type: "Check" });
    }
    expect(game.status).toBe("awaiting_settlement");
    expect(toSubmission(game).players.map((player) => player.player)).toEqual([
      1, 4,
    ]);
  });

  it("automatically runs out short blinds when nobody has a remaining decision", () => {
    const game = createHand([0, 10, 0, 0, 15, 0], 1, options());
    expect(game.status).toBe("awaiting_settlement");
    expect(game.actor).toBeNull();
    expect(game.actions).toEqual([]);
    expect(game.communityCards).toHaveLength(5);
    expect(game.players.every((player) => player.currentStack >= 0)).toBe(true);
    expectCardConservation(game);

    // PokerKit still requires the big blind's check in this position. Record
    // that forced action so the automatic runout is also replayable.
    let shortBlind = createHand([0, 0, 0, 300, 1, 100], 3, options());
    shortBlind = applyAction(shortBlind, { type: "Fold" });
    expect(shortBlind.status).toBe("awaiting_settlement");
    expect(
      shortBlind.actions.map(({ player, actionType }) => ({
        player,
        actionType,
      })),
    ).toEqual([
      { player: 3, actionType: "Fold" },
      { player: 5, actionType: "Check" },
    ]);
    expect(shortBlind.communityCards).toHaveLength(5);
    expectCardConservation(shortBlind);
  });

  it("retains a funded player's outstanding decision against an all-in blind", () => {
    let game = createHand([0, 100, 0, 0, 30, 0], 1, options());
    expectActor(game, 1);
    expect(legalActions(game).call).toBe(10);
    expect(legalActions(game).raise).toBeNull();
    expect(legalActions(game).allin).toBeNull();
    game = applyAction(game, { type: "Call" });
    expect(game.status).toBe("awaiting_settlement");
    expect(game.communityCards).toHaveLength(5);
    expect(game.players[1].currentStack).toBe(70);
  });

  it("changes a Bet/Raise selection by exactly 40 and leaves out-of-range steps disabled", () => {
    const game = createGame(205, options());
    const range = legalActions(game).raise!;
    expect(range).toEqual({ min: 80, max: 205 });
    let amount = range.min;
    expect(stepAmount(amount, -1, range)).toBe(80);
    for (const expected of [120, 160, 200]) {
      const previous = amount;
      amount = stepAmount(amount, 1, range);
      expect(amount).toBe(expected);
      expect(amount - previous).toBe(40);
    }
    expect(stepAmount(amount, 1, range)).toBe(200);
    expect(stepAmount(amount, -1, range)).toBe(160);
    expect(legalActions(game).allin).toBe(205);
    const next = applyAction(game, { type: "Allin" });
    expect(next.players[3].currentStack).toBe(0);
    expect(next.actions[0].amountTo).toBeNull();
  });

  it("preserves all 52 unique cards through a shuffle", () => {
    const deck = createDeck();
    expect([...deck].sort()).toEqual([...ORDERED_DECK].sort());
    const shuffled = shuffleDeck();
    expect([...shuffled].sort()).toEqual([...ORDERED_DECK].sort());
    expect(new Set(shuffled).size).toBe(52);
  });

  it("supports the safe integer supply ceiling without imposing a smaller product cap", () => {
    const game = createGame(MAX_STARTING_STACK, options());
    const total = game.players.reduce(
      (sum, player) => sum + player.startingStack,
      0,
    );
    expect(Number.isSafeInteger(total)).toBe(true);
    const raised = applyAction(game, { type: "Allin" });
    expect(raised.players[3].currentStack).toBe(0);
    expect(raised.players[3].totalCommitted).toBe(MAX_STARTING_STACK);
    expect(Number.isSafeInteger(raised.pot)).toBe(true);
  });
});

describe("settlement and the next hand", () => {
  it("keeps the saved hand visible and carries balances only when the next hand starts", () => {
    let game = createGame(1000, options());
    for (const seat of [3, 4, 5, 0, 1] as Seat[]) {
      expectActor(game, seat);
      game = applyAction(game, { type: "Fold" });
    }
    expect(game.status).toBe("awaiting_settlement");
    expect(game.dealer).toBe(0);
    expect(game.handNumber).toBe(1);
    const payload = toSubmission(game);
    expect(toSubmission(game)).toEqual(payload);
    expect(payload.submissionId).toBe(FIRST_SUBMISSION);
    expect(payload.communityCards).toEqual([]);

    const settled = applySettlement(
      game,
      settlement(game, { 0: 0, 1: -20, 2: 20, 3: 0, 4: 0, 5: 0 }),
    );
    expect(settled.status).toBe("hand_complete");
    expect(settled.actor).toBeNull();
    expect(settled.pot).toBe(0);
    expect(settled.dealer).toBe(0);
    expect(settled.handNumber).toBe(1);
    expect(settled.submissionId).toBe(FIRST_SUBMISSION);
    expect(settled.players.map((player) => player.currentStack)).toEqual([
      1000, 980, 1020, 1000, 1000, 1000,
    ]);
    expect(settled.players.map((player) => player.cards)).toEqual(
      game.players.map((player) => player.cards),
    );
    expect(settled.communityCards).toEqual(game.communityCards);
    expect(settled.deck).toEqual(game.deck);
    expect(settled.actions).toEqual(game.actions);
    expect(settled.events.at(-1)).toMatchObject({ type: "settled" });
    expectCardConservation(settled);

    const next = startNextHand(settled, {
      deck: ORDERED_DECK,
      submissionId: NEXT_SUBMISSION,
    });
    expect(next.players.map((player) => player.startingStack)).toEqual([
      1000, 980, 1020, 1000, 1000, 1000,
    ]);
    expect(next.players.map((player) => player.currentStack)).toEqual([
      1000, 980, 1000, 960, 1000, 1000,
    ]);
    expect(next.dealer).toBe(1);
    expect(next.smallBlind).toBe(2);
    expect(next.bigBlind).toBe(3);
    expectActor(next, 4);
    expect(next.handNumber).toBe(2);
    expect(next.submissionId).toBe(NEXT_SUBMISSION);
    expect(
      next.events.filter((event) => event.type === "hand_started"),
    ).toHaveLength(2);
    expect(game.submissionId).toBe(FIRST_SUBMISSION);
    expect(game.status).toBe("awaiting_settlement");
    expect(settled.status).toBe("hand_complete");
  });

  it("skips eliminated seats, transitions to heads-up, and ends the game at one survivor", () => {
    // Seat 2's AA beats seat 5's KK and seat 0's QQ. The 50-chip excess
    // from seat 5's shove is unmatched and returned by the backend.
    const firstDeck = deckStartingWith(
      "Qs As Ks Qh Ah Kh 4c 2c 3d 7h 5c 8s 6c 9c",
    );
    let game = createHand([40, 0, 100, 0, 0, 150], 5, options(firstDeck));
    game = act(game, { type: "Allin" }, { type: "Call" }, { type: "Call" });
    expect(game.status).toBe("awaiting_settlement");
    expect(game.players[0].cards).toEqual(["Qs", "Qh"]);
    expect(game.players[2].cards).toEqual(["As", "Ah"]);
    expect(game.players[5].cards).toEqual(["Ks", "Kh"]);
    expect(game.communityCards).toEqual(["2c", "3d", "7h", "8s", "9c"]);

    const headsUpDeck = deckStartingWith("Ks As Kh Ah 3c 2c 4d 7h 5c 8s 6c 9c");
    game = applySettlement(
      game,
      settlement(game, { 0: -40, 2: 140, 5: -100 }),
    );
    expect(game.status).toBe("hand_complete");
    expect(game.players.map((player) => player.currentStack)).toEqual([
      0, 0, 240, 0, 0, 50,
    ]);
    expect(game.dealer).toBe(5);
    expect(game.players[0]).toMatchObject({
      eliminated: true,
      cards: ["Qs", "Qh"],
      currentStack: 0,
    });
    expect(game.communityCards).toEqual(["2c", "3d", "7h", "8s", "9c"]);
    expect(game.pot).toBe(0);
    expectCardConservation(game);

    game = startNextHand(game, {
      deck: headsUpDeck,
      submissionId: NEXT_SUBMISSION,
    });
    expect(game.players.map((player) => player.startingStack)).toEqual([
      0, 0, 240, 0, 0, 50,
    ]);
    expect(game.players[0]).toMatchObject({
      eliminated: true,
      cards: [],
      currentStack: 0,
    });
    expect(game.dealer).toBe(2);
    expect(game.smallBlind).toBe(2);
    expect(game.bigBlind).toBe(5);
    expectActor(game, 2);
    game = applyAction(game, { type: "Allin" });
    expectActor(game, 5);
    expect(legalActions(game).call).toBe(10);
    game = applyAction(game, { type: "Call" });
    expect(toSubmission(game).players.map((player) => player.player)).toEqual([
      2, 5,
    ]);

    const finished = applySettlement(
      game,
      settlement(game, { 2: 50, 5: -50 }),
    );
    expect(finished.status).toBe("game_over");
    expect(finished.actor).toBeNull();
    expect(finished.players.map((player) => player.currentStack)).toEqual([
      0, 0, 290, 0, 0, 0,
    ]);
    expect(finished.events.at(-1)).toMatchObject({
      type: "game_over",
      winner: 2,
    });
    expect(() => startNextHand(finished, options())).toThrow();
  });

  it("includes board-only runout streets in compact history and keeps Allin amount-free", () => {
    let game = createHand(
      [100, 0, 200, 0, 0, 300],
      5,
      options(deckStartingWith("As Ks Qs Ah Kh Qh 4c 2c 3d 7h 5c 8s 6c 9c")),
    );
    game = act(game, { type: "Allin" }, { type: "Call" }, { type: "Allin" });
    const payload = toSubmission(game);
    expect(payload.actions.map((action) => action.amountTo)).toEqual([
      null,
      null,
      null,
    ]);
    expect(compactHistory(payload)).toBe("allin:c:allin:2c3d7h:8s:9c");
  });
});

// Failure coverage stays in four realistic groups: bad setup/deck, illegal
// actions/amounts, raising without reopening, and acting after completion.
describe("invalid operations", () => {
  it("rejects invalid setup values and duplicate cards instead of substituting defaults", () => {
    for (const startingStack of [0, 39, 40.5, NaN, MAX_STARTING_STACK + 1]) {
      expect(() => createGame(startingStack, options())).toThrow();
    }
    const duplicateDeck = [...ORDERED_DECK];
    duplicateDeck[1] = duplicateDeck[0];
    expect(() => createGame(1000, options(duplicateDeck))).toThrow();
  });

  it("rejects illegal labels and overbets without changing the original hand", () => {
    const game = createGame(1000, options());
    const before = structuredClone(game);
    for (const action of [
      { type: "Check" },
      { type: "Bet", amountTo: 80 },
      { type: "Raise", amountTo: 79 },
      { type: "Raise", amountTo: 1001 },
      { type: "Raise", amountTo: 100.5 },
    ] as PlayerAction[]) {
      expect(() => applyAction(game, action)).toThrow();
      expect(game).toEqual(before);
    }
    let headsUp = createHand([0, 100, 0, 0, 100, 0], 1, options());
    headsUp = applyAction(headsUp, { type: "Call" });
    expect(legalActions(headsUp).fold).toBe(false);
    expect(legalActions(headsUp).call).toBeNull();
    expect(() => applyAction(headsUp, { type: "Call" })).toThrow();
    expect(() => applyAction(headsUp, { type: "Fold" })).toThrow();
  });

  it("does not let Raise or Allin bypass a short raise that failed to reopen betting", () => {
    let game = createHand([500, 0, 130, 0, 0, 500], 5, options());
    game = act(
      game,
      { type: "Raise", amountTo: 100 },
      { type: "Call" },
      { type: "Allin" },
    );
    expectActor(game, 5);
    expect(() => applyAction(game, { type: "Raise", amountTo: 200 })).toThrow();
    expect(() => applyAction(game, { type: "Allin" })).toThrow();
    expect(game.players[5].currentStack).toBe(400);

    // Calling the blind counts as acting. The big blind's extra 10 chips is
    // not a full raise and cannot give the limpers another right to raise.
    let limped = createHand([500, 500, 50, 500, 500, 500], 0, options());
    for (let index = 0; index < 5; index++) {
      limped = applyAction(limped, { type: "Call" });
    }
    limped = applyAction(limped, { type: "Allin" });
    expectActor(limped, 3);
    expect(legalActions(limped).call).toBe(10);
    expect(legalActions(limped).raise).toBeNull();
    expect(legalActions(limped).allin).toBeNull();
    expect(() =>
      applyAction(limped, { type: "Raise", amountTo: 90 }),
    ).toThrow();

    // Two short raises can reopen action for an earlier raiser, while a
    // player who called between them has not yet faced a full raise.
    let cumulative = createHand([500, 160, 500, 0, 0, 130], 5, options());
    cumulative = act(
      cumulative,
      { type: "Raise", amountTo: 100 },
      { type: "Allin" },
      { type: "Call" },
      { type: "Allin" },
    );
    expectActor(cumulative, 2);
    expect(legalActions(cumulative).raise).toEqual({ min: 220, max: 500 });
    cumulative = applyAction(cumulative, { type: "Call" });
    expectActor(cumulative, 0);
    expect(legalActions(cumulative).call).toBe(30);
    expect(legalActions(cumulative).raise).toBeNull();
    expect(() => applyAction(cumulative, { type: "Allin" })).toThrow();
  });

  it("rejects actions after completion and premature or repeated hand transitions", () => {
    const initial = createGame(1000, options());
    let game = initial;
    expect(() => toSubmission(game)).toThrow();
    expect(() => startNextHand(game, options())).toThrow();
    for (let index = 0; index < 5; index++) {
      game = applyAction(game, { type: "Fold" });
    }
    expect(game.status).toBe("awaiting_settlement");
    expect(() => applyAction(game, { type: "Check" })).toThrow();
    expect(() => applyAction(game, { type: "Fold" })).toThrow();
    expect(() => startNextHand(game, options())).toThrow();

    const saved = settlement(game, { 0: 0, 1: -20, 2: 20, 3: 0, 4: 0, 5: 0 });
    expect(() => applySettlement(initial, saved)).toThrow();
    const settled = applySettlement(game, saved);
    expect(() => applyAction(settled, { type: "Check" })).toThrow();
    expect(() => applySettlement(settled, saved)).toThrow();
    expect(() => toSubmission(settled)).toThrow();

    const next = startNextHand(settled, {
      deck: ORDERED_DECK,
      submissionId: NEXT_SUBMISSION,
    });
    expect(() => startNextHand(next, options())).toThrow();
    expect(() => applySettlement(next, saved)).toThrow();
  });
});
