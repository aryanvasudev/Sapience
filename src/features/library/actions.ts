"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const DeleteConceptSchema = z.object({ id: z.uuid() });

/** Remove a saved concept; its revision item and review history cascade (RLS: own rows only). */
export async function deleteConcept(input: { id: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/library");
  const parsed = DeleteConceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("concepts")
    .delete({ count: "exact" })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error || count === 0) return { ok: false };
  revalidatePath("/app/library");
  return { ok: true };
}
