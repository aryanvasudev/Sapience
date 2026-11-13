import { withAiAccess } from "@/lib/ai/byok";
import { handle, requireApiUser } from "@/lib/api";
import { readJsonBody } from "@/lib/errors";
import { createCheckQuestion } from "@/lib/questions/service";
import { CheckQuestionRequestSchema, CheckQuestionResponseSchema } from "@/types/contracts";

/** POST /api/questions/check: one MCQ from a tutor answer (Section 5.6.5). */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const { conversationId, messageId } = await readJsonBody(request, CheckQuestionRequestSchema);
    const question = await withAiAccess(user, () => createCheckQuestion(user, conversationId, messageId));
    const body = CheckQuestionResponseSchema.parse({ question });
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  });
}
