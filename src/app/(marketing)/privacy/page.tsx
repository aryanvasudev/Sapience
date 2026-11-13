import type { Metadata } from "next";

import { NotebookFrame } from "@/components/layout/notebook-frame";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <NotebookFrame className="pt-8 md:pt-14">
      <article className="max-w-[40rem] font-serif text-[1.0625rem] leading-[1.75]">
        <h1 className="text-title font-medium">Privacy</h1>
        <p className="mt-4 font-sans text-[0.9375rem] text-muted-foreground">In plain language.</p>

        <h2 className="mt-10 text-xl font-medium">What the AI receives</h2>
        <p className="mt-3">
          To build a lesson and answer your questions, Sapience sends the following to its AI provider (Google
          Gemini, and OpenRouter with the model host it routes to, if that is configured):
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6 marker:text-muted-foreground">
          <li>the YouTube link of the lecture, and the start and end time of any clip the tutor looks at</li>
          <li>your question, and any text you paste into the tutor</li>
          <li>your recent conversation with the tutor about that lecture</li>
          <li>the lesson&apos;s own text: notes and the condensed index of what the lecturer said</li>
        </ul>
        <p className="mt-4">
          Sapience runs on Gemini&apos;s free tier. On the free tier,{" "}
          <strong className="font-semibold">Google may use this content to improve its products.</strong> Don&apos;t paste
          personal information into the tutor.
        </p>

        <h2 className="mt-10 text-xl font-medium">What Sapience stores</h2>
        <p className="mt-3">
          Your account, your preferences, where you stopped in each lecture, your checkpoint answers, tutor
          conversations, saved concepts and revision history. Only you can see them. You can delete concepts and
          conversations at any time, and deleting your account deletes all of it.
        </p>
        <p className="mt-3">
          Lessons themselves (chapters, notes, questions) are generated once per lecture and shared by everyone who
          opens that lecture. They contain nothing about you.
        </p>

        <h2 className="mt-10 text-xl font-medium">What Sapience doesn&apos;t do</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-6 marker:text-muted-foreground">
          <li>It doesn&apos;t collect your browsing history.</li>
          <li>It doesn&apos;t download, copy or re-host videos. Lectures play in YouTube&apos;s own player.</li>
          <li>The player uses YouTube&apos;s privacy-enhanced mode (youtube-nocookie.com).</li>
        </ul>
      </article>
    </NotebookFrame>
  );
}
