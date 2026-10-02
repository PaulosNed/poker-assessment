import { Coins, Trophy } from "lucide-react";

import { PlayingCard } from "@/components/poker/playing-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SEATS, type GameState } from "@/domain";
import { cn } from "@/lib/utils";

export function LiveTable({
  game,
  appliedStack,
}: {
  game: GameState | null;
  appliedStack: number;
}) {
  const winner =
    game?.status === "game_over"
      ? game.players.find((player) => player.currentStack > 0)
      : null;
  const activeCount = game?.players.filter(
    (player) => !player.eliminated,
  ).length;

  return (
    <section aria-label="Current simulation" className="space-y-4">
      <Card className="overflow-hidden border-primary/15 bg-primary/3 py-5">
        <CardContent>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-medium">
                  {game ? `Hand ${game.handNumber}` : "The table"}
                </h2>
                <Badge
                  variant="outline"
                  className="border-primary/20 text-primary"
                >
                  {game?.status === "game_over"
                    ? "Game over"
                    : (game?.street ?? "Ready to play")}
                </Badge>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {game
                  ? `${activeCount} ${activeCount === 1 ? "player" : "players"} in the game`
                  : "Six seats. Every decision is yours."}
              </p>
            </div>
            <div className="max-w-[60%] text-right">
              <p className="flex items-center justify-end gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                <Coins className="size-3" aria-hidden="true" /> Pot
              </p>
              <p
                className="mt-1 break-all text-2xl font-semibold tracking-tight tabular-nums"
                aria-label={`Pot ${game?.pot ?? 0}`}
              >
                {(game?.pot ?? 0).toLocaleString("en-US")}
              </p>
            </div>
          </div>
          <div
            className="flex items-center gap-2 sm:gap-2.5"
            aria-label="Community cards"
          >
            {[0, 1, 2, 3, 4].map((index) => (
              <PlayingCard
                key={index}
                card={game?.communityCards[index] ?? null}
              />
            ))}
            <span className="ml-auto hidden text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 sm:block">
              Community board
            </span>
          </div>
          {winner && (
            <div
              role="status"
              className="mt-5 flex items-center gap-3 border-t border-primary/15 pt-4"
            >
              <Trophy
                className="size-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-primary">
                  Player {winner.player} wins the game.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  All {winner.currentStack.toLocaleString("en-US")} chips. Reset
                  to play again.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {SEATS.map((seat) => {
          const player = game?.players[seat];
          const acting = game?.actor === seat;
          const eliminated = player?.eliminated;
          const participating = Boolean(player?.cards.length);
          const allin =
            player &&
            !eliminated &&
            !player.folded &&
            player.currentStack === 0;
          return (
            <Card
              key={seat}
              size="sm"
              aria-label={`Player ${seat}${acting ? ", to act" : ""}`}
              className={cn(
                "gap-0 py-3 transition-colors",
                acting &&
                  "border-primary/50 bg-primary/7 ring-1 ring-primary/15",
                player?.folded && "opacity-55",
                eliminated && "bg-card/30 text-muted-foreground",
              )}
            >
              <CardContent className="space-y-2.5 px-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">Player {seat}</span>
                  {acting && (
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-primary">
                      To act
                    </span>
                  )}
                </div>
                <p
                  className="break-all text-lg font-semibold tracking-tight tabular-nums"
                  aria-label={`Player ${seat} stack ${player?.currentStack ?? appliedStack}`}
                >
                  {(player?.currentStack ?? appliedStack).toLocaleString(
                    "en-US",
                  )}
                  <span className="ml-1 text-[10px] font-normal tracking-normal text-muted-foreground">
                    chips
                  </span>
                </p>
                <div className="flex min-h-9 items-center gap-1.5">
                  {eliminated && !participating ? (
                    <span className="text-xs text-muted-foreground/60">
                      Out of the game
                    </span>
                  ) : (
                    [0, 1].map((index) => (
                      <PlayingCard
                        key={index}
                        size="sm"
                        card={player?.cards[index] ?? null}
                      />
                    ))
                  )}
                  {player && player.streetCommitted > 0 && !eliminated && (
                    <span className="ml-auto text-right text-[10px] leading-relaxed text-muted-foreground">
                      In for
                      <br />
                      <span className="font-mono text-foreground/75">
                        {player.streetCommitted.toLocaleString("en-US")}
                      </span>
                    </span>
                  )}
                </div>
                <div className="flex min-h-4 flex-wrap gap-1">
                  {game && participating && seat === game.dealer && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                      Dealer
                    </Badge>
                  )}
                  {game && participating && seat === game.smallBlind && (
                    <Badge
                      variant="outline"
                      className="h-4 px-1.5 text-[9px] text-muted-foreground"
                    >
                      SB
                    </Badge>
                  )}
                  {game && participating && seat === game.bigBlind && (
                    <Badge
                      variant="outline"
                      className="h-4 px-1.5 text-[9px] text-muted-foreground"
                    >
                      BB
                    </Badge>
                  )}
                  {player?.folded && (
                    <Badge
                      variant="secondary"
                      className="h-4 px-1.5 text-[9px]"
                    >
                      Folded
                    </Badge>
                  )}
                  {allin && (
                    <Badge
                      variant="outline"
                      className="h-4 border-primary/30 px-1.5 text-[9px] text-primary"
                    >
                      All-in
                    </Badge>
                  )}
                  {eliminated && (
                    <Badge
                      variant="secondary"
                      className="h-4 px-1.5 text-[9px]"
                    >
                      Eliminated
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
