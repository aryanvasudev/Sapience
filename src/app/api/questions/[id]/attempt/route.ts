import { z } from "zod";

import { handle, requireApiUser } from "@/lib/api";
import { AppError, readJsonBody } from "@/lib/errors";
import { gradeAttempt } from "@/lib/questions/service";
import { AttemptRequestSchema, AttemptResultSchema } from "@/types/contracts";

/** POST /api/questions/[id]/attempt: `{ selectedIndex }` → `AttemptResult` (Section 5.7). */
export async function POST(request: Request, ctx: RouteContext<"/api/questions/[id]/attempt">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw new AppError("not_found", "That question doesn't exist.");
    const { selectedIndex } = await readJsonBody(request, AttemptRequestSchema);
    const result = AttemptResultSchema.parse(await gradeAttempt(user, id, selectedIndex));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  });
}
