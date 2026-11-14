"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ComponentType } from "react";

import { AddIcon, AutoStoriesIcon, CalendarMonthIcon, EventRepeatIcon, GroupsIcon, HomeIcon, PersonAddIcon } from "@/components/icons";
import { SidebarUserMenu } from "@/components/layout/user-menu";
import { LogoMark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";
import { FOCUS_PASTE_BOX_EVENT } from "@/features/dashboard/events";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/**
 * Signed-in sidebar. Structure from Efferd (https://efferd.com, @efferd/app-shell-4): an inset,
 * icon-collapsible sidebar with a primary action, navigation, and the account at the foot.
 * Adapted: Sapience's destinations in two groups (your own study, and studying with others), the
 * revision due count, a guest card in place of the changelog card, and an active surface that
 * glides between rows (one layout group across both groups).
 */
type NavItem = { href: string; label: string; icon: ComponentType<{ className?: string }>; exact: boolean };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Study",
    items: [
      { href: "/app", label: "Home", icon: HomeIcon, exact: true },
      { href: "/app/library", label: "Library", icon: AutoStoriesIcon, exact: false },
      { href: "/app/revision", label: "Revision", icon: EventRepeatIcon, exact: false },
      { href: "/app/calendar", label: "Calendar", icon: CalendarMonthIcon, exact: false },
    ],
  },
  {
    label: "Together",
    items: [{ href: "/app/rooms", label: "Study rooms", icon: GroupsIcon, exact: false }],
  },
];

export type SidebarUser = { email: string | null; isAnonymous: boolean; isAdmin: boolean };

export function AppSidebar({ dueCount = 0, user }: { dueCount?: number; user: SidebarUser | null }) {
  return (
    <>
      <SidebarView pathname={usePathname()} dueCount={dueCount} user={user} />
      {/* Inside the same boundary so it only collapses after the sidebar has hydrated. */}
      <SidebarAutoCollapse />
    </>
  );
}

/** The same sidebar without the active marker or the account: the prerendered fallback. */
export function AppSidebarFallback() {
  return <SidebarView pathname={null} dueCount={0} user={null} />;
}

function SidebarView({ pathname, dueCount, user }: { pathname: string | null; dueCount: number; user: SidebarUser | null }) {
  const reduce = useReducedMotion();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="h-14 justify-center px-3 group-data-[collapsible=icon]:px-2">
        <Link
          href="/app"
          className="flex items-center gap-2.5 rounded-md px-1 text-[0.9375rem] font-semibold tracking-[-0.02em] outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:px-0"
        >
          <LogoMark />
          <span className="transition-opacity duration-200 ease-(--ease-out) group-data-[collapsible=icon]:opacity-0">Sapience</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="New lesson"
                className="h-9 justify-start gap-2.5 bg-foreground px-2.5 font-medium text-background shadow-[inset_0_1px_0_rgb(255_255_255/0.15)] transition-[background-color,transform] duration-150 ease-(--ease-out) hover:bg-foreground/90 hover:text-background active:scale-[0.98] active:bg-foreground/90 active:text-background group-data-[collapsible=icon]:justify-center"
              >
                <Link
                  href="/app#start"
                  onClick={(event) => {
                    setOpenMobile(false);
                    if (pathname === "/app") {
                      event.preventDefault();
                      window.dispatchEvent(new Event(FOCUS_PASTE_BOX_EVENT));
                    }
                  }}
                >
                  <AddIcon className="size-4.5!" />
                  <span className="group-data-[collapsible=icon]:hidden">New lesson</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <LayoutGroup id="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-faint">{group.label}</SidebarGroupLabel>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const active = pathname !== null && (item.exact ? pathname === item.href : pathname.startsWith(item.href));
                  const Icon = item.icon;
                  const showDue = item.href === "/app/revision" && dueCount > 0;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className="relative isolate h-9 gap-2.5 px-2.5 group-data-[collapsible=icon]:justify-center text-muted-foreground transition-colors duration-150 ease-(--ease-out) hover:bg-transparent hover:text-foreground data-[active=true]:bg-transparent data-[active=true]:text-foreground [@media(hover:hover)]:hover:bg-sidebar-accent/60"
                      >
                        <Link href={item.href} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)}>
                          {active ? (
                            <motion.span
                              layoutId="active"
                              aria-hidden
                              className="absolute inset-0 -z-10 rounded-md bg-sidebar-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] ring-1 ring-sidebar-border"
                              transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.34, bounce: 0.1 }}
                            />
                          ) : null}
                          <Icon className="size-4.5!" />
                          <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                          {showDue ? (
                            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 font-mono text-[0.6875rem] font-medium text-brand-foreground tabular-nums group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-0.5 group-data-[collapsible=icon]:right-0.5 group-data-[collapsible=icon]:h-2 group-data-[collapsible=icon]:min-w-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:text-[0px]">
                              {dueCount > 99 ? "99+" : dueCount}
                              <span className="sr-only"> due</span>
                            </span>
                          ) : null}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </LayoutGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 p-2">
        {user?.isAnonymous ? <GuestCard /> : null}
        {user ? (
          <SidebarUserMenu email={user.email} isAnonymous={user.isAnonymous} isAdmin={user.isAdmin} />
        ) : (
          <div aria-hidden className="flex h-12 items-center gap-2.5 px-2">
            <span className="size-8 shrink-0 rounded-lg bg-sidebar-accent" />
            <span className="h-3 w-24 rounded bg-sidebar-accent group-data-[collapsible=icon]:hidden" />
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function GuestCard() {
  return (
    <div className="rounded-xl border bg-background/60 p-3 transition-opacity duration-200 ease-(--ease-out) group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:hidden">
      <p className="text-[0.8125rem] font-medium">Guest session</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Create an account to keep your lessons, answers and revision.</p>
      <Button asChild size="sm" variant="outline" className="mt-3 h-8 w-full">
        <Link href="/signup">
          <PersonAddIcon />
          Create an account
        </Link>
      </Button>
    </div>
  );
}

/**
 * The lesson screen needs the width, so the sidebar folds to icons when a lesson opens and comes
 * back when the student leaves, unless they toggled it themselves in between.
 */
function SidebarAutoCollapse() {
  const pathname = usePathname();
  const { setOpen, open, isMobile } = useSidebar();
  const inLesson = pathname.startsWith("/app/lesson/");
  const before = useRef<boolean | null>(null);

  useEffect(() => {
    if (isMobile) return;
    if (inLesson && before.current === null) {
      before.current = open;
      if (open) setOpen(false);
    } else if (!inLesson && before.current !== null) {
      if (before.current) setOpen(true);
      before.current = null;
    }
    // Only route changes drive this; `open` is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inLesson, isMobile]);

  return null;
}

/** Page name for the inset header, from the route. */
const TITLES: [RegExp, string][] = [
  [/^\/app\/lesson\/[^/]+\/sheet/, "Exam sheet"],
  [/^\/app\/lesson\//, "Lesson"],
  [/^\/app\/library/, "Library"],
  [/^\/app\/calendar/, "Calendar"],
  [/^\/app\/rooms/, "Study rooms"],
  [/^\/app\/revision/, "Revision"],
  [/^\/app\/settings/, "Settings"],
  [/^\/app\/admin\/usage/, "Usage"],
  [/^\/app\/?$/, "Home"],
];

export function HeaderTitle({ className }: { className?: string }) {
  const pathname = usePathname();
  const title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "";
  return (
    <span key={title} className={cn("animate-fade truncate text-sm font-medium", className)}>
      {title}
    </span>
  );
}
