import type { HandSubmission, SavedHand } from "@/domain";

export class HandApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "HandApiError";
  }

  get retryable() {
    return this.status >= 500 || this.status === 408 || this.status === 429;
  }
}

async function request<T>(options?: RequestInit): Promise<T> {
  const response = await fetch("/api/hands", { ...options, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) {
    const message =
      typeof body.detail === "string"
        ? body.detail
        : Array.isArray(body.detail)
          ? body.detail.map((issue: { msg: string }) => issue.msg).join(" ")
          : `The hand service returned HTTP ${response.status}.`;
    throw new HandApiError(message, response.status);
  }
  return body as T;
}

export function fetchHands() {
  return request<SavedHand[]>();
}

export function saveHand(hand: HandSubmission) {
  return request<SavedHand>({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hand),
  });
}
