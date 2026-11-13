import Link from "next/link";

import { Reveal } from "@/components/motion/reveal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/**
 * FAQ section. Layout from Efferd (https://efferd.com, @efferd/faqs-7): heading column beside a
 * single-open accordion with numbered rows. Adapted to Sapience's type, spacing and content; every answer states what
 * the product actually does (SAPIENCE_IMPLEMENTATION_PLAN.md), nothing aspirational.
 */
const FAQS = [
  {
    id: "videos",
    q: "Which lectures work?",
    a: "Public YouTube videos between 1 and 90 minutes that the owner allows to play outside YouTube. Live streams and age-restricted videos can’t be turned into lessons. Lectures in English, Hindi or a mix of both work.",
  },
  {
    id: "languages",
    q: "Which languages can notes and answers be in?",
    a: "English, Hindi or Hinglish. You choose the lesson language when you paste the link, and you can switch the tutor’s answer language for any single question.",
  },
  {
    id: "account",
    q: "Do I need an account?",
    a: "No. Start as a guest and everything works, with lower daily limits. Create an account from the same browser and your progress, saved concepts and revision stay with you.",
  },
  {
    id: "cost",
    q: "Is it free?",
    a: "Yes. There is a daily limit on building new lessons. Opening a lesson someone else already built doesn’t count towards it, because each lecture is built once and shared.",
  },
  {
    id: "trust",
    q: "Can I trust the notes?",
    a: "Treat them like a classmate’s notes. Everything generated is marked as AI-generated and links to the second in the video it came from, so you can check. Tutor answers show whether they used the video clip, the lecture’s own words or general knowledge.",
  },
  {
    id: "video",
    q: "Does Sapience download the video?",
    a: "No. Lectures play in YouTube’s own player, and the AI is given the YouTube link.",
  },
];

export function FaqsSection() {
  return (
    <section id="faqs" aria-labelledby="faqs-heading" className="scroll-mt-20 border-t py-28 md:py-40">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 md:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] md:gap-16 md:px-6">
        <Reveal className="max-w-[24rem]">
          <h2 id="faqs-heading" className="text-heading font-semibold">
            Questions students ask first
          </h2>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            What Sapience can open, what it costs, and what the AI is given.{" "}
            <Link
              href="/privacy"
              className="font-medium text-foreground underline decoration-foreground/25 underline-offset-4 transition-[text-decoration-color] duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:decoration-brand"
            >
              Privacy details
            </Link>
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <Accordion type="single" collapsible className="border-t">
            {FAQS.map((item, index) => (
              <AccordionItem key={item.id} value={item.id} className="border-b">
                <AccordionTrigger className="min-h-16 items-center gap-4 rounded-none py-5 text-base font-medium focus-visible:ring-0 focus-visible:underline [@media(hover:hover)]:hover:text-foreground">
                  <span className="flex items-baseline gap-4">
                    <span className="w-6 shrink-0 font-mono text-[0.75rem] text-faint tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                    {item.q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-6 pl-10 text-[0.9375rem] leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
