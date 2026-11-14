"use client";

import { useId, useState, useTransition } from "react";

import { MorphText } from "@/components/motion/morph-text";
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
import type { Preferences } from "@/types/contracts";

import { updatePreferences } from "../actions";
import { SettingsCard, SettingsFooter, SettingsResultText, SettingsRow, SettingsRows } from "./settings-card";
import { Segmented, SelectField, Switch } from "./settings-controls";

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
    <SettingsCard id="preferences" title="Learning preferences" description="How notes, the tutor and checkpoints work for you.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => setResult(await updatePreferences(values)));
        }}
      >
        <SettingsRows>
          <SettingsRow
            label="Notes and answers in"
            labelId={`${id}-lang-label`}
            description="Each lesson can still be opened in another language."
          >
            <Segmented
              labelledBy={`${id}-lang-label`}
              name={`${id}-lang`}
              options={OUTPUT_LANGUAGES.map((v) => ({ value: v, label: OUTPUT_LANGUAGE_NAMES[v] }))}
              value={values.language}
              onChange={(v) => set("language", v)}
            />
          </SettingsRow>

          <SettingsRow label="Where you're studying" htmlFor={`${id}-level`}>
            <SelectField
              id={`${id}-level`}
              value={values.level}
              options={LEARNER_LEVELS.map((v) => ({ value: v, label: LEARNER_LEVEL_NAMES[v] }))}
              onChange={(v) => set("level", v)}
            />
          </SettingsRow>

          <SettingsRow label="Default way to explain differently" htmlFor={`${id}-style`}>
            <SelectField
              id={`${id}-style`}
              value={values.defaultStyle}
              options={TUTOR_STYLES.map((v) => ({ value: v, label: TUTOR_STYLE_NAMES[v] }))}
              onChange={(v) => set("defaultStyle", v)}
            />
          </SettingsRow>

          <SettingsRow label="Maths detail" labelId={`${id}-math-label`}>
            <Segmented
              labelledBy={`${id}-math-label`}
              name={`${id}-math`}
              options={MATH_DETAIL_LEVELS.map((v) => ({ value: v, label: MATH_LABEL[v] }))}
              value={values.mathDetail}
              onChange={(v) => set("mathDetail", v)}
            />
          </SettingsRow>

          <SettingsRow label="Tutor tone" labelId={`${id}-tone-label`}>
            <Segmented
              labelledBy={`${id}-tone-label`}
              name={`${id}-tone`}
              options={TONES.map((v) => ({ value: v, label: TONE_LABEL[v] }))}
              value={values.tone}
              onChange={(v) => set("tone", v)}
            />
          </SettingsRow>

          <SettingsRow
            label="Pause for checkpoint questions"
            htmlFor={`${id}-pause`}
            description="The video stops at the end of each chapter for one question. When this is off, take them from the chapter list whenever you like."
            descriptionId={`${id}-pause-hint`}
            className="grid-cols-[minmax(0,1fr)_auto] items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <Switch
              id={`${id}-pause`}
              describedBy={`${id}-pause-hint`}
              checked={values.pauseForCheckpoints}
              onChange={(checked) => set("pauseForCheckpoints", checked)}
            />
          </SettingsRow>

          <SettingsRow
            label="Ask why I paused"
            htmlFor={`${id}-ask-paused`}
            description="When you pause a lecture, Sapience asks whether you have a doubt, got distracted, are taking notes or need a break, and helps with that."
            descriptionId={`${id}-ask-paused-hint`}
            className="grid-cols-[minmax(0,1fr)_auto] items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <Switch
              id={`${id}-ask-paused`}
              describedBy={`${id}-ask-paused-hint`}
              checked={values.askWhyPaused}
              onChange={(checked) => set("askWhyPaused", checked)}
            />
          </SettingsRow>
        </SettingsRows>

        <SettingsFooter>
          <SettingsResultText result={result} className="mr-auto" />
          <Button type="submit" disabled={pending}>
            <MorphText>{pending ? "Saving…" : "Save preferences"}</MorphText>
          </Button>
        </SettingsFooter>
      </form>
    </SettingsCard>
  );
}
