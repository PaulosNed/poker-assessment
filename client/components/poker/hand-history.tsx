import { AlertCircle, History, RefreshCw } from "lucide-react";

import { PlayingCard } from "@/components/poker/playing-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { compactHistory, getPositions } from "@/domain";
import type { SavedHand } from "@/domain/types";
import { cn } from "@/lib/utils";

interface HandHistoryProps {
  hands: SavedHand[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function HistoryHand({ hand }: { hand: SavedHand }) {
  const positions = getPositions(
    hand.dealer,
    hand.players.map((player) => player.player),
  );

  return (
    <Card size="sm" className="gap-3 bg-card/70">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-medium">
            {hand.players.length}-player hand
          </h3>
          <time
            dateTime={hand.createdAt}
            className="text-[11px] tabular-nums text-muted-foreground"
          >
            {new Date(hand.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
        <p
          className="break-all font-mono text-[11px] leading-relaxed text-muted-foreground"
          aria-label={`Hand ${hand.id}`}
        >
          {hand.id}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table
            className="w-full text-xs"
            aria-label="Players, starting stacks, and net results"
          >
            <thead>
              <tr className="border-b border-border/70 text-[10px] text-muted-foreground">
                <th scope="col" className="pb-2 text-left font-normal">
                  Player / position
                </th>
                <th scope="col" className="px-2 pb-2 text-left font-normal">
                  Cards
                </th>
                <th scope="col" className="pb-2 text-right font-normal">
                  Start / net
                </th>
              </tr>
            </thead>
            <tbody>
              {hand.players.map((player) => (
                <tr
                  key={player.player}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="py-2.5 align-middle">
                    <p className="font-medium">Player {player.player}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {player.player === positions.dealer && (
                        <Badge
                          variant="outline"
                          className="h-4 px-1.5 text-[9px] text-muted-foreground"
                        >
                          Dealer
                        </Badge>
                      )}
                      {player.player === positions.smallBlind && (
                        <Badge
                          variant="outline"
                          className="h-4 px-1.5 text-[9px] text-muted-foreground"
                        >
                          SB
                        </Badge>
                      )}
                      {player.player === positions.bigBlind && (
                        <Badge
                          variant="outline"
                          className="h-4 px-1.5 text-[9px] text-muted-foreground"
                        >
                          BB
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2.5 align-middle">
                    <div className="flex gap-1">
                      {player.cards.map((card) => (
                        <PlayingCard key={card} card={card} size="sm" />
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 text-right align-middle tabular-nums">
                    <p className="text-xs text-muted-foreground">
                      {player.startingStack.toLocaleString("en-US")}
                    </p>
                    <p
                      aria-label={`Net result: ${player.winLoss > 0 ? "+" : ""}${player.winLoss}`}
                      className={cn(
                        "mt-1 font-mono text-xs font-medium",
                        player.winLoss > 0 && "text-primary",
                        player.winLoss < 0 && "text-destructive",
                        player.winLoss === 0 && "text-muted-foreground",
                      )}
                    >
                      {player.winLoss > 0 ? "+" : ""}
                      {player.winLoss.toLocaleString("en-US")}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hand.communityCards.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Board
            </span>
            <div className="flex gap-1">
              {hand.communityCards.map((card) => (
                <PlayingCard key={card} card={card} size="sm" />
              ))}
            </div>
          </div>
        )}
        <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Action sequence
          </p>
          <p className="break-all font-mono text-[11px] leading-relaxed text-foreground/80">
            {compactHistory(hand)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function HandHistory({
  hands,
  loading,
  error,
  onRefresh,
}: HandHistoryProps) {
  return (
    <section aria-labelledby="history-heading" className="min-w-0">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <History
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <h2
              id="history-heading"
              className="text-base font-semibold tracking-tight"
            >
              Hand history
            </h2>
            {hands.length > 0 && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[10px] tabular-nums"
              >
                {hands.length}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Completed hands, newest first.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh hand history"
          title="Refresh hand history"
        >
          <RefreshCw
            className={cn("size-3.5", loading && "animate-spin")}
            aria-hidden="true"
          />
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle />
          <AlertTitle>History couldn’t load</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="mt-2"
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading && hands.length === 0 && (
        <div
          role="status"
          aria-label="Loading saved hands"
          className="space-y-4"
        >
          {[0, 1].map((index) => (
            <Card key={index} size="sm" className="space-y-3">
              <CardContent className="space-y-4">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && hands.length === 0 && (
        <Card className="bg-card/50">
          <CardContent className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-background/50">
              <History
                className="size-5 text-muted-foreground/60"
                aria-hidden="true"
              />
            </div>
            <p className="text-sm font-medium">A clean slate.</p>
            <p className="mt-2 max-w-60 text-xs leading-relaxed text-muted-foreground">
              Finish your first hand to see its cards, actions, and final
              results here.
            </p>
          </CardContent>
        </Card>
      )}

      {hands.length > 0 && (
        <ScrollArea className="h-[min(900px,80vh)] pr-2">
          <div className="space-y-4 p-px pb-3">
            {hands.map((hand) => (
              <HistoryHand key={hand.id} hand={hand} />
            ))}
          </div>
        </ScrollArea>
      )}
    </section>
  );
}
