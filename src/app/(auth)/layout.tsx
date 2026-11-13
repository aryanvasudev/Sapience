import Link from "next/link";

import { ArrowBackIcon } from "@/components/icons";
import { Wordmark } from "@/components/layout/wordmark";

/**
 * Sign-in and sign-up frame. Layout from Efferd (https://efferd.com, @efferd/auth-4): a narrow
 * column drawn with hairlines on both sides, running the full height of the page, with full-bleed
 * dividers around the form (see AuthPanel). No decoration; the form is the page.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <Wordmark />
          <Link
            href="/"
            className="-mr-2 inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:text-foreground"
          >
            <ArrowBackIcon className="size-4.5" />
            Home
          </Link>
        </div>
      </header>
      <main id="main" className="flex flex-1 justify-center px-4">
        <div className="flex w-full max-w-[28rem] flex-col border-x">{children}</div>
      </main>
    </div>
  );
}
