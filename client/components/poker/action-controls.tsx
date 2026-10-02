import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  legalActions,
  stepAmount,
  type AmountRange,
  type GameState,
  type PlayerAction,
} from "@/domain";
import { playerName, PLAYER_COLORS } from "@/lib/poker-display";
import { cn } from "@/lib/utils";

function WagerControl({
  type,
  range,
  onAction,
}: {
  type: "Bet" | "Raise";
  range: AmountRange | null;
  onAction: (action: PlayerAction) => void;
}) {
  const [amount, setAmount] = useState(range?.min ?? 0);
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border/80 bg-background/30 p-1.5">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Decrease ${type.toLowerCase()} by 40`}
        disabled={!range || amount - 40 < range.min}
        onClick={() => range && setAmount(stepAmount(amount, -1, range))}
        className="shrink-0"
      >
        <Minus />
      </Button>
      <Button
        className="h-auto min-h-8 min-w-0 flex-1 whitespace-normal break-all px-1 py-1.5 text-xs leading-snug tabular-nums disabled:bg-secondary disabled:text-muted-foreground"
        disabled={!range}
        onClick={() => onAction({ type, amountTo: amount })}
      >
        {range ? `${type} to ${amount.toLocaleString("en-US")}` : type}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Increase ${type.toLowerCase()} by 40`}
        disabled={!range || amount + 40 > range.max}
        onClick={() => range && setAmount(stepAmount(amount, 1, range))}
        className="shrink-0"
      >
        <Plus />
      </Button>
    </div>
  );
}

export function ActionControls({
  game,
  onAction,
}: {
  game: GameState | null;
  onAction: (action: PlayerAction) => void;
}) {
  const legal = game ? legalActions(game) : null;
  const actor = game?.actor != null ? game.players[game.actor] : null;
  const call = legal?.call;
  const actionKey = `${game?.submissionId}:${game?.actions.length}`;

  return (
    <Card className="gap-0 bg-card/95 py-4 shadow-sm shadow-emerald-950/5 backdrop-blur-sm">
      <CardContent className="space-y-3">
        <div className="flex min-h-5 flex-wrap items-center justify-between gap-2">
          <p
            className="flex items-center gap-2 text-sm font-medium"
            aria-live="polite"
          >
            {actor ? (
              <>
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2.5 rounded-full",
                    PLAYER_COLORS[actor.player].dot,
                  )}
                />
                {playerName(actor.player)} to act
              </>
            ) : (
              "Actions"
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {actor
              ? `Available: ${actor.currentStack.toLocaleString("en-US")} chips`
              : game?.status === "hand_complete"
                ? "Choose Next hand to continue"
                : game?.status === "game_over"
                  ? "Reset to start a new game"
                  : game
                    ? "Waiting for the final result"
                    : "Start a game to take a seat"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            variant="destructive"
            disabled={!legal?.fold}
            onClick={() => onAction({ type: "Fold" })}
          >
            Fold
          </Button>
          <Button
            variant="secondary"
            disabled={!legal?.check}
            onClick={() => onAction({ type: "Check" })}
          >
            Check
          </Button>
          <Button
            variant="secondary"
            disabled={call == null}
            onClick={() => onAction({ type: "Call" })}
            className="h-auto min-h-8 whitespace-normal break-all py-1.5 tabular-nums"
          >
            {call != null
              ? `Call${call === actor?.currentStack ? " all-in" : ""} ${call.toLocaleString("en-US")}`
              : "Call"}
          </Button>
          <Button
            variant="outline"
            disabled={legal?.allin == null}
            onClick={() => onAction({ type: "Allin" })}
            className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
          >
            All-in
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <WagerControl
            key={`${actionKey}:bet`}
            type="Bet"
            range={legal?.bet ?? null}
            onAction={onAction}
          />
          <WagerControl
            key={`${actionKey}:raise`}
            type="Raise"
            range={legal?.raise ?? null}
            onAction={onAction}
          />
        </div>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Bet and raise show your total for this street. Each + / − step is 40
          chips.
        </p>
      </CardContent>
    </Card>
  );
}
