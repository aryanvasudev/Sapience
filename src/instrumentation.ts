/**
 * Runs once when the server starts. Validates the environment so a misconfigured deployment
 * fails at boot instead of on the first request (Section 4: `src/env.ts` fails fast).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { clientEnv, serverEnv } = await import("@/env");
  clientEnv();
  serverEnv();
}
