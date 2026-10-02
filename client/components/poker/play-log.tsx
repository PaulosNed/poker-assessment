import { useEffect, useRef } from "react";
import { ListOrdered, NotebookPen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GameEvent } from "@/domain/types";

function Chips({ amount }: { amount: number }) {
  return (
    <strong className="font-medium tabular-nums text-foreground">
      {amount.toLocaleString("en-US")}
    </strong>
  );
}

function PlayerName({ player }: { player: number }) {
  return (
    <strong className="font-medium text-foreground">Player {player}</strong>
  );
}

function EventEntry({ event }: { event: GameEvent }) {
  switch (event.type) {
    case "hand_started":
      return (
        <div className="mb-3 mt-5 first:mt-0">
          <h3 className="mb-2 flex items-center gap-3">
            <Badge
              variant="outline"
              className="border-primary/25 bg-primary/5 text-primary"
            >
              Hand {event.handNumber}
            </Badge>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </h3>
          <p className="text-xs text-muted-foreground">
            Player {event.dealer} deals{" "}
            <span className="px-1.5 text-muted-foreground/40">/</span>
            SB {event.smallBlind}{" "}
            <span className="px-1.5 text-muted-foreground/40">/</span>
            BB {event.bigBlind}
          </p>
        </div>
      );
    case "dealt":
      return (
        <p className="text-muted-foreground">
          <PlayerName player={event.player} /> is dealt{" "}
          <span className="font-mono text-xs text-foreground/80">
            {event.cards.join(" ")}
          </span>
        </p>
      );
    case "blind":
      return (
        <p className="text-muted-foreground">
          <PlayerName player={event.player} /> posts{" "}
          {event.blind === "SB" ? "small" : "big"} blind ·{" "}
          <Chips amount={event.amount} />
        </p>
      );
    case "uncalled_return":
      return (
        <p className="text-muted-foreground">
          <PlayerName player={event.player} /> receives{" "}
          <Chips amount={event.amount} /> uncalled chips back.
        </p>
      );
    case "street":
      return (
        <div className="my-3 flex flex-wrap items-center gap-2 border-y border-border/60 py-2 text-xs text-muted-foreground">
          <h4 className="font-medium uppercase tracking-widest">
            {event.street}
          </h4>
          {event.cards.length > 0 && (
            <span className="font-mono text-foreground/80">
              {event.cards.join(" ")}
            </span>
          )}
        </div>
      );
    case "action": {
      const verb = {
        Fold: "folds",
        Check: "checks",
        Call: "calls",
        Bet: "bets to",
        Raise: "raises to",
        Allin: "goes all-in for",
      }[event.actionType];
      return (
        <p className="text-muted-foreground">
          <PlayerName player={event.player} /> {verb}
          {event.actionType !== "Fold" && event.actionType !== "Check" && (
            <>
              {" "}
              <Chips amount={event.amountTo ?? event.amount} />
            </>
          )}
        </p>
      );
    }
    case "completed":
      return (
        <p className="mt-3 border-t border-border/60 pt-3 text-muted-foreground">
          {event.reason === "folds"
            ? "All other players folded."
            : "Showdown reached."}{" "}
          Pot <Chips amount={event.pot} />. Calculating results…
        </p>
      );
    case "settled":
      return (
        <div className="my-3 space-y-1 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5">
          <p className="mb-1.5 text-xs font-medium text-primary">
            Hand saved · final results
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {event.results.map((result) => (
              <p key={result.player} className="text-xs text-muted-foreground">
                Player {result.player}{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {result.winLoss > 0 ? "+" : ""}
                  {result.winLoss.toLocaleString("en-US")}
                </span>
              </p>
            ))}
          </div>
          <p className="break-all pt-1 font-mono text-[10px] text-muted-foreground">
            {event.handId}
          </p>
        </div>
      );
    case "game_over":
      return (
        <p className="py-3 font-medium text-primary">
          Game over — Player {event.winner} has all the chips.
        </p>
      );
  }
}

export function PlayLog({ events }: { events: GameEvent[] }) {
  const scrollRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = scrollRoot.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [events]);

  return (
    <Card className="gap-0">
      <CardHeader className="border-b border-border/70 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ListOrdered
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <h2>Play log</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pt-0">
        <ScrollArea ref={scrollRoot} className="h-64 sm:h-72">
          {events.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center px-6 text-center sm:h-72">
              <NotebookPen
                className="mb-3 size-6 text-muted-foreground/40"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                Every hand has a story.
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Dealt cards, decisions, and results will appear here.
              </p>
            </div>
          ) : (
            <div
              role="log"
              aria-label="Hand activity"
              aria-live="polite"
              aria-relevant="additions"
              className="space-y-1.5 px-4 py-4 text-sm leading-relaxed sm:px-5"
            >
              {events.map((event, index) => (
                <EventEntry key={index} event={event} />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
