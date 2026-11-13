import { z } from "zod";

import { handle, requireApiUser } from "@/lib/api";
import { AppError, readJsonBody } from "@/lib/errors";
import { reviewItem } from "@/lib/revision/service";
import { ReviewRequestSchema, ReviewResponseSchema } from "@/types/contracts";

/** POST /api/revision/[id]/review: `{ rating }` → the rescheduled item (Section 5.10). */
export async function POST(request: Request, ctx: RouteContext<"/api/revision/[id]/review">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw new AppError("not_found", "That revision item doesn't exist.");
    const { rating } = await readJsonBody(request, ReviewRequestSchema);
    const body = ReviewResponseSchema.parse({ revisionItem: await reviewItem(user, id, rating) });
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  });
}
