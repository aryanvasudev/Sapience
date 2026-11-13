"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Primary navigation. Revision carries the due count (Section 5.10: the only reminder in the MVP).
 * Settings lives in the account menu.
 */
const NAV_ITEMS = [
  { href: "/app", label: "Home", exact: true },
  { href: "/app/library", label: "Library", exact: false },
  { href: "/app/revision", label: "Revision", exact: false },
] as const;

export function AppNav({ dueCount = 0 }: { dueCount?: number }) {
  return <NavLinks pathname={usePathname()} dueCount={dueCount} />;
}

/** Same links without the active marker: the prerendered fallback while the URL is unknown. */
export function AppNavFallback() {
  return <NavLinks pathname={null} dueCount={0} />;
}

function NavLinks({ pathname, dueCount }: { pathname: string | null; dueCount: number }) {
  return (
    <nav aria-label="Main" className="flex min-w-0 items-center sm:gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname !== null && (item.exact ? pathname === item.href : pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex h-11 items-center rounded-md px-2.5 text-sm sm:px-3 font-medium text-muted-foreground transition-colors duration-150 ease-(--ease-out) md:h-10 [@media(hover:hover)]:hover:text-foreground",
              active &&
                "text-foreground after:absolute after:inset-x-2.5 after:-bottom-[7px] sm:after:inset-x-3 after:h-0.5 after:rounded-full after:bg-sapphire md:after:-bottom-[9px]",
            )}
          >
            {item.label}
            {item.href === "/app/revision" && dueCount > 0 ? (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sapphire px-1.5 text-[0.6875rem] font-medium text-primary-foreground tabular-nums">
                {dueCount > 99 ? "99+" : dueCount}
                <span className="sr-only"> due</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
