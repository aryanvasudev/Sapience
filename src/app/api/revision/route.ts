import { handle, requireApiUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { listRevision } from "@/lib/revision/service";
import { RevisionFilterSchema, RevisionListResponseSchema } from "@/types/contracts";

/** GET /api/revision?status=due|upcoming|all (Section 5.10). */
export async function GET(request: Request) {
  return handle(async () => {
    await requireApiUser();
    const status = RevisionFilterSchema.safeParse(new URL(request.url).searchParams.get("status") ?? "due");
    if (!status.success) throw new AppError("bad_request");
    const body = RevisionListResponseSchema.parse({ items: await listRevision(status.data) });
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  });
}
