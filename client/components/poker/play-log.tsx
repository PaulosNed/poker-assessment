import { useEffect, useRef, type ReactNode } from "react";
import { ListOrdered } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GameEvent } from "@/domain/types";
import { PLAYER_COLORS, playerName } from "@/lib/poker-display";
import { cn } from "@/lib/utils";

function PlayerChip({ player }: { player: number }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 justify-center rounded-md px-2 text-[11px] font-semibold",
        PLAYER_COLORS[player].badge,
      )}
    >
      {playerName(player)}
    </Badge>
  );
}

function CardTags({ cards }: { cards: readonly string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {cards.map((card) => (
        <code
          key={card}
          className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-xs font-medium text-slate-700"
        >
          {card}
        </code>
      ))}
    </span>
  );
}

function Chips({ amount }: { amount: number }) {
  return (
    <span className="break-all font-mono text-xs font-semibold tabular-nums text-slate-800">
      {amount.toLocaleString("en-US")}
      <span className="ml-1 font-sans text-[10px] font-normal text-slate-500">
        chips
      </span>
    </span>
  );
}

function PlayerRow({
  player,
  label,
  children,
}: {
  player: number;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-3 my-1.5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-md border-l-3 px-2.5 py-2 text-xs sm:grid-cols-[5.5rem_minmax(0,1fr)_auto]",
        PLAYER_COLORS[player].row,
      )}
    >
      <PlayerChip player={player} />
      <span className="leading-relaxed text-slate-600">{label}</span>
      {children && (
        <span className="col-start-2 min-w-0 sm:col-start-3 sm:text-right">
          {children}
        </span>
      )}
    </div>
  );
}

function EventEntry({ event }: { event: GameEvent }) {
  switch (event.type) {
    case "hand_started":
      return null;
    case "dealt":
      return (
        <PlayerRow player={event.player} label="Hole cards dealt">
          <CardTags cards={event.cards} />
        </PlayerRow>
      );
    case "blind":
      return (
        <PlayerRow
          player={event.player}
          label={`Posts ${event.blind === "SB" ? "small" : "big"} blind`}
        >
          <Chips amount={event.amount} />
        </PlayerRow>
      );
    case "uncalled_return":
      return (
        <PlayerRow player={event.player} label="Uncalled chips returned">
          <Chips amount={event.amount} />
        </PlayerRow>
      );
    case "street":
      return (
        <div className="mx-3 mb-2 mt-4 flex flex-wrap items-center gap-3 border-y border-slate-200 bg-slate-50 px-3 py-2.5">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
            {event.street}
          </h4>
          {event.cards.length > 0 && <CardTags cards={event.cards} />}
          {event.street === "Preflop" && (
            <span className="text-[11px] text-slate-500">Betting begins</span>
          )}
        </div>
      );
    case "action": {
      const label = {
        Fold: "Folds",
        Check: "Checks",
        Call: "Calls",
        Bet: "Bets to",
        Raise: "Raises to",
        Allin: "Goes all-in",
      }[event.actionType];
      return (
        <PlayerRow player={event.player} label={label}>
          {event.actionType !== "Fold" && event.actionType !== "Check" && (
            <Chips amount={event.amountTo ?? event.amount} />
          )}
        </PlayerRow>
      );
    }
    case "completed":
      return (
        <div className="mx-3 mb-3 mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
          <div>
            <p className="text-xs font-semibold text-slate-800">
              Betting complete
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {event.reason === "folds"
                ? "All other players folded."
                : "Showdown reached."}
            </p>
          </div>
          <div className="text-right">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Final pot
            </p>
            <Chips amount={event.pot} />
          </div>
        </div>
      );
    case "settled":
      return (
        <div className="mx-3 mb-3 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
          <p className="text-xs font-semibold text-emerald-800">
            Hand complete · saved to history
          </p>
          <p className="mt-1 break-all font-mono text-[10px] text-emerald-700">
            {event.handId}
          </p>
        </div>
      );
    case "game_over":
      return (
        <div className="mx-3 mb-3 rounded-lg bg-emerald-50 px-3 py-3 text-xs text-emerald-800">
          <p className="font-semibold">Game over</p>
          <p className="mt-1">
            {playerName(event.winner)} finishes with all the chips.
          </p>
        </div>
      );
  }
}

function HandBlock({
  handNumber,
  events,
}: {
  handNumber: number;
  events: GameEvent[];
}) {
  const start = events.find((event) => event.type === "hand_started");
  const saved = events.some((event) => event.type === "settled");
  const complete = events.some((event) => event.type === "completed");

  return (
    <section
      aria-labelledby={`log-hand-${handNumber}`}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white pb-2 shadow-sm"
    >
      <div className="mb-3 border-b border-slate-200 bg-slate-50 px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <h3
            id={`log-hand-${handNumber}`}
            className="text-sm font-semibold text-slate-900"
          >
            Hand {handNumber}
          </h3>
          <Badge
            variant="outline"
            className={cn(
              "h-5 rounded-md px-1.5 text-[10px] font-medium",
              saved
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-500",
            )}
          >
            {saved ? "Completed" : complete ? "Awaiting result" : "In progress"}
          </Badge>
        </div>
        {start && (
          <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
            {[
              { label: "Dealer", player: start.dealer },
              { label: "SB", player: start.smallBlind },
              { label: "BB", player: start.bigBlind },
            ].map((position) => (
              <div key={position.label} className="flex items-center gap-1.5">
                <dt className="text-slate-500">{position.label}</dt>
                <dd className="font-medium text-slate-700">
                  {playerName(position.player)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {events.map((event, index) => (
        <EventEntry key={index} event={event} />
      ))}
    </section>
  );
}

export function PlayLog({ events }: { events: GameEvent[] }) {
  const scrollRoot = useRef<HTMLDivElement>(null);
  const hands = new Map<number, GameEvent[]>();
  for (const event of events) {
    if (!hands.has(event.handNumber)) hands.set(event.handNumber, []);
    hands.get(event.handNumber)!.push(event);
  }

  useEffect(() => {
    const viewport = scrollRoot.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [events]);

  return (
    <Card className="h-full min-h-0 gap-0 bg-white pb-0">
      <CardHeader className="shrink-0 border-b border-slate-200 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-800">
          <ListOrdered className="size-4 text-slate-400" aria-hidden="true" />
          <h2>Play log</h2>
        </CardTitle>
        <p className="mt-1 text-xs text-slate-500">
          Cards, decisions, and results. Every hand, in order.
        </p>
      </CardHeader>
      <CardContent className="relative min-h-0 flex-1 px-0 pt-0">
        <ScrollArea
          ref={scrollRoot}
          className="h-full rounded-b-xl bg-slate-50/70"
        >
          {events.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-medium text-slate-700">
                Ready for the first hand
              </p>
              <p className="mt-2 max-w-60 text-xs leading-relaxed text-slate-500">
                Start a game to follow each player’s cards, decisions, and
                results here.
              </p>
            </div>
          ) : (
            <div
              role="log"
              aria-label="Hand activity"
              aria-live="polite"
              aria-relevant="additions"
              className="space-y-4 p-3 sm:p-4"
            >
              {[...hands].map(([handNumber, handEvents]) => (
                <HandBlock
                  key={handNumber}
                  handNumber={handNumber}
                  events={handEvents}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
