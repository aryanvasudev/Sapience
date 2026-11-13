/**
 * Browser-side JSON calls to our own API. Every failure becomes `{ code, message }` with the
 * server's safe message (Section 10), or a generic one if the network failed.
 */
import type { z } from "zod";

import { ApiErrorSchema } from "@/types/contracts";

export type ClientResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export async function requestJson<S extends z.ZodType>(
  url: string,
  schema: S,
  init: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal } = {},
): Promise<ClientResult<z.infer<S>>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
      cache: "no-store",
    });
  } catch {
    return { ok: false, code: "network", message: "Couldn't reach Sapience. Check your connection and try again." };
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ApiErrorSchema.safeParse(json);
    return error.success
      ? { ok: false, code: error.data.error.code, message: error.data.error.message }
      : { ok: false, code: "internal", message: "Something went wrong on our side. Try again." };
  }
  const parsed = schema.safeParse(json);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, code: "internal", message: "Something went wrong on our side. Try again." };
}
