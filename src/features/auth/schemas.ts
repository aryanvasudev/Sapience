import { z } from "zod";

import { LEARNER_LEVELS, MATH_DETAIL_LEVELS, OUTPUT_LANGUAGES } from "@/config/enums";

export const SignInSchema = z.object({
  email: z.email("Enter a valid email address.").max(320),
  password: z.string().min(1, "Enter your password.").max(200),
  next: z.string().max(2000).optional(),
  captchaToken: z.string().max(4096).optional(),
});
export type SignInInput = z.infer<typeof SignInSchema>;

export const SignUpSchema = z.object({
  email: z.email("Enter a valid email address.").max(320),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(200, "Use at most 200 characters."),
  next: z.string().max(2000).optional(),
  captchaToken: z.string().max(4096).optional(),
});
export type SignUpInput = z.infer<typeof SignUpSchema>;

export const OnboardingSchema = z.object({
  language: z.enum(OUTPUT_LANGUAGES),
  level: z.enum(LEARNER_LEVELS),
  mathDetail: z.enum(MATH_DETAIL_LEVELS),
});
export type OnboardingInput = z.infer<typeof OnboardingSchema>;

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };
