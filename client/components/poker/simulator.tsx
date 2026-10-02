"use client";

import { useState } from "react";
import { AlertCircle, ArrowUpRight, LoaderCircle, Spade } from "lucide-react";

import { ActionControls } from "@/components/poker/action-controls";
import { HandHistory } from "@/components/poker/hand-history";
import { LiveTable } from "@/components/poker/live-table";
import { PlayLog } from "@/components/poker/play-log";
import { SetupControls } from "@/components/poker/setup-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSimulator } from "@/lib/use-simulator";

export function Simulator() {
  const [appliedStack, setAppliedStack] = useState(10000);
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
  } = useSimulator();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70">
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
          <p className="hidden items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground/60 md:flex">
            6 seats <span className="px-1">/</span> No ante{" "}
            <ArrowUpRight className="ml-1 size-3.5" aria-hidden="true" />
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
            <LiveTable game={game} appliedStack={appliedStack} />

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
                    The next hand begins once the results are ready.
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
            <div className="bottom-3 z-10 sm:sticky">
              <ActionControls game={game} onAction={act} />
            </div>
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
