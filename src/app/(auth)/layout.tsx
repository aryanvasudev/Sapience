import Link from "next/link";

import { ArrowBackIcon, CheckCircleIcon } from "@/components/icons";
import { CheckpointMark, Wordmark } from "@/components/layout/wordmark";
import { ThreadsBackdrop } from "@/components/marketing/hero-shader";

/**
 * Sign-in and sign-up frame. Layout from Efferd (https://efferd.com, @efferd/auth-2): the form on
 * the left, a panel on the right. Adapted: the panel runs the React Bits "Threads" shader behind
 * one real moment from a lesson (a checkpoint answered right), and folds away below `lg`.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 items-center justify-between gap-4 px-4 md:px-8">
          <Wordmark />
          <Link
            href="/"
            className="-mr-2 inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:text-foreground"
          >
            <ArrowBackIcon className="size-4.5" />
            Home
          </Link>
        </header>
        <main id="main" className="flex flex-1 justify-center px-4 pb-16 md:px-8">
          <div className="flex w-full max-w-[24rem] flex-col">{children}</div>
        </main>
      </div>

      <aside aria-hidden className="relative isolate hidden overflow-hidden border-l bg-surface lg:m-2 lg:flex lg:rounded-2xl lg:border">
        <ThreadsBackdrop className="-z-10 [mask-image:linear-gradient(to_top,black_40%,transparent)]" />
        <div className="mt-auto w-full p-10 xl:p-14">
          <div className="enter max-w-[22rem] rounded-2xl border bg-card/90 p-5 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.6)] backdrop-blur-md [--i:3] dark:shadow-[0_24px_60px_-24px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.05)]">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckpointMark className="size-2" />
              Checkpoint · chapter 3
            </p>
            <p className="mt-2.5 text-[0.9375rem] leading-snug">What does the degree of polymerization count?</p>
            <p className="mt-3.5 flex h-10 items-center justify-between rounded-lg border border-positive/50 bg-positive/10 px-3 text-sm">
              Repeat units in an average chain
              <CheckCircleIcon className="size-4 text-positive" />
            </p>
          </div>
          <p className="enter mt-8 max-w-[26rem] text-heading font-semibold [--i:4]">
            Every chapter ends with a question
          </p>
          <p className="enter mt-3 max-w-[26rem] text-[0.9375rem] leading-relaxed text-muted-foreground [--i:5]">
            So you find out what didn’t stick while the lecture is still fresh, not the night before the exam.
          </p>
        </div>
      </aside>
    </div>
  );
}
