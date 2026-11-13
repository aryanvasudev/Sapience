import { handle, requireApiUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getLessonStatus } from "@/lib/lessons/service";
import { OutputLanguageSchema, YouTubeVideoId } from "@/types/contracts";

/** GET /api/lessons/[videoId]?lang=: public lesson + progress + attempts. Also runs the watchdog. */
export async function GET(request: Request, ctx: RouteContext<"/api/lessons/[videoId]">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { videoId } = await ctx.params;
    const id = YouTubeVideoId.safeParse(videoId);
    const language = OutputLanguageSchema.safeParse(new URL(request.url).searchParams.get("lang") ?? "en");
    if (!id.success || !language.success) throw new AppError("bad_request");

    const status = await getLessonStatus({ user, videoId: id.data, language: language.data });
    if (!status) throw new AppError("not_found", "There's no lesson for this video in that language yet.");
    return Response.json(status, { headers: { "cache-control": "no-store" } });
  });
}
