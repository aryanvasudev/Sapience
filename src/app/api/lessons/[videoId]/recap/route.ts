import { handle, requireApiUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { buildRecap } from "@/lib/recap/service";
import { OutputLanguageSchema, RecapSchema, YouTubeVideoId } from "@/types/contracts";

/** GET /api/lessons/[videoId]/recap?lang= (Section 5.11). */
export async function GET(request: Request, ctx: RouteContext<"/api/lessons/[videoId]/recap">) {
  return handle(async () => {
    const user = await requireApiUser();
    const id = YouTubeVideoId.safeParse((await ctx.params).videoId);
    const lang = OutputLanguageSchema.safeParse(new URL(request.url).searchParams.get("lang") ?? "en");
    if (!id.success) throw new AppError("not_found");
    if (!lang.success) throw new AppError("bad_request");
    const body = RecapSchema.parse(await buildRecap(user, id.data, lang.data));
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  });
}
