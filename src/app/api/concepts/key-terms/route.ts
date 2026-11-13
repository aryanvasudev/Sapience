import { handle, requireApiUser } from "@/lib/api";
import { readJsonBody } from "@/lib/errors";
import { saveKeyTerms } from "@/lib/revision/key-terms";
import { KeyTermsRequestSchema, KeyTermsResponseSchema } from "@/types/contracts";

/** POST /api/concepts/key-terms: add every key term of a lesson to revision (P1). No AI call. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const body = await readJsonBody(request, KeyTermsRequestSchema);
    const result = KeyTermsResponseSchema.parse(await saveKeyTerms(user, body));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  });
}
