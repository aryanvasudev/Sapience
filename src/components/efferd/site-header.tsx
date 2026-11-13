"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Portal, PortalBackdrop } from "@/components/efferd/portal";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";
import { useScroll } from "@/hooks/use-scroll";

/**
 * Public header. From Efferd (https://efferd.com, @efferd/header-2): sticky, transparent over the
 * hero, gains a surface and hairline once the page scrolls, and folds its links into a full-screen
 * menu on phones. Adapted: only pages and sections that exist are linked, the account actions come
 * from the server (they depend on the session), and only colour properties transition.
 */
export const SITE_NAV = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Questions", href: "/#faqs" },
  { label: "Privacy", href: "/privacy" },
] as const;

export function SiteHeader({ actions }: { actions?: ReactNode }) {
  const scrolled = useScroll(10);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      data-scrolled={scrolled || open}
      className="sticky top-0 z-50 border-b border-transparent transition-[background-color,border-color] duration-200 ease-(--ease-out) data-[scrolled=true]:border-border data-[scrolled=true]:bg-background/85 data-[scrolled=true]:backdrop-blur-md"
    >
      <nav aria-label="Main" className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Wordmark />
        <div className="hidden items-center gap-1 md:flex">
          {SITE_NAV.map((link) => (
            <Button asChild key={link.href} size="sm" variant="ghost" className="h-9 px-3 text-muted-foreground [@media(hover:hover)]:hover:text-foreground">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
          {actions ? <div className="ml-3 flex items-center gap-2 border-l pl-4">{actions}</div> : null}
        </div>
        <Button
          aria-controls="site-menu"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="md:hidden"
          onClick={() => setOpen((value) => !value)}
          size="icon"
          variant="ghost"
        >
          {open ? <CloseIcon className="size-4.5" /> : <MenuIcon className="size-4.5" />}
        </Button>
      </nav>

      {open ? (
        <Portal className="top-16 md:hidden" id="site-menu">
          <PortalBackdrop />
          <div className="size-full p-4 duration-200 ease-(--ease-out) animate-in fade-in-0 slide-in-from-top-1">
            <ul className="grid gap-1">
              {SITE_NAV.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex h-12 items-center rounded-lg px-3 text-base font-medium transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:bg-muted"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            {actions ? (
              <div className="mt-8 grid gap-2 border-t pt-6 *:data-[slot=button]:h-12 *:data-[slot=button]:w-full">{actions}</div>
            ) : null}
          </div>
        </Portal>
      ) : null}
    </header>
  );
}
