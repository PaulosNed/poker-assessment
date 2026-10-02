import { cn } from "@/lib/utils";

const suits: Record<string, { symbol: string; name: string }> = {
  c: { symbol: "♣", name: "clubs" },
  d: { symbol: "♦", name: "diamonds" },
  h: { symbol: "♥", name: "hearts" },
  s: { symbol: "♠", name: "spades" },
};

const ranks: Record<string, string> = {
  T: "Ten",
  J: "Jack",
  Q: "Queen",
  K: "King",
  A: "Ace",
};

interface PlayingCardProps {
  card: string | null;
  size?: "sm" | "md";
  className?: string;
}

export function PlayingCard({
  card,
  size = "md",
  className,
}: PlayingCardProps) {
  if (!card) {
    return (
      <span
        aria-label="Undealt card"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-400",
          size === "sm" ? "h-9 w-7" : "h-16 w-11 sm:h-18 sm:w-13",
          className,
        )}
      >
        <span aria-hidden="true" className="text-xs">
          ·
        </span>
      </span>
    );
  }

  const rank = card[0];
  const suit = suits[card[1]];
  const isRed = card[1] === "d" || card[1] === "h";

  return (
    <span
      role="img"
      aria-label={`${ranks[rank] ?? rank} of ${suit.name}`}
      title={card}
      className={cn(
        "inline-flex shrink-0 flex-col justify-between rounded-md border border-slate-300 bg-white font-semibold shadow-sm select-none",
        isRed ? "text-rose-700" : "text-slate-900",
        size === "sm"
          ? "h-9 w-7 px-1 py-0.5 text-xs leading-none"
          : "h-16 w-11 p-1.5 text-lg leading-none sm:h-18 sm:w-13 sm:text-xl",
        className,
      )}
    >
      <span aria-hidden="true">{rank === "T" ? "10" : rank}</span>
      <span aria-hidden="true" className="self-end">
        {suit.symbol}
      </span>
    </span>
  );
}
