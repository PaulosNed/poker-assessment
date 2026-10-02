"use client";

import { useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";

import { ActionControls } from "@/components/poker/action-controls";
import { HandHistory } from "@/components/poker/hand-history";
import { HandResult } from "@/components/poker/hand-result";
import { LiveTable } from "@/components/poker/live-table";
import { PlayLog } from "@/components/poker/play-log";
import { SetupControls } from "@/components/poker/setup-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    continueToNextHand,
  } = useSimulator();
  const handFinished =
    game?.status === "hand_complete" || game?.status === "game_over";

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-8 sm:py-7">
      <h1 className="sr-only">Poker hand simulator</h1>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)] lg:gap-8 xl:gap-10">
        <div className="min-w-0 space-y-5">
          <SetupControls
            appliedStack={appliedStack}
            active={Boolean(game)}
            onApply={setAppliedStack}
            onStart={() => start(appliedStack)}
          />
          <Tabs defaultValue="play-log" className="gap-5">
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
              <TabsList
                aria-label="Simulation view"
                className="ml-auto h-9 border bg-white"
              >
                <TabsTrigger
                  value="play-log"
                  className="px-3 text-xs data-active:bg-primary/10 data-active:text-primary"
                >
                  Play log
                </TabsTrigger>
                <TabsTrigger
                  value="game-ui"
                  className="px-3 text-xs data-active:bg-primary/10 data-active:text-primary"
                >
                  Game UI
                </TabsTrigger>
              </TabsList>
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

            <div className="relative">
              <TabsContent value="play-log" className="absolute inset-0">
                <PlayLog events={game?.events ?? []} />
              </TabsContent>
              {/* Keep the table's natural height while its inactive panel is invisible and inert. */}
              <TabsContent
                value="game-ui"
                keepMounted
                hidden={false}
                className="data-hidden:invisible"
              >
                <LiveTable game={game} appliedStack={appliedStack} />
              </TabsContent>
            </div>
          </Tabs>
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
        <aside className="min-w-0 border-t border-border/70 pt-6 lg:relative lg:min-h-0 lg:self-stretch lg:border-l lg:border-t-0 lg:pt-0">
          <div className="lg:absolute lg:inset-0 lg:pl-8 xl:pl-10">
            <HandHistory
              hands={hands}
              loading={historyLoading}
              error={historyError}
              onRefresh={refreshHistory}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
