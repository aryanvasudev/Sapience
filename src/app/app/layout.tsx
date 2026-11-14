import { Suspense } from "react";

import { AppSidebar, AppSidebarFallback, HeaderTitle } from "@/components/layout/app-sidebar";
import { ClientCacheFreshness } from "@/components/layout/client-cache-freshness";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { isAdmin } from "@/lib/admin/usage";
import { requireUser } from "@/lib/auth";
import { dueCount } from "@/lib/revision/service";

/**
 * Signed-in shell (Efferd app-shell-4: inset, icon-collapsible sidebar). The frame renders
 * immediately; everything that depends on the session (the account, the due count, the page
 * itself) waits for the server-side auth check, so a signed-out request never renders app content
 * even if the proxy redirect were bypassed.
 *
 * On desktop the inset panel is the scroll container, so the page header can stay pinned inside
 * the rounded frame. Printing (the exam sheet) drops the frame entirely.
 */
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <SidebarProvider className="print:block print:bg-white">
      <ClientCacheFreshness />
      {/* The sidebar must stay a direct sibling of the inset: the inset's margins key off `peer`. */}
      <Suspense fallback={<AppSidebarFallback />}>
        <SidebarWithSession />
      </Suspense>
      <SidebarInset
        id="main"
        className="min-w-0 md:h-[calc(100svh-1rem)] md:overflow-y-auto md:overscroll-contain print:m-0! print:h-auto print:overflow-visible print:ring-0!"
      >
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 md:px-6 print:hidden">
          <SidebarTrigger className="-ml-1.5 text-muted-foreground [@media(hover:hover)]:hover:text-foreground" />
          <span aria-hidden className="h-4 w-px bg-border" />
          <Suspense fallback={null}>
            <HeaderTitle />
          </Suspense>
        </header>
        <Suspense fallback={<PageSkeleton />}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  );
}

async function SidebarWithSession() {
  const user = await requireUser();
  return (
    <AppSidebar
      dueCount={await dueCount()}
      user={{ email: user.email, isAnonymous: user.isAnonymous, isAdmin: isAdmin(user) }}
    />
  );
}

async function AuthGate({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="mx-auto w-full max-w-[78rem] flex-1 px-4 pt-8 pb-20 md:px-8 md:pt-10 print:p-0">{children}</div>;
}

function PageSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[78rem] px-4 pt-8 md:px-8 md:pt-10">
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      <div className="mt-3 h-4 w-80 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
      <div className="mt-8 h-14 max-w-3xl animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
    </div>
  );
}
