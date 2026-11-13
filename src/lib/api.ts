import "server-only";

import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/errors";

/** The verified user for an API request (guests included), or a 401. */
export async function requireApiUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("unauthorized");
  return user;
}

/** Wrap a route handler body so every thrown error becomes safe JSON. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    return errorResponse(error);
  }
}
