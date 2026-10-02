"use client";

import { useState } from "react";
import { AlertCircle, LoaderCircle, Spade } from "lucide-react";

import { ActionControls } from "@/components/poker/action-controls";
import { HandHistory } from "@/components/poker/hand-history";
import { HandResult } from "@/components/poker/hand-result";
import { LiveTable } from "@/components/poker/live-table";
import { PlayLog } from "@/components/poker/play-log";
import { SetupControls } from "@/components/poker/setup-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useSimulator } from "@/lib/use-simulator";

export function Simulator() {
  const [appliedStack, setAppliedStack] = useState(10000);
  const [showTable, setShowTable] = useState(false);
  const {
    game,
    gameError,
    saveState,
    hands,
    historyLoading,
    historyError,
    start,
    act,
    retrySave,
    refreshHistory,
    continueToNextHand,
  } = useSimulator();
  const handFinished =
    game?.status === "hand_complete" || game?.status === "game_over";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Spade
                className="size-5 fill-primary/15 text-primary"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-lg font-semibold leading-none tracking-tight">
                River<span className="text-primary">.</span>
              </p>
              <p className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Hand simulator
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              No-limit Texas Hold’em
            </span>
            <Badge
              variant="outline"
              className="ml-1 px-2.5 py-1 text-[10px] font-normal tabular-nums text-muted-foreground"
            >
              Blinds{" "}
              <span className="font-medium text-foreground">20 / 40</span>
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-8 pt-7 sm:px-8 sm:pt-9">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Your table. Your decisions.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Control every seat, one hand at a time.
            </p>
          </div>
          <p className="hidden items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground md:flex">
            6 seats <span className="px-1">/</span> No ante{" "}
          </p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)] lg:gap-8 xl:gap-10">
          <div className="min-w-0 space-y-5">
            <SetupControls
              appliedStack={appliedStack}
              active={Boolean(game)}
              onApply={setAppliedStack}
              onStart={() => start(appliedStack)}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="bg-white">
                  {game ? `Hand ${game.handNumber}` : "Ready to start"}
                </Badge>
                {game && (
                  <>
                    <span className="text-muted-foreground">
                      {handFinished
                        ? game.status === "game_over"
                          ? "Game over"
                          : "Complete"
                        : game.street}
                    </span>
                    {!handFinished && (
                      <span className="border-l pl-2 font-medium tabular-nums">
                        Pot {game.pot.toLocaleString("en-US")}
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
                <Checkbox
                  id="show-table"
                  checked={showTable}
                  onCheckedChange={setShowTable}
                  aria-controls="table-view"
                />
                <Label
                  htmlFor="show-table"
                  className="cursor-pointer text-xs font-medium"
                >
                  Show table
                </Label>
                <span className="hidden text-[10px] text-muted-foreground sm:inline">
                  Cards & stacks
                </span>
              </div>
            </div>
            <div id="table-view" hidden={!showTable}>
              <LiveTable game={game} appliedStack={appliedStack} />
            </div>

            {gameError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Action couldn’t complete</AlertTitle>
                <AlertDescription>{gameError}</AlertDescription>
              </Alert>
            )}
            {saveState?.saving && (
              <div
                role="status"
                className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"
              >
                <LoaderCircle
                  className="size-4 animate-spin text-primary"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-medium">
                    Calculating and saving this hand…
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your results will appear here before you continue.
                  </p>
                </div>
              </div>
            )}
            {saveState?.error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Hand couldn’t complete</AlertTitle>
                <AlertDescription>
                  <p>{saveState.error}</p>
                  <p>
                    {saveState.retryable
                      ? "Your completed hand is kept here. Retry to continue the game."
                      : "This hand cannot advance. Reset to start a new game."}
                  </p>
                  {saveState.retryable && (
                    <Button
                      onClick={retrySave}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      Retry saving hand
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <PlayLog events={game?.events ?? []} />
            {handFinished && game ? (
              <HandResult
                key={game.submissionId}
                game={game}
                onContinue={continueToNextHand}
                onReset={() => start(appliedStack)}
              />
            ) : (
              <ActionControls game={game} onAction={act} />
            )}
          </div>
          <aside className="min-w-0 border-t border-border/70 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0 xl:pl-10">
            <HandHistory
              hands={hands}
              loading={historyLoading}
              error={historyError}
              onRefresh={refreshHistory}
            />
          </aside>
        </div>
        <footer className="mt-8 border-t border-border/60 pt-5 text-[11px] leading-relaxed text-muted-foreground/70">
          Live games reset when you refresh the page. Completed hands stay in
          your history.
        </footer>
      </main>
    </div>
  );
}
