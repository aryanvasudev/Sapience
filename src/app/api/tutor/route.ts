import { handle, requireApiUser } from "@/lib/api";
import { readJsonBody } from "@/lib/errors";
import { consumeAiQuota } from "@/lib/quota";
import { streamTutorAnswer } from "@/lib/tutor/service";
import { TutorRequestSchema } from "@/types/contracts";

/** The tutor streams; give it room beyond the default. */
export const maxDuration = 120;

/** POST /api/tutor: `TutorRequest` → UI message stream with metadata (Section 5.6). */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const body = await readJsonBody(request, TutorRequestSchema, 16 * 1024);
    await consumeAiQuota(user);
    return streamTutorAnswer(user, body, request.signal);
  });
}
