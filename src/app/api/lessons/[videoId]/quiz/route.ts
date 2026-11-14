import { handle, requireApiUser } from "@/lib/api";
import { AppError, readJsonBody } from "@/lib/errors";
import { startQuiz } from "@/lib/quiz/service";
import { QuizSessionSchema, QuizStartRequestSchema, YouTubeVideoId } from "@/types/contracts";

/** POST /api/lessons/[videoId]/quiz: `{ language, chapterPosition? }` → a new adaptive quiz (no AI call yet). */
export async function POST(request: Request, ctx: RouteContext<"/api/lessons/[videoId]/quiz">) {
  return handle(async () => {
    const user = await requireApiUser();
    const id = YouTubeVideoId.safeParse((await ctx.params).videoId);
    if (!id.success) throw new AppError("not_found");
    const { language, chapterPosition } = await readJsonBody(request, QuizStartRequestSchema);
    const session = QuizSessionSchema.parse(await startQuiz(user, { videoId: id.data, language, chapterPosition }));
    return Response.json(session, { headers: { "Cache-Control": "no-store" } });
  });
}
