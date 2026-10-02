import type { ActionSubmission, HandSubmission, Street } from "./types";

function actionToken(action: ActionSubmission): string {
  switch (action.actionType) {
    case "Fold":
      return "f";
    case "Check":
      return "x";
    case "Call":
      return "c";
    case "Bet":
      return `b${action.amountTo}`;
    case "Raise":
      return `r${action.amountTo}`;
    case "Allin":
      return "allin";
  }
}

export function compactHistory(
  hand: Pick<HandSubmission, "actions" | "communityCards">,
): string {
  const actions = [...hand.actions].sort((a, b) => a.sequence - b.sequence);
  const streets: { street: Street; start: number; end: number }[] = [
    { street: "Preflop", start: 0, end: 0 },
    { street: "Flop", start: 0, end: 3 },
    { street: "Turn", start: 3, end: 4 },
    { street: "River", start: 4, end: 5 },
  ];
  return streets
    .flatMap(({ street, start, end }) => {
      if (hand.communityCards.length < end) return [];
      const cards = hand.communityCards.slice(start, end).join("");
      return [
        ...(cards ? [cards] : []),
        ...actions
          .filter((action) => action.street === street)
          .map(actionToken),
      ];
    })
    .join(":");
}
