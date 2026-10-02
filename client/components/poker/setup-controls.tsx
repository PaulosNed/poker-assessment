import { useState } from "react";
import { Play, RotateCcw, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_STARTING_STACK } from "@/domain";

interface SetupControlsProps {
  appliedStack: number;
  active: boolean;
  onApply: (stack: number) => void;
  onStart: () => void;
}

export function SetupControls({
  appliedStack,
  active,
  onApply,
  onStart,
}: SetupControlsProps) {
  const [value, setValue] = useState(String(appliedStack));
  const [error, setError] = useState<string | null>(null);

  function apply(event: React.FormEvent) {
    event.preventDefault();
    const stack = Number(value);
    if (
      !Number.isSafeInteger(stack) ||
      stack < 40 ||
      stack > MAX_STARTING_STACK
    ) {
      setError(
        `Enter a whole number from 40 to ${MAX_STARTING_STACK.toLocaleString("en-US")}.`,
      );
      return;
    }
    setError(null);
    onApply(stack);
  }

  return (
    <Card className="py-4">
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          Game setup
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <form
            onSubmit={apply}
            className="flex min-w-0 flex-1 items-end gap-2"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="starting-stack" className="text-xs">
                Starting stack per player
              </Label>
              <Input
                id="starting-stack"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "stack-error" : "stack-help"}
                className="h-9 font-mono tabular-nums"
              />
            </div>
            <Button type="submit" variant="outline" className="h-9 px-4">
              Apply
            </Button>
          </form>
          <Button
            onClick={onStart}
            className="h-9 min-w-24 px-4"
            variant={active ? "secondary" : "default"}
          >
            {active ? <RotateCcw /> : <Play />}
            {active ? "Reset" : "Start"}
          </Button>
        </div>
        {error && (
          <p id="stack-error" role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <p
          id="stack-help"
          className="text-xs leading-relaxed text-muted-foreground"
        >
          Applied:{" "}
          <span className="font-medium tabular-nums text-foreground/90">
            {appliedStack.toLocaleString("en-US")}
          </span>{" "}
          chips each.{" "}
          {active
            ? "Reset starts a new game with this stack."
            : "Apply a stack, then start the game."}
        </p>
      </CardContent>
    </Card>
  );
}
