import { useEffect, useRef } from "react";
import { ArrowRight, CheckCircle2, RotateCcw, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import type { GameState } from "@/domain";
import { chipChange, playerName, PLAYER_COLORS } from "@/lib/poker-display";
import { cn } from "@/lib/utils";

interface HandResultProps {
  game: GameState;
  onContinue: () => void;
  onReset: () => void;
}

export function HandResult({ game, onContinue, onReset }: HandResultProps) {
  const resultCard = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const settlement = game.events.findLast((event) => event.type === "settled")!;
  const completion = game.events.findLast(
    (event) => event.type === "completed",
  );
  const gameOver = game.status === "game_over";
  const winner = gameOver
    ? game.players.find((player) => !player.eliminated)
    : null;

  useEffect(() => {
    resultCard.current?.scrollIntoView({ block: "nearest" });
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <Card
      ref={resultCard}
      className="gap-0 overflow-hidden ring-primary/25 shadow-md shadow-emerald-950/5"
    >
      <CardHeader className="gap-4 border-b border-primary/15 bg-primary/5 py-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {gameOver ? (
              <Trophy className="size-5" />
            ) : (
              <CheckCircle2 className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Saved · Results confirmed
            </p>
            <h2
              ref={heading}
              tabIndex={-1}
              className="text-xl font-semibold tracking-tight outline-none"
            >
              {winner
                ? `${playerName(winner.player)} wins the game`
                : `Hand ${game.handNumber} complete`}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {gameOver
                ? "All chips are accounted for. Reset the stacks to play again."
                : "Review the results below. The next hand starts when you’re ready."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-white font-normal">
            {completion?.type === "completed" && completion.reason === "folds"
              ? "Won by folds"
              : "Showdown"}
          </Badge>
          {completion?.type === "completed" && (
            <Badge
              variant="outline"
              className="bg-white font-normal tabular-nums"
            >
              Final pot · {completion.pot.toLocaleString("en-US")}
            </Badge>
          )}
          <Badge variant="outline" className="bg-white font-normal">
            {settlement.results.length} players
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="py-4">
        <div className="overflow-x-auto">
          <table
            className="w-full text-sm"
            aria-label={`Hand ${game.handNumber} results`}
          >
            <thead>
              <tr className="border-b text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="pb-3 text-left font-medium">
                  Player
                </th>
                <th scope="col" className="px-3 pb-3 text-right font-medium">
                  Net result
                </th>
                <th scope="col" className="pb-3 text-right font-medium">
                  Ending stack
                </th>
              </tr>
            </thead>
            <tbody>
              {settlement.results.map((result) => (
                <tr
                  key={result.player}
                  className="border-b border-border/60 last:border-0"
                >
                  <th scope="row" className="py-3 text-left font-medium">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2 rounded-full",
                          PLAYER_COLORS[result.player].dot,
                        )}
                      />
                      {playerName(result.player)}
                    </span>
                    {result.endingStack === 0 && (
                      <span className="mt-1 block pl-4 text-[10px] font-normal text-muted-foreground">
                        Eliminated
                      </span>
                    )}
                  </th>
                  <td
                    className={cn(
                      "px-3 py-3 text-right font-mono font-semibold tabular-nums",
                      result.winLoss > 0
                        ? "text-primary"
                        : result.winLoss < 0
                          ? "text-destructive"
                          : "text-muted-foreground",
                    )}
                  >
                    {chipChange(result.winLoss)}
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums">
                    {result.endingStack.toLocaleString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p
          className="mt-3 break-all font-mono text-[10px] text-muted-foreground"
          title="Saved hand ID"
        >
          {settlement.handId}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-3 bg-primary/3">
        <p className="text-xs text-muted-foreground">
          {gameOver
            ? "Game over · Ready for a fresh start?"
            : "Stacks are updated. No new cards have been dealt."}
        </p>
        <Button onClick={gameOver ? onReset : onContinue} className="h-10 px-5">
          {gameOver ? (
            <>
              <RotateCcw />
              Reset stacks & play
            </>
          ) : (
            <>
              Next hand
              <ArrowRight />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
