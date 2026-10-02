"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  applyAction,
  applySettlement,
  createGame,
  shuffleDeck,
  startNextHand,
  toSubmission,
  type GameState,
  type HandSubmission,
  type PlayerAction,
  type SavedHand,
} from "@/domain";
import { fetchHands, HandApiError, saveHand } from "@/lib/hand-api";

interface PendingHand {
  game: GameState;
  payload: HandSubmission;
  generation: number;
}

interface SaveState {
  saving: boolean;
  error: string | null;
  retryable: boolean;
}

function nextHandOptions() {
  return { deck: shuffleDeck(), submissionId: crypto.randomUUID() };
}

export function useSimulator() {
  const [game, setGame] = useState<GameState | null>(null);
  const [gameError, setGameError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const [hands, setHands] = useState<SavedHand[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const currentGame = useRef<GameState | null>(null);
  const generation = useRef(0);
  const pending = useRef<PendingHand | null>(null);
  const inFlight = useRef(new Set<string>());
  const historyRequest = useRef(0);

  const loadHistory = useCallback(() => {
    const request = ++historyRequest.current;
    const indicatorUntil = performance.now() + 600;
    return fetchHands()
      .then((saved) => {
        if (request !== historyRequest.current) return;
        setHands(saved);
        setHistoryError(null);
      })
      .catch((error: unknown) => {
        console.error("Could not load saved hand history.", error);
        if (request !== historyRequest.current) return;
        setHistoryError("Saved hands could not be loaded. Please try again.");
      })
      .finally(async () => {
        // Keep fast refreshes visible; incoming results are shown immediately.
        const remaining = indicatorUntil - performance.now();
        if (remaining > 0)
          await new Promise((resolve) => setTimeout(resolve, remaining));
        if (request === historyRequest.current) setHistoryLoading(false);
      });
  }, []);

  useEffect(() => {
    void loadHistory();
    return () => {
      historyRequest.current += 1;
    };
  }, [loadHistory]);

  function refreshHistory() {
    setHistoryLoading(true);
    void loadHistory();
  }

  function publish(next: GameState) {
    currentGame.current = next;
    setGame(next);
  }

  async function settle(hand: PendingHand) {
    const id = hand.payload.submissionId;
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setSaveState({ saving: true, error: null, retryable: false });

    let saved: SavedHand;
    try {
      saved = await saveHand(hand.payload);
    } catch (error) {
      console.error("Could not settle and save the completed hand.", error);
      if (hand.generation === generation.current) {
        const retryable = !(error instanceof HandApiError) || error.retryable;
        setSaveState({
          saving: false,
          error:
            error instanceof HandApiError
              ? error.message
              : "The hand could not be saved. Check your connection and try again.",
          retryable,
        });
      }
      return;
    } finally {
      inFlight.current.delete(id);
    }

    // An abandoned game's saved hand still belongs in history.
    refreshHistory();
    if (hand.generation !== generation.current) return;

    try {
      const next = applySettlement(hand.game, saved);
      pending.current = null;
      setSaveState(null);
      publish(next);
    } catch (error) {
      console.error("Could not apply the saved hand's settlement.", error);
      setSaveState({
        saving: false,
        error:
          "The saved result could not be applied to this game. Please reset to start a new game.",
        retryable: false,
      });
    }
  }

  function beginSettlement(next: GameState) {
    if (next.status !== "awaiting_settlement") return;
    // Keep this exact snapshot and submission ID for every retry.
    const hand = {
      game: next,
      payload: toSubmission(next),
      generation: generation.current,
    };
    pending.current = hand;
    void settle(hand);
  }

  function start(startingStack: number) {
    try {
      const next = createGame(startingStack, nextHandOptions());
      generation.current += 1;
      pending.current = null;
      setSaveState(null);
      setGameError(null);
      publish(next);
      beginSettlement(next);
    } catch (error) {
      console.error("Could not start the game.", error);
      setGameError("The game could not be started. Please try again.");
    }
  }

  function act(action: PlayerAction) {
    if (!currentGame.current || currentGame.current.status !== "playing")
      return;
    try {
      const next = applyAction(currentGame.current, action);
      setGameError(null);
      publish(next);
      beginSettlement(next);
    } catch (error) {
      console.error("Could not apply the player's action.", error);
      setGameError(
        "That action could not be applied. The hand has not advanced.",
      );
    }
  }

  function retrySave() {
    if (pending.current && saveState?.retryable) void settle(pending.current);
  }

  function continueToNextHand() {
    if (currentGame.current?.status !== "hand_complete") return;
    try {
      const next = startNextHand(currentGame.current, nextHandOptions());
      setGameError(null);
      publish(next);
      beginSettlement(next);
    } catch (error) {
      console.error("Could not start the next hand.", error);
      setGameError("The next hand could not be started. Please try again.");
    }
  }

  return {
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
  };
}
