"use client";

import { useId, useState, useTransition } from "react";

import Stepper, { Step } from "@/components/reactbits/stepper";
import { Button } from "@/components/ui/button";
import {
  LEARNER_LEVEL_NAMES,
  LEARNER_LEVELS,
  MATH_DETAIL_LEVELS,
  OUTPUT_LANGUAGE_NAMES,
  OUTPUT_LANGUAGES,
} from "@/config/enums";
import { cn } from "@/lib/utils";

import { completeOnboarding } from "../actions";
import type { OnboardingInput } from "../schemas";

const LANGUAGE_HINTS: Record<(typeof OUTPUT_LANGUAGES)[number], string | undefined> = {
  en: undefined,
  hi: "Devanagari script",
  hinglish: "Hindi and English mixed, in Roman script",
};

const MATH_OPTIONS: Record<(typeof MATH_DETAIL_LEVELS)[number], { label: string; hint: string }> = {
  light: { label: "Light", hint: "The idea first, minimal algebra" },
  standard: { label: "Standard", hint: "Key steps shown" },
  detailed: { label: "Detailed", hint: "Every step written out" },
};

const TOTAL_STEPS = 3;

/**
 * Three onboarding questions, one at a time. Uses the ReactBits Stepper because this is a real
 * sequence: each answer is independent, the student can go back, and the last step saves.
 */
export function OnboardingForm({ defaults }: { defaults: OnboardingInput }) {
  const id = useId();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<OnboardingInput>(defaults);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof OnboardingInput>(key: K, value: OnboardingInput[K]) =>
    setAnswers((current) => ({ ...current, [key]: value }));

  const submit = (values: OnboardingInput | null) => {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding(values);
      if (!result.ok) {
        setError(result.message);
        setStep(TOTAL_STEPS);
      }
    });
  };

  return (
    <div className="grid gap-6">
      <Stepper
        step={step}
        onStepChange={setStep}
        onFinalStepCompleted={() => {
          setStep(TOTAL_STEPS + 1);
          submit(answers);
        }}
        width="100%"
        radius={18}
        nextButtonText="Next"
        completeButtonText="Save and continue"
        nextButtonProps={{ disabled: pending }}
        completedContent={
          <p role="status" className="py-6 text-[0.9375rem] text-muted-foreground">
            Saving your answers…
          </p>
        }
      >
        <Step title="Language">
          <Question legend="Which language should notes and answers use?" hint="You can change this for any lesson.">
            {OUTPUT_LANGUAGES.map((value) => (
              <Choice
                key={value}
                name={`${id}-language`}
                label={OUTPUT_LANGUAGE_NAMES[value]}
                hint={LANGUAGE_HINTS[value]}
                checked={answers.language === value}
                onSelect={() => set("language", value)}
              />
            ))}
          </Question>
        </Step>
        <Step title="Level">
          <Question legend="Where are you studying?">
            {LEARNER_LEVELS.map((value) => (
              <Choice
                key={value}
                name={`${id}-level`}
                label={LEARNER_LEVEL_NAMES[value]}
                checked={answers.level === value}
                onSelect={() => set("level", value)}
              />
            ))}
          </Question>
        </Step>
        <Step title="Maths detail">
          <Question legend="How much maths detail do you want in explanations?">
            {MATH_DETAIL_LEVELS.map((value) => (
              <Choice
                key={value}
                name={`${id}-math`}
                label={MATH_OPTIONS[value].label}
                hint={MATH_OPTIONS[value].hint}
                checked={answers.mathDetail === value}
                onSelect={() => set("mathDetail", value)}
              />
            ))}
          </Question>
          {error ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </Step>
      </Stepper>

      <div className="flex justify-center">
        <Button type="button" variant="ghost" disabled={pending} onClick={() => submit(null)} className="text-muted-foreground">
          Skip for now
        </Button>
      </div>
    </div>
  );
}

function Question({ legend, hint, children }: { legend: string; hint?: string; children: React.ReactNode }) {
  return (
    // A <legend> is not a grid item, so it carries its own bottom margin.
    <fieldset className="grid gap-3">
      <legend className="mb-4 text-[1.0625rem] leading-snug font-medium text-balance">{legend}</legend>
      {hint ? <p className="-mt-2 mb-1 text-[0.8125rem] text-muted-foreground">{hint}</p> : null}
      <div className="grid gap-2">{children}</div>
    </fieldset>
  );
}

function Choice({
  name,
  label,
  hint,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  hint?: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] border bg-card px-3.5 py-3 transition-[background-color,border-color,transform] duration-150 ease-(--ease-out) active:scale-[0.99]",
        "has-checked:border-foreground/30 has-checked:bg-raised has-focus-visible:ring-2 has-focus-visible:ring-ring",
        "[@media(hover:hover)]:hover:border-foreground/20",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-foreground/25 bg-transparent transition-[border-width,border-color] duration-150 ease-(--ease-out) outline-none checked:border-[5px] checked:border-brand"
      />
      <span className="grid gap-0.5">
        <span className="text-[0.9375rem] font-medium">{label}</span>
        {hint ? <span className="text-[0.8125rem] text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}
