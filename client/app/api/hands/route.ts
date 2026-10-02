async function forward(request: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) throw new Error("BACKEND_URL is not configured.");

    const response = await fetch(new URL("/api/v1/hands", backendUrl), {
      method: request.method,
      headers: { "Content-Type": "application/json" },
      body: request.method === "POST" ? await request.text() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("The hand API request failed.", error);
    return Response.json(
      { detail: "The hand service could not be reached. Please try again." },
      { status: 503 },
    );
  }
}

export const GET = forward;
export const POST = forward;
