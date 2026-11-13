import { handle, requireApiUser } from "@/lib/api";
import { readJsonBody } from "@/lib/errors";
import { openOrCreateLesson } from "@/lib/lessons/service";
import { CreateLessonRequestSchema } from "@/types/contracts";

/** POST /api/lessons `{ url, language, transcript? }`: open an existing lesson or start building one. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    // 256 KB for this route: a pasted transcript can be up to 200 KB (Section 8).
    const body = await readJsonBody(request, CreateLessonRequestSchema, 256 * 1024);
    const result = await openOrCreateLesson({ user, ...body });
    return Response.json(result);
  });
}
