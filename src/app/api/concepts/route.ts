import { handle, requireApiUser } from "@/lib/api";
import { readJsonBody } from "@/lib/errors";
import { saveConcept } from "@/lib/revision/service";
import { CreateConceptRequestSchema, CreateConceptResponseSchema } from "@/types/contracts";

/** POST /api/concepts: save a concept for revision (Section 5.10). Saving twice returns the existing one. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    // Explanations can be long; allow more than the 2 KB default.
    const body = await readJsonBody(request, CreateConceptRequestSchema, 16 * 1024);
    const result = CreateConceptResponseSchema.parse(await saveConcept(user, body));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  });
}
