import { withAiAccess } from "@/lib/ai/byok";
import { handle, requireApiUser } from "@/lib/api";
import { AppError, readJsonBody } from "@/lib/errors";
import { searchLecture } from "@/lib/search/service";
import { SearchRequestSchema, SearchResponseSchema, YouTubeVideoId } from "@/types/contracts";

export const maxDuration = 60;

/** POST /api/lessons/[videoId]/search: `{ query, language }` → up to 3 places (Section 5.9). */
export async function POST(request: Request, ctx: RouteContext<"/api/lessons/[videoId]/search">) {
  return handle(async () => {
    const user = await requireApiUser();
    const id = YouTubeVideoId.safeParse((await ctx.params).videoId);
    if (!id.success) throw new AppError("not_found");
    const { query, language } = await readJsonBody(request, SearchRequestSchema);
    const result = await withAiAccess(user, () => searchLecture(user, id.data, language, query));
    const body = SearchResponseSchema.parse(result);
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  });
}
