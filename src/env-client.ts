import { z } from "zod";

/**
 * Browser-safe environment (NEXT_PUBLIC_* only). Kept apart from `env.ts` so client bundles
 * don't carry the server schema. Each value is referenced literally so Next.js inlines it.
 */

export const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
export const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());

export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown, label: string): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid ${label} environment variables. See .env.example.\n${details}`);
  }
  return result.data;
}

export const ClientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
});
export type ClientEnv = z.infer<typeof ClientEnvSchema>;

let clientEnvCache: ClientEnv | undefined;

export function clientEnv(): ClientEnv {
  clientEnvCache ??= parseOrThrow(
    ClientEnvSchema,
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_APP_URL: emptyToUndefined(process.env.NEXT_PUBLIC_APP_URL),
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    },
    "client",
  );
  return clientEnvCache;
}
