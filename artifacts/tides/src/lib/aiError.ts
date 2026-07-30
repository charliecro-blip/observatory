/**
 * Turn a failed AI-route response into something true for the user.
 *
 * The backend already sends a good message on a rate limit
 * ({error: "Too many AI requests — please wait a while before trying again."},
 * HTTP 429), but every consumer was throwing it away and rendering either a
 * generic "something went wrong" or — worse — a connectivity story ("couldn't
 * reach the sky") for what is actually a quota. A user who's been rate-limited
 * and is told it's a network problem will just retry immediately and fail
 * again.
 */
export async function aiErrorMessage(r: Response): Promise<string> {
  // Prefer the server's own words when it bothered to send them.
  const serverMsg = await r.json().then(
    (j) => (typeof j?.error === "string" ? j.error : null),
    () => null,
  );
  if (serverMsg) return serverMsg;
  if (r.status === 429) return "You've hit the hourly limit for AI features — try again in a little while.";
  if (r.status === 503) return "The AI service isn't configured on the server yet.";
  if (r.status >= 500) return "The AI service had a problem just now — give it another try in a moment.";
  return `Something went wrong (${r.status}). Try again.`;
}
