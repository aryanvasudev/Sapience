import { withAiAccess } from "@/lib/ai/byok";
import { handle, requireApiUser } from "@/lib/api";
import { AppError, readJsonBody } from "@/lib/errors";
import { completeDecks, lookupDecks, missingChapters, savedDecks } from "@/lib/flashcards/service";
import { FlashcardsRequestSchema, FlashcardsResponseSchema, YouTubeVideoId } from "@/types/contracts";

export const maxDuration = 120;

/**
 * POST /api/lessons/[videoId]/flashcards: `{ language, chapterPosition? }` → decks for one chapter
 * or the whole lecture. Decks already made are free; making missing ones counts as one AI request.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/lessons/[videoId]/flashcards">) {
  return handle(async () => {
    const user = await requireApiUser();
    const id = YouTubeVideoId.safeParse((await ctx.params).videoId);
    if (!id.success) throw new AppError("not_found");
    const { language, chapterPosition } = await readJsonBody(request, FlashcardsRequestSchema);
    const lookup = await lookupDecks({ videoId: id.data, language, chapterPosition });
    const decks =
      missingChapters(lookup).length === 0 ? savedDecks(lookup) : await withAiAccess(user, () => completeDecks(user, lookup, language));
    return Response.json(FlashcardsResponseSchema.parse({ decks }), { headers: { "Cache-Control": "no-store" } });
  });
}
