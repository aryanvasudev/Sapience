import { z } from "zod";

import { handle, requireApiUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { finishQuiz } from "@/lib/quiz/service";
import { QuizSessionSchema } from "@/types/contracts";

/** POST /api/quiz/[id]/finish: end the quiz now and get the summary. */
export async function POST(_request: Request, ctx: RouteContext<"/api/quiz/[id]/finish">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw new AppError("not_found", "That quiz doesn't exist.");
    return Response.json(QuizSessionSchema.parse(await finishQuiz(user, id)), { headers: { "Cache-Control": "no-store" } });
  });
}
