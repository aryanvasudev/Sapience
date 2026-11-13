import Link from "next/link";
import { Suspense } from "react";

import { AppNav, AppNavFallback } from "@/components/layout/app-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/layout/wordmark";
import { isAdmin } from "@/lib/admin/usage";
import { requireUser } from "@/lib/auth";
import { dueCount } from "@/lib/revision/service";

/**
 * Signed-in shell. The header renders immediately; everything that depends on the session
 * (account menu, guest banner, the page itself) waits for the server-side auth check, so a
 * signed-out request never renders app content even if the proxy redirect were bypassed.
 */
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/90 print:hidden backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:gap-4 md:gap-6 md:px-6">
          <Wordmark href="/app" compact />
          <Suspense fallback={<AppNavFallback />}>
            <NavWithDueCount />
          </Suspense>
          <div className="ml-auto">
            <Suspense fallback={<span aria-hidden className="mr-1.5 block size-8 rounded-full bg-muted" />}>
              <AccountMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <Suspense fallback={<PageSkeleton />}>
        <AuthGate>{children}</AuthGate>
      </Suspense>
    </div>
  );
}

async function NavWithDueCount() {
  await requireUser();
  return <AppNav dueCount={await dueCount()} />;
}

async function AccountMenu() {
  const user = await requireUser();
  return <UserMenu email={user.email} isAnonymous={user.isAnonymous} isAdmin={isAdmin(user)} />;
}

async function AuthGate({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      {user.isAnonymous ? (
        <div className="border-b bg-surface print:hidden">
          <p className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm text-muted-foreground md:px-6">
            <span>You&apos;re trying Sapience as a guest. Create an account to keep your progress.</span>
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center font-medium text-foreground underline decoration-foreground/30 underline-offset-4 transition-[text-decoration-color] duration-150 ease-(--ease-out) md:min-h-0 [@media(hover:hover)]:hover:decoration-foreground"
            >
              Create an account
            </Link>
          </p>
        </div>
      ) : null}
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-20 md:px-6 md:pt-14 print:p-0">
        {children}
      </main>
    </>
  );
}

function PageSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-6xl px-4 pt-10 md:px-6 md:pt-14">
      <div className="h-10 w-2/3 max-w-md animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      <div className="mt-8 h-14 max-w-2xl animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
    </div>
  );
}
