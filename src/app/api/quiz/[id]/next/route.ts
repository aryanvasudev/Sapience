import { z } from "zod";

import { withAiAccess } from "@/lib/ai/byok";
import { handle, requireApiUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { nextQuestion } from "@/lib/quiz/service";
import { QuizSessionSchema } from "@/types/contracts";

export const maxDuration = 60;

/**
 * POST /api/quiz/[id]/next: the question to answer now. Returns the waiting question if there is
 * one; otherwise writes the next one at the topic's current level. Counts as one AI request.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/quiz/[id]/next">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw new AppError("not_found", "That quiz doesn't exist.");
    const session = await withAiAccess(user, () => nextQuestion(user, id));
    return Response.json(QuizSessionSchema.parse(session), { headers: { "Cache-Control": "no-store" } });
  });
}
