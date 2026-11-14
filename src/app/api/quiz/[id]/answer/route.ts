import { z } from "zod";

import { handle, requireApiUser } from "@/lib/api";
import { AppError, readJsonBody } from "@/lib/errors";
import { answerQuestion } from "@/lib/quiz/service";
import { QuizAnswerRequestSchema, QuizAnswerResponseSchema } from "@/types/contracts";

/** POST /api/quiz/[id]/answer: `{ questionId, selectedIndex }` → the graded result and where the quiz goes next. */
export async function POST(request: Request, ctx: RouteContext<"/api/quiz/[id]/answer">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw new AppError("not_found", "That quiz doesn't exist.");
    const { questionId, selectedIndex } = await readJsonBody(request, QuizAnswerRequestSchema);
    const body = QuizAnswerResponseSchema.parse(await answerQuestion(user, id, questionId, selectedIndex));
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  });
}
