import { handle, requireApiUser } from "@/lib/api";
import { AppError, readJsonBody } from "@/lib/errors";
import { retryLesson } from "@/lib/lessons/service";
import { RetryLessonRequestSchema, YouTubeVideoId } from "@/types/contracts";

/** POST /api/lessons/[videoId]/retry `{ language, chapterPosition? }`. */
export async function POST(request: Request, ctx: RouteContext<"/api/lessons/[videoId]/retry">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { videoId } = await ctx.params;
    const id = YouTubeVideoId.safeParse(videoId);
    if (!id.success) throw new AppError("bad_request");
    const body = await readJsonBody(request, RetryLessonRequestSchema);
    return Response.json(await retryLesson({ user, videoId: id.data, ...body }));
  });
}
