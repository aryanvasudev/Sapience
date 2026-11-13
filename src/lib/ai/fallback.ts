/**
 * Run an AI call down a model chain (Section 4.5.3). Only rate-limit errors fall back to the next
 * model; any other error is thrown as-is. If every model is rate-limited, throws `AiBusyError`.
 * Pure: the caller supplies the call and receives which model answered and what it fell back from.
 */
import { AiBusyError, isRateLimitError, retryAfterSeconds } from "./errors";

export type FallbackAttempt<M> = { model: M; error: unknown };

export type FallbackResult<M, T> = {
  value: T;
  model: M;
  /** The first model that was tried and rate-limited, if the answer came from a later one. */
  fallbackFrom: M | null;
  attempts: FallbackAttempt<M>[];
};

export async function withFallback<M, T>(
  chain: readonly M[],
  call: (model: M) => Promise<T>,
  hooks: { onRateLimited?: (model: M, error: unknown) => void | Promise<void> } = {},
): Promise<FallbackResult<M, T>> {
  if (chain.length === 0) throw new Error("withFallback: empty model chain");
  const attempts: FallbackAttempt<M>[] = [];
  let shortestWait: number | null = null;

  for (const model of chain) {
    try {
      const value = await call(model);
      return { value, model, fallbackFrom: attempts.length > 0 ? attempts[0].model : null, attempts };
    } catch (error) {
      if (!isRateLimitError(error)) throw error;
      attempts.push({ model, error });
      const wait = retryAfterSeconds(error);
      if (wait !== null) shortestWait = shortestWait === null ? wait : Math.min(shortestWait, wait);
      await hooks.onRateLimited?.(model, error);
    }
  }
  throw new AiBusyError(shortestWait);
}
