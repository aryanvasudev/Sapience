"use client";

import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  LEARNER_LEVEL_NAMES,
  LEARNER_LEVELS,
  MATH_DETAIL_LEVELS,
  OUTPUT_LANGUAGE_NAMES,
  OUTPUT_LANGUAGES,
  TONES,
  TUTOR_STYLE_NAMES,
  TUTOR_STYLES,
} from "@/config/enums";
import { cn } from "@/lib/utils";
import type { Preferences } from "@/types/contracts";

import { updatePreferences } from "../actions";

const MATH_LABEL: Record<(typeof MATH_DETAIL_LEVELS)[number], string> = {
  light: "Light",
  standard: "Standard",
  detailed: "Detailed",
};
const TONE_LABEL: Record<(typeof TONES)[number], string> = { direct: "Direct", encouraging: "Encouraging" };

export function PreferencesForm({ initial }: { initial: Preferences }) {
  const id = useId();
  const [values, setValues] = useState<Preferences>(initial);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setResult(null);
  };

  return (
    <form
      className="grid gap-7"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setResult(await updatePreferences(values)));
      }}
    >
      <Segmented
        legend="Notes and answers in"
        name={`${id}-lang`}
        options={OUTPUT_LANGUAGES.map((v) => ({ value: v, label: OUTPUT_LANGUAGE_NAMES[v] }))}
        value={values.language}
        onChange={(v) => set("language", v)}
        hint="Each lesson can still be opened in another language."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          id={`${id}-level`}
          label="Where you're studying"
          value={values.level}
          options={LEARNER_LEVELS.map((v) => ({ value: v, label: LEARNER_LEVEL_NAMES[v] }))}
          onChange={(v) => set("level", v)}
        />
        <SelectField
          id={`${id}-style`}
          label="Default way to explain differently"
          value={values.defaultStyle}
          options={TUTOR_STYLES.map((v) => ({ value: v, label: TUTOR_STYLE_NAMES[v] }))}
          onChange={(v) => set("defaultStyle", v)}
        />
      </div>

      <Segmented
        legend="Maths detail"
        name={`${id}-math`}
        options={MATH_DETAIL_LEVELS.map((v) => ({ value: v, label: MATH_LABEL[v] }))}
        value={values.mathDetail}
        onChange={(v) => set("mathDetail", v)}
      />

      <Segmented
        legend="Tutor tone"
        name={`${id}-tone`}
        options={TONES.map((v) => ({ value: v, label: TONE_LABEL[v] }))}
        value={values.tone}
        onChange={(v) => set("tone", v)}
      />

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card px-4 py-3.5">
        <input
          type="checkbox"
          checked={values.pauseForCheckpoints}
          onChange={(e) => set("pauseForCheckpoints", e.target.checked)}
          className="mt-0.5 size-4.5 accent-primary"
        />
        <span className="grid gap-0.5">
          <span className="text-[0.9375rem] font-medium">Pause for checkpoint questions</span>
          <span className="text-sm text-muted-foreground">
            The video stops at the end of each chapter for one question. When this is off, take them from the chapter list
            whenever you like.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
        {result ? (
          <p role={result.ok ? "status" : "alert"} className={cn("text-sm", result.ok ? "text-muted-foreground" : "text-destructive")}>
            {result.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Segmented<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  hint,
}: {
  legend: string;
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  hint?: string;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-[color,background-color,box-shadow] duration-150 ease-(--ease-out)",
              "has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring",
              "[@media(hover:hover)]:hover:text-foreground",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </fieldset>
  );
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const next = options.find((o) => o.value === e.target.value);
          if (next) onChange(next.value);
        }}
        className="h-11 rounded-lg border bg-card px-3 text-sm text-foreground md:h-10"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
